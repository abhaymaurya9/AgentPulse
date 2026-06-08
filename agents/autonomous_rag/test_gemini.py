import os
from dotenv import load_dotenv
load_dotenv()

from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.duckduckgo import DuckDuckGoTools

gemini_key = os.getenv("GEMINI_API_KEY")
print("GEMINI KEY:", gemini_key[:5] + "..." if gemini_key else "None")

agent = Agent(
    model=Gemini(id="gemini-1.5-flash", api_key=gemini_key),
    tools=[DuckDuckGoTools()],
    markdown=True,
    debug_mode=True,
)

try:
    response = agent.run("What is the weather in Delhi right now?")
    print("RESPONSE TYPE:", type(response))
    print("RESPONSE CONTENT:", getattr(response, "content", response))
except Exception as e:
    print("Caught exception:", e)
