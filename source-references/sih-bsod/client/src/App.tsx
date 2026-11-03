// client/src/App.tsx
import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import StudentPortal from "@/pages/StudentPortal";
import CompanyPortal from "@/pages/CompanyPortal";
import AdminPortal from "@/pages/AdminPortal";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import CompanyAuthPage from "@/pages/CompanyAuthPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import ObjectionPage from "@/pages/ObjectionPage";
import { AuthProvider, useAuth, REDIRECT_KEY } from "@/lib/AuthProvider";
// provider for selected candidates (shared context)
import { SelectedCandidatesProvider } from "@/components/SelectedCandidates";
// AI chatbot widget
import { ChatbotWidget } from "@/components/ChatbotWidget";

/** Read session safely */
function getPortalSelected(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem("portalSelected");
  } catch {
    return null;
  }
}

function ProtectedRoute({
  portalKey,
  children,
}: {
  portalKey: "student" | "company" | "admin";
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, initialized } = useAuth();

  if (!initialized) {
    // auth not ready — wait
    return null;
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(REDIRECT_KEY, `/${portalKey}`);
        console.info("[ProtectedRoute] saved redirect", `/${portalKey}`);
      } catch (e) {
        console.warn("[ProtectedRoute] failed to save redirect", e);
      }

      // Redirect to appropriate login page
      if (portalKey === "company") {
        window.location.replace("/company-login");
      } else if (portalKey === "admin") {
        window.location.replace("/admin-login");
      } else {
        window.location.replace("/login");
      }
    }
    return null;
  }

  // Check if user's role matches the portal
  if (user?.role && user.role !== portalKey) {
    if (typeof window !== "undefined") {
      console.warn("[ProtectedRoute] role mismatch", { userRole: user.role, expected: portalKey });
      window.location.replace("/");
    }
    return null;
  }

  const selected = getPortalSelected();
  if (selected !== portalKey) {
    if (typeof window !== "undefined") {
      console.info("[ProtectedRoute] portalSelected mismatch -> sending home", { selected, expected: portalKey });
      window.location.replace("/");
    }
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />

      <Route path="/student">
        <ProtectedRoute portalKey="student">
          <StudentPortal />
        </ProtectedRoute>
      </Route>

      <Route path="/company">
        <ProtectedRoute portalKey="company">
          <CompanyPortal />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute portalKey="admin">
          <AdminPortal />
        </ProtectedRoute>
      </Route>

      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/company-login" component={CompanyAuthPage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/objection/:token" component={ObjectionPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            {/* SelectedCandidatesProvider wraps the router so all pages (CompanyPortal, Onboarding, etc.)
                can access the shared selected-candidates context. */}
            <SelectedCandidatesProvider>
              <Router />
              <ChatbotWidget />
            </SelectedCandidatesProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
