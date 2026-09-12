import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthJob {
  jobname: string;
  schedule: string;
  active: boolean;
  target: string | null;
  last_run: string | null;
  last_status: string | null;
  last_message: string;
  failures_24h: number;
}

export interface SystemHealthMailbox {
  mailbox: string;
  enabled: boolean;
  last_status: string | null;
  last_finished: string | null;
  last_error: string;
}

export interface SystemHealth {
  generated_at: string;
  problem_count: number;
  jobs: SystemHealthJob[];
  recent_http_failures: Array<{ created: string; status_code: number | null; error: string }>;
  backup: {
    last_run: {
      status: string;
      finished_at: string;
      size_bytes: number | null;
      destination: string | null;
      error_message: string | null;
    } | null;
    hours_since_success: number | null;
    stale_after_hours: number;
  };
  mailboxes: SystemHealthMailbox[];
  failures_24h: {
    xero_sync: number;
    crm_automation: number;
    marketing_automation: number;
    emails: number;
  };
}

export const useSystemHealth = () =>
  useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_health");
      if (error) throw error;
      return data as unknown as SystemHealth;
    },
    staleTime: 60 * 1000,
  });

/** Sends the health digest email now, even when nothing is wrong. */
export const useSendHealthDigest = () =>
  useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("system-health-digest", {
        body: { force: true },
      });
      if (error) throw error;
      return data as { sent?: number; problems?: string[] };
    },
  });

export const jobIsHealthy = (job: SystemHealthJob) =>
  job.active && job.failures_24h === 0 && (job.last_status === null || job.last_status === "succeeded");
