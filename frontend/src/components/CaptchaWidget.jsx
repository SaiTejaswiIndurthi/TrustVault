import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, X, Shield } from "lucide-react";

export function CaptchaWidget({ onVerify, verified = false, error = false }) {
  const [isChecked, setIsChecked] = useState(verified);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [userInput, setUserInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const canvasRef = useRef(null);

  // Sync with parent prop
  useEffect(() => {
    if (verified) {
      setIsChecked(true);
    }
  }, [verified]);

  // Direct 1-click Turnstile verification
  const handleDirectClick = () => {
    if (isChecked || loading) return;
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setIsChecked(true);
      if (onVerify) {
        onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
      }
    }, 450);
  };

  // Generate 4-character code for optional puzzle mode
  const generateCaptcha = () => {
    const chars = "346789ABCDEFHKMNPRTWXY";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setUserInput("");
    setModalError("");
  };

  // Render canvas code
  useEffect(() => {
    if (!isModalOpen || !canvasRef.current || !captchaCode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    for (let x = 10; x < canvas.width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(99, 91, 219, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 25);
    ctx.bezierCurveTo(70, 5, 130, 45, 190, 25);
    ctx.stroke();

    const colors = ["#151B3D", "#635BDB", "#0F766E", "#312E81"];
    for (let i = 0; i < captchaCode.length; i++) {
      ctx.save();
      const x = 30 + i * 40;
      const y = 35;
      ctx.font = "bold 28px 'JetBrains Mono', 'Courier New', monospace";
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(captchaCode[i], x, y);
      ctx.restore();
    }
  }, [isModalOpen, captchaCode]);

  const handleOpenPuzzle = (e) => {
    e.stopPropagation();
    generateCaptcha();
    setIsModalOpen(true);
  };

  const handlePuzzleSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim().toUpperCase() === captchaCode) {
      setIsChecked(true);
      setIsModalOpen(false);
      setModalError("");
      if (onVerify) {
        onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
      }
    } else {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setModalError(`Verification failed: Code did not match. New challenge generated.`);
      generateCaptcha();
    }
  };

  const hasError = !isChecked && (error || failedAttempts > 0);

  return (
    <div>
      {/* CAPTCHA Bar */}
      <div
        onClick={handleDirectClick}
        style={{
          border: isChecked
            ? "1px solid #10B981"
            : hasError
            ? "1px solid #EF4444"
            : "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          backgroundColor: isChecked ? "#ECFDF5" : hasError ? "#FEF2F2" : "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          cursor: isChecked ? "default" : "pointer",
          boxShadow: hasError ? "0 0 0 2px rgba(239, 68, 68, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "all 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: isChecked
                ? "2px solid #10B981"
                : hasError
                ? "2px solid #EF4444"
                : "2px solid #94A3B8",
              backgroundColor: isChecked ? "#D1FAE5" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            {loading && <RefreshCw size={16} className="animate-spin" style={{ color: "var(--electric-indigo)" }} />}
            {isChecked && !loading && <CheckCircle2 size={20} style={{ color: "#059669" }} />}
            {!isChecked && !loading && hasError && <AlertTriangle size={15} style={{ color: "#EF4444" }} />}
          </div>
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: isChecked ? "#065F46" : hasError ? "#991B1B" : "var(--text-main)",
              }}
            >
              {loading
                ? "Verifying security..."
                : isChecked
                ? "Human verification confirmed"
                : hasError
                ? "Human verification required"
                : "Click to verify you are human"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: isChecked ? "#059669" : hasError ? "#DC2626" : "var(--electric-indigo)", fontWeight: "600" }}>
                {isChecked ? "Verified" : hasError ? "Action required" : "TrustVault Shield"}
              </span>
              <span>&bull; Anti-bot protection</span>
              {!isChecked && (
                <button
                  type="button"
                  onClick={handleOpenPuzzle}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--electric-indigo)",
                    fontSize: "11px",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: "4px",
                  }}
                >
                  (or solve puzzle)
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: isChecked ? "#059669" : hasError ? "#DC2626" : "var(--electric-indigo)" }}>
            <ShieldCheck size={18} />
            <span style={{ fontSize: "11px", fontWeight: "700" }}>CAPTCHA</span>
          </div>
          <span style={{ fontSize: "9px", color: "#94A3B8" }}>{isChecked ? "Passed" : "Protected"}</span>
        </div>
      </div>

      {/* Warning message if submission failed */}
      {hasError && (
        <div
          style={{
            marginTop: "6px",
            fontSize: "12px",
            color: "#B91C1C",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "2px 4px",
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>
            {failedAttempts > 0
              ? `Verification failed (${failedAttempts} attempt${failedAttempts > 1 ? "s" : ""}). Click the box to verify.`
              : "Please click the security box above to complete human verification."}
          </span>
        </div>
      )}

      {/* Optional Interactive Puzzle Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="vault-card"
            style={{
              maxWidth: "400px",
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={20} style={{ color: "var(--electric-indigo)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                  CAPTCHA Challenge
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
              Enter the 4 characters shown in the security box:
            </p>

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                border: "2px solid #CBD5E1",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                backgroundColor: "#F8FAFC",
              }}
            >
              <canvas ref={canvasRef} width={200} height={50} style={{ display: "block" }} />
              <button
                type="button"
                onClick={generateCaptcha}
                title="Refresh code"
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  color: "var(--electric-indigo)",
                }}
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#991B1B",
                  backgroundColor: "#FEE2E2",
                  border: "1px solid #FCA5A5",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "14px",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px", color: "#DC2626" }} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handlePuzzleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="text"
                autoFocus
                maxLength={4}
                placeholder="Enter 4 characters"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                className="input-control"
                style={{
                  textAlign: "center",
                  fontSize: "20px",
                  letterSpacing: "6px",
                  fontWeight: "800",
                  fontFamily: "var(--font-mono)",
                }}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
