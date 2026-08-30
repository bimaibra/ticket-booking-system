import { api } from "..";
import type { LoginRequest, RegisterRequest, AuthResponse } from "@/modules/auth/types";

export const auth = {
  login: (data: LoginRequest) => api.post<AuthResponse>("/auth/login", data),
  register: (data: RegisterRequest) => api.post<AuthResponse>("/auth/register", data),
  refresh: () => api.post<{ access_token: string }>("/auth/refresh"),
  logout: () => api.post("/auth/logout"),
};