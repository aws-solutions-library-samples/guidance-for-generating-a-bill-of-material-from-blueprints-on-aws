import { useCallback, useRef, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useArchitectureSvg } from "@/hooks/useArchitectureSvg"
import { ARCHITECTURE_NODES, type ArchitectureNodeMeta } from "@/data/architectureNodes"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

function findNodeId(target: Element, svgRoot: Element): string | null {
  let el: Element | null = target
  while (el && el !== svgRoot) {
    if (
      el.tagName === "g" &&
      (el.classList.contains("node") || el.classList.contains("cluster"))
    ) {
      const title = el.querySelector("title")
      return title?.textContent ?? null
    }
    el = el.parentElement
  }
  return null
}

function ArchitectureContent(): React.ReactElement {
  const { svgString, isLoading, error } = useArchitectureSvg()
  const [selectedNode, setSelectedNode] = useState<ArchitectureNodeMeta | null>(null)
  const [sheetOpen, setSheetOpen] = useState<boolean>(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const handleSvgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const svgRoot = svgContainerRef.current?.querySelector("svg")
    if (!svgRoot) return

    const nodeId = findNodeId(e.target as Element, svgRoot)
    if (!nodeId) return

    const meta = ARCHITECTURE_NODES[nodeId]
    if (!meta) return

    setSelectedNode(meta)
    setSheetOpen(true)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>Loading architecture diagram...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 max-w-lg">
          <p className="text-sm text-red-700">Failed to render architecture diagram: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none border-b bg-white px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h1 className="text-lg font-semibold">Architecture Walkthrough</h1>
        <span className="text-sm text-muted-foreground">
          Click any component to learn more
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div
          ref={svgContainerRef}
          onClick={handleSvgClick}
          className="w-fit [&_g.node]:cursor-pointer [&_g.node:hover]:opacity-80 [&_g.cluster]:cursor-pointer [&_g.cluster:hover]:opacity-90"
          dangerouslySetInnerHTML={{ __html: svgString ?? "" }}
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{selectedNode?.label}</SheetTitle>
            <SheetDescription>{selectedNode?.description}</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            {selectedNode?.services && selectedNode.services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Services & Technologies</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {selectedNode.services.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {selectedNode?.flowSteps && selectedNode.flowSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Data Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    {selectedNode.flowSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function ArchitecturePage(): React.ReactElement {
  const { isAuthenticated, signIn } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-4xl">Please sign in</p>
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    )
  }

  return <ArchitectureContent />
}
