import { apiClient } from "@/shared/lib/api";

export const api = {
  get: <T>(path: string) => apiClient<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiClient<T>(path, { method: "DELETE" }),
};

export * from "./endpoints/auth";