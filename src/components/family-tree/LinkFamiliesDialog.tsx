import React, { useState, useEffect } from "react";
import {
  findPotentialSpouseMatches,
  validateSpouseLink,
  createSpouseEdgeBetweenFamilies,
} from "../../lib/multi-family-utils";

interface LinkFamiliesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentFamily: any;
  allFamilies: { [familyName: string]: any };
  selectedPersonId: string;
  onLinkSpouse: (edge: any, targetFamily: string) => void;
}

const LinkFamiliesDialog: React.FC<LinkFamiliesDialogProps> = ({
  isOpen,
  onClose,
  currentFamily,
  allFamilies,
  selectedPersonId,
  onLinkSpouse,
}) => {
  const [potentialMatches, setPotentialMatches] = useState<
    Array<{
      familyName: string;
      personId: string;
      personName: string;
    }>
  >([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedPersonId) {
      const matches = findPotentialSpouseMatches(
        currentFamily,
        allFamilies,
        selectedPersonId
      );
      setPotentialMatches(matches);
    }
  }, [isOpen, selectedPersonId, currentFamily, allFamilies]);

  const handleLinkSpouse = () => {
    if (!selectedMatch) return;

    const [targetFamilyName, targetPersonId] = selectedMatch.split("-");
    const targetFamily = allFamilies[targetFamilyName];

    const validation = validateSpouseLink(
      currentFamily,
      targetFamily,
      selectedPersonId,
      targetPersonId
    );

    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    const spouseEdge = createSpouseEdgeBetweenFamilies(
      selectedPersonId,
      targetPersonId,
      currentFamily,
      targetFamily
    );

    onLinkSpouse(spouseEdge, targetFamilyName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="link-families-overlay">
      <div className="link-families-dialog">
        <h2>Link Spouse Between Families</h2>
        <p>Select a person from another family to link as a spouse:</p>

        <div className="matches-list">
          {potentialMatches.length === 0 ? (
            <p>No potential matches found in other families.</p>
          ) : (
            potentialMatches.map((match) => (
              <div
                key={`${match.familyName}-${match.personId}`}
                className={`match-item ${
                  selectedMatch === `${match.familyName}-${match.personId}`
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setSelectedMatch(`${match.familyName}-${match.personId}`)
                }
              >
                <div className="match-info">
                  <strong>{match.personName}</strong>
                  <span className="family-name">from {match.familyName}</span>
                </div>
                <div className="match-radio">
                  <input
                    type="radio"
                    checked={
                      selectedMatch === `${match.familyName}-${match.personId}`
                    }
                    onChange={() =>
                      setSelectedMatch(`${match.familyName}-${match.personId}`)
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="dialog-buttons">
          <button
            className="link-btn"
            onClick={handleLinkSpouse}
            disabled={!selectedMatch}
          >
            Link as Spouse
          </button>
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>

      <style jsx>{`
        .link-families-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .link-families-dialog {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .matches-list {
          margin: 20px 0;
          max-height: 300px;
          overflow-y: auto;
        }

        .match-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .match-item:hover {
          background-color: #f5f5f5;
        }

        .match-item.selected {
          background-color: #e3f2fd;
          border-color: #2196f3;
        }

        .match-info {
          display: flex;
          flex-direction: column;
        }

        .family-name {
          font-size: 0.9em;
          color: #666;
        }

        .dialog-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .link-btn {
          background: #2196f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .link-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .cancel-btn {
          background: #f44336;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default LinkFamiliesDialog;
