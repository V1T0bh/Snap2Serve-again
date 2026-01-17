import os
from fastapi import UploadFile
from google.cloud import storage

BUCKET_NAME = os.environ["IMAGE_BUCKET"]

async def upload_image(image_id: str, upload_file: UploadFile) -> str:
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)

    # keep original extension if you want
    blob = bucket.blob(f"uploads/{image_id}_{upload_file.filename}")
    content = await upload_file.read()
    blob.upload_from_string(content, content_type=upload_file.content_type)

    return f"gs://{BUCKET_NAME}/{blob.name}"
