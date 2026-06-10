import os
import cv2
import numpy as np
import json
import mediapipe as mp
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

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

    # Quality Check: Face bounding box size
    xs = [l.x for l in landmarks]
    ys = [l.y for l in landmarks]
    bbox_w = (max(xs) - min(xs)) * w
    bbox_h = (max(ys) - min(ys)) * h
    if bbox_w < 80 or bbox_h < 80:
        return None, "Face is too far from camera"

    # Extract stable 2D landmarks (eyes, nose, mouth, jaw)
    pts = np.array([[landmarks[idx].x, landmarks[idx].y] for idx in STABLE_INDICES])

    # Translate: Center coordinates relative to their mean
    center = np.mean(pts, axis=0)
    pts = pts - center

    # Scale: Normalize by overall coordinates spread (standard deviation)
    scale = np.linalg.norm(pts)
    if scale > 0:
        pts = pts / scale

    return pts.flatten(), None


class FaceRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        pid = request.user.email
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"success": False, "message": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            contents = file_obj.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return Response({"success": False, "message": "Invalid image format"}, status=status.HTTP_400_BAD_REQUEST)

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            embedding, error = get_normalized_embedding(img_rgb)

            if embedding is None:
                return Response({"success": False, "message": error}, status=status.HTTP_200_OK)

            # Save Image
            final_path = os.path.join(REGISTER_DIR, f"{pid}.jpg")
            cv2.imwrite(final_path, img)

            # Save Embedding (Deterministic)
            emb_path = os.path.join(EMBEDDING_DIR, f"{pid}.json")
            with open(emb_path, "w") as f:
                json.dump(embedding.tolist(), f)

            return Response({"success": True, "message": f"Face registered successfully for {pid}"}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"success": False, "message": "Detection failed", "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FaceVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        email = request.query_params.get('email')
        threshold_str = request.query_params.get('threshold', '0.70')
        try:
            threshold = float(threshold_str)
        except ValueError:
            threshold = 0.70

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"success": False, "verified": False, "message": "No file uploaded", "similarity": 0}, status=status.HTTP_400_BAD_REQUEST)

        try:
            contents = file_obj.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return Response({"success": False, "verified": False, "message": "Invalid image", "similarity": 0}, status=status.HTTP_200_OK)

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            captured_emb, error = get_normalized_embedding(img_rgb)

            if captured_emb is None:
                return Response({"success": False, "verified": False, "message": error, "similarity": 0}, status=status.HTTP_200_OK)

            # 1-to-1 Verification if email is provided
            if email:
                emb_path = os.path.join(EMBEDDING_DIR, f"{email}.json")
                if not os.path.exists(emb_path):
                    return Response({"success": True, "verified": False, "message": "No registered face found for this user", "similarity": 0}, status=status.HTTP_200_OK)
                
                with open(emb_path, "r") as f:
                    ref_emb = np.array(json.load(f))
                
                # Euclidean Distance comparison
                dist = np.linalg.norm(captured_emb - ref_emb)
                sim = max(0.0, 1.0 - float(dist))
                verified = sim >= threshold
                
                return Response({
                    "success": True,
                    "verified": bool(verified),
                    "similarity": round(float(sim), 4),
                    "pid": email if verified else None
                }, status=status.HTTP_200_OK)

            # Compare against ALL registered embeddings (1-to-many Search)
            similarities = []
            if os.path.exists(EMBEDDING_DIR):
                for fname in os.listdir(EMBEDDING_DIR):
                    if not fname.endswith(".json"):
                        continue
                    
                    with open(os.path.join(EMBEDDING_DIR, fname), "r") as f:
                        ref_emb = np.array(json.load(f))
                    
                    dist = np.linalg.norm(captured_emb - ref_emb)
                    sim = max(0.0, 1.0 - float(dist))
                    similarities.append((fname.replace(".json", ""), float(sim)))

            if not similarities:
                return Response({"success": True, "verified": False, "message": "No registered users", "similarity": 0}, status=status.HTTP_200_OK)

            # Sort by similarity descending
            similarities.sort(key=lambda x: x[1], reverse=True)
            top_pid, top_sim = similarities[0]
            verified = top_sim >= threshold

            return Response({
                "success": True,
                "verified": bool(verified),
                "similarity": round(top_sim, 4),
                "pid": top_pid if verified else None
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"success": False, "verified": False, "message": str(e), "similarity": 0}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
