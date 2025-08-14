import { Button } from "@/components/ui/button";
import { useReactFlow, Panel } from "reactflow";
import { Download, Save, Upload, UserPlus, ZoomIn, ZoomOut } from "lucide-react";
import { FamilyTreeData } from "@/types";
import { useCallback } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface FamilyTreeControlsProps {
  onAddMember: () => void;
  onSave: () => void;
  onImport: (data: FamilyTreeData) => void;
  onExport: () => void;
}

export default function FamilyTreeControls({
  onAddMember,
  onSave,
  onImport,
  onExport,
}: FamilyTreeControlsProps) {
  const { zoomIn, zoomOut } = useReactFlow();

  // Use a callback approach instead of direct ref manipulation
  const handleImportClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
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
    };
    
    // Trigger file selection
    input.click();
  }, [onImport]);

  return (
    <Panel position="top-right" className="flex flex-col gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0" onClick={onAddMember}>
            <UserPlus className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Add Family Member</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0" onClick={onSave}>
            <Save className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Save Changes</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0" onClick={handleImportClick}>
            <Upload className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Import Family Tree</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0" onClick={onExport}>
            <Download className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Export Family Tree</TooltipContent>
      </Tooltip>

      <div className="h-px bg-border my-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0" onClick={() => zoomIn()}>
            <ZoomIn className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom In</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 w-10 p-0" onClick={() => zoomOut()}>
            <ZoomOut className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom Out</TooltipContent>
      </Tooltip>
    </Panel>
  );
}