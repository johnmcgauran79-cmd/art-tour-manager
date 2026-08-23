import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type MigrationPhase =
  | "pull_tags"
  | "pull_contacts"
  | "enrich"
  | "review"
  | "push"
  | "complete";

export interface MigrationRun {
  id: string;
  phase: MigrationPhase;
  status: string;
  keap_cursor: number | null;
  total_pulled: number | null;
  total_pushed: number | null;
  total_skipped: number | null;
  total_failed: number | null;
  notes_pulled: number | null;
  tags_pulled: number | null;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface MigrationReport {
  summary: {
    total: number;
    pushable: number;
    noEmail: number;
    duplicateEmails: number;
    duplicateContacts: number;
    blocklisted: number;
    withNotes: number;
    pushed: number;
    failed: number;
    skipped: number;
    matchedInArt: number;
    unusedTags: number;
    undecidedTags: number;
  };
  duplicates: { email: string; count: number; names: string[] }[];
  noEmailSample: { name: string; phone: string | null }[];
  failures: { email: string | null; error_message: string | null }[];
  tags: CrmTagMapping[];
}

export interface CrmTagMapping {
  keap_tag_id: string;
  keap_tag_name: string;
  keap_tag_category: string | null;
  contact_count: number | null;
  target_type: "list" | "attribute" | "skip";
  target_name: string | null;
  brevo_list_id: number | null;
  brevo_attribute: string | null;
}

const invokeFn = async (fn: string, body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.text) detail = await ctx.text();
    } catch { /* keep original message */ }
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

/** The most recent migration run, if any. */
export const useLatestMigrationRun = () =>
  useQuery({
    queryKey: ["crm-migration-run"],
    refetchInterval: 5000,
    queryFn: async (): Promise<MigrationRun | null> => {
      const { data, error } = await supabase
        .from("crm_migration_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MigrationRun) ?? null;
    },
  });

export const useMigrationReport = (runId?: string | null) =>
  useQuery({
    queryKey: ["crm-migration-report", runId],
    enabled: !!runId,
    queryFn: async (): Promise<MigrationReport> =>
      await invokeFn("crm-migrate-report", { runId }),
  });

export const useBrevoStatus = () =>
  useQuery({
    queryKey: ["brevo-status"],
    staleTime: 60_000,
    queryFn: async () => await invokeFn("brevo-sync", { action: "status" }),
  });

export const useUpdateTagMapping = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      keapTagId: string;
      targetType: "list" | "attribute" | "skip";
      targetName?: string | null;
    }) => {
      const { error } = await supabase
        .from("crm_tag_map")
        .update({
          target_type: input.targetType,
          target_name: input.targetName ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("keap_tag_id", input.keapTagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-migration-report"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not save tag decision",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });
};

/**
 * Drives the long-running pull/push loops. Each Edge Function call handles a
 * small batch, so we keep calling until it reports it is finished. The loop can
 * be stopped at any time and resumed later — progress is stored server-side.
 */
export const useMigrationRunner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const stopRef = useRef(false);

  const stop = useCallback(() => {
    stopRef.current = true;
    setProgressLabel("Stopping…");
  }, []);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-migration-run"] });
    queryClient.invalidateQueries({ queryKey: ["crm-migration-report"] });
  };

  const startRun = useCallback(async () => {
    setBusy(true);
    try {
      const res = await invokeFn("crm-migrate-pull", { action: "start" });
      refresh();
      return res.run as MigrationRun;
    } catch (error: any) {
      toast({
        title: "Could not start the migration",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  /** Runs the whole Keap read: tags -> contacts -> tags & notes per contact. */
  const runPull = useCallback(
    async (runId: string) => {
      setBusy(true);
      stopRef.current = false;
      try {
        setProgressLabel("Reading tags from Keap…");
        await invokeFn("crm-migrate-pull", { action: "pull_tags", runId });

        let pulled = 0;
        for (;;) {
          if (stopRef.current) break;
          const res = await invokeFn("crm-migrate-pull", { action: "pull_contacts", runId });
          pulled += res.pulled ?? 0;
          setProgressLabel(`Read ${pulled} contacts from Keap…`);
          refresh();
          if (res.done) break;
        }

        let enriched = 0;
        for (;;) {
          if (stopRef.current) break;
          const res = await invokeFn("crm-migrate-pull", { action: "enrich", runId });
          enriched += res.processed ?? 0;
          setProgressLabel(`Collected tags and notes for ${enriched} contacts…`);
          refresh();
          if (res.done) break;
        }

        if (!stopRef.current) {
          toast({
            title: "Keap data collected",
            description: "Review the results before anything is sent to Brevo.",
          });
        }
      } catch (error: any) {
        toast({
          title: "Reading from Keap stopped",
          description: error?.message ?? "Please try again — progress has been saved.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
        setProgressLabel(null);
        refresh();
      }
    },
    [toast],
  );

  /** Creates the Brevo lists/attributes, then pushes every reviewed contact. */
  const runPush = useCallback(
    async (runId: string) => {
      setBusy(true);
      stopRef.current = false;
      try {
        setProgressLabel("Setting up lists and fields in Brevo…");
        await invokeFn("crm-migrate-push", { action: "prepare_lists" });

        let pushed = 0;
        for (;;) {
          if (stopRef.current) break;
          const res = await invokeFn("crm-migrate-push", { action: "push_batch", runId });
          pushed += res.pushed ?? 0;
          setProgressLabel(`Sent ${pushed} contacts to Brevo…`);
          refresh();
          if (res.done) break;
        }

        if (!stopRef.current) {
          toast({ title: "Migration finished", description: `${pushed} contacts sent to Brevo.` });
        }
      } catch (error: any) {
        toast({
          title: "Sending to Brevo stopped",
          description: error?.message ?? "Progress has been saved — you can resume.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
        setProgressLabel(null);
        refresh();
      }
    },
    [toast],
  );

  const retryFailed = useCallback(
    async (runId: string) => {
      try {
        await invokeFn("crm-migrate-push", { action: "retry_failed", runId });
        refresh();
        toast({ title: "Failures queued for another attempt" });
      } catch (error: any) {
        toast({
          title: "Could not queue the retry",
          description: error?.message ?? "Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  return { busy, progressLabel, startRun, runPull, runPush, retryFailed, stop };
};
/** Creates STATE/CITY/COUNTRY fields in Brevo and fills them from ART. */
export const useBrevoLocationBackfill = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await invokeFn("brevo-sync", { action: "ensure_location_fields" });
      let updated = 0;
      for (const source of ["customers", "migration"] as const) {
        let offset = 0;
        for (let i = 0; i < 200; i++) {
          const res = await invokeFn("brevo-sync", {
            action: "backfill_locations",
            source,
            limit: 100,
            offset,
          });
          updated += res.updated ?? 0;
          offset = res.nextOffset ?? offset + 100;
          if (!res.hasMore) break;
        }
      }
      return { updated };
    },
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ["brevo-status"] });
      toast({
        title: "Location fields updated in Brevo",
        description: `${updated} contact${updated === 1 ? "" : "s"} now carry State, City and Country.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not update the location fields",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });
};

/** Permanently deletes every blocked / unsubscribed contact in Brevo. */
export const useBrevoPurgeBlocklisted = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      let offset = 0;
      let deleted = 0;
      let scanned = 0;
      for (let i = 0; i < 300; i++) {
        const res = await invokeFn("brevo-sync", {
          action: "purge_blocklisted",
          limit: 200,
          offset,
        });
        deleted += res.deleted ?? 0;
        scanned += res.scanned ?? 0;
        offset = res.nextOffset ?? offset + 200;
        if (!res.hasMore) break;
      }
      return { deleted, scanned };
    },
    onSuccess: ({ deleted, scanned }) => {
      queryClient.invalidateQueries({ queryKey: ["brevo-status"] });
      toast({
        title: "Blocked contacts removed",
        description: `${deleted} deleted out of ${scanned} contacts checked.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not remove the blocked contacts",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });
};


/** Pulls contacts newly created in Brevo into ART (ongoing connection). */
export const useBrevoPullNew = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      let offset = 0;
      let created = 0;
      let linked = 0;
      for (let i = 0; i < 20; i++) {
        const res = await invokeFn("brevo-sync", { action: "pull_new", limit: 200, offset });
        created += res.created ?? 0;
        linked += res.linked ?? 0;
        offset = res.nextOffset ?? offset + 200;
        if (!res.hasMore) break;
      }
      return { created, linked };
    },
    onSuccess: ({ created, linked }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["brevo-status"] });
      toast({
        title: "Brevo contacts checked",
        description: `${created} new contact${created === 1 ? "" : "s"} added, ${linked} linked to existing records.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not read from Brevo",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });
};
