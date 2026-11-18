import { apiRequest, API_BASE_URL, getAuthHeaders } from "@/services/apiClient";

export interface Stage {
  id: string;
  title: string;
  type: "SUBMISSION" | "EVALUATION" | "FINAL";
  startDate: string;
  endDate: string;
  description: string;
}

export interface ProblemStatement {
  id: string;
  title: string;
  description: string;
}

export type ScheduleType = "entry" | "breakfast" | "lunch" | "dinner";

export interface ScheduleOption {
  startTime: string;
  endTime: string;
}

export type ScheduleState = Partial<Record<ScheduleType, ScheduleOption>>;
export type ScheduleEnabledState = Record<ScheduleType, boolean>;

export interface EventRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  theme: string;
  rules: string;
  location?: string;
  headerImage?: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  minTeamSize: number;
  maxTeamSize: number;
  status: "Open" | "Ongoing" | "Completed" | "Coming Soon";
  stages?: string | Stage[];
  problemStatements?: string | ProblemStatement[];
  schedules?: string | ScheduleState;
}

export function parseEventStages(raw?: string | Stage[]): Stage[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export function parseEventProblemStatements(raw?: string | ProblemStatement[]): ProblemStatement[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export function parseEventSchedules(raw?: string | ScheduleState): ScheduleState {
  if (typeof raw === "object" && raw !== null) return raw as ScheduleState;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      return JSON.parse(raw) as ScheduleState;
    } catch {
      return {};
    }
  }
  return {};
}

export function resolveBannerUrl(url?: string): string {
  if (!url || !url.trim()) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `${API_BASE_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export interface Member { name: string; email: string; phone?: string; college?: string }
export interface Team { id: string; teamName: string; status: string; members: Member[] }
export interface Submission { id: string; registrationId: string; kind: string; name: string; url: string | null; fileUploadId: string | null }
export interface Checkin { id: string; purpose: string; result: string; scannedAt: string }
export interface Pass { token: string; expiresAt: string; purpose: string; day: number }

export const eventsApi = {
  list: () => apiRequest<EventRecord[]>("/api/hackathons"),
  get: (id: string) => apiRequest<EventRecord>(`/api/hackathons/${id}`),
  create: (event: Omit<EventRecord, "id" | "ownerId">) => apiRequest<EventRecord>("/api/hackathons", { method: "POST", body: JSON.stringify(event) }),
  register: (id: string, teamName: string, members: Member[]) => apiRequest<Team>(`/api/hackathons/${id}/registrations`, { method: "POST", body: JSON.stringify({ teamName, members }) }),
  teams: (id: string) => apiRequest<Team[]>(`/api/hackathons/${id}/registrations`),
  myTeam: (id: string) => apiRequest<Team>(`/api/hackathons/${id}/registrations/me`),
  submissions: (id: string, admin: boolean) => apiRequest<Submission[]>(`/api/hackathons/${id}/submissions${admin ? "" : "/me"}`),
  submit: (id: string, kind: string, input: { name: string; url?: string; link?: string; fileId?: string }) => apiRequest<Submission>(`/api/hackathons/${id}/submissions/${kind}`, { method: "POST", body: JSON.stringify(input) }),
  issuePass: (id: string, purpose: string, day: number) => apiRequest<Pass>(`/api/hackathons/${id}/check-ins/token`, { method: "POST", body: JSON.stringify({ purpose, day }) }),
  redeem: (token: string) => apiRequest<{ result: string; message: string }>("/api/check-ins/redeem", { method: "POST", body: JSON.stringify({ token }) }),
  checkins: (id: string) => apiRequest<Checkin[]>(`/api/hackathons/${id}/check-ins`),
  uploadBanner: (file: File) => {
    const body = new FormData(); body.append("image", file);
    return apiRequest<{ url: string }>("/api/upload/image", { method: "POST", body });
  },
  upload: (file: File) => {
    const body = new FormData(); body.append("file", file);
    return apiRequest<{ id: string }>("/api/auth/pdf-upload/", { method: "POST", body });
  },
};

export async function downloadSubmission(fileId: string, name: string) {
  const response = await fetch(`${API_BASE_URL}/media/${fileId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error("The PDF could not be downloaded. Please sign in and try again.");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name}.pdf`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
