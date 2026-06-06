"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    description: "",
    endpoint_url: "",
    model_name: "",
  });

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
        !form.name ||
        !form.description ||
        !form.endpoint_url ||
        !form.model_name
    ) {
        alert("Please fill all fields");
        return;
    }
    const response = await fetch(
      "http://127.0.0.1:8000/agents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      }
    );

    if (response.ok) {
      alert("Agent Registered!");

      router.push("/");
    } else {
      alert("Failed to register agent");
    }
  };

  return (
    <main className="max-w-xl mx-auto p-10">
      <h1 className="text-3xl font-bold mb-6">
        Register Agent
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <input
          className="w-full border p-3 rounded"
          placeholder="Agent Name"
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
        />

        <textarea
          className="w-full border p-3 rounded"
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({
              ...form,
              description: e.target.value,
            })
          }
        />

        <input
          className="w-full border p-3 rounded"
          placeholder="Endpoint URL"
          value={form.endpoint_url}
          onChange={(e) =>
            setForm({
              ...form,
              endpoint_url: e.target.value,
            })
          }
        />

        <input
          className="w-full border p-3 rounded"
          placeholder="Model Name"
          value={form.model_name}
          onChange={(e) =>
            setForm({
              ...form,
              model_name: e.target.value,
            })
          }
        />

        <button
          type="submit"
          className="bg-black text-white px-6 py-3 rounded"
        >
          Register Agent
        </button>
      </form>
    </main>
  );
}