export interface DoorEntry {
  mark: string
  width: string
  height: string
  type: string
  hardware?: string
  fire_rating?: string
  frame_material?: string
  qty: number
  notes?: string
}

export interface WindowEntry {
  mark: string
  width: string
  height: string
  type: string
  glazing?: string
  qty: number
  notes?: string
}

export interface WallPartition {
  type_id: string
  assembly: string
  thickness: string
  linear_ft?: number
  height?: string
  area_sf?: number
  fire_rating?: string
  acoustic_rating?: string
  notes?: string
}

export interface MaterialItem {
  material: string
  specification?: string
  quantity?: number
  unit?: string
  location?: string
  notes?: string
}

export interface StructuralElement {
  type: string
  description: string
  location?: string
  dimensions?: string
  notes?: string
}

export interface ConstructionDetail {
  detail_id?: string
  description: string
  components: string[]
  notes?: string
}

export interface PageAnalysis {
  page_identification: {
    sheet_number: string
    title: string
    revision?: string
    drawing_type: string
    scale?: string
  }
  title_block: {
    project_name?: string
    architect?: string
    date?: string
    drawn_by?: string
    checked_by?: string
  }
  structural_elements: StructuralElement[]
  doors: DoorEntry[]
  windows: WindowEntry[]
  walls: WallPartition[]
  materials: MaterialItem[]
  construction_details: ConstructionDetail[]
  dimensions: string[]
  reference_standards: string[]
  notes: string[]
  additional_properties?: Record<string, unknown>
}

export interface PageMaterials {
  sheet_number: string
  sheet_title: string
  doors: DoorEntry[]
  windows: WindowEntry[]
  walls: WallPartition[]
  materials: MaterialItem[]
  assumptions: string[]
}

export interface ConsolidatedDoor extends DoorEntry {
  found_on: string[]
}

export interface ConsolidatedWindow extends WindowEntry {
  found_on: string[]
}

export interface ConsolidatedWall {
  type_id: string
  assembly: string
  total_linear_ft?: number
  total_area_sf?: number
  locations: string[]
  notes?: string
}

export interface ConsolidatedMaterial {
  material: string
  specification?: string
  total_qty?: number
  unit?: string
  pages_referenced: string[]
  notes?: string
}

export interface MaterialEstimate {
  door_schedule: ConsolidatedDoor[]
  window_schedule: ConsolidatedWindow[]
  wall_summary: ConsolidatedWall[]
  material_totals: ConsolidatedMaterial[]
  summary_stats: {
    total_doors: number
    total_windows: number
    total_wall_types: number
    total_partition_linear_ft?: number
  }
  assumptions: (string | Record<string, unknown>)[]
  conflicts: (string | Record<string, unknown>)[]
}

export interface DrawingIndexEntry {
  sheet_number: string
  title: string
  drawing_type: string
  description?: string
}

export interface CSIDivisionEntry {
  division: string
  division_name: string
  materials: string[]
}

export interface WallPartitionType {
  type_id: string
  assembly: string
  components?: string[]
  locations?: string[]
  [key: string]: unknown
}

export interface QuantityEstimate {
  item: string
  quantity?: number | string
  unit?: string
  notes?: string
}

export interface ProjectSummary {
  project_overview: Record<string, string>
  drawing_index: DrawingIndexEntry[]
  material_summary_by_division: CSIDivisionEntry[]
  door_window_schedule_summary: string
  wall_partition_types: WallPartitionType[]
  key_specifications: string[]
  quantities_and_estimates: QuantityEstimate[]
  notes_and_observations: string[]
}

export interface AuditFinding {
  severity: "critical" | "major" | "minor"
  category: string
  description: string
  page_reference?: string
  details?: string
}

export interface AuditReport {
  methodology: string
  findings: AuditFinding[]
  summary: {
    critical_count: number
    major_count: number
    minor_count: number
    completeness_pct?: number
  }
  recommended_corrections: string[]
}
