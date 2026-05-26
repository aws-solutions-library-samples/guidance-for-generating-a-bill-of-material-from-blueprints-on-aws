export interface Job {
  jobId: string
  userId: string
  pdfKey: string
  status: "processing" | "complete" | "failed"
  progress: string
  currentStage?: string
  createdAt: number
  completedAt?: number
  outputPrefix?: string
  error?: string
}

export interface UploadResponse {
  pdfKey: string
  uploadId: string
}

export interface ResultUrls {
  project_summary: string
  project_summary_raw: string
  material_estimate: string
  material_estimate_raw: string
  audit_report: string
  audit_report_raw: string
}

export interface PageInfo {
  pageNumber: number
  name: string
  analysisUrl: string
  analysisRawUrl: string
  imageUrl: string
  materialsUrl?: string
  materialsRawUrl?: string
}

export interface PageListResponse {
  pages: PageInfo[]
}

let _apiUrl = ""

async function getApiUrl(): Promise<string> {
  if (_apiUrl) return _apiUrl
  const res = await fetch("/aws-exports.json")
  const config = await res.json()
  // Remove trailing slash to avoid double-slash in paths
  _apiUrl = (config.blueprintApiUrl || "/api").replace(/\/$/, "")
  return _apiUrl
}

async function fetchWithAuth(path: string, token: string, options: RequestInit = {}) {
  const apiUrl = await getApiUrl()
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function uploadPdf(token: string, file: File): Promise<UploadResponse> {
  const data = await fetchWithAuth(
    `/blueprint/upload?filename=${encodeURIComponent(file.name)}`,
    token,
    { method: "POST" }
  )

  const { uploadUrl, pdfKey, uploadId } = data

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  })

  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`)
  }

  return { pdfKey, uploadId }
}

export async function listJobs(token: string): Promise<Job[]> {
  const data = await fetchWithAuth("/blueprint/jobs", token)
  return data.jobs
}

export async function getJob(token: string, jobId: string): Promise<Job> {
  const data = await fetchWithAuth(`/blueprint/jobs/${jobId}`, token)
  return data.job
}

export async function getResults(token: string, jobId: string): Promise<ResultUrls> {
  const data = await fetchWithAuth(`/blueprint/results/${jobId}`, token)
  return data.results
}

export async function getPages(token: string, jobId: string): Promise<PageInfo[]> {
  const data = await fetchWithAuth(`/blueprint/results/${jobId}/pages`, token)
  return data.pages
}

export async function deleteJob(token: string, jobId: string): Promise<void> {
  await fetchWithAuth(`/blueprint/jobs/${jobId}`, token, { method: "DELETE" })
}
