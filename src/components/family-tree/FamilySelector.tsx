import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users } from "lucide-react";

interface FamilySelectorProps {
  currentFamily: string;
  families: {id: string, name: string}[];
  onFamilyChange: (familyId: string) => void;
  onCreateFamily: (familyName: string) => void;
}

export function FamilySelector({
  currentFamily,
  families,
  onFamilyChange,
  onCreateFamily,
}: FamilySelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");

  const handleCreateFamily = () => {
    if (newFamilyName.trim()) {
      onCreateFamily(newFamilyName.trim());
      setNewFamilyName("");
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4" />
      <Select value={currentFamily} onValueChange={onFamilyChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select a family" />
        </SelectTrigger>
        <SelectContent>
          {families.map((family) => (
            <SelectItem key={family.id} value={family.id}>
              {family.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Family Tree</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="family-name">Family Name</Label>
              <Input
                id="family-name"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Enter family name (e.g., Smith Family)"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFamily()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFamily} disabled={!newFamilyName.trim()}>
                Create Family
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}