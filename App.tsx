import FamilyTreeNode from "./FamilyTreeNode";
import React, { useState, useCallback, useRef } from "react";
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
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import html2canvas from "html2canvas";
import "@xyflow/react/dist/style.css";
import { initialNodes, initialEdges } from "./initialElements";

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
    nodesep: isHorizontal ? 150 : 100, // More space between nodes at same level
    ranksep: isHorizontal ? 180 : 150, // More space between generations
    marginx: 50,
    marginy: 50,
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
          adjustedY = partnerPosition.y + nodeHeight + 20; // Place below partner
        } else {
          // Vertical layout: place spouse to the right of partner
          adjustedX = partnerPosition.x + nodeWidth + 30; // Place to the right of partner
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

const FamilySelector = ({ onSelectFamily, onCreateNew }) => {
  const [newFamilyName, setNewFamilyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateNew = () => {
    if (newFamilyName.trim()) {
      onCreateNew(newFamilyName.trim());
      setNewFamilyName("");
      setShowCreateForm(false);
    }
  };

  return (
    <div className="family-selector-overlay">
      <div className="family-selector">
        <h2>Family Tree Manager</h2>
        <div className="existing-families">
          <h3>Existing Families</h3>
          {Object.keys(familyTemplates).map((familyName) => (
            <button
              key={familyName}
              className="family-option"
              onClick={() => onSelectFamily(familyName)}
            >
              {familyName}
            </button>
          ))}
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
  const reactFlowWrapper = useRef(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [theme, setTheme] = useState("light");
  const [nextNodeId, setNextNodeId] = useState(10);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [shareableLink, setShareableLink] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  const handleSelectFamily = (familyName) => {
    const template = familyTemplates[familyName];
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      template.nodes,
      template.edges
    );

    setNodes(addCallbacksToNodes(layoutedNodes));
    setEdges(layoutedEdges);
    setCurrentFamily(familyName);
    setShareableLink(
      `${window.location.href}?family=${encodeURIComponent(familyName)}`
    );
  };

  const handleCreateNewFamily = (familyName) => {
    const newTemplate = {
      nodes: initialNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          name: node.data.name,
          details: node.data.details,
        },
      })),
      edges: [...initialEdges],
    };

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newTemplate.nodes,
      newTemplate.edges
    );

    setNodes(addCallbacksToNodes(layoutedNodes));
    setEdges(layoutedEdges);
    setCurrentFamily(familyName);
    setShareableLink(
      `${window.location.href}?family=${encodeURIComponent(familyName)}`
    );
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
        2,
        2
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

  if (!currentFamily) {
    return (
      <FamilySelector
        onSelectFamily={handleSelectFamily}
        onCreateNew={handleCreateNewFamily}
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
            <h4>{currentFamily}</h4>
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
            <button className="control-btn" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </Panel>

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
