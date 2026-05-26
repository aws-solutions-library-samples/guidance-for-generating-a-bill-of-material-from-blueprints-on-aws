import { AuditReport, AuditFinding } from "../types"

interface AuditReportViewProps {
  data: AuditReport
}

const SEVERITY_STYLES = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
  major: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  minor: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-400",
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  material_discrepancy: "Material Discrepancy",
  door_schedule_gap: "Door Schedule Gap",
  window_schedule_gap: "Window Schedule Gap",
  specification_omission: "Specification Omission",
  structural_inconsistency: "Structural Inconsistency",
  quantity_error: "Quantity Error",
  missing_information: "Missing Information",
}

export default function AuditReportView({ data }: AuditReportViewProps) {
  const { summary } = data
  const total = summary.critical_count + summary.major_count + summary.minor_count

  const critical = data.findings.filter((f) => f.severity === "critical")
  const major = data.findings.filter((f) => f.severity === "major")
  const minor = data.findings.filter((f) => f.severity === "minor")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Findings" value={total} color="gray" />
        <SummaryCard label="Critical" value={summary.critical_count} color="red" />
        <SummaryCard label="Major" value={summary.major_count} color="amber" />
        <SummaryCard label="Minor" value={summary.minor_count} color="blue" />
      </div>

      {summary.completeness_pct != null && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Summary Completeness</span>
            <span className="text-sm font-bold text-gray-900">{summary.completeness_pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${summary.completeness_pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Methodology</h3>
        <p className="text-sm text-gray-600">{data.methodology}</p>
      </div>

      {critical.length > 0 && <FindingsSection title="Critical Findings" findings={critical} />}
      {major.length > 0 && <FindingsSection title="Major Findings" findings={major} />}
      {minor.length > 0 && <FindingsSection title="Minor Findings" findings={minor} />}

      {data.recommended_corrections.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommended Corrections</h3>
          <ol className="text-sm text-gray-600 list-decimal ml-4 space-y-1">
            {data.recommended_corrections.map((corr, idx) => (
              <li key={idx}>{typeof corr === "string" ? corr : JSON.stringify(corr)}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function FindingsSection({ title, findings }: { title: string; findings: AuditFinding[] }) {
  const severity = findings[0]?.severity || "minor"
  const styles = SEVERITY_STYLES[severity]

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="space-y-2">
        {findings.map((finding, idx) => (
          <div
            key={idx}
            className={`border ${styles.border} ${styles.bg} rounded-lg p-3`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${styles.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${styles.badge}`}>
                    {CATEGORY_LABELS[finding.category] || finding.category}
                  </span>
                  {finding.page_reference && (
                    <span className="text-xs text-gray-500">
                      Page: {finding.page_reference}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 mt-1">{finding.description}</p>
                {finding.details && (
                  <p className="text-xs text-gray-600 mt-1">{finding.details}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: "red" | "amber" | "blue" | "gray"
}) {
  const colorMap = {
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    gray: "text-gray-800",
  }

  return (
    <div className="border rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
