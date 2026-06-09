import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from evaluation.benchmark_generator import generate_qa_pairs, save_benchmark_tasks
from db.supabase_client import supabase
from pypdf import PdfReader

router = APIRouter()

@router.post("/benchmarks/generate")
async def generate_benchmarks(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_document"
    
    # 1. Text Extraction
    try:
        if filename.lower().endswith(".pdf"):
            # Read PDF bytes
            content_bytes = await file.read()
            pdf_file = io.BytesIO(content_bytes)
            reader = PdfReader(pdf_file)
            
            text_parts = []
            for i, page in enumerate(reader.pages):
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(extracted)
            text = "\n".join(text_parts)
            
            if not text.strip():
                raise HTTPException(status_code=400, detail="Could not extract any text from the PDF file.")
        else:
            # Assume text/plain or similar
            content_bytes = await file.read()
            text = content_bytes.decode("utf-8", errors="ignore")
            
            if not text.strip():
                raise HTTPException(status_code=400, detail="Uploaded text file is empty.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from file: {str(e)}")

    # 2. QA Pairs Generation
    try:
        tasks = generate_qa_pairs(text, num_questions=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate benchmark tasks: {str(e)}")

    # 3. Database Save
    try:
        inserted_count = save_benchmark_tasks(tasks, filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save benchmark tasks to database: {str(e)}")

    # 4. Ingest Document into registered agents' vector databases
    try:
        import os
        import httpx
        # Fetch active agents from Supabase
        agents = supabase.table("agents").select("*").execute().data or []
        for agent in agents:
            endpoint_url = agent.get("endpoint_url")
            if endpoint_url:
                target_url = endpoint_url.replace("/run", "/ingest").replace("/chat", "/ingest")
                if os.getenv("RUNNING_IN_DOCKER") == "true":
                    if ":8001" in target_url:
                        target_url = target_url.replace("localhost", "agentic_rag").replace("127.0.0.1", "agentic_rag")
                    elif ":8002" in target_url:
                        target_url = target_url.replace("localhost", "autonomous_rag").replace("127.0.0.1", "autonomous_rag")
                    elif ":8003" in target_url:
                        target_url = target_url.replace("localhost", "corrective_rag").replace("127.0.0.1", "corrective_rag")
                    else:
                        target_url = target_url.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
                
                print(f"Propagating uploaded document to agent ingest endpoint: {agent['name']} ({target_url})")
                try:
                    async with httpx.AsyncClient(trust_env=False) as client:
                        ingest_res = await client.post(
                            target_url,
                            json={"text": text, "filename": filename},
                            timeout=60.0
                        )
                        print(f"Ingest response from {agent['name']}: {ingest_res.status_code} - {ingest_res.text}")
                except Exception as agent_err:
                    print(f"Failed to ingest to agent {agent['name']} at {target_url}: {agent_err}")
    except Exception as ingest_err:
        print(f"Failed to trigger agent ingestion pipeline: {ingest_err}")

    return {
        "generated_count": inserted_count,
        "tasks": tasks,
        "source_name": filename
    }

@router.get("/benchmarks")
async def get_benchmarks():
    try:
        res = supabase.table("benchmark_tasks").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch benchmarks: {str(e)}")

@router.delete("/benchmarks/{task_id}")
async def delete_benchmark(task_id: str):
    try:
        res = supabase.table("benchmark_tasks").delete().eq("id", task_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"message": "Task deleted successfully", "task_id": task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete benchmark task: {str(e)}")
