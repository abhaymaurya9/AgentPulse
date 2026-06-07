import streamlit as st
from agno.agent import Agent
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.models.openai.like import OpenAILike
from agno.knowledge.knowledge import Knowledge
from agno.tools.reasoning import ReasoningTools
from agno.vectordb.lancedb import LanceDb, SearchType
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="Agentic RAG with Reasoning",
    page_icon="🧐",
    layout="wide"
)

# Main title and description
st.title("🧐 Agentic RAG with Reasoning")
st.markdown("""
This app demonstrates an AI agent that:
1. **Retrieves** relevant information from knowledge sources
2. **Reasons** through the information step-by-step
3. **Answers** your questions with citations

Enter your Google API key below to get started!
""")

# API Key Section
st.subheader("🔑 Google API Key")

openrouter_key = st.text_input(
    "OpenRouter API Key",
    type="password",
    value=os.getenv("OPENROUTER_API_KEY", "")
)

# Check if API key is provided
if openrouter_key:

    # Initialize URLs in session state
    if "knowledge_urls" not in st.session_state:
        st.session_state.knowledge_urls = [
            "https://www.theunwindai.com/p/mcp-vs-a2a-complementing-or-supplementing"
        ]

    if "urls_loaded" not in st.session_state:
        st.session_state.urls_loaded = set()

    @st.cache_resource(show_spinner="📚 Loading knowledge base...")
    def load_knowledge() -> Knowledge:
        kb = Knowledge(
            vector_db=LanceDb(
                uri="tmp/lancedb",
                table_name="agno_docs",
                search_type=SearchType.vector,
                embedder=FastEmbedEmbedder(),
            ),
        )
        return kb

    @st.cache_resource(show_spinner="🤖 Loading agent...")
    def load_agent(_kb: Knowledge) -> Agent:
        return Agent(
            model=OpenAILike(
                id="openai/gpt-oss-120b:free",
                api_key=openrouter_key,
                base_url="https://openrouter.ai/api/v1",
            ),
            knowledge=_kb,
            search_knowledge=True,
            tools=[ReasoningTools(add_instructions=True)],
            instructions=[
                "Include sources in your response.",
                "Always search your knowledge before answering the question.",
            ],
            markdown=True,
        )

    knowledge = load_knowledge()

    for url in st.session_state.knowledge_urls:
        if url not in st.session_state.urls_loaded:
            knowledge.add_content(url=url)
            st.session_state.urls_loaded.add(url)

    agent = load_agent(knowledge)

    # Sidebar
    with st.sidebar:
        st.header("📚 Knowledge Sources")
        st.markdown("Add URLs to expand the knowledge base:")

        st.write("**Current sources:**")
        for i, url in enumerate(st.session_state.knowledge_urls):
            st.text(f"{i+1}. {url}")

        st.divider()

        new_url = st.text_input(
            "Add new URL",
            placeholder="https://example.com/article",
            help="Enter a URL to add to the knowledge base"
        )

        if st.button("➕ Add URL", type="primary"):
            if new_url:
                if new_url not in st.session_state.knowledge_urls:
                    st.session_state.knowledge_urls.append(new_url)

                with st.spinner("📥 Loading new documents..."):
                    if new_url not in st.session_state.urls_loaded:
                        knowledge.add_content(url=new_url)
                        st.session_state.urls_loaded.add(new_url)

                st.success(f"✅ Added: {new_url}")
                st.rerun()
            else:
                st.error("Please enter a URL")

    st.divider()
    st.subheader("🤔 Ask a Question")

    st.markdown("**Try these prompts:**")

    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("What is MCP?", use_container_width=True):
            st.session_state.query = (
                "What is MCP (Model Context Protocol) and how does it work?"
            )

    with col2:
        if st.button("MCP vs A2A", use_container_width=True):
            st.session_state.query = (
                "How do MCP and A2A protocols differ, and are they complementary or competing?"
            )

    with col3:
        if st.button("Agent Communication", use_container_width=True):
            st.session_state.query = (
                "How do MCP and A2A work together in AI agent systems for communication and tool access?"
            )

    query = st.text_area(
        "Your question:",
        value=st.session_state.get(
            "query",
            "What is the difference between MCP and A2A protocols?"
        ),
        height=100,
    )

    if st.button("🚀 Get Answer with Reasoning", type="primary"):

        if query:

            col1, col2 = st.columns([1, 1])

            with col1:
                st.markdown("### 🧠 Reasoning Process")
                reasoning_placeholder = st.empty()

            with col2:
                st.markdown("### 💡 Answer")
                answer_placeholder = st.empty()

            citations = []
            answer_text = ""
            reasoning_text = ""

            with st.spinner("🔍 Searching and reasoning..."):

                for chunk in agent.run(
                    query,
                    stream=True,
                    stream_events=True,
                ):

                    if (
                        hasattr(chunk, "reasoning_content")
                        and chunk.reasoning_content
                    ):
                        reasoning_text = chunk.reasoning_content
                        reasoning_placeholder.markdown(reasoning_text)

                    if (
                        hasattr(chunk, "content")
                        and chunk.content
                        and isinstance(chunk.content, str)
                    ):
                        answer_text += chunk.content
                        answer_placeholder.markdown(answer_text)

                    if hasattr(chunk, "citations") and chunk.citations:
                        if (
                            hasattr(chunk.citations, "urls")
                            and chunk.citations.urls
                        ):
                            citations = chunk.citations.urls

            if citations:
                st.divider()
                st.subheader("📚 Sources")

                for cite in citations:
                    title = cite.title or cite.url
                    st.markdown(f"- [{title}]({cite.url})")

        else:
            st.error("Please enter a question")

else:

    st.info("""
👋 **Welcome! To use this app, you need a Google API Key**

Get your Gemini API key from:

https://aistudio.google.com/apikey

The same key will be used for:
- Gemini model
- Gemini embeddings

Paste your API key above and start chatting.
""")

st.divider()

with st.expander("📖 How This Works"):
    st.markdown("""
**This app uses the Agno framework to create an intelligent Q&A system:**

1. Knowledge Loading: URLs are processed and stored in LanceDB
2. Vector Search: Uses Gemini embeddings
3. Reasoning Tools: The agent thinks step-by-step
4. Gemini AI: Generates answers from retrieved context

**Key Components:**

- Knowledge
- LanceDb
- GeminiEmbedder
- ReasoningTools
- Gemini
- Agent
""")