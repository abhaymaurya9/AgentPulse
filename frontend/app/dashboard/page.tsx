"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgents, getAgentRuns, triggerEvaluation } from "@/lib/api";
import ScoreCard from "@/components/ui/ScoreCard";
import DriftBadge from "@/components/ui/DriftBadge";
import {
  Play,
  Plus,
  RefreshCw,
  Users,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Eye,
  AlertCircle,
} from "lucide-react";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
};

type Run = {
  id: string;
  run_date: string;
  composite_score: number;
  drift_detected: boolean;
};

type AgentWithStats = Agent & {
  lastScore: number | string;
  driftDetected: boolean;
  totalRuns: number;
  lastEvaluated: string | null;
  evaluating?: boolean;
};

export default function Dashboard() {
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState({
    totalAgents: 0,
    totalRuns: 0,
    avgCompositeScore: 0,
    driftCount: 0,
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const agentList: Agent[] = await getAgents();

      let totalRunsCount = 0;
      let driftCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;

      const agentsWithStats: AgentWithStats[] = await Promise.all(
        agentList.map(async (agent) => {
          try {
            const runs: Run[] = await getAgentRuns(agent.id);
            totalRunsCount += runs.length;

            const latestRun = runs[0]; // Ordered desc by default
            const lastScore = latestRun ? latestRun.composite_score : "N/A";
            const driftDetected = latestRun ? latestRun.drift_detected : false;
            const lastEvaluated = latestRun ? latestRun.run_date : null;

            if (driftDetected) {
              driftCount += 1;
            }

            if (latestRun && typeof latestRun.composite_score === "number") {
              scoreSum += latestRun.composite_score;
              scoreCount += 1;
            }

            return {
              ...agent,
              lastScore,
              driftDetected,
              totalRuns: runs.length,
              lastEvaluated,
            };
          } catch (err) {
            console.error(`Error loading stats for agent ${agent.id}:`, err);
            return {
              ...agent,
              lastScore: "N/A",
              driftDetected: false,
              totalRuns: 0,
              lastEvaluated: null,
            };
          }
        })
      );

      setAgents(agentsWithStats);
      setGlobalStats({
        totalAgents: agentList.length,
        totalRuns: totalRunsCount,
        avgCompositeScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
        driftCount,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Something went wrong. Could not fetch dashboard data. Please check that the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleEvaluate = async (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, evaluating: true } : a))
    );
    try {
      await triggerEvaluation(agentId);
      alert("Evaluation triggered successfully! Refreshing in 3 seconds.");
      setTimeout(fetchDashboardData, 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to trigger evaluation run.");
    } finally {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, evaluating: false } : a))
      );
    }
  };

  // 7.4 Loading skeleton layout
  if (loading && agents.length === 0) {
    return (
      <div className="space-y-10 animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-900 pb-6">
          <div className="space-y-2">
            <div className="h-8 w-60 bg-gray-900 rounded" />
            <div className="h-4 w-80 bg-gray-900 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-gray-900 rounded-lg" />
            <div className="h-10 w-44 bg-gray-900 rounded-lg" />
          </div>
        </div>

        {/* 4 Stats Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-gray-900 bg-gray-950/20 p-6 rounded-xl space-y-4">
              <div className="h-4 w-24 bg-gray-900 rounded" />
              <div className="h-8 w-16 bg-gray-900 rounded" />
              <div className="h-3 w-40 bg-gray-900 rounded" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-36 bg-gray-900 rounded" />
          <div className="border border-gray-900 rounded-xl bg-gray-950/20 overflow-hidden">
            <div className="h-10 bg-gray-900/40 border-b border-gray-900" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 border-b border-gray-900/50 flex items-center justify-between px-4 gap-4">
                <div className="h-4 w-1/4 bg-gray-900 rounded" />
                <div className="h-4 w-1/6 bg-gray-900 rounded" />
                <div className="h-4 w-12 bg-gray-900 rounded" />
                <div className="h-4 w-1/6 bg-gray-900 rounded" />
                <div className="h-4 w-14 bg-gray-900 rounded animate-pulse" />
                <div className="h-8 w-36 bg-gray-900 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && agents.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="h-7 w-7 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Evaluator Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time status, accuracy scoring, and drift metrics across active agents.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboardData}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-gray-800 hover:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/agents/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            Register New Agent
          </Link>
        </div>
      </div>

      {/* 4 Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ScoreCard
          title="Total Agents"
          value={globalStats.totalAgents}
          description="Total registered RAG agents and AI pipelines."
          color="indigo"
          icon={<Users className="h-5 w-5" />}
        />
        <ScoreCard
          title="Total Evaluations"
          value={globalStats.totalRuns}
          description="Completed evaluation runs across all agents."
          color="emerald"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <ScoreCard
          title="Avg Composite Score"
          value={globalStats.avgCompositeScore > 0 ? globalStats.avgCompositeScore.toFixed(1) : "N/A"}
          description="Average composite score across latest agent runs."
          color="amber"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <ScoreCard
          title="Drift Alerts"
          value={globalStats.driftCount}
          description="Agents showing accuracy drift ≥ 10% since previous run."
          color={globalStats.driftCount > 0 ? "rose" : "emerald"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* Agents Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-gray-200">
          Monitored Agents
        </h2>

        {agents.length === 0 ? (
          /* Empty state */
          <div className="border border-dashed border-gray-800 rounded-xl p-14 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <Users className="h-7 w-7 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white">No agents registered yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Register your first agent to start running evaluations and monitoring performance.
            </p>
            <Link
              href="/agents/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              Register Your First Agent
            </Link>
          </div>
        ) : (
          /* Agents Table */
          <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-950/20">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold">
                  <th className="p-4">Agent Name</th>
                  <th className="p-4">Model Used</th>
                  <th className="p-4">Latest Score</th>
                  <th className="p-4">Last Evaluated</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900">
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="hover:bg-gray-900/30 text-gray-300 transition duration-150"
                  >
                    {/* Agent Name — clickable */}
                    <td className="p-4">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="font-bold text-white hover:text-indigo-400 transition"
                      >
                        {agent.name}
                      </Link>
                    </td>

                    {/* Model Used */}
                    <td className="p-4 font-mono text-xs text-gray-400">
                      {agent.model_name}
                    </td>

                    {/* Latest Composite Score */}
                    <td className="p-4">
                      <span className="font-extrabold text-indigo-400 text-lg">
                        {typeof agent.lastScore === "number"
                          ? agent.lastScore.toFixed(2)
                          : agent.lastScore}
                      </span>
                    </td>

                    {/* Last Evaluated Date */}
                    <td className="p-4 text-xs text-gray-400">
                      {agent.lastEvaluated
                        ? new Date(agent.lastEvaluated).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </td>

                    {/* Drift Status */}
                    <td className="p-4">
                      <DriftBadge driftDetected={agent.driftDetected} size="sm" />
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/agents/${agent.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/20 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </Link>
                        <button
                          onClick={() => handleEvaluate(agent.id)}
                          disabled={agent.evaluating}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 disabled:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm shadow-indigo-600/10 disabled:cursor-not-allowed"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {agent.evaluating ? "Running..." : "Evaluate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
