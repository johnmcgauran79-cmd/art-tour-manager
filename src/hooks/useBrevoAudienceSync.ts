import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface BrevoList {
  id: number;
  name: string;
  folderId: number | null;
  subscribers: number;
  tagId: string | null;
  tagName: string | null;
}

export interface SyncTotals {
  lists: number;
  processed: number;
  matched: number;
  unmatched: number;
  tagged: number;
  statesFilled: number;
  consentOff: number;
  linked: number;
  unmatchedSample: string[];
  perList: Array<{ name: string; matched: number; unmatched: number }>;
}

const emptyTotals = (): SyncTotals => ({
  lists: 0,
  processed: 0,
  matched: 0,
  unmatched: 0,
  tagged: 0,
  statesFilled: 0,
  consentOff: 0,
  linked: 0,
  unmatchedSample: [],
  perList: [],
});

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("brevo-sync", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.text().catch(() => "");
      if (details) {
        try {
          const parsed = JSON.parse(details);
          throw new Error(parsed?.error ?? parsed?.message ?? details);
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message !== details) throw parseError;
          throw new Error(details);
        }
      }
    }
    throw new Error(error.message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

/** Brevo lists available to import as ART tags. */
export const useBrevoLists = (enabled = true) =>
  useQuery({
    queryKey: ["brevo-audience-lists"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BrevoList[]> => {
      const data = await invoke({ action: "audience_lists" });
      return (data?.lists ?? []) as BrevoList[];
    },
  });

/**
 * Runs the list-by-list sync. `apply: false` previews (writes nothing),
 * `apply: true` creates tags and updates contacts.
 */
export const useBrevoAudienceSync = () => {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>({
    done: 0,
    total: 0,
    label: "",
  });
  const [preview, setPreview] = useState<SyncTotals | null>(null);
  const [applied, setApplied] = useState<SyncTotals | null>(null);

  const run = useCallback(
    async (lists: BrevoList[], apply: boolean) => {
      if (!lists.length) {
        toast({ title: "Select at least one list", variant: "destructive" });
        return;
      }
      setRunning(true);
      setProgress({ done: 0, total: lists.length, label: lists[0].name });
      const totals = emptyTotals();
      try {
        for (let i = 0; i < lists.length; i += 1) {
          const list = lists[i];
          setProgress({ done: i, total: lists.length, label: list.name });
          let offset = 0;
          for (;;) {
            const res = await invoke({
              action: "audience_sync_list",
              listId: list.id,
              listName: list.name,
              offset,
              limit: 50,
              apply,
            });
            totals.processed += res.processed ?? 0;
            totals.matched += res.matched ?? 0;
            totals.unmatched += res.unmatched ?? 0;
            totals.tagged += res.tagged ?? 0;
            totals.statesFilled += res.statesFilled ?? 0;
            totals.consentOff += res.consentOff ?? 0;
            totals.linked += res.linked ?? 0;
            for (const e of res.unmatchedSample ?? []) {
              if (totals.unmatchedSample.length < 100 && !totals.unmatchedSample.includes(e))
                totals.unmatchedSample.push(e);
            }
            const row = totals.perList.find((r) => r.name === list.name);
            if (row) {
              row.matched += res.matched ?? 0;
              row.unmatched += res.unmatched ?? 0;
            } else {
              totals.perList.push({
                name: list.name,
                matched: res.matched ?? 0,
                unmatched: res.unmatched ?? 0,
              });
            }
            if (!res.hasMore) break;
            offset = res.nextOffset;
          }
          totals.lists += 1;
        }
        setProgress({ done: lists.length, total: lists.length, label: "Finished" });
        if (apply) {
          setApplied({ ...totals });
          qc.invalidateQueries({ queryKey: ["tags"] });
          qc.invalidateQueries({ queryKey: ["entity-tags"] });
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["brevo-audience-lists"] });
          toast({
            title: "Brevo sync complete",
            description: `${totals.matched} contacts tagged across ${totals.lists} lists.`,
          });
        } else {
          setPreview({ ...totals });
        }
      } catch (e: any) {
        toast({ title: "Brevo sync failed", description: e?.message, variant: "destructive" });
      } finally {
        setRunning(false);
      }
    },
    [qc],
  );

  return { run, running, progress, preview, applied, resetPreview: () => setPreview(null) };
};

/** Live contact counts per state, for sanity-checking audience filters. */
export const useContactStateCounts = () =>
  useQuery({
    queryKey: ["contact-state-counts"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const counts: Record<string, number> = {};
      const { data, error } = await supabase
        .from("customers")
        .select("state")
        .not("state", "is", null)
        .eq("marketing_consent", true)
        .limit(10000);
      if (error) throw error;
      (data ?? []).forEach((r: any) => {
        const key = String(r.state || "").trim();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
  });
