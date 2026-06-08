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
