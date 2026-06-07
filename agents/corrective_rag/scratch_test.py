import os
from dotenv import load_dotenv
load_dotenv()

from langchain.schema import Document
from corrective_rag_core import ingest_documents

# Create a dummy document
dummy_doc = Document(
    page_content="This is a test document about Model Context Protocol (MCP). MCP is an open standard that enables developers to build secure, two-way integrations between data sources and LLMs.",
    metadata={"source": "test_script"}
)

try:
    print("Attempting to ingest document...")
    success = ingest_documents([dummy_doc])
    print(f"Ingestion result: {success}")
except Exception as e:
    print("Ingestion failed with exception:")
    print(e)
    import traceback
    traceback.print_exc()
