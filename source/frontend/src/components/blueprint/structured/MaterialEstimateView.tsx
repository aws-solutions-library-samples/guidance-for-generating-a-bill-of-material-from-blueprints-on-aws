import { MaterialEstimate } from "../types"
import DataTable from "./DataTable"

interface MaterialEstimateViewProps {
  data: MaterialEstimate
}

export default function MaterialEstimateView({ data }: MaterialEstimateViewProps) {
  const { summary_stats: stats } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Doors" value={stats.total_doors} />
        <StatCard label="Total Windows" value={stats.total_windows} />
        <StatCard label="Wall Types" value={stats.total_wall_types} />
        {stats.total_partition_linear_ft != null && (
          <StatCard
            label="Partition LF"
            value={stats.total_partition_linear_ft}
            suffix=" LF"
          />
        )}
      </div>

      <DataTable
        title="Door Schedule"
        columns={[
          { key: "mark", label: "Mark" },
          { key: "size", label: "Size", render: (d) => `${d.width}x${d.height}` },
          { key: "type", label: "Type" },
          { key: "hardware", label: "Hardware" },
          { key: "fire_rating", label: "Fire Rating" },
          { key: "qty", label: "Qty" },
          { key: "found_on", label: "Found On", render: (d) => d.found_on.join(", ") },
        ]}
        data={data.door_schedule}
      />

      <DataTable
        title="Window Schedule"
        columns={[
          { key: "mark", label: "Mark" },
          { key: "size", label: "Size", render: (w) => `${w.width}x${w.height}` },
          { key: "type", label: "Type" },
          { key: "glazing", label: "Glazing" },
          { key: "qty", label: "Qty" },
          { key: "found_on", label: "Found On", render: (w) => w.found_on.join(", ") },
        ]}
        data={data.window_schedule}
      />

      <DataTable
        title="Wall/Partition Summary"
        columns={[
          { key: "type_id", label: "Type" },
          { key: "assembly", label: "Assembly" },
          { key: "total_linear_ft", label: "Total LF" },
          { key: "total_area_sf", label: "Total SF" },
          { key: "locations", label: "Locations", render: (w) => w.locations.join(", ") },
        ]}
        data={data.wall_summary}
      />

      <DataTable
        title="Material Totals"
        columns={[
          { key: "material", label: "Material" },
          { key: "specification", label: "Specification" },
          { key: "total_qty", label: "Total Qty" },
          { key: "unit", label: "Unit" },
          {
            key: "pages_referenced",
            label: "Pages",
            render: (m) => m.pages_referenced.join(", "),
          },
        ]}
        data={data.material_totals}
      />

      {data.conflicts.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Conflicts</h3>
          <ul className="text-sm text-amber-700 list-disc ml-4 space-y-1">
            {data.conflicts.map((c, idx) => (
              <li key={idx}>{typeof c === "string" ? c : formatConflict(c)}</li>
            ))}
          </ul>
        </div>
      )}

      {data.assumptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Assumptions & Caveats</h3>
          <ul className="text-sm text-gray-600 list-disc ml-4 space-y-0.5">
            {data.assumptions.map((a, idx) => (
              <li key={idx}>{typeof a === "string" ? a : JSON.stringify(a)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatConflict(c: unknown): string {
  if (typeof c === "string") return c
  const obj = c as Record<string, unknown>
  if (obj.description) return String(obj.description)
  if (obj.conflict) return String(obj.conflict)
  const parts: string[] = []
  if (obj.mark) parts.push(`Mark ${obj.mark}`)
  if (obj.found_on) parts.push(`found on ${Array.isArray(obj.found_on) ? (obj.found_on as string[]).join(", ") : obj.found_on}`)
  if (parts.length > 0) return parts.join(" — ")
  return JSON.stringify(c)
}

function StatCard({
  label,
  value,
  suffix = "",
}: {
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-blue-600">
        {value}
        {suffix}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
