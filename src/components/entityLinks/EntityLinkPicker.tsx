import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Link2, Loader2 } from "lucide-react";
import { buildEntityToken, type EntityType } from "@/lib/entityLinks";
import { cn } from "@/lib/utils";
import { useEntitySearch, type EntitySearchResult } from "./useEntitySearch";

interface EntityLinkPickerProps {
  /** Called with the token to insert at the current cursor position. */
  onInsert: (token: string) => void;
  /** Optional label for the trigger button. Defaults to "Link". */
  triggerLabel?: string;
  /** Trigger button size. */
  size?: "sm" | "icon" | "default";
  /** Visual variant for the trigger button. */
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}

type SearchResult = EntitySearchResult;

const SearchPanel = ({
  type,
  onPick,
}: {
  type: EntityType;
  onPick: (r: SearchResult) => void;
}) => {
  const [q, setQ] = useState("");
  const { data, isLoading } = useEntitySearch(type, q);
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${type}s...`}
        className="h-8"
      />
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!isLoading && (data || []).length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">No matches</p>
        )}
        {(data || []).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-sm"
          >
            <div className="font-medium truncate">{r.label}</div>
            {r.sublabel && (
              <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const EntityLinkPicker = ({
  onInsert,
  triggerLabel = "Link",
  size = "sm",
  variant = "outline",
  className,
}: EntityLinkPickerProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<EntityType>("booking");

  const handlePick = (type: EntityType, r: SearchResult) => {
    onInsert(buildEntityToken(type, r.id, r.label));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={cn("gap-1.5", className)}
        >
          <Link2 className="h-3.5 w-3.5" />
          {size !== "icon" && <span>{triggerLabel}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EntityType)}>
          <TabsList className="grid grid-cols-5 h-8 mb-2">
            <TabsTrigger value="booking" className="text-xs px-1">Booking</TabsTrigger>
            <TabsTrigger value="hotel" className="text-xs px-1">Hotel</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs px-1">Activity</TabsTrigger>
            <TabsTrigger value="tour" className="text-xs px-1">Tour</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs px-1">Contact</TabsTrigger>
          </TabsList>
          {(["booking", "hotel", "activity", "tour", "contact"] as EntityType[]).map((t) => (
            <TabsContent key={t} value={t} className="mt-0">
              <SearchPanel type={t} onPick={(r) => handlePick(t, r)} />
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};