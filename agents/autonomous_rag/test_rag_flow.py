import os
from dotenv import load_dotenv
load_dotenv()

from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from agno.knowledge.knowledge import Knowledge
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.vectordb.pgvector import PgVector, SearchType
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

openrouter_key = os.getenv("OPENROUTER_API_KEY")
supabase_db_url = os.getenv("SUPABASE_DB_URL")

engine = create_engine(supabase_db_url, poolclass=NullPool)

# Initialize Agent
agent = Agent(
    id="test_rag_agent",
    model=OpenAILike(
        id="openai/gpt-oss-120b:free",
        api_key=openrouter_key,
        base_url="https://openrouter.ai/api/v1"
    ),
    knowledge=Knowledge(
        vector_db=PgVector(
            table_name="test_rag_docs",
            db_engine=engine,
            search_type=SearchType.vector,
            embedder=FastEmbedEmbedder(),
        ),
        max_results=3,
    ),
    search_knowledge=True,
    markdown=True,
    debug_mode=True,
)

# 1. Write a unique secret fact to a text file
fact_content = "The secret agent Abhay's favorite color is magenta and his absolute favorite food is biryani. He loves to eat it on Sundays."
fact_file = "abhay_secret_fact.txt"
with open(fact_file, "w") as f:
    f.write(fact_content)

print("--- Ingesting document into Supabase (FastEmbed + PgVector) ---")
try:
    agent.knowledge.add_content(path=fact_file)
    print("Ingestion successful!")
    
    print("\n--- Querying Agent for the secret fact ---")
    response = agent.run("What is the secret agent Abhay's favorite color and food according to the knowledge base?")
    print("\n--- Agent Response ---")
    print(getattr(response, "content", str(response)))
    
finally:
    # Cleanup local text file
    if os.path.exists(fact_file):
        os.remove(fact_file)
    print("\n--- Test finished and cleaned up ---")
