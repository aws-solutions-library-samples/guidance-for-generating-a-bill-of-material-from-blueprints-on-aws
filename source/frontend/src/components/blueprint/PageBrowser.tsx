import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronLeft, ChevronRight, FileText, Package, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageInfo } from "@/services/blueprintApi"
import { PageAnalysis, PageMaterials } from "./types"
import PageAnalysisView from "./structured/PageAnalysisView"
import PageMaterialsView from "./structured/PageMaterialsView"
import RawToggle from "./structured/RawToggle"
import ImageLightbox from "./ImageLightbox"

interface PageBrowserProps {
  pages: PageInfo[]
}

type ContentTab = "analysis" | "materials"

export default function PageBrowser({ pages }: PageBrowserProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [contentTab, setContentTab] = useState<ContentTab>("analysis")
  const [showRaw, setShowRaw] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const [analysisData, setAnalysisData] = useState<Record<number, PageAnalysis>>({})
  const [materialsData, setMaterialsData] = useState<Record<number, PageMaterials>>({})
  const [rawContent, setRawContent] = useState<Record<string, string>>({})
  const [loadingContent, setLoadingContent] = useState(false)

  const currentPage = pages[currentIndex]

  useEffect(() => {
    if (!currentPage) return

    const pageNum = currentPage.pageNumber

    if (contentTab === "analysis") {
      if (showRaw) {
        const rawKey = `analysis_raw_${pageNum}`
        if (!rawContent[rawKey]) {
          setLoadingContent(true)
          fetch(currentPage.analysisRawUrl)
            .then((res) => res.text())
            .then((text) => setRawContent((prev) => ({ ...prev, [rawKey]: text })))
            .finally(() => setLoadingContent(false))
        }
      } else if (!analysisData[pageNum]) {
        setLoadingContent(true)
        fetch(currentPage.analysisUrl)
          .then((res) => res.json())
          .then((json) => setAnalysisData((prev) => ({ ...prev, [pageNum]: json })))
          .finally(() => setLoadingContent(false))
      }
    } else if (contentTab === "materials") {
      if (showRaw && currentPage.materialsRawUrl) {
        const rawKey = `materials_raw_${pageNum}`
        if (!rawContent[rawKey]) {
          setLoadingContent(true)
          fetch(currentPage.materialsRawUrl)
            .then((res) => res.text())
            .then((text) => setRawContent((prev) => ({ ...prev, [rawKey]: text })))
            .finally(() => setLoadingContent(false))
        }
      } else if (!showRaw && currentPage.materialsUrl && !materialsData[pageNum]) {
        setLoadingContent(true)
        fetch(currentPage.materialsUrl)
          .then((res) => res.json())
          .then((json) => setMaterialsData((prev) => ({ ...prev, [pageNum]: json })))
          .finally(() => setLoadingContent(false))
      }
    }
  }, [currentIndex, contentTab, showRaw, currentPage, analysisData, materialsData, rawContent])

  if (pages.length === 0) {
    return <p className="text-center text-gray-500">No pages available.</p>
  }

  const pageNum = currentPage.pageNumber

  function renderContent() {
    if (loadingContent) {
      return <p className="text-gray-400">Loading...</p>
    }

    if (contentTab === "analysis") {
      if (showRaw) {
        const text = rawContent[`analysis_raw_${pageNum}`]
        return text ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        ) : (
          <p className="text-gray-400">Loading...</p>
        )
      }
      const data = analysisData[pageNum]
      return data ? <PageAnalysisView data={data} /> : <p className="text-gray-400">Loading...</p>
    }

    if (contentTab === "materials") {
      if (showRaw) {
        const text = rawContent[`materials_raw_${pageNum}`]
        return text ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        ) : (
          <p className="text-gray-400">No materials data for this page.</p>
        )
      }
      const data = materialsData[pageNum]
      return data ? <PageMaterialsView data={data} /> : (
        <p className="text-gray-400">
          {currentPage.materialsUrl ? "Loading..." : "No materials data for this page."}
        </p>
      )
    }

    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => i - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <select
            value={currentIndex}
            onChange={(e) => setCurrentIndex(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {pages.map((page, idx) => (
              <option key={page.pageNumber} value={idx}>
                Page {page.pageNumber} — {page.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} of {pages.length}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex === pages.length - 1}
          onClick={() => setCurrentIndex((i) => i + 1)}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden bg-gray-100">
          <div className="p-2 bg-gray-200 text-xs font-medium text-gray-600 text-center">
            Blueprint Page {currentPage.pageNumber}
          </div>
          <div
            className="p-2 flex items-center justify-center min-h-[400px] cursor-zoom-in relative group"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={currentPage.imageUrl}
              alt={`Blueprint page ${currentPage.pageNumber}`}
              className="max-w-full max-h-[600px] object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
              <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b bg-gray-50 pr-2">
            <div className="flex">
              <button
                onClick={() => setContentTab("analysis")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  contentTab === "analysis"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Analysis
              </button>
              {currentPage.materialsUrl && (
                <button
                  onClick={() => setContentTab("materials")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    contentTab === "materials"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Materials
                </button>
              )}
            </div>
            <RawToggle showRaw={showRaw} onToggle={() => setShowRaw(!showRaw)} />
          </div>

          <div className={`overflow-auto max-h-[600px] p-4 bg-white flex-1 ${showRaw ? "prose prose-sm max-w-none" : ""}`}>
            {renderContent()}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          src={currentPage.imageUrl}
          alt={`Blueprint page ${currentPage.pageNumber}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
