import { useEffect, useState } from "react"
import { FileText, Clock, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react"
import { listJobs, deleteJob, Job } from "@/services/blueprintApi"
import { useAuth } from "@/hooks/useAuth"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface JobListProps {
  onSelectJob: (job: Job) => void
  refreshTrigger?: number
}

export default function JobList({ onSelectJob, refreshTrigger }: JobListProps) {
  const { token } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmJob, setConfirmJob] = useState<Job | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    listJobs(token)
      .then(setJobs)
      .finally(() => setLoading(false))
  }, [token, refreshTrigger])

  async function handleDelete() {
    if (!token || !confirmJob) return
    setDeletingId(confirmJob.jobId)
    setConfirmJob(null)
    try {
      await deleteJob(token, confirmJob.jobId)
      setJobs((prev) => prev.filter((j) => j.jobId !== confirmJob.jobId))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>No analyses yet. Upload a blueprint to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.jobId}
            className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <button
              onClick={() => onSelectJob(job)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <StatusIcon status={job.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {job.pdfKey.split("/").pop() || "Blueprint"}
                </p>
                <p className="text-xs text-gray-500">
                  {job.progress}
                  {job.currentStage && ` - Stage ${job.currentStage.replace("stage_", "")}/8`}
                </p>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(job.createdAt)}
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmJob(job)
              }}
              disabled={deletingId === job.jobId}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-50"
              title="Delete analysis"
            >
              {deletingId === job.jobId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirmJob} onOpenChange={(open) => !open && setConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the blueprint analysis and all associated files
              (page images, analysis results, material estimates). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
    default:
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}
