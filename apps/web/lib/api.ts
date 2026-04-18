import { authStore } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type RequestOptions = {
  method?: string;
  body?: BodyInit | object;
  isFormData?: boolean;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = authStore.getToken();
  const headers: HeadersInit = {};

  let body: BodyInit | undefined;
  if (options.body && !(options.body instanceof FormData) && !options.isFormData) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  } else {
    body = options.body as BodyInit | undefined;
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? "Request failed");
  }

  return json.data as T;
};

export const api = {
  signup: (payload: { name: string; email: string; password: string }) =>
    request<{ token: string; user: any }>("/api/users/signup", { method: "POST", body: payload }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: any }>("/api/users/login", { method: "POST", body: payload }),
  me: () => request<any>("/api/users/me"),
  upload: (formData: FormData) =>
    request<{ fileName: string; originalName: string; fileUrl: string; size: number }>("/api/jobs/upload", {
      method: "POST",
      body: formData,
      isFormData: true
    }),
  createJob: (payload: {
    title: string;
    description?: string;
    fileSize: number;
    fileName: string;
    fileUrl: string;
  }) => request("/api/jobs", { method: "POST", body: payload }),
  myJobs: () => request<any[]>("/api/jobs/mine"),
  allJobs: () => request<any[]>("/api/jobs"),
  getJobDownloadUrl: (id: string) => `${API_URL}/api/jobs/${id}/download`,
  downloadJobFile: async (id: string, fileName: string) => {
    const token = authStore.getToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/api/jobs/${id}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let errorText = "Download failed";
      try {
        const json = await response.json();
        errorText = json.error ?? errorText;
      } catch {
        // Keep default fallback when response body is not JSON.
      }
      throw new Error(errorText);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },
  fetchJobFileBlob: async (id: string) => {
    const token = authStore.getToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_URL}/api/jobs/${id}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Unable to load model preview");
    }

    return response.blob();
  },
  summary: () => request<any>("/api/jobs/analytics/summary"),
  updateStatus: (id: string, status: string, adminNotes?: string) =>
    request(`/api/jobs/${id}/status`, { method: "PATCH", body: { status, adminNotes } }),
  approve: (id: string) => request(`/api/jobs/${id}/approve`, { method: "PATCH" }),
  reject: (id: string, adminNotes?: string) =>
    request(`/api/jobs/${id}/reject`, { method: "PATCH", body: { adminNotes } }),
  adjustEstimate: (id: string, filamentGrams: number) =>
    request(`/api/jobs/${id}/estimate`, { method: "PATCH", body: { filamentGrams } }),
  deleteJob: (id: string) => request(`/api/jobs/${id}`, { method: "DELETE" }),
  myCredits: () => request<any>("/api/credits/mine"),
  adjustCredits: (payload: { userId: string; amount: number; reason: string }) =>
    request("/api/credits/adjust", { method: "POST", body: payload }),
  topUsers: () => request<any[]>("/api/users/top"),
  participants: () =>
    request<Array<{ id: string; name: string | null; email: string; credits: number; _count: { jobs: number } }>>(
      "/api/users/participants"
    ),
  notifications: () => request<any[]>("/api/users/notifications"),
  markNotificationRead: (id: string) => request(`/api/users/notifications/${id}/read`, { method: "PATCH" }),
  deleteNotification: (id: string) => request(`/api/users/notifications/${id}`, { method: "DELETE" }),
  auditLogs: () => request<any[]>("/api/users/audit-logs"),
  deleteUser: (id: string) => request(`/api/users/${id}`, { method: "DELETE" })
};
