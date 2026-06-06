"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Agent = {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  model_name: string;
};

export default function AgentPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`http://127.0.0.1:8000/agents/${id}`)
      .then((res) => res.json())
      .then((data) => setAgent(data))
      .catch(console.error);
  }, [id]);

  if (!agent) {
    return <div className="p-10">Loading...</div>;
  }

  return (
    <main className="max-w-3xl mx-auto p-10">
        <Link
        href="/"
        className="text-blue-500"
        >
        ← Back to Dashboard
        </Link>
      <h1 className="text-4xl font-bold mb-6">
        {agent.name}
      </h1>

      <div className="space-y-4 border rounded p-6">
        <p>
          <strong>Description:</strong> {agent.description}
        </p>

        <p>
          <strong>Model:</strong> {agent.model_name}
        </p>

        <p>
          <strong>Endpoint:</strong> {agent.endpoint_url}
        </p>

        <p>
          <strong>ID:</strong> {agent.id}
        </p>
      </div>
    </main>
  );
}
