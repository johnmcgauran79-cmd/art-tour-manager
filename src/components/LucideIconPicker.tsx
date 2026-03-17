import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { icons } from "lucide-react";

// Curated subset of commonly useful icons for additional info sections
const CURATED_ICONS = [
  'info', 'file-text', 'plane', 'passport', 'shirt', 'map-pin', 'clock', 'phone',
  'mail', 'globe', 'shield', 'heart', 'star', 'camera', 'sun', 'cloud',
  'umbrella', 'car', 'bus', 'train', 'ship', 'utensils', 'coffee', 'wine',
  'bed', 'building', 'mountain', 'tree-pine', 'waves', 'thermometer',
  'stethoscope', 'pill', 'syringe', 'alert-triangle', 'check-circle', 'x-circle',
  'calendar', 'map', 'compass', 'flag', 'bookmark', 'tag', 'gift',
  'credit-card', 'banknote', 'receipt', 'ticket', 'key', 'lock', 'unlock',
  'wifi', 'battery', 'plug', 'luggage', 'backpack', 'briefcase',
  'eye', 'ear', 'hand-metal', 'footprints', 'accessibility',
  'languages', 'book-open', 'notebook-pen', 'clipboard-list',
];

interface LucideIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export const LucideIconPicker = ({ value, onChange }: LucideIconPickerProps) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredIcons = search
    ? Object.keys(icons).filter(name => name.toLowerCase().includes(search.toLowerCase())).slice(0, 60)
    : CURATED_ICONS;

  const renderIcon = (name: string, size = 20) => {
    const pascalCase = name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
    const IconComponent = (icons as any)[pascalCase];
    if (!IconComponent) return null;
    return <IconComponent size={size} />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          {renderIcon(value, 16)}
          <span className="text-xs text-muted-foreground">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
        />
        <ScrollArea className="h-48">
          <div className="grid grid-cols-6 gap-1">
            {filteredIcons.map((name) => {
              const icon = renderIcon(name, 18);
              if (!icon) return null;
              return (
                <Button
                  key={name}
                  variant={value === name ? "default" : "ghost"}
                  size="sm"
                  className="h-9 w-9 p-0"
                  title={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                >
                  {icon}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export const renderLucideIcon = (name: string, size = 20, className?: string) => {
  const pascalCase = name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
  const IconComponent = (icons as any)[pascalCase];
  if (!IconComponent) {
    const FallbackIcon = (icons as any)['Info'];
    return <FallbackIcon size={size} className={className} />;
  }
  return <IconComponent size={size} className={className} />;
};
