import httpx, time
from evaluation.ragas_eval import run_ragas
from db.supabase_client import supabase

def call_agent(endpoint_url, question):
    """Agent ko question bhejo, answer + latency lo"""
    start = time.time()
    try:
        res = httpx.post(
            endpoint_url,
            json={"question": question},
            timeout=30.0
        )
        data = res.json()
        return {
            "answer":     data.get("answer", ""),
            "latency_ms": int((time.time() - start) * 1000),
            "tokens":     data.get("token_count", 0),
            "error":      None
        }
    except httpx.TimeoutException:
        return {
            "answer":     "",
            "latency_ms": int((time.time() - start) * 1000),
            "tokens":     0,
            "error":      "Timeout"
        }
    except (httpx.ConnectError, httpx.ConnectTimeout):
        return {
            "answer":     "",
            "latency_ms": int((time.time() - start) * 1000),
            "tokens":     0,
            "error":      "Connection refused"
        }
    except ValueError:
        return {
            "answer":     "",
            "latency_ms": int((time.time() - start) * 1000),
            "tokens":     0,
            "error":      "Wrong JSON"
        }
    except Exception as e:
        return {
            "answer":     "",
            "latency_ms": int((time.time() - start) * 1000),
            "tokens":     0,
            "error":      str(e)
        }

def task_success(agent_answer, ground_truth):
    """Simple keyword overlap score"""
    if not agent_answer or not ground_truth:
        return 0.0
    try:
        agent_answer_str = str(agent_answer)
        ground_truth_str = str(ground_truth)
    except Exception:
        return 0.0

    if not agent_answer_str or not ground_truth_str:
        return 0.0

    gt_words  = set(ground_truth_str.lower().split())
    ans_words = set(agent_answer_str.lower().split())
    overlap   = gt_words & ans_words
    return round(len(overlap) / len(gt_words), 3) if gt_words else 0.0

def calculate_cost(token_count: int) -> float:
    """Calculate token cost using GPT-4o-mini baseline pricing"""
    return float(token_count * 0.00000015)

def composite_score(faithfulness: float, context_precision: float, context_recall: float, answer_relevancy: float, task_success: float, latency_ms: int, cost: float) -> float:
    rag_score = faithfulness*0.35 + context_precision*0.25 + context_recall*0.25 + answer_relevancy*0.15

    if latency_ms < 2000:   lat_score = 1.0
    elif latency_ms < 5000: lat_score = 0.7
    elif latency_ms < 10000:lat_score = 0.4
    else:                   lat_score = 0.1

    cost_score = 1.0 if cost < 0.001 else (0.7 if cost < 0.01 else 0.4)
    efficiency = lat_score*0.6 + cost_score*0.4

    return round((rag_score*0.50 + task_success*0.30 + efficiency*0.20) * 100, 2)

def check_drift(agent_id: str, current_score: float) -> bool:
    """Check if composite score has dropped by >= 10% compared to the last run"""
    prev = supabase.table("eval_runs").select("composite_score")\
           .eq("agent_id", agent_id).order("run_date", desc=True)\
           .limit(1).execute().data
    if not prev:
        return False
    last_score = prev[0]["composite_score"]
    if last_score <= 0.0:
        return False
    drop = (last_score - current_score) / last_score * 100
    return drop >= 10

def run_evaluation(agent_id: str):
    """Ek agent ka complete evaluation"""

    # 1. Agent info lo
    agent = supabase.table("agents").select("*").eq("id", agent_id).execute().data[0]

    # 2. Benchmark tasks lo
    tasks = supabase.table("benchmark_tasks").select("*").limit(5).execute().data
    if not tasks:
        return {"error": "No benchmark tasks found"}

    all_scores = []
    all_traces = []

    for i, task in enumerate(tasks):
        print(f"Task {i+1}/{len(tasks)}: {task['question']}")

        # 3. Agent call karo
        resp = call_agent(agent["endpoint_url"], task["question"])

        if resp["error"]:
            print(f"  Agent error: {resp['error']}")
            continue

        # 4. Task success
        success = task_success(resp["answer"], task["ground_truth"])

        # 5. RAGAS scores
        ragas = run_ragas(
            question=task["question"],
            context=task["context"],
            ground_truth=task["ground_truth"],
            agent_answer=resp["answer"]
        )

        # 6. Cost estimate
        cost = calculate_cost(resp["tokens"])

        # 7. Composite score
        score = composite_score(
            faithfulness=ragas["faithfulness"],
            context_precision=ragas["context_precision"],
            context_recall=ragas["context_recall"],
            answer_relevancy=ragas["answer_relevancy"],
            task_success=success,
            latency_ms=resp["latency_ms"],
            cost=cost
        )

        print(f"Score: {score}")
        print(f"Latency: {resp['latency_ms']}ms")

        all_scores.append({**ragas, "task_success": success,
                           "latency_ms": resp["latency_ms"],
                           "cost": cost, "composite": score})

        all_traces.append({
            "step_number": i + 1,
            "step_type":   "rag_eval",
            "step_input":  task["question"],
            "step_output": resp["answer"]
        })

    if not all_scores:
        return {"error": "All tasks failed"}

    # 8. Average nikalo
    keys = all_scores[0].keys()
    avg  = {k: round(sum(s[k] for s in all_scores) / len(all_scores), 3) for k in keys}

    # 9. Drift check
    drift = check_drift(agent_id, avg["composite"])

    # 10. Supabase mein save karo
    run = supabase.table("eval_runs").insert({
        "agent_id":           agent_id,
        "faithfulness_score": avg["faithfulness"],
        "context_precision":  avg["context_precision"],
        "context_recall":     avg["context_recall"],
        "latency_ms":         int(avg["latency_ms"]),
        "token_cost":         avg["cost"],
        "task_success_rate":  avg["task_success"],
        "answer_quality":     avg["answer_relevancy"],
        "composite_score":    avg["composite"],
        "drift_detected":     drift
    }).execute().data[0]

    # 11. Traces save karo
    for trace in all_traces:
        supabase.table("run_traces").insert({
            "eval_run_id": run["id"], **trace
        }).execute()

    print(f"✅ Composite Score: {avg['composite']}")
    print(f"Drift: {drift}")

    return {"eval_run_id": run["id"], "scores": avg, "drift": drift}
