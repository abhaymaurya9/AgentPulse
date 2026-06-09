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
