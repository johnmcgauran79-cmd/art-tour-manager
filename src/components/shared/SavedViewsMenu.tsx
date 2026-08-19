import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { SavedView } from "@/hooks/useSavedViews";

interface SavedViewsMenuProps<T extends Record<string, unknown>> {
  views: SavedView<T>[];
  currentFilters: T;
  onApply: (filters: T) => void;
  onSave: (name: string, filters: T) => void;
  onDelete: (id: string) => void;
}

export function SavedViewsMenu<T extends Record<string, unknown>>({
  views,
  currentFilters,
  onApply,
  onSave,
  onDelete,
}: SavedViewsMenuProps<T>) {
  const [name, setName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name, currentFilters);
    setName("");
    setSaveOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm">
            <Bookmark className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Views{views.length > 0 ? ` (${views.length})` : ""}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {views.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No saved views yet. Set your filters, then save them.
            </div>
          )}
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onSelect={() => onApply(view.filters)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{view.name}</span>
              <button
                type="button"
                aria-label={`Delete view ${view.name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(view.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Save current view">
            <BookmarkPlus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 bg-popover space-y-2">
          <p className="text-sm font-medium">Save current view</p>
          <Input
            placeholder="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" className="w-full" onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}