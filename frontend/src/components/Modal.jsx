import React from "react";
import { X } from "lucide-react";

export function Modal({ isOpen, onClose, title, children, maxWidth = "560px" }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#F8FAFC",
            borderTopLeftRadius: "var(--radius-lg)",
            borderTopRightRadius: "var(--radius-lg)",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--midnight-indigo)" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}
