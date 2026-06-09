"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRun, getAgent, getAgentRuns } from "@/lib/api";
import ReplayViewer from "@/components/replay/ReplayViewer";
import ScoreCard from "@/components/ui/ScoreCard";
import DriftBadge from "@/components/ui/DriftBadge";
import { ArrowLeft, PlayCircle, Clock, MessageSquare } from "lucide-react";

function parseUTCDate(dateStr: string | undefined | null): Date {
  if (!dateStr) return new Date();
  return new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
}

type RunDetails = {
  run: {
    id: string;
    agent_id: string;
    run_date: string;
    faithfulness_score: number;
    context_precision: number;
    context_recall: number;
    task_success_rate: number;
    latency_ms: number;
    composite_score: number;
    drift_detected: boolean;
    version?: string;
  } | null;
  traces: {
    id: string;
    step_number: number;
    step_type: string;
    step_input: string;
    step_output: string;
    timestamp: string;
    ground_truth?: string;
  }[];
};

type Agent = {
  id: string;
  name: string;
  model_name: string;
};

export default function RunReplayPage() {
  const params = useParams();
  const agentId = params.id as string;
  const runId = params.runId as string;

  const [details, setDetails] = useState<RunDetails | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runNumber, setRunNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllDetails = async () => {
      if (!runId || !agentId) return;
      try {
        setLoading(true);
        // 1. Fetch Run details & traces
        const runData = await getRun(runId);
        setDetails(runData);

        // 2. Fetch Agent Details for breadcrumbs
        const agentData = await getAgent(agentId);
        setAgent(agentData);

        // 3. Fetch all runs to determine sequential Run number X (oldest first is index + 1)
        const agentRuns = await getAgentRuns(agentId);
        if (agentRuns && agentRuns.length > 0) {
          const sortedRuns = [...agentRuns].reverse(); // oldest first
          const index = sortedRuns.findIndex((r: { id: string }) => r.id === runId);
          if (index !== -1) {
            setRunNumber(index + 1);
          }
        }
      } catch (err) {
        const error = err as Error;
        console.warn("Error fetching run details:", error.message || error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllDetails();
  }, [runId, agentId]);

  // 7.4 Loading skeleton layout
  if (loading && !details) {
    return (
      <div className="space-y-10 animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-gray-900 rounded" />
        <div className="h-4 w-28 bg-gray-900 rounded mt-2" />

        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-900 pb-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-gray-900 rounded-xl" />
              <div className="space-y-2">
                <div className="h-7 w-48 bg-gray-900 rounded" />
                <div className="h-4 w-32 bg-gray-900 rounded" />
              </div>
            </div>
            <div className="h-3 w-40 bg-gray-900 rounded" />
          </div>
          <div className="h-12 w-28 bg-gray-900 rounded-lg" />
        </div>

        {/* 4 Cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-950/20 border border-gray-900 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // 7.5 Error / 404 Run Details Not Found
  if (!details || !details.run) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <div className="max-w-md text-center space-y-5 border border-gray-800 bg-gray-950/20 p-8 rounded-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <span className="text-xl">⚠️</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Evaluation Run Not Found</h2>
            <p className="text-sm text-gray-400">
              The execution run trace history you are looking for does not exist or has been removed from database logs.
            </p>
          </div>
          <Link
            href={`/agents/${agentId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agent Details
          </Link>
        </div>
      </div>
    );
  }

  const { run, traces } = details;

  // Color helper mapping for 0-100 threshold scale
  const getScoreColor = (score: number) => {
    if (score > 70) return "success";
    if (score >= 40) return "warning";
    return "danger";
  };

  return (
    <div className="space-y-10">
      {/* Breadcrumb Navigation: Dashboard → Agent Name → Run #X Replay */}
      <div className="space-y-3">
        <nav className="flex items-center gap-2 text-xs font-bold text-gray-500 tracking-wide font-mono">
          <Link href="/" className="hover:text-white transition">
            DASHBOARD
          </Link>
          <span>/</span>
          {agent ? (
            <Link href={`/agents/${agentId}`} className="hover:text-white transition uppercase">
              {agent.name}
            </Link>
          ) : (
            <span className="uppercase text-gray-700">AGENT</span>
          )}
          <span>/</span>
          <span className="text-indigo-400">RUN #{runNumber} REPLAY</span>
        </nav>
 
        {/* Back navigation button */}
        <div>
          <Link
            href={`/agents/${agentId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agent Details
          </Link>
        </div>
      </div>
 
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-900 pb-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
              <PlayCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
                Execution Replay
                <span className="text-sm font-mono font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                  Run #{runNumber}
                </span>
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Run ID: {run.id}</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1.5 font-mono">
            <Clock className="h-4 w-4 text-gray-500" />
            Executed: {parseUTCDate(run.run_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </div>
        </div>
 
        <div className="flex items-center gap-4">
          <DriftBadge driftDetected={run.drift_detected} />
          <Link
            href={`/playground?agentId=${agentId}&runId=${runId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            Continue Chat
          </Link>
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Composite Score</span>
            <span className="text-2xl font-extrabold text-indigo-400">{run.composite_score.toFixed(2)}</span>
          </div>
        </div>
      </div>
 
      {/* 4 Score Summary Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Run Score Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ScoreCard
            title="Faithfulness"
            value={`${(run.faithfulness_score * 100).toFixed(0)}%`}
            description="Factual alignment of response against ground context."
            color={getScoreColor(run.faithfulness_score * 100)}
            progress={run.faithfulness_score * 100}
          />
          <ScoreCard
            title="Context Precision"
            value={`${(run.context_precision * 100).toFixed(0)}%`}
            description="Relevancy mapping of source items."
            color={getScoreColor(run.context_precision * 100)}
            progress={run.context_precision * 100}
          />
          <ScoreCard
            title="Context Recall"
            value={`${(run.context_recall * 100).toFixed(0)}%`}
            description="Prompt coverage matching benchmarks."
            color={getScoreColor(run.context_recall * 100)}
            progress={run.context_recall * 100}
          />
          <ScoreCard
            title="Task Success"
            value={`${(run.task_success_rate * 100).toFixed(0)}%`}
            description="Final response validation success indicator."
            color={getScoreColor(run.task_success_rate * 100)}
            progress={run.task_success_rate * 100}
          />
        </div>
      </div>

      {/* Interactive Step Accordion Viewer */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-200">Execution Traces Replay</h2>
        <ReplayViewer traces={traces} />
      </div>
    </div>
  );
}
