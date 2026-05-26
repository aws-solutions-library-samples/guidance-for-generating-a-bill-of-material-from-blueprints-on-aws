import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useAuth as useOidcAuth } from "react-oidc-context"
import PdfUpload from "@/components/blueprint/PdfUpload"
import JobList from "@/components/blueprint/JobList"
import JobProgress from "@/components/blueprint/JobProgress"
import ResultsViewer from "@/components/blueprint/ResultsViewer"
import { Job } from "@/services/blueprintApi"
import {
  invokeBlueprintAnalysis,
  BlueprintProgressEvent,
} from "@/services/blueprintRuntime"
import { ArrowLeft, LogOut, GitBranch } from "lucide-react"
import { useNavigate } from "react-router-dom"

type View = "dashboard" | "progress" | "results"

interface RuntimeConfig {
  agentRuntimeArn: string
  awsRegion: string
}

export default function BlueprintPage() {
  const { isAuthenticated, signIn, signOut, user } = useAuth()
  const oidcAuth = useOidcAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>("dashboard")
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [progressEvents, setProgressEvents] = useState<BlueprintProgressEvent[]>([])
  const [pipelineStatus, setPipelineStatus] = useState<"processing" | "complete" | "failed">("processing")
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const [completedJobId, setCompletedJobId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/aws-exports.json")
      .then((res) => res.json())
      .then((data) => {
        setConfig({
          agentRuntimeArn: data.agentRuntimeArn,
          awsRegion: data.awsRegion || "us-east-1",
        })
      })
      .catch(console.error)
  }, [])

  const handleUploadComplete = useCallback(
    async (pdfKey: string, _filename: string) => {
      if (!config) return

      const accessToken = oidcAuth?.user?.access_token
      if (!accessToken) {
        setPipelineStatus("failed")
        setProgressEvents([{ type: "error", message: "Not authenticated" }])
        return
      }

      setProgressEvents([])
      setPipelineStatus("processing")
      setView("progress")

      try {
        await invokeBlueprintAnalysis(
          pdfKey,
          config.agentRuntimeArn,
          config.awsRegion,
          accessToken,
          (event) => {
            setProgressEvents((prev) => [...prev, event])

            if (event.type === "complete") {
              setPipelineStatus("complete")
              setCompletedJobId(event.job_id || null)
              setRefreshTrigger((n) => n + 1)
            } else if (event.type === "error") {
              setPipelineStatus("failed")
            }
          }
        )
      } catch (err) {
        setPipelineStatus("failed")
        setProgressEvents((prev) => [
          ...prev,
          {
            type: "error" as const,
            message: err instanceof Error ? err.message : "Pipeline failed",
          },
        ])
      }
    },
    [config, oidcAuth]
  )

  const handleSelectJob = useCallback((job: Job) => {
    setSelectedJob(job)
    if (job.status === "complete") {
      setView("results")
    } else {
      setView("progress")
    }
  }, [])

  const handleViewResults = useCallback(() => {
    if (completedJobId) {
      setSelectedJob({ jobId: completedJobId } as Job)
      setView("results")
    }
  }, [completedJobId])

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50">
        <h1 className="text-3xl font-bold text-gray-900">Blueprint Analyzer</h1>
        <p className="text-gray-600">AI-powered construction blueprint analysis</p>
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view !== "dashboard" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setView("dashboard")
                setSelectedJob(null)
                setCompletedJobId(null)
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <h1 className="text-lg font-semibold text-gray-900">Blueprint Analyzer</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/architecture")}
            title="Architecture Walkthrough"
          >
            <GitBranch className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-sm">How It Works</span>
          </Button>
          <span className="text-sm text-gray-500">
            {user?.profile?.email || "User"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className={`mx-auto py-8 px-4 ${view === "results" ? "max-w-7xl" : "max-w-4xl"}`}>
        {view === "dashboard" && (
          <div className="space-y-8">
            <PdfUpload onUploadComplete={handleUploadComplete} />
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Previous Analyses
              </h2>
              <JobList
                onSelectJob={handleSelectJob}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        )}

        {view === "progress" && (
          <div className="space-y-4">
            <JobProgress events={progressEvents} status={pipelineStatus} />
            {pipelineStatus === "complete" && (
              <div className="text-center">
                <Button onClick={handleViewResults}>View Results</Button>
              </div>
            )}
          </div>
        )}

        {view === "results" && selectedJob && (
          <ResultsViewer jobId={selectedJob.jobId} />
        )}
      </main>
    </div>
  )
}
