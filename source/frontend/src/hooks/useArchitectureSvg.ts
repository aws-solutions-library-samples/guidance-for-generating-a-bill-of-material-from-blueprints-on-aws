import { useState, useEffect } from "react"
import { Graphviz } from "@hpcc-js/wasm-graphviz"

interface UseArchitectureSvgResult {
  svgString: string | null
  isLoading: boolean
  error: string | null
}

export function useArchitectureSvg(): UseArchitectureSvgResult {
  const [svgString, setSvgString] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render(): Promise<void> {
      try {
        const [dotResponse, graphviz] = await Promise.all([
          fetch("/architecture-icons/architecture.dot"),
          Graphviz.load(),
        ])

        if (!dotResponse.ok) {
          throw new Error(`Failed to fetch architecture.dot: ${dotResponse.status}`)
        }

        let dotSource = await dotResponse.text()

        dotSource = dotSource.replace(/icons\//g, "/architecture-icons/")

        const imageEntries = [
          { path: "/architecture-icons/User.png", width: "48px", height: "48px" },
          { path: "/architecture-icons/Amplify.png", width: "48px", height: "48px" },
          { path: "/architecture-icons/Cognito.png", width: "48px", height: "48px" },
          { path: "/architecture-icons/AgentCore.png", width: "48px", height: "48px" },
          { path: "/architecture-icons/Bedrock.png", width: "40px", height: "40px" },
          { path: "/architecture-icons/S3.png", width: "36px", height: "36px" },
          { path: "/architecture-icons/DynamoDB.png", width: "36px", height: "36px" },
          { path: "/architecture-icons/APIGateway.png", width: "36px", height: "36px" },
          { path: "/architecture-icons/Lambda.png", width: "30px", height: "30px" },
        ]

        const svg = graphviz.dot(dotSource, "svg", { images: imageEntries })

        if (!cancelled) {
          setSvgString(svg)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [])

  return { svgString, isLoading, error }
}
