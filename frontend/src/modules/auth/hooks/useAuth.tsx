"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "../types";
import {
  getToken,
  getUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from "../services/auth";
import type { LoginRequest, RegisterRequest } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "velaris:access_token";
const USER_KEY = "velaris:user";

const SERVER_SNAPSHOT = { token: null, user: null } as const;

interface AuthSnapshot {
  token: string | null;
  user: User | null;
}

let cachedSnapshot: AuthSnapshot | null = null;

function readSnapshot(): AuthSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = { token: getToken(), user: getUser() };
  }
  return cachedSnapshot;
}

function getSnapshot(): AuthSnapshot {
  return readSnapshot();
}

function subscribe(callback: () => void) {
  cachedSnapshot = { token: getToken(), user: getUser() };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== TOKEN_KEY && e.key !== USER_KEY) return;
    cachedSnapshot = { token: getToken(), user: getUser() };
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT
  );

  const [user, setUser] = useState<User | null>(snapshot.user);
  const [token, setToken] = useState<string | null>(snapshot.token);

  const login = async (data: LoginRequest) => {
    const res = await apiLogin(data);
    cachedSnapshot = { token: res.access_token, user: res.user };
    setToken(res.access_token);
    setUser(res.user);
    router.push("/");
  };

  const register = async (data: RegisterRequest) => {
    const res = await apiRegister(data);
    cachedSnapshot = { token: res.access_token, user: res.user };
    setToken(res.access_token);
    setUser(res.user);
    router.push("/");
  };

  const logout = async () => {
    await apiLogout();
    cachedSnapshot = { token: null, user: null };
    setToken(null);
    setUser(null);
    router.push("/auth/login");
  };

  const value: AuthContextValue = {
    user: user ?? snapshot.user,
    token: token ?? snapshot.token,
    isAuthenticated: !!(token ?? snapshot.token),
    isLoading: false,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}