import streamlit as st
import tempfile
import os
import pprint
from langchain.schema import Document
from dotenv import load_dotenv

# Load local environment variables (.env)
load_dotenv()

# Import from core module
from corrective_rag_core import (
    app,
    load_documents,
    ingest_documents
)

def initialize_session_state():
    """Initialize session state variables for API keys and URLs."""
    if 'initialized' not in st.session_state:
        st.session_state.initialized = False
        st.session_state.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        st.session_state.tavily_api_key = os.getenv("TAVILY_API_KEY", "")
        st.session_state.qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
        st.session_state.qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        st.session_state.doc_url = "https://arxiv.org/pdf/2307.09288.pdf"  
        
def setup_sidebar():
    """Setup sidebar for API keys and configuration."""
    with st.sidebar:
        st.subheader("API Configuration")
        
        # Read initial values from environment or session state
        openrouter_api_key = st.text_input(
            "OpenRouter API Key",
            value=st.session_state.openrouter_api_key,
            type="password"
        )   
        tavily_api_key = st.text_input(
            "Tavily API Key", 
            value=st.session_state.tavily_api_key, 
            type="password"
        )
        qdrant_url = st.text_input(
            "Qdrant URL", 
            value=st.session_state.qdrant_url
        )
        qdrant_api_key = st.text_input(
            "Qdrant API Key", 
            value=st.session_state.qdrant_api_key, 
            type="password"
        )
        doc_url = st.text_input(
            "Document URL", 
            value=st.session_state.doc_url
        )
        
        # Save to session state
        st.session_state.openrouter_api_key = openrouter_api_key
        st.session_state.tavily_api_key = tavily_api_key
        st.session_state.qdrant_url = qdrant_url
        st.session_state.qdrant_api_key = qdrant_api_key
        st.session_state.doc_url = doc_url
        
        # Export to environment variables for the core logic
        os.environ["OPENROUTER_API_KEY"] = openrouter_api_key
        os.environ["TAVILY_API_KEY"] = tavily_api_key
        os.environ["QDRANT_URL"] = qdrant_url
        os.environ["QDRANT_API_KEY"] = qdrant_api_key
        
        if not all([openrouter_api_key, qdrant_url]):
            st.warning("Please provide the required API keys and Qdrant URL")
            st.stop()
        
        st.session_state.initialized = True

initialize_session_state()
setup_sidebar()

st.subheader("Document Input")
input_option = st.radio("Choose input method:", ["URL", "File Upload"])

docs = None  

if input_option == "URL":
    url = st.text_input("Enter document URL:", value=st.session_state.doc_url)
    if url:
        docs = load_documents(url, is_url=True)
else:
    uploaded_file = st.file_uploader("Upload a document", type=['pdf', 'txt', 'md'])
    if uploaded_file:
        file_extension = os.path.splitext(uploaded_file.name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            tmp_file.write(uploaded_file.getvalue())
            tmp_path = tmp_file.name
            
        docs = load_documents(tmp_path, is_url=False)
        os.unlink(tmp_path)

if docs:
    # Hash the documents to check if they have changed or have already been ingested
    import hashlib
    docs_content = "".join([doc.page_content for doc in docs])
    docs_hash = hashlib.md5(docs_content.encode('utf-8')).hexdigest()
    
    if st.session_state.get("last_ingested_hash") != docs_hash:
        with st.spinner("Ingesting documents into Qdrant..."):
            success = ingest_documents(docs)
            if success:
                st.session_state.last_ingested_hash = docs_hash
                st.success("Successfully ingested documents and initialized retriever!")
            else:
                st.error("Failed to ingest documents into Qdrant.")
    else:
        st.info("Documents already indexed in Qdrant (loaded from cache).")

def format_document(doc: Document) -> str:
    return f"""
    Source: {doc.metadata.get('source', 'Unknown')}
    Title: {doc.metadata.get('title', 'No title')}
    Content: {doc.page_content[:200]}...
    """

def format_state(state: dict) -> dict:
    formatted = {}
    for key, value in state.items():
        if key == "documents":
            formatted[key] = [format_document(doc) for doc in value]
        else:
            formatted[key] = value
    return formatted

st.title("🔄 Corrective RAG Agent")
st.text("A possible query: What are the experiment results and ablation studies in this research paper?")

# Try to draw the workflow graph as an image
try:
    st.image(
        app.get_graph().draw_mermaid_png(),
        caption="Corrective RAG Workflow"
    )
except Exception:
    pass

user_question = st.text_input("Please enter your question:")

if user_question:
    inputs = {
        "keys": {
            "question": user_question,
        }
    }

    last_value = None
    
    # Run the stream and print steps
    for output in app.stream(inputs):
        for key, value in output.items():
            last_value = value
            with st.expander(f"Step '{key}':"):
                st.text(pprint.pformat(format_state(value["keys"]), indent=2, width=80))

    if last_value:
        final_generation = last_value['keys'].get(
            'generation',
            'No final generation produced.'
        )
        documents = last_value['keys'].get('documents', [])

        st.subheader("Retrieved Sources")
        shown = set()
        for doc in documents:
            source = doc.metadata.get("source", "")
            if source and source not in shown:
                st.write(source)
                shown.add(source)

        st.subheader("Final Generation:")
        st.write(final_generation)
    else:
        st.warning("No workflow state was produced.")
