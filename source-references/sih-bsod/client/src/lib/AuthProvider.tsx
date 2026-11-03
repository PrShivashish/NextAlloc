// src/lib/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

export const REDIRECT_KEY = "myapp_redirectAfterLogin";
const SESSION_KEY = "myapp_isAuthenticated";
const USER_KEY = "myapp_user";
const PORTAL_SELECTED = "portalSelected";

// Local Storage Keys for "Database"
const DB_STUDENTS_KEY = "myapp_db_students";
const DB_COMPANIES_KEY = "myapp_db_companies";

type User = { name?: string; email?: string; role?: "student" | "company" | "admin" } | null;

type AuthContextProps = {
  isAuthenticated: boolean;
  initialized: boolean;
  user: User;
  loginStudent: (email: string, password: string) => Promise<void>;
  registerStudent: (name: string, email: string, password: string) => Promise<void>;
  loginCompany: (email: string, password: string) => Promise<void>;
  registerCompany: (name: string, email: string, password: string, sector?: string) => Promise<void>;
  loginAdmin: (password: string) => Promise<void>;
  logout: () => void;
  // Legacy support (optional, can be removed if unused)
  login: (userData?: Partial<User>) => void;
  signup: (userData?: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextProps>({
  isAuthenticated: false,
  initialized: false,
  user: null,
  loginStudent: async () => { },
  registerStudent: async () => { },
  loginCompany: async () => { },
  registerCompany: async () => { },
  loginAdmin: async () => { },
  logout: () => { },
  login: () => { },
  signup: () => { },
});

function normalizePath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost").pathname;
  } catch {
    return raw;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      const u = sessionStorage.getItem(USER_KEY);
      setIsAuthenticated(s === "true");
      setUser(u ? JSON.parse(u) : null);
    } catch (e) {
      console.warn("[AuthProvider] init error", e);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setInitialized(true);
    }
  }, []);

  const setSession = (u: User) => {
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
      sessionStorage.setItem(USER_KEY, JSON.stringify(u));
      setIsAuthenticated(true);
      setUser(u);
    } catch (e) {
      console.warn("[AuthProvider] setSession error", e);
    }
  };

  /* -------------------------------------------------------------
     Auth Actions (REAL API)
  ------------------------------------------------------------- */

  // --- STUDENT AUTH ---

  const registerStudent = async (name: string, email: string, pass: string) => {
    // Send name and email to backend for profanity check
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: email,
        password: pass,
        role: "student",
        name: name,    // Add name for profanity check
        email: email   // Add email for profanity check
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Registration failed");
    }

    // Auto-login or redirect to login
    // Current flow: Redirect to login
    window.location.href = "/login";
  };

  const loginStudent = async (email: string, pass: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: email, password: pass }),
    });

    if (!res.ok) {
      // Try to parse JSON response for lockout info
      try {
        const data = await res.json();
        if (data.locked && data.remainingSeconds) {
          const error = new Error(data.message) as any;
          error.locked = true;
          error.remainingSeconds = data.remainingSeconds;
          throw error;
        }
        if (data.attemptsRemaining !== undefined) {
          throw new Error(`${data.message} (${data.attemptsRemaining} attempts remaining)`);
        }
        throw new Error(data.message || "Login failed");
      } catch (e: any) {
        if (e.locked) throw e; // Re-throw lockout errors
        throw new Error(e.message || "Login failed");
      }
    }

    const u = await res.json();
    if (u.role !== "student") {
      // Correct role check
      throw new Error("Account exists but is not a student account.");
    }

    // Update State
    setUser(u);
    setIsAuthenticated(true);
    // Persist basic session flag (real persistence is cookie-based)
    sessionStorage.setItem(SESSION_KEY, "true");
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    sessionStorage.setItem(PORTAL_SELECTED, "student");

    window.location.href = "/student";
  };

  // --- COMPANY AUTH ---

  const registerCompany = async (name: string, email: string, pass: string, sector?: string) => {
    // Send name and email to backend for profanity check
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: email,
        password: pass,
        role: "company",
        name: name,    // Add name for profanity check
        email: email   // Add email for profanity check
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Company registration failed");
    }

    // Save company details (sector) - strictly, this should go to a company profile endpoint
    // We'll leave the local storage part for sector for now or ignore it as backend 'users' doesn't store sector.

    window.location.href = "/company-login";
  };

  const loginCompany = async (email: string, pass: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: email, password: pass }),
    });

    if (!res.ok) {
      // Try to parse JSON response for lockout info
      try {
        const data = await res.json();
        if (data.locked && data.remainingSeconds) {
          const error = new Error(data.message) as any;
          error.locked = true;
          error.remainingSeconds = data.remainingSeconds;
          throw error;
        }
        if (data.attemptsRemaining !== undefined) {
          throw new Error(`${data.message} (${data.attemptsRemaining} attempts remaining)`);
        }
        throw new Error(data.message || "Invalid credentials");
      } catch (e: any) {
        if (e.locked) throw e;
        throw new Error(e.message || "Invalid credentials");
      }
    }

    const u = await res.json();
    if (u.role !== "company") throw new Error("Not a company account");

    setUser(u);
    setIsAuthenticated(true);
    sessionStorage.setItem(SESSION_KEY, "true");
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    sessionStorage.setItem(PORTAL_SELECTED, "company");
    window.location.href = "/company";
  };

  // --- ADMIN AUTH ---

  const loginAdmin = async (pass: string) => {
    // Admin uses hardcoded username "admin" with the provided password
    // First, try to login with the backend
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: "admin", password: pass }),
    });

    if (!res.ok) {
      // If admin user doesn't exist in DB, try to register it first (one-time setup)
      if (res.status === 401) {
        // Try registering admin user
        const regRes = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: "admin", password: pass, role: "admin" }),
        });

        if (regRes.ok) {
          // Now login again
          const loginRes = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: "admin", password: pass }),
          });

          if (!loginRes.ok) {
            throw new Error("Admin login failed after registration");
          }

          const u = await loginRes.json();
          setUser(u);
          setIsAuthenticated(true);
          sessionStorage.setItem(SESSION_KEY, "true");
          sessionStorage.setItem(USER_KEY, JSON.stringify(u));
          sessionStorage.setItem(PORTAL_SELECTED, "admin");
          window.location.href = "/admin";
          return;
        }
      }
      throw new Error("Invalid admin password.");
    }

    const u = await res.json();
    if (u.role !== "admin") {
      throw new Error("Not an admin account");
    }

    setUser(u);
    setIsAuthenticated(true);
    sessionStorage.setItem(SESSION_KEY, "true");
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    sessionStorage.setItem(PORTAL_SELECTED, "admin");
    window.location.href = "/admin";
  };

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (e) { console.warn("Logout failed", e); }

    sessionStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
    window.location.replace("/");
  };

  // Legacy stubs
  const login = () => { };
  const signup = () => { };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, initialized, user,
      loginStudent, registerStudent,
      loginCompany, registerCompany,
      loginAdmin,
      logout,
      login, signup
    }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);
