import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../api";
import { clearAuthToken, getAuthToken, setAuthToken } from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  /** True for admin and user roles; false for read-only viewers. Gate all edit UI on this. */
  canEdit: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const currentUser = await api.me();
        if (mounted) {
          setUser(currentUser);
        }
      } catch {
        clearAuthToken();
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    restore();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      canEdit: user?.role === "admin" || user?.role === "user",
      login: async (username: string, password: string) => {
        const result = await api.login({ username, password });
        setAuthToken(result.token);
        setUser(result.user);
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Token cleanup should happen even if the server already considers it invalid.
        }
        clearAuthToken();
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
