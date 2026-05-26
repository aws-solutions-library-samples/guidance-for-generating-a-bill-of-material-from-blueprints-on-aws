import { Code, LayoutGrid } from "lucide-react"

interface RawToggleProps {
  showRaw: boolean
  onToggle: () => void
}

export default function RawToggle({ showRaw, onToggle }: RawToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border transition-colors hover:bg-gray-50"
      title={showRaw ? "Show structured view" : "Show raw markdown"}
    >
      {showRaw ? (
        <>
          <LayoutGrid className="w-3.5 h-3.5" />
          Structured
        </>
      ) : (
        <>
          <Code className="w-3.5 h-3.5" />
          View Raw
        </>
      )}
    </button>
  )
}
