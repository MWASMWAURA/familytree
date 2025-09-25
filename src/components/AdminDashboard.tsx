import React, { useState, useEffect } from "react";
import "./AdminDashboard.css";

interface AdminDashboardProps {
  currentFamily: string;
  currentFamilyId: string | null;
  accessCode: string;
  userId: string;
  onRegenerateCode: () => void;
  onAddAdmin: (newAdminEmail: string) => void;
  theme: string;
  compact?: boolean;
  showQuickAction?: boolean;
  isModal?: boolean;
  onCloseDrawer?: () => void;
}

interface GeneratedToken {
  token: string;
  expiresAt: string;
}

interface ActivityLog {
  id: number;
  user_id: string;
  action: string;
  details: any;
  created_at: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentFamily,
  currentFamilyId,
  accessCode,
  userId,
  onRegenerateCode,
  onAddAdmin,
  theme,
  compact,
  showQuickAction,
  isModal = true,
  onCloseDrawer,
}) => {
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 320, height: 300 }); // increased height for logs
  const [position, setPosition] = useState({
    top: Math.max(0, window.innerHeight / 2 - 150), // center vertically for 300px height
    left: Math.max(0, window.innerWidth - 350), // right side, 30px margin
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<GeneratedToken | null>(
    null
  );
  const [generatingToken, setGeneratingToken] = useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const minWidth = 320;
  const minHeight = 200;
  const collapsedWidth = 120;

  // Load position from localStorage on mount - only for modal
  React.useEffect(() => {
    if (isModal) {
      const saved = localStorage.getItem("adminDashboardPosition");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed.top === "number" &&
            typeof parsed.left === "number"
          ) {
            setPosition(parsed);
          }
        } catch {}
      }
    }
  }, [isModal]);

  // Save position to localStorage on drag end - only for modal
  React.useEffect(() => {
    if (isModal && !isDragging) {
      localStorage.setItem("adminDashboardPosition", JSON.stringify(position));
    }
  }, [isModal, isDragging, position]);

  // Handle resizing
  const handleResize = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;
    const onMouseMove = (moveEvent: MouseEvent) => {
      setDimensions({
        width: Math.max(minWidth, startWidth + moveEvent.clientX - startX),
        height: Math.max(minHeight, startHeight + moveEvent.clientY - startY),
      });
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = modalRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newTop = e.clientY - dragOffset.y;
    const newLeft = e.clientX - dragOffset.x;
    requestAnimationFrame(() => {
      setPosition({
        top: Math.max(0, Math.min(window.innerHeight - 100, newTop)),
        left: Math.max(
          0,
          Math.min(window.innerWidth - dimensions.width, newLeft)
        ),
      });
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isModal && isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isModal, isDragging, dragOffset]);

  React.useEffect(() => {
    if (!isModal) return;

    if (!collapsed) {
      const rightEdge = position.left + dimensions.width;
      if (rightEdge > window.innerWidth - 10) {
        setPosition((pos) => ({
          ...pos,
          left: Math.max(0, window.innerWidth - dimensions.width - 10),
        }));
      }
    } else {
      setPosition((pos) => ({
        ...pos,
        left: Math.max(0, window.innerWidth - collapsedWidth - 30),
      }));
    }
  }, [isModal, collapsed, dimensions.width, position.left]);

  React.useEffect(() => {
    if (!isModal) return;

    const handleResize = () => {
      setDimensions((d) => {
        const maxW = Math.min(d.width, window.innerWidth - 20);
        const maxH = Math.min(d.height, window.innerHeight - 20);
        return {
          width: Math.max(minWidth, maxW),
          height: Math.max(minHeight, maxH),
        };
      });
      setPosition((pos) => {
        let left = pos.left;
        let top = pos.top;
        if (left + dimensions.width > window.innerWidth) {
          left = Math.max(0, window.innerWidth - dimensions.width - 10);
        }
        if (top + dimensions.height > window.innerHeight) {
          top = Math.max(0, window.innerHeight - dimensions.height - 10);
        }
        return { left, top };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isModal, dimensions.width, dimensions.height, minWidth, minHeight]);

  const memberAccessLink = `${
    window.location.origin
  }?family=${encodeURIComponent(currentFamily)}&code=${accessCode}`;
  const adminAccessLink = `${
    window.location.origin
  }?family=${encodeURIComponent(currentFamily)}&code=${accessCode}&admin=true`;

  const handleAddAdmin = () => {
    if (newAdminEmail.trim()) {
      onAddAdmin(newAdminEmail.trim());
      setNewAdminEmail("");
      setShowAdminForm(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const fetchActivityLogs = async () => {
    if (!currentFamilyId || !userId) {
      setErrorLogs("No family selected or user not authenticated.");
      return;
    }
    setLoadingLogs(true);
    setErrorLogs(null);
    try {
      const response = await fetch(`/api/family-tree/${currentFamilyId}/logs`, {
        headers: {
          "X-User-ID": userId,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      const logs = await response.json();
      setActivityLogs(logs);
    } catch (error) {
      setErrorLogs(error.message || "Error fetching logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleUndo = async (logId: number) => {
    if (!currentFamilyId || !userId) return;
    try {
      const response = await fetch(
        `/api/family-tree/${currentFamilyId}/undo/${logId}`,
        {
          method: "POST",
          headers: {
            "X-User-ID": userId,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to undo action");
      }
      alert("Action undone successfully!");
      fetchActivityLogs(); // Refresh logs
    } catch (error) {
      alert(`Error undoing action: ${error.message}`);
    }
  };

  const handleEdit = (log: ActivityLog) => {
    // For now, just refresh the logs or show a message
    alert(
      "Edit functionality: This would allow editing the family tree to revert changes manually."
    );
    // Could implement opening the tree editor or something
  };

  const handleGenerateToken = async () => {
    if (!currentFamilyId || !userId) return;
    setGeneratingToken(true);
    try {
      const response = await fetch(
        `/api/family-tree/${currentFamilyId}/generate-token`,
        {
          method: "POST",
          headers: {
            "X-User-ID": userId,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to generate token");
      }
      const data = await response.json();
      setGeneratedToken(data);
      fetchActivityLogs(); // Refresh logs to show the token generation
    } catch (error: any) {
      alert(`Error generating token: ${error.message}`);
    } finally {
      setGeneratingToken(false);
    }
  };

  React.useEffect(() => {
    if (!collapsed) {
      fetchActivityLogs();
    }
  }, [collapsed, currentFamilyId]);

  const compactStyles = compact
    ? {
        fontSize: "13px",
        padding: "4px 8px",
        lineHeight: 1.2,
      }
    : {};
  const compactInputStyles = compact
    ? {
        fontSize: "12px",
        padding: "2px 6px",
        margin: "2px 0",
        height: 24,
        width: "100%",
        boxSizing: "border-box" as const,
      }
    : {};
  const compactButtonStyles = compact
    ? {
        fontSize: "12px",
        padding: "2px 8px",
        margin: "2px 2px 2px 0",
        height: 26,
      }
    : {};

  return (
    <div
      ref={modalRef}
      className={isModal ? "admin-dashboard-modal" : "admin-dashboard-panel"}
      style={
        isModal
          ? {
              position: "fixed",
              top: Math.max(
                0,
                Math.min(
                  window.innerHeight - (collapsed ? 36 : dimensions.height),
                  position.top
                )
              ),
              left: position.left,
              zIndex: 1000,
              ...compactStyles,
              width: collapsed
                ? collapsedWidth
                : Math.min(dimensions.width, window.innerWidth - 20),
              height: collapsed
                ? 36
                : Math.min(dimensions.height, window.innerHeight - 20),
              minWidth: 60,
              minHeight: 32,
              maxWidth: "98vw",
              maxHeight: "90vh",
              resize: "none",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              background: theme === "dark" ? "#232323" : "#fff",
              border: "1px solid #aaa",
              overflow: "hidden",
              transition:
                "width 0.2s, height 0.3s cubic-bezier(.4,2,.6,1), box-shadow 0.2s, left 0.2s, top 0.2s",
              userSelect: isDragging ? "none" : "auto",
            }
          : {
              width: "100%",
              height: "auto",
              background:
                theme === "dark"
                  ? "rgba(44, 62, 80, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
              borderRadius: 12,
              padding: compact ? "10px" : "20px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              backdropFilter: "blur(10px)",
              border:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.1)"
                  : "1px solid rgba(255, 255, 255, 0.2)",
              overflow: "auto",
              ...compactStyles,
            }
      }
    >
      {/* Header - only for modal mode */}
      {isModal && (
        <div
          className="admin-dashboard-modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: isDragging ? "grabbing" : "move",
            borderBottom: collapsed ? "none" : "1px solid #ccc",
            padding: collapsed ? "0 8px" : compact ? "8px 12px" : "16px 20px",
            fontWeight: 600,
            fontSize: collapsed ? "13px" : compact ? "15px" : "18px",
            background: theme === "dark" ? "#333" : "#f5f5f5",
            borderRadius: collapsed ? 5 : "5px 5px 0 0",
            boxShadow: collapsed ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
            transition: "background 0.2s, padding 0.2s, font-size 0.2s",
            userSelect: "none",
          }}
          onMouseDown={handleMouseDown}
        >
          <span
            style={{
              fontSize: collapsed ? 13 : 15,
              marginLeft: 2,
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {collapsed ? "Admin" : `🔐Admin Dashboard - ${currentFamily}`}
          </span>
          <span
            style={{
              fontSize: 14,
              marginLeft: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▼" : "▲"}
          </span>
        </div>
      )}

      {/* Title for inline mode */}
      {!isModal && (
        <h3
          style={{
            margin: "0 0 20px 0",
            color: theme === "dark" ? "#ecf0f1" : "#2c3e50",
            fontSize: "1.4em",
            textAlign: "center",
            borderBottom: "2px solid #3498db",
            paddingBottom: "10px",
          }}
        >
          🔐 Admin Dashboard - {currentFamily}
        </h3>
      )}
      {/* Resizer handle (bottom right corner) - only for modal */}
      {isModal && !collapsed && (
        <div
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 18,
            height: 18,
            cursor: "nwse-resize",
            padding: "2px",
            overflow: "auto",
            color: theme === "dark" ? "#f3f4f6" : "#374151",
            background: "transparent",
          }}
          onMouseDown={handleResize}
          title="Resize"
        >
          <svg width="18" height="18">
            <polyline
              points="4,18 18,4"
              style={{ stroke: "#888", strokeWidth: 2 }}
            />
          </svg>
        </div>
      )}
      {/* Content */}
      <div
        style={
          isModal
            ? {
                maxHeight: collapsed ? 0 : dimensions.height - 44,
                opacity: collapsed ? 0 : 1,
                overflow: "auto",
                transition:
                  "max-height 0.3s cubic-bezier(.4,2,.6,1), opacity 0.2s",
                padding: collapsed ? 0 : 4,
                pointerEvents: collapsed ? "none" : "auto",
                minWidth: 0,
                wordBreak: "break-all",
              }
            : {
                overflow: "auto",
                padding: compact ? "0" : "4px",
                minWidth: 0,
                wordBreak: "break-all",
              }
        }
      >
        {/* Access Code prominently */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: theme === "dark" ? "#ffb300" : "#d84315",
            marginBottom: 10,
            textAlign: "center",
            letterSpacing: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {accessCode}
          <button
            className="copy-btn"
            style={{ fontSize: 16, padding: "4px 8px" }}
            onClick={() => {
              copyToClipboard(accessCode, "Access code");
              onCloseDrawer?.();
            }}
            title="Copy access code"
          >
            📋
          </button>
        </div>
        <div className="admin-section" style={{ marginBottom: 10 }}>
          <h4 style={{ margin: "6px 0 2px 0", fontSize: 15, fontWeight: 600 }}>
            Shareable Links
          </h4>
          <div className="link-section">
            <div className="link-item">
              <label style={{ fontWeight: 500 }}>Member Access Link:</label>
              <div
                className="link-display"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="text"
                  value={memberAccessLink}
                  readOnly
                  className="link-input"
                  style={{
                    ...compactInputStyles,
                    minWidth: 0,
                    width: "100%",
                    overflowX: "auto",
                    fontSize: 12,
                  }}
                />
                <button
                  className="copy-btn"
                  style={{ fontSize: 14, padding: "2px 6px" }}
                  onClick={() => {
                    copyToClipboard(memberAccessLink, "Member access link");
                    onCloseDrawer?.();
                  }}
                  title="Copy member link"
                >
                  📋
                </button>
              </div>
            </div>
            <div className="link-item">
              <label style={{ fontWeight: 500 }}>Admin Access Link:</label>
              <div
                className="link-display"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="text"
                  value={adminAccessLink}
                  readOnly
                  className="link-input"
                  style={{
                    ...compactInputStyles,
                    minWidth: 0,
                    width: "100%",
                    overflowX: "auto",
                    fontSize: 12,
                  }}
                />
                <button
                  className="copy-btn"
                  style={{ fontSize: 14, padding: "2px 6px" }}
                  onClick={() => {
                    copyToClipboard(adminAccessLink, "Admin access link");
                    onCloseDrawer?.();
                  }}
                  title="Copy admin link"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="admin-section" style={{ marginBottom: 10 }}>
          <h4 style={{ margin: "6px 0 2px 0", fontSize: 15, fontWeight: 600 }}>
            Admin Management
          </h4>
          {!showAdminForm ? (
            <button
              className="add-admin-btn"
              onClick={() => setShowAdminForm(true)}
              style={{
                ...compactButtonStyles,
                fontSize: 13,
                padding: "2px 10px",
              }}
            >
              ➕ Add Admin
            </button>
          ) : (
            <div
              className="add-admin-form"
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Enter email address to add as admin"
                className="admin-email-input"
                style={{ ...compactInputStyles, fontSize: 12 }}
                autoFocus
              />
              <div
                className="admin-form-buttons"
                style={{ display: "flex", gap: 4 }}
              >
                <button
                  onClick={handleAddAdmin}
                  className="confirm-btn"
                  style={{
                    ...compactButtonStyles,
                    fontSize: 13,
                    padding: "2px 10px",
                  }}
                >
                  Add Admin
                </button>
                <button
                  onClick={() => {
                    setShowAdminForm(false);
                    setNewAdminEmail("");
                  }}
                  className="cancel-btn-admin"
                  style={{
                    ...compactButtonStyles,
                    fontSize: 11,
                    padding: "2px 8px",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Token Generator Section */}
        <div className="admin-section" style={{ marginBottom: 10 }}>
          <h4 style={{ margin: "6px 0 2px 0", fontSize: 15, fontWeight: 600 }}>
            Temporary Access Token
          </h4>
          <div style={{ marginBottom: 8 }}>
            <button
              className="generate-token-btn"
              onClick={() => {
                handleGenerateToken();
                onCloseDrawer?.();
              }}
              disabled={generatingToken}
              style={{
                ...compactButtonStyles,
                fontSize: 13,
                padding: "2px 10px",
                background: generatingToken ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: generatingToken ? "not-allowed" : "pointer",
              }}
            >
              {generatingToken ? "Generating..." : "🔑 Generate Token"}
            </button>
          </div>
          {generatedToken && (
            <div
              className="generated-token"
              style={{
                backgroundColor: theme === "dark" ? "#333" : "#f9f9f9",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #ddd",
                marginTop: 8,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Generated Token:
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 14,
                    wordBreak: "break-all",
                    backgroundColor: theme === "dark" ? "#444" : "#fff",
                    padding: 4,
                    borderRadius: 2,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {generatedToken.token}
                </div>
                <button
                  className="copy-btn"
                  style={{ fontSize: 14, padding: "2px 6px" }}
                  onClick={() => {
                    copyToClipboard(generatedToken.token, "Access token");
                    onCloseDrawer?.();
                  }}
                  title="Copy token"
                >
                  📋
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Expires: {new Date(generatedToken.expiresAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Share this token with someone for temporary access (24 hours)
              </div>
            </div>
          )}
        </div>
        {/* New Activity Logs Section */}
        <div className="admin-section" style={{ marginBottom: 10 }}>
          <h4 style={{ margin: "6px 0 2px 0", fontSize: 15, fontWeight: 600 }}>
            Activity Logs
          </h4>
          {loadingLogs ? (
            <div>Loading logs...</div>
          ) : errorLogs ? (
            <div style={{ color: "red" }}>{errorLogs}</div>
          ) : activityLogs.length === 0 ? (
            <div>No activity logs found.</div>
          ) : (
            <ul
              style={{
                maxHeight: 150,
                overflowY: "auto",
                paddingLeft: 16,
                fontSize: 12,
                lineHeight: 1.3,
                color: theme === "dark" ? "#ddd" : "#333",
              }}
            >
              {activityLogs.map((log) => (
                <li key={log.id} style={{ marginBottom: 6 }}>
                  <strong>{new Date(log.created_at).toLocaleString()}</strong>:{" "}
                  <em>{log.action}</em> by user <code>{log.user_id}</code>
                  <br />
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      marginTop: 2,
                      fontSize: 11,
                      backgroundColor: theme === "dark" ? "#444" : "#eee",
                      padding: 4,
                      borderRadius: 4,
                    }}
                  >
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                  <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                    <button
                      onClick={() => {
                        handleUndo(log.id);
                        onCloseDrawer?.();
                      }}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                    >
                      Undo
                    </button>
                    <button
                      onClick={() => {
                        handleEdit(log);
                        onCloseDrawer?.();
                      }}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: "#2196f3",
                        color: "white",
                        border: "none",
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
