from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

from agno.agent import Agent
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.models.openai.like import OpenAILike
from agno.knowledge.knowledge import Knowledge
from agno.tools.reasoning import ReasoningTools
from agno.vectordb.lancedb import LanceDb, SearchType

import os
import time

load_dotenv()

app = FastAPI(title="Agentic RAG Agent")


class QuestionRequest(BaseModel):
    question: str


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
    tools=[ReasoningTools(add_instructions=True)],
    instructions=[
        "Include sources in your response.",
        "Always search your knowledge before answering.",
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