export interface FamilyLink {
  sourceFamily: string;
  targetFamily: string;
  sourcePerson: string;
  targetPerson: string;
  relationship: 'spouse' | 'parent' | 'child' | 'sibling';
}

export interface MultiFamilyData {
  families: { [familyName: string]: any };
  links: FamilyLink[];
}

// Function to link a spouse from one family to another
export function linkSpouseBetweenFamilies(
  sourceFamily: any,
  targetFamily: any,
  sourcePersonId: string,
  targetPersonId: string
): FamilyLink {
  return {
    sourceFamily: sourceFamily.name,
    targetFamily: targetFamily.name,
    sourcePerson: sourcePersonId,
    targetPerson: targetPersonId,
    relationship: 'spouse'
  };
}

// Function to find potential spouse matches across families
export function findPotentialSpouseMatches(
  currentFamily: any,
  allFamilies: { [familyName: string]: any },
  currentPersonId: string
): Array<{ familyName: string; personId: string; personName: string }> {
  const matches: Array<{ familyName: string; personId: string; personName: string }> = [];
  const currentPerson = currentFamily.nodes.find((node: any) => node.id === currentPersonId);

  if (!currentPerson) return matches;

  Object.entries(allFamilies).forEach(([familyName, familyData]) => {
    if (familyName === currentFamily.name) return; // Skip current family

    familyData.nodes.forEach((node: any) => {
      // Check if the person could be a potential spouse
      // This is a simple check - in a real app, you'd have more sophisticated matching
      if (node.data.name && node.data.name !== currentPerson.data.name) {
        matches.push({
          familyName,
          personId: node.id,
          personName: node.data.name
        });
      }
    });
  });

  return matches;
}

// Function to validate if a spouse link is valid
export function validateSpouseLink(
  sourceFamily: any,
  targetFamily: any,
  sourcePersonId: string,
  targetPersonId: string
): { isValid: boolean; error?: string } {
  const sourcePerson = sourceFamily.nodes.find((node: any) => node.id === sourcePersonId);
  const targetPerson = targetFamily.nodes.find((node: any) => node.id === targetPersonId);

  if (!sourcePerson) {
    return { isValid: false, error: 'Source person not found' };
  }

  if (!targetPerson) {
    return { isValid: false, error: 'Target person not found' };
  }

  // Check if either person already has a spouse
  const sourceHasSpouse = sourceFamily.edges.some((edge: any) =>
    (edge.source === sourcePersonId || edge.target === sourcePersonId) &&
    edge.style?.stroke === '#e91e63'
  );

  const targetHasSpouse = targetFamily.edges.some((edge: any) =>
    (edge.source === targetPersonId || edge.target === targetPersonId) &&
    edge.style?.stroke === '#e91e63'
  );

  if (sourceHasSpouse) {
    return { isValid: false, error: 'Source person already has a spouse' };
  }

  if (targetHasSpouse) {
    return { isValid: false, error: 'Target person already has a spouse' };
  }

  return { isValid: true };
}

// Function to create a spouse edge between families
export function createSpouseEdgeBetweenFamilies(
  sourcePersonId: string,
  targetPersonId: string,
  sourceFamily: any,
  targetFamily: any
): any {
  return {
    id: `spouse-link-${sourcePersonId}-${targetPersonId}`,
    source: sourcePersonId,
    target: targetPersonId,
    type: 'straight',
    animated: false,
    style: {
      strokeWidth: 3,
      stroke: '#e91e63',
      strokeDasharray: '5,5',
    },
    label: '♥',
    data: {
      crossFamily: true,
      sourceFamily: sourceFamily.name,
      targetFamily: targetFamily.name
    }
  };
}
