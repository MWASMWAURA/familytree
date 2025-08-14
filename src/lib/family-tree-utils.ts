import { FamilyMember, FamilyRelationship, FamilyTreeData } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Local Storage Keys
const FAMILY_MEMBERS_KEY = "family_tree_members";
const FAMILY_RELATIONSHIPS_KEY = "family_tree_relationships";

// Load family tree data from localStorage
export const loadFamilyTreeData = (): FamilyTreeData => {
  if (typeof window === 'undefined') {
    return { members: [], relationships: [] };
  }
  
  try {
    const membersString = localStorage.getItem(FAMILY_MEMBERS_KEY);
    const relationshipsString = localStorage.getItem(FAMILY_RELATIONSHIPS_KEY);
    
    const members: FamilyMember[] = membersString ? JSON.parse(membersString) : [];
    const relationships: FamilyRelationship[] = relationshipsString ? JSON.parse(relationshipsString) : [];
    
    return { members, relationships };
  } catch (error) {
    console.error("Failed to load family tree data:", error);
    return { members: [], relationships: [] };
  }
};

// Save family tree data to localStorage
export const saveFamilyTreeData = (data: FamilyTreeData): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(FAMILY_MEMBERS_KEY, JSON.stringify(data.members));
    localStorage.setItem(FAMILY_RELATIONSHIPS_KEY, JSON.stringify(data.relationships));
  } catch (error) {
    console.error("Failed to save family tree data:", error);
  }
};

// Add a new family member
export const addFamilyMember = (
  members: FamilyMember[],
  newMember: Omit<FamilyMember, "id">
): FamilyMember[] => {
  const memberWithId = { ...newMember, id: uuidv4() };
  const updatedMembers = [...members, memberWithId];
  if (typeof window !== 'undefined') {
    localStorage.setItem(FAMILY_MEMBERS_KEY, JSON.stringify(updatedMembers));
  }
  return updatedMembers;
};

// Add a new relationship
export const addRelationship = (
  relationships: FamilyRelationship[],
  newRelationship: Omit<FamilyRelationship, "id">
): FamilyRelationship[] => {
  const relationshipWithId = { ...newRelationship, id: uuidv4() };
  const updatedRelationships = [...relationships, relationshipWithId];
  if (typeof window !== 'undefined') {
    localStorage.setItem(FAMILY_RELATIONSHIPS_KEY, JSON.stringify(updatedRelationships));
  }
  return updatedRelationships;
};

// Remove a family member and their relationships
export const removeFamilyMember = (
  data: FamilyTreeData,
  memberId: string
): FamilyTreeData => {
  const updatedMembers = data.members.filter(member => member.id !== memberId);
  const updatedRelationships = data.relationships.filter(
    rel => rel.sourceId !== memberId && rel.targetId !== memberId
  );
  
  return { members: updatedMembers, relationships: updatedRelationships };
};

// Convert data to React Flow format
export const convertToReactFlowFormat = (data: FamilyTreeData) => {
  const nodes = data.members.map(member => ({
    id: member.id,
    type: 'familyNode',
    position: getRandomPosition(),
    data: member,
  }));

  const edges = data.relationships.map(rel => ({
    id: rel.id,
    source: rel.sourceId,
    target: rel.targetId,
    type: 'smoothstep',
    animated: false,
    label: getRelationshipLabel(rel.relationshipType),
    style: { stroke: getRelationshipColor(rel.relationshipType) }
  }));

  return { nodes, edges };
};

// Helper function to get random position for new nodes
const getRandomPosition = () => {
  return { 
    x: Math.random() * 800, 
    y: Math.random() * 600 
  };
};

// Helper function to get relationship label
const getRelationshipLabel = (type: string): string => {
  switch (type) {
    case 'parent-child':
      return 'Parent-Child';
    case 'spouse':
      return 'Spouse';
    case 'sibling':
      return 'Sibling';
    default:
      return type;
  }
};

// Helper function to get relationship color
const getRelationshipColor = (type: string): string => {
  switch (type) {
    case 'parent-child':
      return '#3b82f6'; // blue
    case 'spouse':
      return '#ec4899'; // pink
    case 'sibling':
      return '#10b981'; // green
    default:
      return '#6b7280'; // gray
  }
};