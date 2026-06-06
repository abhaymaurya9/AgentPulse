from fastapi import APIRouter
from schemas.agent import AgentCreate
from db.supabase_client import supabase

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


