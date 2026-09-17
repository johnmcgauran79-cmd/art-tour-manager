import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useAddTaskEntityLink,
  useRemoveTaskEntityLink,
  useTaskEntityLinks,
  type TaskEntityLinkRow,
} from "@/hooks/useTaskEntityLinks";
import { ENTITY_LABELS, entityLinkHref, type EntityType } from "@/lib/entityLinks";
import { useEntityResolver } from "@/hooks/useEntityResolver";
import {
  Briefcase,
  BedDouble,
  MapPin,
  User,
  Activity as ActivityIcon,
  Link2,
  AlertCircle,
  FileText,
  MessageSquare,
  Megaphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityLinkPicker } from "./EntityLinkPicker";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const entityIcon: Record<EntityType, typeof Briefcase> = {
  booking: Briefcase,
  hotel: BedDouble,
  activity: ActivityIcon,
  tour: MapPin,
  contact: User,
  lead: User,
  campaign: Megaphone,
};

/**
 * Fetch comment author + creation date for any links sourced from a comment,
 * so we can show "from comment by Sarah · 12 Mar" subtitles.
 */
const useCommentSources = (links: TaskEntityLinkRow[]) => {
  const commentIds = useMemo(
    () =>
      Array.from(
        new Set(
          links
            .filter((l) => l.source === "comment" && l.source_id)
            .map((l) => l.source_id as string)
        )
      ),
    [links]
  );

  return useQuery({
    queryKey: ["task-link-comment-sources", [...commentIds].sort().join(",")],
    queryFn: async () => {
      if (commentIds.length === 0) return {} as Record<string, { author: string; createdAt: string }>;
      const { data: comments } = await supabase
        .from("task_comments")
        .select("id, created_at, user_id")
        .in("id", commentIds);
      const userIds = Array.from(
        new Set((comments || []).map((c: any) => c.user_id).filter(Boolean))
      );
      const profilesById: Record<string, { first_name?: string; last_name?: string; email?: string }> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds);
        (profiles || []).forEach((p: any) => {
          profilesById[p.id] = p;
        });
      }
      const map: Record<string, { author: string; createdAt: string }> = {};
      (comments || []).forEach((c: any) => {
        const p = profilesById[c.user_id];
        const name =
          p && (p.first_name || p.last_name)
            ? `${p.first_name || ""} ${p.last_name || ""}`.trim()
            : p?.email || "Unknown";
        map[c.id] = { author: name, createdAt: c.created_at };
      });
      return map;
    },
    enabled: commentIds.length > 0,
    staleTime: 60_000,
  });
};

interface TaskLinkedItemsPanelProps {
  taskId: string;
}

export const TaskLinkedItemsPanel = ({ taskId }: TaskLinkedItemsPanelProps) => {
  const { data: links = [], isLoading } = useTaskEntityLinks(taskId);
  const addLink = useAddTaskEntityLink();
  const removeLink = useRemoveTaskEntityLink();
  const { toast } = useToast();

  const handlePick = async (picked: { type: EntityType; id: string; label: string }) => {
    try {
      await addLink.mutateAsync({
        taskId,
        entityType: picked.type,
        entityId: picked.id,
      });
      toast({ title: "Linked", description: `${picked.label} is now linked to this task.` });
    } catch (e: any) {
      toast({
        title: "Could not link that record",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (id: string, label: string) => {
    try {
      await removeLink.mutateAsync({ id, taskId });
      toast({ title: "Link removed", description: `${label} is no longer linked.` });
    } catch (e: any) {
      toast({
        title: "Could not remove the link",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };
  const refs = useMemo(
    () =>
      links.map((l) => ({
        entity_type: l.entity_type,
        entity_id: l.entity_id,
      })),
    [links]
  );
  const { data: resolved = {}, isLoading: loadingLabels } = useEntityResolver(refs);
  const { data: commentSources = {} } = useCommentSources(links);

  // Group all source occurrences by entity so we can list each linked record
  // once but still show every place it was referenced from.
  type Grouped = {
    entity_type: EntityType;
    entity_id: string;
    sources: TaskEntityLinkRow[];
  };
  const unique = useMemo<Grouped[]>(() => {
    const map = new Map<string, Grouped>();
    links.forEach((l) => {
      const k = `${l.entity_type}:${l.entity_id}`;
      const existing = map.get(k);
      if (existing) {
        existing.sources.push(l);
      } else {
        map.set(k, {
          entity_type: l.entity_type,
          entity_id: l.entity_id,
          sources: [l],
        });
      }
    });
    return [...map.values()];
  }, [links]);

  const grouped = useMemo(() => {
    const map = new Map<EntityType, Grouped[]>();
    unique.forEach((l) => {
      const arr = map.get(l.entity_type) || [];
      arr.push(l);
      map.set(l.entity_type, arr);
    });
    return map;
  }, [unique]);

  if (isLoading) {
    return <Skeleton className="h-12 w-full" />;
  }

  const order: EntityType[] = [
    "booking",
    "tour",
    "hotel",
    "activity",
    "contact",
    "lead",
    "campaign",
  ];

  const picker = (
    <EntityLinkPicker
      triggerLabel="Add link"
      variant="outline"
      size="sm"
      onPickEntity={handlePick}
    />
  );

  if (unique.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs italic text-muted-foreground">
          Nothing linked yet — search for a tour, booking, hotel, activity, contact, enquiry or
          email campaign and it will appear here as a clickable link.
        </p>
        {picker}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {order.map((type) => {
        const items = grouped.get(type);
        if (!items || items.length === 0) return null;
        const Icon = entityIcon[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              <Icon className="h-3.5 w-3.5" />
              {ENTITY_LABELS[type]}s ({items.length})
            </div>
            <ul className="space-y-1.5">
              {items.map((g) => {
                const r = resolved[`${type}:${g.entity_id}`];
                const deleted = !!r?.deleted;
                const label = !r
                  ? loadingLabels
                    ? "…"
                    : "(unknown)"
                  : r.label || "(untitled)";
                const href = deleted
                  ? null
                  : entityLinkHref(type, g.entity_id, r?.tourId);

                const ChipIcon = deleted ? AlertCircle : Link2;
                const chip = (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs",
                      deleted
                        ? "bg-muted text-muted-foreground line-through opacity-70 border-dashed"
                        : "bg-muted/50 hover:bg-muted",
                      href && "cursor-pointer"
                    )}
                  >
                    <ChipIcon className="h-3 w-3" />
                    {label}
                  </span>
                );

                const chipNode = deleted ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{chip}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span className="text-xs">
                        {ENTITY_LABELS[type]} removed — record no longer exists
                      </span>
                    </TooltipContent>
                  </Tooltip>
                ) : href ? (
                  <RouterLink to={href}>{chip}</RouterLink>
                ) : (
                  <span>{chip}</span>
                );

                const manual = g.sources.filter((s) => s.source === "manual");

                return (
                  <li key={`${type}:${g.entity_id}`} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      {chipNode}
                      {manual.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-destructive"
                          title="Remove this link"
                          onClick={() => handleRemove(manual[0].id, label)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground pl-1">
                      {g.sources.map((s) => {
                        if (s.source === "manual") {
                          return (
                            <span key={s.id} className="inline-flex items-center gap-1">
                              <Link2 className="h-2.5 w-2.5" />
                              added to this task
                            </span>
                          );
                        }
                        if (s.source === "description") {
                          return (
                            <span key={s.id} className="inline-flex items-center gap-1">
                              <FileText className="h-2.5 w-2.5" />
                              from description
                            </span>
                          );
                        }
                        const meta = s.source_id ? commentSources[s.source_id] : undefined;
                        return (
                          <span key={s.id} className="inline-flex items-center gap-1">
                            <MessageSquare className="h-2.5 w-2.5" />
                            from comment
                            {meta?.author ? ` by ${meta.author}` : ""}
                            {meta?.createdAt
                              ? ` · ${format(new Date(meta.createdAt), "d MMM yyyy")}`
                              : ""}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {picker}
    </div>
  );
};