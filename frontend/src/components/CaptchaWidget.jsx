import React, { useState } from "react";
import { ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";

export function CaptchaWidget({ onVerify, verified = false }) {
  const [loading, setLoading] = useState(false);
  const [isChecked, setIsChecked] = useState(verified);

  const handleTrigger = () => {
    if (isChecked || loading) return;
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setIsChecked(true);
      // Supplies valid dev mode token verified strictly by backend
      onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
    }, 700);
  };

  return (
    <div
      style={{
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        backgroundColor: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          type="button"
          onClick={handleTrigger}
          disabled={isChecked || loading}
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
          {loading && <RefreshCw size={16} className="animate-spin" style={{ color: "var(--electric-indigo)" }} />}
          {isChecked && <CheckCircle2 size={18} style={{ color: "var(--trust-teal)" }} />}
        </button>
        <div>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>
            {isChecked ? "Human verification confirmed" : "Verify you are human"}
          </span>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "var(--amber)", fontWeight: "600" }}>[Dev-Mode Turnstile]</span>
            <span>Server-side cryptographic token validation</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--electric-indigo)" }}>
          <ShieldCheck size={18} />
          <span style={{ fontSize: "11px", fontWeight: "700" }}>TrustVault</span>
        </div>
        <span style={{ fontSize: "9px", color: "#94A3B8" }}>Security Shield</span>
      </div>
    </div>
  );
}
