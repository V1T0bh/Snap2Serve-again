import os
import httpx
from fastapi import HTTPException

VISION_URL = os.getenv("VISION_URL", "").rstrip("/")

async def detect_ingredients_via_cv(image_bytes: bytes, filename: str, content_type: str) -> dict:
    if not VISION_URL:
        raise HTTPException(status_code=500, detail="VISION_URL is not set")

    # Your teammate's endpoint must be this path:
    url = f"{VISION_URL}/vision/ingredients"

    files = {
        "image": (filename or "image.jpg", image_bytes, content_type or "application/octet-stream")
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, files=files)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach CV service: {str(e)}")

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={"error": "CV service error", "status": resp.status_code, "body": resp.text},
        )

    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail={"error": "CV service returned non-JSON", "body": resp.text})

    # Validate shape minimally
    if "ingredients_detected" not in data or not isinstance(data["ingredients_detected"], list):
        raise HTTPException(status_code=502, detail={"error": "Unexpected CV response shape", "raw": data})

    return data
