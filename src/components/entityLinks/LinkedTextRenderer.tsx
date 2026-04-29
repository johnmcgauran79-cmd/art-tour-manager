import { Link as RouterLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BedDouble, Briefcase, MapPin, User, Activity as ActivityIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseEntityLinks,
  entityLinkHref,
  ENTITY_LABELS,
  type EntityType,
} from "@/lib/entityLinks";
import { useEntityResolver } from "@/hooks/useEntityResolver";
import { useMemo } from "react";

interface LinkedTextRendererProps {
  text: string | null | undefined;
  className?: string;
}

// Match http(s) URLs and bare www. URLs. Trailing punctuation is trimmed below.
const URL_REGEX = /(\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+)/gi;

/**
 * Render a plain-text segment, converting URLs into clickable links.
 * Preserves whitespace and is safe to nest inside the entity-link renderer.
 */
const renderTextWithLinks = (text: string, keyPrefix: string): React.ReactNode => {
  if (!text) return text;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  const re = new RegExp(URL_REGEX.source, URL_REGEX.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let url = m[0];
    let trailing = "";
    // Strip common trailing punctuation that is rarely part of the URL.
    const trailingMatch = url.match(/[).,;:!?'"]+$/);
    if (trailingMatch) {
      trailing = trailingMatch[0];
      url = url.slice(0, -trailing.length);
    }
    const start = m.index;
    const end = start + url.length;
    if (start > last) {
      nodes.push(
        <span key={`${keyPrefix}-t-${i}`} className="whitespace-pre-wrap">
          {text.slice(last, start)}
        </span>
      );
    }
    const href = url.startsWith("http") ? url : `https://${url}`;
    nodes.push(
      <a
        key={`${keyPrefix}-u-${i}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
      >
        {url}
      </a>
    );
    last = end;
    i++;
  }
  if (last < text.length) {
    nodes.push(
      <span key={`${keyPrefix}-t-end`} className="whitespace-pre-wrap">
        {text.slice(last)}
      </span>
    );
  }
  return nodes.length > 0 ? nodes : text;
};

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

const Chip = ({
  type,
  label,
  id,
  deleted,
  tourId,
  loading,
}: {
  type: EntityType;
  label: string;
  id: string;
  deleted?: boolean;
  tourId?: string | null;
  loading?: boolean;
}) => {
  const Icon = deleted ? AlertCircle : entityIcon[type];
  const href = deleted ? null : entityLinkHref(type, id, tourId);
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium align-baseline",
        deleted
          ? "bg-muted text-muted-foreground line-through opacity-70"
          : entityChipClass[type],
        href && "cursor-pointer",
        loading && "opacity-70"
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
          {deleted
            ? `${ENTITY_LABELS[type]} removed — record no longer exists`
            : `${ENTITY_LABELS[type]}: ${label}`}
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
  const links = useMemo(() => parseEntityLinks(text), [text]);
  const refs = useMemo(
    () => links.map((l) => ({ entity_type: l.type, entity_id: l.id })),
    [links]
  );
  const { data: resolved, isLoading } = useEntityResolver(refs);

  if (!text) return null;
  if (links.length === 0) {
    return <span className={className}>{renderTextWithLinks(text, "only")}</span>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  links.forEach((l, i) => {
    if (l.start > cursor) {
      parts.push(
        <span key={`t-${i}`}>
          {renderTextWithLinks(text.slice(cursor, l.start), `pre-${i}`)}
        </span>
      );
    }
    const r = resolved?.[`${l.type}:${l.id}`];
    parts.push(
      <Chip
        key={`c-${i}`}
        type={l.type}
        id={l.id}
        // Prefer the live label; fall back to the stored label so chips
        // still read sensibly while resolving / for deleted entities.
        label={r && !r.deleted ? r.label : l.label}
        deleted={r?.deleted}
        tourId={r?.tourId}
        loading={isLoading && !r}
      />
    );
    cursor = l.end;
  });
  if (cursor < text.length) {
    parts.push(
      <span key="t-end">
        {renderTextWithLinks(text.slice(cursor), "end")}
      </span>
    );
  }
  return <span className={className}>{parts}</span>;
};