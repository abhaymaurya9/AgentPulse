FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download fastembed model to avoid startup timeouts
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

COPY . .

EXPOSE 8001

CMD ["sh", "-c", "uvicorn agent_server:app --host 0.0.0.0 --port ${PORT:-8001}"]
