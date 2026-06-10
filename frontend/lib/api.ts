import axios from "axios";
import { supabase } from "./supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn("Axios auth interceptor failed:", err);
  }
  return config;
});

export const getAgents = async () => {
  const response = await api.get("/agents");
  return response.data;
};

export const getAgent = async (id: string) => {
  const response = await api.get(`/agents/${id}`);
  return response.data;
};

export const getAgentRuns = async (id: string) => {
  const response = await api.get(`/agents/${id}/runs`);
  return response.data;
};

export const getRun = async (runId: string) => {
  const response = await api.get(`/runs/${runId}`);
  return response.data;
};

export const triggerEvaluation = async (id: string) => {
  const response = await api.post(`/agents/${id}/evaluate`);
  return response.data;
};

export const registerAgent = async (agentData: {
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
}) => {
  const response = await api.post("/agents", agentData);
  return response.data;
};

export const queryAgent = async (id: string, question: string, sessionId?: string) => {
  const response = await api.post(`/agents/${id}/query`, { question, session_id: sessionId });
  return response.data;
};

export const getDriftHistory = async (agentId: string) => {
  const response = await api.get(`/agents/${agentId}/drift-history`);
  return response.data;
};

export const generateBenchmarks = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/benchmarks/generate", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getBenchmarks = async () => {
  const response = await api.get("/benchmarks");
  return response.data;
};

export const deleteBenchmark = async (id: string) => {
  const response = await api.delete(`/benchmarks/${id}`);
  return response.data;
};
