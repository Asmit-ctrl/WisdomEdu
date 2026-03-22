import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import { fetchJson, postJson, setAuthToken } from "./api";

const AUTH_STORAGE_KEY = "eb_lms_auth";

export const portalDestinations = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/home",
  parent: "/parent/home"
};

const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readStoredAuth());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [currentUser]);

  useEffect(() => {
    async function bootstrap() {
      if (!currentUser?.token) {
        setIsBootstrapping(false);
        return;
      }

      setAuthToken(currentUser.token);

      try {
        const payload = await fetchJson("/api/auth/me");
        setCurrentUser((existing) =>
          existing
            ? {
                ...existing,
                user: payload.user
              }
            : existing
        );
      } catch {
        setAuthToken(null);
        setCurrentUser(null);
      } finally {
        setIsBootstrapping(false);
      }
    }

    bootstrap();
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isBootstrapping,
      isAuthenticated: Boolean(currentUser),
      async login(role, email, password) {
        const payload = await postJson("/api/auth/login", { role, email, password });
        setAuthToken(payload.token);
        setCurrentUser({
          token: payload.token,
          user: payload.user
        });
        return portalDestinations[payload.user.role];
      },
      async registerSchool(input) {
        const payload = await postJson("/api/auth/register-school", input);
        setAuthToken(payload.token);
        setCurrentUser({
          token: payload.token,
          user: payload.user
        });
        return portalDestinations.admin;
      },
      logout() {
        setAuthToken(null);
        setCurrentUser(null);
      }
    }),
    [currentUser, isBootstrapping]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}
