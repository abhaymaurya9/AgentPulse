from fastapi import APIRouter, BackgroundTasks, HTTPException
from evaluation.runner import run_evaluation
from db.supabase_client import supabase

router = APIRouter()

@router.post("/agents/{agent_id}/evaluate")
async def trigger_eval(agent_id: str, background_tasks: BackgroundTasks):
    agent = supabase.table("agents").select("id").eq("id", agent_id).execute().data
    if not agent:
        raise HTTPException(404, "Agent not found")

    background_tasks.add_task(run_evaluation, agent_id)
    return {"message": "Evaluation started!", "agent_id": agent_id}

@router.get("/agents/{agent_id}/runs")
async def get_runs(agent_id: str):
    return supabase.table("eval_runs").select("*")\
           .eq("agent_id", agent_id).order("run_date", desc=True).execute().data

@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    run    = supabase.table("eval_runs").select("*").eq("id", run_id).execute().data
    traces = supabase.table("run_traces").select("*")\
             .eq("eval_run_id", run_id).order("step_number").execute().data
    
    # Retrieve benchmark tasks to fetch the ground truth matching each trace question
    tasks = supabase.table("benchmark_tasks").select("question", "ground_truth").execute().data
    task_map = {t["question"]: t["ground_truth"] for t in tasks} if tasks else {}
    
    for trace in traces:
        trace["ground_truth"] = task_map.get(trace["step_input"], "No expected ground truth logged.")
        
    return {"run": run[0] if run else None, "traces": traces}
