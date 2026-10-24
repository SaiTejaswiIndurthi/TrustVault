import React, { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  Bell,
  LogOut,
  ShieldAlert,
  UserCheck,
  FileText,
  KeyRound,
  CheckCheck,
} from "lucide-react";

export function Navbar({ onNavigate, currentTab }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch (e) {}
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "ADMIN":
        return <span className="badge badge-indigo">Administrator</span>;
      case "DOCUMENT_OWNER":
        return <span className="badge badge-teal">Document Owner</span>;
      case "VIEWER":
        return <span className="badge" style={{ backgroundColor: "#E0E7FF", color: "#3730A3" }}>Viewer</span>;
      default:
        return <span className="badge">{role}</span>;
    }
  };

  return (
    <header
      style={{
        backgroundColor: "var(--midnight-indigo)",
        color: "#FFFFFF",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 28px",
        height: "68px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <Logo size={36} light={true} />
        {user && getRoleBadge(user.role)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {/* Notifications Popover */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              position: "relative",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#FFFFFF",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  backgroundColor: "var(--trust-teal)",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: "bold",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--midnight-indigo)",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "48px",
                width: "360px",
                backgroundColor: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--border-color)",
                color: "var(--text-main)",
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-color)",
                  backgroundColor: "#F8FAFC",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: "700", fontSize: "14px" }}>System Notifications</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{notifications.length} alerts</span>
              </div>

              <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #F1F5F9",
                        backgroundColor: n.is_read ? "#FFFFFF" : "var(--soft-lavender)",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--midnight-indigo)" }}>
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--trust-teal)", flexShrink: 0 }} />
                        )}
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Card */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--electric-indigo)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "14px",
              }}
            >
              {user.full_name?.charAt(0) || "U"}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>{user.full_name}</span>
              <span style={{ fontSize: "11px", color: "#A5B4FC" }}>{user.email}</span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className="btn btn-outline-danger"
          style={{
            borderColor: "rgba(239,68,68,0.4)",
            color: "#FCA5A5",
            padding: "7px 12px",
            fontSize: "13px",
          }}
          title="Sign out of TrustVault"
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
