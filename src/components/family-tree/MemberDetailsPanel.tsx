import { useState, useMemo, useCallback, useEffect } from "react";
import { FamilyMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Trash2, X, Edit, Calendar, FileText } from "lucide-react";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface MemberDetailsPanelProps {
  member: FamilyMember;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

export default function MemberDetailsPanel({
  member,
  onClose,
  onDelete,
  onEdit,
}: MemberDetailsPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const fallbackColor = useMemo(() => {
    switch (member.gender) {
      case "male": return "bg-blue-100";
      case "female": return "bg-pink-100";
      default: return "bg-gray-100";
    }
  }, [member.gender]);

  const hasOptionalInfo = useMemo(() => member.dob || member.notes, [member]);

  const handleDelete = useCallback(() => {
    if (isDeleting) {
      onDelete(member.id);
      onClose();
    } else {
      setIsDeleting(true);
    }
  }, [isDeleting, onDelete, onClose, member.id]);

  const handleEdit = useCallback(() => {
    if (onEdit) onEdit(member.id);
  }, [onEdit, member.id]);

  return (
    <Card
      className={cn(
        "shadow-lg border-l-4 border-l-primary relative",
        isMobile ? "w-full max-w-none rounded-lg" : "w-full max-w-sm"
      )}
    >
      <CardHeader className={cn("relative", isMobile ? "pb-3" : "pb-2")}>    
        <Button
          variant="ghost"
          size="icon"
          className={cn("absolute right-2 top-2", isMobile && "h-8 w-8")}
          aria-label="Close member details"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className={cn("flex items-center gap-4", isMobile && "flex-col sm:flex-row text-center sm:text-left")}>   
          <Avatar className={isMobile ? "w-20 h-20" : "w-16 h-16"}>
            {member.imageUrl ? (
              <AvatarImage src={member.imageUrl} alt={member.name} />
            ) : null}
            <AvatarFallback className={`text-lg ${fallbackColor}`}>
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className={cn("flex-1 min-w-0", isMobile && "w-full")}>   
            <CardTitle className={isMobile ? "text-xl mb-2" : "text-xl"}>{member.name}</CardTitle>
            {member.gender && (
              <Badge variant="outline" className="mt-1">
                {member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {hasOptionalInfo && (
        <CardContent className={cn(isMobile ? "pb-3" : "pb-2")}>    
          {member.dob && (
            <div className={cn("mb-3", isMobile && "text-center sm:text-left")}>   
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
              </div>
              <p className={cn(isMobile ? "text-base" : "text-sm", "font-medium")}>{member.dob}</p>
            </div>
          )}
          {member.dob && member.notes && <Separator className="my-3" />}
          {member.notes && (
            <div className={cn(isMobile && "text-center sm:text-left")}>  
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
              </div>
              <p className={cn(isMobile ? "text-sm leading-relaxed" : "text-sm", "text-muted-foreground")}>{member.notes}</p>
            </div>
          )}
        </CardContent>
      )}
      <CardFooter className={cn(
        "pt-2 gap-2",
        isMobile ? "flex-col space-y-2" : "flex-row justify-between"
      )}>
        {onEdit && (
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            aria-label="Edit member"
            onClick={handleEdit}
            className={cn("flex items-center gap-2", isMobile && "w-full justify-center")}
          >
            <Edit className="h-4 w-4" />Edit Member
          </Button>
        )}
        <Button
          variant={isDeleting ? "destructive" : "outline"}
          size={isMobile ? "default" : "sm"}
          aria-label={isDeleting ? `Confirm delete ${member.name}` : `Delete ${member.name}`}
          onClick={handleDelete}
          className={cn("flex items-center gap-2", isMobile && "w-full justify-center", !onEdit && !isMobile && "ml-auto")}
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Confirm Delete" : "Delete Member"}
        </Button>
      </CardFooter>
      {/* Mobile-specific confirmation overlay */}
      {isDeleting && isMobile && (
        <div className="absolute inset-0 bg-red-50/90 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg border border-red-200 mx-4 text-center">
            <p className="text-sm text-red-800 mb-3">
              Are you sure you want to delete {member.name}?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleting(false)}
                className="flex-1"
                aria-label="Cancel delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(member.id)}
                className="flex-1"
                aria-label={`Delete ${member.name}`}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
