from agno.agent import Agent
from agno.models.groq import Groq
from agno.models.openai.like import OpenAILike
from agno.tools.duckduckgo import DuckDuckGoTools

agent_groq = Agent(
    model=Groq(id="llama-3.3-70b-versatile"),
    tools=[DuckDuckGoTools()],
)

agent_or = Agent(
    model=OpenAILike(id="meta-llama/llama-3.3-70b-instruct:free", base_url="https://openrouter.ai/api/v1"),
    tools=[DuckDuckGoTools()],
)

# Print instructions and prompts
print("GROQ AGENT INSTRUCTIONS:")
print(agent_groq.instructions)

print("\nOPENROUTER AGENT INSTRUCTIONS:")
print(agent_or.instructions)
