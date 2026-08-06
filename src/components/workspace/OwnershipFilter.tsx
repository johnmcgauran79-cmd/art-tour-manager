import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OwnershipFilterValue = "all" | "mine" | "shared_by_me" | "shared_with_me";

const OPTIONS: { value: OwnershipFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Only mine" },
  { value: "shared_by_me", label: "Shared by me" },
  { value: "shared_with_me", label: "Shared with me" },
];

interface OwnershipFilterProps {
  value: OwnershipFilterValue;
  onChange: (value: OwnershipFilterValue) => void;
  counts?: Partial<Record<OwnershipFilterValue, number>>;
  className?: string;
}

/** Shared "Only mine / Shared by me / Shared with me" filter for To-Dos and Notes. */
export const OwnershipFilter = ({ value, onChange, counts, className }: OwnershipFilterProps) => (
  <div className={cn("flex flex-wrap gap-1", className)}>
    {OPTIONS.map((opt) => (
      <Button
        key={opt.value}
        size="sm"
        variant={value === opt.value ? "secondary" : "ghost"}
        onClick={() => onChange(opt.value)}
        className="h-8 px-2.5 text-xs"
      >
        {opt.label}
        {counts?.[opt.value] !== undefined && (
          <span className="ml-1.5 text-muted-foreground">{counts[opt.value]}</span>
        )}
      </Button>
    ))}
  </div>
);

/**
 * Bucket an item by ownership: mine (unshared), shared by me, or shared with me.
 */
export const matchesOwnershipFilter = (
  filter: OwnershipFilterValue,
  ownerId: string,
  currentUserId: string | undefined,
  shareCount: number
) => {
  const isMine = ownerId === currentUserId;
  switch (filter) {
    case "mine":
      return isMine && shareCount === 0;
    case "shared_by_me":
      return isMine && shareCount > 0;
    case "shared_with_me":
      return !isMine;
    default:
      return true;
  }
};