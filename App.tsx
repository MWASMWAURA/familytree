import FamilyTreeNode from "./FamilyTreeNode";
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

// API base URL - adjust if server is running on different port
const API_BASE_URL = "http://localhost:3001/api";

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
    nodesep: isHorizontal ? 180 : 180, // Increased space between nodes at same level
    ranksep: isHorizontal ? 210 : 210, // Increased space between generations
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

  // Add only non-spouse nodes to dagre for hierarchy layout
  const hierarchyNodes = nodes.filter((node) => {
    // If it's connected by spouse edge, only include one of the pair in hierarchy
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
    layoutGraph.setNode(node.id, {
      width: nodeWidth,
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

    // Check if this node is a spouse
    const spouseEdge = spouseEdges.find(
      (edge) => edge.source === node.id || edge.target === node.id
    );

    if (spouseEdge && spouseEdge.target === node.id) {
      // This is a spouse node (target), position it next to its partner (source)
      const partnerId = spouseEdge.source;
      const partnerPosition = layoutGraph.node(partnerId);

      if (partnerPosition) {
        if (isHorizontal) {
          // Horizontal layout: place spouse below partner
          adjustedX = partnerPosition.x - nodeWidth / 2;
          adjustedY = partnerPosition.y + nodeHeight + 50; // More space below partner
        } else {
          // Vertical layout: place spouse to the right of partner
          adjustedX = partnerPosition.x + nodeWidth + 60; // More space to the right of partner
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
        // Fallback for nodes not in dagre (shouldn't happen)
        adjustedX = 0;
        adjustedY = 0;
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
}) => {
  const [newFamilyName, setNewFamilyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAccessForm, setShowAccessForm] = useState(false);
  const [accessFamilyName, setAccessFamilyName] = useState("");
  const [accessCode, setAccessCode] = useState("");

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
  );
};

const Flow = () => {
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
      const response = await fetch(`${API_BASE_URL}/family-tree`, {
        headers: {
          "X-User-ID": userId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load saved families");
      }

      const families = await response.json();
      setSavedFamilies(families);
    } catch (error) {
      console.error("Error loading saved families:", error);
    }
  };
  // Fix the loadPersistedFamily function to properly sync with server data
  const loadPersistedFamily = async () => {
    try {
      const persistedData = localStorage.getItem("currentFamilyTree");
      if (persistedData) {
        const familyData = JSON.parse(persistedData);
        // Only load if it's recent (within last 24 hours)
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - familyData.timestamp < oneDay) {
          // check if this family exists in server and load the latest version
          try {
            const response = await fetch(`${API_BASE_URL}/family-tree`, {
              headers: {
                "X-User-ID": userId,
              },
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
    }
  };
  // Load persisted family when userId is available
  useEffect(() => {
    if (userId) {
      loadPersistedFamily();
    }
  }, [userId]);
  // Function to save current family tree to server
  const saveFamilyTree = async () => {
    if (!currentFamily || !userId) {
      alert("No family selected or user not authenticated.");
      return;
    }

    try {
      if (currentFamilyId) {
        // Update existing family tree
        const response = await fetch(
          `${API_BASE_URL}/family-tree/${currentFamilyId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": userId,
            },
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
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": userId,
          },
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

      const newParentNode = {
        id: newParentId,
        type: "familyNode",
        data: {
          name: "New Parent",
          details: "Double-click to edit",
        },
        position: { x: 0, y: 0 },
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

      const newChildNode = {
        id: newChildId,
        type: "familyNode",
        data: {
          name: "New Child",
          details: "Double-click to edit",
        },
        position: { x: 0, y: 0 },
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
          const { nodes: layoutedNodes, edges: layoutedEdges } =
            getLayoutedElements(updatedNodes, updatedEdges);
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

      const newSpouseNode = {
        id: newSpouseId,
        type: "familyNode",
        data: {
          name: "Spouse",
          details: "Double-click to edit",
        },
        position: { x: 0, y: 0 },
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
          const { nodes: layoutedNodes, edges: layoutedEdges } =
            getLayoutedElements(updatedNodes, updatedEdges);
          return addCallbacksToNodes(layoutedNodes);
        });

        return updatedEdges;
      });

      return prev + 1;
    });
  }

  const handleSelectFamily = (family) => {
    if (typeof family === "object" && family.data) {
      // Loading a saved family from server
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
  const addAdminToFamily = async (newAdminId) => {
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
            newAdminId,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          alert("Only admins can add other admins.");
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

  const exportAsImage = useCallback(async () => {
    try {
      const { getNodesBounds, getViewportForBounds } = await import(
        "@xyflow/react"
      );

      // Get bounds of all nodes and edges
      const bounds = getNodesBounds(nodes);

      // Add padding around the bounds
      const padding = 100;
      const boundsWithPadding = {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      };

      // Calculate viewport for the bounds
      const viewport = getViewportForBounds(
        boundsWithPadding,
        2000,
        2000,
        0.1,
        2,
        0.1
      );

      // Get the React Flow instance
      const reactFlowInstance =
        reactFlowWrapper.current?.querySelector(".react-flow");
      if (!reactFlowInstance) {
        throw new Error("React Flow instance not found");
      }

      // Use html2canvas to capture the entire React Flow container
      const canvas = await html2canvas(reactFlowInstance, {
        backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
        scale: 2,
        width: 2000,
        height: 2000,
        x: viewport.x,
        y: viewport.y,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          // Only ignore control panels and UI elements, but include the main flow
          return (
            element.classList?.contains("control-panel") ||
            element.classList?.contains("react-flow__minimap") ||
            element.classList?.contains("react-flow__controls") ||
            element.classList?.contains("react-flow__panel")
          );
        },
      });

      // Create download link
      const link = document.createElement("a");
      link.download = `${currentFamily || "family-tree"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error exporting image:", error);

      // Fallback to capturing the entire container
      const reactFlowElement =
        reactFlowWrapper.current?.querySelector(".react-flow");
      if (reactFlowElement) {
        try {
          const canvas = await html2canvas(reactFlowElement, {
            backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
            scale: 2,
            ignoreElements: (element) => {
              // Ignore only UI control elements
              return (
                element.classList?.contains("control-panel") ||
                element.classList?.contains("react-flow__minimap") ||
                element.classList?.contains("react-flow__controls") ||
                element.classList?.contains("react-flow__panel")
              );
            },
          });
          const link = document.createElement("a");
          link.download = `${currentFamily || "family-tree"}.png`;
          link.href = canvas.toDataURL();
          link.click();
        } catch (fallbackError) {
          console.error("Fallback export also failed:", fallbackError);
        }
      }
    }
  }, [theme, currentFamily, nodes, edges]);

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
      />
    );
  }

  return (
    <div ref={reactFlowWrapper} className={`flow-container ${theme}`}>
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
          </div>
        </Panel>

        {/* Family Info */}
        <Panel position="bottom-left" className="control-panel">
          <div className="panel-section">
            {!currentFamilyId && (
              <input
                type="text"
                value={currentFamily || ""}
                onChange={(e) => setCurrentFamily(e.target.value)}
                className="family-name-input"
                placeholder="Family name"
              />
            )}
            <button className="control-btn" onClick={copyShareableLink}>
              🔗 Copy Link
            </button>
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
            <button className="control-btn" onClick={exportAsImage}>
              📷 Export PNG
            </button>
            <button className="control-btn" onClick={saveFamilyTree}>
              💾 Save Family Tree
            </button>
            <button className="control-btn" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
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
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
