"""Blueprint analysis pipeline adapted for S3 I/O and SSE progress streaming."""

import json
import tempfile
import time
from pathlib import Path
from typing import AsyncGenerator

from blueprint_analyzer.agents import (
    analyze_pages_parallel,
    create_auditor,
    create_material_summarizer,
    create_pdf_splitter,
    create_project_summarizer,
    create_remediator,
    extract_materials_parallel,
)
from blueprint_analyzer.storage import S3Storage, DynamoDBJobs


async def run_pipeline(
    pdf_key: str,
    bucket_name: str,
    table_name: str,
    job_id: str,
    user_id: str,
    region: str,
) -> AsyncGenerator[dict, None]:
    """Run the blueprint analysis pipeline (6-8 stages depending on audit results).

    Stages 7-8 (remediation + re-audit) only run if the initial audit finds
    critical or major issues.

    Yields progress events as dicts for SSE streaming.
    """
    s3 = S3Storage(bucket_name, region)
    db = DynamoDBJobs(table_name, region)
    output_prefix = f"outputs/{job_id}"

    db.create_job(job_id, user_id, pdf_key, output_prefix)

    pipeline_start = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        work_dir = Path(tmpdir)
        pages_dir = work_dir / "pages"
        analysis_dir = work_dir / "analysis"
        materials_dir = work_dir / "materials"
        pages_dir.mkdir()
        analysis_dir.mkdir()
        materials_dir.mkdir()

        # Download PDF from S3
        pdf_path = work_dir / "blueprint.pdf"
        yield _progress("download", "Downloading PDF from S3...")
        s3.download_file(pdf_key, str(pdf_path))
        yield _progress("download", "PDF downloaded successfully")

        # Stage 1: Split PDF into page images
        yield _stage_start(1, "Splitting PDF into pages")
        db.update_progress(job_id, "stage_1", "Splitting PDF")

        splitter = create_pdf_splitter()
        splitter(
            f"Split the blueprint PDF at: {pdf_path}\n"
            f"Save page images to: {pages_dir}"
        )

        page_count = len(list(pages_dir.glob("page_*.png")))
        yield _stage_done(1, f"Split into {page_count} pages", time.time() - pipeline_start)

        # Upload page images to S3
        for img in sorted(pages_dir.glob("page_*.png")):
            s3.upload_file(str(img), f"{output_prefix}/pages/{img.name}")

        # Stage 2: Parallel page analysis
        yield _stage_start(2, f"Analyzing {page_count} pages (vision)")
        db.update_progress(job_id, "stage_2", f"Analyzing {page_count} pages")

        stage_start = time.time()
        analyze_pages_parallel(str(pages_dir), str(analysis_dir), max_workers=4)
        yield _stage_done(2, f"Analyzed {page_count} pages", time.time() - stage_start)

        # Upload analyses to S3 (both JSON and MD)
        for f in sorted(analysis_dir.glob("page_*_analysis.json")):
            s3.upload_file(str(f), f"{output_prefix}/analysis/{f.name}")
        for f in sorted(analysis_dir.glob("page_*_analysis.md")):
            s3.upload_file(str(f), f"{output_prefix}/analysis/{f.name}")

        # Stage 3: Material extraction
        yield _stage_start(3, f"Extracting materials from {page_count} pages")
        db.update_progress(job_id, "stage_3", "Extracting materials")

        stage_start = time.time()
        extract_materials_parallel(str(analysis_dir), str(materials_dir), max_workers=4)
        yield _stage_done(3, "Materials extracted", time.time() - stage_start)

        # Upload materials to S3 (both JSON and MD)
        for f in sorted(materials_dir.glob("page_*_materials.json")):
            s3.upload_file(str(f), f"{output_prefix}/materials/{f.name}")
        for f in sorted(materials_dir.glob("page_*_materials.md")):
            s3.upload_file(str(f), f"{output_prefix}/materials/{f.name}")

        # Stage 4: Material summary
        yield _stage_start(4, "Consolidating material estimate")
        db.update_progress(job_id, "stage_4", "Material summary")

        stage_start = time.time()
        material_summarizer = create_material_summarizer()
        material_estimate_path = work_dir / "material_estimate"
        material_summarizer(
            f"Read all material takeoff JSON files in: {materials_dir}\n"
            f"Save the consolidated material estimate to output_path: {material_estimate_path}"
        )
        s3.upload_file(str(work_dir / "material_estimate.json"), f"{output_prefix}/material_estimate.json")
        s3.upload_file(str(work_dir / "material_estimate.md"), f"{output_prefix}/material_estimate.md")
        yield _stage_done(4, "Material estimate complete", time.time() - stage_start)

        # Stage 5: Project summary
        yield _stage_start(5, "Generating project summary")
        db.update_progress(job_id, "stage_5", "Project summary")

        stage_start = time.time()
        summarizer = create_project_summarizer()
        project_summary_path = work_dir / "project_summary"
        summarizer(
            f"Read all page analysis JSON files in: {analysis_dir}\n"
            f"Save the project summary to output_path: {project_summary_path}"
        )
        s3.upload_file(str(work_dir / "project_summary.json"), f"{output_prefix}/project_summary.json")
        s3.upload_file(str(work_dir / "project_summary.md"), f"{output_prefix}/project_summary.md")
        yield _stage_done(5, "Project summary complete", time.time() - stage_start)

        # Stage 6: Audit
        yield _stage_start(6, "Running audit")
        db.update_progress(job_id, "stage_6", "Auditing")

        stage_start = time.time()
        auditor = create_auditor()
        audit_report_path = work_dir / "audit_report"
        auditor(
            f"Read all page analysis JSON files in: {analysis_dir}\n"
            f"Read the project summary at: {work_dir / 'project_summary.json'}\n"
            f"Save the audit report to output_path: {audit_report_path}"
        )
        s3.upload_file(str(work_dir / "audit_report.json"), f"{output_prefix}/audit_report.json")
        s3.upload_file(str(work_dir / "audit_report.md"), f"{output_prefix}/audit_report.md")
        yield _stage_done(6, "Audit complete", time.time() - stage_start)

        # Stage 7: Remediation — re-generate project summary if audit found issues
        audit_data = json.loads((work_dir / "audit_report.json").read_text())
        audit_summary = audit_data.get("summary", {})
        critical_count = audit_summary.get("critical_count", 0)
        major_count = audit_summary.get("major_count", 0)

        if critical_count > 0 or major_count > 0:
            yield _stage_start(7, "Remediating project summary based on audit findings")
            db.update_progress(job_id, "stage_7", "Remediating")

            stage_start = time.time()
            remediator = create_remediator()
            remediated_path = work_dir / "project_summary"
            remediator(
                f"Read the audit report at: {work_dir / 'audit_report.json'}\n"
                f"Read the original project summary at: {work_dir / 'project_summary.json'}\n"
                f"Read all page analysis JSON files in: {analysis_dir}\n"
                f"Produce a corrected project summary that addresses all audit findings.\n"
                f"Save the corrected project summary to output_path: {remediated_path}"
            )
            s3.upload_file(str(work_dir / "project_summary.json"), f"{output_prefix}/project_summary.json")
            s3.upload_file(str(work_dir / "project_summary.md"), f"{output_prefix}/project_summary.md")
            yield _stage_done(7, "Remediation complete", time.time() - stage_start)

            # Re-audit against the corrected summary
            yield _stage_start(8, "Re-auditing corrected summary")
            db.update_progress(job_id, "stage_8", "Re-auditing")

            stage_start = time.time()
            auditor = create_auditor()
            audit_report_path = work_dir / "audit_report"
            auditor(
                f"Read all page analysis JSON files in: {analysis_dir}\n"
                f"Read the project summary at: {work_dir / 'project_summary.json'}\n"
                f"Save the audit report to output_path: {audit_report_path}"
            )
            s3.upload_file(str(work_dir / "audit_report.json"), f"{output_prefix}/audit_report.json")
            s3.upload_file(str(work_dir / "audit_report.md"), f"{output_prefix}/audit_report.md")
            yield _stage_done(8, "Re-audit complete", time.time() - stage_start)
        else:
            yield _stage_done(7, "No remediation needed (audit passed)", 0)

    # Mark job complete
    total_time = time.time() - pipeline_start
    db.complete_job(job_id, output_prefix)

    yield {
        "type": "complete",
        "job_id": job_id,
        "total_time_seconds": round(total_time, 1),
        "output_prefix": output_prefix,
        "results": {
            "project_summary": f"{output_prefix}/project_summary.json",
            "project_summary_raw": f"{output_prefix}/project_summary.md",
            "material_estimate": f"{output_prefix}/material_estimate.json",
            "material_estimate_raw": f"{output_prefix}/material_estimate.md",
            "audit_report": f"{output_prefix}/audit_report.json",
            "audit_report_raw": f"{output_prefix}/audit_report.md",
        },
    }


def _progress(stage: str, message: str) -> dict:
    return {"type": "progress", "stage": stage, "message": message}


def _stage_start(stage_num: int, message: str) -> dict:
    return {
        "type": "stage_start",
        "stage_number": stage_num,
        "total_stages": 8,
        "message": message,
    }


def _stage_done(stage_num: int, message: str, elapsed: float) -> dict:
    return {
        "type": "stage_done",
        "stage_number": stage_num,
        "total_stages": 8,
        "message": message,
        "elapsed_seconds": round(elapsed, 1),
    }
