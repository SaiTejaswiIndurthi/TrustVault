import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Modal } from "../components/Modal";
import {
  Users,
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
  Ban,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Lock,
  Eye,
  Key,
  BarChart3,
  PieChart,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [docSearch, setDocSearch] = useState("");

  // Modals
  const [actionUser, setActionUser] = useState(null);
  const [actionType, setActionType] = useState(""); // REJECT or SUSPEND
  const [actionReason, setActionReason] = useState("");
  const [selectedAuditDetails, setSelectedAuditDetails] = useState(null);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, docsData, logsData] = await Promise.all([
        api.getAdminStats(),
        api.listUsers(),
        api.getAdminDocuments(),
        api.getAuditLogs(),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
      setDocuments(docsData || []);
      setAuditLogs(logsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (userId, newStatus, reason = null) => {
    try {
      await api.updateUserStatus(userId, { status: newStatus, reason });
      setActionUser(null);
      setActionReason("");
      fetchData();
    } catch (e) {
      alert(e.message || "Failed to update user status.");
    }
  };

  const handleRunVerification = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditLogs();
      setVerificationResult(res);
    } catch (e) {
      alert("Verification failed: " + e.message);
    } finally {
      setVerifying(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesStatus = !userStatusFilter || u.status === userStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.category.toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
            Administrator Security Console
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
            Organization Governance, Identity Approvals, and Tamper-Evident Audit Verification
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Metric Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--electric-indigo)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Total Users</span>
              <Users size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.total_users}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {stats.active_users} active &bull; {stats.suspended_users} suspended
            </div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px", borderLeft: stats.pending_approvals > 0 ? "4px solid var(--amber)" : "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--amber)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Pending Approvals</span>
              <Clock size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.pending_approvals}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Requires admin sign-off
            </div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--trust-teal)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Total Documents</span>
              <FileText size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.total_documents}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Metadata monitored
            </div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--electric-indigo)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Active Sessions</span>
              <Activity size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.active_sessions_count}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Revocable on demand
            </div>
          </div>

          <div
            className="vault-card"
            style={{
              padding: "18px 20px",
              backgroundColor: stats.audit_chain_valid ? "#F0FDF4" : "var(--danger-light)",
              border: stats.audit_chain_valid ? "1px solid #BBF7D0" : "1px solid #FECACA",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: stats.audit_chain_valid ? "#166534" : "#991B1B" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Audit Integrity</span>
              {stats.audit_chain_valid ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", marginTop: "8px", color: stats.audit_chain_valid ? "#166534" : "#991B1B" }}>
              {stats.audit_chain_valid ? "CHAIN INTACT" : "TAMPERING DETECTED"}
            </div>
            <div style={{ fontSize: "12px", color: stats.audit_chain_valid ? "#15803D" : "#991B1B", marginTop: "2px" }}>
              {stats.total_audit_events} total events chained
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", marginBottom: "24px" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "overview" ? "3px solid var(--electric-indigo)" : "3px solid transparent",
            fontWeight: activeTab === "overview" ? "700" : "500",
            color: activeTab === "overview" ? "var(--electric-indigo)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <BarChart3 size={16} />
          <span>Security &amp; Activity Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "users" ? "3px solid var(--electric-indigo)" : "3px solid transparent",
            fontWeight: activeTab === "users" ? "700" : "500",
            color: activeTab === "users" ? "var(--electric-indigo)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Users size={16} />
          <span>User Approvals &amp; Management ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "documents" ? "3px solid var(--electric-indigo)" : "3px solid transparent",
            fontWeight: activeTab === "documents" ? "700" : "500",
            color: activeTab === "documents" ? "var(--electric-indigo)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FileText size={16} />
          <span>Document Metadata Monitor ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "audit" ? "3px solid var(--electric-indigo)" : "3px solid transparent",
            fontWeight: activeTab === "audit" ? "700" : "500",
            color: activeTab === "audit" ? "var(--electric-indigo)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ShieldCheck size={16} />
          <span>Tamper-Evident Audit Chain ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab 0: Security & Activity Analytics */}
      {activeTab === "overview" && stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Security Alerts Section */}
          {stats.security_alerts && stats.security_alerts.length > 0 && (
            <div className="vault-card" style={{ padding: "20px 24px", borderLeft: "4px solid var(--amber)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <AlertTriangle size={20} style={{ color: "var(--amber)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--midnight-indigo)" }}>
                  Active Security Interceptions &amp; Action Items
                </h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                {stats.security_alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor:
                        alert.severity === "CRITICAL"
                          ? "var(--danger-light)"
                          : alert.severity === "HIGH"
                          ? "#FEF3C7"
                          : alert.severity === "MEDIUM"
                          ? "var(--soft-lavender)"
                          : "#F1F5F9",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            alert.severity === "CRITICAL"
                              ? "#EF4444"
                              : alert.severity === "HIGH"
                              ? "#F59E0B"
                              : alert.severity === "MEDIUM"
                              ? "var(--electric-indigo)"
                              : "#64748B",
                          color: "#FFFFFF",
                        }}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--midnight-indigo)", marginTop: "4px" }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {alert.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Database-Backed Charts Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "24px" }}>
            {/* Chart 1: Activity Trends & Operation Distribution */}
            <div className="vault-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--midnight-indigo)" }}>
                    Activity Trends &amp; Operation Frequency
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Real database-backed distribution of recent tenant audit actions
                  </p>
                </div>
                <TrendingUp size={20} style={{ color: "var(--electric-indigo)" }} />
              </div>

              {stats.activity_timeline && stats.activity_timeline.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(() => {
                    const maxCount = Math.max(...stats.activity_timeline.map((item) => item.count), 1);
                    return stats.activity_timeline.map((item, idx) => {
                      const pct = Math.round((item.count / maxCount) * 100);
                      const colors = ["#635BDB", "#13B8A6", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];
                      const barColor = colors[idx % colors.length];
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                            <span style={{ fontWeight: "600", fontFamily: "var(--font-mono)", color: "var(--midnight-indigo)" }}>
                              {item.action}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>
                              {item.count} events
                            </span>
                          </div>
                          <div style={{ height: "10px", width: "100%", backgroundColor: "#F1F5F9", borderRadius: "999px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                backgroundColor: barColor,
                                borderRadius: "999px",
                                transition: "width 0.6s ease-in-out",
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  No activity trends recorded yet.
                </div>
              )}
            </div>

            {/* Chart 2: Document Classification & Category Breakdown */}
            <div className="vault-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--midnight-indigo)" }}>
                    Document Classification &amp; Categories
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Tenant-isolated document volumes by category tag
                  </p>
                </div>
                <PieChart size={20} style={{ color: "var(--trust-teal)" }} />
              </div>

              {stats.category_distribution && Object.keys(stats.category_distribution).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {(() => {
                    const totalDocs = Object.values(stats.category_distribution).reduce((a, b) => a + b, 0) || 1;
                    return Object.entries(stats.category_distribution).map(([cat, count], idx) => {
                      const share = Math.round((count / totalDocs) * 100);
                      const colors = ["#13B8A6", "#635BDB", "#F59E0B", "#3B82F6", "#EC4899", "#84CC16"];
                      const barColor = colors[idx % colors.length];
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", marginBottom: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: barColor, display: "inline-block" }} />
                              <span style={{ fontWeight: "600", color: "var(--midnight-indigo)" }}>{cat || "Uncategorized"}</span>
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              <strong>{count}</strong> docs ({share}%)
                            </div>
                          </div>
                          <div style={{ height: "10px", width: "100%", backgroundColor: "#F1F5F9", borderRadius: "999px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${share}%`,
                                backgroundColor: barColor,
                                borderRadius: "999px",
                                transition: "width 0.6s ease-in-out",
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  No categorized documents uploaded yet.
                </div>
              )}
            </div>
          </div>

          {/* Security Interception Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            <div className="vault-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626" }}>
                  <Ban size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                    Denied Access Attempts
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                    {stats.denied_access_attempts || 0}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px", lineHeight: "1.5" }}>
                All unauthorized downloads, permissions escalations, or unapproved login attempts are intercepted and recorded with client IP.
              </p>
            </div>

            <div className="vault-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", color: "#166534" }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                    Cryptographic Audit Chain
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#166534" }}>
                    {stats.audit_chain_valid ? "VALIDATED" : "CHECK REQUIRED"}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px", lineHeight: "1.5" }}>
                Each event links to the previous via SHA-256 hash. The audit log cannot be modified without breaking subsequent links.
              </p>
            </div>

            <div className="vault-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--soft-lavender)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--electric-indigo)" }}>
                  <Lock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                    Separation of Duties
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                    ENFORCED
                  </div>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px", lineHeight: "1.5" }}>
                Administrator accounts cannot download confidential document content. Access requires explicit owner grants.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: User Management */}
      {activeTab === "users" && (
        <div className="vault-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", gap: "16px", backgroundColor: "#F8FAFC" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search user name or email..."
                className="input-control"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ paddingLeft: "36px" }}
              />
            </div>
            <select
              className="input-control"
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              style={{ width: "200px" }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <table className="vault-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th>Phone Number</th>
                <th>Joined</th>
                <th>Administrative Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--midnight-indigo)" }}>{u.full_name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{u.email}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: "var(--soft-lavender)", color: "var(--electric-indigo)" }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.status === "ACTIVE" && <span className="badge badge-active">Active</span>}
                      {u.status === "PENDING_APPROVAL" && <span className="badge badge-pending">Pending Approval</span>}
                      {u.status === "SUSPENDED" && <span className="badge badge-danger">Suspended</span>}
                      {u.status === "REJECTED" && <span className="badge badge-danger">Rejected</span>}
                    </td>
                    <td style={{ fontSize: "13px" }}>{u.phone_number}</td>
                    <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {u.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(u.id, "ACTIVE")}
                              className="btn btn-teal"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              onClick={() => {
                                setActionUser(u);
                                setActionType("REJECT");
                              }}
                              className="btn btn-outline-danger"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                        {u.status === "ACTIVE" && (
                          <button
                            onClick={() => {
                              setActionUser(u);
                              setActionType("SUSPEND");
                            }}
                            className="btn btn-outline-danger"
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                          >
                            <Ban size={14} /> Suspend
                          </button>
                        )}
                        {u.status === "SUSPENDED" && (
                          <button
                            onClick={() => handleStatusChange(u.id, "ACTIVE")}
                            className="btn btn-secondary"
                            style={{ padding: "5px 10px", fontSize: "12px", color: "var(--trust-teal)" }}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Document Metadata Monitor */}
      {activeTab === "documents" && (
        <div>
          {/* Separation of Duties Notice */}
          <div
            style={{
              backgroundColor: "var(--soft-lavender)",
              border: "1px solid var(--soft-lavender-border)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <Lock size={22} style={{ color: "var(--electric-indigo)", flexShrink: 0 }} />
            <div style={{ fontSize: "13px", color: "var(--midnight-indigo)", lineHeight: "1.5" }}>
              <strong>Zero-Trust Separation of Administrative Duties:</strong> Administrators oversee
              metadata governance (file size, classification, owner, timestamps) but are{" "}
              <strong style={{ color: "var(--danger-red)" }}>strictly prohibited</strong> from viewing
              or downloading confidential document contents.
            </div>
          </div>

          <div className="vault-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "#F8FAFC" }}>
              <div style={{ position: "relative", maxWidth: "400px" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Filter documents..."
                  className="input-control"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  style={{ paddingLeft: "36px" }}
                />
              </div>
            </div>

            <table className="vault-table">
              <thead>
                <tr>
                  <th>Document Title &amp; Category</th>
                  <th>Original Filename</th>
                  <th>Owner</th>
                  <th>File Size</th>
                  <th>Uploaded Date</th>
                  <th>SHA-256 Checksum</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                      No documents found in vault.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: "700", color: "var(--midnight-indigo)" }}>{d.title}</div>
                        <span className="badge badge-teal" style={{ marginTop: "4px" }}>{d.category}</span>
                      </td>
                      <td style={{ fontSize: "13px" }}>{d.original_filename}</td>
                      <td>
                        <div style={{ fontSize: "13px", fontWeight: "600" }}>{d.owner_name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.owner_email}</div>
                      </td>
                      <td style={{ fontSize: "13px" }}>{(d.file_size / 1024).toFixed(1)} KB</td>
                      <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: "11px",
                            backgroundColor: "#F1F5F9",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            color: "#475569",
                          }}
                          title={d.file_hash_sha256}
                        >
                          {d.file_hash_sha256.substring(0, 16)}...
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Tamper-Evident Audit Chain */}
      {activeTab === "audit" && (
        <div>
          {/* Verification Engine Action Card */}
          <div
            className="vault-card"
            style={{
              padding: "20px 24px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(135deg, #151B3D 0%, #1E293B 100%)",
              color: "#FFFFFF",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={20} style={{ color: "var(--trust-teal)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Cryptographic Audit Chain Verifier</h3>
              </div>
              <p style={{ fontSize: "13px", color: "#CBD5E1", marginTop: "4px", maxWidth: "600px" }}>
                Scans all sequence links $H_i = \text{SHA256}(H_{i-1} \parallel \text{event})$. Detects any record
                deletion, metadata alteration, or hash mismatch.
              </p>
            </div>
            <button
              onClick={handleRunVerification}
              disabled={verifying}
              className="btn btn-teal"
              style={{ padding: "10px 18px", fontSize: "14px" }}
            >
              {verifying ? "Executing Verification..." : "Run Chain Integrity Check"}
            </button>
          </div>

          {verificationResult && (
            <div
              style={{
                marginBottom: "20px",
                padding: "16px 20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: verificationResult.is_valid ? "#F0FDF4" : "var(--danger-light)",
                border: verificationResult.is_valid ? "1px solid #BBF7D0" : "1px solid #FECACA",
                color: verificationResult.is_valid ? "#166534" : "#991B1B",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {verificationResult.is_valid ? <CheckCircle2 size={22} /> : <ShieldAlert size={22} />}
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px" }}>
                    {verificationResult.message}
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "2px" }}>
                    Verified {verificationResult.verified_events} of {verificationResult.total_events} events. Latest hash:{" "}
                    <span className="font-mono">{verificationResult.latest_hash?.substring(0, 20)}...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="vault-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Seq #</th>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Resource</th>
                  <th>Outcome</th>
                  <th>Prev &bull; Event Hash</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: "700" }}>#{log.sequence_number}</td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: "#F1F5F9", color: "var(--midnight-indigo)" }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: "13px" }}>{log.actor_email || "System"}</td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{log.resource_type}</td>
                    <td>
                      {log.outcome === "SUCCESS" && <span className="badge badge-active">SUCCESS</span>}
                      {log.outcome === "DENIED" && <span className="badge badge-danger">DENIED</span>}
                      {log.outcome === "FAILURE" && <span className="badge badge-danger">FAILURE</span>}
                    </td>
                    <td>
                      <div className="font-mono" style={{ fontSize: "10px", color: "#64748B" }}>
                        <div>P: {log.prev_hash.substring(0, 10)}...</div>
                        <div style={{ color: "var(--electric-indigo)" }}>E: {log.event_hash.substring(0, 10)}...</div>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedAuditDetails(log)}
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for User Status Action (Reject/Suspend) */}
      <Modal
        isOpen={!!actionUser}
        onClose={() => setActionUser(null)}
        title={actionType === "REJECT" ? "Reject Registration" : "Suspend Active User"}
      >
        <div>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>
            {actionType === "REJECT"
              ? `Provide a reason for rejecting ${actionUser?.full_name}'s registration request.`
              : `Suspending ${actionUser?.full_name} will immediately invalidate all active sessions across all devices.`}
          </p>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
              Administrative Reason
            </label>
            <textarea
              className="input-control"
              rows={3}
              placeholder="e.g. Identity verification could not be confirmed / security policy violation."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={() => setActionUser(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => handleStatusChange(actionUser.id, actionType === "REJECT" ? "REJECTED" : "SUSPENDED", actionReason)}
              className="btn btn-danger"
            >
              Confirm {actionType === "REJECT" ? "Rejection" : "Suspension"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal for Audit Event Details */}
      <Modal
        isOpen={!!selectedAuditDetails}
        onClose={() => setSelectedAuditDetails(null)}
        title={`Audit Event #${selectedAuditDetails?.sequence_number} &bull; ${selectedAuditDetails?.action}`}
      >
        {selectedAuditDetails && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px", fontSize: "13px" }}>
              <div>
                <strong>Timestamp:</strong> {new Date(selectedAuditDetails.timestamp).toISOString()}
              </div>
              <div>
                <strong>Actor:</strong> {selectedAuditDetails.actor_email}
              </div>
              <div>
                <strong>Client IP:</strong> {selectedAuditDetails.ip_address || "Internal"}
              </div>
              <div>
                <strong>Outcome:</strong> {selectedAuditDetails.outcome}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <strong>Chained SHA-256 Hashes:</strong>
              <div style={{ backgroundColor: "#F8FAFC", padding: "10px", borderRadius: "var(--radius-md)", fontSize: "11px", marginTop: "6px" }} className="font-mono">
                <div><strong>Prev Hash:</strong> {selectedAuditDetails.prev_hash}</div>
                <div style={{ marginTop: "4px", color: "var(--electric-indigo)" }}><strong>Event Hash:</strong> {selectedAuditDetails.event_hash}</div>
              </div>
            </div>

            <div>
              <strong>Structured Details Payload:</strong>
              <pre
                className="font-mono"
                style={{
                  backgroundColor: "#0F172A",
                  color: "#38BDF8",
                  padding: "12px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "12px",
                  overflowX: "auto",
                  marginTop: "6px",
                  maxHeight: "200px",
                }}
              >
                {JSON.stringify(JSON.parse(selectedAuditDetails.details || "{}"), null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
