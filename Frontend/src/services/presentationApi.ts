import { API_BASE_URL, getAuthHeaders } from "@/services/apiClient";

type PresentationUpload = {
  url: string;
  filename: string;
};

export async function uploadPresentationPdf(file: File): Promise<PresentationUpload> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/auth/pdf-upload/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");
  return response.json();
}
