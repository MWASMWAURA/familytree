import { FamilyTreeData, FamilyMember, FamilyRelationship } from "@/types";

export interface MultiFamilyData {
  families: Record<string, FamilyTreeData>;
  crossFamilyRelationships: FamilyRelationship[];
}

export function loadMultiFamilyData(): MultiFamilyData {
  try {
    const stored = localStorage.getItem('multi-family-tree-data');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load multi-family data:', error);
  }
  
  // Return default structure with a default family
  return {
    families: {
      'default-family': { members: [], relationships: [] }
    },
    crossFamilyRelationships: []
  };
}

export function saveMultiFamilyData(data: MultiFamilyData): void {
  try {
    localStorage.setItem('multi-family-tree-data', JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save multi-family data:', error);
  }
}

export function createFamily(
  multiFamilyData: MultiFamilyData,
  familyName: string
): MultiFamilyData {
  const familyId = `family-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    ...multiFamilyData,
    families: {
      ...multiFamilyData.families,
      [familyId]: {
        name: familyName,
        members: [],
        relationships: []
      }
    }
  };
}

export function getFamilyNames(multiFamilyData: MultiFamilyData): { id: string; name: string }[] {
  return Object.keys(multiFamilyData.families).map(familyId => ({
    id: familyId,
    name:
      multiFamilyData.families[familyId].name ||
      (familyId === 'default-family' ? 'Default Family' : familyId)
  }));
}

export function linkFamilies(
  multiFamilyData: MultiFamilyData,
  currentFamilyId: string,
  currentMemberId: string,
  otherFamilyId: string,
  otherMemberId: string
): MultiFamilyData {
  // Create a cross-family relationship (marriage)
  const newRelationship: FamilyRelationship = {
    id: `cross-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sourceId: currentMemberId,
    targetId: otherMemberId,
    relationshipType: 'spouse'
  };

  return {
    ...multiFamilyData,
    crossFamilyRelationships: [...multiFamilyData.crossFamilyRelationships, newRelationship]
  };
}

export function getFamilyDataWithCrossLinks(
  multiFamilyData: MultiFamilyData,
  familyId: string
): FamilyTreeData {
  const familyData = multiFamilyData.families[familyId] || { members: [], relationships: [] };
  
  // Add cross-family members as linked members
  const crossLinkedMembers: FamilyMember[] = [];
  const crossRelationships: FamilyRelationship[] = [];
  
  multiFamilyData.crossFamilyRelationships.forEach(crossRel => {
    // Check if this family has members linked to other families
    const currentFamilyMember = familyData.members.find(m => m.id === crossRel.sourceId);
    const otherFamilyMember = findMemberInOtherFamilies(multiFamilyData, familyId, crossRel.targetId);
    
    if (currentFamilyMember && otherFamilyMember) {
      // Add the linked member from other family
      crossLinkedMembers.push({
        ...otherFamilyMember,
        id: `linked-${otherFamilyMember.id}`, // Prefix to avoid ID conflicts
      });
      
      // Add the cross-family relationship
      crossRelationships.push({
        ...crossRel,
        targetId: `linked-${otherFamilyMember.id}`
      });
    }
    
    // Check reverse direction
    const otherFamilyMemberAsSource = findMemberInOtherFamilies(multiFamilyData, familyId, crossRel.sourceId);
    const currentFamilyMemberAsTarget = familyData.members.find(m => m.id === crossRel.targetId);
    
    if (otherFamilyMemberAsSource && currentFamilyMemberAsTarget) {
      crossLinkedMembers.push({
        ...otherFamilyMemberAsSource,
        id: `linked-${otherFamilyMemberAsSource.id}`,
      });
      
      crossRelationships.push({
        ...crossRel,
        sourceId: `linked-${otherFamilyMemberAsSource.id}`
      });
    }
  });
  
  return {
    members: [...familyData.members, ...crossLinkedMembers],
    relationships: [...familyData.relationships, ...crossRelationships]
  };
}

function findMemberInOtherFamilies(
  multiFamilyData: MultiFamilyData,
  excludeFamilyId: string,
  memberId: string
): FamilyMember | null {
  for (const [familyId, familyData] of Object.entries(multiFamilyData.families)) {
    if (familyId !== excludeFamilyId) {
      const member = familyData.members.find(m => m.id === memberId);
      if (member) return member;
    }
  }
  return null;
}

export function getOtherFamiliesForLinking(
  multiFamilyData: MultiFamilyData,
  currentFamilyId: string
): { id: string; name: string; members: FamilyMember[] }[] {
  return Object.entries(multiFamilyData.families)
    .filter(([familyId]) => familyId !== currentFamilyId)
    .map(([familyId, familyData]) => ({
      id: familyId,
      name: familyId === 'default-family' ? 'Default Family' : 
            familyId.replace('family-', '').replace(/-\d+-.+$/, '').replace(/-/g, ' '),
      members: familyData.members
    }))
    .filter(family => family.members.length > 0);
}