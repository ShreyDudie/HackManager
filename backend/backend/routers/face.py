# routers/face.py

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.security import HTTPBearer
import os
import cv2
import numpy as np
import shutil
import mediapipe as mp
import json

router = APIRouter(prefix="/face", tags=["face"])
security = HTTPBearer()

REGISTER_DIR = "registered_faces"
EMBEDDING_DIR = "face_embeddings"
os.makedirs(REGISTER_DIR, exist_ok=True)
os.makedirs(EMBEDDING_DIR, exist_ok=True)

# MediaPipe Initialization
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=2,
    refine_landmarks=True,
    min_detection_confidence=0.5
)

# Stable Landmark Indices (Subset for embedding)
# Eyes, Nose Bridge, Jaw, Mouth
STABLE_INDICES = [
    # Eyes
    33, 133, 157, 158, 159, 160, 161, 246, 7, 163, 144, 145, 153, 154, 155,
    362, 263, 384, 385, 386, 387, 388, 466, 249, 390, 373, 374, 380, 381, 382,
    # Nose
    1, 2, 98, 327, 168, 6, 197, 195, 5, 4,
    # Mouth
    0, 13, 14, 17, 37, 39, 40, 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267,
    # Jaw / Contour
    10, 338, 297, 332, 284, 251, 389, 356, 454, 152, 234, 127, 162, 21, 54, 103, 67, 109
]

def get_normalized_embedding(img_rgb):
    results = face_mesh.process(img_rgb)
    if not results.multi_face_landmarks:
        return None, "No face detected"
    if len(results.multi_face_landmarks) > 1:
        return None, "Multiple faces detected"

    landmarks = results.multi_face_landmarks[0].landmark
    h, w, _ = img_rgb.shape

    # Quality Check: Bounding Box Size
    xs = [l.x for l in landmarks]
    ys = [l.y for l in landmarks]
    bbox_w = (max(xs) - min(xs)) * w
    bbox_h = (max(ys) - min(ys)) * h
    if bbox_w < 80 or bbox_h < 80:
        return None, "Face too small / far"

    # 1. Normalization Step: Gaussian Smoothing
    pts = np.array([[l.x, l.y, l.z] for l in landmarks])
    
    # 2. Translate: Nose Tip (Index 1) = Origin
    nose_tip = pts[1]
    pts = pts - nose_tip

    # 3. Scale: Based on inter-eye distance
    # Left eye center (approx 133, 33), Right eye center (approx 362, 263)
    left_eye = np.mean([pts[33], pts[133]], axis=0)
    right_eye = np.mean([pts[362], pts[263]], axis=0)
    eye_dist = np.linalg.norm(right_eye - left_eye)
    
    if eye_dist < 0.01:
        return None, "Landmark confidence low"
    
    pts = pts / eye_dist

    # 4. Align Rotation: Eye angle correction
    dy = right_eye[1] - left_eye[1]
    dx = right_eye[0] - left_eye[0]
    angle = np.arctan2(dy, dx)
    
    rotation_matrix = np.array([
        [np.cos(-angle), -np.sin(-angle), 0],
        [np.sin(-angle),  np.cos(-angle), 0],
        [0, 0, 1]
    ])
    pts = pts @ rotation_matrix.T

    # 5. Extract Structured Vector (Stable subset)
    subset = pts[STABLE_INDICES].flatten()

    # 6. L2 Normalization
    norm = np.linalg.norm(subset)
    if norm > 0:
        subset = subset / norm

    return subset, None

# Replace with your actual user-from-token logic
async def get_current_user(token: str = Depends(security)):
    # Your JWT validation code here
    return {"pid": "example_user_123"}

@router.post("/register")
async def face_register(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    pid = current_user["pid"]
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"success": False, "message": "Invalid image format"}

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        embedding, error = get_normalized_embedding(img_rgb)

        if embedding is None:
            return {"success": False, "message": error}

        # Save Image
        final_path = os.path.join(REGISTER_DIR, f"{pid}.jpg")
        cv2.imwrite(final_path, img)

        # Save Embedding (Deterministic)
        emb_path = os.path.join(EMBEDDING_DIR, f"{pid}.json")
        with open(emb_path, "w") as f:
            json.dump(embedding.tolist(), f)

        return {"success": True, "message": f"Face registered for {pid}"}

    except Exception as e:
        return {"success": False, "message": "Detection failed", "error": str(e)}

@router.post("/verify")
async def face_verify(
    file: UploadFile = File(...),
    threshold: float = 0.92,
    current_user = Depends(get_current_user)
):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"success": False, "verified": False, "message": "Invalid image"}

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        captured_emb, error = get_normalized_embedding(img_rgb)

        if captured_emb is None:
            return {"success": False, "verified": False, "message": error, "similarity": 0}

        # Compare against ALL registered embeddings
        similarities = []
        for fname in os.listdir(EMBEDDING_DIR):
            if not fname.endswith(".json"):
                continue
            
            with open(os.path.join(EMBEDDING_DIR, fname), "r") as f:
                ref_emb = np.array(json.load(f))
            
            # Cosine Similarity
            sim = np.dot(captured_emb, ref_emb) / (np.linalg.norm(captured_emb) * np.linalg.norm(ref_emb))
            similarities.append((fname.replace(".json", ""), float(sim)))

        if not similarities:
            return {"success": True, "verified": False, "message": "No registered users", "similarity": 0}

        # Sort by similarity descending
        similarities.sort(key=lambda x: x[1], reverse=True)
        top_pid, top_sim = similarities[0]
        
        # Ambiguity Check (Issue 5: difference between top match and second match >= 0.05)
        is_ambiguous = False
        if len(similarities) > 1:
            margin = top_sim - similarities[1][1]
            if top_sim >= threshold and margin < 0.05:
                is_ambiguous = True

        verified = (top_sim >= threshold) and not is_ambiguous

        return {
            "success": True,
            "verified": bool(verified),
            "similarity": round(top_sim, 4),
            "pid": top_pid if verified else None
        }

    except Exception as e:
        return {"success": False, "verified": False, "message": str(e)}
