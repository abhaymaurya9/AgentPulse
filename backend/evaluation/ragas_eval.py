from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
from datasets import Dataset
import os, time, math
import nest_asyncio

# Apply nest_asyncio to allow nested event loops in standard asyncio loop
nest_asyncio.apply()

def get_llm():
    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.1-8b-instant",
        temperature=0
    )

def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

def run_ragas(question, context, ground_truth, agent_answer):
    dataset = Dataset.from_dict({
        "question":     [question],
        "answer":       [agent_answer],
        "contexts":     [[context]],
        "ground_truth": [ground_truth]
    })

    start = time.time()

    result = None
    try:
        result = evaluate(
            dataset=dataset,
            metrics=[
                faithfulness,
                answer_relevancy,
                context_precision,
                context_recall
            ],
            llm=LangchainLLMWrapper(get_llm()),
            embeddings=LangchainEmbeddingsWrapper(get_embeddings())
        )
    except Exception as e:
        print(f"RAGAS evaluation failed, retrying once... Error: {e}")
        time.sleep(2.0)
        try:
            result = evaluate(
                dataset=dataset,
                metrics=[
                    faithfulness,
                    answer_relevancy,
                    context_precision,
                    context_recall
                ],
                llm=LangchainLLMWrapper(get_llm()),
                embeddings=LangchainEmbeddingsWrapper(get_embeddings())
            )
        except Exception as e2:
            print(f"RAGAS evaluation failed on retry. Returning 0.0 scores. Error: {e2}")

    if result is not None:
        try:
            scores = result.to_pandas().to_dict(orient="records")[0]
        except Exception:
            scores = {}
    else:
        scores = {}

    def clean(val):
        try:
            f_val = float(val)
            if math.isnan(f_val) or math.isinf(f_val):
                return 0.0
            return round(f_val, 3)
        except Exception:
            return 0.0

    return {
        "faithfulness":       clean(scores.get("faithfulness", 0)),
        "answer_relevancy":   clean(scores.get("answer_relevancy", 0)),
        "context_precision":  clean(scores.get("context_precision", 0)),
        "context_recall":     clean(scores.get("context_recall", 0)),
        "eval_latency_ms":    int((time.time() - start) * 1000)
    }
