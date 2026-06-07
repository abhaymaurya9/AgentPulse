import axios from "axios";

const BASE_URL = "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
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

export const queryAgent = async (id: string, question: string) => {
  const response = await api.post(`/agents/${id}/query`, { question });
  return response.data;
};
