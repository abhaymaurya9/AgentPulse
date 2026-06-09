from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

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


class IngestRequest(BaseModel):
    text: str
    filename: str = "document.txt"


@app.post("/ingest")
async def ingest_agent_docs(body: IngestRequest):
    import tempfile
    import os
    from sqlalchemy import text as sql_text

    # 1. Reset PgVector table first to ensure a clean evaluation context
    try:
        with engine.connect() as conn:
            conn.execute(sql_text("DELETE FROM auto_rag_docs"))
            conn.commit()
    except Exception as db_err:
        print(f"Warning: Failed to clean PgVector table: {db_err}")

    # 2. Write content to a temp file and ingest it
    suffix = ".txt"
    if body.filename.endswith(".pdf"):
        suffix = ".pdf"
    elif body.filename.endswith(".md"):
        suffix = ".md"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(body.text.encode("utf-8"))
        tmp_path = tmp.name

    try:
        agent.knowledge.add_content(path=tmp_path)
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
            os.unlink(tmp_path)
        except Exception:
            pass

# Resolve database URL and API Key
supabase_db_url = os.getenv("SUPABASE_DB_URL")
openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

if not supabase_db_url:
    raise ValueError("SUPABASE_DB_URL is missing in the environment or .env file.")

# Set up database engine using NullPool to prevent connection saturation on Supabase
engine = create_engine(supabase_db_url, poolclass=NullPool)

# Set up OpenAI-like OpenRouter client
llm = OpenAILike(
    id="openai/gpt-oss-120b:free",
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1"
)

# Initialize Agent
agent = Agent(
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
    tools=[DuckDuckGoTools()],
    instructions=[
        "Search your knowledge base first.",
        "If not found, search the internet.",
        "Provide clear and concise answers.",
    ],
    search_knowledge=True,
    markdown=True,
    debug_mode=True,
    debug_level=2,
)

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
    
    response = agent.run(body.question)
    
    answer = ""
    if response is not None:
        if hasattr(response, "content") and response.content is not None:
            answer = response.content
        else:
            answer = str(response)
        
    if answer is None:
        answer = ""

    latency = int((time.time() - start) * 1000)
    
    # Estimate token count
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        token_count = len(enc.encode(answer))
    except Exception:
        token_count = len(answer.split()) * 1.3 if answer else 0
        
    return {
        "agent_name": "Autonomous RAG",
        "answer": answer,
        "latency_ms": latency,
        "token_count": int(token_count),
    }
