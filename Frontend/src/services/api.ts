// API Service Layer for FastAPI Backend
// Update BASE_URL to your FastAPI server address

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string, role: string) =>
    request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
  signup: (data: any) =>
    request<{ token: string; user: any }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Hackathons
export const hackathonApi = {
  list: () => request<any[]>("/hackathons"),
  get: (id: string) => request<any>(`/hackathons/${id}`),
  create: (data: any) =>
    request<any>("/hackathons", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/hackathons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// Students
export const studentApi = {
  register: (data: FormData) =>
    fetch(`${BASE_URL}/students/register`, {
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
    }).then((r) => r.json()),
  dashboard: () => request<any>("/students/dashboard"),
  uploadPPT: (roundId: string, file: FormData) =>
    fetch(`${BASE_URL}/students/ppt/${roundId}`, {
      method: "POST",
      body: file,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
    }).then((r) => r.json()),
  submitGithub: (url: string) =>
    request<any>("/students/github", { method: "POST", body: JSON.stringify({ url }) }),
};

// Judge
export const judgeApi = {
  assignments: () => request<any[]>("/judge/assignments"),
  submitScore: (teamId: string, score: number) =>
    request<any>(`/judge/score/${teamId}`, {
      method: "POST",
      body: JSON.stringify({ score }),
    }),
};

// Admin
export const adminApi = {
  students: () => request<any[]>("/admin/students"),
  verifyStudent: (id: string) =>
    request<any>(`/admin/verify/${id}`, { method: "POST" }),
  assignPPT: (data: any) =>
    request<any>("/admin/assign-ppt", { method: "POST", body: JSON.stringify(data) }),
  leaderboard: (hackathonId: string) =>
    request<any[]>(`/admin/leaderboard/${hackathonId}`),
  exportResults: (hackathonId: string) =>
    request<Blob>(`/admin/export/${hackathonId}`),
};

// AI Services
export const aiApi = {
  evaluatePPT: (file: FormData) =>
    fetch(`${BASE_URL}/evaluate-ppt`, {
      method: "POST",
      body: file,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
    }).then((r) => r.json()),
  faceEncode: (file: FormData) =>
    fetch(`${BASE_URL}/face-encode`, {
      method: "POST",
      body: file,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
    }).then((r) => r.json()),
  faceVerify: (file: FormData) =>
    fetch(`${BASE_URL}/face-verify`, {
      method: "POST",
      body: file,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
    }).then((r) => r.json()),
};
