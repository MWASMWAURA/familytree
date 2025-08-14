import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette } from "lucide-react";

export type Theme = 'default' | 'forest' | 'sunset';

interface ThemeSelectorProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Palette className="h-4 w-4 text-muted-foreground" />
      <Select value={currentTheme} onValueChange={(value: Theme) => onThemeChange(value)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          <SelectItem value="forest">🌿 Forest</SelectItem>
          <SelectItem value="sunset">🌅 Sunset</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export const themeConfig = {
  default: {
    background: '#f8fafc',
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#06b6d4',
    nodeBackground: '#ffffff',
    nodeBorder: '#e2e8f0',
  },
  forest: {
    background: 'linear-gradient(135deg, #e8f5e8 0%, #f0fdf4 100%)',
    primary: '#16a34a',
    secondary: '#15803d',
    accent: '#22c55e',
    nodeBackground: '#f7fef7',
    nodeBorder: '#86efac',
  },
  sunset: {
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    primary: '#ea580c',
    secondary: '#c2410c',
    accent: '#fb923c',
    nodeBackground: '#fffbf5',
    nodeBorder: '#fdba74',
  },
};