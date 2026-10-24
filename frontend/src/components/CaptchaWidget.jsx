import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Lock,
  Key,
  FileText,
  Cloud,
  Database,
  Bell,
  Eye,
  Server,
  Check,
  RotateCcw,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Image as ImageIcon,
  Type as TypeIcon,
} from "lucide-react";

// Available challenge item types
const CHALLENGE_ITEMS = [
  { type: "SHIELD", label: "Shield", icon: Shield, bg: "#EEF2FF", color: "#635BDB" },
  { type: "LOCK", label: "Padlock", icon: Lock, bg: "#F0FDF4", color: "#16A34A" },
  { type: "KEY", label: "Security Key", icon: Key, bg: "#FEF3C7", color: "#D97706" },
  { type: "DOCUMENT", label: "Document", icon: FileText, bg: "#F1F5F9", color: "#475569" },
  { type: "CLOUD", label: "Cloud", icon: Cloud, bg: "#F0F9FF", color: "#0284C7" },
  { type: "DATABASE", label: "Database", icon: Database, bg: "#FDF2F8", color: "#DB2777" },
  { type: "BELL", label: "Alert Bell", icon: Bell, bg: "#FFF7ED", color: "#EA580C" },
  { type: "EYE", label: "Monitor Eye", icon: Eye, bg: "#F5F3FF", color: "#7C3AED" },
  { type: "SERVER", label: "Server", icon: Server, bg: "#ECFEFF", color: "#0891B2" },
];

export function CaptchaWidget({ onVerify, verified = false, error = false }) {
  const [isChecked, setIsChecked] = useState(verified);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("image"); // "image" or "code"
  
  // Image Challenge State
  const [targetCategory, setTargetCategory] = useState(null);
  const [gridTiles, setGridTiles] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState(new Set());
  
  // Code Challenge State
  const [captchaCode, setCaptchaCode] = useState("");
  const [userInput, setUserInput] = useState("");
  
  // Status & Feedback
  const [challengeError, setChallengeError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const canvasRef = useRef(null);

  // Synchronize external verified state
  useEffect(() => {
    setIsChecked(verified);
  }, [verified]);

  // Generate a new Image Identification Challenge
  const generateImageChallenge = () => {
    // Pick 1 of 4 main target types: Shield, Padlock, Key, Document
    const targetPool = CHALLENGE_ITEMS.slice(0, 4);
    const chosenTarget = targetPool[Math.floor(Math.random() * targetPool.length)];
    setTargetCategory(chosenTarget);

    // Pick 3 or 4 target items, rest are distractors
    const targetCount = Math.random() > 0.5 ? 3 : 4;
    const tiles = [];

    // Add target items
    for (let i = 0; i < targetCount; i++) {
      tiles.push({
        id: `tile-target-${i}`,
        type: chosenTarget.type,
        label: chosenTarget.label,
        icon: chosenTarget.icon,
        bg: chosenTarget.bg,
        color: chosenTarget.color,
      });
    }

    // Add distractors from the remaining items
    const distractorPool = CHALLENGE_ITEMS.filter((item) => item.type !== chosenTarget.type);
    while (tiles.length < 9) {
      const distractor = distractorPool[Math.floor(Math.random() * distractorPool.length)];
      tiles.push({
        id: `tile-distractor-${tiles.length}`,
        type: distractor.type,
        label: distractor.label,
        icon: distractor.icon,
        bg: distractor.bg,
        color: distractor.color,
      });
    }

    // Shuffle tiles using Fisher-Yates
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    setGridTiles(tiles);
    setSelectedTiles(new Set());
    setChallengeError("");
  };

  // Generate 4-character Code Challenge
  const generateCodeChallenge = () => {
    const chars = "346789ABCDEFHKMNPRTWXY";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setUserInput("");
    setChallengeError("");
  };

  // Render code canvas when code tab or code changes
  useEffect(() => {
    if (activeTab !== "code" || !isModalOpen || !canvasRef.current || !captchaCode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid gridlines for anti-OCR distortion
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    for (let x = 10; x < canvas.width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Wavy noise curve
    ctx.strokeStyle = "rgba(99, 91, 219, 0.35)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(10, 25);
    ctx.bezierCurveTo(60, 5, 140, 45, 190, 25);
    ctx.stroke();

    // Characters with slight random shifts
    const colors = ["#151B3D", "#635BDB", "#0F766E", "#312E81"];
    for (let i = 0; i < captchaCode.length; i++) {
      ctx.save();
      const x = 28 + i * 42;
      const y = 35 + (Math.random() * 4 - 2);
      ctx.font = "bold 28px 'JetBrains Mono', 'Courier New', monospace";
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(captchaCode[i], x, y);
      ctx.restore();
    }
  }, [activeTab, isModalOpen, captchaCode]);

  // Open modal and initialize challenge
  const handleOpenChallenge = () => {
    if (isChecked) return;
    setChallengeError("");
    generateImageChallenge();
    generateCodeChallenge();
    setIsModalOpen(true);
  };

  // Toggle selection on tile
  const handleToggleTile = (tileId) => {
    const updated = new Set(selectedTiles);
    if (updated.has(tileId)) {
      updated.delete(tileId);
    } else {
      updated.add(tileId);
    }
    setSelectedTiles(updated);
    setChallengeError("");
  };

  // Verify Image Challenge
  const handleVerifyImageChallenge = (e) => {
    e.preventDefault();
    if (selectedTiles.size === 0) {
      setChallengeError(`Please select all matching tiles before clicking Verify.`);
      return;
    }

    setIsVerifying(true);
    const targetTileIds = gridTiles
      .filter((tile) => tile.type === targetCategory.type)
      .map((tile) => tile.id);

    const isMatch =
      selectedTiles.size === targetTileIds.length &&
      targetTileIds.every((id) => selectedTiles.has(id));

    setTimeout(() => {
      setIsVerifying(false);
      if (isMatch) {
        setIsChecked(true);
        setIsModalOpen(false);
        setChallengeError("");
        if (onVerify) {
          onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
        }
      } else {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        setChallengeError("Verification failed: Selection did not match. A new challenge has been generated.");
        generateImageChallenge();
      }
    }, 350);
  };

  // Verify Code Challenge
  const handleVerifyCodeChallenge = (e) => {
    e.preventDefault();
    if (!userInput.trim()) {
      setChallengeError("Please enter the 4 characters shown in the security box.");
      return;
    }

    setIsVerifying(true);
    const isMatch = userInput.trim().toUpperCase() === captchaCode;

    setTimeout(() => {
      setIsVerifying(false);
      if (isMatch) {
        setIsChecked(true);
        setIsModalOpen(false);
        setChallengeError("");
        if (onVerify) {
          onVerify("TRUSTVAULT_DEV_CAPTCHA_PASSED");
        }
      } else {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        setChallengeError("Verification failed: Incorrect code. A new code has been generated.");
        generateCodeChallenge();
      }
    }, 350);
  };

  const hasError = !isChecked && (error || failedAttempts > 0);

  return (
    <div>
      {/* CAPTCHA Trigger Bar */}
      <div
        onClick={handleOpenChallenge}
        style={{
          border: isChecked
            ? "1.5px solid #10B981"
            : hasError
            ? "1.5px solid #EF4444"
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
          transition: "all 0.2s ease-in-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Checkbox box with green tick when verified */}
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
            {isChecked && <CheckCircle2 size={20} style={{ color: "#059669" }} />}
            {!isChecked && hasError && <AlertTriangle size={16} style={{ color: "#EF4444" }} />}
          </div>

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
                ? "Verification required: Click to solve challenge"
                : "I am a human (Click to complete challenge)"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: isChecked ? "#059669" : hasError ? "#DC2626" : "var(--electric-indigo)", fontWeight: "600" }}>
                {isChecked ? "Verified" : "Security Challenge"}
              </span>
              <span>&bull;</span>
              <span>{isChecked ? "Anti-bot check passed" : "Image identification or CAPTCHA"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: isChecked ? "#059669" : hasError ? "#DC2626" : "var(--electric-indigo)",
            }}
          >
            <ShieldCheck size={18} />
            <span style={{ fontSize: "11px", fontWeight: "700" }}>CAPTCHA</span>
          </div>
          <span style={{ fontSize: "10px", color: "#94A3B8" }}>{isChecked ? "Protected" : "Click to solve"}</span>
        </div>
      </div>

      {/* Warning message if submission attempted without verifying */}
      {hasError && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#B91C1C",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0, color: "#DC2626" }} />
          <span>
            {failedAttempts > 0
              ? `Verification failed (${failedAttempts} attempt${failedAttempts > 1 ? "s" : ""}). Please click above and solve the challenge.`
              : "Please click the security box above to complete the human verification challenge."}
          </span>
        </div>
      )}

      {/* Interactive Verification Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            className="vault-card"
            style={{
              maxWidth: "430px",
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "rgba(99, 91, 219, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield size={16} style={{ color: "var(--electric-indigo)" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--midnight-indigo)", margin: 0 }}>
                    Human Verification Challenge
                  </h3>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>TrustVault Automated Bot Defense</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Tabs */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "16px",
                borderBottom: "1px solid #E2E8F0",
                paddingBottom: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab("image"); setChallengeError(""); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  backgroundColor: activeTab === "image" ? "var(--electric-indigo)" : "#F1F5F9",
                  color: activeTab === "image" ? "#FFFFFF" : "var(--text-muted)",
                }}
              >
                <ImageIcon size={14} />
                Image Identification
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("code"); setChallengeError(""); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  backgroundColor: activeTab === "code" ? "var(--electric-indigo)" : "#F1F5F9",
                  color: activeTab === "code" ? "#FFFFFF" : "var(--text-muted)",
                }}
              >
                <TypeIcon size={14} />
                Code CAPTCHA
              </button>
            </div>

            {/* Error Banner */}
            {challengeError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#991B1B",
                  backgroundColor: "#FEE2E2",
                  border: "1px solid #FCA5A5",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, color: "#DC2626" }} />
                <span>{challengeError}</span>
              </div>
            )}

            {/* TAB 1: Image Identification Challenge */}
            {activeTab === "image" && targetCategory && (
              <div>
                {/* Instruction banner */}
                <div
                  style={{
                    backgroundColor: "var(--soft-lavender)",
                    border: "1px solid var(--soft-lavender-border)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--electric-indigo)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Task:
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--midnight-indigo)", marginTop: "2px" }}>
                      Select all images with a <span style={{ color: "var(--electric-indigo)", textDecoration: "underline" }}>{targetCategory.label}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateImageChallenge}
                    title="Get new challenge"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      borderRadius: "6px",
                      padding: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* 3x3 Tile Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                    marginBottom: "20px",
                  }}
                >
                  {gridTiles.map((tile) => {
                    const isSelected = selectedTiles.has(tile.id);
                    const IconComponent = tile.icon;
                    return (
                      <div
                        key={tile.id}
                        onClick={() => handleToggleTile(tile.id)}
                        style={{
                          height: "82px",
                          borderRadius: "8px",
                          backgroundColor: isSelected ? "#EEF2FF" : tile.bg,
                          border: isSelected ? "2.5px solid var(--electric-indigo)" : "1px solid #E2E8F0",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          position: "relative",
                          transition: "all 0.15s ease",
                          transform: isSelected ? "scale(0.97)" : "scale(1)",
                          boxShadow: isSelected ? "0 0 0 2px rgba(99, 91, 219, 0.2)" : "none",
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: "absolute",
                              top: "6px",
                              right: "6px",
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              backgroundColor: "var(--electric-indigo)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={13} style={{ color: "#FFFFFF", strokeWidth: 3 }} />
                          </div>
                        )}
                        <IconComponent size={28} style={{ color: isSelected ? "var(--electric-indigo)" : tile.color }} />
                        <span style={{ fontSize: "11px", fontWeight: "600", color: isSelected ? "var(--electric-indigo)" : "#64748B", marginTop: "4px" }}>
                          {tile.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: "10px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyImageChallenge}
                    disabled={isVerifying}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: "10px", fontSize: "14px" }}
                  >
                    {isVerifying ? "Checking..." : `Verify (${selectedTiles.size} selected)`}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Text Code CAPTCHA Challenge */}
            {activeTab === "code" && (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
                  Type the 4 characters shown in the distorted security box below:
                </p>

                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    border: "2px solid #CBD5E1",
                    borderRadius: "8px",
                    overflow: "hidden",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <canvas ref={canvasRef} width={200} height={50} style={{ display: "block" }} />
                  <button
                    type="button"
                    onClick={generateCodeChallenge}
                    title="Get new code"
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
                    <RotateCcw size={15} />
                  </button>
                </div>

                <form onSubmit={handleVerifyCodeChallenge} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
                      fontSize: "22px",
                      letterSpacing: "6px",
                      fontWeight: "800",
                      fontFamily: "var(--font-mono)",
                    }}
                  />

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: "10px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: "10px" }}
                    >
                      {isVerifying ? "Verifying..." : "Verify Code"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
