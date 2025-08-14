import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FamilyMember } from "@/types";

interface LinkFamiliesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFamilyMembers: FamilyMember[];
  otherFamilies: { id: string; name: string; members: FamilyMember[] }[];
  onLinkFamilies: (currentMemberId: string, otherFamilyId: string, otherMemberId: string) => void;
}

export function LinkFamiliesDialog({
  open,
  onOpenChange,
  currentFamilyMembers,
  otherFamilies,
  onLinkFamilies,
}: LinkFamiliesDialogProps) {
  const [selectedCurrentMember, setSelectedCurrentMember] = useState("");
  const [selectedOtherFamily, setSelectedOtherFamily] = useState("");
  const [selectedOtherMember, setSelectedOtherMember] = useState("");

  const selectedFamily = otherFamilies.find(f => f.id === selectedOtherFamily);

  const handleLink = () => {
    if (selectedCurrentMember && selectedOtherFamily && selectedOtherMember) {
      onLinkFamilies(selectedCurrentMember, selectedOtherFamily, selectedOtherMember);
      onOpenChange(false);
      setSelectedCurrentMember("");
      setSelectedOtherFamily("");
      setSelectedOtherMember("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Families Through Marriage</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select member from current family</Label>
            <Select value={selectedCurrentMember} onValueChange={setSelectedCurrentMember}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a family member" />
              </SelectTrigger>
              <SelectContent>
                {currentFamilyMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Select other family</Label>
            <Select value={selectedOtherFamily} onValueChange={setSelectedOtherFamily}>
              <SelectTrigger>
                <SelectValue placeholder="Choose another family" />
              </SelectTrigger>
              <SelectContent>
                {otherFamilies.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFamily && (
            <div>
              <Label>Select member from other family</Label>
              <Select value={selectedOtherMember} onValueChange={setSelectedOtherMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a family member" />
                </SelectTrigger>
                <SelectContent>
                  {selectedFamily.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLink} 
              disabled={!selectedCurrentMember || !selectedOtherFamily || !selectedOtherMember}
            >
              Link Families
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}