# Deployment Guide - AgentPulse

AgentPulse is structured as a multi-service containerized application consisting of:
- **Frontend**: Next.js (`frontend/`)
- **Backend**: FastAPI (`backend/`)
- **Agents**: Python services (`agents/agentic_rag/`, `agents/autonomous_rag/`, `agents/corrective_rag/`)

---

## Option 1: VPS Deployment using Docker Compose (Recommended)

Since the entire application is already containerized and configured via `docker-compose.yml`, deploying to a Virtual Private Server (VPS) like DigitalOcean, AWS EC2, or Hetzner is the most straightforward approach.

### Prerequisites on the VPS
1. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```
2. Install Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install docker-compose-plugin
   ```

### Step-by-Step Deployment
1. **Clone the repository**:
   ```bash
   git clone https://github.com/abhaymaurya9/AgentPulse.git
   cd AgentPulse
   ```
2. **Set up environment variables**:
   Create and populate the `.env` files on the server exactly as they are locally:
   - `./backend/.env`
   - `./frontend/.env.local`
   - `./agents/agentic_rag/.env`
   - `./agents/autonomous_rag/.env`
   - `./agents/corrective_rag/.env`

3. **Start the containers in production mode**:
   ```bash
   docker compose up --build -d
   ```

4. **Set up a Reverse Proxy (Nginx / Caddy)**:
   To expose the frontend (port 3000) and backend (port 8000) securely over HTTPS, configure Caddy or Nginx.
   
   **Example Caddyfile:**
   ```caddy
   yourdomain.com {
       reverse_proxy localhost:3000
   }

   api.yourdomain.com {
       reverse_proxy localhost:8000
   }
   ```

---

## Option 2: PaaS Deployment (Render / Railway / Vercel)

If you prefer managed serverless/container hosting:

### 1. Frontend (Vercel)
- Next.js is best hosted on Vercel.
- Import the repo into Vercel and set the Root Directory to `frontend`.
- Set the Environment Variables (`NEXT_PUBLIC_API_URL` pointing to your deployed backend API URL).

### 2. Backend & Agents (Render / Railway)
You can deploy the backend and agents as individual web services on Render or Railway:
- Create a new Web Service from the repo.
- Specify the subfolder/root directory for each service:
  - **Backend**: Root `./backend`, Build Command: `docker build`, Port: `8000`
  - **Agentic RAG**: Root `./agents/agentic_rag`, Build Command: `docker build`, Port: `8001`
  - **Autonomous RAG**: Root `./agents/autonomous_rag`, Build Command: `docker build`, Port: `8002`
  - **Corrective RAG**: Root `./agents/corrective_rag`, Build Command: `docker build`, Port: `8003`
- Copy the respective environment variables into each PaaS service's dashboard.

---

## Option 3: 100% Free-Tier Deployment Guide

You can deploy the entire stack completely for free by using the free tiers of Vercel, Supabase, and Render or Koyeb.

### 1. Database & Vector Store (Supabase Free Tier)
- Sign up for a free account at [Supabase](https://supabase.com/).
- Create a new project. The free tier gives you a fully functional PostgreSQL database with the `pgvector` extension pre-installed and 500MB of space.
- Retrieve the following configuration fields from the project settings dashboard:
  - `SUPABASE_URL`
  - `SUPABASE_KEY` (anon key)
  - `SUPABASE_DB_URL` (direct connection string for Autonomous RAG session storage)

### 2. Frontend (Vercel Free Hobby Plan)
- Sign up for a free account at [Vercel](https://vercel.com/).
- Connect your GitHub repository.
- Import the project and configure the settings:
  - **Framework Preset**: Next.js
  - **Root Directory**: `frontend`
  - **Environment Variables**:
    - `NEXT_PUBLIC_API_URL`: Your deployed Backend API URL (e.g., `https://agentpulse-backend.onrender.com/api`).
- Deploy! Vercel's hobby plan is 100% free and supports automatic deployments on every commit.

### 3. Backend & Agents (Render Free Tier or Koyeb Free Tier)
The python services (backend, agentic_rag, autonomous_rag, corrective_rag) can be hosted on Render or Koyeb:

#### Option A: Render Free Web Services
- Create a free account at [Render](https://render.com/).
- For each service, create a new **Web Service** pointing to your GitHub repository:
  1. **Backend**:
     - Root Directory: `backend`
     - Runtime: `Docker` (Render automatically detects the Dockerfile in the directory)
     - Environment Variables: `SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`, `RUNNING_IN_DOCKER=false`
  2. **Agentic RAG**:
     - Root Directory: `agents/agentic_rag`
     - Runtime: `Docker`
     - Environment Variables: `GROQ_API_KEY`, `RUNNING_IN_DOCKER=false`
  3. **Autonomous RAG**:
     - Root Directory: `agents/autonomous_rag`
     - Runtime: `Docker`
     - Environment Variables: `GROQ_API_KEY`, `SUPABASE_DB_URL`, `RUNNING_IN_DOCKER=false`
  4. **Corrective RAG**:
     - Root Directory: `agents/corrective_rag`
     - Runtime: `Docker`
     - Environment Variables: `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `RUNNING_IN_DOCKER=false`
- **Important Notes**:
  - Render free instance types will spin down (sleep) after 15 minutes of inactivity. The first query after a spin-down might take ~50 seconds to respond as the instance wakes up.
  - Render gives 750 free hours per month, which is enough to run one instance 24/7, or multiple instances running selectively.

#### Option B: Koyeb Free Tier (No Sleep/Spin-down)
- Sign up at [Koyeb](https://koyeb.com/).
- Koyeb offers a free nano instance (512MB RAM) that runs 24/7 without sleeping. You can deploy your Backend or agents as Docker services by pointing to the repository and setting the Dockerfile directory.
