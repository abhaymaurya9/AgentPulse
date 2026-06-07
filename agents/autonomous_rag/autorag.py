import streamlit as st
import nest_asyncio
from io import BytesIO
from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from agno.models.google import Gemini
from agno.models.groq import Groq
from agno.knowledge.knowledge import Knowledge
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.vectordb.pgvector import PgVector, SearchType
from agno.db.postgres import PostgresDb
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

# Load local environment variables (.env)
load_dotenv()

# Apply nest_asyncio to allow nested event loops in Streamlit
nest_asyncio.apply()

# Function to set up the Assistant
@st.cache_resource
def setup_assistant(provider: str, api_key: str, model_id: str) -> Agent:
    """Initializes and returns an AI Assistant agent with caching for efficiency.
    
    This assistant is configured with:
    - Model: Custom LLM via OpenAI-compatible endpoints (Groq or OpenRouter)
    - Database: Supabase Postgres for session persistence
    - Knowledge Base: Supabase Postgres (PgVector) with local FastEmbedEmbedder (free)
    - Web search: DuckDuckGo search tool
    """
    supabase_db_url = os.getenv("SUPABASE_DB_URL")
    if not supabase_db_url:
        raise ValueError("SUPABASE_DB_URL environment variable is missing in .env")

    # Instantiate LLM based on provider
    if provider == "Gemini":
        llm = Gemini(
            id=model_id,
            api_key=api_key
        )
    elif provider == "Groq":
        llm = Groq(
            id=model_id,
            api_key=api_key
        )
    else:
        # Configure base URL based on provider
        if provider == "OpenRouter":
            base_url = "https://openrouter.ai/api/v1"
        else:
            base_url = None

        llm = OpenAILike(
            id=model_id,
            api_key=api_key,
            base_url=base_url
        )

    # Create a database engine with NullPool to avoid exceeding connection limits on Supabase
    engine = create_engine(supabase_db_url, poolclass=NullPool)

    # Set up the Agent with postgres db engine and pgvector knowledge base engine in Supabase
    return Agent(
        id="auto_rag_agent",
        model=llm,
        db=PostgresDb(db_engine=engine, session_table="auto_rag_storage"),  
        knowledge=Knowledge(
            vector_db=PgVector(
                table_name="auto_rag_docs",
                db_engine=engine,
                search_type=SearchType.vector,
                embedder=FastEmbedEmbedder(),  
            ),
            max_results=3,  
        ),
        tools=[DuckDuckGoTools()],  
        instructions=[
            "Search your knowledge base first.",  
            "If not found, search the internet.",  
            "Provide clear and concise answers.",  
            "CRITICAL: Always use native function calling parameters. Do NOT wrap tool calls in XML-like tags like '<function=...>' or '</function>'. Generate only the native tool call arguments.",
        ],
        search_knowledge=True,  
        markdown=True,  
        debug_mode=True,  
        debug_level=2,
    )

# Function to add a PDF document to the knowledge base
def add_document(agent: Agent, file: BytesIO, filename: str):
    import tempfile
    
    file_extension = os.path.splitext(filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
        tmp_file.write(file.getvalue())
        tmp_path = tmp_file.name
        
    try:
        agent.knowledge.add_content(path=tmp_path)
        st.success("Document successfully added to the Supabase knowledge base!")
    except Exception as e:
        st.error(f"Failed to add document to knowledge base: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

# Function to query the Assistant and return a response
def query_assistant(agent: Agent, question: str):
    return agent.run(question)

# Main function to handle Streamlit app layout and interactions
def main():
    st.set_page_config(page_title="AutoRAG", layout="wide")
    st.title("🤖 Auto-RAG: Autonomous RAG with Supabase & Free APIs")

    # Read API Keys from environment
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")

    # Build provider choices
    providers = []
    if gemini_api_key:
        providers.append("Google Gemini (Studio)")
    if groq_api_key:
        providers.append("Groq (Free)")
    if openrouter_api_key:
        providers.append("OpenRouter (Free)")
    providers.append("Manual OpenAI")

    st.sidebar.subheader("Provider Configuration")
    selected_provider = st.sidebar.selectbox("Select LLM Provider", providers)

    # Resolve active configuration based on selection
    if selected_provider == "Google Gemini (Studio)":
        provider_name = "Gemini"
        api_key = gemini_api_key
        model_id = st.sidebar.selectbox("Select Model", ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"])
    elif selected_provider == "Groq (Free)":
        provider_name = "Groq"
        api_key = groq_api_key
        model_id = st.sidebar.selectbox("Select Model", ["llama-3.3-70b-versatile", "llama3-8b-8192"])
    elif selected_provider == "OpenRouter (Free)":
        provider_name = "OpenRouter"
        api_key = openrouter_api_key
        model_id = st.sidebar.selectbox(
            "Select Model",
            [
                "openai/gpt-oss-120b:free",
                "openai/gpt-oss-20b:free",
                "google/gemma-4-26b-a4b-it:free",
                "qwen/qwen3-next-80b-a3b-instruct:free",
                "openrouter/free"
            ]
        )
    else:
        provider_name = "OpenAI"
        api_key = st.sidebar.text_input("Enter OpenAI API Key", type="password")
        model_id = st.sidebar.selectbox("Select Model", ["gpt-4o-mini", "gpt-4o"])

    if not api_key:
        st.sidebar.warning("API Key is missing. Please set it in your .env or enter it manually.")
        st.stop()

    # Initialize assistant agent
    try:
        assistant = setup_assistant(provider_name, api_key, model_id)
        st.sidebar.success(f"Connected to Supabase & {provider_name} successfully!")
    except Exception as e:
        st.sidebar.error(f"Failed to initialize assistant: {e}")
        st.stop()
        
    uploaded_file = st.sidebar.file_uploader("📄 Upload PDF", type=["pdf"])
    
    if uploaded_file and st.sidebar.button("🛠️ Add to Knowledge Base"):
        with st.spinner("Ingesting PDF into Supabase..."):
            add_document(assistant, BytesIO(uploaded_file.read()), uploaded_file.name)

    question = st.text_input("💬 Ask Your Question:")
    
    # When the user submits a question, query the assistant for an answer
    if st.button("🔍 Get Answer"):
        if question.strip():
            with st.spinner("🤔 Thinking..."):
                try:
                    response = query_assistant(assistant, question)
                    answer = ""
                    if hasattr(response, "content"):
                        answer = response.content
                    else:
                        answer = str(response)
                    st.write("📝 **Response:**", answer)
                except Exception as e:
                    st.error(f"Error executing query: {e}")
        else:
            st.error("Please enter a question.")

if __name__ == "__main__":
    main()
