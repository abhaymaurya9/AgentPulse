import os
from dotenv import load_dotenv
load_dotenv()

from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.duckduckgo import DuckDuckGoTools

gemini_key = os.getenv("GEMINI_API_KEY")

for model_id in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.5-pro"]:
    print(f"--- Testing {model_id} ---")
    agent = Agent(
        model=Gemini(id=model_id, api_key=gemini_key),
        tools=[DuckDuckGoTools()],
        markdown=True,
    )
    try:
        response = agent.run("Hi, say hello!")
        print("Success!", response.content)
        break
    except Exception as e:
        print("Failed:", e)
