import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, X, Shield, Lock } from "lucide-react";

export function CaptchaWidget({ onVerify, verified = false, error = false }) {
  const [internalChecked, setInternalChecked] = useState(verified);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [userInput, setUserInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const canvasRef = useRef(null);

  // Consider verified if either prop or internal state says verified
  const isChecked = verified || internalChecked;

  // Generate a clean, high-readability 4-character code (avoiding confusing characters)
  const generateCaptcha = () => {
    const chars = "346789ABCDEFHKMNPRTWXY"; // Clean, high-legibility characters
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setUserInput("");
    setErrorMessage("");
  };

  // Render the verification badge onto the canvas
  useEffect(() => {
    if (!isModalOpen || !canvasRef.current || !captchaCode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and draw background
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle background grid
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    for (let x = 10; x < canvas.width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 10; y < canvas.height; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Subtle security line
    ctx.strokeStyle = "rgba(99, 91, 219, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 25);
    ctx.bezierCurveTo(70, 5, 130, 45, 190, 25);
    ctx.stroke();

    // Draw characters clearly with high contrast
    const colors = ["#151B3D", "#635BDB", "#0F766E", "#312E81"];
    for (let i = 0; i < captchaCode.length; i++) {
      const char = captchaCode[i];
      ctx.save();
      const x = 30 + i * 40;
      const y = 35;
      ctx.font = "bold 28px 'JetBrains Mono', 'Courier New', monospace";
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(char, x, y);
      ctx.restore();
    }
  }, [isModalOpen, captchaCode]);

  const handleOpenChallenge = () => {
    if (isChecked) return;
    setErrorMessage("");
    generateCaptcha();
    setIsModalOpen(true);
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    const cleanInput = userInput.trim().toUpperCase();
    if (!cleanInput) {
      setErrorMessage("Please enter the 4 characters shown in the box.");
      triggerShake();
      return;
    }

    setSubmitting(true);
    // Instant verification on match
    if (cleanInput === captchaCode.trim().toUpperCase()) {
      setInternalChecked(true);
      setIsModalOpen(false);
      setSubmitting(false);
      setErrorMessage("");
      setFailedAttempts(0);
      if (onVerify) {
        onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
      }
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setErrorMessage(`Code does not match. Try this new code:`);
      setSubmitting(false);
      triggerShake();
      generateCaptcha();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  const hasError = !isChecked && (error || failedAttempts > 0);

  return (
    <div>
      {/* CAPTCHA Trigger Bar */}
      <div
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
          boxShadow: hasError ? "0 0 0 2px rgba(239, 68, 68, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "all 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={handleOpenChallenge}
            disabled={isChecked}
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
              cursor: isChecked ? "default" : "pointer",
              outline: "none",
              transition: "all 0.2s",
            }}
          >
            {isChecked && <CheckCircle2 size={20} style={{ color: "#059669" }} />}
            {!isChecked && hasError && <AlertTriangle size={15} style={{ color: "#EF4444" }} />}
          </button>
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: isChecked ? "#065F46" : hasError ? "#991B1B" : "var(--text-main)",
              }}
            >
              {isChecked
                ? "Human verification confirmed"
                : hasError
                ? "Human verification required"
                : "Click to complete security verification"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: hasError ? "#DC2626" : isChecked ? "#059669" : "var(--electric-indigo)", fontWeight: "600" }}>
                {isChecked ? "Verified" : hasError ? "Action required" : "TrustVault Shield"}
              </span>
              <span>&bull; Anti-bot challenge verification</span>
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

      {/* Warning Alert beneath the trigger if failed or incomplete */}
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
              ? `Verification not completed (${failedAttempts} failed attempt${failedAttempts > 1 ? "s" : ""}). Click above to solve.`
              : "Please click the security box above and solve the puzzle to proceed."}
          </span>
        </div>
      )}

      {/* Interactive CAPTCHA Challenge Modal */}
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
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              position: "relative",
              transform: isShaking ? "translateX(-8px)" : "none",
              transition: "transform 0.1s ease-in-out",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={20} style={{ color: "var(--electric-indigo)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                  Security Verification Challenge
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
              Enter the 4 characters shown in the security box below:
            </p>

            {/* Clear, High-Legibility Canvas Box */}
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
                title="Get a new challenge"
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--electric-indigo)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {/* Error Message with Warning Styling */}
            {errorMessage && (
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
                  lineHeight: "1.4",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px", color: "#DC2626" }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                  borderColor: errorMessage ? "#EF4444" : undefined,
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {submitting ? "Checking..." : "Verify Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
