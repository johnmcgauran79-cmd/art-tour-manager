import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

interface ViewToggleProps {
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
}

export const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center gap-1 border rounded-lg p-1">
      <Button
        variant={view === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('grid')}
        className="px-3"
      >
        <LayoutGrid className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline">Grid</span>
      </Button>
      <Button
        variant={view === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('table')}
        className="px-3"
      >
        <List className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline">Table</span>
      </Button>
    </div>
  );
};
