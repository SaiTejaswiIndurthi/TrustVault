import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../components/Logo";
import { CaptchaWidget } from "../components/CaptchaWidget";
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export function Login({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!captchaToken) {
      setError("Human verification challenge required: Please complete the security puzzle below.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password, captchaToken);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail, rolePass) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setCaptchaToken("TRUSTVAULT_DEV_CAPTCHA_PASSED");
    setError("");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--cloud-white)" }}>
      {/* Left Column: Security Illustration & Overview */}
      <div
        style={{
          flex: "1 1 48%",
          background: "linear-gradient(145deg, #151B3D 0%, #0D122B 100%)",
          color: "#FFFFFF",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 10 }}>
          <Logo size={42} light={true} />
          <div style={{ marginTop: "64px", maxWidth: "460px" }}>
            <span
              style={{
                backgroundColor: "rgba(99, 91, 219, 0.2)",
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
              Enterprise Zero-Trust Platform
            </span>
            <h1
              style={{
                fontSize: "36px",
                fontWeight: "800",
                lineHeight: "1.25",
                marginTop: "20px",
                letterSpacing: "-0.02em",
              }}
            >
              Secure Sharing. <br />
              Smarter Access. <br />
              <span style={{ color: "var(--trust-teal)" }}>Verifiable Accountability.</span>
            </h1>
            <p style={{ marginTop: "16px", color: "#CBD5E1", fontSize: "15px", lineHeight: "1.6" }}>
              TrustVault strictly isolates multi-tenant documents, enforces immediate
              cryptographic revocation, and logs every access event to an append-only,
              SHA-256 hash-chained verifiable audit store.
            </p>
          </div>
        </div>

        {/* Security Pillars List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(99, 91, 219, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Lock size={16} style={{ color: "var(--trust-teal)" }} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>Zero-Trust Private Vault</div>
              <div style={{ fontSize: "11px", color: "#94A3B8" }}>Randomized storage keys outside web root</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(99, 91, 219, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={16} style={{ color: "var(--trust-teal)" }} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>Tamper-Evident SHA-256 Audit Chain</div>
              <div style={{ fontSize: "11px", color: "#94A3B8" }}>Mathematical verification detects any modification</div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ fontSize: "12px", color: "#64748B", zIndex: 10 }}>
          &copy; {new Date().getFullYear()} TrustVault Enterprise Security. Argon2id &amp; Strict Tenant Isolation.
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div
        style={{
          flex: "1 1 52%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
        }}
      >
        <div style={{ maxWidth: "460px", width: "100%" }}>
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "26px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
              Sign in to your Vault
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "6px" }}>
              Enter your credentials to access confidential workspace
            </p>
          </div>

          {/* Demonstration Quick Fill Bar */}
          <div
            style={{
              backgroundColor: "var(--soft-lavender)",
              border: "1px solid var(--soft-lavender-border)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--electric-indigo)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Quick-Fill Test Credentials:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handleQuickFill("admin@trustvault.local", "AdminPassword123!")}
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("owner@trustvault.local", "OwnerPassword123!")}
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Document Owner
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("viewer@trustvault.local", "ViewerPassword123!")}
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Viewer
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("pending@trustvault.local", "PendingPassword123!")}
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "11px", color: "var(--amber)" }}
              >
                Pending Account
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "var(--danger-light)",
                border: "1px solid #FECACA",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                color: "#991B1B",
                fontSize: "13px",
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                Work Email Address
              </label>
              <input
                type="email"
                required
                className="input-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600" }}>Password</label>
                <button
                  type="button"
                  onClick={() => onNavigate("forgot-password")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--electric-indigo)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-control"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Turnstile / reCAPTCHA widget */}
            <div>
              <CaptchaWidget
                onVerify={(token) => { setCaptchaToken(token); setError(""); }}
                verified={!!captchaToken}
                error={!!error && !captchaToken}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", fontSize: "15px", marginTop: "4px" }}
            >
              {loading ? "Authenticating..." : "Sign In to TrustVault"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "var(--text-muted)" }}>
            Don't have an approved account?{" "}
            <button
              type="button"
              onClick={() => onNavigate("register")}
              style={{
                background: "none",
                border: "none",
                color: "var(--electric-indigo)",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Register here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
