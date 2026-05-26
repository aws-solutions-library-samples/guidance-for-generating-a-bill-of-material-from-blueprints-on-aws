import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { uploadPdf } from "@/services/blueprintApi"
import { useAuth } from "@/hooks/useAuth"

interface PdfUploadProps {
  onUploadComplete: (pdfKey: string, filename: string) => void
}

export default function PdfUpload({ onUploadComplete }: PdfUploadProps) {
  const { token } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file || !token) return

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a PDF file")
        return
      }

      setError(null)
      setUploading(true)
      setProgress(30)

      try {
        const { pdfKey } = await uploadPdf(token, file)
        setProgress(100)
        onUploadComplete(pdfKey, file.name)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [token, onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
            <Progress value={progress} className="w-full max-w-xs" />
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-4">
            <Upload className="w-12 h-12 text-blue-500" />
            <p className="text-lg font-medium text-blue-600">Drop your PDF here</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <FileText className="w-12 h-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drag & drop a blueprint PDF
              </p>
              <p className="text-sm text-gray-500 mt-1">or click to browse</p>
            </div>
            <Button variant="outline" size="sm">
              Select File
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
