import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword, ResetPassword } from "./pages/ForgotPassword";
import { AdminDashboard } from "./pages/AdminDashboard";
import { OwnerDashboard } from "./pages/OwnerDashboard";
import { ViewerDashboard } from "./pages/ViewerDashboard";

function MainContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState("login");
  const [resetToken, setResetToken] = useState("");

  const navigate = (page, data = {}) => {
    if (data.token) {
      setResetToken(data.token);
    }
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          backgroundColor: "var(--midnight-indigo)",
          color: "#FFFFFF",
        }}
      >
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(99, 91, 219, 0.3)", borderTopColor: "var(--trust-teal)", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "14px", fontWeight: "600", letterSpacing: "0.05em" }}>INITIALIZING ZERO-TRUST ENVIRONMENT...</span>
      </div>
    );
  }

  // If user is authenticated, route directly to role dashboard
  if (user) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--cloud-white)" }}>
        <Navbar onNavigate={navigate} />
        <main>
          {user.role === "ADMIN" && <AdminDashboard />}
          {user.role === "DOCUMENT_OWNER" && <OwnerDashboard />}
          {user.role === "VIEWER" && <ViewerDashboard />}
        </main>
      </div>
    );
  }

  // Public Unauthenticated Pages
  switch (currentPage) {
    case "register":
      return <Register onNavigate={navigate} />;
    case "forgot-password":
      return <ForgotPassword onNavigate={navigate} />;
    case "reset-password":
      return <ResetPassword onNavigate={navigate} initialToken={resetToken} />;
    case "login":
    default:
      return <Login onNavigate={navigate} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
