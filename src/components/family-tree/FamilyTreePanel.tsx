import { Button } from "@/components/ui/button";
import { useReactFlow } from "reactflow";
import {
  Download,
  Save,
  Upload,
  UserPlus,
  ZoomIn,
  ZoomOut,
  Camera,
  Link,
  Share2,
} from "lucide-react";
import { FamilyTreeData } from "@/types";
import { useCallback, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FamilySelector } from "./FamilySelector";
import { Theme, ThemeSelector } from "./ThemeSelector";

interface FamilyTreePanelProps {
  onAddMember: () => void;
  onSave: () => void;
  onImport: (data: FamilyTreeData) => void;
  onExport: () => void;
  onExportImage: () => void;
  onLinkFamilies: () => void;
  onShareFamily: () => void;
  currentFamily: string;
  families: { id: string; name: string }[];
  onFamilyChange: (familyId: string) => void;
  onCreateFamily: (familyName: string) => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
}

export default function FamilyTreePanel({
  onAddMember,
  onSave,
  onImport,
  onExport,
  onExportImage,
  onLinkFamilies,
  onShareFamily,
  currentFamily,
  families,
  onFamilyChange,
  onCreateFamily,
  currentTheme,
  onThemeChange,
  searchValue = "",
  onSearchValueChange = () => {},
}: FamilyTreePanelProps) {
  const { zoomIn, zoomOut } = useReactFlow();

  // Memoized Import Handler
  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          onImport(json);
        } catch (error) {
          console.error("Failed to parse imported file:", error);
          alert("Invalid file format. Please import a valid JSON file.");
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }, [onImport]);

  // Memoized Zoom Handlers
  const handleZoomIn = useCallback(() => zoomIn(), [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut(), [zoomOut]);

  const panelActions = useMemo(
    () => [
      {
        icon: UserPlus,
        handler: onAddMember,
        label: "Add Family Member",
      },
      {
        icon: Link,
        handler: onLinkFamilies,
        label: "Link Families",
      },
      {
        icon: Share2,
        handler: onShareFamily,
        label: "Share Family Tree",
      },
    ],
    [onAddMember, onLinkFamilies, onShareFamily]
  );

  const exportActions = useMemo(
    () => [
      {
        icon: Save,
        handler: onSave,
        label: "Save Changes",
      },
      {
        icon: Camera,
        handler: onExportImage,
        label: "Export as Image",
      },
      {
        icon: Upload,
        handler: handleImportClick,
        label: "Import Family Tree",
      },
      {
        icon: Download,
        handler: onExport,
        label: "Export as JSON",
      },
      {
        icon: ZoomIn,
        handler: handleZoomIn,
        label: "Zoom In",
      },
      {
        icon: ZoomOut,
        handler: handleZoomOut,
        label: "Zoom Out",
      },
    ],
    [
      onSave,
      onExportImage,
      handleImportClick,
      onExport,
      handleZoomIn,
      handleZoomOut,
    ]
  );

  // Fixed sidebar styling for desktop
  return (
    <div className="fixed top-0 left-0 h-full w-20 z-30 bg-background/95 backdrop-blur-sm p-2 border-r shadow-xl flex flex-col gap-3 min-h-screen">
      <FamilySelector
        currentFamily={currentFamily}
        families={families}
        onFamilyChange={onFamilyChange}
        onCreateFamily={onCreateFamily}
      />
      <div className="h-px bg-border my-1" />
      {/* Search box */}
      <input
        className="w-full rounded bg-white text-black px-2 py-1 text-sm border border-gray-300 mb-1"
        style={{ fontSize: 13 }}
        type="text"
        placeholder="Search member..."
        value={searchValue}
        onChange={e => onSearchValueChange(e.target.value)}
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="flex flex-col gap-2">
        {panelActions.map(({ icon: Icon, handler, label }, i) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-10 p-0 relative"
                aria-label={label}
                onClick={handler}
              >
                <Icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="text-base px-4 py-2 font-semibold bg-black text-white border-none shadow-lg"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="h-px bg-border my-1" />
      <div className="flex flex-col gap-2">
        {exportActions.map(({ icon: Icon, handler, label }, i) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-10 p-0 relative"
                aria-label={label}
                onClick={handler}
              >
                <Icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="text-base px-4 py-2 font-semibold bg-black text-white border-none shadow-lg"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="h-px bg-border my-1" />
    </div>
  );
}
