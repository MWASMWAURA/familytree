import { FamilyMember } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Handle, Position } from "reactflow";
import { getInitials } from "@/lib/utils";
import { Theme } from "./ThemeSelector";

interface FamilyMemberNodeProps {
  data: FamilyMember & { theme?: Theme };
  isConnectable: boolean;
  selected?: boolean;
}

export default function FamilyMemberNode({ data, isConnectable, selected }: FamilyMemberNodeProps) {
  const getFallbackColor = () => {
    const theme = data.theme || 'default';
    switch (data.gender) {
      case 'male':
        return theme === 'forest' ? 'bg-green-100' : theme === 'sunset' ? 'bg-orange-100' : 'bg-blue-100';
      case 'female':
        return theme === 'forest' ? 'bg-green-200' : theme === 'sunset' ? 'bg-orange-200' : 'bg-pink-100';
      default:
        return 'bg-gray-100';
    }
  };

  // Force same border width, size, and layout for all themes. Only color changes.
  const getCardTheme = () => {
    const theme = data.theme || 'default';
    const base = 'border-2 w-48 h-48 min-h-48 shadow-md'; // fixed width and height, no transition
    switch (theme) {
      case 'forest':
        return `${base} border-green-300 bg-green-50`;
      case 'sunset':
        return `${base} border-orange-300 bg-orange-50`;
      default:
        return `${base} border-blue-300 bg-blue-50`;
    }
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 border-2"
      />
      <Card className={`w-48 h-auto shadow-md transition-all ${getCardTheme()} ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="p-3 flex flex-col items-center">
          <div className="mb-2 mt-1">
            <Avatar className="w-16 h-16">
              {data.imageUrl ? (
                <AvatarImage src={data.imageUrl} alt={data.name} />
              ) : null}
              <AvatarFallback className={`text-lg ${getFallbackColor()}`}>
                {getInitials(data.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">{data.name}</h3>
            {data.dob && <p className="text-sm text-muted-foreground">{data.dob}</p>}
            {data.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 border-2"
      />
    </div>
  );
}