from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.agents import router as agents_router
from routes.evaluations import router as eval_router
from routes.benchmarks import router as benchmarks_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router, prefix="/api")
app.include_router(eval_router, prefix="/api")
app.include_router(benchmarks_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "AgentPulse Backend Running"}