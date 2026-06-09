import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL or SUPABASE_KEY missing from backend/.env")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

updates = [
    {"name": "Agentic RAG", "url": "https://agentpulse-agentic-rag.onrender.com/run"},
    {"name": "Autonomous RAG", "url": "https://agentpulse-autonomous-rag.onrender.com/run"},
    {"name": "Corrective RAG", "url": "https://agentpulse-corrective-rag.onrender.com/run"}
]

print("--- Updating Agent URLs in Supabase Database ---")
for update in updates:
    res = supabase.table("agents").select("*").eq("name", update["name"]).execute().data
    if res:
        agent_id = res[0]["id"]
        print(f"Updating '{update['name']}' URL to: {update['url']}")
        supabase.table("agents").update({"endpoint_url": update["url"]}).eq("id", agent_id).execute()
    else:
        print(f"Warning: Agent '{update['name']}' not found in database.")

print("Update complete!")
