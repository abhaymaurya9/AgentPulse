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

    # 1. Reset LanceDB table/database to ensure clean evaluation context
    try:
        import lancedb
        db = lancedb.connect("tmp/lancedb")
        if "agno_docs" in db.table_names():
            db.drop_table("agno_docs")
    except Exception as db_err:
        print(f"Warning: Failed to reset LanceDB table: {db_err}")
        # Fallback: try removing the folder if lancedb connection is not active
        try:
            if os.path.exists("tmp/lancedb"):
                shutil.rmtree("tmp/lancedb")
        except Exception:
            pass

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
            os.unlink(tmp_path)
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

# Add working source
knowledge.add_content(
    url="https://modelcontextprotocol.io/introduction"
)

# ---------- Agent ----------

agent = Agent(
    model=OpenAILike(
        id="openai/gpt-oss-120b:free",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
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

    try:
        import tiktoken

        enc = tiktoken.get_encoding("cl100k_base")
        token_count = len(enc.encode(answer))

    except Exception:
        token_count = len(answer.split()) * 1.3 if answer else 0

    return {
        "agent_name": "Agentic RAG",
        "answer": answer,
        "latency_ms": latency,
        "token_count": int(token_count),
    }