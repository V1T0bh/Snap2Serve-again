import json
import os
from anthropic import Anthropic
from fastapi import HTTPException

api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    raise RuntimeError("ANTHROPIC_API_KEY is not set")

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")
client = Anthropic(api_key=api_key)

SYSTEM = """You are a cooking assistant.
Given ingredients and a dish preference, output JSON with:
- recipes: array of 3 recipe ideas (title + short steps + missing_items)
- shopping_list: merged missing items grouped by category
Keep steps short and practical.
"""

async def recommend_recipes(ingredients: list[str], preference: str):
    msg = f"""
Ingredients I have: {ingredients}
What I want: {preference}

Return ONLY valid JSON. Do not wrap in markdown. Do not include commentary.
"""

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=800,
            system=SYSTEM,
            messages=[{"role": "user", "content": msg}],
        )
    except Exception as e:
        # Make Anthropic failures readable instead of mysterious 500s
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    text = resp.content[0].text.strip()

    # Parse model output into actual JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # If Claude ever returns extra text, you still get something debuggable
        raise HTTPException(status_code=502, detail={"error": "Model returned invalid JSON", "raw": text})
