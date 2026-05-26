"""Structured output schemas for deterministic blueprint analysis results."""

from typing import TypedDict, NotRequired


class PageIdentification(TypedDict):
    sheet_number: str
    title: str
    revision: NotRequired[str]
    drawing_type: str
    scale: NotRequired[str]


class TitleBlock(TypedDict):
    project_name: NotRequired[str]
    architect: NotRequired[str]
    date: NotRequired[str]
    drawn_by: NotRequired[str]
    checked_by: NotRequired[str]


class StructuralElement(TypedDict):
    type: str
    description: str
    location: NotRequired[str]
    dimensions: NotRequired[str]
    notes: NotRequired[str]


class DoorEntry(TypedDict):
    mark: str
    width: str
    height: str
    type: str
    hardware: NotRequired[str]
    fire_rating: NotRequired[str]
    frame_material: NotRequired[str]
    qty: int
    notes: NotRequired[str]


class WindowEntry(TypedDict):
    mark: str
    width: str
    height: str
    type: str
    glazing: NotRequired[str]
    qty: int
    notes: NotRequired[str]


class WallPartition(TypedDict):
    type_id: str
    assembly: str
    thickness: str
    linear_ft: NotRequired[float]
    height: NotRequired[str]
    area_sf: NotRequired[float]
    fire_rating: NotRequired[str]
    acoustic_rating: NotRequired[str]
    notes: NotRequired[str]


class MaterialItem(TypedDict):
    material: str
    specification: NotRequired[str]
    quantity: NotRequired[float]
    unit: NotRequired[str]
    location: NotRequired[str]
    notes: NotRequired[str]


class ConstructionDetail(TypedDict):
    detail_id: NotRequired[str]
    description: str
    components: list[str]
    notes: NotRequired[str]


class PageAnalysisSchema(TypedDict):
    page_identification: PageIdentification
    title_block: TitleBlock
    structural_elements: list[StructuralElement]
    doors: list[DoorEntry]
    windows: list[WindowEntry]
    walls: list[WallPartition]
    materials: list[MaterialItem]
    construction_details: list[ConstructionDetail]
    dimensions: list[str]
    reference_standards: list[str]
    notes: list[str]
    additional_properties: NotRequired[dict]


class PageMaterialsSchema(TypedDict):
    sheet_number: str
    sheet_title: str
    doors: list[DoorEntry]
    windows: list[WindowEntry]
    walls: list[WallPartition]
    materials: list[MaterialItem]
    assumptions: list[str]


class ConsolidatedDoor(TypedDict):
    mark: str
    width: str
    height: str
    type: str
    hardware: NotRequired[str]
    fire_rating: NotRequired[str]
    frame_material: NotRequired[str]
    qty: int
    found_on: list[str]
    notes: NotRequired[str]


class ConsolidatedWindow(TypedDict):
    mark: str
    width: str
    height: str
    type: str
    glazing: NotRequired[str]
    qty: int
    found_on: list[str]
    notes: NotRequired[str]


class ConsolidatedWall(TypedDict):
    type_id: str
    assembly: str
    total_linear_ft: NotRequired[float]
    total_area_sf: NotRequired[float]
    locations: list[str]
    notes: NotRequired[str]


class ConsolidatedMaterial(TypedDict):
    material: str
    specification: NotRequired[str]
    total_qty: NotRequired[float]
    unit: NotRequired[str]
    pages_referenced: list[str]
    notes: NotRequired[str]


class SummaryStats(TypedDict):
    total_doors: int
    total_windows: int
    total_wall_types: int
    total_partition_linear_ft: NotRequired[float]


class MaterialEstimateSchema(TypedDict):
    door_schedule: list[ConsolidatedDoor]
    window_schedule: list[ConsolidatedWindow]
    wall_summary: list[ConsolidatedWall]
    material_totals: list[ConsolidatedMaterial]
    summary_stats: SummaryStats
    assumptions: list[str]
    conflicts: list[str]


class DrawingIndexEntry(TypedDict):
    sheet_number: str
    title: str
    drawing_type: str
    description: NotRequired[str]


class CSIDivisionEntry(TypedDict):
    division: str
    division_name: str
    materials: list[str]


class ProjectSummarySchema(TypedDict):
    project_overview: dict
    drawing_index: list[DrawingIndexEntry]
    material_summary_by_division: list[CSIDivisionEntry]
    door_window_schedule_summary: str
    wall_partition_types: list[dict]
    key_specifications: list[str]
    quantities_and_estimates: list[dict]
    notes_and_observations: list[str]


class AuditFinding(TypedDict):
    severity: str
    category: str
    description: str
    page_reference: NotRequired[str]
    details: NotRequired[str]


class AuditSummaryStats(TypedDict):
    critical_count: int
    major_count: int
    minor_count: int
    completeness_pct: NotRequired[int]


class AuditReportSchema(TypedDict):
    methodology: str
    findings: list[AuditFinding]
    summary: AuditSummaryStats
    recommended_corrections: list[str]
