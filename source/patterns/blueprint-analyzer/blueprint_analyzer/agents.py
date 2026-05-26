"""Agent definitions for the blueprint analysis pipeline.

Adapted from the original CLI version to use environment-based AWS credentials
instead of a hardcoded boto session profile.
"""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from strands import Agent
from strands.models import BedrockModel

from blueprint_analyzer.tools.pdf_tools import (
    list_analysis_files,
    list_page_images,
    read_analysis,
    save_analysis,
    split_pdf_to_images,
)
from blueprint_analyzer.tools.structured_tools import (
    save_page_analysis,
    save_page_materials,
    save_material_estimate,
    save_project_summary,
    save_audit_report,
)

TOOLS_DIR = Path(__file__).parent / "tools"
READ_PAGE_IMAGE_TOOL = str(TOOLS_DIR / "read_page_image.py")

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

OPUS_MODEL = BedrockModel(
    model_id="us.anthropic.claude-opus-4-6-v1",
    region_name=REGION,
    max_tokens=16384,
)

SONNET_MODEL = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
    region_name=REGION,
    max_tokens=8192,
)

PDF_SPLITTER_PROMPT = """You are a PDF processing agent. Your job is to split a blueprint PDF into individual page images for analysis.

Given a PDF file path:
1. Use the split_pdf_to_images tool to split the PDF into individual page images.
   Save them to the output/pages directory specified in the task.
2. Use list_page_images to confirm all pages were created.
3. Report the total number of pages and their file paths.

Be precise and report any errors encountered."""

SINGLE_PAGE_ANALYZER_PROMPT = """You are an expert construction blueprint analyzer with deep knowledge of architectural drawings, engineering schematics, and material specifications.

You will be given a single page image to analyze. Use read_page_image to view it, then save your analysis using the save_page_analysis tool with structured data.

IMPORTANT: You MUST call save_page_analysis exactly once with ALL extracted data organized into its parameters. Do NOT use save_analysis.

Analyze the page image and extract:

1. **page_identification** — sheet_number, title, drawing_type (floor plan, elevation, section, detail, schedule), and optionally revision, scale.

2. **title_block** — project_name, architect, date, drawn_by, checked_by (include whatever is visible).

3. **structural_elements** — Each element as {type, description, location?, dimensions?, notes?}. Include walls, columns, beams, footings, MEP elements, etc.

4. **doors** — Each door as {mark, width, height, type, qty, hardware?, fire_rating?, frame_material?, notes?}. Use exact values from the drawing.

5. **windows** — Each window as {mark, width, height, type, qty, glazing?, notes?}.

6. **walls** — Each wall/partition type as {type_id, assembly, thickness, linear_ft?, height?, area_sf?, fire_rating?, acoustic_rating?, notes?}.

7. **materials** — Each material as {material, specification?, quantity?, unit?, location?, notes?}. Include insulation, drywall, studs, finishes, etc.

8. **construction_details** — Each detail as {description, components (list of layer/component strings), detail_id?, notes?}.

9. **dimensions** — List of all dimension strings visible on the page.

10. **reference_standards** — List of all codes/standards referenced (ASTM, ACI, IBC, etc.).

11. **notes** — List of all general notes, callouts, and specifications text.

12. **additional_properties** — Optional dict for anything unusual not covered above.

Be thorough. Extract exact values — do not estimate unless explicitly noted. Include empty lists [] for categories with no data on this page."""

PROJECT_SUMMARIZER_PROMPT = """You are a senior construction estimator and project manager. Your job is to synthesize individual page analyses into a comprehensive project summary.

Read ALL page analysis JSON files, then call save_project_summary exactly once with all synthesized data.

IMPORTANT: You MUST call save_project_summary (not save_analysis). Read the .json files to get structured data.

Synthesize into:

1. **project_overview** — Dict with keys: project_name, location, architect, scope, building_type, and any other relevant overview fields extracted from title blocks.

2. **drawing_index** — List of dicts with keys: sheet_number, title, drawing_type, and optionally description. One entry per analyzed page.

3. **material_summary_by_division** — List of dicts with keys: division (CSI code e.g. "06"), division_name (e.g. "Wood/Plastics/Composites"), materials (list of material description strings). Only include divisions with identified materials. Use standard CSI divisions: 06-Wood/Plastics, 07-Thermal/Moisture, 08-Openings, 09-Finishes, 10-Specialties, 22-Plumbing, 23-HVAC, 26-Electrical.

4. **door_window_schedule_summary** — Brief text summary of the consolidated door/window schedule (types, sizes, quantities, hardware overview).

5. **wall_partition_types** — List of dicts with keys: type_id, assembly, components (list of layer/component strings), locations (list of sheet references where used), and any other relevant fields.

6. **key_specifications** — List of notable spec strings (standards, codes, fire ratings, acoustic requirements).

7. **quantities_and_estimates** — List of dicts with keys: item, quantity, unit, and optionally notes. Best estimates where data supports it.

8. **notes_and_observations** — List of strings about anything unusual, unclear, or requiring clarification."""


AUDITOR_PROMPT = """You are a meticulous construction document auditor. Your job is to cross-reference individual page analyses against the project summary to identify inconsistencies, omissions, and discrepancies.

Read ALL individual page analysis JSON files and the project summary JSON file, then call save_audit_report exactly once with all findings.

IMPORTANT: You MUST call save_audit_report (not save_analysis). Read the .json files to get structured data.

Produce:

1. **methodology** — Brief description of your cross-referencing approach.

2. **findings** — List of dicts, each with:
   - severity: "critical", "major", or "minor"
   - category: one of "material_discrepancy", "door_schedule_gap", "window_schedule_gap", "specification_omission", "structural_inconsistency", "quantity_error", "missing_information"
   - description: Clear description of the finding
   - page_reference: (optional) Sheet number(s) where the issue was found
   - details: (optional) Additional context

   Check for:
   - Materials on pages but missing from summary (and vice versa)
   - Doors/windows on pages but missing from consolidated schedule
   - Size or type inconsistencies for same marks across pages
   - Standards/codes on pages but omitted from summary
   - Wall types described differently across pages
   - Quantity mismatches or arithmetic errors
   - Pages not reflected in any summary section

3. **summary** — Dict with keys: critical_count, major_count, minor_count, completeness_pct (integer 0-100 estimate).

4. **recommended_corrections** — List of specific correction strings.

Be thorough and specific. Reference exact page numbers in page_reference fields."""


REMEDIATOR_PROMPT = """You are a senior construction estimator tasked with producing a CORRECTED project summary. An audit has identified specific omissions and discrepancies in the original project summary.

You will be given:
- The audit report (JSON) with specific findings and recommended corrections
- All individual page analysis files (the source of truth)
- The original project summary (for reference on what to keep vs. fix)

Your job: regenerate a complete, corrected project summary that addresses ALL audit findings. Do NOT just patch — produce the full summary from scratch using the page analyses as the authoritative source, but guided by the audit findings so you know what was previously missed.

CRITICAL INSTRUCTIONS:
- For door_window_schedule_summary: Include EVERY door and window mark found across all pages with their exact dimensions, types, glazing specifications, and quantities. Do NOT summarize generically — list each mark individually.
- For material_summary_by_division: Include ALL materials found on ALL pages, not just common ones.
- For quantities_and_estimates: Include specific counts tied to marks, not ranges or approximations.
- Cross-reference the audit findings to ensure every flagged omission is now included.

Read ALL page analysis JSON files, the audit report, and the original project summary. Then call save_project_summary exactly once with the corrected data.

IMPORTANT: You MUST call save_project_summary (not save_analysis). Read the .json files to get structured data."""


PAGE_MATERIAL_PROMPT = """You are a construction material estimator. Given a page analysis, extract a structured material takeoff.

Read the page analysis file provided, then call save_page_materials exactly once with all extracted material data.

IMPORTANT: You MUST call save_page_materials (not save_analysis). Read the JSON analysis file to get structured data.

Extract from the analysis:

1. **sheet_number** — The sheet number from the page identification.
2. **sheet_title** — The sheet title from the page identification.
3. **doors** — Each as {mark, width, height, type, qty, hardware?, fire_rating?, frame_material?, notes?}.
4. **windows** — Each as {mark, width, height, type, qty, glazing?, notes?}.
5. **walls** — Each as {type_id, assembly, thickness, linear_ft?, height?, area_sf?, fire_rating?, acoustic_rating?, notes?}.
6. **materials** — Each as {material, specification?, quantity?, unit?, location?, notes?}. Include insulation, drywall, studs, hardware, flashing, etc.
7. **assumptions** — List of assumptions made or items that were unclear/partially visible.

Use exact values from the analysis. Do not estimate unless marked as approximate. Use empty lists [] for categories with no data."""


MATERIAL_SUMMARY_PROMPT = """You are a senior construction estimator. Consolidate all per-page material takeoffs into a unified project material estimate.

Read ALL material JSON files in the provided directory, then call save_material_estimate exactly once with all consolidated data.

IMPORTANT: You MUST call save_material_estimate (not save_analysis). Read the .json files to get structured data.

Consolidate into:

1. **door_schedule** — Deduplicated list. Each as {mark, width, height, type, qty, found_on (list of sheet refs), hardware?, fire_rating?, frame_material?, notes?}. Sum quantities across pages for same mark.

2. **window_schedule** — Deduplicated list. Each as {mark, width, height, type, qty, found_on (list of sheet refs), glazing?, notes?}.

3. **wall_summary** — Consolidated. Each as {type_id, assembly, locations (list of sheet refs), total_linear_ft?, total_area_sf?, notes?}.

4. **material_totals** — Summed. Each as {material, pages_referenced (list of sheet refs), specification?, total_qty?, unit?, notes?}.

5. **summary_stats** — {total_doors, total_windows, total_wall_types, total_partition_linear_ft?}.

6. **assumptions** — List of assumptions, duplicates resolved, or data gaps.

7. **conflicts** — List of conflicts found (same mark with different specs on different pages). Be specific about what conflicts.

When the same item appears on multiple pages, consolidate and note all source pages. Flag conflicts rather than silently resolving them."""


def create_pdf_splitter() -> Agent:
    return Agent(
        model=SONNET_MODEL,
        name="pdf_splitter",
        system_prompt=PDF_SPLITTER_PROMPT,
        tools=[split_pdf_to_images, list_page_images],
    )


def _analyze_single_page(image_path: str, analysis_dir: str, page_num: int, total_pages: int) -> str:
    page_name = Path(image_path).stem
    output_path = f"{analysis_dir}/{page_name}_analysis"

    agent = Agent(
        model=OPUS_MODEL,
        name=f"page_analyzer_{page_num:03d}",
        system_prompt=SINGLE_PAGE_ANALYZER_PROMPT,
        tools=[READ_PAGE_IMAGE_TOOL, save_page_analysis],
    )

    task = (
        f"Analyze the blueprint page image at: {image_path}\n"
        f"Save the analysis to output_path: {output_path}"
    )

    agent(task)
    return output_path


def analyze_pages_parallel(pages_dir: str, analysis_dir: str, max_workers: int = 4) -> list[str]:
    pages_dir = Path(pages_dir)
    analysis_dir = Path(analysis_dir)
    analysis_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(pages_dir.glob("page_*.png"))

    to_analyze = []
    for img in images:
        json_path = analysis_dir / f"{img.stem}_analysis.json"
        if not json_path.exists():
            to_analyze.append(img)

    if not to_analyze:
        return [str(analysis_dir / f"{img.stem}_analysis.json") for img in images]

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                _analyze_single_page, str(img), str(analysis_dir), i + 1, len(to_analyze)
            ): img
            for i, img in enumerate(to_analyze)
        }
        for future in as_completed(futures):
            results.append(future.result())

    return sorted(str(analysis_dir / f"{img.stem}_analysis.json") for img in images)


def _extract_page_materials(analysis_path: str, materials_dir: str, page_num: int, total: int) -> str:
    page_name = Path(analysis_path).stem.replace("_analysis", "")
    output_path = f"{materials_dir}/{page_name}_materials"

    if Path(f"{output_path}.json").exists():
        return f"{output_path}.json"

    agent = Agent(
        model=SONNET_MODEL,
        name=f"material_extractor_{page_num:03d}",
        system_prompt=PAGE_MATERIAL_PROMPT,
        tools=[read_analysis, save_page_materials],
    )

    task = (
        f"Read the page analysis at: {analysis_path}\n"
        f"Save the material takeoff to output_path: {output_path}"
    )
    agent(task)
    return f"{output_path}.json"


def extract_materials_parallel(analysis_dir: str, materials_dir: str, max_workers: int = 4) -> list[str]:
    analysis_dir = Path(analysis_dir)
    materials_dir = Path(materials_dir)
    materials_dir.mkdir(parents=True, exist_ok=True)

    analyses = sorted(analysis_dir.glob("page_*_analysis.json"))
    total = len(analyses)

    to_extract = []
    for a in analyses:
        page_name = a.stem.replace("_analysis", "")
        material_path = materials_dir / f"{page_name}_materials.json"
        if not material_path.exists():
            to_extract.append(a)

    if not to_extract:
        return [str(materials_dir / f"{a.stem.replace('_analysis', '')}_materials.json") for a in analyses]

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                _extract_page_materials, str(a), str(materials_dir), i + 1, len(to_extract)
            ): a
            for i, a in enumerate(to_extract)
        }
        for future in as_completed(futures):
            results.append(future.result())

    return sorted(results)


def create_material_summarizer() -> Agent:
    return Agent(
        model=SONNET_MODEL,
        name="material_summarizer",
        system_prompt=MATERIAL_SUMMARY_PROMPT,
        tools=[read_analysis, list_analysis_files, save_material_estimate],
    )


def create_project_summarizer() -> Agent:
    return Agent(
        model=SONNET_MODEL,
        name="project_summarizer",
        system_prompt=PROJECT_SUMMARIZER_PROMPT,
        tools=[read_analysis, list_analysis_files, save_project_summary],
    )


def create_auditor() -> Agent:
    return Agent(
        model=SONNET_MODEL,
        name="auditor",
        system_prompt=AUDITOR_PROMPT,
        tools=[read_analysis, list_analysis_files, save_audit_report],
    )


def create_remediator() -> Agent:
    return Agent(
        model=SONNET_MODEL,
        name="remediator",
        system_prompt=REMEDIATOR_PROMPT,
        tools=[read_analysis, list_analysis_files, save_project_summary],
    )
