"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgents, getAgentRuns, triggerEvaluation } from "@/lib/api";
import { useRouter } from "next/navigation";
import clsx from "clsx";
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
  X,
  Loader2,
} from "lucide-react";

function parseUTCDate(dateStr: string | undefined | null): Date {
  if (!dateStr) return new Date();
  return new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
}

function getScoreColorClass(score: number | string) {
  if (typeof score !== "number") return "text-gray-500 font-semibold";
  if (score > 70) return "text-success font-extrabold";
  if (score >= 40) return "text-warning font-extrabold";
  return "text-danger font-extrabold";
}

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
  drift_reason?: string;
  version?: string;
};

type AgentWithStats = Agent & {
  lastScore: number | string;
  driftDetected: boolean;
  driftReason?: string;
  totalRuns: number;
  lastEvaluated: string | null;
  evaluating?: boolean;
};

type DriftEvent = {
  runId: string;
  agentId: string;
  agentName: string;
  runDate: string;
  compositeScore: number;
  driftReason: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDriftModal, setShowDriftModal] = useState(false);
  const [driftEvents, setDriftEvents] = useState<DriftEvent[]>([]);
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
      const gatheredDriftEvents: DriftEvent[] = [];

      const agentsWithStats: AgentWithStats[] = await Promise.all(
        agentList.map(async (agent) => {
          try {
            const runs: Run[] = await getAgentRuns(agent.id);
            totalRunsCount += runs.length;

            const latestRun = runs[0]; // Ordered desc by default
            const lastScore = latestRun ? latestRun.composite_score : "N/A";
            const driftDetected = latestRun ? latestRun.drift_detected : false;
            const driftReason = latestRun ? latestRun.drift_reason : undefined;
            const lastEvaluated = latestRun ? latestRun.run_date : null;

            if (driftDetected) {
              driftCount += 1;
            }

            if (latestRun && typeof latestRun.composite_score === "number") {
              scoreSum += latestRun.composite_score;
              scoreCount += 1;
            }

            // Gather all historical drift runs from this agent for the dashboard summary modal
            runs.forEach((run) => {
              if (run.drift_detected) {
                gatheredDriftEvents.push({
                  runId: run.id,
                  agentId: agent.id,
                  agentName: agent.name,
                  runDate: run.run_date,
                  compositeScore: run.composite_score,
                  driftReason: run.drift_reason || "General performance drop",
                });
              }
            });

            return {
              ...agent,
              lastScore,
              driftDetected,
              driftReason,
              totalRuns: runs.length,
              lastEvaluated,
            };
          } catch (err) {
            const error = err as Error;
            console.warn(`Error loading stats for agent ${agent.id}:`, error.message || error);
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

      // Sort drift events newest first
      gatheredDriftEvents.sort((a, b) => parseUTCDate(b.runDate).getTime() - parseUTCDate(a.runDate).getTime());

      setAgents(agentsWithStats);
      setDriftEvents(gatheredDriftEvents);
      setGlobalStats({
        totalAgents: agentList.length,
        totalRuns: totalRunsCount,
        avgCompositeScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
        driftCount,
      });
    } catch (err) {
      const error = err as Error;
      console.warn("Error fetching dashboard data:", error.message || error);
      setError("Something went wrong. Could not fetch dashboard data. Please check that the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const error = err as Error;
      console.warn("Failed to trigger evaluation run:", error.message || error);
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

  // 7.5 Error State
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
    <div className="space-y-10 relative">
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
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-card/25 hover:bg-card/45 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/agents/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 shadow-md shadow-primary/10 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Register New Agent
          </Link>
        </div>
      </div>

      {/* 4 Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <ScoreCard
          title="Total Agents"
          value={globalStats.totalAgents}
          description="Total registered RAG agents and AI pipelines."
          color="primary"
          icon={<Users className="h-5 w-5" />}
        />
        <ScoreCard
          title="Total Evaluations"
          value={globalStats.totalRuns}
          description="Completed evaluation runs across all agents."
          color="success"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <ScoreCard
          title="Avg Composite Score"
          value={globalStats.avgCompositeScore > 0 ? globalStats.avgCompositeScore.toFixed(1) : "N/A"}
          description="Average composite score across latest agent runs."
          color={globalStats.avgCompositeScore > 0 ? (globalStats.avgCompositeScore > 70 ? "success" : globalStats.avgCompositeScore >= 40 ? "warning" : "danger") : "primary"}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        {/* Clickable Drift Alerts Card */}
        <ScoreCard
          title="Drift Alerts"
          value={globalStats.driftCount}
          description="Agents showing accuracy drift ≥ 10% since previous run."
          color={globalStats.driftCount > 0 ? "danger" : "success"}
          icon={<AlertTriangle className="h-5 w-5" />}
          onClick={globalStats.driftCount > 0 ? () => setShowDriftModal(true) : undefined}
        />
      </div>

      {/* Agents Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-gray-200">
          Monitored Agents
        </h2>

        {agents.length === 0 ? (
          /* Empty state */
          <div className="border border-dashed border-gray-800 rounded-xl p-14 text-center space-y-4 bg-card/10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-white">No Monitored Agents Yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Register your first agent to begin tracking accuracy, latency, and drift metrics.
            </p>
            <Link
              href="/agents/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 shadow-md shadow-primary/10 cursor-pointer"
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
              <tbody className="divide-y divide-gray-900/60">
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button")) {
                        return;
                      }
                      router.push(`/agents/${agent.id}`);
                    }}
                    className="cursor-pointer hover:bg-card/35 even:bg-card/10 text-gray-300 transition-all duration-200"
                  >
                    {/* Agent Name — clickable */}
                    <td className="p-4">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="font-bold text-white hover:text-primary transition"
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
                      <span className={clsx("text-lg", getScoreColorClass(agent.lastScore))}>
                        {typeof agent.lastScore === "number"
                          ? agent.lastScore.toFixed(2)
                          : agent.lastScore}
                      </span>
                    </td>

                    {/* Last Evaluated Date */}
                    <td className="p-4 text-xs text-gray-400">
                      {agent.lastEvaluated
                        ? parseUTCDate(agent.lastEvaluated).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </td>

                    {/* Drift Status with Tooltip */}
                    <td className="p-4">
                      <div className="group relative inline-block">
                        <DriftBadge driftDetected={agent.driftDetected} size="sm" />
                        {agent.driftDetected && (
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-950 border border-gray-800 text-gray-200 text-[10px] rounded p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-xl z-50 leading-relaxed font-sans font-medium whitespace-normal">
                            {agent.driftReason || "General performance drop"}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950" />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/agents/${agent.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-800 hover:border-gray-700 bg-card/40 hover:bg-card px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-all duration-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </Link>
                        <button
                          onClick={() => handleEvaluate(agent.id)}
                          disabled={agent.evaluating}
                          className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-gray-850 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 shadow-sm shadow-primary/10 disabled:cursor-not-allowed min-w-[88px] justify-center"
                        >
                          {agent.evaluating ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Running</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" />
                              <span>Evaluate</span>
                            </>
                          )}
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

      {/* 1.6 Global Drift Events Summary Modal */}
      {showDriftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-gray-950 border border-gray-800 rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-850">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <h3 className="text-lg font-bold text-white">System Drift Events</h3>
              </div>
              <button
                onClick={() => setShowDriftModal(false)}
                className="cursor-pointer text-gray-400 hover:text-white transition rounded p-1 hover:bg-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {driftEvents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No historical drift runs logged in database yet.
                </p>
              ) : (
                <div className="overflow-x-auto border border-gray-850 rounded-lg bg-gray-950/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-850 bg-gray-900/60 text-gray-400 font-bold uppercase tracking-wider">
                        <th className="p-3">Agent</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3">Drift Reason</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900/60">
                      {driftEvents.map((event) => (
                        <tr key={event.runId} className="hover:bg-gray-900/20 text-gray-300">
                          <td className="p-3 font-semibold text-white">
                            {event.agentName}
                          </td>
                          <td className="p-3 font-mono">
                            {parseUTCDate(event.runDate).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3 text-center font-bold text-rose-400">
                            {event.compositeScore.toFixed(2)}
                          </td>
                          <td className="p-3 text-rose-300/90 font-medium">
                            {event.driftReason}
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/agents/${event.agentId}/runs/${event.runId}`}
                              onClick={() => setShowDriftModal(false)}
                              className="inline-flex items-center gap-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400 transition"
                            >
                              Replay Traces
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-850 bg-gray-900/20 flex justify-end">
              <button
                onClick={() => setShowDriftModal(false)}
                className="cursor-pointer rounded-lg border border-gray-850 bg-transparent hover:bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
