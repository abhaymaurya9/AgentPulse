from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from evaluation.runner import run_evaluation
from db.supabase_client import supabase
from db.auth import get_user_id

router = APIRouter()

@router.post("/agents/{agent_id}/evaluate")
async def trigger_eval(agent_id: str, background_tasks: BackgroundTasks, user_id: str | None = Depends(get_user_id)):
    agent = supabase.table("agents").select("id").eq("id", agent_id).execute().data
    if not agent:
        raise HTTPException(404, "Agent not found")

    background_tasks.add_task(run_evaluation, agent_id, user_id)
    return {"message": "Evaluation started!", "agent_id": agent_id}

@router.get("/agents/{agent_id}/runs")
async def get_runs(agent_id: str, user_id: str | None = Depends(get_user_id)):
    query = supabase.table("eval_runs").select("*").eq("agent_id", agent_id)
    if user_id:
        query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
    else:
        query = query.is_("user_id", "null")
    return query.order("run_date", desc=True).execute().data

@router.get("/runs/{run_id}")
async def get_run(run_id: str, user_id: str | None = Depends(get_user_id)):
    query = supabase.table("eval_runs").select("*").eq("id", run_id)
    if user_id:
        query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
    else:
        query = query.is_("user_id", "null")
    run = query.execute().data
    
    traces = supabase.table("run_traces").select("*")\
             .eq("eval_run_id", run_id).order("step_number").execute().data
    
    # Retrieve benchmark tasks to fetch the ground truth matching each trace question
    tasks = supabase.table("benchmark_tasks").select("question", "ground_truth").execute().data
    task_map = {t["question"]: t["ground_truth"] for t in tasks} if tasks else {}
    
    for trace in traces:
        trace["ground_truth"] = task_map.get(trace["step_input"], "No expected ground truth logged.")
        
    return {"run": run[0] if run else None, "traces": traces}

@router.get("/agents/{agent_id}/drift-history")
async def get_drift_history(agent_id: str, user_id: str | None = Depends(get_user_id)):
    # Fetch ALL runs of the agent in desc order by date to compute historical rolling average drops
    query = supabase.table("eval_runs").select("*").eq("agent_id", agent_id)
    if user_id:
        query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
    else:
        query = query.is_("user_id", "null")
    all_runs = query.order("run_date", desc=True).execute().data
    if not all_runs:
        return []
        
    drift_events = []
    
    for i, run in enumerate(all_runs):
        if not run.get("drift_detected"):
            continue
            
        preceding_runs = all_runs[i + 1 : i + 4] # up to 3 preceding runs
        if not preceding_runs:
            drop_pct = 0.0
        else:
            scores = [r["composite_score"] for r in preceding_runs]
            avg = sum(scores) / len(scores)
            if avg > 0:
                drop_pct = round((avg - run["composite_score"]) / avg * 100, 2)
            else:
                drop_pct = 0.0
                
        drift_events.append({
            "run_id": run["id"],
            "run_date": run["run_date"],
            "composite_score": run["composite_score"],
            "drift_reason": run.get("drift_reason") or "General performance drop",
            "score_drop_percentage": max(0.0, drop_pct)
        })
        
    return drift_events
