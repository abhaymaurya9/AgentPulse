from fastapi import APIRouter, HTTPException
from schemas.agent import AgentCreate
from db.supabase_client import supabase
import httpx

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


@router.post("/agents/{agent_id}/query")
def query_agent(agent_id: str, body: dict):
    agent = supabase.table("agents").select("endpoint_url").eq("id", agent_id).execute().data
    if not agent:
        raise HTTPException(404, "Agent not found")
    
    endpoint_url = agent[0]["endpoint_url"]
    question = body.get("question", "")
    
    try:
        res = httpx.post(endpoint_url, json={"question": question}, timeout=60.0)
        return res.json()
    except Exception as e:
        raise HTTPException(500, f"Error calling agent: {str(e)}")



