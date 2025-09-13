# TODO List for Family Tree Bug Fix

## Completed Tasks

- [x] Analyze the issue: Adding child nodes causes other nodes to delete or reshuffle due to stale state in edges update.
- [x] Identify root cause: In handleAddChild, handleAddParent, handleAddSpouse, the `edges` state is referenced from closure, leading to stale state when updating.
- [x] Implement fix: Add useRef for nodes and edges, update them in useEffect, and use refs in add handlers to get current state.
- [x] Update handleAddChild to use nodesRef.current and edgesRef.current.
- [x] Update handleAddParent to use nodesRef.current and edgesRef.current.
- [x] Update handleAddSpouse to use nodesRef.current and edgesRef.current.

## Next Steps

- Test the fix by running the app and adding multiple child nodes to a parent.
- Verify that no nodes are deleted or reshuffled when adding children or spouses.
- If issues persist, investigate further (e.g., check getLayoutedElements function).
