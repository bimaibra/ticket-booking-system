import { apiClient } from "@/shared/lib/api";
import type { LoginRequest, RegisterRequest, AuthResponse, RefreshResponse, User } from "../types";

const TOKEN_KEY = "velaris:access_token";
const USER_KEY = "velaris:user";

function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

function setUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await apiClient<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  setToken(res.access_token);
  setUser(res.user);
  return res;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const res = await apiClient<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  setToken(res.access_token);
  setUser(res.user);
  return res;
}

export async function refresh(): Promise<RefreshResponse> {
  // Refresh token is httpOnly, so we just call the endpoint
  const res = await apiClient<RefreshResponse>("/auth/refresh", {
    method: "POST",
  });
  setToken(res.access_token);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await apiClient("/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
  clearAuth();
}