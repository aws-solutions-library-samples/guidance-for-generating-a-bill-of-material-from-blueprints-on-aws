"""Chat agent for interactive Q&A about analyzed blueprints.

Fetches all analysis data from S3 for a given job and creates a Strands agent
with that context as the system prompt. Supports vision via read_page_image tool.
"""

import json
import logging
import os

import boto3
from strands import Agent
from strands.models import BedrockModel

from blueprint_analyzer.tools.read_page_image_s3 import create_read_page_image_s3

logger = logging.getLogger(__name__)

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

SONNET_MODEL = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
    region_name=REGION,
    max_tokens=8192,
)

CHAT_SYSTEM_PROMPT_TEMPLATE = """You are an expert construction blueprint analysis assistant. You have access to the complete analysis of a blueprint project. Use the data below to answer the user's questions accurately and thoroughly.

When the user asks about specific visual details, dimensions, or anything you need to verify by looking at the original drawing, use the read_page_image tool to view the blueprint page.

When referencing information, cite the source page/sheet number so the user can cross-reference.

## Project Summary
{project_summary}

## Material Estimate
{material_estimate}

## Audit Report
{audit_report}

## Per-Page Analyses
{page_analyses}
"""

_context_cache: dict[str, dict] = {}


def _fetch_job_context(job_id: str, bucket_name: str, region: str) -> dict:
    """Fetch all analysis data from S3 for a job. Results are cached."""
    if job_id in _context_cache:
        return _context_cache[job_id]

    s3 = boto3.client("s3", region_name=region)
    output_prefix = f"outputs/{job_id}"

    def _read_json(key: str) -> dict | list | None:
        try:
            resp = s3.get_object(Bucket=bucket_name, Key=key)
            return json.loads(resp["Body"].read().decode("utf-8"))
        except Exception:
            return None

    def _list_keys(prefix: str, suffix: str) -> list[str]:
        resp = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
        return sorted(
            obj["Key"]
            for obj in resp.get("Contents", [])
            if obj["Key"].endswith(suffix)
        )

    project_summary = _read_json(f"{output_prefix}/project_summary.json")
    material_estimate = _read_json(f"{output_prefix}/material_estimate.json")
    audit_report = _read_json(f"{output_prefix}/audit_report.json")

    analysis_keys = _list_keys(f"{output_prefix}/analysis/", "_analysis.json")
    page_analyses = []
    for key in analysis_keys:
        data = _read_json(key)
        if data:
            page_analyses.append(data)

    context = {
        "output_prefix": output_prefix,
        "project_summary": project_summary,
        "material_estimate": material_estimate,
        "audit_report": audit_report,
        "page_analyses": page_analyses,
    }

    _context_cache[job_id] = context
    return context


def _build_system_prompt(context: dict) -> str:
    """Assemble the system prompt from fetched context data."""

    def _format_json(data) -> str:
        if data is None:
            return "(Not available)"
        return json.dumps(data, indent=2, default=str)

    page_analyses_text = ""
    for i, page in enumerate(context.get("page_analyses", []), 1):
        sheet = page.get("page_identification", {}).get("sheet_number", f"Page {i}")
        title = page.get("page_identification", {}).get("title", "")
        page_analyses_text += f"\n### {sheet} - {title}\n"
        page_analyses_text += _format_json(page) + "\n"

    prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
        project_summary=_format_json(context.get("project_summary")),
        material_estimate=_format_json(context.get("material_estimate")),
        audit_report=_format_json(context.get("audit_report")),
        page_analyses=page_analyses_text or "(No page analyses available)",
    )

    # Truncate if too large (keep under ~150K chars to leave room for conversation)
    if len(prompt) > 150_000:
        logger.warning("Context too large (%d chars), truncating page analyses", len(prompt))
        page_analyses_text = ""
        for page in context.get("page_analyses", []):
            sheet = page.get("page_identification", {}).get("sheet_number", "?")
            title = page.get("page_identification", {}).get("title", "")
            page_analyses_text += f"- {sheet}: {title}\n"
        page_analyses_text += "\n(Full page analyses truncated due to size. Use read_page_image tool to view specific pages.)"

        prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
            project_summary=_format_json(context.get("project_summary")),
            material_estimate=_format_json(context.get("material_estimate")),
            audit_report=_format_json(context.get("audit_report")),
            page_analyses=page_analyses_text,
        )

    return prompt


def create_chat_agent(job_id: str, bucket_name: str, region: str) -> Agent:
    """Create a chat agent pre-loaded with blueprint analysis context."""
    context = _fetch_job_context(job_id, bucket_name, region)
    system_prompt = _build_system_prompt(context)

    output_prefix = context["output_prefix"]
    read_page_image = create_read_page_image_s3(bucket_name, output_prefix, region)

    return Agent(
        model=SONNET_MODEL,
        name="blueprint_chat",
        system_prompt=system_prompt,
        tools=[read_page_image],
    )
