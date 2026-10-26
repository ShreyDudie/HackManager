import json
import os
from hmac import compare_digest

from fastapi import FastAPI, File, Header, HTTPException, UploadFile

from face_processing import compare_embeddings, get_normalized_embedding
from image_utils import decode_image

app = FastAPI(docs_url=None, redoc_url=None)
SERVICE_KEY = os.environ.get("FACE_SERVICE_KEY", "development-face-service-key")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def authorize(key: str | None):
    if not key or not compare_digest(key, SERVICE_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized face-service request")


async def read_image(file: UploadFile):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="An image upload is required")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 5MB limit")
    _, image_rgb = decode_image(data)
    if image_rgb is None:
        raise HTTPException(status_code=400, detail="Invalid or oversized image")
    return image_rgb


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/internal/face/embedding")
async def embedding(file: UploadFile = File(...), x_face_service_key: str | None = Header(default=None)):
    authorize(x_face_service_key)
    try:
        value, quality = get_normalized_embedding(await read_image(file))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="Face detector is unavailable") from error
    return {"embedding": value.tolist(), "quality": quality}


@app.post("/internal/face/compare")
async def compare(file: UploadFile = File(...), references: str = "[]", x_face_service_key: str | None = Header(default=None)):
    authorize(x_face_service_key)
    try:
        parsed_references = json.loads(references)
        if not isinstance(parsed_references, list) or len(parsed_references) > 25:
            raise ValueError("References must be a list of at most 25 embeddings")
        value, quality = get_normalized_embedding(await read_image(file))
        similarity, match_index = compare_embeddings(value, parsed_references)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="Face detector is unavailable") from error
    return {"similarity": similarity, "matchIndex": match_index, "quality": quality}
