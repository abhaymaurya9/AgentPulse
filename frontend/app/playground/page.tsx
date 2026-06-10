"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAgents, queryAgent, getRun } from "@/lib/api";
import { Send, Terminal, Clock, Zap, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
};

type Message = {
  role: "user" | "agent";
  content: string;
  latency_ms?: number;
  token_count?: number;
};

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId");
  const initialRunId = searchParams.get("runId");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [customQuestion, setCustomQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch logged in user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Set persistent session ID for the user and agent
  useEffect(() => {
    if (loadingAgents || !selectedAgentId) return;
    if (initialRunId) {
      setSessionId(initialRunId);
    } else {
      const key = `playground_session_${userId || "anonymous"}_${selectedAgentId}`;
      let sid = localStorage.getItem(key);
      if (!sid) {
        sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem(key, sid);
      }
      setSessionId(sid);
    }
  }, [userId, selectedAgentId, loadingAgents, initialRunId]);

  useEffect(() => {
    async function loadAgents() {
      try {
        setLoadingAgents(true);
        const data = await getAgents();
        setAgents(data);
        
        let selectedId = data.length > 0 ? data[0].id : "";
        if (initialAgentId && data.some((a: Agent) => a.id === initialAgentId)) {
          selectedId = initialAgentId;
        }
        setSelectedAgentId(selectedId);

        // If historical run is provided, seed initial chat with its traces
        if (initialRunId && selectedId) {
          try {
            const runData = await getRun(initialRunId);
            if (runData && runData.traces) {
              interface TraceItem {
                step_number: number;
                step_input: string;
                step_output: string;
              }
              const sorted = (runData.traces as TraceItem[]).sort((a, b) => a.step_number - b.step_number);
              const chatHistory = sorted.flatMap((t: TraceItem) => [
                { role: "user" as const, content: t.step_input },
                { role: "agent" as const, content: t.step_output }
              ]);
              setMessages(chatHistory);
            }
          } catch (runErr) {
            console.warn("Failed to load run traces for playground context:", runErr);
          }
        }
      } catch (err) {
        const error = err as Error;
        console.warn("Failed to load agents:", error.message || error);
        setError("Could not load agents. Make sure the backend server is running.");
      } finally {
        setLoadingAgents(false);
      }
    }
    loadAgents();
  }, [initialAgentId, initialRunId]);

  // Smooth scroll to the bottom of the chat list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleQueryAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || !selectedAgentId) return;

    const currentQuestion = customQuestion;
    setCustomQuestion("");

    // Append user message
    const userMessage: Message = { role: "user", content: currentQuestion };
    setMessages((prev) => [...prev, userMessage]);

    try {
      setQuerying(true);
      setError(null);
      
      const res = await queryAgent(selectedAgentId, currentQuestion, sessionId);
      
      // Append agent response
      const agentMessage: Message = {
        role: "agent",
        content: res.answer,
        latency_ms: res.latency_ms,
        token_count: res.token_count,
      };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      const apiError = err as { message?: string; response?: { data?: { detail?: string } } };
      console.warn("Failed to query the agent:", apiError.message || apiError);
      setError(apiError.response?.data?.detail || "Failed to query the agent. Please check connection and try again.");
    } finally {
      setQuerying(false);
    }
  };

  if (loadingAgents) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Terminal className="h-8 w-8 text-indigo-500" />
          Central Agent Playground
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Select any registered RAG agent, inspect its details, and ask custom questions in real-time.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar: Selector & Details */}
        <div className="md:col-span-1 space-y-6">
          {/* Agent Selection Card */}
          <div className="border border-gray-800 bg-gray-950/20 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Select Agent</h2>
            {agents.length === 0 ? (
              <p className="text-xs text-gray-500">No agents registered yet.</p>
            ) : (
              <select
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  setMessages([]);
                  setError(null);
                }}
                className="w-full bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-2.5 text-sm text-white outline-none transition cursor-pointer"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Agent Details Card */}
          {selectedAgent && (
            <div className="border border-gray-855 bg-gray-950/10 p-5 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Agent Configuration</h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Model</div>
                  <div className="text-sm text-indigo-400 font-mono font-medium">{selectedAgent.model_name}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Endpoint URL</div>
                  <div className="text-xs text-gray-300 font-mono truncate hover:text-white transition" title={selectedAgent.endpoint_url}>
                    {selectedAgent.endpoint_url}
                  </div>
                </div>
                <div className="space-y-1 pt-1 border-t border-gray-900">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Description</div>
                  <div className="text-xs text-gray-400 leading-relaxed">{selectedAgent.description}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat / Console Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="border border-gray-800 bg-gray-950/20 p-6 rounded-xl flex flex-col justify-between min-h-[500px]">
            {/* Console Header */}
            <div className="flex items-center justify-between border-b border-gray-900 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-400" />
                <h2 className="text-md font-bold text-gray-200">
                  {selectedAgent ? `${selectedAgent.name} Terminal` : "Interactive Terminal"}
                </h2>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    const newSid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    const key = `playground_session_${userId || "anonymous"}_${selectedAgentId}`;
                    localStorage.setItem(key, newSid);
                    setSessionId(newSid);
                  }}
                  className="cursor-pointer text-[10px] uppercase font-bold text-rose-400 hover:text-rose-300 px-2.5 py-1 bg-rose-500/10 border border-rose-500/15 rounded-md transition"
                >
                  Clear Chat
                </button>
              )}
            </div>

            {/* Response Area / Message Thread */}
            <div className="flex-1 flex flex-col justify-start max-h-[380px] overflow-y-auto pr-2 space-y-4 mb-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        msg.role === "user" ? "items-end" : "items-start"
                      } space-y-1`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-none"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                      {msg.role === "agent" && (
                        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 px-2">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {msg.latency_ms}ms
                          </span>
                          {msg.token_count !== undefined && (
                            <span className="flex items-center gap-0.5">
                              <Zap className="h-3 w-3" />
                              {msg.token_count} tokens
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center py-10 text-gray-600 space-y-2">
                  <div className="text-3xl">💬</div>
                  <p className="text-sm font-medium">No active conversation.</p>
                  <p className="text-xs max-w-xs">
                    Type your question below and click send to initiate a continuous chat session.
                  </p>
                </div>
              )}
            </div>

            {/* Query Input form */}
            <form onSubmit={handleQueryAgent} className="flex gap-3 mt-auto pt-4 border-t border-gray-900">
              <input
                type="text"
                disabled={querying || !selectedAgentId}
                className="flex-1 bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none transition disabled:opacity-50"
                placeholder={selectedAgent ? `Ask ${selectedAgent.name} a question...` : "Select an agent first..."}
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
              />
              <button
                type="submit"
                disabled={querying || !customQuestion.trim() || !selectedAgentId}
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-gray-855 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed"
              >
                {querying ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    }>
      <PlaygroundContent />
    </Suspense>
  );
}
