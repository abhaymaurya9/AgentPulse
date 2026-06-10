from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

from agno.agent import Agent
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.models.openai.like import OpenAILike
from agno.knowledge.knowledge import Knowledge
from agno.tools.reasoning import ReasoningTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.vectordb.lancedb import LanceDb, SearchType

import os
import time

load_dotenv()

app = FastAPI(title="Agentic RAG Agent")


class QuestionRequest(BaseModel):
    question: str


class IngestRequest(BaseModel):
    text: str
    filename: str = "document.txt"


@app.post("/ingest")
async def ingest_agent_docs(body: IngestRequest):
    import tempfile
    import os
    import shutil

    # 1. Clean old chunks for the same filename from LanceDB table
    try:
        import lancedb
        db = lancedb.connect("tmp/lancedb")
        if "agno_docs" in db.table_names():
            table = db.open_table("agno_docs")
            table.delete(f"payload LIKE '%\"name\": \"{body.filename}\"%'")
            print(f"Deleted existing chunks for filename '{body.filename}' from LanceDB.")
    except Exception as db_err:
        print(f"Warning: Failed to clean LanceDB table: {db_err}")

    # 2. Write content to a temp file with original name under a custom temp directory
    temp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(temp_dir, body.filename)
    try:
        with open(tmp_path, "wb") as f:
            f.write(body.text.encode("utf-8"))

        agent.knowledge.add_content(path=tmp_path)
        return {
            "agent_name": "Agentic RAG",
            "status": "success"
        }
    except Exception as e:
        return {
            "agent_name": "Agentic RAG",
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


# ---------- Knowledge ----------

knowledge = Knowledge(
    vector_db=LanceDb(
        uri="tmp/lancedb",
        table_name="agno_docs",
        search_type=SearchType.vector,
        embedder=FastEmbedEmbedder(),
    ),
)

@app.on_event("startup")
def seed_knowledge():
    try:
        print("Seeding agentic RAG knowledge base...")
        knowledge.add_content(
            url="https://modelcontextprotocol.io/introduction"
        )
        print("Seeding completed successfully.")
    except Exception as e:
        print(f"Warning: Seeding knowledge base failed: {e}")

# ---------- Agent ----------

from agno.models.groq import Groq

agent = Agent(
    model=Groq(
        id="meta-llama/llama-4-scout-17b-16e-instruct",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.0
    ),
    knowledge=knowledge,
    search_knowledge=True,
    tools=[ReasoningTools(add_instructions=True), DuckDuckGoTools()],
    instructions=[
        "Search your knowledge base first.",
        "If the knowledge base does not contain the answer, search the internet using DuckDuckGo.",
        "Include sources in your response.",
        "Provide clear and concise answers.",
    ],
    markdown=True,
)


@app.get("/health")
def health():
    return {
        "status": "running",
        "agent_name": "Agentic RAG",
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

    # Fallback: if agent returned empty (free model tool-calling failure),
    # perform a direct DuckDuckGo web search
    if not answer.strip():
        try:
            from ddgs import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(body.question, max_results=3))
            if results:
                parts = []
                for r in results:
                    parts.append(f"**{r.get('title', '')}**\n{r.get('body', '')}\n*Source: {r.get('href', '')}*")
                answer = "*(Web Search Fallback)*\n\n" + "\n\n---\n\n".join(parts)
        except Exception as e:
            answer = f"Agent could not generate a response, and web search fallback also failed: {str(e)}"

    latency = int((time.time() - start) * 1000)

    # Fast estimation of token count to avoid downloading encoding files over proxy
    token_count = len(answer.split()) * 1.3 if answer else 0

    return {
        "agent_name": "Agentic RAG",
        "answer": answer,
        "latency_ms": latency,
        "token_count": int(token_count),
    }