from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
from app.services.vision_service import detect_ingredients_via_cv

router = APIRouter()

@router.post("/image")
async def upload_image_route(image: UploadFile = File(...)) -> Dict[str, Any]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    image_bytes = await image.read()

    cv_result = await detect_ingredients_via_cv(
        image_bytes=image_bytes,
        filename=image.filename or "image.jpg",
        content_type=image.content_type or "application/octet-stream",
    )

    # Ensure shape is what frontend expects
    if "ingredients_detected" not in cv_result:
        raise HTTPException(status_code=502, detail={"error": "CV response missing ingredients_detected", "raw": cv_result})

    return {
        "ingredients_detected": cv_result["ingredients_detected"]
    }

