import os
from dotenv import load_dotenv
load_dotenv()

from agno.agent import Agent
from agno.models.groq import Groq
from agno.tools.duckduckgo import DuckDuckGoTools

agent = Agent(
    model=Groq(id="llama-3.3-70b-versatile"),
    tools=[DuckDuckGoTools()],
    markdown=True,
    debug_mode=True,
)

response = agent.run("What is the weather in Delhi right now?")
print("RESPONSE TYPE:", type(response))
print("RESPONSE CONTENT:", getattr(response, "content", response))
