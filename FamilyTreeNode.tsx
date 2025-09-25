import React, { useState, useEffect } from "react";
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
  isPremium?: boolean;
  familyId?: string;
  userId?: string;
  token?: string;
  exportMode?: "free" | "premium" | null;
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
  const [nodeImage, setNodeImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load node image on mount
  useEffect(() => {
    const loadNodeImage = async () => {
      if (data.familyId && data.userId) {
        try {
          const headers: any = { "X-User-ID": data.userId };
          if (data.token) {
            headers.Authorization = `Bearer ${data.token}`;
          }

          const response = await fetch(
            `/api/node-image/${data.familyId}/${id}`,
            {
              headers,
            }
          );

          if (response.ok) {
            const imageData = await response.json();
            setNodeImage(imageData.image_data);
          }
        } catch (error) {
          console.warn(`Failed to load image for node ${id}:`, error);
        }
      }
    };

    loadNodeImage();
  }, [data.familyId, data.userId, data.token, id]);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data.isPremium || !data.familyId || !data.userId) {
      return;
    }

    // Check file size (2MB limit)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > maxSize) {
      alert("Please select an image smaller than 2MB.");
      return;
    }

    setIsUploading(true);
    try {
      // Compress and resize image
      const compressedBase64 = await compressImage(file);

      const headers: any = {
        "Content-Type": "application/json",
        "X-User-ID": data.userId,
      };
      if (data.token) {
        headers.Authorization = `Bearer ${data.token}`;
      }

      const response = await fetch("/api/node-image", {
        method: "POST",
        headers,
        body: JSON.stringify({
          nodeId: id,
          familyId: data.familyId,
          imageData: compressedBase64,
          imageName: file.name,
        }),
      });

      if (response.ok) {
        setNodeImage(compressedBase64);
        alert("Image uploaded successfully!");
      } else {
        const error = await response.json();
        alert(`Failed to upload image: ${error.error}`);
      }
      setIsUploading(false);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image. Please try again.");
      setIsUploading(false);
    }
  };

  // Compress and resize image
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (max 200px width/height)
        const maxSize = 200;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression (0.8 quality)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
        resolve(compressedBase64);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleRemoveImage = async () => {
    if (!data.isPremium || !data.familyId || !data.userId) {
      return;
    }

    try {
      const headers: any = { "X-User-ID": data.userId };
      if (data.token) {
        headers.Authorization = `Bearer ${data.token}`;
      }

      const response = await fetch(`/api/node-image/${data.familyId}/${id}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        setNodeImage(null);
        alert("Image removed successfully!");
      } else {
        const error = await response.json();
        alert(`Failed to remove image: ${error.error}`);
      }
    } catch (error) {
      console.error("Error removing image:", error);
      alert("Failed to remove image. Please try again.");
    }
  };

  return (
    <div className="family-node" data-id={id} onDoubleClick={handleDoubleClick}>
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
            {data.isPremium && (
              <div className="image-upload-section">
                <label className="image-upload-label">
                  Family Photo:
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    style={{ display: "none" }}
                  />
                  <div className="image-upload-btn">
                    {isUploading ? "Uploading..." : "📷 Choose Photo"}
                  </div>
                </label>
                {nodeImage && (
                  <button
                    onClick={handleRemoveImage}
                    className="remove-image-btn"
                    type="button"
                  >
                    🗑️ Remove Photo
                  </button>
                )}
              </div>
            )}
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
            {data.exportMode === "free" ? (
              <>
                <div className="node-name">{data.name || data.label}</div>
                {data.details && (
                  <div className="node-details">{data.details}</div>
                )}
              </>
            ) : data.exportMode === "premium" && nodeImage ? (
              <div className="node-with-image">
                <div
                  className="node-image"
                  style={{
                    backgroundImage: `url(${nodeImage})`,
                  }}
                ></div>
                <div className="node-name">{data.name || data.label}</div>
              </div>
            ) : (
              <>
                {nodeImage && data.isPremium ? (
                  <div className="node-with-image">
                    <div
                      className="node-image"
                      style={{
                        backgroundImage: `url(${nodeImage})`,
                      }}
                    ></div>
                    <div className="node-name">{data.name || data.label}</div>
                  </div>
                ) : (
                  <>
                    <div className="node-name">{data.name || data.label}</div>
                    {data.details && (
                      <div className="node-details">{data.details}</div>
                    )}
                  </>
                )}
              </>
            )}
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
