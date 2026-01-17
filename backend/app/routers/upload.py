import uuid
from fastapi import APIRouter, UploadFile, File
from app.services.storage_service import upload_image

router = APIRouter()

@router.post("/image")
async def upload_image_route(image: UploadFile = File(...)):
    image_id = str(uuid.uuid4())
    gcs_uri = await upload_image(image_id=image_id, upload_file=image)
    return {"image_id": image_id, "gcs_uri": gcs_uri}
