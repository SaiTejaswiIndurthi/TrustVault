import React from "react";

export function Logo({ size = 36, showText = true, light = false }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 2px 6px rgba(99, 91, 219, 0.3))" }}
      >
        <defs>
          <linearGradient id="shieldGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#635BDB" />
            <stop offset="1" stopColor="#151B3D" />
          </linearGradient>
          <linearGradient id="tealGrad" x1="16" y1="18" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#13B8A6" />
            <stop offset="1" stopColor="#0D9488" />
          </linearGradient>
        </defs>

        {/* Outer Hex/Shield Body */}
        <path
          d="M24 3L6 10.5V23C6 34.2 13.8 44.5 24 47C34.2 44.5 42 34.2 42 23V10.5L24 3Z"
          fill="url(#shieldGrad)"
          stroke="#635BDB"
          strokeWidth="1.5"
        />

        {/* Shield Border Inner Contour */}
        <path
          d="M24 7L10 12.8V22.5C10 31.5 16.1 39.8 24 42C31.9 39.8 38 31.5 38 22.5V12.8L24 7Z"
          stroke="#13B8A6"
          strokeWidth="1.5"
          strokeOpacity="0.4"
          fill="none"
        />

        {/* Lock Shackle */}
        <path
          d="M19 22V17C19 14.2386 21.2386 12 24 12C26.7614 12 29 14.2386 29 17V22"
          stroke="#EEEAFE"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Lock Body */}
        <rect
          x="16"
          y="22"
          width="16"
          height="13"
          rx="3"
          fill="url(#tealGrad)"
          stroke="#CCFBF1"
          strokeWidth="1"
        />

        {/* Keyhole */}
        <circle cx="24" cy="27" r="2" fill="#151B3D" />
        <path d="M23 27H25L25.5 31H22.5L23 27Z" fill="#151B3D" />
      </svg>

      {showText && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: "800",
                letterSpacing: "-0.03em",
                color: light ? "#FFFFFF" : "var(--midnight-indigo)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Trust
            </span>
            <span
              style={{
                fontSize: "20px",
                fontWeight: "800",
                letterSpacing: "-0.03em",
                color: "var(--electric-indigo)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Vault
            </span>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--trust-teal)",
                marginLeft: "2px",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: light ? "#A5B4FC" : "var(--text-muted)",
              marginTop: "-2px",
            }}
          >
            Zero-Trust Vault
          </span>
        </div>
      )}
    </div>
  );
}
