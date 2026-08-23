import { useMemo, useState } from "react";
import { Plus, Tag as TagIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCreateTag,
  useEntityTags,
  useTags,
  useToggleEntityTag,
  type TagEntity,
} from "@/hooks/useTags";
import { TagBadge } from "./TagBadge";

interface Props {
  entity: TagEntity;
  entityId: string;
  /** Hide the add button (view-only users). */
  readOnly?: boolean;
  emptyLabel?: string;
}

/**
 * Inline tag manager for a contact or booking. Shows applied tags as chips and
 * lets staff search, toggle, or create a tag on the fly.
 */
export const TagPicker = ({ entity, entityId, readOnly, emptyLabel = "No tags yet" }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allTags } = useTags();
  const { data: applied } = useEntityTags(entity, entityId);
  const toggle = useToggleEntityTag(entity);
  const createTag = useCreateTag();

  const appliedIds = useMemo(() => new Set((applied || []).map((t) => t.id)), [applied]);
  const term = search.trim().toLowerCase();
  const results = (allTags || []).filter((t) => t.name.toLowerCase().includes(term));
  const canCreate =
    !!term && !(allTags || []).some((t) => t.name.trim().toLowerCase() === term);

  const handleCreate = async () => {
    const tag = await createTag.mutateAsync({ name: search.trim() });
    await toggle.mutateAsync({ entityId, tagId: tag.id, attach: true });
    setSearch("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(applied || []).map((tag) => (
        <TagBadge
          key={tag.id}
          tag={tag}
          onRemove={
            readOnly
              ? undefined
              : () => toggle.mutate({ entityId, tagId: tag.id, attach: false })
          }
        />
      ))}

      {!applied?.length && (
        <span className="text-sm text-muted-foreground">{emptyLabel}</span>
      )}

      {!readOnly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
              <Plus className="h-3 w-3" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or create a tag..."
              className="mb-2 h-8"
            />
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {results.map((tag) => {
                  const on = appliedIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        toggle.mutate({ entityId, tagId: tag.id, attach: !on })
                      }
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <TagIcon className="h-3.5 w-3.5" style={{ color: tag.color }} />
                        <span className="truncate">{tag.name}</span>
                        {tag.category && (
                          <span className="text-xs text-muted-foreground">
                            {tag.category}
                          </span>
                        )}
                      </span>
                      {on && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
                {!results.length && !canCreate && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">No tags found</p>
                )}
              </div>
            </ScrollArea>
            {canCreate && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full justify-start gap-2"
                disabled={createTag.isPending}
                onClick={handleCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                Create "{search.trim()}"
              </Button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
