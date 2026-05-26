import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

interface ProgressEvent {
  type: string
  stage_number?: number
  total_stages?: number
  message?: string
  elapsed_seconds?: number
  job_id?: string
  error?: string
}

interface JobProgressProps {
  events: ProgressEvent[]
  status: "processing" | "complete" | "failed"
}

const STAGE_NAMES = [
  "Splitting PDF",
  "Analyzing Pages",
  "Extracting Materials",
  "Material Summary",
  "Project Summary",
  "Audit Report",
]

export default function JobProgress({ events, status }: JobProgressProps) {
  const latestStage = events.reduce((max, e) => {
    if (e.type === "stage_start" && e.stage_number) {
      return Math.max(max, e.stage_number)
    }
    if (e.type === "stage_done" && e.stage_number) {
      return Math.max(max, e.stage_number)
    }
    return max
  }, 0)

  const completedStages = events
    .filter((e) => e.type === "stage_done")
    .map((e) => e.stage_number || 0)

  const progressPercent = status === "complete" ? 100 : (latestStage / 6) * 100

  const lastMessage =
    [...events].reverse().find((e) => e.message)?.message || "Starting..."

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        {status === "processing" && (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        )}
        {status === "complete" && (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        )}
        {status === "failed" && <XCircle className="w-5 h-5 text-red-500" />}
        <span className="text-sm font-medium text-gray-700">{lastMessage}</span>
      </div>

      <Progress value={progressPercent} className="w-full" />

      <div className="space-y-2">
        {STAGE_NAMES.map((name, idx) => {
          const stageNum = idx + 1
          const isComplete = completedStages.includes(stageNum)
          const isActive = latestStage === stageNum && !isComplete
          const elapsed = events.find(
            (e) => e.type === "stage_done" && e.stage_number === stageNum
          )?.elapsed_seconds

          return (
            <div
              key={stageNum}
              className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : isComplete
                    ? "bg-green-50 text-green-700"
                    : "text-gray-400"
              }`}
            >
              <span>
                {stageNum}. {name}
              </span>
              <span>
                {isComplete && elapsed && `${elapsed.toFixed(1)}s`}
                {isActive && (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
