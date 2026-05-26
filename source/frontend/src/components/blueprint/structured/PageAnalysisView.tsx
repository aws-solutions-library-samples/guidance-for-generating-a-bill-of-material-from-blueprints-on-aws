import { PageAnalysis } from "../types"
import DataTable from "./DataTable"

interface PageAnalysisViewProps {
  data: PageAnalysis
}

export default function PageAnalysisView({ data }: PageAnalysisViewProps) {
  const { page_identification: pi, title_block: tb } = data

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold text-blue-900">
            {pi.sheet_number}
          </span>
          <span className="text-gray-700">{pi.title}</span>
        </div>
        <div className="flex gap-4 mt-1 text-sm text-gray-600">
          <span className="bg-blue-100 px-2 py-0.5 rounded">{pi.drawing_type}</span>
          {pi.scale && <span>Scale: {pi.scale}</span>}
          {pi.revision && <span>Rev: {pi.revision}</span>}
        </div>
      </div>

      {Object.values(tb).some(Boolean) && (
        <div className="grid grid-cols-2 gap-2 text-sm border rounded-lg p-3">
          {tb.project_name && (
            <div><span className="font-medium text-gray-600">Project:</span> {tb.project_name}</div>
          )}
          {tb.architect && (
            <div><span className="font-medium text-gray-600">Architect:</span> {tb.architect}</div>
          )}
          {tb.date && (
            <div><span className="font-medium text-gray-600">Date:</span> {tb.date}</div>
          )}
          {tb.drawn_by && (
            <div><span className="font-medium text-gray-600">Drawn By:</span> {tb.drawn_by}</div>
          )}
        </div>
      )}

      {data.structural_elements.length > 0 && (
        <DataTable
          title="Structural Elements"
          columns={[
            { key: "type", label: "Type" },
            { key: "description", label: "Description" },
            { key: "dimensions", label: "Dimensions" },
            { key: "location", label: "Location" },
          ]}
          data={data.structural_elements}
        />
      )}

      <DataTable
        title="Doors"
        columns={[
          { key: "mark", label: "Mark" },
          { key: "size", label: "Size", render: (d) => `${d.width}x${d.height}` },
          { key: "type", label: "Type" },
          { key: "hardware", label: "Hardware" },
          { key: "fire_rating", label: "Fire Rating" },
          { key: "qty", label: "Qty" },
        ]}
        data={data.doors}
      />

      <DataTable
        title="Windows"
        columns={[
          { key: "mark", label: "Mark" },
          { key: "size", label: "Size", render: (w) => `${w.width}x${w.height}` },
          { key: "type", label: "Type" },
          { key: "glazing", label: "Glazing" },
          { key: "qty", label: "Qty" },
        ]}
        data={data.windows}
      />

      <DataTable
        title="Walls/Partitions"
        columns={[
          { key: "type_id", label: "Type" },
          { key: "assembly", label: "Assembly" },
          { key: "thickness", label: "Thickness" },
          { key: "linear_ft", label: "Linear Ft" },
          { key: "area_sf", label: "Area (SF)" },
          { key: "fire_rating", label: "Fire Rating" },
        ]}
        data={data.walls}
      />

      <DataTable
        title="Materials"
        columns={[
          { key: "material", label: "Material" },
          { key: "specification", label: "Specification" },
          { key: "quantity", label: "Quantity" },
          { key: "unit", label: "Unit" },
          { key: "location", label: "Location" },
        ]}
        data={data.materials}
      />

      {data.construction_details.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Construction Details</h3>
          <div className="space-y-2">
            {data.construction_details.map((cd, idx) => (
              <div key={idx} className="border rounded p-3 text-sm">
                <div className="font-medium">
                  {cd.detail_id && <span className="text-blue-600 mr-2">{cd.detail_id}</span>}
                  {cd.description}
                </div>
                {cd.components.length > 0 && (
                  <ul className="mt-1 ml-4 list-disc text-gray-600">
                    {cd.components.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.reference_standards.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Reference Standards</h3>
          <div className="flex flex-wrap gap-1">
            {data.reference_standards.map((std, idx) => (
              <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                {typeof std === "string" ? std : JSON.stringify(std)}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.notes.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
          <ul className="text-sm text-gray-600 list-disc ml-4 space-y-0.5">
            {data.notes.map((note, idx) => (
              <li key={idx}>{typeof note === "string" ? note : JSON.stringify(note)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
