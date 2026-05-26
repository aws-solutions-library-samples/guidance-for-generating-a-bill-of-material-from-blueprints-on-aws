"""Structured output tools for deterministic blueprint analysis results.

These tools enforce a schema via their parameter signatures. The agent calls
them with structured data, and they persist both JSON (for frontend components)
and a raw markdown representation (for the "View Raw" toggle).
"""

import json
from pathlib import Path

from strands import tool


@tool
def save_page_analysis(
    output_path: str,
    page_identification: dict,
    title_block: dict,
    structural_elements: list,
    doors: list,
    windows: list,
    walls: list,
    materials: list,
    construction_details: list,
    dimensions: list,
    reference_standards: list,
    notes: list,
    additional_properties: dict = None,
) -> str:
    """Save a structured page analysis. Call this once per page with all extracted data.

    Args:
        output_path: File path to save the analysis (without extension - .json and .md will be created).
        page_identification: Dict with keys: sheet_number, title, drawing_type, and optionally revision, scale.
        title_block: Dict with optional keys: project_name, architect, date, drawn_by, checked_by.
        structural_elements: List of dicts with keys: type, description, and optionally location, dimensions, notes.
        doors: List of dicts with keys: mark, width, height, type, qty, and optionally hardware, fire_rating, frame_material, notes.
        windows: List of dicts with keys: mark, width, height, type, qty, and optionally glazing, notes.
        walls: List of dicts with keys: type_id, assembly, thickness, and optionally linear_ft, height, area_sf, fire_rating, acoustic_rating, notes.
        materials: List of dicts with keys: material, and optionally specification, quantity, unit, location, notes.
        construction_details: List of dicts with keys: description, components (list of strings), and optionally detail_id, notes.
        dimensions: List of dimension strings extracted from the page.
        reference_standards: List of reference standard codes (e.g., ASTM C840, ACI 318).
        notes: List of general notes, callouts, or specifications extracted from the page.
        additional_properties: Optional dict for uncommon attributes not covered by the schema.

    Returns:
        Confirmation message with paths to saved files.
    """
    base_path = Path(output_path).with_suffix("")
    base_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "page_identification": page_identification,
        "title_block": title_block,
        "structural_elements": structural_elements,
        "doors": doors,
        "windows": windows,
        "walls": walls,
        "materials": materials,
        "construction_details": construction_details,
        "dimensions": dimensions,
        "reference_standards": reference_standards,
        "notes": notes,
    }
    if additional_properties:
        data["additional_properties"] = additional_properties

    json_path = base_path.with_suffix(".json")
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    md_path = base_path.with_suffix(".md")
    md_path.write_text(_analysis_to_markdown(data), encoding="utf-8")

    return f"Structured analysis saved to: {json_path} and {md_path}"


@tool
def save_page_materials(
    output_path: str,
    sheet_number: str,
    sheet_title: str,
    doors: list,
    windows: list,
    walls: list,
    materials: list,
    assumptions: list,
) -> str:
    """Save a structured per-page material takeoff.

    Args:
        output_path: File path to save the materials (without extension).
        sheet_number: The sheet number/ID this material list is for.
        sheet_title: The sheet title.
        doors: List of dicts with keys: mark, width, height, type, qty, and optionally hardware, fire_rating, frame_material, notes.
        windows: List of dicts with keys: mark, width, height, type, qty, and optionally glazing, notes.
        walls: List of dicts with keys: type_id, assembly, thickness, and optionally linear_ft, height, area_sf, fire_rating, acoustic_rating, notes.
        materials: List of dicts with keys: material, and optionally specification, quantity, unit, location, notes.
        assumptions: List of assumptions made or items that were unclear.

    Returns:
        Confirmation message.
    """
    base_path = Path(output_path).with_suffix("")
    base_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "sheet_number": sheet_number,
        "sheet_title": sheet_title,
        "doors": doors,
        "windows": windows,
        "walls": walls,
        "materials": materials,
        "assumptions": assumptions,
    }

    json_path = base_path.with_suffix(".json")
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    md_path = base_path.with_suffix(".md")
    md_path.write_text(_materials_to_markdown(data), encoding="utf-8")

    return f"Structured materials saved to: {json_path} and {md_path}"


@tool
def save_material_estimate(
    output_path: str,
    door_schedule: list,
    window_schedule: list,
    wall_summary: list,
    material_totals: list,
    summary_stats: dict,
    assumptions: list,
    conflicts: list,
) -> str:
    """Save the consolidated project material estimate.

    Args:
        output_path: File path to save the estimate (without extension).
        door_schedule: List of dicts with keys: mark, width, height, type, qty, found_on (list of sheet refs), and optionally hardware, fire_rating, frame_material, notes.
        window_schedule: List of dicts with keys: mark, width, height, type, qty, found_on (list of sheet refs), and optionally glazing, notes.
        wall_summary: List of dicts with keys: type_id, assembly, locations (list of strings), and optionally total_linear_ft, total_area_sf, notes.
        material_totals: List of dicts with keys: material, pages_referenced (list of strings), and optionally specification, total_qty, unit, notes.
        summary_stats: Dict with keys: total_doors, total_windows, total_wall_types, and optionally total_partition_linear_ft.
        assumptions: List of assumptions and data gap notes.
        conflicts: List of conflicts found (same mark with different specs, etc.).

    Returns:
        Confirmation message.
    """
    base_path = Path(output_path).with_suffix("")
    base_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "door_schedule": door_schedule,
        "window_schedule": window_schedule,
        "wall_summary": wall_summary,
        "material_totals": material_totals,
        "summary_stats": summary_stats,
        "assumptions": assumptions,
        "conflicts": conflicts,
    }

    json_path = base_path.with_suffix(".json")
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    md_path = base_path.with_suffix(".md")
    md_path.write_text(_estimate_to_markdown(data), encoding="utf-8")

    return f"Structured material estimate saved to: {json_path} and {md_path}"


@tool
def save_project_summary(
    output_path: str,
    project_overview: dict,
    drawing_index: list,
    material_summary_by_division: list,
    door_window_schedule_summary: str,
    wall_partition_types: list,
    key_specifications: list,
    quantities_and_estimates: list,
    notes_and_observations: list,
) -> str:
    """Save a structured project summary.

    Args:
        output_path: File path to save the summary (without extension - .json and .md will be created).
        project_overview: Dict with keys like project_name, location, architect, scope, building_type, and any other overview fields.
        drawing_index: List of dicts with keys: sheet_number, title, drawing_type, and optionally description.
        material_summary_by_division: List of dicts with keys: division (e.g. "06"), division_name (e.g. "Wood/Plastics/Composites"), materials (list of material description strings).
        door_window_schedule_summary: A brief text summary of the consolidated door/window schedule.
        wall_partition_types: List of dicts with keys: type_id, assembly, components (list of strings), locations (list of strings), and any other relevant fields.
        key_specifications: List of notable specification strings (standards, codes, requirements).
        quantities_and_estimates: List of dicts with keys: item, quantity, unit, and optionally notes.
        notes_and_observations: List of observation strings about anything unusual or requiring clarification.

    Returns:
        Confirmation message.
    """
    base_path = Path(output_path).with_suffix("")
    base_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "project_overview": project_overview,
        "drawing_index": drawing_index,
        "material_summary_by_division": material_summary_by_division,
        "door_window_schedule_summary": door_window_schedule_summary,
        "wall_partition_types": wall_partition_types,
        "key_specifications": key_specifications,
        "quantities_and_estimates": quantities_and_estimates,
        "notes_and_observations": notes_and_observations,
    }

    json_path = base_path.with_suffix(".json")
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    md_path = base_path.with_suffix(".md")
    md_path.write_text(_project_summary_to_markdown(data), encoding="utf-8")

    return f"Structured project summary saved to: {json_path} and {md_path}"


@tool
def save_audit_report(
    output_path: str,
    methodology: str,
    findings: list,
    summary: dict,
    recommended_corrections: list,
) -> str:
    """Save a structured audit report.

    Args:
        output_path: File path to save the report (without extension - .json and .md will be created).
        methodology: Brief description of the cross-referencing approach used.
        findings: List of dicts with keys: severity ("critical", "major", or "minor"), category (e.g. "material_discrepancy", "door_schedule_gap", "specification_omission", "structural_inconsistency", "quantity_error", "missing_information"), description, and optionally page_reference, details.
        summary: Dict with keys: critical_count, major_count, minor_count, and optionally completeness_pct (integer 0-100).
        recommended_corrections: List of specific correction recommendation strings.

    Returns:
        Confirmation message.
    """
    base_path = Path(output_path).with_suffix("")
    base_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "methodology": methodology,
        "findings": findings,
        "summary": summary,
        "recommended_corrections": recommended_corrections,
    }

    json_path = base_path.with_suffix(".json")
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    md_path = base_path.with_suffix(".md")
    md_path.write_text(_audit_report_to_markdown(data), encoding="utf-8")

    return f"Structured audit report saved to: {json_path} and {md_path}"


def _project_summary_to_markdown(data: dict) -> str:
    lines = []
    lines.append("# Project Summary")
    lines.append("")

    overview = data.get("project_overview", {})
    if overview:
        lines.append("## Project Overview")
        for k, v in overview.items():
            if v:
                lines.append(f"- **{k.replace('_', ' ').title()}:** {v}")
        lines.append("")

    if data["drawing_index"]:
        lines.append("## Drawing Index")
        lines.append("| Sheet | Title | Type | Description |")
        lines.append("|-------|-------|------|-------------|")
        for entry in data["drawing_index"]:
            lines.append(f"| {entry.get('sheet_number', '')} | {entry.get('title', '')} | {entry.get('drawing_type', '')} | {entry.get('description', '-')} |")
        lines.append("")

    if data["material_summary_by_division"]:
        lines.append("## Material Summary by CSI Division")
        for div in data["material_summary_by_division"]:
            lines.append(f"\n### Division {div.get('division', '')} — {div.get('division_name', '')}")
            for mat in div.get("materials", []):
                lines.append(f"- {mat}")
        lines.append("")

    if data["door_window_schedule_summary"]:
        lines.append("## Door & Window Schedule")
        lines.append(data["door_window_schedule_summary"])
        lines.append("")

    if data["wall_partition_types"]:
        lines.append("## Wall/Partition Types")
        for wall in data["wall_partition_types"]:
            lines.append(f"\n**{wall.get('type_id', 'Unknown')}** — {wall.get('assembly', '')}")
            for comp in wall.get("components", []):
                lines.append(f"  - {comp}")
            if wall.get("locations"):
                lines.append(f"  - *Locations:* {', '.join(wall['locations'])}")
        lines.append("")

    if data["key_specifications"]:
        lines.append("## Key Specifications")
        for spec in data["key_specifications"]:
            lines.append(f"- {spec}")
        lines.append("")

    if data["quantities_and_estimates"]:
        lines.append("## Quantities & Estimates")
        lines.append("| Item | Quantity | Unit | Notes |")
        lines.append("|------|----------|------|-------|")
        for q in data["quantities_and_estimates"]:
            lines.append(f"| {q.get('item', '')} | {q.get('quantity', '-')} | {q.get('unit', '-')} | {q.get('notes', '-')} |")
        lines.append("")

    if data["notes_and_observations"]:
        lines.append("## Notes & Observations")
        for note in data["notes_and_observations"]:
            lines.append(f"- {note}")
        lines.append("")

    return "\n".join(lines)


def _audit_report_to_markdown(data: dict) -> str:
    lines = []
    lines.append("# Audit Report")
    lines.append("")

    lines.append("## Methodology")
    lines.append(data.get("methodology", ""))
    lines.append("")

    findings = data.get("findings", [])
    if findings:
        critical = [f for f in findings if f.get("severity") == "critical"]
        major = [f for f in findings if f.get("severity") == "major"]
        minor = [f for f in findings if f.get("severity") == "minor"]

        for severity, items in [("Critical", critical), ("Major", major), ("Minor", minor)]:
            if items:
                lines.append(f"## {severity} Findings")
                for f in items:
                    ref = f" (Page: {f['page_reference']})" if f.get("page_reference") else ""
                    lines.append(f"- **[{f.get('category', 'general')}]** {f['description']}{ref}")
                    if f.get("details"):
                        lines.append(f"  - {f['details']}")
                lines.append("")

    summary = data.get("summary", {})
    lines.append("## Audit Summary")
    lines.append(f"- Critical: {summary.get('critical_count', 0)}")
    lines.append(f"- Major: {summary.get('major_count', 0)}")
    lines.append(f"- Minor: {summary.get('minor_count', 0)}")
    if summary.get("completeness_pct") is not None:
        lines.append(f"- Completeness: {summary['completeness_pct']}%")
    lines.append("")

    if data["recommended_corrections"]:
        lines.append("## Recommended Corrections")
        for corr in data["recommended_corrections"]:
            lines.append(f"- {corr}")
        lines.append("")

    return "\n".join(lines)


def _analysis_to_markdown(data: dict) -> str:
    lines = []
    pi = data["page_identification"]
    lines.append(f"# {pi.get('sheet_number', 'Unknown')} — {pi.get('title', 'Untitled')}")
    lines.append(f"**Type:** {pi.get('drawing_type', 'Unknown')}")
    if pi.get("revision"):
        lines.append(f"**Revision:** {pi['revision']}")
    if pi.get("scale"):
        lines.append(f"**Scale:** {pi['scale']}")
    lines.append("")

    tb = data["title_block"]
    if any(tb.values()):
        lines.append("## Title Block")
        for k, v in tb.items():
            if v:
                lines.append(f"- **{k.replace('_', ' ').title()}:** {v}")
        lines.append("")

    if data["structural_elements"]:
        lines.append("## Structural Elements")
        for el in data["structural_elements"]:
            desc = f"- **{el['type']}**: {el['description']}"
            if el.get("dimensions"):
                desc += f" ({el['dimensions']})"
            if el.get("location"):
                desc += f" — {el['location']}"
            lines.append(desc)
        lines.append("")

    if data["doors"]:
        lines.append("## Doors")
        lines.append("| Mark | Size | Type | Hardware | Fire Rating | Qty |")
        lines.append("|------|------|------|----------|-------------|-----|")
        for d in data["doors"]:
            size = f"{d.get('width', '')}x{d.get('height', '')}"
            lines.append(f"| {d.get('mark', '')} | {size} | {d.get('type', '')} | {d.get('hardware', '-')} | {d.get('fire_rating', '-')} | {d.get('qty', '')} |")
        lines.append("")

    if data["windows"]:
        lines.append("## Windows")
        lines.append("| Mark | Size | Type | Glazing | Qty |")
        lines.append("|------|------|------|---------|-----|")
        for w in data["windows"]:
            size = f"{w.get('width', '')}x{w.get('height', '')}"
            lines.append(f"| {w.get('mark', '')} | {size} | {w.get('type', '')} | {w.get('glazing', '-')} | {w.get('qty', '')} |")
        lines.append("")

    if data["walls"]:
        lines.append("## Walls/Partitions")
        lines.append("| Type | Assembly | Thickness | Linear Ft | Area (SF) | Fire Rating |")
        lines.append("|------|----------|-----------|-----------|-----------|-------------|")
        for w in data["walls"]:
            lines.append(f"| {w.get('type_id', '')} | {w.get('assembly', '')} | {w.get('thickness', '')} | {w.get('linear_ft', '-')} | {w.get('area_sf', '-')} | {w.get('fire_rating', '-')} |")
        lines.append("")

    if data["materials"]:
        lines.append("## Materials")
        lines.append("| Material | Specification | Quantity | Unit |")
        lines.append("|----------|--------------|----------|------|")
        for m in data["materials"]:
            lines.append(f"| {m.get('material', '')} | {m.get('specification', '-')} | {m.get('quantity', '-')} | {m.get('unit', '-')} |")
        lines.append("")

    if data["construction_details"]:
        lines.append("## Construction Details")
        for cd in data["construction_details"]:
            header = cd.get("detail_id", "")
            if header:
                header = f"**{header}** — "
            lines.append(f"- {header}{cd['description']}")
            for comp in cd.get("components", []):
                lines.append(f"  - {comp}")
        lines.append("")

    if data["dimensions"]:
        lines.append("## Dimensions")
        for dim in data["dimensions"]:
            lines.append(f"- {dim}")
        lines.append("")

    if data["reference_standards"]:
        lines.append("## Reference Standards")
        for std in data["reference_standards"]:
            lines.append(f"- {std}")
        lines.append("")

    if data["notes"]:
        lines.append("## Notes")
        for note in data["notes"]:
            lines.append(f"- {note}")
        lines.append("")

    return "\n".join(lines)


def _materials_to_markdown(data: dict) -> str:
    lines = []
    lines.append(f"## Page: {data['sheet_number']} — {data['sheet_title']}")
    lines.append("")

    if data["doors"]:
        lines.append("### Doors")
        lines.append("| Mark | Size | Type | Hardware | Qty |")
        lines.append("|------|------|------|----------|-----|")
        for d in data["doors"]:
            size = f"{d.get('width', '')}x{d.get('height', '')}"
            lines.append(f"| {d.get('mark', '')} | {size} | {d.get('type', '')} | {d.get('hardware', '-')} | {d.get('qty', '')} |")
        lines.append("")

    if data["windows"]:
        lines.append("### Windows")
        lines.append("| Mark | Size | Type | Glazing | Qty |")
        lines.append("|------|------|------|---------|-----|")
        for w in data["windows"]:
            size = f"{w.get('width', '')}x{w.get('height', '')}"
            lines.append(f"| {w.get('mark', '')} | {size} | {w.get('type', '')} | {w.get('glazing', '-')} | {w.get('qty', '')} |")
        lines.append("")

    if data["walls"]:
        lines.append("### Walls/Partitions")
        lines.append("| Type | Assembly | Thickness | Linear Ft | Height | Area (SF) |")
        lines.append("|------|----------|-----------|-----------|--------|-----------|")
        for w in data["walls"]:
            lines.append(f"| {w.get('type_id', '')} | {w.get('assembly', '')} | {w.get('thickness', '')} | {w.get('linear_ft', '-')} | {w.get('height', '-')} | {w.get('area_sf', '-')} |")
        lines.append("")

    if data["materials"]:
        lines.append("### Materials")
        lines.append("| Material | Specification | Quantity | Unit |")
        lines.append("|----------|--------------|----------|------|")
        for m in data["materials"]:
            lines.append(f"| {m.get('material', '')} | {m.get('specification', '-')} | {m.get('quantity', '-')} | {m.get('unit', '-')} |")
        lines.append("")

    if data["assumptions"]:
        lines.append("### Notes")
        for note in data["assumptions"]:
            lines.append(f"- {note}")
        lines.append("")

    return "\n".join(lines)


def _estimate_to_markdown(data: dict) -> str:
    lines = []
    lines.append("# Project Material Estimate")
    lines.append("")

    if data["door_schedule"]:
        lines.append("## Door Schedule")
        lines.append("| Mark | Size | Type | Hardware | Qty | Found On |")
        lines.append("|------|------|------|----------|-----|----------|")
        for d in data["door_schedule"]:
            size = f"{d.get('width', '')}x{d.get('height', '')}"
            found = ", ".join(d.get("found_on", []))
            lines.append(f"| {d.get('mark', '')} | {size} | {d.get('type', '')} | {d.get('hardware', '-')} | {d.get('qty', '')} | {found} |")
        lines.append("")

    if data["window_schedule"]:
        lines.append("## Window Schedule")
        lines.append("| Mark | Size | Type | Glazing | Qty | Found On |")
        lines.append("|------|------|------|---------|-----|----------|")
        for w in data["window_schedule"]:
            size = f"{w.get('width', '')}x{w.get('height', '')}"
            found = ", ".join(w.get("found_on", []))
            lines.append(f"| {w.get('mark', '')} | {size} | {w.get('type', '')} | {w.get('glazing', '-')} | {w.get('qty', '')} | {found} |")
        lines.append("")

    if data["wall_summary"]:
        lines.append("## Wall/Partition Summary")
        lines.append("| Type | Assembly | Total Linear Ft | Total Area (SF) | Locations |")
        lines.append("|------|----------|----------------|-----------------|-----------|")
        for w in data["wall_summary"]:
            locs = ", ".join(w.get("locations", []))
            lines.append(f"| {w.get('type_id', '')} | {w.get('assembly', '')} | {w.get('total_linear_ft', '-')} | {w.get('total_area_sf', '-')} | {locs} |")
        lines.append("")

    if data["material_totals"]:
        lines.append("## Material Totals")
        lines.append("| Material | Specification | Total Qty | Unit | Pages |")
        lines.append("|----------|--------------|-----------|------|-------|")
        for m in data["material_totals"]:
            pages = ", ".join(m.get("pages_referenced", []))
            lines.append(f"| {m.get('material', '')} | {m.get('specification', '-')} | {m.get('total_qty', '-')} | {m.get('unit', '-')} | {pages} |")
        lines.append("")

    stats = data.get("summary_stats", {})
    lines.append("## Summary Statistics")
    lines.append(f"- Total doors: {stats.get('total_doors', 0)}")
    lines.append(f"- Total windows: {stats.get('total_windows', 0)}")
    lines.append(f"- Total wall types: {stats.get('total_wall_types', 0)}")
    if stats.get("total_partition_linear_ft"):
        lines.append(f"- Total partition linear ft: {stats['total_partition_linear_ft']}")
    lines.append("")

    if data["assumptions"]:
        lines.append("## Assumptions & Caveats")
        for a in data["assumptions"]:
            lines.append(f"- {a}")
        lines.append("")

    if data["conflicts"]:
        lines.append("## Conflicts")
        for c in data["conflicts"]:
            lines.append(f"- {c}")
        lines.append("")

    return "\n".join(lines)
