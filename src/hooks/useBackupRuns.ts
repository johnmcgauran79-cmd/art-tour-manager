import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BackupRun {
  id: string;
  source: string;
  kind: string;
  status: string;
  started_at: string | null;
  finished_at: string;
  duration_seconds: number | null;
  size_bytes: number | null;
  destination: string | null;
  artifact_name: string | null;
  tables_count: number | null;
  error_message: string | null;
}

export type BackupHealth = "healthy" | "stale" | "failing" | "none";

/** Hours after which the most recent successful backup is considered stale. */
export const BACKUP_STALE_HOURS = 36;

export const useBackupRuns = (limit = 15) =>
  useQuery({
    queryKey: ["backup-runs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_runs")
        .select(
          "id, source, kind, status, started_at, finished_at, duration_seconds, size_bytes, destination, artifact_name, tables_count, error_message"
        )
        .order("finished_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as BackupRun[];
    },
    staleTime: 5 * 60 * 1000,
  });

export const backupHealth = (runs: BackupRun[]): BackupHealth => {
  if (runs.length === 0) return "none";
  const lastSuccess = runs.find((r) => r.status === "success");
  if (!lastSuccess) return "failing";
  const ageHours = (Date.now() - Date.parse(lastSuccess.finished_at)) / 36e5;
  if (ageHours > BACKUP_STALE_HOURS) return "stale";
  return runs[0].status === "failed" ? "failing" : "healthy";
};

export const formatBytes = (bytes: number | null) => {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};