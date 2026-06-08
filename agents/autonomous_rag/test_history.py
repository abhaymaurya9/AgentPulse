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

try:
    response = agent.run("Search the weather in Delhi and then tell me if it's hot.")
except Exception as e:
    print("Caught expected exception:", e)

print("\n--- AGENT MEMORY MESSAGES ---")
for msg in agent.memory.messages:
    print(f"Role: {msg.role}")
    print(f"Content: {msg.content}")
    if hasattr(msg, "tool_calls") and msg.tool_calls:
        print(f"Tool Calls: {msg.tool_calls}")
    print("-" * 40)
