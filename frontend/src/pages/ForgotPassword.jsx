import React, { useState } from "react";
import { api } from "../services/api";
import { Logo } from "../components/Logo";
import { CaptchaWidget } from "../components/CaptchaWidget";
import { ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";

export function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("TRUSTVAULT_DEV_CAPTCHA_PASSED");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Please provide your registered work email.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email, captcha_token: captchaToken });
      setResult(res);
    } catch (err) {
      setError(err.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cloud-white)", padding: "20px" }}>
      <div className="vault-card" style={{ maxWidth: "460px", width: "100%" }}>
        <button
          onClick={() => onNavigate("login")}
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", marginBottom: "20px" }}
        >
          <ArrowLeft size={16} /> Back to Sign In
        </button>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "var(--soft-lavender)", color: "var(--electric-indigo)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" }}>
            <KeyRound size={24} />
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "var(--midnight-indigo)" }}>Reset Password</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            Enter your work email and complete verification to obtain secure password reset instructions.
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: "var(--danger-light)", padding: "10px 14px", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "8px", color: "#991B1B", fontSize: "13px", marginBottom: "16px" }}>
            <AlertCircle size={16} />
            <div>{error}</div>
          </div>
        )}

        {result ? (
          <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "var(--radius-md)", padding: "16px", color: "#166534", fontSize: "13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px" }}>
              <CheckCircle2 size={16} /> Instructions Dispatched
            </div>
            <p>{result.message}</p>
            {result.dev_reset_token && (
              <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "#FFFFFF", borderRadius: "4px", border: "1px dashed #86EFAC" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#15803D" }}>[DEV TEST TOKEN DETECTED]:</span>
                <div style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: "11px", marginTop: "4px" }}>
                  {result.dev_reset_token}
                </div>
                <button
                  onClick={() => onNavigate("reset-password", { token: result.dev_reset_token })}
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "10px", padding: "6px 12px", fontSize: "12px" }}
                >
                  Proceed to Reset with Token
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Work Email</label>
              <input
                type="email"
                required
                className="input-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <CaptchaWidget onVerify={(token) => setCaptchaToken(token)} verified={!!captchaToken} />

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "11px" }}>
              {loading ? "Verifying..." : "Send Reset Instructions"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetPassword({ onNavigate, initialToken = "" }) {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cloud-white)", padding: "20px" }}>
      <div className="vault-card" style={{ maxWidth: "460px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "var(--midnight-indigo)" }}>Set New Password</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            Sessions across all devices will be automatically revoked upon update.
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: "var(--danger-light)", padding: "10px 14px", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "8px", color: "#991B1B", fontSize: "13px", marginBottom: "16px" }}>
            <AlertCircle size={16} />
            <div>{error}</div>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: "center", padding: "16px" }}>
            <CheckCircle2 size={40} style={{ color: "var(--trust-teal)", margin: "0 auto 12px auto" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Password Updated!</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              Your password has been changed and all previous sessions invalidated.
            </p>
            <button
              onClick={() => onNavigate("login")}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "18px", padding: "10px" }}
            >
              Sign In with New Password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Reset Token</label>
              <input
                type="text"
                required
                className="input-control font-mono"
                placeholder="Secure token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>New Password</label>
              <input
                type="password"
                required
                className="input-control"
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Confirm New Password</label>
              <input
                type="password"
                required
                className="input-control"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "11px" }}>
              {loading ? "Updating..." : "Update Password & Revoke Sessions"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
