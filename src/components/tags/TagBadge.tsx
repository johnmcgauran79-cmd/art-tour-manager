import { X } from "lucide-react";
import type { Tag } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

interface Props {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
}

/**
 * Coloured tag chip. The colour is stored per-tag as a hex value so users can
 * pick their own palette, so inline style is intentional here.
 */
export const TagBadge = ({ tag, onRemove, className }: Props) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
      className
    )}
    style={{
      backgroundColor: `${tag.color}1a`,
      borderColor: `${tag.color}66`,
      color: tag.color,
    }}
  >
    {tag.name}
    {onRemove && (
      <button
        type="button"
        aria-label={`Remove ${tag.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-70 hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </span>
);
