import {
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  MousePointerClick,
  Quote,
  Rows3,
  Share2,
  Ticket,
  Type,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { blockLabel, type EdmBlockType } from "@/lib/edm/blocks";

const PALETTE: EdmBlockType[] = [
  "heading",
  "text",
  "image",
  "imageText",
  "button",
  "divider",
  "spacer",
  "quote",
  "social",
  "tourCard",
  "columns",
  "table",
];

const iconFor = (type: EdmBlockType) => {
  switch (type) {
    case "heading":
      return Heading;
    case "text":
      return Type;
    case "image":
    case "imageText":
      return ImageIcon;
    case "button":
      return MousePointerClick;
    case "divider":
      return Minus;
    case "spacer":
      return Rows3;
    case "quote":
      return Quote;
    case "social":
      return Share2;
    case "tourCard":
      return Ticket;
    default:
      return LayoutGrid;
  }
};

/**
 * Content palette: drag a tile onto the email, or click it and then click where
 * it should go.
 */
export function EdmPalette({
  pendingType,
  onPick,
  onDragStart,
  onDragEnd,
}: {
  pendingType: EdmBlockType | null;
  onPick: (type: EdmBlockType) => void;
  onDragStart: (type: EdmBlockType) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Drag a tile onto the email, or click it then click where it should go.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PALETTE.map((type) => {
          const Icon = iconFor(type);
          const active = pendingType === type;
          return (
            <button
              key={type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/edm-block", type);
                e.dataTransfer.effectAllowed = "copy";
                onDragStart(type);
              }}
              onDragEnd={onDragEnd}
              onClick={() => onPick(type)}
              aria-pressed={active}
              className={cn(
                "flex cursor-grab flex-col items-center gap-1.5 rounded-md border bg-background px-2 py-3 text-[11px] font-medium transition hover:border-primary hover:bg-accent active:cursor-grabbing",
                active && "border-primary bg-primary/5 text-primary"
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {blockLabel[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
