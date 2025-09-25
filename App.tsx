import FamilyTreeNode from "./FamilyTreeNode";
import "./landing.css";
import AdminDashboard from "./src/components/AdminDashboard";
import React, { useState, useCallback, useRef, useEffect } from "react";

import {
  Background,
  ReactFlow,
  addEdge,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import html2canvas from "html2canvas";
import "@xyflow/react/dist/style.css";
import { initialNodes, initialEdges } from "./initialElements";
import Draggable from "react-draggable";
import { toPng } from "html-to-image";

// Add this helper function to calculate bounds manually
const getNodesBounds = (nodes) => {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const x = node.position.x;
    const y = node.position.y;
    const width = 140; // Standard node width
    const height = 80; // Standard node height

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// Add this helper function to calculate viewport transform
const getViewportForBounds = (bounds, width, height, minZoom, maxZoom) => {
  const xZoom = width / bounds.width;
  const yZoom = height / bounds.height;
  const zoom = Math.min(xZoom, yZoom);
  const clampedZoom = Math.min(Math.max(zoom, minZoom), maxZoom);

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const x = width / 2 - centerX * clampedZoom;
  const y = height / 2 - centerY * clampedZoom;

  return { x, y, zoom: clampedZoom };
};

function downloadImage(dataUrl, filename) {
  const a = document.createElement("a");
  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}

// const imageWidth = 1024;
// const imageHeight = 768;

// API base URL - adjust if server is running on different port
const API_BASE_URL = "/api";

const nodeTypes = { familyNode: FamilyTreeNode };

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
const nodeWidth = 140;
const nodeHeight = 80;

const getLayoutedElements = (nodes, edges, direction = "TB") => {
  const isHorizontal = direction === "LR";

  // Create a new graph instance to avoid conflicts
  const layoutGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(
    () => ({})
  );

  // Configure Dagre for better family tree layout
  layoutGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 250 : 180, // More space between nodes at same level for horizontal
    ranksep: isHorizontal ? 300 : 210, // More space between generations for horizontal
    marginx: 150, // Increased margin to avoid overlap
    marginy: 150, // Increased margin to avoid overlap
    align: "UL",
    acyclicer: "greedy",
  });

  // Separate spouse nodes from family hierarchy for layout
  const spouseEdges = edges.filter((edge) => edge.style?.stroke === "#e91e63");
  const hierarchyEdges = edges.filter(
    (edge) => edge.style?.stroke !== "#e91e63"
  );
  const spouseNodeIds = new Set();

  spouseEdges.forEach((edge) => {
    spouseNodeIds.add(edge.source);
    spouseNodeIds.add(edge.target);
  });

  // Determine which nodes have non-spouse edges
  const nodesWithNonSpouseEdges = new Set();
  hierarchyEdges.forEach((edge) => {
    nodesWithNonSpouseEdges.add(edge.source);
    nodesWithNonSpouseEdges.add(edge.target);
  });

  // Add nodes to dagre for hierarchy layout
  const hierarchyNodes = nodes.filter((node) => {
    // Include nodes that have non-spouse edges
    if (nodesWithNonSpouseEdges.has(node.id)) {
      return true;
    }
    // For nodes without non-spouse edges, use spouse logic
    const spouseEdge = spouseEdges.find(
      (edge) => edge.source === node.id || edge.target === node.id
    );
    if (spouseEdge) {
      // Include the source node in hierarchy, exclude the target
      return spouseEdge.source === node.id;
    }
    return true;
  });

  // Add hierarchy nodes to dagre
  hierarchyNodes.forEach((node) => {
    const hasSpouse = spouseEdges.some(
      (edge) => edge.source === node.id || edge.target === node.id
    );
    layoutGraph.setNode(node.id, {
      width: hasSpouse ? nodeWidth + 200 : nodeWidth,
      height: nodeHeight,
    });
  });

  // Add only hierarchy edges to dagre
  hierarchyEdges.forEach((edge) => {
    // Only add edge if both nodes are in hierarchy
    if (layoutGraph.hasNode(edge.source) && layoutGraph.hasNode(edge.target)) {
      layoutGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(layoutGraph);

  const newNodes = nodes.map((node) => {
    let adjustedX, adjustedY;

    // If node has non-spouse edges, use dagre position
    if (nodesWithNonSpouseEdges.has(node.id)) {
      const nodePosition = layoutGraph.node(node.id);
      if (nodePosition) {
        adjustedX = nodePosition.x - nodeWidth / 2;
        adjustedY = nodePosition.y - nodeHeight / 2;
      } else {
        // Fallback for nodes not in dagre
        adjustedX = 0;
        adjustedY = 0;
      }
    } else {
      // Check if this node is a spouse target without non-spouse edges
      const spouseEdge = spouseEdges.find(
        (edge) => edge.source === node.id || edge.target === node.id
      );

      if (spouseEdge && spouseEdge.target === node.id) {
        // This is a spouse node (target), position it next to its partner (source)
        const partnerId = spouseEdge.source;
        const partnerPosition = layoutGraph.node(partnerId);

        if (partnerPosition) {
          if (isHorizontal) {
            // Horizontal layout: place spouse below partner with more spacing
            adjustedX = partnerPosition.x - nodeWidth / 2;
            adjustedY = partnerPosition.y + nodeHeight + 40; // More space below partner for horizontal
          } else {
            // Vertical layout: place spouse to the right of partner
            adjustedX = partnerPosition.x + nodeWidth + 18; // More space to the right of partner
            adjustedY = partnerPosition.y - nodeHeight / 2;
          }
        } else {
          // Fallback position
          adjustedX = 0;
          adjustedY = 0;
        }
      } else {
        // Regular node or spouse source, use dagre position
        const nodePosition = layoutGraph.node(node.id);
        if (nodePosition) {
          adjustedX = nodePosition.x - nodeWidth / 2;
          adjustedY = nodePosition.y - nodeHeight / 2;
        } else {
          // Fallback for nodes not in dagre
          adjustedX = 0;
          adjustedY = 0;
        }
      }
    }

    return {
      ...node,
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      position: {
        x: adjustedX,
        y: adjustedY,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// Family Tree Templates
const familyTemplates = {
  "Smith Family": {
    nodes: [
      {
        id: "1",
        type: "familyNode",
        data: { name: "John Smith Sr.", details: "Patriarch" },
        position: { x: 0, y: 0 },
      },
      {
        id: "2",
        type: "familyNode",
        data: { name: "Mary Smith", details: "Matriarch" },
        position: { x: 0, y: 0 },
      },
      {
        id: "3",
        type: "familyNode",
        data: { name: "John Smith Jr.", details: "Son" },
        position: { x: 0, y: 0 },
      },
      {
        id: "4",
        type: "familyNode",
        data: { name: "Sarah Smith", details: "Daughter" },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      {
        id: "e1-3",
        source: "1",
        target: "3",
        type: "smoothstep",
        animated: true,
      },
      {
        id: "e2-3",
        source: "2",
        target: "3",
        type: "smoothstep",
        animated: true,
      },
      {
        id: "e1-4",
        source: "1",
        target: "4",
        type: "smoothstep",
        animated: true,
      },
      {
        id: "e2-4",
        source: "2",
        target: "4",
        type: "smoothstep",
        animated: true,
      },
    ],
  },
  "Johnson Family": {
    nodes: [
      {
        id: "1",
        type: "familyNode",
        data: { name: "Robert Johnson", details: "Grandfather" },
        position: { x: 0, y: 0 },
      },
      {
        id: "2",
        type: "familyNode",
        data: { name: "Michael Johnson", details: "Father" },
        position: { x: 0, y: 0 },
      },
      {
        id: "3",
        type: "familyNode",
        data: { name: "Emily Johnson", details: "Daughter" },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      {
        id: "e1-2",
        source: "1",
        target: "2",
        type: "smoothstep",
        animated: true,
      },
      {
        id: "e2-3",
        source: "2",
        target: "3",
        type: "smoothstep",
        animated: true,
      },
    ],
  },
};

const FamilySelector = ({
  onSelectFamily,
  onCreateNew,
  savedFamilies,
  onAccessWithCode,
  user,
  onLogin,
  onSignup,
  onLogout,
  onShowAuthModal,
}) => {
  const [newFamilyName, setNewFamilyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAccessForm, setShowAccessForm] = useState(false);
  const [accessFamilyName, setAccessFamilyName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleCreateNew = () => {
    if (newFamilyName.trim()) {
      onCreateNew(newFamilyName.trim());
      setNewFamilyName("");
      setShowCreateForm(false);
    }
  };

  const handleAccessWithCode = () => {
    if (accessFamilyName.trim() && accessCode.trim()) {
      onAccessWithCode(accessFamilyName.trim(), accessCode.trim());
      setAccessFamilyName("");
      setAccessCode("");
      setShowAccessForm(false);
    }
  };

  return (
    <div className="container">
      {/* Auth Panel - Top Left */}
      <div className="auth-panel">
        {user ? (
          <div className="profile-section">
            <button
              className="profile-btn"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            >
              👤 {user.email}
            </button>
            {showProfileDropdown && (
              <div className="profile-dropdown">
                <button onClick={onLogout}>Logout</button>
              </div>
            )}
          </div>
        ) : (
          <button className="auth-btn" onClick={onShowAuthModal}>
            Login / Sign Up
          </button>
        )}
      </div>

      {/*left container panel */}
      <div className="content-panel">
        <h1>Build and Share Your Family History</h1>

        <p className="subtitle">
          Create interactive family trees with collaborative editing, secure
          sharing, and professional export capabilities.
        </p>

        <ul className="feature-list">
          <li>Interactive drag-and-drop tree builder</li>
          <li>Collaborative editing with access codes</li>
          <li>Multiple layout options (vertical/horizontal)</li>
          <li>Export high-quality PNG images</li>
          <li>Cloud storage and auto-save</li>
          <li>Admin controls and user permissions</li>
          <li>Cross-device compatibility</li>
          <li>Dark and light themes</li>
        </ul>

        <div className="stats">
          <div className="stat">
            <span className="stat-number">1000+</span>
            <span className="stat-label">Families</span>
          </div>
          <div className="stat">
            <span className="stat-number">50K+</span>
            <span className="stat-label">Tree Nodes</span>
          </div>
          <div className="stat">
            <span className="stat-number">99.9%</span>
            <span className="stat-label">Uptime</span>
          </div>
        </div>
      </div>
      {/*right container panel */}
      <div className="family-selector-overlay">
        <div className="family-selector">
          <h2>Family Tree Manager</h2>
          <div className="existing-families">
            {/* <h3>Your Families</h3>
          <div style={{ fontSize: "0.95em", color: "#888", marginBottom: 8 }}>
            Only families where you are an admin are shown below. If a family
            exists but you are not an admin, it will not appear here.
          </div> */}
            {savedFamilies && savedFamilies.length > 0 ? (
              <div className="saved-families">
                <h4>Families You Admin</h4>
                {savedFamilies.map((family) => (
                  <button
                    key={family.id}
                    className="family-option saved"
                    onClick={() => onSelectFamily(family)}
                  >
                    {family.name} (Admin)
                  </button>
                ))}
              </div>
            ) : (
              <div>No saved families found.</div>
            )}
            {/* <div className="template-families">
            <h4>Family Templates</h4>
            {Object.keys(familyTemplates).map((familyName) => (
              <button
                key={familyName}
                className="family-option template"
                onClick={() => onSelectFamily(familyName)}
              >
                {familyName}
              </button>
            ))}
          </div> */}
          </div>

          <div className="access-family">
            <h3>Access Family Tree</h3>
            {!showAccessForm ? (
              <button
                className="access-btn"
                onClick={() => setShowAccessForm(true)}
              >
                🔓 Access with Code
              </button>
            ) : (
              <div className="access-form">
                <input
                  type="text"
                  value={accessFamilyName}
                  onChange={(e) => setAccessFamilyName(e.target.value)}
                  placeholder="Family name"
                  className="family-name-input"
                />
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Access code"
                  className="access-code-input"
                />
                <div className="access-buttons">
                  <button
                    onClick={handleAccessWithCode}
                    className="access-submit-btn"
                  >
                    Access
                  </button>
                  <button
                    onClick={() => setShowAccessForm(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="create-new-family">
            <h3>Create New Family</h3>
            {!showCreateForm ? (
              <button
                className="create-new-btn"
                onClick={() => setShowCreateForm(true)}
              >
                + Create New Family Tree
              </button>
            ) : (
              <div className="create-form">
                <input
                  type="text"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="Enter family name (e.g., 'Wilson Family')"
                  className="family-name-input"
                  autoFocus
                />
                <div className="create-buttons">
                  <button onClick={handleCreateNew} className="create-btn">
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthModal = ({ mode, onLogin, onSignup, onSwitchMode, onClose }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "login") {
      onLogin(email, password);
    } else {
      if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }
      onSignup(email, password);
    }
  };

  // Clear confirm password when switching modes
  React.useEffect(() => {
    if (mode === "login") {
      setConfirmPassword("");
    }
  }, [mode]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          padding: window.innerWidth <= 768 ? "16px" : "40px",
          borderRadius: "20px",
          width: window.innerWidth <= 768 ? "280px" : "400px",
          maxWidth: "90vw",
          textAlign: "center",
          boxShadow:
            "0 25px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          animation: "slideUp 0.4s ease-out",
        }}
      >
        <h2
          style={{
            marginBottom: window.innerWidth <= 768 ? "20px" : "30px",
            color: "#1e293b",
            fontSize: window.innerWidth <= 768 ? "24px" : "28px",
            fontWeight: "700",
            letterSpacing: "-0.025em",
          }}
        >
          {mode === "login" ? "Welcome Back" : "Create Your Account"}
        </h2>
        <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "14px 18px",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "16px",
                fontFamily: "inherit",
                background: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(10px)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow = "0 0 0 4px rgba(59, 130, 246, 0.1)";
                e.target.style.background = "rgba(255, 255, 255, 0.95)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.boxShadow = "none";
                e.target.style.background = "rgba(255, 255, 255, 0.8)";
                e.target.style.transform = "translateY(0)";
              }}
            />
          </div>
          <div style={{ marginBottom: "24px", position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "14px 50px 14px 18px",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "16px",
                fontFamily: "inherit",
                background: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(10px)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow = "0 0 0 4px rgba(59, 130, 246, 0.1)";
                e.target.style.background = "rgba(255, 255, 255, 0.95)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.boxShadow = "none";
                e.target.style.background = "rgba(255, 255, 255, 0.8)";
                e.target.style.transform = "translateY(0)";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#64748b",
                fontSize: "18px",
                padding: "4px",
                borderRadius: "4px",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#3b82f6")}
              onMouseLeave={(e) => (e.target.style.color = "#64748b")}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {mode === "signup" && (
            <div style={{ marginBottom: "24px" }}>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontFamily: "inherit",
                  background: "rgba(255, 255, 255, 0.8)",
                  backdropFilter: "blur(10px)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.boxShadow =
                    "0 0 0 4px rgba(59, 130, 246, 0.1)";
                  e.target.style.background = "rgba(255, 255, 255, 0.95)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "rgba(255, 255, 255, 0.8)";
                  e.target.style.transform = "translateY(0)";
                }}
              />
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "16px 24px",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
              marginBottom: "16px",
            }}
            onMouseEnter={(e) => {
              e.target.style.background =
                "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)";
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background =
                "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 14px rgba(59, 130, 246, 0.3)";
            }}
          >
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <div style={{ marginBottom: "16px", textAlign: "center" }}>
          <p
            style={{
              fontSize: "14px",
              color: "#64748b",
              margin: "0 0 12px 0",
              lineHeight: "1.4",
            }}
          >
            <strong>💾 Login to sync</strong> your family trees across all
            devices
            <br />
            <strong>📱 Continue as guest</strong> to save locally for 24 hours
          </p>
          <button
            onClick={onSwitchMode}
            style={{
              background: "none",
              border: "none",
              color: "#3b82f6",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              textDecoration: "underline",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#1d4ed8")}
            onMouseLeave={(e) => (e.target.style.color = "#3b82f6")}
          >
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.target.style.background =
              "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background =
              "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.3)";
          }}
        >
          Save Locally (24h)
        </button>
      </div>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

const EditNameModal = ({
  isOpen,
  onClose,
  currentName,
  onSave,
  value,
  onChange,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          padding: "30px",
          borderRadius: "16px",
          width: "400px",
          maxWidth: "90vw",
          textAlign: "center",
          boxShadow:
            "0 25px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          animation: "slideUp 0.4s ease-out",
        }}
      >
        <h3
          style={{
            marginBottom: "20px",
            color: "#1e293b",
            fontSize: "24px",
            fontWeight: "600",
          }}
        >
          Edit Family Name
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter new family name"
              required
              autoFocus
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "16px",
                fontFamily: "inherit",
                background: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(10px)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                e.target.style.background = "rgba(255, 255, 255, 0.95)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.boxShadow = "none";
                e.target.style.background = "rgba(255, 255, 255, 0.8)";
              }}
            />
          </div>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 24px",
                background: "#f1f5f9",
                color: "#64748b",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "#f1f5f9";
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.3)";
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

const DeleteConfirmModal = ({
  isOpen,
  onClose,
  familyName,
  confirmName,
  onConfirmNameChange,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (confirmName === familyName) {
      onConfirm();
    } else {
      alert("Name doesn't match. Please type the exact family name.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "350px",
          maxWidth: "90vw",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>🗑️</div>
          <h3
            style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600" }}
          >
            Delete Family Tree
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
            This will permanently delete "{familyName}" for all users.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                marginBottom: "4px",
                fontWeight: "500",
              }}
            >
              Type "{familyName}" to confirm:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => onConfirmNameChange(e.target.value)}
              placeholder={familyName}
              required
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "#f5f5f5",
                color: "#666",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PremiumExportChoiceModal = ({
  isOpen,
  onClose,
  onExportPhoto,
  onExportNode,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          padding: "30px",
          borderRadius: "20px",
          width: "400px",
          maxWidth: "90vw",
          textAlign: "center",
          boxShadow:
            "0 25px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          animation: "slideUp 0.4s ease-out",
        }}
      >
        <h2
          style={{
            marginBottom: "20px",
            color: "#1e293b",
            fontSize: "24px",
            fontWeight: "700",
            letterSpacing: "-0.025em",
          }}
        >
          Choose Export Type
        </h2>
        <p style={{ marginBottom: "30px", color: "#64748b", fontSize: "16px" }}>
          Select your preferred family tree export style
        </p>

        <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
          {/* Photo Family Tree */}
          <div
            style={{
              flex: 1,
              padding: "20px",
              border: "2px solid #fbbf24",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%)",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 25px rgba(251, 191, 36, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
            onClick={() => {
              onExportPhoto();
              onClose();
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "10px" }}>📸</div>
            <h3
              style={{
                margin: "0 0 10px 0",
                color: "#92400e",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              Photo Family Tree
            </h3>
            <p style={{ margin: 0, color: "#92400e", fontSize: "14px" }}>
              Premium export with photos
            </p>
          </div>

          {/* Node Family Tree */}
          <div
            style={{
              flex: 1,
              padding: "20px",
              border: "2px solid #e2e8f0",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.8)",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#3b82f6";
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "#e2e8f0";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
            onClick={() => {
              onExportNode();
              onClose();
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "10px" }}>📄</div>
            <h3
              style={{
                margin: "0 0 10px 0",
                color: "#1e293b",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              Node Family Tree
            </h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Standard export with nodes
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "#f1f5f9",
              color: "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#f1f5f9";
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

const ExportModal = ({
  isOpen,
  onClose,
  onExportFree,
  onExportPremium,
  isPremium,
  onActivatePremium,
  isActivating,
  onShowPremiumChoice,
}) => {
  const [showStkPrompt, setShowStkPrompt] = useState(false);
  const [stkStep, setStkStep] = useState(0); // 0: phone input, 1: processing, 2: success
  const [phoneNumber, setPhoneNumber] = useState("");

  if (!isOpen) return null;

  const handleFreeExport = async () => {
    await onExportFree();
    onClose(); // Auto-close modal after free export
  };

  const handlePremiumExport = async () => {
    if (!isPremium) {
      // Show STK push simulation
      setShowStkPrompt(true);
      setStkStep(0);
    } else {
      // For premium users, show choice modal instead of direct export
      onShowPremiumChoice();
      onClose();
    }
  };

  const handleStkSubmit = () => {
    if (!phoneNumber.trim()) {
      alert("Please enter your phone number");
      return;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^(\+254|0)[17]\d{8}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      alert(
        "Please enter a valid Kenyan phone number (e.g., +254712345678 or 0712345678)"
      );
      return;
    }

    setStkStep(1); // Processing payment

    // Simulate payment success after 3 seconds
    setTimeout(async () => {
      setStkStep(2); // Payment successful
      await onActivatePremium();

      // Show success message and close STK prompt
      setTimeout(() => {
        setShowStkPrompt(false);
        setPhoneNumber("");
        alert(
          "🎉 Premium activated! You can now upload photos of family members by double-clicking on nodes, then export your premium family tree."
        );
      }, 1000);
    }, 3000);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          padding: "20px",
          borderRadius: "16px",
          width: "400px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          textAlign: "center",
          boxShadow:
            "0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          animation: "slideUp 0.4s ease-out",
        }}
      >
        <h2
          style={{
            marginBottom: "20px",
            color: "#1e293b",
            fontSize: "28px",
            fontWeight: "700",
            letterSpacing: "-0.025em",
          }}
        >
          Export Family Tree
        </h2>
        <p style={{ marginBottom: "30px", color: "#64748b", fontSize: "16px" }}>
          Choose your export option
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: window.innerWidth <= 768 ? "column" : "row",
            gap: "15px",
            marginBottom: "20px",
          }}
        >
          {/* Free Export */}
          <div
            style={{
              flex: 1,
              padding: "15px",
              border: "2px solid #e2e8f0",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.8)",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#3b82f6";
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "#e2e8f0";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
            onClick={handleFreeExport}
          >
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📄</div>
            <h3
              style={{
                margin: "0 0 8px 0",
                color: "#1e293b",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              Free Export
            </h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
              Export with standard nodes and text
            </p>
            <div
              style={{
                marginTop: "12px",
                fontSize: "16px",
                fontWeight: "bold",
                color: "#10b981",
              }}
            >
              FREE
            </div>
          </div>

          {/* Premium Export */}
          <div
            style={{
              flex: 1,
              padding: "15px",
              border: "2px solid #fbbf24",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 8px 25px rgba(251, 191, 36, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
            onClick={handlePremiumExport}
            disabled={isActivating}
          >
            <div
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                background: "#f59e0b",
                color: "white",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              👑
            </div>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📸</div>
            <h3
              style={{
                margin: "0 0 8px 0",
                color: "#92400e",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              Premium Export
            </h3>
            <p style={{ margin: 0, color: "#92400e", fontSize: "13px" }}>
              Export with round photos and names
            </p>
            <div
              style={{
                marginTop: "12px",
                fontSize: "16px",
                fontWeight: "bold",
                color: "#dc2626",
              }}
            >
              KSH 20
            </div>
            {isPremium && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "#059669",
                  fontWeight: "600",
                }}
              >
                ✓ Premium Active
              </div>
            )}
            {isActivating && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "#f59e0b",
                  fontWeight: "600",
                }}
              >
                🔄 Activating Premium...
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "#f1f5f9",
              color: "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#f1f5f9";
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* STK Push Modal */}
      {showStkPrompt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              padding: "20px",
              borderRadius: "16px",
              width: "350px",
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflowY: "auto",
              textAlign: "center",
              boxShadow:
                "0 20px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.8)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              animation: "slideUp 0.4s ease-out",
            }}
          >
            <div style={{ fontSize: "60px", marginBottom: "20px" }}>📱</div>
            <h2
              style={{
                marginBottom: "20px",
                color: "#1e293b",
                fontSize: "24px",
                fontWeight: "700",
              }}
            >
              M-Pesa Payment
            </h2>

            {stkStep === 0 && (
              <div>
                <p
                  style={{
                    marginBottom: "20px",
                    color: "#64748b",
                    fontSize: "16px",
                  }}
                >
                  Enter your M-Pesa phone number to pay KSH 20
                </p>
                <div style={{ marginBottom: "20px", width: "100%" }}>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g., +254712345678 or 0712345678"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontFamily: "inherit",
                      background: "rgba(255, 255, 255, 0.9)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    autoFocus
                  />
                </div>
                <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                  <button
                    onClick={() => setShowStkPrompt(false)}
                    style={{
                      flex: 1,
                      padding: "12px 24px",
                      background: "#f1f5f9",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#e2e8f0";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "#f1f5f9";
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStkSubmit}
                    style={{
                      flex: 1,
                      padding: "12px 24px",
                      background:
                        "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "translateY(-1px)";
                      e.target.style.boxShadow =
                        "0 4px 12px rgba(5, 150, 105, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "none";
                    }}
                  >
                    Pay KSH 20
                  </button>
                </div>
              </div>
            )}

            {stkStep === 1 && (
              <div>
                <p
                  style={{
                    marginBottom: "20px",
                    color: "#64748b",
                    fontSize: "16px",
                  }}
                >
                  Check your phone and enter your M-Pesa PIN
                </p>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>📲</div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#059669",
                    fontWeight: "600",
                  }}
                >
                  Processing payment of KSH 20...
                </div>
              </div>
            )}

            {stkStep === 2 && (
              <div>
                <p
                  style={{
                    marginBottom: "20px",
                    color: "#059669",
                    fontSize: "16px",
                    fontWeight: "600",
                  }}
                >
                  ✅ Payment successful!
                </p>
                <div style={{ fontSize: "40px" }}>🎉</div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

const Flow = ({
  user,
  token,
  showAuthModal,
  setShowAuthModal,
  authMode,
  setAuthMode,
  onLogin,
  onSignup,
  onLogout,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [theme, setTheme] = useState<string>("light");
  const [nextNodeId, setNextNodeId] = useState<number>(10);
  const [currentFamily, setCurrentFamily] = useState<string | null>(null);
  const [shareableLink, setShareableLink] = useState<string>("");
  const [savedFamilies, setSavedFamilies] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [accessCode, setAccessCode] = useState<string>("");
  const [showAccessCodeDialog, setShowAccessCodeDialog] =
    useState<boolean>(false);
  const [accessCodeInput, setAccessCodeInput] = useState<string>("");
  const [showAdminDashboard, setShowAdminDashboard] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] =
    useState<boolean>(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [showMessagesPanel, setShowMessagesPanel] = useState<boolean>(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);
  const [showEditNameModal, setShowEditNameModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
    useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showPremiumChoiceModal, setShowPremiumChoiceModal] =
    useState<boolean>(false);
  const [editNameValue, setEditNameValue] = useState<string>("");
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isActivatingPremium, setIsActivatingPremium] =
    useState<boolean>(false);

  // Mobile drawer states
  const [showLeftDrawer, setShowLeftDrawer] = useState<boolean>(false);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(false);
  const [showBottomDrawer, setShowBottomDrawer] = useState<boolean>(false);
  const [showAdminDrawer, setShowAdminDrawer] = useState<boolean>(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Initialize user ID and load data on component mount
  useEffect(() => {
    const initializeUserId = () => {
      const isValidUuid = (v: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          v
        );

      let storedUserId = localStorage.getItem("userId");

      if (!storedUserId || !isValidUuid(storedUserId)) {
        // Generate a proper UUID so it matches the server's UUID schema
        storedUserId = (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Date.now()}-0000-4000-8000-000000000000`; // fallback simple pattern
        localStorage.setItem("userId", storedUserId);
      }
      setUserId(storedUserId);
    };

    initializeUserId();
  }, []);

  // Load saved families when userId is available
  useEffect(() => {
    if (userId) {
      loadSavedFamilies();
    }
  }, [userId]);

  // Load messages for logged-in users
  const loadMessages = async () => {
    if (!user || !token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // Load messages when user logs in
  useEffect(() => {
    if (user && token) {
      loadMessages();
    }
  }, [user, token]);

  // Update unread count when messages change
  useEffect(() => {
    const unreadCount = messages.filter((msg) => !msg.is_read).length;
    setUnreadMessageCount(unreadCount);
  }, [messages]);

  // Function to mark messages as read
  const markMessagesAsRead = async (messageIds: number[]) => {
    if (!user || !token || messageIds.length === 0) return;

    try {
      const response = await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageIds }),
      });

      if (response.ok) {
        // Update local state
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg
          )
        );
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Real-time sync for shared family trees
  const checkForUpdates = async () => {
    if (!user || !token || !currentFamilyId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/family-tree/${currentFamilyId}`,
        {
          headers: {
            "X-User-ID": userId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const freshFamilyData = await response.json();

        // Check if data has changed
        const currentData = { nodes, edges };
        const serverData = freshFamilyData.data;

        const dataChanged =
          JSON.stringify(currentData) !== JSON.stringify(serverData);

        if (dataChanged) {
          // Update local data with server data
          setNodes(addCallbacksToNodes(serverData.nodes));
          setEdges(serverData.edges);

          // Show notification
          alert(
            "Family tree has been updated by another member and synced automatically!"
          );
        }
      }
    } catch (error) {
      console.warn("Could not check for updates:", error);
    }
  };

  // Check for updates every 30 seconds when viewing a shared family tree
  useEffect(() => {
    if (user && currentFamilyId && !isAdmin) {
      const interval = setInterval(checkForUpdates, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, currentFamilyId, isAdmin, nodes, edges]);

  // Persist current family tree to localStorage whenever it changes
  useEffect(() => {
    if (currentFamily && nodes.length > 0) {
      const familyData = {
        name: currentFamily,
        nodes,
        edges,
        timestamp: Date.now(),
      };
      localStorage.setItem("currentFamilyTree", JSON.stringify(familyData));
    }
  }, [currentFamily, nodes, edges]);

  const loadSavedFamilies = async () => {
    if (!userId) return;

    try {
      const headers: any = { "X-User-ID": userId };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/family-tree`, {
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to load saved families");
      }

      let families = await response.json();

      // Filter out hidden families for logged-in users
      if (user && token) {
        try {
          const hiddenResponse = await fetch(
            `${API_BASE_URL}/family-tree/hidden`,
            {
              headers,
            }
          );
          if (hiddenResponse.ok) {
            const hiddenFamilies = await hiddenResponse.json();
            const hiddenIds = new Set(
              hiddenFamilies.map((h: any) => h.family_id)
            );
            families = families.filter(
              (family: any) => !hiddenIds.has(family.id)
            );
          }
        } catch (error) {
          console.warn("Could not load hidden families:", error);
        }
      }

      setSavedFamilies(families);
    } catch (error) {
      console.error("Error loading saved families:", error);
    }
  };
  // Fix the loadPersistedFamily function to properly sync with server data
  const loadPersistedFamily = async () => {
    try {
      // First check for temp family tree (expires in 24 hours)
      const tempData = localStorage.getItem("tempFamilyTree");
      if (tempData) {
        const tempFamilyData = JSON.parse(tempData);
        if (Date.now() < tempFamilyData.expiresAt) {
          setCurrentFamily(tempFamilyData.name);
          setNodes(addCallbacksToNodes(tempFamilyData.nodes));
          setEdges(tempFamilyData.edges);
          setShareableLink(
            `${window.location.href}?family=${encodeURIComponent(
              tempFamilyData.name
            )}`
          );
          return;
        } else {
          localStorage.removeItem("tempFamilyTree");
        }
      }

      const persistedData = localStorage.getItem("currentFamilyTree");
      if (persistedData) {
        const familyData = JSON.parse(persistedData);
        // Only load if it's recent (within last 24 hours)
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - familyData.timestamp < oneDay) {
          // check if this family exists in server and load the latest version
          try {
            const headers: any = { "X-User-ID": userId };
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetch(`${API_BASE_URL}/family-tree`, {
              headers,
            });

            if (response.ok) {
              const families = await response.json();
              const existingFamily = families.find(
                (f) => f.name === familyData.name
              );

              if (existingFamily) {
                // Load from server (most up-to-date version)
                const { nodes: layoutedNodes, edges: layoutedEdges } =
                  getLayoutedElements(
                    existingFamily.data.nodes,
                    existingFamily.data.edges
                  );
                setNodes(addCallbacksToNodes(layoutedNodes));
                setEdges(layoutedEdges);
                setCurrentFamily(existingFamily.name);
                setCurrentFamilyId(existingFamily.id);
                setIsAdmin(true);
                setShareableLink(
                  `${window.location.href}?family=${encodeURIComponent(
                    existingFamily.name
                  )}`
                );
                return;
              }
            }
          } catch (serverError) {
            console.warn(
              "Could not load from server, using local data:",
              serverError
            );
          }
          //fallback to local data if server load fails or family doesn't exist
          setCurrentFamily(familyData.name);
          setNodes(addCallbacksToNodes(familyData.nodes));
          setEdges(familyData.edges);
          setShareableLink(
            `${window.location.href}?family=${encodeURIComponent(
              familyData.name
            )}`
          );
        } else {
          // Clear old data
          localStorage.removeItem("currentFamilyTree");
        }
      }
    } catch (error) {
      console.error("Error loading persisted family:", error);
      localStorage.removeItem("currentFamilyTree");
      localStorage.removeItem("tempFamilyTree");
    }
  };
  // Load persisted family when userId is available
  useEffect(() => {
    if (userId) {
      loadPersistedFamily();
    }
  }, [userId]);

  // Check premium status when family changes
  const checkPremiumStatus = async () => {
    if (!userId || !currentFamilyId) {
      setIsPremium(false);
      return;
    }

    try {
      const headers: any = { "X-User-ID": userId };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/premium/status?familyId=${currentFamilyId}`,
        {
          headers,
        }
      );

      if (response.ok) {
        const premiumData = await response.json();
        const hasPremium = premiumData.some(
          (p: any) =>
            p.is_premium &&
            (!p.expires_at || new Date(p.expires_at) > new Date())
        );
        setIsPremium(hasPremium);
      }
    } catch (error) {
      console.error("Error checking premium status:", error);
      setIsPremium(false);
    }
  };

  // Check premium status when family changes
  useEffect(() => {
    checkPremiumStatus();
  }, [currentFamilyId, userId, token]);

  // Update nodes when premium status changes
  useEffect(() => {
    if (nodes.length > 0) {
      setNodes(addCallbacksToNodes(nodes));
    }
  }, [isPremium]);

  // Activate premium
  const activatePremium = async () => {
    if (!userId || !currentFamilyId) {
      alert("User not authenticated or no family selected");
      return;
    }

    setIsActivatingPremium(true);
    try {
      const headers: any = {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/premium/activate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          familyId: currentFamilyId,
          paymentMethod: "mpesa",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `Premium activated successfully! Payment reference: ${result.paymentReference}`
        );
        setIsPremium(true);

        // Add premium activation message to messages panel
        const premiumMessage = {
          id: `premium-${Date.now()}`,
          message:
            "🎉 Premium subscription activated! You can now upload photos of family members by double-clicking on nodes.",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [premiumMessage, ...prev]);
      } else {
        const error = await response.json();
        alert(`Failed to activate premium: ${error.error}`);
      }
    } catch (error) {
      console.error("Error activating premium:", error);
      alert("Failed to activate premium. Please try again.");
    } finally {
      setIsActivatingPremium(false);
    }
  };
  // Function to save current family tree to server
  const saveFamilyTree = async () => {
    if (!currentFamily || !userId) {
      alert("No family selected or user not authenticated.");
      return;
    }

    // Check if user is logged in
    if (!user) {
      // Show auth modal
      setShowAuthModal(true);
      return;
    }

    try {
      const headers: any = {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (currentFamilyId) {
        // Update existing family tree
        const response = await fetch(
          `${API_BASE_URL}/family-tree/${currentFamilyId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              data: { nodes, edges },
            }),
          }
        );

        if (!response.ok) {
          let errorText = await response.text();
          let errorMsg = errorText;
          try {
            const errorObj = JSON.parse(errorText);
            errorMsg = errorObj.details || errorObj.error || errorText;
          } catch {}
          alert(`Failed to update family tree. Server response: ${errorMsg}`);
          return;
        }

        // Update localStorage with the saved data
        const familyData = {
          name: currentFamily,
          nodes,
          edges,
          timestamp: Date.now(),
        };
        localStorage.setItem("currentFamilyTree", JSON.stringify(familyData));

        alert("Family tree updated successfully.");
      } else {
        // Create new family tree using current family name
        const trimmedName = currentFamily.trim();

        const response = await fetch(`${API_BASE_URL}/family-tree`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: trimmedName,
            data: { nodes, edges },
          }),
        });

        if (response.status === 409) {
          alert(
            `A family tree with the name "${trimmedName}" already exists. Please change the family name in the input field below and try saving again.`
          );
          return;
        }

        if (!response.ok) {
          let errorText = await response.text();
          let errorMsg = errorText;
          try {
            const errorObj = JSON.parse(errorText);
            errorMsg = errorObj.details || errorObj.error || errorText;
          } catch {}
          alert(`Failed to save new family tree. Server response: ${errorMsg}`);
          return;
        }

        const result = await response.json();
        alert(
          `Family tree saved successfully as '${trimmedName}'.\nAccess Code: ${result.accessCode}`
        );

        // Update current family info
        setCurrentFamily(trimmedName);
        setCurrentFamilyId(result.family.id);
        setAccessCode(result.accessCode);
        setIsAdmin(true);

        // Update localStorage with the saved data
        const familyData = {
          name: trimmedName,
          nodes,
          edges,
          timestamp: Date.now(),
        };
        localStorage.setItem("currentFamilyTree", JSON.stringify(familyData));

        // Reload saved families to update the list
        await loadSavedFamilies();
      }
    } catch (error) {
      console.error("Error saving family tree:", error);
      alert("Error saving family tree. See console for details.");
    }
  };

  // Function to save locally with expiration
  const saveLocallyWithExpiration = () => {
    const expirationTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const familyData = {
      name: currentFamily,
      nodes,
      edges,
      timestamp: Date.now(),
      expiresAt: expirationTime,
    };
    localStorage.setItem("tempFamilyTree", JSON.stringify(familyData));
    alert(
      "Family tree saved locally for 24 hours. Sign up to save permanently across devices."
    );
  };

  // Function to handle soft delete (hide from user's view)
  const handleSoftDelete = async () => {
    try {
      const headers: any = {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/family-tree/${currentFamilyId}/hide`,
        {
          method: "POST",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to hide family tree");
      }

      alert("Family tree removed from your view");

      // Return to family menu
      setCurrentFamily(null);
      setCurrentFamilyId(null);
      setNodes([]);
      setEdges([]);
      setIsAdmin(false);

      // Reload families list
      loadSavedFamilies();
    } catch (error) {
      console.error("Error hiding family tree:", error);
      alert("Failed to hide family tree");
    }
  };

  // Function to handle hard delete (admin only)
  const handleHardDelete = async () => {
    try {
      const headers: any = {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/family-tree/${currentFamilyId}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!response.ok) {
        let errorMsg = "Failed to delete family tree";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      alert("Family tree deleted successfully");

      // Return to family menu
      setCurrentFamily(null);
      setCurrentFamilyId(null);
      setNodes([]);
      setEdges([]);
      setIsAdmin(false);

      // Reload families list
      loadSavedFamilies();
    } catch (error) {
      console.error("Error deleting family tree:", error);

      // Don't show error alert since deletion may still succeed
      // Just return to family menu
      setCurrentFamily(null);
      setCurrentFamilyId(null);
      setNodes([]);
      setEdges([]);
      setIsAdmin(false);
      loadSavedFamilies();
    }
  };

  // Function to handle family name edit
  const handleEditFamilyName = async () => {
    if (!editNameValue.trim()) {
      alert("Family name cannot be empty");
      return;
    }

    if (editNameValue.trim() === currentFamily) {
      setShowEditNameModal(false);
      return;
    }

    try {
      const headers: any = {
        "Content-Type": "application/json",
        "X-User-ID": userId,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/family-tree/${currentFamilyId}/name`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ name: editNameValue.trim() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update family name");
      }

      // Update local state
      setCurrentFamily(editNameValue.trim());
      setShareableLink(
        `${window.location.href}?family=${encodeURIComponent(
          editNameValue.trim()
        )}`
      );

      setShowEditNameModal(false);
      alert("Family name updated successfully!");
    } catch (error) {
      console.error("Error updating family name:", error);
      alert("Failed to update family name: " + error.message);
    }
  };
  // Helper function to ensure all nodes have the required callbacks
  const addCallbacksToNodes = (nodeList) => {
    return nodeList.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onAddParent: handleAddParent,
        onAddChild: handleAddChild,
        onAddSpouse: handleAddSpouse,
        onUpdateNode: handleUpdateNode,
        isPremium,
        familyId: currentFamilyId,
        userId,
        token,
      },
    }));
  };

  function handleUpdateNode(nodeId, newData) {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                name: newData.name,
                details: newData.details,
                spouseLink: newData.spouseLink,
              },
            }
          : node
      )
    );
  }

  function handleAddParent(nodeId) {
    setNextNodeId((prev) => {
      const newParentId = `parent-${prev}`;

      // Find child node to position parent at it initially for immediate edge connection
      const childNode = nodes.find((node) => node.id === nodeId);
      const parentPosition = childNode ? childNode.position : { x: 0, y: 0 };

      const newParentNode = {
        id: newParentId,
        type: "familyNode",
        data: {
          name: "New Parent",
          details: "Double-click to edit",
        },
        position: parentPosition,
      };

      const newEdge = {
        id: `e-${newParentId}-${nodeId}`,
        source: newParentId,
        target: nodeId,
        type: "smoothstep",
        animated: true,
        style: { strokeWidth: 2 },
      };

      // Update both nodes and edges together to avoid state conflicts
      setEdges((currentEdges) => {
        const updatedEdges = [...currentEdges, newEdge];

        setNodes((currentNodes) => {
          const updatedNodes = [...currentNodes, newParentNode];
          const { nodes: layoutedNodes } = getLayoutedElements(
            updatedNodes,
            updatedEdges
          );

          return addCallbacksToNodes(layoutedNodes);
        });

        return updatedEdges;
      });

      return prev + 1;
    });
  }

  function handleAddChild(nodeId) {
    setNextNodeId((prev) => {
      const newChildId = `child-${prev}`;

      // Find parent node to position child at it initially for immediate edge connection
      const parentNode = nodes.find((node) => node.id === nodeId);
      const childPosition = parentNode ? parentNode.position : { x: 0, y: 0 };

      const newChildNode = {
        id: newChildId,
        type: "familyNode",
        data: {
          name: "New Child",
          details: "Double-click to edit",
        },
        position: childPosition,
      };

      const newEdge = {
        id: `e-${nodeId}-${newChildId}`,
        source: nodeId,
        target: newChildId,
        type: "smoothstep",
        animated: true,
        style: { strokeWidth: 2 },
      };

      // Update both nodes and edges together to avoid state conflicts
      setEdges((currentEdges) => {
        const updatedEdges = [...currentEdges, newEdge];

        setNodes((currentNodes) => {
          const updatedNodes = [...currentNodes, newChildNode];
          const { nodes: layoutedNodes } = getLayoutedElements(
            updatedNodes,
            updatedEdges
          );
          return addCallbacksToNodes(layoutedNodes);
        });

        return updatedEdges;
      });

      return prev + 1;
    });
  }

  function handleAddSpouse(nodeId) {
    setNextNodeId((prev) => {
      const newSpouseId = `spouse-${prev}`;

      // Find partner node to position spouse at it initially for immediate edge connection
      const partnerNode = nodes.find((node) => node.id === nodeId);
      const spousePosition = partnerNode
        ? partnerNode.position
        : { x: 0, y: 0 };

      const newSpouseNode = {
        id: newSpouseId,
        type: "familyNode",
        data: {
          name: "Spouse",
          details: "Double-click to edit",
        },
        position: spousePosition,
      };

      const newEdge = {
        id: `e-${nodeId}-${newSpouseId}`,
        source: nodeId,
        target: newSpouseId,
        type: "straight",
        animated: false,
        style: {
          strokeWidth: 3,
          stroke: "#e91e63",
          strokeDasharray: "5,5",
        },
        label: "♥",
      };

      // Update both nodes and edges together to avoid state conflicts
      setEdges((currentEdges) => {
        const updatedEdges = [...currentEdges, newEdge];

        setNodes((currentNodes) => {
          const updatedNodes = [...currentNodes, newSpouseNode];
          const { nodes: layoutedNodes } = getLayoutedElements(
            updatedNodes,
            updatedEdges
          );
          return addCallbacksToNodes(layoutedNodes);
        });

        return updatedEdges;
      });

      return prev + 1;
    });
  }

  const handleSelectFamily = async (family) => {
    if (typeof family === "object" && family.data) {
      // Loading a saved family from server -  ALWAYS fetch fresh data
      try {
        // fetch the latest data from the database
        const response = await fetch(
          `${API_BASE_URL}/family-tree/${family.id}`,
          {
            headers: {
              "X-User-ID": userId,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load latest family tree from server");
        }
        const freshFamilyData = await response.json();
        // use the fresh data from database
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(
            freshFamilyData.data.nodes,
            freshFamilyData.data.edges
          );

        setNodes(addCallbacksToNodes(layoutedNodes));
        setEdges(layoutedEdges);
        setCurrentFamily(freshFamilyData.name);
        setCurrentFamilyId(freshFamilyData.id);
        setIsAdmin(true); // If loaded from saved, user is admin
        setShareableLink(
          `${window.location.href}?family=${encodeURIComponent(
            freshFamilyData.name
          )}`
        );
      } catch (error) {
        console.error("Error fetching latest family data:", error);
        //fallback to existing data if fetch fails
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(family.data.nodes, family.data.edges);
        setNodes(addCallbacksToNodes(layoutedNodes));
        setEdges(layoutedEdges);
        setCurrentFamily(family.name);
        setCurrentFamilyId(family.id);
        setIsAdmin(true); // If loaded from saved, user is admin
        setShareableLink(
          `${window.location.href}?family=${encodeURIComponent(family.name)}`
        );
      }
    } else {
      // Loading a template family
      const familyName = family;
      const template = familyTemplates[familyName];
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(template.nodes, template.edges);
      setNodes(addCallbacksToNodes(layoutedNodes));
      setEdges(layoutedEdges);
      setCurrentFamily(familyName);
      setIsAdmin(false);
      setShareableLink(
        `${window.location.href}?family=${encodeURIComponent(familyName)}`
      );
    }
  };

  const handleCreateNewFamily = async (familyName) => {
    if (!userId) {
      alert("User not authenticated.");
      return;
    }
    // Always use a default structure for new family data
    const newTemplate = {
      nodes:
        Array.isArray(initialNodes) && initialNodes.length > 0
          ? initialNodes.map((node) => ({
              ...node,
              data: {
                ...node.data,
                name: node.data.name,
                details: node.data.details,
              },
            }))
          : [],
      edges:
        Array.isArray(initialEdges) && initialEdges.length > 0
          ? [...initialEdges]
          : [],
    };
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newTemplate.nodes,
      newTemplate.edges
    );
    setNodes(addCallbacksToNodes(layoutedNodes));
    setEdges(layoutedEdges);
    setCurrentFamily(familyName);
    setIsAdmin(true); // Creator is admin
    setShareableLink(
      `${window.location.href}?family=${encodeURIComponent(familyName)}`
    );
    try {
      const response = await fetch(`${API_BASE_URL}/family-tree`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
        body: JSON.stringify({
          name: familyName,
          data: { nodes: layoutedNodes, edges: layoutedEdges },
        }),
      });
      if (response.status === 409) {
        alert(
          `A family tree with the name "${familyName}" already exists. Please choose a different name.`
        );
        return;
      }
      if (!response.ok) {
        let errorText = await response.text();
        let errorMsg = errorText;
        try {
          const errorObj = JSON.parse(errorText);
          errorMsg = errorObj.details || errorObj.error || errorText;
        } catch {}
        alert(`Failed to save new family tree. Server response: ${errorMsg}`);
        return;
      }
      const result = await response.json();
      setCurrentFamilyId(result.family.id);
      setAccessCode(result.accessCode); // Unique code for users
      setIsAdmin(true);
      loadSavedFamilies();
    } catch (error) {
      alert(`Error saving new family tree: ${error?.message || error}`);
      console.error("Error saving new family tree:", error);
    }
  };

  // Function to access family tree with access code
  const accessFamilyWithCode = async (familyName, accessCode) => {
    if (!userId) {
      alert("User not authenticated.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/family-tree/access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
        body: JSON.stringify({
          familyName,
          accessCode,
        }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          alert("Invalid family name or access code.");
        } else {
          throw new Error("Failed to access family tree");
        }
        return;
      }
      const result = await response.json();
      const { family, isAdmin: userIsAdmin } = result;
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(family.data.nodes, family.data.edges);
      setNodes(addCallbacksToNodes(layoutedNodes));
      setEdges(layoutedEdges);
      setCurrentFamily(family.name);
      setCurrentFamilyId(family.id);
      setAccessCode(family.access_code);
      setIsAdmin(userIsAdmin);
      setShareableLink(
        `${window.location.href}?family=${encodeURIComponent(family.name)}`
      );
      alert(`Successfully accessed "${family.name}" family tree.`);
    } catch (error) {
      console.error("Error accessing family tree:", error);
      alert("Error accessing family tree. See console for details.");
    }
  };

  // Function to add admin to family
  const addAdminToFamily = async (newAdminEmail) => {
    if (!userId || !currentFamilyId) {
      alert("User not authenticated or no family selected.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/family-tree/${currentFamilyId}/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": userId,
          },
          body: JSON.stringify({
            newAdminEmail,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          alert("Only admins can add other admins.");
        } else if (response.status === 404) {
          alert("User with this email not found.");
        } else if (response.status === 409) {
          alert("User is already an admin of this family.");
        } else {
          throw new Error("Failed to add admin");
        }
        return;
      }

      alert("Admin added successfully!");
    } catch (error) {
      console.error("Error adding admin:", error);
      alert("Error adding admin. See console for details.");
    }
  };

  // Function to regenerate access code
  const regenerateAccessCode = async () => {
    if (!userId || !currentFamilyId) {
      alert("User not authenticated or no family selected.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/family-tree/${currentFamilyId}/regenerate-code`,
        {
          method: "POST",
          headers: {
            "X-User-ID": userId,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          alert("Only admins can regenerate access codes.");
        } else {
          throw new Error("Failed to regenerate access code");
        }
        return;
      }

      const result = await response.json();
      setAccessCode(result.accessCode);
      alert(
        `Access code regenerated successfully!\nNew Code: ${result.accessCode}`
      );
    } catch (error) {
      console.error("Error regenerating access code:", error);
      alert("Error regenerating access code. See console for details.");
    }
  };

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { strokeWidth: 2 },
          },
          eds
        )
      ),
    []
  );

  const onLayout = useCallback(
    (direction) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(nodes, edges, direction);

      setNodes(addCallbacksToNodes(layoutedNodes));
      setEdges(layoutedEdges);
    },
    [nodes, edges]
  );

  const exportAsImage = useCallback(
    async (premium = false) => {
      try {
        // Temporarily set exportMode on nodes for proper rendering
        const exportMode = premium ? "premium" : "free";
        const tempNodes = nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            exportMode,
          },
        }));
        setNodes(addCallbacksToNodes(tempNodes));

        // Wait for React to re-render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Hide UI elements temporarily
        const controlPanels = document.querySelectorAll(".control-panel");
        const adminDashboard = document.querySelector(".admin-dashboard-modal");
        const attribution = document.querySelector(".react-flow__attribution");

        const originalDisplays = Array.from(controlPanels).map(
          (panel) => panel.style.display
        );
        const originalAdminDisplay = adminDashboard?.style.display;
        const originalAttributionDisplay = attribution?.style.display;

        // Hide elements
        controlPanels.forEach((panel) => {
          (panel as HTMLElement).style.display = "none";
        });
        if (adminDashboard) {
          (adminDashboard as HTMLElement).style.display = "none";
        }
        if (attribution) {
          (attribution as HTMLElement).style.display = "none";
        }

        // CRITICAL: Temporarily disable animations and fix edge styles for export
        const tempEdges = edges.map((edge) => ({
          ...edge,
          animated: false, // Disable animation
          style: {
            ...edge.style,
            // Ensure visible stroke - make edges more prominent for export
            stroke: edge.style?.stroke || "#374151",
            strokeWidth: 4, // Increased for better visibility in export
          },
        }));

        // Update edges temporarily (this will force re-render without animations)
        setEdges(tempEdges);

        // Wait for the edge update to render
        await new Promise((resolve) => setTimeout(resolve, 300));

        const nodesBounds = getNodesBounds(tempNodes);
        const padding = 200; //extra padding for large trees
        // calculate dynamic image dimensions based on content
        const minWidth = 800;
        const minHeight = 600;
        const maxWidth = 4000; // 4K width limit
        const maxHeight = 4000; // 4K height limit

        // For small families, use content-based dimensions to ensure all nodes fit
        const contentWidth = nodesBounds.width + padding * 2;
        const contentHeight = nodesBounds.height + padding * 2;
        const isSmallFamily =
          contentWidth <= minWidth && contentHeight <= minHeight;

        let imageWidth, imageHeight;

        if (isSmallFamily) {
          // Small family - use dimensions based on content with extra padding for bottom node
          imageWidth = Math.max(contentWidth, 400); // minimum 400px
          imageHeight = Math.max(contentHeight + 50, 300); // minimum 300px, extra 50px for bottom node
        } else {
          // Large family - use standard dimension calculation
          imageWidth = Math.max(
            minWidth,
            Math.min(maxWidth, nodesBounds.width + padding * 2)
          );
          imageHeight = Math.max(
            minHeight,
            Math.min(maxHeight, nodesBounds.height + padding * 2)
          );

          // For very wide trees, use wider aspect ratio
          if (nodesBounds.width > nodesBounds.height * 2) {
            imageWidth = Math.min(maxWidth, nodesBounds.width + padding * 2);
            imageHeight = Math.max(minHeight, imageWidth * 0.6); // 5:3 aspect ratio
          }
          // For very tall trees, use taller aspect ratio
          else if (nodesBounds.height > nodesBounds.width * 2) {
            imageHeight = Math.min(maxHeight, nodesBounds.height + padding * 2);
            imageWidth = Math.max(minWidth, imageHeight * 0.6); // 3:5 aspect ratio
          }
        }

        console.log(
          `Exporting ${nodes.length} nodes with dimensions: ${imageWidth}x${imageHeight}`
        );
        console.log(
          `Content bounds: ${nodesBounds.width}x${nodesBounds.height}, isSmallFamily: ${isSmallFamily}`
        );

        // Use standard centering for all cases - it should work now with proper dimensions
        const viewport = getViewportForBounds(
          nodesBounds,
          imageWidth,
          imageHeight,
          0.1,
          1.5
        );

        const dataUrl = await toPng(
          document.querySelector(".react-flow__viewport"),
          {
            backgroundColor: "transparent",
            width: imageWidth,
            height: imageHeight,
            pixelRatio: 1, //high-res
            style: {
              width: imageWidth,
              height: imageHeight,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            },
          }
        );

        // Restore original edges (with animations)
        setEdges(edges);

        // Restore nodes to normal state
        setNodes(addCallbacksToNodes(nodes));

        // Restore UI elements
        controlPanels.forEach((panel, index) => {
          (panel as HTMLElement).style.display = originalDisplays[index] || "";
        });
        if (adminDashboard) {
          (adminDashboard as HTMLElement).style.display =
            originalAdminDisplay || "";
        }
        if (attribution) {
          (attribution as HTMLElement).style.display =
            originalAttributionDisplay || "";
        }

        // Download
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/:/g, "-");
        const filename = `${currentFamily || "family-tree"}-${timestamp}.png`;
        downloadImage(dataUrl, filename);

        // Show success message
        alert(`Family tree exported successfully as "${filename}"!`);

        console.log("Family tree exported successfully!");
      } catch (error) {
        console.error("Export failed:", error);

        // Emergency restore - restore original edges and UI
        setEdges(edges);
        setNodes(addCallbacksToNodes(nodes));
        const controlPanels = document.querySelectorAll(".control-panel");
        const adminDashboard = document.querySelector(".admin-dashboard-modal");
        const attribution = document.querySelector(".react-flow__attribution");

        controlPanels.forEach((panel) => {
          panel.style.display = "";
        });
        if (adminDashboard) {
          adminDashboard.style.display = "";
        }
        if (attribution) {
          attribution.style.display = "";
        }

        alert("Export failed. Please try again.");
      }
    },
    [currentFamily, nodes, edges, setEdges, setNodes, addCallbacksToNodes]
  );

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const copyShareableLink = () => {
    navigator.clipboard.writeText(shareableLink);
    alert("Shareable link copied to clipboard!");
  };

  // Responsive: re-layout pedigree on window resize
  React.useEffect(() => {
    const handleResize = () => {
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(nodes, edges);
      setNodes(addCallbacksToNodes(layoutedNodes));
      setEdges(layoutedEdges);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [nodes, edges]);

  if (!currentFamily) {
    return (
      <FamilySelector
        onSelectFamily={handleSelectFamily}
        onCreateNew={handleCreateNewFamily}
        savedFamilies={savedFamilies}
        onAccessWithCode={accessFamilyWithCode}
        user={user}
        onLogin={onLogin}
        onSignup={onSignup}
        onLogout={onLogout}
        onShowAuthModal={() => {
          setAuthMode("login");
          setShowAuthModal(true);
        }}
      />
    );
  }

  return (
    <div ref={reactFlowWrapper} className={`flow-container ${theme}`}>
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onLogin={onLogin}
          onSignup={onSignup}
          onSwitchMode={() =>
            setAuthMode(authMode === "login" ? "signup" : "login")
          }
          onClose={() => {
            setShowAuthModal(false);
            // Note: saveLocallyWithExpiration will be called from Flow component
          }}
        />
      )}

      {/* Edit Name Modal */}
      {showEditNameModal && (
        <EditNameModal
          isOpen={showEditNameModal}
          onClose={() => setShowEditNameModal(false)}
          currentName={currentFamily || ""}
          onSave={handleEditFamilyName}
          value={editNameValue}
          onChange={setEditNameValue}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirmModal}
          onClose={() => {
            setShowDeleteConfirmModal(false);
            setDeleteConfirmName("");
          }}
          familyName={currentFamily || ""}
          confirmName={deleteConfirmName}
          onConfirmNameChange={setDeleteConfirmName}
          onConfirm={() => {
            handleHardDelete();
            setShowDeleteConfirmModal(false);
            setDeleteConfirmName("");
          }}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExportFree={() => exportAsImage(false)}
          onExportPremium={() => {
            exportAsImage(true);
          }}
          isPremium={isPremium}
          onActivatePremium={activatePremium}
          isActivating={isActivatingPremium}
          onShowPremiumChoice={() => setShowPremiumChoiceModal(true)}
        />
      )}

      {/* Premium Export Choice Modal */}
      {showPremiumChoiceModal && (
        <PremiumExportChoiceModal
          isOpen={showPremiumChoiceModal}
          onClose={() => setShowPremiumChoiceModal(false)}
          onExportPhoto={() => {
            exportAsImage(true);
            setShowPremiumChoiceModal(false);
          }}
          onExportNode={() => {
            exportAsImage(false);
            setShowPremiumChoiceModal(false);
          }}
        />
      )}

      {/* Mobile Drawer Overlay */}
      {(showLeftDrawer ||
        showRightDrawer ||
        showBottomDrawer ||
        showAdminDrawer) && (
        <div
          className="drawer-overlay active"
          onClick={() => {
            setShowLeftDrawer(false);
            setShowRightDrawer(false);
            setShowBottomDrawer(false);
            setShowAdminDrawer(false);
          }}
        />
      )}

      {/* Mobile Drawer Toggle Buttons */}
      <div className="mobile-drawer-toggles">
        <button
          className="drawer-toggle left-toggle"
          onClick={() => setShowLeftDrawer(!showLeftDrawer)}
          title="Layout & View Controls"
        >
          ⚙️
        </button>
        <button
          className="drawer-toggle right-toggle"
          onClick={() => setShowRightDrawer(!showRightDrawer)}
          title="Family & Export Controls"
        >
          📋
        </button>
        <button
          className="drawer-toggle bottom-toggle"
          onClick={() => setShowBottomDrawer(!showBottomDrawer)}
          title="Messages"
        >
          💬
        </button>
        {isAdmin && (
          <button
            className="drawer-toggle admin-toggle"
            onClick={() => setShowAdminDrawer(!showAdminDrawer)}
            title="Admin Dashboard"
          >
            👑
          </button>
        )}
      </div>

      {/* Left Drawer - Layout & View Controls */}
      <div className={`drawer left-drawer ${showLeftDrawer ? "open" : ""}`}>
        <div className="drawer-header">
          <h4>Controls</h4>
          <button
            className="drawer-close"
            onClick={() => setShowLeftDrawer(false)}
          >
            ✕
          </button>
        </div>
        <div className="drawer-content">
          <div className="panel-section">
            <h4>Layout</h4>
            <button className="control-btn" onClick={() => onLayout("TB")}>
              ↓ Vertical
            </button>
            <button className="control-btn" onClick={() => onLayout("LR")}>
              → Horizontal
            </button>
          </div>
          <div className="panel-section">
            <h4>View</h4>
            <button className="control-btn" onClick={() => zoomIn()}>
              🔍+ Zoom In
            </button>
            <button className="control-btn" onClick={() => zoomOut()}>
              🔍- Zoom Out
            </button>
            <button className="control-btn" onClick={() => fitView()}>
              📐 Fit View
            </button>
          </div>
        </div>
      </div>

      {/* Right Drawer - Family & Export Controls */}
      <div className={`drawer right-drawer ${showRightDrawer ? "open" : ""}`}>
        <div className="drawer-header">
          <h4>Family & Export</h4>
          <button
            className="drawer-close"
            onClick={() => setShowRightDrawer(false)}
          >
            ✕
          </button>
        </div>
        <div className="drawer-content">
          <div className="panel-section">
            <div
              style={{
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#1e293b",
                }}
              >
                {currentFamily || "Unnamed Family"}
              </span>
              {isAdmin && currentFamilyId && (
                <button
                  onClick={() => {
                    setEditNameValue(currentFamily || "");
                    setShowEditNameModal(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "4px",
                    color: "#64748b",
                    fontSize: "16px",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "#3b82f6")}
                  onMouseLeave={(e) => (e.target.style.color = "#64748b")}
                  title="Edit family name"
                >
                  ✏️
                </button>
              )}
            </div>
            <button className="control-btn" onClick={copyShareableLink}>
              🔗 Copy Link
            </button>
            {currentFamilyId && (
              <button
                className="control-btn"
                onClick={() => {
                  if (!user) {
                    alert("Please log in to delete family trees");
                    return;
                  }

                  if (isAdmin) {
                    setDeleteConfirmName("");
                    setShowDeleteConfirmModal(true);
                  } else {
                    // Non-admin soft delete
                    const confirmMessage = `Are you sure you want to remove "${currentFamily}" from your view? It will still be available to other members.`;
                    if (!confirm(confirmMessage)) return;

                    handleSoftDelete();
                  }
                }}
              >
                🗑️ {isAdmin ? "Delete for All" : "Remove from My View"}
              </button>
            )}
            <button
              className="control-btn"
              onClick={() => setCurrentFamily(null)}
            >
              🏠 Family Menu
            </button>
          </div>
          <div className="panel-section">
            <h4>Export & Theme</h4>
            <button
              className="control-btn"
              onClick={() => {
                if (isPremium) {
                  setShowPremiumChoiceModal(true);
                } else {
                  setShowExportModal(true);
                }
              }}
            >
              📷 Export PNG
            </button>
            <button className="control-btn" onClick={saveFamilyTree}>
              💾 Save Family Tree
            </button>
            <button className="control-btn" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            {isPremium && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "4px 6px",
                  background:
                    "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%)",
                  borderRadius: "4px",
                  border: "1px solid #f59e0b",
                  fontSize: "10px",
                  color: "#92400e",
                  textAlign: "center",
                  lineHeight: "1.2",
                }}
              >
                <div style={{ fontWeight: "600" }}>👑 Premium Active</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Drawer - Messages */}
      {user && (
        <div
          className={`drawer bottom-drawer ${showBottomDrawer ? "open" : ""}`}
        >
          <div className="drawer-header">
            <h4>Messages</h4>
            <button
              className="drawer-close"
              onClick={() => setShowBottomDrawer(false)}
            >
              ✕
            </button>
          </div>
          <div className="drawer-content">
            <div style={{ padding: "8px" }}>
              {messages.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "#64748b",
                    fontStyle: "italic",
                  }}
                >
                  No new notifications
                </div>
              ) : (
                messages.map((message: any) => (
                  <div
                    key={message.id}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #f1f5f9",
                      background: message.is_read
                        ? "rgba(255, 255, 255, 0.8)"
                        : "rgba(59, 130, 246, 0.1)",
                      borderRadius: "6px",
                      marginBottom: "8px",
                      borderLeft:
                        message.message_type === "premium"
                          ? "4px solid #f59e0b"
                          : message.message_type === "welcome"
                          ? "4px solid #10b981"
                          : "4px solid #6b7280",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#1e293b",
                        marginBottom: "4px",
                        fontWeight: message.is_read ? "normal" : "600",
                      }}
                    >
                      {message.message}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                      {message.family_name && (
                        <span style={{ fontStyle: "italic" }}>
                          {message.family_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Drawer - Admin Dashboard */}
      {isAdmin && (
        <div className={`drawer admin-drawer ${showAdminDrawer ? "open" : ""}`}>
          <div className="drawer-header">
            <h4>Admin Dashboard</h4>
            <button
              className="drawer-close"
              onClick={() => setShowAdminDrawer(false)}
            >
              ✕
            </button>
          </div>
          <div className="drawer-content">
            <AdminDashboard
              currentFamily={currentFamily}
              currentFamilyId={currentFamilyId}
              accessCode={accessCode}
              userId={userId || ""}
              onRegenerateCode={regenerateAccessCode}
              onAddAdmin={addAdminToFamily}
              theme={theme}
              compact={true}
              showQuickAction={false}
              isModal={false}
            />
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
      >
        {/* Layout Controls */}
        <Panel position="top-left" className="control-panel">
          <div className="panel-section">
            <h4>Layout</h4>
            <button className="control-btn" onClick={() => onLayout("TB")}>
              ↓ Vertical
            </button>
            <button className="control-btn" onClick={() => onLayout("LR")}>
              → Horizontal
            </button>
          </div>
        </Panel>

        {/* Zoom and View Controls */}
        <Panel position="top-right" className="control-panel">
          <div className="panel-section">
            <h4>View</h4>
            <button className="control-btn" onClick={() => zoomIn()}>
              🔍+ Zoom In
            </button>
            <button className="control-btn" onClick={() => zoomOut()}>
              🔍- Zoom Out
            </button>
            <button className="control-btn" onClick={() => fitView()}>
              📐 Fit View
            </button>
            {user && (
              <>
                <hr
                  style={{
                    margin: "8px 0",
                    border: "none",
                    borderTop: "1px solid #e2e8f0",
                  }}
                />
                <button
                  className="control-btn"
                  onClick={() => {
                    setShowMessagesPanel(!showMessagesPanel);
                    // Mark unread messages as read when opening panel
                    if (!showMessagesPanel) {
                      const unreadMessageIds = messages
                        .filter((msg) => !msg.is_read)
                        .map((msg) => msg.id);
                      if (unreadMessageIds.length > 0) {
                        markMessagesAsRead(unreadMessageIds);
                      }
                    }
                  }}
                  style={{
                    background: unreadMessageCount > 0 ? "#3b82f6" : "#6b7280",
                    position: "relative",
                  }}
                >
                  📬 Messages
                  {unreadMessageCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        background: "#ef4444",
                        color: "white",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {unreadMessageCount}
                    </span>
                  )}
                </button>
                {showMessagesPanel && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      backdropFilter: "blur(10px)",
                      minWidth: "300px",
                      maxWidth: "400px",
                      maxHeight: "400px",
                      overflowY: "auto",
                      zIndex: 1001,
                      marginTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        padding: "16px",
                        borderBottom: "1px solid #e2e8f0",
                        fontWeight: "600",
                        color: "#1e293b",
                      }}
                    >
                      Notifications
                    </div>
                    <div style={{ padding: "8px" }}>
                      {messages.length === 0 ? (
                        <div
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            color: "#64748b",
                            fontStyle: "italic",
                          }}
                        >
                          No new notifications
                        </div>
                      ) : (
                        messages.map((message: any) => (
                          <div
                            key={message.id}
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid #f1f5f9",
                              background: message.is_read
                                ? "rgba(255, 255, 255, 0.8)"
                                : "rgba(59, 130, 246, 0.1)",
                              borderRadius: "6px",
                              marginBottom: "8px",
                              borderLeft:
                                message.message_type === "premium"
                                  ? "4px solid #f59e0b"
                                  : message.message_type === "welcome"
                                  ? "4px solid #10b981"
                                  : "4px solid #6b7280",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "14px",
                                color: "#1e293b",
                                marginBottom: "4px",
                                fontWeight: message.is_read ? "normal" : "600",
                              }}
                            >
                              {message.message}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#64748b",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span>
                                {new Date(message.created_at).toLocaleString()}
                              </span>
                              {message.family_name && (
                                <span style={{ fontStyle: "italic" }}>
                                  {message.family_name}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>

        {/* Family Info */}
        <Panel position="bottom-left" className="control-panel">
          <div className="panel-section">
            <div
              style={{
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#1e293b",
                }}
              >
                {currentFamily || "Unnamed Family"}
              </span>
              {isAdmin && currentFamilyId && (
                <button
                  onClick={() => {
                    setEditNameValue(currentFamily || "");
                    setShowEditNameModal(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "4px",
                    color: "#64748b",
                    fontSize: "16px",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "#3b82f6")}
                  onMouseLeave={(e) => (e.target.style.color = "#64748b")}
                  title="Edit family name"
                >
                  ✏️
                </button>
              )}
            </div>
            <button className="control-btn" onClick={copyShareableLink}>
              🔗 Copy Link
            </button>
            {currentFamilyId && (
              <button
                className="control-btn"
                onClick={() => {
                  if (!user) {
                    alert("Please log in to delete family trees");
                    return;
                  }

                  if (isAdmin) {
                    setDeleteConfirmName("");
                    setShowDeleteConfirmModal(true);
                  } else {
                    // Non-admin soft delete
                    const confirmMessage = `Are you sure you want to remove "${currentFamily}" from your view? It will still be available to other members.`;
                    if (!confirm(confirmMessage)) return;

                    handleSoftDelete();
                  }
                }}
              >
                🗑️ {isAdmin ? "Delete for All" : "Remove from My View"}
              </button>
            )}
            <button
              className="control-btn"
              onClick={() => setCurrentFamily(null)}
            >
              🏠 Family Menu
            </button>
          </div>
        </Panel>

        {/* Export and Theme Controls */}
        <Panel position="bottom-right" className="control-panel">
          <div className="panel-section">
            <h4>Export & Theme</h4>
            <button
              className="control-btn"
              onClick={() => {
                if (isPremium) {
                  setShowPremiumChoiceModal(true);
                } else {
                  setShowExportModal(true);
                }
              }}
            >
              📷 Export PNG
            </button>
            <button className="control-btn" onClick={saveFamilyTree}>
              💾 Save Family Tree
            </button>
            <button className="control-btn" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            {isPremium && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "4px 6px",
                  background:
                    "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%)",
                  borderRadius: "4px",
                  border: "1px solid #f59e0b",
                  fontSize: "10px",
                  color: "#92400e",
                  textAlign: "center",
                  lineHeight: "1.2",
                }}
              >
                <div style={{ fontWeight: "600" }}>👑 Premium Active</div>
                {/* <div>Double-click nodes to add photos</div> */}
              </div>
            )}
          </div>
        </Panel>
        {/* Admin Dashboard as a draggable, resizable modal overlay */}
        {isAdmin && showAdminDashboard && (
          <Draggable handle=".admin-dashboard-modal-header">
            <AdminDashboard
              currentFamily={currentFamily}
              currentFamilyId={currentFamilyId}
              accessCode={accessCode}
              userId={userId || ""}
              onRegenerateCode={regenerateAccessCode}
              onAddAdmin={addAdminToFamily}
              theme={theme}
              compact={true}
              showQuickAction={false}
              isModal={true}
            />
          </Draggable>
        )}
        {isAdmin && !showAdminDashboard && (
          <button
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 1001,
              background: theme === "dark" ? "#333" : "#fff",
              border: "1px solid #888",
              borderRadius: 6,
              padding: "6px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setShowAdminDashboard(true)}
          >
            Open Admin Dashboard
          </button>
        )}
        <Background color={theme === "dark" ? "#333" : "#aaa"} gap={16} />
      </ReactFlow>
    </div>
  );
};

export function App() {
  // Auth state - moved to App level for global access
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Load auth state on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Auth functions
  const login = async (email: string, password: string) => {
    try {
      // Get current guest user ID to transfer ownership
      const guestUserId = localStorage.getItem("userId");

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, guestUserId }),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("authUser", JSON.stringify(data.user));
        // Update userId to the logged-in user's ID so families are loaded correctly
        localStorage.setItem("userId", data.user.id);
        setShowAuthModal(false);
        // Force reload to update userId state
        window.location.reload();
      } else {
        alert(data.error || "Login failed");
      }
    } catch (error) {
      alert("Login failed");
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("authUser", JSON.stringify(data.user));
        setShowAuthModal(false);
        // Reload families after signup - this will be handled by Flow component
      } else {
        alert(data.error || "Signup failed");
      }
    } catch (error) {
      alert("Signup failed");
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <Flow
          user={user}
          token={token}
          showAuthModal={showAuthModal}
          setShowAuthModal={setShowAuthModal}
          authMode={authMode}
          setAuthMode={setAuthMode}
          onLogin={login}
          onSignup={signup}
          onLogout={logout}
        />
      </ReactFlowProvider>
      {/* Global Auth Modal */}
      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onLogin={login}
          onSignup={signup}
          onSwitchMode={() =>
            setAuthMode(authMode === "login" ? "signup" : "login")
          }
          onClose={() => {
            setShowAuthModal(false);
            // Note: saveLocallyWithExpiration will be called from Flow component
          }}
        />
      )}
    </div>
  );
}
