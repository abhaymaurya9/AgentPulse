"use client";

import { useEffect, useState } from "react";
import { getAgents, queryAgent } from "@/lib/api";
import { Send, Terminal, Clock, Zap, MessageSquare, AlertCircle, Loader2 } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
};

export default function PlaygroundPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [customQuestion, setCustomQuestion] = useState("");
  const [queryResponse, setQueryResponse] = useState<{ answer: string; latency_ms: number; token_count?: number } | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgents() {
      try {
        setLoadingAgents(true);
        const data = await getAgents();
        setAgents(data);
        if (data.length > 0) {
          setSelectedAgentId(data[0].id);
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
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleQueryAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || !selectedAgentId) return;

    try {
      setQuerying(true);
      setError(null);
      setQueryResponse(null);
      const res = await queryAgent(selectedAgentId, customQuestion);
      setQueryResponse(res);
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
                  setQueryResponse(null);
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
          <div className="border border-gray-800 bg-gray-950/20 p-6 rounded-xl flex flex-col justify-between min-h-[450px]">
            {/* Console Header */}
            <div className="flex items-center gap-2 border-b border-gray-900 pb-3 mb-4">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              <h2 className="text-md font-bold text-gray-200">
                {selectedAgent ? `${selectedAgent.name} Terminal` : "Interactive Terminal"}
              </h2>
            </div>

            {/* Response Area */}
            <div className="flex-1 flex flex-col justify-center mb-6">
              {queryResponse ? (
                <div className="space-y-4">
                  {/* Response card */}
                  <div className="bg-gray-950/80 border border-gray-850 rounded-lg p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                        Response Output
                      </span>
                      <div className="flex items-center gap-4 text-[10px] font-mono text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Latency: <strong className="text-gray-300">{queryResponse.latency_ms}ms</strong>
                        </span>
                        {queryResponse.token_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Tokens: <strong className="text-gray-300">{queryResponse.token_count}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
                      {queryResponse.answer || "No response content generated."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-600 space-y-2">
                  <div className="text-3xl">💬</div>
                  <p className="text-sm font-medium">No active conversation.</p>
                  <p className="text-xs">Type your question below and click send to query the agent.</p>
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
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-gray-850 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed"
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
