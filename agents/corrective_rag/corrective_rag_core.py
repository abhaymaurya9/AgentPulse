from langchain import hub
from langchain.output_parsers import PydanticOutputParser
from langchain_core.output_parsers import StrOutputParser
from langchain.schema import Document
from pydantic import BaseModel, Field
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader, WebBaseLoader
from langchain_community.tools import TavilySearchResults
from langchain_community.vectorstores import Qdrant
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.messages import HumanMessage        
from langgraph.graph import END, StateGraph
from typing import Dict, TypedDict
from langchain_core.prompts import PromptTemplate
import pprint
import yaml
import nest_asyncio
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import tempfile
import os
from langchain_openai import ChatOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv

# Load local environment variables (.env)
load_dotenv()

nest_asyncio.apply()

# Initialize embeddings
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Global retriever reference
retriever = None

def get_qdrant_client():
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
    
    try:
        # Try to connect to configured Qdrant server with a short timeout
        client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key, timeout=2.0)
        # Test the connection by getting collections
        client.get_collections()
        print(f"Successfully connected to Qdrant server at {qdrant_url}")
        return client
    except Exception as e:
        # Connection failed or refused, fallback to local disk storage
        print(f"Could not connect to Qdrant server at {qdrant_url} ({e}). Falling back to local disk database ('local_qdrant_db').")
        os.makedirs("local_qdrant_db", exist_ok=True)
        return QdrantClient(path="local_qdrant_db")

# get_retriever is deprecated in favor of dynamic client management to avoid database locks
def get_retriever():
    return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def execute_tavily_search(tool, query):
    return tool.invoke({"query": query})


def web_search(state):
    """Web search based on the re-phrased question using Tavily API."""
    print("~-web search-~")
    state_dict = state["keys"]
    question = state_dict["question"]
    documents = state_dict["documents"]
    
    try:
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        if not tavily_api_key:
            print("Warning: Tavily API key not provided - skipping web search")
            return {"keys": {"documents": documents, "question": question}}
        
        os.environ["TAVILY_API_KEY"] = tavily_api_key
        tool = TavilySearchResults(
            max_results=3,
            search_depth="advanced"
        )
        
        print("Executing Tavily web search...")
        try:
            search_results = execute_tavily_search(tool, question)
            print("Tavily search completed successfully.")
        except Exception as search_error:
            print(f"Search failed after retries: {str(search_error)}")
            return {"keys": {"documents": documents, "question": question}}
        
        if not search_results:
            print("No search results returned.")
            return {"keys": {"documents": documents, "question": question}}
        
        web_results = []
        for result in search_results:
            title = result.get("title", "")
            content = result.get("content", "")
            url = result.get("url", "")

            web_results.append(
                f"Title: {title}\n"
                f"URL: {url}\n"
                f"Content: {content}\n"
            )
        
        web_document = Document(
            page_content="\n\n".join(web_results),
            metadata={
                "source": "tavily_search",
                "query": question,
                "result_count": len(web_results)
            }
        )
        documents.append(web_document)
        print(f"Successfully added {len(web_results)} web search results.")
        
    except Exception as error:
        print(f"Web search error: {str(error)}")
        
    return {"keys": {"documents": documents, "question": question}}


def load_documents(file_or_url: str, is_url: bool = True) -> list:
    try:
        if is_url:
            if file_or_url.endswith(".pdf"):
                loader = PyPDFLoader(file_or_url)
            else:
                loader = WebBaseLoader(file_or_url)
            loader.requests_per_second = 1
        else:
            file_extension = os.path.splitext(file_or_url)[1].lower()
            if file_extension == '.pdf':
                loader = PyPDFLoader(file_or_url)
            elif file_extension in ['.txt', '.md']:
                loader = TextLoader(file_or_url)
            else:
                raise ValueError(f"Unsupported file type: {file_extension}")
        
        return loader.load()
    except Exception as e:
        print(f"Error loading document: {str(e)}")
        return []


def ingest_documents(docs: list) -> bool:
    global retriever
    client = None
    try:
        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=500, chunk_overlap=100
        )
        all_splits = text_splitter.split_documents(docs)

        client = get_qdrant_client()
        collection_name = "rag-qdrant"

        # Check if collection exists
        collections = client.get_collections()
        collection_names = [col.name for col in collections.collections]
        if collection_name not in collection_names:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )
        else:
            # Delete existing points with the same source metadata to prevent duplicates
            sources = set()
            for doc in docs:
                source = doc.metadata.get("source")
                if source:
                    sources.add(source)
            for source in sources:
                from qdrant_client.models import Filter, FieldCondition, MatchValue
                try:
                    client.delete(
                        collection_name=collection_name,
                        points_selector=Filter(
                            must=[
                                FieldCondition(
                                    key="metadata.source",
                                    match=MatchValue(value=source)
                                )
                            ]
                        )
                    )
                    print(f"Deleted existing chunks for source '{source}' from Qdrant.")
                except Exception as del_err:
                    print(f"Warning: Failed to delete chunks for source '{source}': {del_err}")

        # Create vectorstore
        vectorstore = Qdrant(
            client=client,
            collection_name=collection_name,
            embeddings=embeddings,
        )

        # Add documents to the vectorstore
        vectorstore.add_documents(all_splits)
        print("Documents ingested successfully to Qdrant collection 'rag-qdrant'.")
        return True
    except Exception as e:
        print(f"Error in ingest_documents: {str(e)}")
        return False
    finally:
        if client is not None:
            try:
                client.close()
                print("Closed Qdrant client connection after ingestion.")
            except Exception as ce:
                print(f"Error closing Qdrant client: {ce}")


class GraphState(TypedDict):
    keys: Dict[str, any]


def retrieve(state):
    print("~-retrieve-~")
    state_dict = state["keys"]
    question = state_dict["question"]
    
    client = get_qdrant_client()
    try:
        collections = client.get_collections()
        collection_names = [col.name for col in collections.collections]
        if "rag-qdrant" in collection_names:
            vectorstore = Qdrant(
                client=client,
                collection_name="rag-qdrant",
                embeddings=embeddings,
            )
            documents = vectorstore.as_retriever().get_relevant_documents(question)
            print(f"Retrieved {len(documents)} documents.")
            return {"keys": {"documents": documents, "question": question}}
        else:
            print("Warning: Collection 'rag-qdrant' not found in Qdrant.")
    except Exception as e:
        print(f"Warning: Could not retrieve from Qdrant: {e}")
    finally:
        try:
            client.close()
            print("Closed Qdrant client connection after retrieval.")
        except Exception as ce:
            print(f"Error closing Qdrant client: {ce}")
            
    return {"keys": {"documents": [], "question": question}}


def generate(state):
    """Generate answer using OpenRouter (GPT-4o-mini)"""
    print("~-generate-~")
    state_dict = state["keys"]
    question, documents = state_dict["question"], state_dict["documents"]
    try:
        prompt = PromptTemplate(template="""Based on the following context, please answer the question.
            Context: {context}
            Question: {question}
            Answer:""", input_variables=["context", "question"])
        
        openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        if not openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is not set.")
            
        llm = ChatOpenAI(
            model="openai/gpt-4o-mini",
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0
        )
        context = "\n\n".join(doc.page_content for doc in documents)

        rag_chain = (
            {"context": lambda x: context, "question": lambda x: question} 
            | prompt 
            | llm 
            | StrOutputParser()
        )

        generation = rag_chain.invoke({})

        return {
            "keys": {
                "documents": documents,
                "question": question,
                "generation": generation
            }
        }

    except Exception as e:
        error_msg = f"Error in generate function: {str(e)}"
        print(error_msg)
        return {"keys": {"documents": documents, "question": question, 
                "generation": f"Error: {str(e)}"}}


def grade_documents(state):
    """Determines whether the retrieved documents are relevant."""
    print("~-check relevance-~")
    state_dict = state["keys"]
    question = state_dict["question"]
    documents = state_dict["documents"]

    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_api_key:
        print("Warning: OPENROUTER_API_KEY not set - skipping relevance grading (using all documents).")
        return {"keys": {"documents": documents, "question": question, "run_web_search": "Yes"}}

    llm = ChatOpenAI(
        model="openai/gpt-4o-mini",
        api_key=openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0
    )

    prompt = PromptTemplate(template="""You are grading the relevance of a retrieved document to a user question.
        
        Document: {context}
        Question: {question}
        
        Rules:
        1. If the document contains any sentence, phrase, or fact that answers the question, you MUST grade it as relevant ("yes").
        2. Use extremely lenient grading. Only filter out documents that are completely unrelated to the question.
        3. Do not reject a document just because some sentences in it are irrelevant or noisy.
        4. Explain your reasoning briefly.
        5. At the end, output your final score in JSON format exactly like: {{"score": "yes"}} or {{"score": "no"}}""",
        input_variables=["context", "question"])

    chain = (
        prompt 
        | llm 
        | StrOutputParser()
    )

    filtered_docs = []
    search = "No"
    
    if not documents:
        search = "Yes"
    else:
        for d in documents:
            try:
                response = chain.invoke({"question": question, "context": d.page_content})
                print(f"DEBUG - Question: {question}")
                print(f"DEBUG - Doc: {d.page_content}")
                print(f"DEBUG - Grader raw response: {response}")
                import re
                json_match = re.search(r'\{.*\}', response)
                if json_match:
                    response = json_match.group()
                print(f"DEBUG - Grader parsed JSON: {response}")
                
                import json
                score = json.loads(response)
                
                if score.get("score") == "yes":
                    print("~-grade: document relevant-~")
                    filtered_docs.append(d)
                else:
                    print("~-grade: document not relevant-~")
                    search = "Yes"
                    
            except Exception as e:
                print(f"Error grading document: {str(e)}")
                filtered_docs.append(d)
                continue

    return {"keys": {"documents": filtered_docs, "question": question, "run_web_search": search}}


def transform_query(state):
    """Transform the query to produce a better question."""
    print("~-transform query-~")
    state_dict = state["keys"]
    question = state_dict["question"]
    documents = state_dict["documents"]

    prompt = PromptTemplate(
        template="""Generate a search-optimized version of this question by 
        analyzing its core semantic meaning and intent.
        \n ------- \n
        {question}
        \n ------- \n
        Return only the improved question with no additional text:""",
        input_variables=["question"],
    )

    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    llm = ChatOpenAI(
        model="openai/gpt-4o-mini",
        api_key=openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0
    )

    chain = prompt | llm | StrOutputParser()
    better_question = chain.invoke({"question": question})
    print(f"Transformed question to: {better_question}")

    return {
        "keys": {"documents": documents, "question": better_question}
    }


def decide_to_generate(state):
    print("~-decide to generate-~")
    state_dict = state["keys"]
    search = state_dict["run_web_search"]

    if search == "Yes":
        print("~-decision: transform query and run web search-~")
        return "transform_query"
    else:
        print("~-decision: generate-~")
        return "generate"


# Build the Graph Workflow
workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve) 
workflow.add_node("grade_documents", grade_documents)  
workflow.add_node("generate", generate) 
workflow.add_node("transform_query", transform_query)  
workflow.add_node("web_search", web_search) 

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "grade_documents")
workflow.add_conditional_edges(
    "grade_documents",
    decide_to_generate,
    {
        "transform_query": "transform_query",
        "generate": "generate",
    },
)
workflow.add_edge("transform_query", "web_search")
workflow.add_edge("web_search", "generate")
workflow.add_edge("generate", END)

app = workflow.compile()


def run_corrective_rag(question: str) -> dict:
    inputs = {
        "keys": {
            "question": question
        }
    }
    
    final_state = None
    for output in app.stream(inputs):
        final_state = output
        
    generation = "No final answer produced."
    documents = []
    
    if final_state:
        # Stream outputs are dicts like: {'node_name': {'keys': {...}}}
        for _, value in final_state.items():
            generation = value["keys"].get("generation", generation)
            documents = value["keys"].get("documents", documents)
            
    return {
        "generation": generation,
        "documents": documents
    }
