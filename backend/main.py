from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.agents import router as agents_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router)


@app.get("/")
def root():
    return {"message": "AgentPulse Backend Running"}