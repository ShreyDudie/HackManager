import { API_BASE_URL, getAuthHeaders } from "@/services/apiClient";

export type FaceApiResponse = {
  success: boolean;
  message?: string;
  verified?: boolean;
  similarity?: number;
};

async function postFaceImage(endpoint: string, imageData: string) {
  const blob = await (await fetch(imageData)).blob();
  const formData = new FormData();
  formData.append("file", new File([blob], "face.jpg", { type: "image/jpeg" }));

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return { response, data: await response.json() as FaceApiResponse };
}

export function registerFace(imageData: string) {
  return postFaceImage("/api/face/register", imageData);
}

export function verifyFace(imageData: string, email: string) {
  const emailQuery = email ? `?email=${encodeURIComponent(email)}` : "";
  return postFaceImage(`/api/face/verify${emailQuery}`, imageData);
}
