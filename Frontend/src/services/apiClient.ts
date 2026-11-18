export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string[]>) { super(message); }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(getAuthHeaders());
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fieldDetails = data?.error?.fields
      ? (Object.values(data.error.fields) as string[][]).flat().filter(Boolean).join(". ")
      : "";
    const errorMessage = fieldDetails || data?.error?.message || data?.detail || "Request failed. Please try again.";
    throw new ApiError(errorMessage, response.status, data?.error?.fields);
  }
  return data as T;
}

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
