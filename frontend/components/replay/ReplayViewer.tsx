"use client";

import { useState } from "react";
import { HelpCircle, Code, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import clsx from "clsx";

type Trace = {
  id: string;
  step_number: number;
  step_type: string;
  step_input: string;
  step_output: string;
  timestamp: string;
  ground_truth?: string;
};

type ReplayViewerProps = {
  traces: Trace[];
};

export default function ReplayViewer({ traces }: ReplayViewerProps) {
  // Collapsed by default (empty state maps to collapsed)
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (stepNumber: number) => {
    setOpenSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const expandAll = () => {
    const allOpen: Record<number, boolean> = {};
    traces.forEach((t) => {
      allOpen[t.step_number] = true;
    });
    setOpenSteps(allOpen);
  };

  const collapseAll = () => {
    setOpenSteps({});
  };

  // Helper to calculate keyword overlap score
  const getOverlapScore = (answer: string, expected: string): number => {
    if (!answer || !expected) return 0;
    
    const cleanWords = (text: string) => 
      text.toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    const wordsAnswer = cleanWords(answer);
    const wordsExpected = cleanWords(expected);

    if (wordsAnswer.length === 0 || wordsExpected.length === 0) return 0;

    const setExpected = new Set(wordsExpected);
    const intersection = wordsAnswer.filter((w) => setExpected.has(w));
    const union = new Set([...wordsAnswer, ...wordsExpected]);

    return intersection.length / union.size;
  };

  const sortedTraces = [...traces].sort((a, b) => a.step_number - b.step_number);

  if (sortedTraces.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-gray-800 bg-gray-950/20 text-sm text-gray-500">
        No execution traces found for this evaluation run.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Expand / Collapse Controls */}
      <div className="flex justify-end gap-3 text-xs">
        <button
          onClick={expandAll}
          className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-semibold transition hover:underline"
        >
          Expand All Steps
        </button>
        <span className="text-gray-700">|</span>
        <button
          onClick={collapseAll}
          className="cursor-pointer text-gray-400 hover:text-gray-300 font-semibold transition hover:underline"
        >
          Collapse All Steps
        </button>
      </div>

      {/* Accordion Steps List */}
      <div className="space-y-4">
        {sortedTraces.map((trace, idx) => {
          const isOpen = !!openSteps[trace.step_number];
          const expectedAnswer = trace.ground_truth || "No expected answer logged for this task.";
          const overlap = getOverlapScore(trace.step_output, expectedAnswer);
          const isHighMatch = overlap >= 0.12; // 12% keyword Jaccard overlap threshold

          return (
            <div
              key={trace.id}
              className={clsx(
                "border rounded-xl transition duration-200 overflow-hidden bg-gray-950/20",
                isOpen ? "border-gray-800 bg-gray-950/30" : "border-gray-900 hover:border-gray-800"
              )}
            >
              {/* Accordion Trigger Header */}
              <button
                onClick={() => toggleStep(trace.step_number)}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-gray-900/10 transition"
              >
                <div className="flex items-center gap-3">
                  {/* Step Number Badge */}
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                    {trace.step_number}
                  </span>
                  <div>
                    <span className="text-xs uppercase font-mono font-bold text-gray-500 tracking-wider">
                      {trace.step_type}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-200 line-clamp-1 mt-0.5">
                      {trace.step_input}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Overlap indicator summary in header */}
                  <span className={clsx(
                    "text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1",
                    isHighMatch
                      ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                      : "bg-rose-500/5 text-rose-400 border-rose-500/10"
                  )}>
                    {isHighMatch ? "✅ High Match" : "❌ Low Match"}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Accordion Content Details */}
              {isOpen && (
                <div className="p-5 border-t border-gray-900 bg-gray-950/40 space-y-5">
                  
                  {/* 1. Input Section: Question Asked in Dark Gray Box */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
                      Question Asked
                    </label>
                    <div className="bg-gray-900/80 border border-gray-850 p-4 rounded-lg text-sm text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
                      {trace.step_input}
                    </div>
                  </div>

                  {/* 2. Output Section: Agent Answer in White Box */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <Code className="h-3.5 w-3.5 text-gray-400" />
                      Agent Answer
                    </label>
                    <div className="bg-white text-gray-900 border border-gray-200 p-4 rounded-lg text-sm font-medium whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
                      {trace.step_output || "No answer returned."}
                    </div>
                  </div>

                  <div className="border-t border-gray-900/60 pt-4" />

                  {/* 3. Expected vs Got Comparison Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                        Response Overlap Check
                      </h5>
                      <span className={clsx(
                        "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                        isHighMatch
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/15"
                      )}>
                        {isHighMatch ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>✅ High overlap matched</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            <span>❌ Low overlap deviation detected</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Agent Said (Light Blue Box) */}
                      <div className="bg-blue-950/20 border border-blue-500/10 p-4 rounded-lg space-y-2 text-sm leading-relaxed">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                          Agent Said
                        </div>
                        <div className="text-blue-200/90 whitespace-pre-wrap font-medium">
                          {trace.step_output || "N/A"}
                        </div>
                      </div>

                      {/* Right: Expected (Light Green Box) */}
                      <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-lg space-y-2 text-sm leading-relaxed">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                          Expected
                        </div>
                        <div className="text-emerald-200/90 whitespace-pre-wrap font-medium">
                          {expectedAnswer}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Step Divider */}
              {idx < sortedTraces.length - 1 && (
                <div className="border-b border-gray-950/30" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
