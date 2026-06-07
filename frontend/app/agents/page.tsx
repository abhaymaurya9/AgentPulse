"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgents, getAgentRuns, triggerEvaluation } from "@/lib/api";
import { Cpu, ExternalLink, Activity, ArrowRight, Play, Plus, RefreshCw, AlertCircle } from "lucide-react";
import DriftBadge from "@/components/ui/DriftBadge";
import clsx from "clsx";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
};

type AgentWithRunCount = Agent & {
  totalRuns: number;
  lastScore: number | string;
  driftDetected: boolean;
  evaluating?: boolean;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithRunCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentsList = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const list: Agent[] = await getAgents();
      const data = await Promise.all(
        list.map(async (agent) => {
          try {
            const runs = await getAgentRuns(agent.id);
            const latest = runs[0];
            return {
              ...agent,
              totalRuns: runs.length,
              lastScore: latest ? latest.composite_score : "N/A",
              driftDetected: latest ? latest.drift_detected : false,
            };
          } catch (err) {
            console.error(`Error loading runs for agent ${agent.id}:`, err);
            return {
              ...agent,
              totalRuns: 0,
              lastScore: "N/A",
              driftDetected: false,
            };
          }
        })
      );
      setAgents(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load agents. Please check if the backend service is running.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentsList();
  }, []);

  const handleEvaluate = async (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, evaluating: true } : a))
    );
    try {
      await triggerEvaluation(agentId);
      alert("Evaluation triggered successfully! Refreshing in 3 seconds.");
      setTimeout(() => fetchAgentsList(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to trigger evaluation run.");
    } finally {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, evaluating: false } : a))
      );
    }
  };

  // 7.4 Loading Skeletons
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between border-b border-gray-900 pb-6">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-900 rounded" />
            <div className="h-4 w-72 bg-gray-900 rounded" />
          </div>
          <div className="h-10 w-32 bg-gray-900 rounded-lg" />
        </div>

        {/* Card list skeletons */}
        <div className="space-y-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="border border-gray-900 bg-gray-950/20 p-6 rounded-xl flex flex-col lg:flex-row justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-900 rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-5 w-36 bg-gray-900 rounded" />
                    <div className="h-3.5 w-24 bg-gray-900 rounded" />
                  </div>
                </div>
                <div className="h-4 w-5/6 bg-gray-900 rounded" />
                <div className="h-3 w-1/2 bg-gray-900 rounded" />
              </div>
              <div className="w-48 bg-gray-900/10 rounded-lg h-24 lg:h-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 7.5 Error State
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="h-7 w-7 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={() => fetchAgentsList(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Agents Catalog
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Complete listing of all registered active pipelines, LLM endpoints, and model weights.
          </p>
        </div>
        <div>
          <Link
            href="/agents/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            Register Agent
          </Link>
        </div>
      </div>

      {/* Agents Listing Cards */}
      <div className="grid grid-cols-1 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col lg:flex-row justify-between lg:items-center rounded-xl border border-gray-800 bg-gray-950/20 p-6 gap-6 hover:border-gray-750 hover:bg-gray-950/40 transition duration-300"
          >
            {/* Left Column: General Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {agent.name}
                  </h3>
                  <p className="text-xs font-mono text-indigo-400">
                    {agent.model_name}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
                {agent.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  ID: <span className="text-gray-400">{agent.id}</span>
                </span>
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  URL:{" "}
                  <a
                    href={agent.endpoint_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-indigo-400"
                  >
                    {agent.endpoint_url}
                  </a>
                </span>
              </div>
            </div>

            {/* Right Column: Performance Stats and Badges */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 lg:justify-end">
              <div className="grid grid-cols-2 gap-6 border-l border-r border-gray-900 px-6 max-sm:border-x-0 max-sm:px-0">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total Runs</p>
                  <p className="text-2xl font-black text-gray-300 mt-1">{agent.totalRuns}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Accuracy Score</p>
                  <p className="text-2xl font-black text-indigo-400 mt-1">
                    {typeof agent.lastScore === "number" ? agent.lastScore.toFixed(1) : agent.lastScore}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-3 justify-center min-w-[170px]">
                <DriftBadge driftDetected={agent.driftDetected} />
                <div className="flex gap-2 w-full">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex-1 text-center justify-center inline-flex items-center gap-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/10 hover:bg-gray-900/40 px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => handleEvaluate(agent.id)}
                    disabled={agent.evaluating}
                    className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-850 px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed"
                  >
                    <Play className={clsx("h-3.5 w-3.5", agent.evaluating && "animate-pulse")} />
                    {agent.evaluating ? "..." : ""}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-xl p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">No agents yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Register your first RAG agent pipeline and start benchmark evaluation tracking today.
            </p>
            <Link
              href="/agents/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              Register Your First Agent
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
