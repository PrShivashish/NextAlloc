import React from "react";
import { useAuth, REDIRECT_KEY } from "@/lib/AuthProvider";

export default function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = () => {
    // 1. Clear auth state
    logout && logout();

    // 2. Clear portal + redirect
    try {
      sessionStorage.removeItem("portalSelected");
      sessionStorage.removeItem(REDIRECT_KEY);
    } catch (e) {
      console.warn("Failed to clear session keys", e);
    }

    // 3. Redirect to home (replace = prevents Back access)
    window.location.replace("/");
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "8px 12px",
        background: "#dc2626",
        color: "white",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}
