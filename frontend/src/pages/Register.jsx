import React, { useState } from "react";
import { api } from "../services/api";
import { Logo } from "../components/Logo";
import { CaptchaWidget } from "../components/CaptchaWidget";
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Building,
  ArrowRight,
  Clock,
} from "lucide-react";

export function Register({ onNavigate }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+1-555-019-2831");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("VIEWER");
  const [tenantName, setTenantName] = useState("CyberCorp Defense & Financial");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete CAPTCHA human verification.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        full_name: fullName,
        email,
        phone_number: phone,
        password,
        confirm_password: confirmPassword,
        role,
        tenant_name: tenantName,
        captcha_token: captchaToken,
      });
      setSuccessData(res);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--cloud-white)" }}>
      {/* Left Column: Security Illustration & Overview */}
      <div
        style={{
          flex: "1 1 45%",
          background: "linear-gradient(145deg, #151B3D 0%, #0D122B 100%)",
          color: "#FFFFFF",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Logo size={42} light={true} />
          <div style={{ marginTop: "48px", maxWidth: "440px" }}>
            <span
              style={{
                backgroundColor: "rgba(19, 184, 166, 0.2)",
                color: "var(--trust-teal)",
                border: "1px solid rgba(19, 184, 166, 0.4)",
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: "12px",
                fontWeight: "700",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Zero-Trust Onboarding
            </span>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "800",
                lineHeight: "1.25",
                marginTop: "18px",
                letterSpacing: "-0.02em",
              }}
            >
              Strict Multi-Tenant Document Governance
            </h1>
            <p style={{ marginTop: "14px", color: "#CBD5E1", fontSize: "14px", lineHeight: "1.6" }}>
              Every registration is strictly scoped to an organization and quarantined in{" "}
              <strong style={{ color: "var(--amber)" }}>PENDING_APPROVAL</strong> status until an
              authorized administrator verifies your identity.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={16} style={{ color: "var(--trust-teal)" }} />
            <span style={{ fontSize: "13px", color: "#E2E8F0" }}>Argon2id password hashing with distinct per-user salts</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={16} style={{ color: "var(--trust-teal)" }} />
            <span style={{ fontSize: "13px", color: "#E2E8F0" }}>Mandatory backend-validated Turnstile/reCAPTCHA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={16} style={{ color: "var(--trust-teal)" }} />
            <span style={{ fontSize: "13px", color: "#E2E8F0" }}>Immutable append-only audit trail registration logging</span>
          </div>
        </div>

        <div style={{ fontSize: "12px", color: "#64748B" }}>
          TrustVault &bull; Secure Sharing, Smarter Access, Verifiable Accountability.
        </div>
      </div>

      {/* Right Column: Registration Form or Pending Approval Card */}
      <div
        style={{
          flex: "1 1 55%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 32px",
        }}
      >
        <div style={{ maxWidth: "520px", width: "100%" }}>
          {successData ? (
            <div
              className="vault-card"
              style={{
                border: "2px solid var(--amber)",
                boxShadow: "0 10px 25px rgba(245, 158, 11, 0.15)",
                textAlign: "center",
                padding: "36px 32px",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "var(--amber-light)",
                  color: "var(--amber)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px auto",
                }}
              >
                <Clock size={32} />
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                Registration Submitted
              </h2>
              <div
                className="badge badge-pending"
                style={{ marginTop: "12px", padding: "6px 14px", fontSize: "13px" }}
              >
                STATUS: PENDING_APPROVAL
              </div>
              <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Your account for <strong>{successData.email}</strong> has been registered with role{" "}
                <strong>{successData.role}</strong>.
              </p>
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  backgroundColor: "#F8FAFC",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  textAlign: "left",
                  fontSize: "13px",
                  color: "#475569",
                }}
              >
                <strong>Security Enforcement:</strong> In accordance with TrustVault security policy,
                new accounts cannot log in or access documents until explicitly approved by an organization
                Administrator.
              </div>
              <button
                type="button"
                onClick={() => onNavigate("login")}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "24px", padding: "11px" }}
              >
                Return to Login
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                  Create TrustVault Account
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Join an isolated corporate organization with verifiable access controls
                </p>
              </div>

              {error && (
                <div
                  style={{
                    backgroundColor: "var(--danger-light)",
                    border: "1px solid #FECACA",
                    borderRadius: "var(--radius-md)",
                    padding: "10px 14px",
                    marginBottom: "18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#991B1B",
                    fontSize: "13px",
                  }}
                >
                  <AlertCircle size={16} />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      className="input-control"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      className="input-control"
                      placeholder="jane@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Mobile (with Country Code)
                    </label>
                    <input
                      type="tel"
                      required
                      className="input-control"
                      placeholder="+1-555-019-2831"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      className="input-control"
                      placeholder="CyberCorp Security"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Requested Role
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        border: role === "VIEWER" ? "2px solid var(--electric-indigo)" : "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: role === "VIEWER" ? "var(--soft-lavender)" : "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="VIEWER"
                        checked={role === "VIEWER"}
                        onChange={() => setRole("VIEWER")}
                      />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "700" }}>Viewer</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Read/download shared files</div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        border: role === "DOCUMENT_OWNER" ? "2px solid var(--trust-teal)" : "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: role === "DOCUMENT_OWNER" ? "var(--trust-teal-light)" : "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="DOCUMENT_OWNER"
                        checked={role === "DOCUMENT_OWNER"}
                        onChange={() => setRole("DOCUMENT_OWNER")}
                      />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "700" }}>Document Owner</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Upload &amp; manage grants</div>
                      </div>
                    </label>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                    * Administrator accounts require secure invitations and trusted provisioning.
                  </div>
                </div>

                {/* Passwords */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Password (min 10 chars)
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="input-control"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="input-control"
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* CAPTCHA challenge */}
                <CaptchaWidget onVerify={(token) => setCaptchaToken(token)} verified={!!captchaToken} />

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "11px", fontSize: "14px", marginTop: "6px" }}
                >
                  {loading ? "Submitting Registration..." : "Register Account for Review"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--text-muted)" }}>
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => onNavigate("login")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--electric-indigo)",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
