import os
import json
from groq import Groq
from db.supabase_client import supabase

def generate_qa_pairs(text: str, num_questions: int = 10) -> list[dict]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set")
    
    client = Groq(api_key=api_key)
    
    # Limit source text length to prevent exceeding Groq free tier Tokens Per Minute (TPM) rate limits.
    # 12,000 characters is roughly 3,000 tokens, which fits comfortably under the 6,000 TPM limit.
    if len(text) > 12000:
        text = text[:12000] + "\n\n[Text truncated to stay within model token constraints]"
    
    prompt = f"""You are an expert AI evaluator.
Given the text below, generate exactly {num_questions} question-answer pairs that will be used to evaluate a RAG (Retrieval-Augmented Generation) agent.

Format your output ONLY as a JSON object matching this structure:
{{
  "tasks": [
    {{
      "question": "The question string",
      "context": "The exact relevant excerpt from the text that contains the answer",
      "ground_truth": "The correct answer to the question"
    }}
  ]
}}

Ensure that the questions are diverse:
1. Factual questions (e.g. key figures, dates, direct definitions).
2. Reasoning questions (e.g. explanation of processes, implications, connections).
3. Specific detail questions (e.g. details mentioned in specific contexts).

Source Text:
---
{text}
---
"""

    def run_generation():
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        tasks = data.get("tasks", [])
        
        # Basic validation
        validated = []
        for t in tasks:
            if "question" in t and "context" in t and "ground_truth" in t:
                validated.append({
                    "question": str(t["question"]),
                    "context": str(t["context"]),
                    "ground_truth": str(t["ground_truth"])
                })
        
        if not validated:
            raise ValueError("No valid Q&A tasks generated in response.")
            
        return validated

    try:
        # First attempt
        return run_generation()
    except Exception as e:
        print(f"Warning: Synthetic QA generation failed: {e}. Retrying once...")
        # Retry once
        try:
            return run_generation()
        except Exception as e2:
            print(f"Error: QA generation failed on retry: {e2}")
            raise e2

def save_benchmark_tasks(tasks: list[dict], source_name: str) -> int:
    count = 0
    for t in tasks:
        res = supabase.table("benchmark_tasks").insert({
            "question": t["question"],
            "context": t["context"],
            "ground_truth": t["ground_truth"],
            "task_type": "rag",
            "source_name": source_name
        }).execute()
        if res.data:
            count += 1
    return count
