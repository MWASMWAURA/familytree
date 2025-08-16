const position = { x: 0, y: 0 };
const edgeType = "smoothstep";

export const initialNodes = [
  {
    id: "1",
    type: "familyNode",
    data: {
      name: "Great Grandparent",
      details: "Generation 1",
    },
    position,
  },
  {
    id: "2",
    type: "familyNode",
    data: {
      name: "Grandparent A",
      details: "Generation 2",
    },
    position,
  },
  {
    id: "3",
    type: "familyNode",
    data: {
      name: "Grandparent B",
      details: "Generation 2",
    },
    position,
  },
  {
    id: "4",
    type: "familyNode",
    data: {
      name: "Parent A",
      details: "Generation 3",
    },
    position,
  },
  {
    id: "5",
    type: "familyNode",
    data: {
      name: "Parent B",
      details: "Generation 3",
    },
    position,
  },
  {
    id: "6",
    type: "familyNode",
    data: {
      name: "Child A",
      details: "Generation 4",
    },
    position,
  },
  {
    id: "7",
    type: "familyNode",
    data: {
      name: "Child B",
      details: "Generation 4",
    },
    position,
  },
  {
    id: "8",
    type: "familyNode",
    data: {
      name: "Child C",
      details: "Generation 4",
    },
    position,
  },
];

export const initialEdges = [
  // Great Grandparent to Grandparents
  { id: "e1-2", source: "1", target: "2", type: edgeType, animated: true },
  { id: "e1-3", source: "1", target: "3", type: edgeType, animated: true },

  // Grandparents to Parents
  { id: "e2-4", source: "2", target: "4", type: edgeType, animated: true },
  { id: "e3-5", source: "3", target: "5", type: edgeType, animated: true },

  // Parents to Children
  { id: "e4-6", source: "4", target: "6", type: edgeType, animated: true },
  { id: "e4-7", source: "4", target: "7", type: edgeType, animated: true },
  { id: "e5-8", source: "5", target: "8", type: edgeType, animated: true },
];
