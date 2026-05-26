/**
 * Client for invoking the Blueprint Analyzer AgentCore Runtime.
 * Streams SSE progress events back to the UI.
 */

export interface BlueprintProgressEvent {
  type: "progress" | "stage_start" | "stage_done" | "complete" | "error"
  stage?: string
  stage_number?: number
  total_stages?: number
  message?: string
  elapsed_seconds?: number
  job_id?: string
  total_time_seconds?: number
  output_prefix?: string
  results?: {
    project_summary: string
    material_estimate: string
    audit_report: string
  }
  error?: string
}

export type ProgressCallback = (event: BlueprintProgressEvent) => void

export async function invokeBlueprintAnalysis(
  pdfKey: string,
  runtimeArn: string,
  region: string,
  accessToken: string,
  onEvent: ProgressCallback
): Promise<void> {
  const endpoint = `https://bedrock-agentcore.${region}.amazonaws.com`
  const escapedArn = encodeURIComponent(runtimeArn)
  const url = `${endpoint}/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`

  const sessionId = crypto.randomUUID()

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": sessionId,
    },
    body: JSON.stringify({
      prompt: pdfKey,
      pdf_key: pdfKey,
      runtimeSessionId: sessionId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Runtime error ${response.status}: ${errorText}`)
  }

  if (!response.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Handle SSE format: "data: {...}"
      const data = trimmed.startsWith("data: ") ? trimmed.substring(6) : trimmed

      try {
        const event = JSON.parse(data) as BlueprintProgressEvent
        onEvent(event)
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const data = buffer.trim().startsWith("data: ")
      ? buffer.trim().substring(6)
      : buffer.trim()
    try {
      const event = JSON.parse(data) as BlueprintProgressEvent
      onEvent(event)
    } catch {
      // Ignore
    }
  }
}
