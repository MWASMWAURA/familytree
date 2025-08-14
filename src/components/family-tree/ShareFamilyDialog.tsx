import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Share2 } from "lucide-react";
import { generateShareableLink, copyToClipboard } from "@/lib/share-utils";
import { FamilyTreeData } from "@/types";

interface ShareFamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  familyName: string;
  familyData: FamilyTreeData;
}

export function ShareFamilyDialog({
  open,
  onOpenChange,
  familyId,
  familyName,
  familyData,
}: ShareFamilyDialogProps) {
  const [shareLink, setShareLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateLink = () => {
    setIsGenerating(true);
    try {
      const link = generateShareableLink(familyId, familyName, familyData);
      setShareLink(link);
    } catch (error) {
      console.error('Failed to generate shareable link:', error);
      alert('Failed to generate shareable link. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link. Please try again.');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShareLink("");
      setCopied(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Family Tree
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Family Name</Label>
            <p className="text-lg font-semibold text-green-700">{familyName}</p>
          </div>
          
          {!shareLink ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Generate a shareable link that allows others to view this family tree.
              </p>
              <Button 
                onClick={handleGenerateLink} 
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isGenerating ? "Generating..." : "Generate Shareable Link"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="share-link">Shareable Link</Label>
              <div className="flex gap-2">
                <Input
                  id="share-link"
                  value={shareLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {copied && (
                <p className="text-sm text-green-600">Link copied to clipboard!</p>
              )}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  <strong>Note:</strong> This link will work as long as the data remains in your browser's storage. 
                  For permanent sharing, consider exporting the family tree data.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}