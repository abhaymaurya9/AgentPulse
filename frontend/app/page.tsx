"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
};

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-10">
      <h1 className="text-4xl font-bold mb-6">
        AgentPulse 🚀
      </h1>

      <Link
        href="/register"
        className="bg-black text-white px-4 py-2 rounded"
      >
        Register Agent
      </Link>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Registered Agents
      </h2>

      <div className="space-y-4">
        {agents.map((agent) => (
          <Link
            href={`/agents/${agent.id}`}
            key={agent.id}
          >
            <div className="border rounded p-4 hover:bg-gray-900 cursor-pointer transition">
              <h3 className="font-bold text-lg">
                {agent.name}
              </h3>

              <p>{agent.description}</p>

              <p className="text-sm text-gray-500">
                {agent.model_name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}