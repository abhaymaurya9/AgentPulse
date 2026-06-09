from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from agno.knowledge.knowledge import Knowledge
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.vectordb.pgvector import PgVector, SearchType
from agno.db.postgres import PostgresDb
from agno.tools.duckduckgo import DuckDuckGoTools
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

import os
import time

load_dotenv()

app = FastAPI(title="Autonomous RAG Agent Server")

class QuestionRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class IngestRequest(BaseModel):
    text: str
    filename: str = "document.txt"


@app.post("/ingest")
async def ingest_agent_docs(body: IngestRequest):
    import tempfile
    import os
    import shutil
    from sqlalchemy import text as sql_text

    # 1. Clean old chunks for the same filename first from PgVector table
    try:
        with engine.connect() as conn:
            conn.execute(sql_text("DELETE FROM auto_rag_docs WHERE name = :filename"), {"filename": body.filename})
            conn.commit()
            print(f"Deleted existing chunks for filename '{body.filename}' from PgVector.")
    except Exception as db_err:
        print(f"Warning: Failed to clean PgVector table: {db_err}")

    # 2. Write content to a temp file with original name under a custom temp directory
    temp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(temp_dir, body.filename)
    try:
        with open(tmp_path, "wb") as f:
            f.write(body.text.encode("utf-8"))

        get_agent().knowledge.add_content(path=tmp_path)
        return {
            "agent_name": "Autonomous RAG",
            "status": "success"
        }
    except Exception as e:
        return {
            "agent_name": "Autonomous RAG",
            "status": "failed",
            "error": str(e)
        }
    finally:
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except Exception:
            pass

# Resolve database URL and API Key
from agno.models.groq import Groq

supabase_db_url = os.getenv("SUPABASE_DB_URL")
groq_api_key = os.getenv("GROQ_API_KEY")

if not supabase_db_url:
    raise ValueError("SUPABASE_DB_URL is missing in the environment or .env file.")

# Set up database engine using NullPool to prevent connection saturation on Supabase
engine = create_engine(supabase_db_url, poolclass=NullPool)

# Set up Groq client
llm = Groq(
    id="meta-llama/llama-4-scout-17b-16e-instruct",
    api_key=groq_api_key,
    temperature=0.0
)

def get_agent(session_id: Optional[str] = None, use_tools: bool = True) -> Agent:
    store_history = bool(session_id)
    agent_tools = [DuckDuckGoTools()] if use_tools else []
    return Agent(
        id="auto_rag_agent_server",
        model=llm,
        db=PostgresDb(db_engine=engine, session_table="auto_rag_storage"),
        knowledge=Knowledge(
            vector_db=PgVector(
                table_name="auto_rag_docs",
                db_engine=engine,
                search_type=SearchType.vector,
                embedder=FastEmbedEmbedder(),
            ),
            max_results=3,
        ),
        tools=agent_tools,
        instructions=[
            "Search your knowledge base first.",
            "If not found, search the internet.",
            "Provide clear and concise answers.",
            "Always use native function calling parameters. Never wrap tool calls in XML-like tags such as <function=...> or <tool_call>. Use the proper API tool call format only.",
        ],
        search_knowledge=True,
        markdown=True,
        debug_mode=True,
        debug_level=2,
        store_history_messages=store_history,
        read_chat_history=store_history,
        add_history_to_context=store_history,
    )

agent = get_agent()

# Pre-create all database tables once at startup to optimize latency
try:
    agent.db._create_all_tables()
except Exception as db_init_err:
    print(f"Warning: Failed to create database tables at startup: {db_init_err}")

@app.get("/health")
def health():
    return {
        "status": "running",
        "agent_name": "Autonomous RAG",
        "version": "1.0"
    }

@app.post("/run")
async def run_agent(body: QuestionRequest):
    start = time.time()
    local_agent = get_agent(body.session_id)

    # 1. Initialize persistent session if session_id is a run_id and is new
    if body.session_id:
        try:
            with engine.connect() as conn:
                # Check if session exists in DB
                from sqlalchemy import text as sql_text
                exists = conn.execute(sql_text(
                    "SELECT COUNT(*) FROM ai.auto_rag_storage WHERE session_id = :sid"
                ), {"sid": body.session_id}).scalar() > 0
                
                if not exists:
                    # Check if session_id is a valid evaluation run in eval_runs or run_traces
                    traces = conn.execute(sql_text(
                        "SELECT step_input, step_output FROM run_traces WHERE eval_run_id = :sid ORDER BY step_number ASC"
                    ), {"sid": body.session_id}).mappings().all()
                    
                    if traces:
                        # Construct runs list matching Agno's database schema
                        import json, uuid
                        run_list = []
                        current_time = int(time.time())
                        for i, r in enumerate(traces):
                            user_msg_id = str(uuid.uuid4())
                            assistant_msg_id = str(uuid.uuid4())
                            run_id = str(uuid.uuid4())
                            
                            # Clean/extract from JSON if it's a tool call representation or error
                            step_content = r["step_output"]
                            if step_content:
                                try:
                                    parsed = json.loads(step_content)
                                    if isinstance(parsed, dict):
                                        if "error" in parsed:
                                            step_content = parsed["error"].get("message", "Error calling tool.")
                                        elif "name" in parsed and "parameters" in parsed:
                                            step_content = f"Called {parsed['name']} with query: {parsed['parameters'].get('query', '')}"
                                except Exception:
                                    pass
                            
                            run_list.append({
                                "input": {"input_content": r["step_input"]},
                                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                                "tools": [],
                                "run_id": run_id,
                                "status": "COMPLETED",
                                "content": step_content,
                                "agent_id": "auto_rag_agent_server",
                                "messages": [
                                    {
                                        "id": user_msg_id,
                                        "role": "user",
                                        "content": r["step_input"],
                                        "created_at": current_time + i,
                                        "from_history": False,
                                        "stop_after_tool_call": False
                                    },
                                    {
                                        "id": assistant_msg_id,
                                        "role": "assistant",
                                        "content": step_content,
                                        "created_at": current_time + i,
                                        "from_history": False,
                                        "stop_after_tool_call": False
                                    }
                                ],
                                "created_at": current_time + i,
                                "session_id": body.session_id,
                                "content_type": "str",
                                "session_state": {},
                                "model_provider": "OpenAI"
                            })
                            
                        # Insert into auto_rag_storage
                        conn.execute(sql_text(
                            "INSERT INTO ai.auto_rag_storage (session_id, session_type, agent_id, runs, created_at, updated_at) "
                            "VALUES (:sid, 'agent', 'auto_rag_agent_server', :runs, :created_at, :updated_at) "
                            "ON CONFLICT (session_id) DO NOTHING"
                        ), {
                            "sid": body.session_id,
                            "runs": json.dumps(run_list),
                            "created_at": current_time,
                            "updated_at": current_time
                        })
                        conn.commit()
                        print(f"Successfully pre-seeded session history from run traces for session_id: {body.session_id}")
        except Exception as seed_err:
            print(f"Warning: Failed to seed chat history from evaluation run context: {seed_err}")

    try:
        response = local_agent.run(body.question, session_id=body.session_id)
    except Exception as run_err:
        err_str = str(run_err)
        # Handle Groq tool_use_failed by retrying without tools
        if "tool_use_failed" in err_str or "failed_generation" in err_str:
            print(f"Tool use failed, retrying without tools: {err_str[:200]}")
            fallback_agent = get_agent(body.session_id, use_tools=False)
            try:
                response = fallback_agent.run(body.question, session_id=body.session_id)
            except Exception as fallback_err:
                print(f"Fallback agent also failed: {fallback_err}")
                response = None
        else:
            print(f"Agent run failed: {err_str[:200]}")
            response = None
    
    answer = ""
    if response is not None:
        if hasattr(response, "content") and response.content is not None:
            answer = response.content
        else:
            answer = str(response)
        # Check if the answer contains a raw error JSON from Groq tool_use_failed
        if answer and '"tool_use_failed"' in answer:
            try:
                import json as _json
                err_data = _json.loads(answer)
                if isinstance(err_data, dict) and "error" in err_data:
                    failed_gen = err_data["error"].get("failed_generation", "")
                    if failed_gen:
                        answer = failed_gen
                    else:
                        answer = err_data["error"].get("message", answer)
            except Exception:
                pass
        
    if answer is None:
        answer = ""

    latency = int((time.time() - start) * 1000)
    
    # Fast estimation of token count to avoid downloading encoding files over proxy
    token_count = len(answer.split()) * 1.3 if answer else 0
        
    return {
        "agent_name": "Autonomous RAG",
        "answer": answer,
        "latency_ms": latency,
        "token_count": int(token_count),
    }
