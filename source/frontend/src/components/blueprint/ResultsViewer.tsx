import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, ClipboardList, Shield, Layers, MessageSquare } from "lucide-react"
import { getResults, getPages, ResultUrls, PageInfo } from "@/services/blueprintApi"
import { useAuth } from "@/hooks/useAuth"
import { MaterialEstimate, ProjectSummary, AuditReport } from "./types"
import PageBrowser from "./PageBrowser"
import MaterialEstimateView from "./structured/MaterialEstimateView"
import ProjectSummaryView from "./structured/ProjectSummaryView"
import AuditReportView from "./structured/AuditReportView"
import RawToggle from "./structured/RawToggle"
import BlueprintChatDrawer from "./BlueprintChatDrawer"

interface ResultsViewerProps {
  jobId: string
}

type ViewMode = "pages" | "project_summary" | "material_estimate" | "audit_report"

const NAV_ITEMS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: "pages", label: "Pages", icon: <Layers className="w-4 h-4" /> },
  { key: "project_summary", label: "Project Summary", icon: <FileText className="w-4 h-4" /> },
  { key: "material_estimate", label: "Material Estimate", icon: <ClipboardList className="w-4 h-4" /> },
  { key: "audit_report", label: "Audit Report", icon: <Shield className="w-4 h-4" /> },
]

export default function ResultsViewer({ jobId }: ResultsViewerProps) {
  const { token } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>("pages")
  const [urls, setUrls] = useState<ResultUrls | null>(null)
  const [pages, setPages] = useState<PageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showRaw, setShowRaw] = useState(false)

  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null)
  const [materialEstimate, setMaterialEstimate] = useState<MaterialEstimate | null>(null)
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null)
  const [rawContent, setRawContent] = useState<Record<string, string>>({})
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (!token) return
    Promise.all([
      getResults(token, jobId),
      getPages(token, jobId).catch(() => []),
    ]).then(([resultUrls, pageList]) => {
      setUrls(resultUrls)
      setPages(pageList)
      setLoading(false)
    })
  }, [token, jobId])

  useEffect(() => {
    if (!urls || viewMode === "pages") return

    if (showRaw) {
      const rawKey = `${viewMode}_raw` as keyof ResultUrls
      if (!rawContent[viewMode] && urls[rawKey]) {
        fetch(urls[rawKey])
          .then((res) => res.text())
          .then((text) => setRawContent((prev) => ({ ...prev, [viewMode]: text })))
      }
    } else {
      if (viewMode === "project_summary" && !projectSummary) {
        fetch(urls.project_summary)
          .then((res) => res.json())
          .then((json) => setProjectSummary(json))
      } else if (viewMode === "material_estimate" && !materialEstimate) {
        fetch(urls.material_estimate)
          .then((res) => res.json())
          .then((json) => setMaterialEstimate(json))
      } else if (viewMode === "audit_report" && !auditReport) {
        fetch(urls.audit_report)
          .then((res) => res.json())
          .then((json) => setAuditReport(json))
      }
    }
  }, [urls, viewMode, showRaw, projectSummary, materialEstimate, auditReport, rawContent])

  if (loading) {
    return <p className="text-center text-gray-500">Loading results...</p>
  }

  function renderContent() {
    if (showRaw) {
      const text = rawContent[viewMode]
      return text ? (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-gray-400">Loading...</p>
      )
    }

    if (viewMode === "project_summary") {
      return projectSummary ? (
        <ProjectSummaryView data={projectSummary} />
      ) : (
        <p className="text-gray-400">Loading...</p>
      )
    }

    if (viewMode === "material_estimate") {
      return materialEstimate ? (
        <MaterialEstimateView data={materialEstimate} />
      ) : (
        <p className="text-gray-400">Loading...</p>
      )
    }

    if (viewMode === "audit_report") {
      return auditReport ? (
        <AuditReportView data={auditReport} />
      ) : (
        <p className="text-gray-400">Loading...</p>
      )
    }

    return null
  }

  return (
    <div className="flex w-full gap-4">
      <div className={`transition-all duration-300 ${chatOpen ? "flex-1 min-w-0" : "w-full"}`}>
        <nav className="flex items-center border-b mb-6 overflow-x-auto">
          <div className="flex flex-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setViewMode(item.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  viewMode === item.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pr-2">
            {viewMode !== "pages" && (
              <RawToggle showRaw={showRaw} onToggle={() => setShowRaw(!showRaw)} />
            )}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chatOpen
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>
        </nav>

        {viewMode === "pages" ? (
          <PageBrowser pages={pages} />
        ) : (
          <div className="overflow-auto max-h-[75vh] p-6 bg-white rounded-lg border">
            {renderContent()}
          </div>
        )}
      </div>

      {chatOpen && (
        <div className="w-[440px] flex-shrink-0 h-[calc(100vh-8rem)] sticky top-4">
          <BlueprintChatDrawer jobId={jobId} open={chatOpen} onOpenChange={setChatOpen} />
        </div>
      )}
    </div>
  )
}
