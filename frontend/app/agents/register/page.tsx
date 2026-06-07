"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerAgent } from "@/lib/api";
import { Cpu, Link as LinkIcon, Radio, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RegisterAgentPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    description: "",
    endpoint_url: "",
    model_name: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.description || !form.endpoint_url || !form.model_name) {
      alert("Please fill all fields");
      return;
    }

    try {
      setSubmitting(true);
      const res = await registerAgent(form);
      alert("Agent Registered Successfully!");
      if (res && res[0] && res[0].id) {
        router.push(`/agents/${res[0].id}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to register agent");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back navigation */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="border border-gray-800 bg-gray-950/20 p-8 rounded-xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Register RAG Pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">
            Connect a new autonomous agent or RAG server endpoint to the evaluator orchestration pipeline.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              Agent Name
            </label>
            <input
              type="text"
              required
              className="w-full bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none transition"
              placeholder="e.g. Corrective RAG"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide">
              <Radio className="h-3.5 w-3.5 text-indigo-400" />
              Model Name / Config
            </label>
            <input
              type="text"
              required
              className="w-full bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none transition"
              placeholder="e.g. openrouter/llama-3.1-8b"
              value={form.model_name}
              onChange={(e) => setForm({ ...form, model_name: e.target.value })}
            />
          </div>

          {/* Endpoint URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide">
              <LinkIcon className="h-3.5 w-3.5 text-indigo-400" />
              Endpoint URL
            </label>
            <input
              type="url"
              required
              className="w-full bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none transition"
              placeholder="http://localhost:8003/run"
              value={form.endpoint_url}
              onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide">
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              Pipeline Description
            </label>
            <textarea
              required
              rows={4}
              className="w-full bg-gray-950 border border-gray-850 focus:border-indigo-500/80 rounded-lg p-3 text-sm text-white placeholder-gray-600 outline-none transition"
              placeholder="Briefly describe the vector storage, routing algorithms, or retriever architectures used in this agent..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 text-white rounded-lg p-3.5 text-sm font-semibold tracking-wide shadow-md shadow-indigo-600/10 transition"
          >
            {submitting ? "Registering..." : "Add Agent to Orchestrator"}
          </button>
        </form>
      </div>
    </div>
  );
}
