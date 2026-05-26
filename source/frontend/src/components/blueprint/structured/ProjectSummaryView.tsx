import { ProjectSummary } from "../types"
import DataTable from "./DataTable"

interface ProjectSummaryViewProps {
  data: ProjectSummary
}

export default function ProjectSummaryView({ data }: ProjectSummaryViewProps) {
  const overview = data.project_overview

  return (
    <div className="space-y-6">
      {Object.keys(overview).length > 0 && (
        <div className="border rounded-lg p-5 bg-blue-50">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">Project Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(overview).map(([key, value]) =>
              value ? (
                <div key={key}>
                  <span className="font-medium text-gray-600">
                    {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
                  </span>{" "}
                  <span className="text-gray-900">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      <DataTable
        title="Drawing Index"
        columns={[
          { key: "sheet_number", label: "Sheet" },
          { key: "title", label: "Title" },
          { key: "drawing_type", label: "Type" },
          { key: "description", label: "Description" },
        ]}
        data={data.drawing_index}
      />

      {data.material_summary_by_division.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Material Summary by CSI Division</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.material_summary_by_division.map((div) => (
              <div key={div.division} className="border rounded-lg p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xs text-gray-400 font-mono">{div.division}</span>
                  <span className="text-sm font-semibold text-gray-900">{div.division_name}</span>
                </div>
                <ul className="text-sm text-gray-600 list-disc ml-4 space-y-0.5">
                  {div.materials.map((mat, idx) => (
                    <li key={idx}>{typeof mat === "string" ? mat : JSON.stringify(mat)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.door_window_schedule_summary && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Door & Window Schedule</h3>
          <p className="text-sm text-gray-600 border rounded-lg p-3 bg-gray-50">
            {typeof data.door_window_schedule_summary === "string"
              ? data.door_window_schedule_summary
              : JSON.stringify(data.door_window_schedule_summary)}
          </p>
        </div>
      )}

      {data.wall_partition_types.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Wall/Partition Types</h3>
          <div className="space-y-2">
            {data.wall_partition_types.map((wall, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold text-blue-700">{wall.type_id}</span>
                  <span className="text-sm text-gray-700">{wall.assembly}</span>
                </div>
                {wall.components && wall.components.length > 0 && (
                  <ul className="mt-1 ml-4 text-sm text-gray-600 list-disc space-y-0.5">
                    {wall.components.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
                {wall.locations && wall.locations.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    Locations: {wall.locations.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.key_specifications.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Key Specifications</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.key_specifications.map((spec, idx) => (
              <span
                key={idx}
                className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded border"
              >
                {typeof spec === "string" ? spec : JSON.stringify(spec)}
              </span>
            ))}
          </div>
        </div>
      )}

      <DataTable
        title="Quantities & Estimates"
        columns={[
          { key: "item", label: "Item" },
          { key: "quantity", label: "Quantity" },
          { key: "unit", label: "Unit" },
          { key: "notes", label: "Notes" },
        ]}
        data={data.quantities_and_estimates}
      />

      {data.notes_and_observations.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Notes & Observations</h3>
          <ul className="text-sm text-amber-700 list-disc ml-4 space-y-1">
            {data.notes_and_observations.map((note, idx) => (
              <li key={idx}>{typeof note === "string" ? note : JSON.stringify(note)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
