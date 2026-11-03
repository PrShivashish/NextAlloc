// client/src/components/AuthGate.tsx
import React from "react";
import { Button } from "@/components/ui/button";

type PortalKey = "student" | "company" | "admin";

interface AuthGateProps {
  portalKey: PortalKey;
  children: React.ReactNode;
}

/**
 * Simple client-side auth gate (mock).
 * - Shows Login / Sign Up forms.
 * - On success, sets sessionStorage.portalAuth = portalKey
 * - Then renders children (the portal).
 *
 * NOTE: This is purely front-end mock auth for UX/development.
 * Replace with real API calls when you have backend auth.
 */
export function AuthGate({ portalKey, children }: AuthGateProps) {
  const [authed, setAuthed] = React.useState<boolean>(() => {
    try {
      return sessionStorage.getItem("portalAuth") === portalKey;
    } catch {
      return false;
    }
  });

  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    try {
      setAuthed(sessionStorage.getItem("portalAuth") === portalKey);
    } catch {
      setAuthed(false);
    }
  }, [portalKey]);

  function markAuthed() {
    try {
      sessionStorage.setItem("portalAuth", portalKey);
      // Notify other listeners (e.g. StudentPortal) that auth changed.
      try {
        const se = new StorageEvent("storage", {
          key: "portalAuth",
          newValue: portalKey,
        } as any);
        window.dispatchEvent(se);
      } catch {
        // Fallback: dispatch a generic event so UI can listen if needed
        try {
          window.dispatchEvent(new Event("portalAuthChanged"));
        } catch {}
      }
    } catch {}

    setAuthed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Mock delay to feel real
    await new Promise((r) => setTimeout(r, 600));
    // Very small validation
    if (!email || !password) {
      // in real app show a proper error UI
      alert("Please enter email and password (mock).");
      setLoading(false);
      return;
    }
    // Mock success — in production, call your API
    markAuthed();
    setLoading(false);
  }

  // If authenticated, show portal content
  if (authed) {
    return <>{children}</>;
  }

  // Otherwise show the auth UI
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold capitalize">{portalKey} portal</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("login")}
                className={`px-3 py-1 rounded ${mode === "login" ? "bg-slate-100 dark:bg-slate-800" : "bg-transparent"}`}
              >
                Login
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`px-3 py-1 rounded ${mode === "signup" ? "bg-slate-100 dark:bg-slate-800" : "bg-transparent"}`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {mode === "login"
              ? `Sign in to access the ${portalKey} portal. This is a mock login for the frontend.`
              : `Create an account for the ${portalKey} portal (mock).`}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                className="w-full rounded px-3 py-2 border focus:outline-none focus:ring"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                className="w-full rounded px-3 py-2 border focus:outline-none focus:ring"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {mode === "login" ? "New here?" : "Already have an account?"}
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </div>
          </form>

          <div className="mt-4 text-xs text-muted-foreground">
            Note: This is a frontend-only mock auth. Replace with real login/signup API later.
          </div>
        </div>
      </div>
    </div>
  );
}
