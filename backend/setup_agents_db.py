from db.supabase_client import supabase

def setup_agents():
    print("--- Setting up Agents in Database ---")
    
    agent_configs = [
        {
            "name": "Agentic RAG",
            "endpoint_url": "http://localhost:8001/run",
            "model_name": "openai/gpt-oss-120b:free",
            "description": "Best for: Complex reasoning, logical deduction, and step-by-step problem solving. Uses explicit step-by-step thinking paths (thought reasoning trace) before executing queries over LanceDB and DuckDuckGo."
        },
        {
            "name": "Autonomous RAG",
            "endpoint_url": "http://localhost:8002/run",
            "model_name": "openai/gpt-oss-120b:free",
            "description": "Best for: General conversational Q&A, Supabase database-backed search, and flexible queries. Autonomously routes questions between PgVector knowledge base and DuckDuckGo web search."
        },
        {
            "name": "Corrective RAG",
            "endpoint_url": "http://localhost:8003/run",
            "model_name": "langgraph-corrective",
            "description": "Best for: High-precision document questions and preventing hallucinations. Uses LangGraph to grade retrieval relevance and automatically self-corrects using Tavily search when local facts are missing."
        }
    ]
    
    for conf in agent_configs:
        # Check if agent exists by name
        res = supabase.table("agents").select("*").eq("name", conf["name"]).execute().data
        if res:
            agent_id = res[0]["id"]
            print(f"Agent '{conf['name']}' exists. Updating configuration...")
            supabase.table("agents").update({
                "endpoint_url": conf["endpoint_url"],
                "model_name": conf["model_name"],
                "description": conf["description"]
            }).eq("id", agent_id).execute()
        else:
            print(f"Agent '{conf['name']}' not found. Inserting new record...")
            res_insert = supabase.table("agents").insert({
                "name": conf["name"],
                "endpoint_url": conf["endpoint_url"],
                "model_name": conf["model_name"],
                "description": conf["description"]
            }).execute().data
            agent_id = res_insert[0]["id"]
            print(f"Inserted '{conf['name']}' with ID: {agent_id}")

def verify_tasks():
    print("\n--- Verifying Benchmark Tasks ---")
    tasks = supabase.table("benchmark_tasks").select("*").execute().data
    print(f"Total benchmark tasks found: {len(tasks)}")
    
    if len(tasks) < 5:
        print("Error: Less than 5 benchmark tasks found in the database. Please add more tasks.")
    else:
        print("Database holds at least 5 benchmark tasks. Verify columns:")
        sample = tasks[0]
        print(f"  - question: {'OK' if sample.get('question') else 'MISSING'}")
        print(f"  - context: {'OK' if sample.get('context') else 'MISSING'}")
        print(f"  - ground_truth: {'OK' if sample.get('ground_truth') else 'MISSING'}")

if __name__ == "__main__":
    setup_agents()
    verify_tasks()
