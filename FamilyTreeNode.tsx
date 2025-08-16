import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";

interface NodeData {
  name?: string;
  label?: string;
  details?: string;
  spouseLink?: string;
  onAddParent?: (id: string) => void;
  onAddChild?: (id: string) => void;
  onAddSpouse?: (id: string) => void;
  onUpdateNode?: (
    id: string,
    data: { name: string; details: string; spouseLink?: string }
  ) => void;
}

interface FamilyTreeNodeProps {
  data: NodeData;
  id: string;
}

const FamilyTreeNode: React.FC<FamilyTreeNodeProps> = ({ data, id }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(data.name || data.label || "");
  const [editDetails, setEditDetails] = useState(data.details || "");
  const [editSpouseLink, setEditSpouseLink] = useState(data.spouseLink || "");

  const handleAddParent = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (data.onAddParent) {
      data.onAddParent(id);
    }
  };

  const handleAddChild = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (data.onAddChild) {
      data.onAddChild(id);
    }
  };

  const handleAddSpouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (data.onAddSpouse) {
      data.onAddSpouse(id);
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (data.onUpdateNode) {
      data.onUpdateNode(id, {
        name: editName,
        details: editDetails,
        spouseLink: editSpouseLink,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(data.name || data.label || "");
    setEditDetails(data.details || "");
    setEditSpouseLink(data.spouseLink || "");
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleSpouseLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.spouseLink) {
      window.open(data.spouseLink, "_blank");
    }
  };

  return (
    <div className="family-node" onDoubleClick={handleDoubleClick}>
      <button
        className="add-button add-parent"
        onClick={handleAddParent}
        title="Add Parent"
      >
        +
      </button>

      <button
        className="add-button add-spouse"
        onClick={handleAddSpouse}
        title="Add Spouse"
      >
        ♥
      </button>

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555", width: 6, height: 6 }}
      />

      <div className="node-content">
        {isEditing ? (
          <div className="edit-form">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyPress}
              className="edit-input name-input"
              placeholder="Name"
              autoFocus
            />
            <input
              type="text"
              value={editDetails}
              onChange={(e) => setEditDetails(e.target.value)}
              onKeyDown={handleKeyPress}
              className="edit-input details-input"
              placeholder="Details"
            />
            <input
              type="text"
              value={editSpouseLink}
              onChange={(e) => setEditSpouseLink(e.target.value)}
              onKeyDown={handleKeyPress}
              className="edit-input spouse-input"
              placeholder="Spouse Family Tree Link"
            />
            <div className="edit-buttons">
              <button onClick={handleSave} className="save-btn">
                ✓
              </button>
              <button onClick={handleCancel} className="cancel-btn">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="node-name">{data.name || data.label}</div>
            {data.details && <div className="node-details">{data.details}</div>}
            {data.spouseLink && (
              <div
                className="spouse-link"
                onClick={handleSpouseLinkClick}
                title="View Spouse's Family Tree"
              >
                🔗 Spouse Tree
              </div>
            )}
            <div className="edit-hint">Double-click to edit</div>
          </>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555", width: 6, height: 6 }}
      />

      <button
        className="add-button add-child"
        onClick={handleAddChild}
        title="Add Child"
      >
        +
      </button>
    </div>
  );
};

export default FamilyTreeNode;
