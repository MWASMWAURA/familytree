export interface FamilyMember {
  id: string;
  name: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  imageUrl?: string;
  notes?: string;
}

export interface FamilyRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
}

export type RelationshipType = 
  | 'parent-child'
  | 'spouse'
  | 'sibling';

export interface FamilyTreeData {
  members: FamilyMember[];
  relationships: FamilyRelationship[];
}