import { Link as RouterLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BedDouble, Briefcase, MapPin, User, Activity as ActivityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseEntityLinks,
  entityLinkHref,
  ENTITY_LABELS,
  type EntityType,
} from "@/lib/entityLinks";

interface LinkedTextRendererProps {
  text: string | null | undefined;
  className?: string;
}

const entityIcon: Record<EntityType, typeof Briefcase> = {
  booking: Briefcase,
  hotel: BedDouble,
  activity: ActivityIcon,
  tour: MapPin,
  contact: User,
};

const entityChipClass: Record<EntityType, string> = {
  booking: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200",
  hotel: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  activity: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
  tour: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
  contact: "bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/40 dark:text-pink-200",
};

const Chip = ({ type, label, id }: { type: EntityType; label: string; id: string }) => {
  const Icon = entityIcon[type];
  const href = entityLinkHref(type, id);
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium align-baseline",
        entityChipClass[type],
        href && "cursor-pointer"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
  const wrapped = href ? (
    <RouterLink to={href} onClick={(e) => e.stopPropagation()}>
      {inner}
    </RouterLink>
  ) : (
    inner
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{wrapped}</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-xs">
          {ENTITY_LABELS[type]}: {label}
        </span>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Render text with `[[type:id|label]]` tokens replaced by inline entity chips.
 * Plain text segments preserve whitespace.
 */
export const LinkedTextRenderer = ({ text, className }: LinkedTextRendererProps) => {
  if (!text) return null;
  const links = parseEntityLinks(text);
  if (links.length === 0) {
    return <span className={cn("whitespace-pre-wrap", className)}>{text}</span>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  links.forEach((l, i) => {
    if (l.start > cursor) {
      parts.push(
        <span key={`t-${i}`} className="whitespace-pre-wrap">
          {text.slice(cursor, l.start)}
        </span>
      );
    }
    parts.push(<Chip key={`c-${i}`} type={l.type} id={l.id} label={l.label} />);
    cursor = l.end;
  });
  if (cursor < text.length) {
    parts.push(
      <span key="t-end" className="whitespace-pre-wrap">
        {text.slice(cursor)}
      </span>
    );
  }
  return <span className={className}>{parts}</span>;
};