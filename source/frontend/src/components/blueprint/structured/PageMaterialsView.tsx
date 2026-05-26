import { PageMaterials } from "../types"
import DataTable from "./DataTable"

interface PageMaterialsViewProps {
  data: PageMaterials
}

export default function PageMaterialsView({ data }: PageMaterialsViewProps) {
  return (
    <div className="space-y-4">
      <div className="border-b pb-2 mb-2">
        <span className="text-sm font-semibold text-gray-700">
          {data.sheet_number} — {data.sheet_title}
        </span>
      </div>

      <DataTable
        title="Doors"
        columns={[
          { key: "mark", label: "Mark" },
          { key: "size", label: "Size", render: (d) => `${d.width}x${d.height}` },
          { key: "type", label: "Type" },
          { key: "hardware", label: "Hardware" },
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
          { key: "height", label: "Height" },
          { key: "area_sf", label: "Area (SF)" },
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
        ]}
        data={data.materials}
      />

      {data.assumptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Assumptions</h3>
          <ul className="text-sm text-gray-600 list-disc ml-4 space-y-0.5">
            {data.assumptions.map((note, idx) => (
              <li key={idx}>{typeof note === "string" ? note : JSON.stringify(note)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
