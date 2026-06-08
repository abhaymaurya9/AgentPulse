import requests

response = requests.get("https://openrouter.ai/api/v1/models")
if response.status_code == 200:
    models = response.json().get("data", [])
    free_models = []
    for model in models:
        # Check if the pricing is free or if it has ":free" in the ID
        pricing = model.get("pricing", {})
        prompt_cost = float(pricing.get("prompt", 0))
        completion_cost = float(pricing.get("completion", 0))
        model_id = model.get("id", "")
        if prompt_cost == 0 and completion_cost == 0 or ":free" in model_id:
            free_models.append((model_id, model.get("name", "")))
            
    print("Found free models:")
    for m_id, name in free_models:
        print(f"- {m_id} ({name})")
else:
    print("Failed to fetch models:", response.status_code, response.text)
