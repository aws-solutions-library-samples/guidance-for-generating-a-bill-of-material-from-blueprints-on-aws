import { useEffect, useRef, useState, FormEvent } from "react"
import { X, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatInput } from "@/components/chat/ChatInput"
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer"
import { AgentCoreClient } from "@/lib/agentcore-client"
import type { AgentPattern, StreamEvent } from "@/lib/agentcore-client"
import { useAuth } from "react-oidc-context"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface BlueprintChatDrawerProps {
  jobId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function BlueprintChatDrawer({ jobId, open, onOpenChange }: BlueprintChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [client, setClient] = useState<AgentCoreClient | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/aws-exports.json")
        const config = await response.json()
        if (!config.agentRuntimeArn) return

        const agentClient = new AgentCoreClient({
          runtimeArn: config.agentRuntimeArn,
          region: config.awsRegion || "us-east-1",
          pattern: (config.agentPattern || "blueprint-analyzer") as AgentPattern,
        })
        setClient(agentClient)
      } catch (err) {
        console.error("Failed to load agent config for blueprint chat:", err)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || !client) return
    setError(null)

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, newUserMessage])
    setInput("")
    setIsLoading(true)

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const accessToken = auth.user?.access_token
      if (!accessToken) {
        throw new Error("Authentication required.")
      }

      let textContent = ""

      await client.invoke(
        userMessage,
        sessionId,
        accessToken,
        (event: StreamEvent) => {
          if (event.type === "text") {
            textContent += event.content
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: textContent,
              }
              return updated
            })
          }
        },
        { mode: "chat", job_id: jobId }
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "Sorry, I encountered an error processing your request. Please try again.",
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  if (!open) return null

  return (
    <div className="h-full w-full border bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="font-medium text-sm text-gray-900">Chat with Blueprint</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="h-7 w-7 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Ask about your blueprint</p>
            <p className="text-xs mt-1 text-gray-400">
              I have access to all analysis data and can view page images.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] break-words text-sm ${
                msg.role === "user"
                  ? "p-2.5 rounded-lg bg-gray-800 text-white rounded-br-none whitespace-pre-wrap"
                  : "text-gray-800"
              }`}
            >
              {msg.role === "assistant" ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t">
        <ChatInput
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          className="p-2"
        />
      </div>
    </div>
  )
}
