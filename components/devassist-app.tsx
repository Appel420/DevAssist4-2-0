"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Settings, Wifi, WifiOff, Activity, MessageSquare, Code, Zap, Terminal, Mic, MicOff } from "lucide-react"

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  type?: "text" | "code" | "error"
}

interface ChatSession {
  id: string
  title: string
  created_at: string
}

export function DevAssistApp() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "🚀 Hello! I'm DevAssist 4.2.0, your local iOS development assistant.\n\nI can help you with:\n• Swift & SwiftUI development\n• iOS architecture & best practices\n• Debugging & optimization\n• Voice prompts and local transcript flow\n• Visual prompts from a local VLM pipeline\n• Security implementation\n\nWhat would you like to work on today?",
      isUser: false,
      timestamp: new Date(),
      type: "text",
    },
  ])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [apiHealth, setApiHealth] = useState<"healthy" | "unhealthy" | "checking">("checking")
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [websitePermissions, setWebsitePermissions] = useState<string[]>([])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Check API health on mount
    checkAPIHealth()
    // Create initial chat session
    createChatSession()

    // Initialize speech recognition
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setCurrentMessage(transcript)
        setIsListening(false)
      }

      recognitionInstance.onerror = () => {
        setIsListening(false)
      }

      recognitionInstance.onend = () => {
        setIsListening(false)
      }

      setRecognition(recognitionInstance)
    }
  }, [])

  const checkAPIHealth = async () => {
    try {
      const response = await fetch("/api/health")
      const data = await response.json()
      setApiHealth(data.status === "healthy" ? "healthy" : "unhealthy")
      setIsConnected(true)
    } catch (error) {
      setApiHealth("unhealthy")
      setIsConnected(false)
    }
  }

  const createChatSession = async () => {
    try {
      const response = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "DevAssist Session" }),
      })

      if (response.ok) {
        const session = await response.json()
        setCurrentSession(session)
      }
    } catch (error) {
      console.error("Failed to create chat session:", error)
    }
  }

  const startListening = () => {
    if (recognition) {
      setIsListening(true)
      recognition.start()
    }
  }

  const stopListening = () => {
    if (recognition) {
      recognition.stop()
      setIsListening(false)
    }
  }

  const authenticateWebsite = async (websiteUrl: string) => {
    try {
      const response = await fetch("/api/auth/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      })

      if (response.ok) {
        const { permissions } = await response.json()
        setWebsitePermissions(permissions)
        setIsAuthenticated(true)
        setIsDeveloperMode(true)
      }
    } catch (error) {
      console.error("Website authentication failed:", error)
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentMessage.trim(),
      isUser: true,
      timestamp: new Date(),
      type: "text",
    }

    setMessages((prev) => [...prev, userMessage])
    setCurrentMessage("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.text,
          sessionId: currentSession?.id,
          context: messages.slice(-5).map((m) => ({ role: m.isUser ? "user" : "assistant", content: m.text })),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Determine message type based on content
      const messageType = data.response.includes("```") ? "code" : "text"

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
        timestamp: new Date(),
        type: messageType,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error("Chat error:", error)
      setError(error instanceof Error ? error.message : "Failed to send message")

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "⚠️ I apologize, but I'm having trouble connecting to my AI services right now. Please check your API configuration and try again.",
        isUser: false,
        timestamp: new Date(),
        type: "error",
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const renderMessage = (message: Message) => {
    if (message.type === "code" && message.text.includes("```")) {
      const parts = message.text.split("```")
      return (
        <div className="space-y-2">
          {parts.map((part, index) => {
            if (index % 2 === 1) {
              // Code block
              const lines = part.split("\n")
              const language = lines[0] || "text"
              const code = lines.slice(1).join("\n")

              return (
                <div key={index} className="bg-slate-950 rounded-lg p-4 border border-blue-500/30 code-block">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="text-xs bg-blue-600/20 text-blue-300">
                      <Code className="w-3 h-3 mr-1" />
                      {language}
                    </Badge>
                  </div>
                  <pre className="text-sm text-green-400 overflow-x-auto font-mono">
                    <code>{code}</code>
                  </pre>
                </div>
              )
            } else {
              // Regular text
              return part.trim() ? (
                <p key={index} className="text-sm whitespace-pre-wrap leading-relaxed">
                  {part.trim()}
                </p>
              ) : null
            }
          })}
        </div>
      )
    }

    return <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header with Status Bar */}
      <div className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm border-b border-blue-500/20">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center pulse-glow">
              <span className="text-white font-bold text-lg">DA</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">DevAssist 4.2.0</h1>
            <p className="text-blue-300 text-sm">AI Development Assistant</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Network Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            <span className="text-xs text-gray-300">{isConnected ? "Online" : "Offline"}</span>
          </div>

          {/* API Health */}
          <div className="flex items-center space-x-2">
            <Activity
              className={`w-4 h-4 ${
                apiHealth === "healthy"
                  ? "text-green-400"
                  : apiHealth === "unhealthy"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            />
            <Badge
              variant={apiHealth === "healthy" ? "default" : "destructive"}
              className={`text-xs ${apiHealth === "healthy" ? "bg-green-600" : apiHealth === "unhealthy" ? "bg-red-600" : "bg-yellow-600"}`}
            >
              Local {apiHealth}
            </Badge>
          </div>

          {/* Session Info */}
          {currentSession && (
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-300">Session Active</span>
            </div>
          )}

          {isDeveloperMode && <Badge className="bg-orange-600 text-white">Developer Mode</Badge>}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-white hover:bg-white/10"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Hero Section with Tech Workspace */}
      <div className="relative">
        <div className="relative h-48 overflow-hidden bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900">
          <div
            className={
              "absolute inset-0 " +
              "bg-[radial-gradient(circle,_rgba(156,146,172,0.10)_2px,_transparent_2px)] " +
              "[background-size:60px_60px] opacity-20"
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Animated code lines */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-blue-300 text-sm font-mono opacity-60 flex items-center justify-center space-x-2">
                <Terminal className="w-4 h-4" />
                <span>{"swift build --configuration release"}</span>
              </div>
              <div className="text-green-300 text-sm font-mono opacity-60">{"✓ Build completed successfully"}</div>
              <div className="text-purple-300 text-sm font-mono opacity-60">{"> DevAssist 4.2.0 Ready"}</div>
            </div>
          </div>

          {/* Live Coding Indicator */}
          <div className="absolute top-4 left-4">
            <Badge className="bg-green-600/80 text-white flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>Local Powered</span>
            </Badge>
          </div>

          {/* Stats Overlay */}
          <div className="absolute bottom-4 left-4 flex space-x-4">
            <div className="bg-black/60 rounded-lg px-3 py-1 backdrop-blur-sm">
              <div className="text-white text-sm font-medium">{messages.length - 1}</div>
              <div className="text-blue-300 text-xs">Messages</div>
            </div>
            <div className="bg-black/60 rounded-lg px-3 py-1 backdrop-blur-sm">
              <div className="text-white text-sm font-medium">{apiHealth === "healthy" ? "99.9%" : "0%"}</div>
              <div className="text-blue-300 text-xs">Uptime</div>
            </div>
          </div>

          {/* Tech Info Overlay */}
          <div className="absolute top-4 right-4">
            <Badge className="bg-blue-600/80 text-white backdrop-blur-sm">Live Development Environment</Badge>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-600/20 border border-red-500/30 p-3 mx-4 mt-2 rounded-lg backdrop-blur-sm">
          <p className="text-red-300 text-sm">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="text-red-300 hover:bg-red-500/20 mt-1"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4 scrollbar-thin">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex items-start space-x-3 max-w-[85%] ${
                    message.isUser ? "flex-row-reverse space-x-reverse" : ""
                  }`}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    {message.isUser ? (
                      <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">You</AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                        DA
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.isUser
                        ? "bg-blue-600 text-white"
                        : message.type === "error"
                          ? "bg-red-900/50 text-red-100 border border-red-500/30"
                          : "bg-gray-800/80 text-gray-100 border border-blue-500/20 backdrop-blur-sm"
                    }`}
                  >
                    {renderMessage(message)}
                    <p
                      className={`text-xs mt-2 ${
                        message.isUser ? "text-blue-100" : message.type === "error" ? "text-red-300" : "text-gray-400"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                      DA
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-800/80 border border-blue-500/20 rounded-2xl px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <div
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">Local engine thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Section */}
        <div className="p-4 bg-black/20 backdrop-blur-sm border-t border-blue-500/20">
          <div className="flex space-x-2">
            <Input
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Ask DevAssist about iOS development, Swift, debugging..."
              className="flex-1 bg-gray-800/50 border-blue-500/30 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-blue-400"
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={isLoading || !isConnected}
              maxLength={1000}
            />
            <Button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading || !isConnected}
              className={`${isListening ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"} text-white px-4`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={sendMessage}
              disabled={!currentMessage.trim() || isLoading || !isConnected}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-400">{currentMessage.length}/1000 characters</span>
            <span className="text-xs text-gray-400">Press Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-gray-900/95 border-blue-500/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>DevAssist Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">API Status</label>
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <span className="text-sm text-gray-300">Local Engine</span>
                  <Badge
                    variant={apiHealth === "healthy" ? "default" : "destructive"}
                    className={apiHealth === "healthy" ? "bg-green-600" : "bg-red-600"}
                  >
                    {apiHealth}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">Session Info</label>
                <div className="p-3 bg-gray-800/50 rounded-lg space-y-1">
                  <div className="text-sm text-gray-300">Session ID: {currentSession?.id?.slice(0, 8) || "None"}</div>
                  <div className="text-sm text-gray-400">Messages: {messages.length - 1}</div>
                  <div className="text-sm text-gray-400">Status: {isConnected ? "Connected" : "Disconnected"}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className="text-sm text-gray-300">Version</span>
                <span className="text-sm text-blue-400 font-mono">4.2.0</span>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                  onClick={() => setShowSettings(false)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    checkAPIHealth()
                    setShowSettings(false)
                  }}
                >
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
