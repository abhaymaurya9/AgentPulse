from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
import time
import os

# Load environment variables
load_dotenv()

# Import the compiled LangGraph workflow from core
from corrective_rag_core import app as workflow

app = FastAPI(title="Corrective RAG Agent")


class QuestionRequest(BaseModel):
    question: str


class IngestRequest(BaseModel):
    text: str
    filename: str = "document.txt"


@app.post("/ingest")
async def ingest_agent_docs(body: IngestRequest):
    from langchain.schema import Document
    from corrective_rag_core import ingest_documents
    doc = Document(page_content=body.text, metadata={"source": body.filename})
    success = ingest_documents([doc])
    return {
        "agent_name": "Corrective RAG",
        "status": "success" if success else "failed"
    }


@app.get("/health")
def health():
    return {
        "status": "running",
        "agent_name": "Corrective RAG",
        "version": "1.0"
    }


@app.post("/run")
async def run_agent(body: QuestionRequest):
    start = time.time()

    inputs = {
        "keys": {
            "question": body.question
        }
    }

    final_state = None

    # Run the compiled LangGraph workflow
    for output in workflow.stream(inputs):
        final_state = output

    generation = "No answer"

    if final_state:
        # Extract the generation from the final node execution results
        for _, value in final_state.items():
            generation = value["keys"].get(
                "generation",
                generation
            )

    if generation is None:
        generation = ""

    latency = int((time.time() - start) * 1000)

    # Fast estimation of token count to avoid downloading encoding files over proxy
    token_count = int(len(generation.split()) * 1.3) if generation else 0

    return {
        "agent_name": "Corrective RAG",
        "answer": generation,
        "latency_ms": latency,
        "token_count": token_count
    }
