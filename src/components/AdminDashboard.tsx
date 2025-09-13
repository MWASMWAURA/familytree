import React, { useState, useEffect } from "react";
import "./AdminDashboard.css";

interface AdminDashboardProps {
  currentFamily: string;
  currentFamilyId: string | null;
  accessCode: string;
  userId: string;
  onRegenerateCode: () => void;
  onAddAdmin: (newAdminId: string) => void;
  theme: string;
  compact?: boolean;
  showQuickAction?: boolean;
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
}) => {
  const [newAdminId, setNewAdminId] = useState("");
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
  const modalRef = React.useRef<HTMLDivElement>(null);
  const minWidth = 320;
  const minHeight = 200;
  const collapsedWidth = 120;

  // Load position from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("adminDashboardPosition");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.top === "number" && typeof parsed.left === "number") {
          setPosition(parsed);
        }
      } catch {}
    }
  }, []);

  // Save position to localStorage on drag end
  React.useEffect(() => {
    if (!isDragging) {
      localStorage.setItem("adminDashboardPosition", JSON.stringify(position));
    }
  }, [isDragging, position]);

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
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  React.useEffect(() => {
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
  }, [collapsed, dimensions.width, position.left]);

  React.useEffect(() => {
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
  }, [dimensions.width, dimensions.height, minWidth, minHeight]);

  const memberAccessLink = `${
    window.location.origin
  }?family=${encodeURIComponent(currentFamily)}&code=${accessCode}`;
  const adminAccessLink = `${
    window.location.origin
  }?family=${encodeURIComponent(currentFamily)}&code=${accessCode}&admin=true`;

  const handleAddAdmin = () => {
    if (newAdminId.trim()) {
      onAddAdmin(newAdminId.trim());
      setNewAdminId("");
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
      const response = await fetch(
        `http://localhost:3001/api/family-tree/${currentFamilyId}/logs`,
        {
          headers: {
            "X-User-ID": userId,
          },
        }
      );
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
        `http://localhost:3001/api/family-tree/${currentFamilyId}/undo/${logId}`,
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
      className="admin-dashboard-modal"
      style={{
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
      }}
    >
      {/* Collapsible header, now also the draggable handle */}
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
      {/* Resizer handle (bottom right corner) */}
      {!collapsed && (
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
      {/* Content with smooth transition */}
      <div
        style={{
          maxHeight: collapsed ? 0 : dimensions.height - 44,
          opacity: collapsed ? 0 : 1,
          overflow: "auto",
          transition: "max-height 0.3s cubic-bezier(.4,2,.6,1), opacity 0.2s",
          padding: collapsed ? 0 : 4,
          pointerEvents: collapsed ? "none" : "auto",
          minWidth: 0,
          wordBreak: "break-all",
        }}
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
          }}
        >
          {accessCode}
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
                  onClick={() =>
                    copyToClipboard(memberAccessLink, "Member access link")
                  }
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
                  onClick={() =>
                    copyToClipboard(adminAccessLink, "Admin access link")
                  }
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
                type="text"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                placeholder="Enter User ID to add as admin"
                className="admin-id-input"
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
                    setNewAdminId("");
                  }}
                  className="cancel-btn"
                  style={{
                    ...compactButtonStyles,
                    fontSize: 13,
                    padding: "2px 10px",
                  }}
                >
                  Cancel
                </button>
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
                      onClick={() => handleUndo(log.id)}
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
                      onClick={() => handleEdit(log)}
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
