"use client";

import React, { useState, useEffect } from "react";
import { 
  UploadCloud, 
  CheckCircle2, 
  Trash2, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  AlertTriangle,
  X
} from "lucide-react";
import { generateBenchmarks, getBenchmarks, deleteBenchmark } from "@/lib/api";

interface BenchmarkTask {
  id: string;
  question: string;
  context: string;
  ground_truth: string;
  task_type: string;
  source_name?: string;
  created_at?: string;
}

export default function BenchmarksPage() {
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Tasks from the most recent generation run
  const [newlyGenerated, setNewlyGenerated] = useState<Omit<BenchmarkTask, "id">[]>([]);
  const [justGeneratedSource, setJustGeneratedSource] = useState("");
  
  // All tasks in the system
  const [existingTasks, setExistingTasks] = useState<BenchmarkTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadExistingBenchmarks = async () => {
    try {
      setLoadingTasks(true);
      const data = await getBenchmarks();
      setExistingTasks(data);
      
      // Auto-expand groups that have tasks
      const groups: Record<string, boolean> = {};
      data.forEach((task: BenchmarkTask) => {
        const src = task.source_name || "manual / system";
        if (groups[src] === undefined) {
          groups[src] = false; // Collapsed by default
        }
      });
      setExpandedGroups(prev => ({ ...groups, ...prev }));
    } catch (err) {
      const error = err as Error;
      console.warn("Failed to load benchmarks:", error.message || error);
      setErrorMsg("Failed to load existing benchmarks from the database.");
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExistingBenchmarks();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      const ext = dropped.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf" || ext === "txt") {
        setFile(dropped);
        setErrorMsg("");
      } else {
        setErrorMsg("Only PDF and TXT files are accepted for benchmark generation.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setErrorMsg("");
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    try {
      setGenerating(true);
      setErrorMsg("");
      setSuccessMsg("");
      setNewlyGenerated([]);
      setJustGeneratedSource("");

      const res = await generateBenchmarks(file);
      
      setNewlyGenerated(res.tasks);
      setJustGeneratedSource(res.source_name);
      setSuccessMsg(`Successfully generated and stored ${res.generated_count} tasks!`);
      setFile(null); // Reset file upload input
      
      // Reload existing list and expand the newly created group
      await loadExistingBenchmarks();
      setExpandedGroups(prev => ({ ...prev, [res.source_name]: true }));
    } catch (err) {
      const apiError = err as { message?: string; response?: { data?: { detail?: string } } };
      console.warn("Failed to generate benchmarks:", apiError.message || apiError);
      setErrorMsg(apiError.response?.data?.detail || "Failed to generate tasks. Make sure your Groq API key is valid.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task? It will be permanently removed from evaluation pools.")) return;
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await deleteBenchmark(id);
      
      // Update UI state directly
      setExistingTasks(prev => prev.filter(t => t.id !== id));
      setSuccessMsg("Task deleted successfully.");
    } catch (err) {
      const error = err as Error;
      console.warn("Failed to delete task:", error.message || error);
      setErrorMsg("Failed to delete the task.");
    }
  };

  const toggleGroup = (sourceName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [sourceName]: !prev[sourceName]
    }));
  };

  // Group existing tasks
  const groupedTasks = existingTasks.reduce<Record<string, BenchmarkTask[]>>((groups, task) => {
    const src = task.source_name || "manual / system";
    if (!groups[src]) groups[src] = [];
    groups[src].push(task);
    return groups;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">
      
      {/* 2.1 Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Benchmark Tasks Generator
        </h1>
        <p className="text-sm text-gray-400 max-w-2xl">
          Upload text or PDF documents. Our system will leverage LLMs to automatically extract key concepts and synthesize diverse QA evaluation tasks (factual, reasoning, and detail-oriented) matching expected ground truth context.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-5 py-4 rounded-xl flex items-center justify-between text-sm shadow-md animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-gray-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-xl flex items-center justify-between text-sm shadow-md animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-gray-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upload Document Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-gray-800 bg-gray-950/20 p-6 rounded-2xl space-y-5 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                📁
              </span>
              Source Document
            </h3>
            
            {/* Drag and Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition flex flex-col items-center justify-center min-h-[160px] cursor-pointer ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-500/5 scale-[0.99]" 
                  : "border-gray-800 hover:border-gray-700 bg-gray-950/40"
              }`}
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".txt,.pdf"
                onChange={handleFileChange}
                disabled={generating}
              />
              <label htmlFor="file-upload" className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                <UploadCloud className={`h-10 w-10 mb-3 transition ${dragActive ? "text-indigo-400 animate-bounce" : "text-gray-500"}`} />
                <p className="text-sm font-semibold text-white">Drag & drop files here</p>
                <p className="text-xs text-gray-500 mt-1">or click to browse local storage</p>
                <p className="text-[10px] text-gray-600 mt-2">Accepted formats: .pdf, .txt</p>
              </label>
            </div>

            {/* Display Selected File */}
            {file && (
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-gray-300">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="truncate font-semibold text-white">{file.name}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button 
                  onClick={() => setFile(null)}
                  className="text-gray-500 hover:text-white transition cursor-pointer"
                  disabled={generating}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Generate Trigger */}
            <button
              onClick={handleGenerate}
              disabled={!file || generating}
              className="w-full cursor-pointer inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 text-sm transition shadow-lg shadow-indigo-600/15 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Generating... (~30s)
                </>
              ) : (
                "Generate Evaluation Tasks"
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Generation Review & Existing Benchmarks */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 2.2 Newly Generated Benchmark Tasks Preview */}
          {newlyGenerated.length > 0 && (
            <div className="border border-indigo-500/20 bg-indigo-500/5 p-6 rounded-2xl space-y-5 shadow-lg shadow-indigo-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-base">✨</span>
                    Generated Review Panel
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tasks synthesized from source: <strong className="text-indigo-300">{justGeneratedSource}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setNewlyGenerated([])}
                  className="text-gray-400 hover:text-white cursor-pointer p-1 rounded hover:bg-indigo-500/10 transition"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {newlyGenerated.map((t, idx) => (
                  <div key={idx} className="bg-gray-950/60 border border-gray-900 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded text-[10px]">
                        Task {idx + 1}
                      </span>
                    </div>
                    <div className="space-y-1.5 leading-relaxed">
                      <p className="text-gray-200">
                        <strong className="text-gray-400 font-semibold block mb-0.5">Question:</strong>
                        {t.question}
                      </p>
                      <p className="text-gray-300">
                        <strong className="text-gray-400 font-semibold block mb-0.5">Ground Truth:</strong>
                        {t.ground_truth}
                      </p>
                      <p className="text-gray-400 italic bg-gray-900/30 p-2 border-l border-gray-800 rounded">
                        <strong className="text-gray-500 font-semibold block not-italic mb-0.5">Context excerpt:</strong>
                        &quot;{t.context}&quot;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2.3 Existing Benchmark Suites */}
          <div className="border border-gray-800 bg-gray-950/20 p-6 rounded-2xl space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                  📚
                </span>
                Existing Benchmark Pools
              </h3>
              <span className="text-xs font-mono text-gray-500">
                Total Tasks: {existingTasks.length}
              </span>
            </div>

            {loadingTasks ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-500 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <span className="text-xs font-medium">Fetching evaluation pools...</span>
              </div>
            ) : Object.keys(groupedTasks).length === 0 ? (
              <div className="border border-dashed border-gray-800 rounded-xl py-14 text-center space-y-4 bg-card/10">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-white">No Benchmark Tasks Found</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Upload document resources on the left panel to auto-generate QA pairs.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedTasks).map(([source, tasks]) => {
                  const isExpanded = !!expandedGroups[source];
                  return (
                    <div key={source} className="border border-gray-850 rounded-xl overflow-hidden bg-gray-950/20 shadow-md">
                      
                      {/* Accordion Trigger */}
                      <button
                        onClick={() => toggleGroup(source)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-gray-900/20 hover:bg-gray-900/40 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-indigo-400" />
                          <div>
                            <span className="text-xs font-semibold text-white block">
                              {source}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                              {tasks.length} tasks registered
                            </span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-900 border-t border-gray-850">
                          {tasks.map((task, idx) => (
                            <div key={task.id} className="p-5 hover:bg-gray-900/10 transition text-xs flex items-start justify-between gap-6">
                              <div className="space-y-2.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="bg-gray-900 text-gray-400 font-bold px-2 py-0.5 rounded text-[9px] border border-gray-800">
                                    Task #{idx + 1}
                                  </span>
                                </div>
                                <div className="space-y-1.5 leading-relaxed">
                                  <p className="text-gray-200">
                                    <strong className="text-gray-500 font-medium mr-1.5">Question:</strong>
                                    {task.question}
                                  </p>
                                  <p className="text-gray-300">
                                    <strong className="text-gray-500 font-medium mr-1.5">Expected Answer:</strong>
                                    {task.ground_truth}
                                  </p>
                                  <p className="text-gray-400 italic bg-gray-900/30 p-2 border-l border-gray-800 rounded">
                                    <strong className="text-gray-500 font-medium not-italic block mb-0.5">Excerpt:</strong>
                                    &quot;{task.context}&quot;
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDelete(task.id)}
                                className="cursor-pointer text-gray-500 hover:text-rose-400 transition p-2 rounded hover:bg-rose-500/10 shrink-0 self-start"
                                title="Delete task"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
