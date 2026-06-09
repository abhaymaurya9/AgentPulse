# AgentPulse ⚡

AgentPulse is a modern, premium RAG Agent Evaluation and Benchmarking Platform. It enables developers to build, test, compare, and monitor different Retrieval-Augmented Generation (RAG) agent architectures. The platform features synthetic evaluation generation, automated performance benchmarking (using the Ragas framework), latency/cost monitoring, and concept drift detection/diagnostics.

---

## 🏗️ Architecture Overview

AgentPulse is structured as a decoupled, multi-service application containerized with Docker:

```mermaid
graph TD
    UI[Next.js Frontend: Port 3000] -->|API Calls| API[FastAPI Backend: Port 8000]
    API -->|Logs & Benchmarks| DB[(Supabase PostgreSQL)]
    
    API -->|Evaluate / Run Query| A1[Agentic RAG Agent: Port 8001]
    API -->|Evaluate / Run Query| A2[Autonomous RAG Agent: Port 8002]
    API -->|Evaluate / Run Query| A3[Corrective RAG Agent: Port 8003]
    
    A1 -->|Local DB| LanceDB[(LanceDB Local)]
    A2 -->|Vector DB| PgVector[(PgVector on Supabase)]
    A3 -->|Vector DB| Qdrant[(Qdrant Local Path)]
    
    A1 & A2 & A3 -->|Internet Fallback| Search[Web Search: DuckDuckGo / Tavily]
```

### Technical Stack
* **Frontend**: Next.js 15, Tailwind CSS, TypeScript, shadcn/ui.
* **Backend**: FastAPI, SQLAlchemy, HTTPX, Supabase Python Client.
* **Agent Frameworks**: LangGraph, Agno (formerly phidata).
* **Databases**: Supabase (PostgreSQL), PgVector, Qdrant (local disk client), LanceDB (local file database).
* **LLMs/Embeddings**: OpenRouter (GPT-4o-mini), Groq (Llama-4-Scout), Hugging Face (`sentence-transformers/all-MiniLM-L6-v2`).

---

## ✨ Key Features

### 1. Multi-Agent Architectures Compared
* **Agentic RAG (Port 8001)**: Built with Agno using **LanceDB** for local vector search. Employs explicit reasoning traces to breakdown complex multi-step logical tasks, falling back to DuckDuckGo when matching facts are missing.
* **Autonomous RAG (Port 8002)**: Built with Agno using a **PgVector** table on Supabase. Autonomously routes questions between database facts and DuckDuckGo web search, maintaining a persistent chat session state.
* **Corrective RAG (Port 8003)**: Built with **LangGraph** using **Qdrant** (local volume). Implements self-corrective loops: grades retrieved document chunks for relevance using GPT-4o-mini and self-corrects by falling back to Tavily search when local facts are missing.

### 2. Synthetic Benchmark Generator
Upload a document (`.pdf`, `.txt`, `.md`) to dynamically parse the text, generate 10 synthetic question-and-answer benchmark evaluation pairs using LLMs, and push the documents to all agents' vector stores incrementally.

### 3. Automated Evaluations Engine
Evaluate any agent against active benchmark tasks to calculate:
* **Faithfulness**: Factuality of the answer relative to the retrieved context.
* **Context Precision/Recall**: Retrieval quality metrics via the **Ragas** framework.
* **Task Success**: Normalised keyword overlap metric comparing agent answers directly against the ground truth (ignoring punctuation/capitalisation errors).
* **Efficiency (Latency & Cost)**: Execution speed and API cost baseline (calculated using baseline GPT-4o-mini rates).
* **Composite Score**: Overall index metric combining RAG quality, task success, and runtime efficiency.

### 4. Concept Drift Detection & Diagnostics
Automatically tracks performance degradation across consecutive runs. If an agent's composite score drops by **10% or more** compared to its 3-run rolling average, AgentPulse flags the run as **Drift Detected** and diagnoses the culprit metric:
* *Retrieval quality degraded* (drop in Faithfulness)
* *Response time increased significantly* (drop in Latency)
* *Task completion rate dropped* (drop in Task Success)
* *Context relevance degraded* (drop in Context Precision)

---

## 📂 Project Structure

```text
├── agents/
│   ├── agentic_rag/        # Agentic RAG code (LanceDB, reasoning loops)
│   ├── autonomous_rag/     # Autonomous RAG code (PgVector, session storage)
│   └── corrective_rag/     # Corrective RAG code (LangGraph, Qdrant client)
├── backend/
│   ├── db/                 # Supabase client and migrations
│   ├── evaluation/         # Benchmark evaluations runner and Ragas metrics
│   ├── routes/             # FastAPI routers (agents, evaluations, benchmarks)
│   └── main.py             # App entry point
├── frontend/
│   ├── app/                # Next.js pages (dashboard, playground, benchmarks)
│   └── components/         # Reusable charts and replay components
├── docker-compose.yml      # Service configurations
└── deploy.md               # Production deployment guide
```

---

## ⚙️ Configuration & Environment Variables

Create `.env` files in their respective folders:

### Backend (`backend/.env`)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

### Agentic RAG (`agents/agentic_rag/.env`)
```env
GROQ_API_KEY=your_groq_api_key
```

### Autonomous RAG (`agents/autonomous_rag/.env`)
```env
GROQ_API_KEY=your_groq_api_key
SUPABASE_DB_URL=postgresql://postgres.xxx:password@aws-xxxx.pooler.supabase.com:5432/postgres
```

### Corrective RAG (`agents/corrective_rag/.env`)
```env
OPENROUTER_API_KEY=your_openrouter_api_key
TAVILY_API_KEY=your_tavily_api_key
```

---

## 🚀 Getting Started (Local Development)

### Run with Docker Compose (Recommended)
Build and spin up all services in detached mode:
```bash
docker compose up --build -d
```

Once running, the services will be available at:
* **Frontend UI**: `http://localhost:3000`
* **Backend API Docs**: `http://localhost:8000/docs`
* **Agentic RAG**: `http://localhost:8001`
* **Autonomous RAG**: `http://localhost:8002`
* **Corrective RAG**: `http://localhost:8003`

### Run Locally (Without Docker)

1. **Start Qdrant**:
   Ensure a local Qdrant server is running on `http://localhost:6333` or let the corrective RAG agent fallback to its local disk database SQLite instance automatically.
   
2. **Start Backend**:
   ```bash
   cd backend
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
   
3. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Start Agents**:
   Navigate to each folder in `agents/`, activate virtual environments, install `requirements.txt`, and run using uvicorn pointing to their servers (ports 8001, 8002, 8003).

---

## 📈 Database Schema Setup

Supabase handles application state. Ensure you have the following tables:
* `agents`: Store agent definitions (endpoint URL, description, ID).
* `benchmark_tasks`: Holds evaluation tasks (question, context, ground truth, task type).
* `eval_runs`: History of evaluation runs (scores, latency, cost, drift flags).
* `run_traces`: Detailed step-by-step logs of queries executed during a run.
* `auto_rag_storage` (in schema `ai`): Chat history cache for Autonomous RAG.
* `auto_rag_docs` (in schema `ai`): PgVector table storing chunks for Autonomous RAG.
