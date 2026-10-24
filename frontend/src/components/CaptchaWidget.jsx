import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, X, Shield, Lock } from "lucide-react";

export function CaptchaWidget({ onVerify, verified = false }) {
  const [isChecked, setIsChecked] = useState(verified);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [userInput, setUserInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    setIsChecked(verified);
  }, [verified]);

  // Generate a random 5-character alphanumeric CAPTCHA
  const generateCaptcha = () => {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude easily confused chars (0, O, 1, I)
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setUserInput("");
    setErrorMessage("");
  };

  // Draw the distorted CAPTCHA on canvas
  useEffect(() => {
    if (!isModalOpen || !canvasRef.current || !captchaCode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background with soft gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#F1F5F9");
    gradient.addColorStop(1, "#E2E8F0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add background noise dots
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 150)}, ${Math.floor(Math.random() * 150)}, ${Math.floor(Math.random() * 200)}, 0.4)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add interference lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(99, 91, 219, ${0.2 + Math.random() * 0.3})`;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.bezierCurveTo(
        Math.random() * canvas.width, Math.random() * canvas.height,
        Math.random() * canvas.width, Math.random() * canvas.height,
        Math.random() * canvas.width, Math.random() * canvas.height
      );
      ctx.stroke();
    }

    // Draw characters with random rotation and font
    const colors = ["#151B3D", "#635BDB", "#0F766E", "#1E293B", "#4338CA"];
    for (let i = 0; i < captchaCode.length; i++) {
      const char = captchaCode[i];
      ctx.save();
      const x = 24 + i * 32;
      const y = 34 + Math.random() * 6;
      const angle = (Math.random() - 0.5) * 0.45; // slight tilt
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = `bold ${24 + Math.floor(Math.random() * 5)}px 'Courier New', monospace`;
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  }, [isModalOpen, captchaCode]);

  const handleOpenChallenge = () => {
    if (isChecked) return;
    generateCaptcha();
    setIsModalOpen(true);
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim()) {
      setErrorMessage("Please enter the security characters.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      if (userInput.trim().toUpperCase() === captchaCode) {
        setIsChecked(true);
        setIsModalOpen(false);
        setSubmitting(false);
        onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
      } else {
        setErrorMessage("Incorrect code. Please try again with a new challenge.");
        setSubmitting(false);
        generateCaptcha();
      }
    }, 400);
  };

  return (
    <div>
      {/* CAPTCHA Trigger Bar */}
      <div
        style={{
          border: isChecked ? "1px solid #BBF7D0" : "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          backgroundColor: isChecked ? "#F0FDF4" : "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
              border: isChecked ? "2px solid var(--trust-teal)" : "2px solid #CBD5E1",
              backgroundColor: isChecked ? "var(--trust-teal-light)" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isChecked ? "default" : "pointer",
              outline: "none",
              transition: "all 0.2s",
            }}
          >
            {isChecked && <CheckCircle2 size={18} style={{ color: "var(--trust-teal)" }} />}
          </button>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: isChecked ? "#166534" : "var(--text-main)" }}>
              {isChecked ? "Human verification confirmed" : "Click to complete security verification"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: "var(--electric-indigo)", fontWeight: "600" }}>TrustVault Shield</span>
              <span>&bull; Anti-bot challenge verification</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--electric-indigo)" }}>
            <ShieldCheck size={18} />
            <span style={{ fontSize: "11px", fontWeight: "700" }}>CAPTCHA</span>
          </div>
          <span style={{ fontSize: "9px", color: "#94A3B8" }}>Protected</span>
        </div>
      </div>

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
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={20} style={{ color: "var(--electric-indigo)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
                  Security Verification
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
              Type the 5 characters shown below to confirm you are human.
            </p>

            {/* Distorted Canvas Image Display */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                border: "1px solid #CBD5E1",
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

            {errorMessage && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--danger)",
                  backgroundColor: "var(--danger-light)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "14px",
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="text"
                autoFocus
                maxLength={5}
                placeholder="Enter 5 characters"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                className="input-control"
                style={{
                  textAlign: "center",
                  fontSize: "18px",
                  letterSpacing: "4px",
                  fontWeight: "700",
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
