import os
from groq import Groq

api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key)

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Use this function to search the knowledge base for information about a query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The query to search for."}
                },
                "required": ["query"],
                "additionalProperties": False
            }
        }
    }
]

def test_prompt(name, instructions):
    messages = [
        {"role": "system", "content": instructions},
        {"role": "user", "content": "Is Abhay's favorite color also his absolute favorite?"}
    ]
    try:
        res = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools,
            temperature=0.0
        )
        print(f"{name}: Success!")
        print("Response:", res.choices[0].message)
    except Exception as e:
        print(f"{name}: Failed!")
        print("Error:", str(e))

base_prompt = """- Search your knowledge base first.
- If not found, search the internet.
- Provide clear and concise answers.
<additional_information>
- Use markdown to format your answers.
</additional_information>

<knowledge_base>
You have a knowledge base you can search using the search_knowledge_base tool. Search before answering questions—don't assume you know the answer. For ambiguous questions, search first rather than asking for clarification.
</knowledge_base>"""

# Option 1: Instruction to construct XML tag correctly
prompt1 = base_prompt + "\nCRITICAL: If you call a function, you MUST use the format: <function=tool_name>{\"arg\": \"val\"}</function> with the closing angle bracket '>' after the tool name."
test_prompt("Option 1 (XML Tag Correctness)", prompt1)

# Option 2: Instruction to use native tool calling structure and NOT output XML tags
prompt2 = base_prompt + "\nCRITICAL: Do not output function calls as raw XML tags or text like <function=...>. Use standard tool calling."
test_prompt("Option 2 (Forbid XML Tags)", prompt2)

# Option 3: Instruct on exact format of tool calling tags
prompt3 = base_prompt + "\nCRITICAL: When generating a function call, always write `<function=tool_name>` followed by arguments JSON and then `</function>`. Do not omit the `>` bracket."
test_prompt("Option 3 (Format check)", prompt3)
