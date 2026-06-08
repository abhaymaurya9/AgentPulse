import os
from dotenv import load_dotenv
load_dotenv()

from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from agno.tools.duckduckgo import DuckDuckGoTools

openrouter_key = os.getenv("OPENROUTER_API_KEY")

agent = Agent(
    model=OpenAILike(
        id="meta-llama/llama-3.3-70b-instruct:free",
        api_key=openrouter_key,
        base_url="https://openrouter.ai/api/v1"
    ),
    tools=[DuckDuckGoTools()],
    markdown=True,
    debug_mode=True,
)

try:
    response = agent.run("What is the weather in Delhi right now?")
    print("RESPONSE CONTENT:", getattr(response, "content", response))
except Exception as e:
    print("Caught exception:", e)
