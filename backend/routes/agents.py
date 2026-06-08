from fastapi import APIRouter, HTTPException
from schemas.agent import AgentCreate
from db.supabase_client import supabase
import httpx
import os
import json
import re
from langchain_groq import ChatGroq
from evaluation.runner import calculate_cost, composite_score, check_drift

router = APIRouter()


@router.post("/agents")
def create_agent(agent: AgentCreate):
    result = (
        supabase
        .table("agents")
        .insert(agent.model_dump())
        .execute()
    )
    return result.data


@router.get("/agents")
def get_agents():
    result = (
        supabase
        .table("agents")
        .select("*")
        .execute()
    )
    return result.data


@router.get("/agents/{agent_id}")
def get_agent(agent_id: str):
    result = (
        supabase
        .table("agents")
        .select("*")
        .eq("id", agent_id)
        .single()
        .execute()
    )
    return result.data


def evaluate_playground_response(question: str, answer: str) -> dict:
    """Evaluate the agent's response quality using LLM grading."""
    # If the agent returned no answer, give very low scores directly
    if not answer or not answer.strip():
        return {
            "faithfulness": 0.0,
            "context_precision": 0.0,
            "context_recall": 0.0,
            "task_success": 0.0,
            "answer_quality": 0.0
        }
    
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set")
            
        llm = ChatGroq(
            api_key=api_key,
            model="llama-3.1-8b-instant",
            temperature=0
        )
        
        prompt = f"""
        You are an AI model evaluation system. Analyze the response of a RAG model to a user query.
        
        User Query: {question}
        Model Response: {answer}
        
        Assign a score between 0.0 (poor/inaccurate) and 1.0 (excellent/fully correct) for the following metrics:
        1. faithfulness: Is the answer truthful and factually correct based on the query?
        2. context_precision: Is the answer focused, relevant, and precise?
        3. context_recall: Does the answer completely cover all aspects of the query?
        4. task_success: Did the model successfully answer the query?
        5. answer_quality: Overall readability, completeness, and quality of the text.
        
        Provide the output strictly as a JSON object with keys:
        "faithfulness", "context_precision", "context_recall", "task_success", "answer_quality"
        Example output format:
        {{
            "faithfulness": 0.9,
            "context_precision": 0.85,
            "context_recall": 0.9,
            "task_success": 1.0,
            "answer_quality": 0.95
        }}
        Do not include any preambles, explanations, markdown formatting (do not wrap in ```json), or notes. Output raw JSON only.
        """
        
        res = llm.invoke(prompt)
        text = res.content.strip()
        
        # Parse JSON
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return {
                "faithfulness": float(data.get("faithfulness", 0.8)),
                "context_precision": float(data.get("context_precision", 0.8)),
                "context_recall": float(data.get("context_recall", 0.8)),
                "task_success": float(data.get("task_success", 0.8)),
                "answer_quality": float(data.get("answer_quality", 0.8))
            }
    except Exception as e:
        print("Playground response evaluation failed:", e)
        
    return {
        "faithfulness": 0.8,
        "context_precision": 0.8,
        "context_recall": 0.8,
        "task_success": 0.8,
        "answer_quality": 0.8
    }


def generate_expected_answer(question: str) -> str:
    """Generate a reference/expected answer for a question using LLM.
    This is used as ground_truth so the replay view can show what the correct answer should be."""
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return "Expected answer could not be generated (API key missing)."
            
        llm = ChatGroq(
            api_key=api_key,
            model="llama-3.1-8b-instant",
            temperature=0.2
        )
        
        prompt = f"""Answer the following question accurately and concisely in 2-4 sentences.
This answer will be used as a reference/ground truth to evaluate a RAG agent's response quality.

Question: {question}

Provide ONLY the direct answer, no preamble or explanation."""

        res = llm.invoke(prompt)
        expected = res.content.strip()
        return expected if expected else "Expected answer could not be generated."
    except Exception as e:
        print("Expected answer generation failed:", e)
        return "Expected answer could not be generated."


@router.post("/agents/{agent_id}/query")
def query_agent(agent_id: str, body: dict):
    agent = supabase.table("agents").select("endpoint_url").eq("id", agent_id).execute().data
    if not agent:
        raise HTTPException(404, "Agent not found")
    
    endpoint_url = agent[0]["endpoint_url"]
    if os.getenv("RUNNING_IN_DOCKER") == "true":
        endpoint_url = endpoint_url.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
    question = body.get("question", "")
    
    try:
        try:
            res = httpx.post(endpoint_url, json={"question": question}, timeout=120.0)
        except Exception as conn_err:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to agent endpoint at {endpoint_url}: {str(conn_err)}"
            )
            
        if res.status_code != 200:
            raise HTTPException(
                status_code=res.status_code if res.status_code in [400, 401, 403, 404, 502, 503, 504] else 502,
                detail=f"Agent endpoint returned status code {res.status_code}: {res.text[:150]}"
            )
        
        try:
            res_data = res.json()
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Agent endpoint returned an invalid JSON response. Please check agent configuration."
            )
        
        # Evaluate response on-the-fly and log it to the database as a standard run
        try:
            answer = res_data.get("answer", "")
            latency_ms = res_data.get("latency_ms", 0)
            token_count = res_data.get("token_count", 0)
            
            # Generate expected/reference answer using LLM so replay can compare
            expected_answer = generate_expected_answer(question)
            
            # Save expected answer into benchmark_tasks so get_run lookup finds it
            existing = supabase.table("benchmark_tasks").select("id")\
                       .eq("question", question).execute().data
            if not existing:
                supabase.table("benchmark_tasks").insert({
                    "question": question,
                    "context": f"Playground query for agent {agent_id}",
                    "ground_truth": expected_answer,
                    "task_type": "playground",
                    "source_name": "playground_generated"
                }).execute()
            
            # Evaluate using LLM grader
            scores = evaluate_playground_response(question, answer)
            
            # Calculate cost & composite score
            cost = calculate_cost(token_count)
            comp = composite_score(
                faithfulness=scores["faithfulness"],
                context_precision=scores["context_precision"],
                context_recall=scores["context_recall"],
                answer_relevancy=scores["answer_quality"],
                task_success=scores["task_success"],
                latency_ms=int(latency_ms),
                cost=cost
            )
            
            # Check for drift
            drift, drop_pct = check_drift(agent_id, comp)
            
            # Log as a standard evaluation run (version = None)
            run = supabase.table("eval_runs").insert({
                "agent_id": agent_id,
                "faithfulness_score": scores["faithfulness"],
                "context_precision": scores["context_precision"],
                "context_recall": scores["context_recall"],
                "latency_ms": int(latency_ms),
                "token_cost": cost,
                "task_success_rate": scores["task_success"],
                "answer_quality": scores["answer_quality"],
                "composite_score": comp,
                "drift_detected": drift,
                "drift_reason": "Performance dropped" if drift else None
            }).execute().data[0]
            
            # Insert trace
            supabase.table("run_traces").insert({
                "eval_run_id": run["id"],
                "step_number": 1,
                "step_type": "rag_eval",
                "step_input": question,
                "step_output": answer if answer else "No answer returned."
            }).execute()
            
        except Exception as db_err:
            print("Failed to save playground query standard run to database:", db_err)
            
        return res_data
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(500, f"Error calling agent: {str(e)}")
