import os
from pathlib import Path
from threading import Lock

import mediapipe as mp
import numpy as np

STABLE_INDICES = [33, 133, 157, 158, 159, 160, 161, 246, 7, 163, 144, 145, 153, 154, 155, 362, 263, 384, 385, 386, 387, 388, 466, 249, 390, 373, 374, 380, 381, 382, 1, 2, 98, 327, 168, 6, 197, 195, 5, 4, 0, 13, 14, 17, 37, 39, 40, 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 10, 338, 297, 332, 284, 251, 389, 356, 454, 152, 234, 127, 162, 21, 54, 103, 67, 109]
_mesh = None
_lock = Lock()


def _detector():
    global _mesh
    if _mesh is None:
        if not hasattr(mp, "solutions") or not hasattr(mp.solutions, "face_mesh"):
            raise RuntimeError("MediaPipe FaceMesh is unavailable")
        _mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=2, refine_landmarks=True, min_detection_confidence=0.5)
    return _mesh


def get_normalized_embedding(image_rgb):
    with _lock:
        results = _detector().process(image_rgb)
    if not results.multi_face_landmarks:
        raise ValueError("No face detected")
    if len(results.multi_face_landmarks) > 1:
        raise ValueError("Multiple faces detected")
    landmarks = results.multi_face_landmarks[0].landmark
    height, width, _ = image_rgb.shape
    face_width = (max(point.x for point in landmarks) - min(point.x for point in landmarks)) * width
    face_height = (max(point.y for point in landmarks) - min(point.y for point in landmarks)) * height
    if face_width < 80 or face_height < 80:
        raise ValueError("Face is too far from camera")
    points = np.array([[landmarks[index].x, landmarks[index].y] for index in STABLE_INDICES])
    points = points - np.mean(points, axis=0)
    scale = np.linalg.norm(points)
    if scale == 0:
        raise ValueError("Could not normalize face landmarks")
    return (points / scale).flatten(), {"faceWidth": round(float(face_width), 2), "faceHeight": round(float(face_height), 2)}


def compare_embeddings(captured, references):
    if not references:
        return 0.0, None
    scores = []
    for reference in references:
        candidate = np.asarray(reference, dtype=np.float64)
        if candidate.shape != captured.shape or not np.isfinite(candidate).all():
            raise ValueError("Reference embedding is invalid")
        scores.append(max(0.0, 1.0 - float(np.linalg.norm(captured - candidate))))
    index = int(np.argmax(scores))
    return scores[index], index
