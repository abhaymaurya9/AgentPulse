"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAgent, getAgentRuns, triggerEvaluation, queryAgent } from "@/lib/api";
import ScoreCard from "@/components/ui/ScoreCard";
import DriftBadge from "@/components/ui/DriftBadge";
import EvolutionGraph from "@/components/charts/EvolutionGraph";
import { Cpu, ExternalLink, Play, ArrowLeft, BarChart2, Calendar, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
  created_at?: string;
};

type Run = {
  id: string;
  run_date: string;
  faithfulness_score: number;
  context_precision: number;
  context_recall: number;
  latency_ms: number;
  token_cost: number;
  task_success_rate: number;
  answer_quality: number;
  composite_score: number;
  drift_detected: boolean;
};

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalSuccess, setEvalSuccess] = useState(false);

  const [customQuestion, setCustomQuestion] = useState("");
  const [queryResponse, setQueryResponse] = useState<{ answer: string; latency_ms: number; token_count?: number } | null>(null);
  const [querying, setQuerying] = useState(false);

  // References to keep track of polling to clean up on unmount
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleQueryAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || !id) return;
    try {
      setQuerying(true);
      setQueryResponse(null);
      const res = await queryAgent(id, customQuestion);
      setQueryResponse(res);
    } catch (err) {
      console.error(err);
      alert("Failed to query the agent.");
    } finally {
      setQuerying(false);
    }
  };

  const fetchAgentData = async (showLoading = true) => {
    if (!id) return;
    try {
      if (showLoading) setLoading(true);
      const agentDetails = await getAgent(id);
      const runsDetails = await getAgentRuns(id);
      setAgent(agentDetails);
      setRuns(runsDetails);
    } catch (err) {
      console.error("Error fetching agent details:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [id]);

  const handleEvaluate = async () => {
    if (!id) return;
    try {
      setEvaluating(true);
      setEvalSuccess(false);

      const initialRunsLength = runs.length;
      await triggerEvaluation(id);

      // Start polling for new run insertion
      let attempts = 0;
      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const updatedRuns = await getAgentRuns(id);
          if (updatedRuns.length > initialRunsLength || attempts >= 20) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setRuns(updatedRuns);
            setEvaluating(false);
            if (updatedRuns.length > initialRunsLength) {
              setEvalSuccess(true);
              // Hide success message after 5 seconds
              setTimeout(() => setEvalSuccess(false), 5000);
            } else {
              alert("Evaluation timed out. Please check historical table in a few moments.");
            }
          }
        } catch (err) {
          console.error("Error polling evaluation runs:", err);
        }
      }, 3000);

    } catch (err) {
      console.error(err);
      alert("Failed to trigger evaluation run.");
      setEvaluating(false);
    }
  };

  // 7.4 Loading skeleton layout
  if (loading && !agent) {
    return (
      <div className="space-y-10 animate-pulse">
        {/* Back navigation skeleton */}
        <div className="h-4 w-28 bg-gray-900 rounded" />

        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-gray-900 pb-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-gray-900 rounded-xl" />
              <div className="space-y-2">
                <div className="h-7 w-48 bg-gray-900 rounded" />
                <div className="h-4 w-24 bg-gray-900 rounded" />
              </div>
            </div>
            <div className="h-4 w-5/6 bg-gray-900 rounded" />
            <div className="h-3 w-1/2 bg-gray-900 rounded" />
          </div>
          <div className="h-10 w-40 bg-gray-900 rounded-lg" />
        </div>

        {/* 6 Score Cards Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 md:row-span-2 h-48 bg-gray-950/20 border border-gray-900 rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-gray-950/20 border border-gray-900 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // 7.5 Error / 404 Agent Not Found State
  if (!agent) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <div className="max-w-md text-center space-y-5 border border-gray-800 bg-gray-950/20 p-8 rounded-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="h-7 w-7 text-rose-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Agent Not Found</h2>
            <p className="text-sm text-gray-400">
              The AI Agent pipeline configuration you are looking for does not exist or has been deleted from Supabase.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const latestRun = runs[0];

  // Helper functions for dynamic metric card styling based on 0-100 threshold guidelines
  const getScoreColor = (score: number) => {
    if (score > 70) return "emerald";
    if (score >= 40) return "amber";
    return "rose";
  };

  const getLatencyScore = (latencyMs: number) => {
    // 0ms = 100%, 10,000ms = 0%
    return Math.max(0, Math.min(100, 100 - latencyMs / 100));
  };

  const getLatencyColor = (latencyMs: number) => {
    if (latencyMs < 2000) return "emerald";
    if (latencyMs < 5000) return "amber";
    return "rose";
  };

  // Evolution Stats aggregation calculations
  const totalRuns = runs.length;
  const bestScore = totalRuns > 0 ? Math.max(...runs.map((r) => r.composite_score)) : 0;
  const worstScore = totalRuns > 0 ? Math.min(...runs.map((r) => r.composite_score)) : 0;
  const avgScore = totalRuns > 0 ? runs.reduce((sum, r) => sum + r.composite_score, 0) / totalRuns : 0;

  return (
    <div className="space-y-10">
      {/* Back to dashboard navigation */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Success alert banner */}
      {evalSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3.5 rounded-xl flex items-center justify-between text-sm shadow-lg shadow-emerald-500/5 animate-fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>Evaluation Complete! The latest metrics have been updated.</span>
          </div>
          <button onClick={() => setEvalSuccess(false)} className="hover:text-white transition text-xs font-bold px-1.5 py-0.5 rounded hover:bg-gray-800">
            Dismiss
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-gray-900 pb-6">
        <div className="space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
                {agent.name}
              </h1>
              <p className="text-sm font-mono text-indigo-400 mt-0.5">{agent.model_name}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">{agent.description}</p>
          <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-500">
            <div className="flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Endpoint:</span>
              <a href={agent.endpoint_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-400">
                {agent.endpoint_url}
              </a>
            </div>
            <div className="flex items-center gap-1 border-l border-gray-800 pl-4">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <span>Registered:</span>
              <span className="text-gray-400">
                {agent.created_at
                  ? new Date(agent.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "June 8, 2026"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 min-w-[170px]">
          {latestRun && <DriftBadge driftDetected={latestRun.drift_detected} />}
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className={clsx(
              "w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition shadow-md disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed",
              evaluating 
                ? "bg-gray-800"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10"
            )}
          >
            <Play className={clsx("h-4 w-4", evaluating && "animate-pulse")} />
            {evaluating ? "Running..." : "Run Evaluation"}
          </button>
        </div>
      </div>

      {/* Accuracy / Score Summary Metrics (using latest run) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-400" />
          Latest Performance Metrics
        </h2>
        {latestRun ? (
          /* Grid puzzle layout: Composite Score spans 2 columns & 2 rows */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 md:row-span-2 h-full">
              <ScoreCard 
                title="Composite Score" 
                value={latestRun.composite_score.toFixed(2)} 
                description="Aggregated master index weighted on factual accuracy, latency responsiveness, and prompt cost efficiency metrics." 
                color={getScoreColor(latestRun.composite_score)}
                progress={latestRun.composite_score}
              />
            </div>
            <ScoreCard 
              title="Faithfulness Score" 
              value={(latestRun.faithfulness_score * 100).toFixed(1)} 
              description="Factual consistency of agent output answers matched against context." 
              color={getScoreColor(latestRun.faithfulness_score * 100)}
              progress={latestRun.faithfulness_score * 100}
            />
            <ScoreCard 
              title="Context Precision" 
              value={(latestRun.context_precision * 100).toFixed(1)} 
              description="Signal relevancy check mapping retrieved context items." 
              color={getScoreColor(latestRun.context_precision * 100)}
              progress={latestRun.context_precision * 100}
            />
            <ScoreCard 
              title="Context Recall" 
              value={(latestRun.context_recall * 100).toFixed(1)} 
              description="Determining alignment of ground truth items in prompt." 
              color={getScoreColor(latestRun.context_recall * 100)}
              progress={latestRun.context_recall * 100}
            />
            <ScoreCard 
              title="Task Success Rate" 
              value={(latestRun.task_success_rate * 100).toFixed(1)} 
              description="Matching finalized response output against benchmarks." 
              color={getScoreColor(latestRun.task_success_rate * 100)}
              progress={latestRun.task_success_rate * 100}
            />
            <ScoreCard 
              title="Avg Latency (ms)" 
              value={`${latestRun.latency_ms}ms`} 
              description="Fulfill execution response duration tracked per prompt query node." 
              color={getLatencyColor(latestRun.latency_ms)}
              progress={getLatencyScore(latestRun.latency_ms)}
            />
          </div>
        ) : (
          <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center text-gray-500">
            No metrics available yet. Execute "Run Evaluation" to generate.
          </div>
        )}
      </div>

      {/* Evolution Line Chart Graph & Summary Panel */}
      {runs.length > 0 && (
        <div className="space-y-4">
          <div>
            <EvolutionGraph data={runs} agentName={agent.name} />
          </div>
          
          {/* Statistical aggregations panel below graph */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-950/20 border border-gray-850 p-5 rounded-xl">
            <div className="text-center p-2">
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Runs</div>
              <div className="text-2xl font-extrabold text-white mt-1">{totalRuns}</div>
            </div>
            <div className="text-center p-2 border-l border-gray-900">
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Best Score</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">{bestScore.toFixed(2)}</div>
            </div>
            <div className="text-center p-2 border-l border-gray-900">
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Worst Score</div>
              <div className="text-2xl font-extrabold text-rose-400 mt-1">{worstScore.toFixed(2)}</div>
            </div>
            <div className="text-center p-2 border-l border-gray-900">
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Average Score</div>
              <div className="text-2xl font-extrabold text-indigo-400 mt-1">{avgScore.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Playground Section */}
      <div className="border border-gray-800 bg-gray-950/20 p-6 rounded-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
              💬
            </span>
            Agent Playground
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Test this RAG agent's response and latency with custom questions directly from the UI.
          </p>
        </div>

        <form onSubmit={handleQueryAgent} className="flex gap-3">
          <input
            type="text"
            className="flex-1 bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none transition"
            placeholder="Type your question for the agent..."
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            disabled={querying}
          />
          <button
            type="submit"
            disabled={querying || !customQuestion.trim()}
            className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-850 px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed"
          >
            {querying ? "Querying..." : "Send Question"}
          </button>
        </form>

        {queryResponse && (
          <div className="mt-4 bg-gray-950 border border-gray-850 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-850 pb-2">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                Response Output
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                <span>Latency: <strong className="text-gray-300">{queryResponse.latency_ms}ms</strong></span>
                {queryResponse.token_count !== undefined && (
                  <span>Tokens: <strong className="text-gray-300">{queryResponse.token_count}</strong></span>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
              {queryResponse.answer || "No response content generated."}
            </div>
          </div>
        )}
      </div>

      {/* Historical Evaluation Runs list */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-200">Historical Runs</h2>
        <div className="overflow-x-auto border border-gray-850 rounded-xl bg-gray-950/20">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-850 bg-gray-900/40 text-gray-400 font-semibold">
                <th className="p-4">Run #</th>
                <th className="p-4">Date / Time</th>
                <th className="p-4">Composite Score</th>
                <th className="p-4">Faithfulness</th>
                <th className="p-4">Latency</th>
                <th className="p-4">Drift Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/40">
              {runs.map((run, idx) => {
                const isLatest = idx === 0;
                const isDrift = run.drift_detected;

                return (
                  <tr 
                    key={run.id} 
                    className={clsx(
                      "transition duration-150",
                      isDrift 
                        ? "bg-rose-950/10 hover:bg-rose-950/20 text-rose-200/90" 
                        : isLatest 
                          ? "bg-indigo-950/10 hover:bg-indigo-950/20 font-semibold text-indigo-200" 
                          : "hover:bg-gray-900/10 text-gray-300"
                    )}
                  >
                    <td className="p-4 font-mono text-xs">
                      #{runs.length - idx}
                    </td>
                    <td className="p-4 font-medium">
                      {new Date(run.run_date).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className={clsx("p-4 font-bold", isLatest ? "text-indigo-400" : "text-gray-200")}>
                      {run.composite_score.toFixed(2)}
                    </td>
                    <td className="p-4">
                      {(run.faithfulness_score * 100).toFixed(0)}%
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {run.latency_ms}ms
                    </td>
                    <td className="p-4">
                      <span className={clsx(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border",
                        isDrift
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      )}>
                        {isDrift ? "Drift" : "No Drift"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/agents/${id}/runs/${run.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/20 px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition"
                      >
                        View Replay
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No runs logged for this agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
