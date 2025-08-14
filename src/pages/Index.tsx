import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  NodeTypes,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Node,
  useKeyPress,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import FamilyMemberNode from "@/components/family-tree/FamilyMemberNode";
import { AddMemberDialog } from "@/components/family-tree/AddMemberDialog";
import FamilyTreePanel from "@/components/family-tree/FamilyTreePanel";
import MemberDetailsPanel from "@/components/family-tree/MemberDetailsPanel";
import { LinkFamiliesDialog } from "@/components/family-tree/LinkFamiliesDialog";
import { ShareFamilyDialog } from "@/components/family-tree/ShareFamilyDialog";
import {
  ThemeSelector,
  Theme,
  themeConfig,
} from "@/components/family-tree/ThemeSelector";
import { FamilyMember, FamilyRelationship, FamilyTreeData } from "@/types";
import {
  addFamilyMember,
  addRelationship,
  removeFamilyMember,
  convertToReactFlowFormat,
} from "@/lib/family-tree-utils";
import {
  loadMultiFamilyData,
  saveMultiFamilyData,
  createFamily,
  getFamilyNames,
  linkFamilies,
  getFamilyDataWithCrossLinks,
  getOtherFamiliesForLinking,
  MultiFamilyData,
} from "@/lib/multi-family-utils";
import {
  exportFamilyTreeAsImage,
  downloadImage,
  getImageExportFilename,
} from "@/lib/image-export-utils";
import { getSharedFamilyData } from "@/lib/share-utils";
import { TooltipProvider } from "@/components/ui/tooltip";

// Register custom node types
const nodeTypes: NodeTypes = {
  familyNode: FamilyMemberNode,
};

function FamilyTreeFlow() {
  const [multiFamilyData, setMultiFamilyData] = useState<MultiFamilyData>({
    families: {},
    crossFamilyRelationships: [],
  });
  // Add state for showing the family name input
  const [showFamilyNamePrompt, setShowFamilyNamePrompt] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState("");
  const [currentFamilyId, setCurrentFamilyId] =
    useState<string>("default-family");
  const [familyData, setFamilyData] = useState<FamilyTreeData>({
    members: [],
    relationships: [],
  });
  // Default starter node: to avoid blank ReactFlow canvas if empty
  const defaultNode = [
    {
      id: "placeholder",
      type: "familyNode",
      position: { x: 250, y: 150 },
      data: { name: "Add your first member!", theme: "default" },
    },
  ];
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNode);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [linkFamiliesOpen, setLinkFamiliesOpen] = useState(false);
  const [shareFamilyOpen, setShareFamilyOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(
    null
  );
  const [currentTheme, setCurrentTheme] = useState<Theme>("default");
  // Search state
  const [searchValue, setSearchValue] = useState("");
  // VARIANT CONTROLS REACTFLOW BACKGROUND DIRECTLY
  // Only top-right ThemeSelector/variant should exist
  const [variant, setVariant] = useState<"dots"|"lines"|"cross">("dots");
  const reactFlowInstance = useReactFlow();
  const deleteKeyPressed = useKeyPress("Delete");

  // Load data from localStorage on component mount
  useEffect(() => {
    // Check if this is a shared family link
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get("share");

    if (shareId) {
      const sharedData = getSharedFamilyData(shareId);
      if (sharedData) {
        // Load shared family data
        const sharedMultiFamilyData = {
          families: {
            [sharedData.familyId]: sharedData.data,
          },
          crossFamilyRelationships: [],
        };
        setMultiFamilyData(sharedMultiFamilyData);
        setCurrentFamilyId(sharedData.familyId);

        const currentData = getFamilyDataWithCrossLinks(
          sharedMultiFamilyData,
          sharedData.familyId
        );
        setFamilyData(currentData);
        const { nodes: initialNodes, edges: initialEdges } =
          convertToReactFlowFormat(currentData);
        setNodes(initialNodes);
        setEdges(initialEdges);
        setShowFamilyNamePrompt(false);
        return;
      }
    }

    // Normal data loading
    const data = loadMultiFamilyData();
    setMultiFamilyData(data);

    // Always re-check this logic!
    const realFamilyIds = Object.keys(data.families).filter(id => id !== "default-family");
    if (
      realFamilyIds.length === 0 ||
      !realFamilyIds.includes(currentFamilyId)
    ) {
      setShowFamilyNamePrompt(true);
      setCurrentFamilyId("");
    } else {
      setShowFamilyNamePrompt(false);
    }

    // Set current family data
    const famIdToUse = (realFamilyIds.length > 0 && realFamilyIds.includes(currentFamilyId)) ? currentFamilyId : (realFamilyIds[0] || "");
    if (famIdToUse && data.families[famIdToUse]) {
      const currentData = getFamilyDataWithCrossLinks(data, famIdToUse);
      setFamilyData(currentData);
      const { nodes: initialNodes, edges: initialEdges } =
        convertToReactFlowFormat(currentData);
      setNodes(initialNodes);
      setEdges(initialEdges);
    } else {
      setFamilyData({ members: [], relationships: [] });
      setNodes(defaultNode);
      setEdges([]);
    }
  }, [currentFamilyId, setNodes, setEdges]);

  // Update family data when family changes
  useEffect(() => {
    const currentData = getFamilyDataWithCrossLinks(
      multiFamilyData,
      currentFamilyId
    );
    setFamilyData(currentData);
    const { nodes: newNodes, edges: newEdges } =
      convertToReactFlowFormat(currentData);

    // Enhanced: highlight matching nodes if searching
    let themedNodes = newNodes.map((node) => {
      let highlighted = false;
      if (searchValue.trim()) {
        const nodeName = (node.data?.name || "").toLowerCase();
        if (nodeName.includes(searchValue.trim().toLowerCase())) {
          highlighted = true;
        }
      }
      return {
        ...node,
        data: { ...node.data, theme: currentTheme, highlighted },
      };
    });

    setNodes(themedNodes);
    setEdges(newEdges);

    // If searching and there are matches, center/zoom to first
    if (searchValue.trim() && themedNodes.some(n => n.data.highlighted)) {
      const firstMatch = themedNodes.find(n => n.data.highlighted);
      if (firstMatch && reactFlowInstance?.setCenter) {
        const { x, y } = firstMatch.position;
        reactFlowInstance.setCenter(x + 75, y + 75, { zoom: 1.2, duration: 800 });
      }
    }

  }, [multiFamilyData, currentFamilyId, currentTheme, setNodes, setEdges, searchValue, reactFlowInstance]);

  // Handle delete key press
  useEffect(() => {
    if (deleteKeyPressed && selectedMember) {
      handleDeleteMember(selectedMember.id);
    }
  }, [deleteKeyPressed, selectedMember]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const member = familyData.members.find((m) => m.id === node.id);
      if (member) {
        setSelectedMember(member);
      }
    },
    [familyData.members]
  );

  // Handle adding new family member
  const handleAddFamilyMember = (
    memberData: Omit<FamilyMember, "id">,
    relationshipData?: Omit<FamilyRelationship, "id" | "sourceId">
  ) => {
    const currentFamily = multiFamilyData.families[currentFamilyId] || {
      members: [],
      relationships: [],
    };

    // Add new member
    const updatedMembers = addFamilyMember(currentFamily.members, memberData);
    const newMemberId = updatedMembers[updatedMembers.length - 1].id;

    // Add relationship if specified
    let updatedRelationships = [...currentFamily.relationships];
    if (relationshipData && relationshipData.targetId) {
      updatedRelationships = addRelationship(updatedRelationships, {
        sourceId: newMemberId,
        targetId: relationshipData.targetId,
        relationshipType: relationshipData.relationshipType,
      });
    }

    // Update multi-family data
    const updatedMultiFamilyData = {
      ...multiFamilyData,
      families: {
        ...multiFamilyData.families,
        [currentFamilyId]: {
          members: updatedMembers,
          relationships: updatedRelationships,
        },
      },
    };

    setMultiFamilyData(updatedMultiFamilyData);
    saveMultiFamilyData(updatedMultiFamilyData);
  };

  // Handle deleting a family member
  const handleDeleteMember = (memberId: string) => {
    const currentFamily = multiFamilyData.families[currentFamilyId] || {
      members: [],
      relationships: [],
    };
    const updatedFamilyData = removeFamilyMember(currentFamily, memberId);

    const updatedMultiFamilyData = {
      ...multiFamilyData,
      families: {
        ...multiFamilyData.families,
        [currentFamilyId]: updatedFamilyData,
      },
    };

    setMultiFamilyData(updatedMultiFamilyData);
    saveMultiFamilyData(updatedMultiFamilyData);
    setSelectedMember(null);
  };

  // Handle saving the family tree data
  const handleSave = () => {
    // Save the node positions
    if (reactFlowInstance) {
      const flowNodes = reactFlowInstance.getNodes();
      const currentFamily = multiFamilyData.families[currentFamilyId] || {
        members: [],
        relationships: [],
      };

      const updatedMembers = currentFamily.members.map((member) => {
        const flowNode = flowNodes.find((node) => node.id === member.id);
        return flowNode ? { ...member, position: flowNode.position } : member;
      });

      const updatedMultiFamilyData = {
        ...multiFamilyData,
        families: {
          ...multiFamilyData.families,
          [currentFamilyId]: {
            ...currentFamily,
            members: updatedMembers,
          },
        },
      };

      saveMultiFamilyData(updatedMultiFamilyData);
      setMultiFamilyData(updatedMultiFamilyData);

      // Show a toast or some feedback
      alert("Family tree saved successfully!");
    }
  };

  // Handle importing family tree data
  const handleImport = (importedData: FamilyTreeData) => {
    const updatedMultiFamilyData = {
      ...multiFamilyData,
      families: {
        ...multiFamilyData.families,
        [currentFamilyId]: importedData,
      },
    };

    setMultiFamilyData(updatedMultiFamilyData);
    saveMultiFamilyData(updatedMultiFamilyData);
  };

  // Handle exporting family tree data
  const handleExport = () => {
    // Save current node positions before export
    if (reactFlowInstance) {
      const flowNodes = reactFlowInstance.getNodes();
      const currentFamily = multiFamilyData.families[currentFamilyId] || {
        members: [],
        relationships: [],
      };

      const updatedMembers = currentFamily.members.map((member) => {
        const flowNode = flowNodes.find((node) => node.id === member.id);
        return flowNode ? { ...member, position: flowNode.position } : member;
      });

      const dataToExport = {
        ...currentFamily,
        members: updatedMembers,
      };

      // Create download link
      const familyName =
        getFamilyNames(multiFamilyData).find((f) => f.id === currentFamilyId)
          ?.name || "family-tree";
      const filename = `${familyName
        .replace(/\s+/g, "-")
        .toLowerCase()}-tree.json`;

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
    }
  };

  // Handle exporting family tree as image
  const handleExportImage = async () => {
    try {
      const familyName =
        getFamilyNames(multiFamilyData).find((f) => f.id === currentFamilyId)
          ?.name || "family-tree";
      const dataUrl = await exportFamilyTreeAsImage(nodes, "png", familyName);
      const filename = getImageExportFilename(familyName, "png");
      downloadImage(dataUrl, filename);
      alert("Family tree image exported successfully!");
    } catch (error) {
      console.error("Failed to export image:", error);
      alert("Failed to export image. Please try again.");
    }
  };

  // Handle creating a new family
  const handleCreateFamily = (familyName: string) => {
    const updatedMultiFamilyData = createFamily(multiFamilyData, familyName);
    setMultiFamilyData(updatedMultiFamilyData);
    saveMultiFamilyData(updatedMultiFamilyData);
    setShowFamilyNamePrompt(false);
    setFamilyNameInput("");

    // Switch to the new family
    const newFamilyId = Object.keys(updatedMultiFamilyData.families).find(
      (id) => id.includes(familyName.replace(/\s+/g, "-").toLowerCase())
    );
    if (newFamilyId) {
      setCurrentFamilyId(newFamilyId);
    }
  };

  // Handle linking families
  const handleLinkFamilies = (
    currentMemberId: string,
    otherFamilyId: string,
    otherMemberId: string
  ) => {
    const updatedMultiFamilyData = linkFamilies(
      multiFamilyData,
      currentFamilyId,
      currentMemberId,
      otherFamilyId,
      otherMemberId
    );
    setMultiFamilyData(updatedMultiFamilyData);
    saveMultiFamilyData(updatedMultiFamilyData);
    alert("Families linked successfully!");
  };

  // Empty canvas guide
  const renderEmptyState = () => {
    if (
      familyData.members.filter((m) => !m.id.startsWith("linked-")).length > 0
    )
      return null;

    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="bg-background/95 backdrop-blur-sm p-8 rounded-xl shadow-lg text-center max-w-md border">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-green-600 to-orange-600 bg-clip-text text-transparent">
            Welcome to Family Tree
          </h2>
          <p className="text-muted-foreground mb-6">
            Your family tree is empty. Start building your family history by
            adding your first family member.
          </p>
          <Button
            onClick={() => setAddMemberOpen(true)}
            className="pointer-events-auto bg-gradient-to-r from-green-600 to-orange-600 hover:from-green-700 hover:to-orange-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
            size="lg"
          >
            Add Your First Family Member
          </Button>
        </div>
      </div>
    );
  };

  // Optional: Example variant-based background
  let currentThemeConfig = themeConfig[currentTheme];
  if (variant === "minimal") {
    currentThemeConfig = {
      ...currentThemeConfig,
      background: "#fff",
      nodeBackground: "#f6f6f6",
      accent: currentThemeConfig.primary
    };
  } else if (variant === "playful") {
    currentThemeConfig = {
      ...currentThemeConfig,
      background: "repeating-linear-gradient(135deg,#f5e8ff 0 20px,#fff8f0 20px 40px)",
      nodeBackground: "#fff5e2",
      accent: "#a21caf"
    };
  }

  return (
    <div
      className="w-full h-full relative overflow-auto flex flex-col"
      style={{
        background: currentThemeConfig.background,
      }}
    >
      {/* Prompt for family name if none exists */}
      {showFamilyNamePrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg px-6 py-8 shadow-xl border flex flex-col w-full max-w-xs">
            <h2 className="mb-3 text-lg font-semibold text-center">What's your family name?</h2>
            {Object.keys(multiFamilyData.families).filter(id => id !== "default-family").length > 0 && (
              <>
                <div className="mb-2 text-sm font-medium">Choose existing family:</div>
                <div className="flex flex-col gap-2 mb-4">
                  {getFamilyNames(multiFamilyData).filter(f => f.id !== "default-family").map(fam => (
                    <Button
                      key={fam.id}
                      variant="outline"
                      className="w-full !justify-start"
                      onClick={() => {
                        setCurrentFamilyId(fam.id);
                        setShowFamilyNamePrompt(false);
                      }}
                    >
                      {fam.name}
                    </Button>
                  ))}
                </div>
                <div className="text-muted-foreground text-xs mb-3 text-center">Or enter a new family name below:</div>
              </>
            )}
            <input
              className="border rounded px-3 py-2 mb-4 text-base focus:outline-none focus:ring w-full"
              type="text"
              value={familyNameInput}
              onChange={e => setFamilyNameInput(e.target.value)}
              placeholder="e.g. The Smiths"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && familyNameInput.trim()) {
                  handleCreateFamily(familyNameInput.trim());
                }
              }}
            />
            <Button
              onClick={() => {
                if (familyNameInput.trim()) {
                  handleCreateFamily(familyNameInput.trim());
                }
              }}
              disabled={!familyNameInput.trim()}
              className="w-full"
            >
              Start
            </Button>
          </div>
        </div>
      )}
      {/* Theme Selector + Background Variant - Top Right ONLY */}
      <div className="fixed top-2 right-2 z-40 w-40 sm:w-56">
        <div className="bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border flex flex-col gap-3">
          <ThemeSelector
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
          />
          <div>
            <label htmlFor="variant-select" className="block text-xs text-muted-foreground mb-1">Background Pattern</label>
            <select
              id="variant-select"
              className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring"
              value={variant}
              onChange={e => setVariant(e.target.value as "dots"|"lines"|"cross")}
            >
              <option value="dots">Dots</option>
              <option value="lines">Lines</option>
              <option value="cross">Cross</option>
            </select>
          </div>
        </div>
      </div>

      {/* Show selected family name at the top if not in prompt & currentFamilyId in real families */}
      {!showFamilyNamePrompt && (
        <div className="fixed top-2 left-1/2 z-40 -translate-x-1/2 px-6 py-2 text-xl font-bold rounded bg-background/90 shadow border flex items-center max-w-[80vw] justify-center text-center">
          {
            // Display reliable family name
            (() => {
              const fam = multiFamilyData.families[currentFamilyId];
              const nameFromList = getFamilyNames(multiFamilyData).find(f => f.id === currentFamilyId)?.name;
              // Display name if available, fallback to id
              return fam?.name || nameFromList || currentFamilyId || '';
            })()
          }
        </div>
      )}
      <div className="flex-1 relative w-full min-h-screen">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          panOnScroll
          panOnScrollSpeed={0.5}
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          panOnDrag
          selectNodesOnDrag={false}
          minZoom={0.1}
          maxZoom={2}
          className="w-full h-[65vh] min-h-[350px] md:min-h-[550px]"
        >
          <Background color="#ccc" gap={16} variant={variant} />
          <div className={`absolute top-2 left-0 w-full flex justify-center z-10 ${addMemberOpen ? 'hidden sm:flex' : 'flex'}`}>
            <div className="max-w-xs w-full sm:max-w-md p-2">
              <FamilyTreePanel
                onAddMember={() => setAddMemberOpen(true)}
                onSave={handleSave}
                onImport={handleImport}
                onExport={handleExport}
                onExportImage={handleExportImage}
                onLinkFamilies={() => setLinkFamiliesOpen(true)}
                onShareFamily={() => setShareFamilyOpen(true)}
                currentFamily={currentFamilyId}
                families={getFamilyNames(multiFamilyData).filter(f => f.id !== "default-family")}
                onFamilyChange={setCurrentFamilyId}
                onCreateFamily={handleCreateFamily}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
                searchValue={searchValue}
                onSearchValueChange={setSearchValue}
              />
            </div>
          </div>
          {renderEmptyState()}
        </ReactFlow>
        {selectedMember && (
          <div className="fixed bottom-2 right-2 z-20 max-w-[95vw] sm:max-w-sm w-full">
            <MemberDetailsPanel
              member={selectedMember}
              onClose={() => setSelectedMember(null)}
              onDelete={handleDeleteMember}
            />
          </div>
        )}
      </div>
      {/* Responsive dialogs */}
      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        onAddMember={handleAddFamilyMember}
        existingMembers={familyData.members.filter(
          (m) => !m.id.startsWith("linked-")
        )}
        isFirstMember={
          familyData.members.filter((m) => !m.id.startsWith("linked-"))
            .length === 0
        }
      />

      <LinkFamiliesDialog
        open={linkFamiliesOpen}
        onOpenChange={setLinkFamiliesOpen}
        currentFamilyMembers={familyData.members.filter(
          (m) => !m.id.startsWith("linked-")
        )}
        otherFamilies={getOtherFamiliesForLinking(
          multiFamilyData,
          currentFamilyId
        )}
        onLinkFamilies={handleLinkFamilies}
      />

      <ShareFamilyDialog
        open={shareFamilyOpen}
        onOpenChange={setShareFamilyOpen}
        familyId={currentFamilyId}
        familyName={
          getFamilyNames(multiFamilyData).find((f) => f.id === currentFamilyId)
            ?.name || "Family Tree"
        }
        familyData={familyData}
      />
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function FamilyTreePage() {
  return (
    <div className="w-full h-screen overflow-auto">
      <TooltipProvider>
        <ReactFlowProvider>
          <FamilyTreeFlow />
        </ReactFlowProvider>
      </TooltipProvider>
    </div>
  );
}
