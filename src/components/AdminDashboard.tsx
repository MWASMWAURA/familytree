import React, { useState } from "react";
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
  const [dimensions, setDimensions] = useState({ width: 340, height: 170 }); // smaller default height
  const [position, setPosition] = useState({
    top: 40,
    left: Math.max(0, window.innerWidth / 2 - 170), // Center horizontally, 170 is half of 340px width
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = React.useRef<HTMLDivElement>(null);
  const minWidth = 260;
  const minHeight = 100;

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
    if (e.target !== e.currentTarget) return; // Only drag on header, not on buttons
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
    // Use requestAnimationFrame for smoother dragging
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

  // Add global mouse event listeners when dragging
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

  // Remove Panel and use a top-level absolutely positioned div
  return (
    <div
      ref={modalRef}
      className="admin-dashboard-modal"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1002,
        ...compactStyles,
        width: dimensions.width,
        height: collapsed ? 44 : dimensions.height, // Fixed height when collapsed
        minWidth,
        minHeight,
        maxWidth: "98vw",
        maxHeight: "90vh",
        resize: "none",
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        background: theme === "dark" ? "#232323" : "#fff",
        border: "1px solid #aaa",
        overflow: "hidden",
        transition: collapsed
          ? "height 0.3s cubic-bezier(.4,2,.6,1), box-shadow 0.2s"
          : "box-shadow 0.2s",
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
          cursor: "move",
          borderBottom: collapsed ? "none" : "1px solid #ccc",
          padding: collapsed ? 0 : compact ? "10px 16px" : "16px 20px",
          fontWeight: 700,
          fontSize: compact ? "15px" : "18px",
          background: theme === "dark" ? "#333" : "#f5f5f5",
          borderRadius: collapsed ? 10 : "10px 10px 0 0",
          boxShadow: collapsed ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
          transition: "background 0.2s, padding 0.2s",
          userSelect: "none",
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          if (!isDragging) setCollapsed((c) => !c);
        }}
      >
        <span>🔐 Admin Dashboard - {currentFamily}</span>
        <span style={{ fontSize: 20, marginLeft: 8 }}>
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
            zIndex: 10,
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
          maxHeight: collapsed ? 0 : dimensions.height - 44, // less space for header
          opacity: collapsed ? 0 : 1,
          overflow: "auto",
          transition: "max-height 0.3s cubic-bezier(.4,2,.6,1), opacity 0.2s",
          padding: collapsed ? 0 : 8, // always compact padding
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
      </div>
    </div>
  );
};

export default AdminDashboard;
