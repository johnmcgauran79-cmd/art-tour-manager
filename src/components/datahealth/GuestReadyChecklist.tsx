import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import type { GuestReadyStep, TourHealth } from "@/hooks/useDataHealth";

const MANUAL_COLUMNS: Record<string, { at: string; by: string }> = {
  race_tickets: { at: "race_tickets_arranged_at", by: "race_tickets_arranged_by" },
  whatsapp: { at: "whatsapp_group_started_at", by: "whatsapp_group_started_by" },
};

const AUTO_HINT: Record<string, string> = {
  guest_document: "Detected from Comms → Files",
  snapshot: "Detected from Comms → Files",
  two_week_email: "Detected when a “2 Week” email is sent for this tour",
  host_briefing: "Detected when the Host Pre-Tour Briefing is sent",
};

/** Guest Ready checklist — auto-detected steps plus two staff tick boxes. */
export const GuestReadyChecklist = ({ tour }: { tour: TourHealth }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canEdit: canEditResource } = usePermissions();
  const canEdit = canEditResource("tour").allowed;
  const { toast } = useToast();

  const toggle = useMutation({
    mutationFn: async ({ step, done }: { step: GuestReadyStep; done: boolean }) => {
      const cols = MANUAL_COLUMNS[step.key];
      const { error } = await supabase
        .from("tours")
        .update({ [cols.at]: done ? new Date().toISOString() : null, [cols.by]: done ? user?.id ?? null : null } as any)
        .eq("id", tour.tourId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["data-health"] }),
    onError: (e: any) => toast({ title: "Couldn't update", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Guest Ready ({tour.guestReadyScore}%)</h4>
      <ul className="grid gap-2 sm:grid-cols-2">
        {tour.guestReady.map((step) => (
          <li key={step.key} className="flex items-start gap-2 rounded-md border p-2 text-sm">
            {step.manual ? (
              <Checkbox
                checked={step.done}
                disabled={!canEdit || toggle.isPending}
                onCheckedChange={(v) => toggle.mutate({ step, done: v === true })}
                className="mt-0.5"
                aria-label={step.label}
              />
            ) : step.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className={step.done ? "" : "text-muted-foreground"}>{step.label}</p>
              <p className="text-xs text-muted-foreground">
                {step.done && step.detail ? `Done ${step.detail}` : step.manual ? "Tick when done" : AUTO_HINT[step.key]}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
