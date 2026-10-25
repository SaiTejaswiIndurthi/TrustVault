// TrustVault API Client
const API_HOST = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
  : "";
const BASE_URL = API_HOST ? `${API_HOST}/api` : "/api";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("trustvault_token");
  
  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", // Enforce HttpOnly cookie inclusion
  });

  if (response.status === 401) {
    // If not on public auth pages, clear stale session token
    if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      localStorage.removeItem("trustvault_token");
    }
  }

  // Handle file blob responses (for secure streaming downloads)
  const contentType = response.headers.get("content-type");
  if (options.responseType === "blob" || (contentType && !contentType.includes("application/json"))) {
    if (!response.ok) {
      let errorMsg = "Download failed";
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let errorMsg = "An unexpected error occurred";
    if (typeof data.detail === "string") {
      errorMsg = data.detail;
    } else if (Array.isArray(data.detail)) {
      // Clean up FastAPI/Pydantic validation errors
      errorMsg = data.detail
        .map((d) => {
          if (typeof d === "string") return d;
          const field = d.loc && d.loc.length > 1 ? `${d.loc[d.loc.length - 1]}: ` : "";
          const msg = (d.msg || "").replace(/^Value error,\s*/i, "");
          return `${field}${msg}`;
        })
        .join("; ");
    } else if (data.message) {
      errorMsg = data.message;
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  getMe: () => request("/auth/me"),
  forgotPassword: (payload) => request("/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),

  // Administrator
  getAdminStats: () => request("/admin/stats"),
  listUsers: (params = "") => request(`/admin/users${params}`),
  updateUserStatus: (userId, payload) => request(`/admin/users/${userId}/status`, { method: "POST", body: JSON.stringify(payload) }),
  getAdminDocuments: (params = "") => request(`/admin/documents${params}`),
  listAllPermissions: (params = "") => request(`/admin/permissions${params}`),
  getAuditLogs: (params = "") => request(`/admin/audit-logs${params}`),
  verifyAuditLogs: () => request("/admin/audit-logs/verify", { method: "POST" }),

  // Documents
  getOwnerStats: () => request("/documents/owner/stats"),
  getViewerStats: () => request("/documents/viewer/stats"),
  listDocuments: (params = "") => request(`/documents${params}`),
  getDocument: (id) => request(`/documents/${id}`),
  uploadDocument: (formData) => request("/documents/upload", { method: "POST", body: formData }),
  updateDocumentMetadata: (id, payload) => request(`/documents/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  
  // Download file stream
  downloadDocument: async (documentId, filename) => {
    const blob = await request(`/documents/${documentId}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "document";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },

  // Permissions
  getDocumentPermissions: (docId) => request(`/permissions/documents/${docId}`),
  grantPermission: (docId, payload) => request(`/permissions/documents/${docId}/grant`, { method: "POST", body: JSON.stringify(payload) }),
  revokePermission: (permId, payload) => request(`/permissions/${permId}/revoke`, { method: "POST", body: JSON.stringify(payload) }),
  getDocumentActivity: (docId) => request(`/permissions/documents/${docId}/activity`),
  listShareableUsers: () => request("/permissions/active-users"),

  // Notifications
  getNotifications: () => request("/notifications"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
};
