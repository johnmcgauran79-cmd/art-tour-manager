import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateAiConversation } from "@/hooks/useAiChat";

export interface GuestItineraryTiming {
  label: string;
  time: string;
  status: "confirmed" | "approximate" | "tbc";
  source_type: "activity" | "itinerary" | "hotel" | "staff_instruction";
  source_id: string | null;
}

export interface GuestItineraryDay {
  day_number: number;
  date: string;
  title: string;
  meals: string;
  transport: string;
  narrative_paragraphs: string[];
  timings: GuestItineraryTiming[];
  source_refs: {
    itinerary_entry_ids: string[];
    activity_ids: string[];
    hotel_ids: string[];
  };
  warnings: string[];
}

export interface GuestItineraryUnresolvedItem {
  date: string | null;
  field: string;
  issue: string;
  recommended_action: string;
  source_refs: string[];
}

export interface GuestItineraryDraft {
  schema_version: string;
  tour: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    itinerary_version: number | null;
  };
  days: GuestItineraryDay[];
  unresolved_items: GuestItineraryUnresolvedItem[];
  generation_summary: {
    complete_date_coverage: boolean;
    source_activity_count: number;
    source_itinerary_entry_count: number;
    source_hotel_count: number;
  };
}

export interface SaveResult {
  file_name: string;
  replaced_file_name: string | null;
}

/**
 * Guest Document itinerary text drafting. Saving always produces a PDF.
 *
 * The draft lives in local state only — generating, regenerating, editing and
 * discarding never touch ART records, Supabase Storage or the website. Saving
 * is a separate, explicit admin/manager action.
 */
export function useGuestItineraryDraft(tourId: string, itineraryId: string) {
  const [draft, setDraft] = useState<GuestItineraryDraft | null>(null);
  const [reviewWarnings, setReviewWarnings] = useState<string[]>([]);
  const [timingErrors, setTimingErrors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createConversation = useCreateAiConversation();
  const queryClient = useQueryClient();

  const generate = useCallback(async (staffInstructions?: string) => {
    setIsGenerating(true);
    setError(null);
    setTimingErrors([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

      const conversation = await createConversation.mutateAsync({
        tour_id: tourId,
        source_page: "tour_itinerary",
        context_label: "Create Guest Document Text",
      });

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/art-ai-chat`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            message: "Create the guest document itinerary text for this tour.",
            mode: "structured_skill",
            skill_id: "create_guest_document_itinerary",
            entry_point: "tour_itinerary_tab",
            context: {
              tour_id: tourId,
              source_page: "tour_itinerary",
              staff_instructions: staffInstructions?.trim() || null,
            },
          }),
        },
      );

      // The function answers as an SSE stream with keepalive comments (generation
      // routinely runs past the 150s idle timeout), then one terminal data event.
      let status = res.status;
      let payload: any = {};
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let received = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const parsed = JSON.parse(line.slice(5).trim());
              status = parsed.status ?? 200;
              payload = parsed.payload ?? {};
              received = true;
            } catch {
              // ignore malformed frame
            }
          }
        }
        if (!received) {
          throw new Error("The generation stopped before finishing. Please try again.");
        }
      } else {
        payload = await res.json().catch(() => ({}));
      }

      if (status < 200 || status >= 300) {
        throw new Error(
          payload?.message ||
            (payload?.error === "RATE_LIMIT_EXCEEDED"
              ? "AI request limit reached. Please try again shortly."
              : "Could not generate the guest document text. Please try again."),
        );
      }

      setDraft(payload.draft as GuestItineraryDraft);
      setReviewWarnings(Array.isArray(payload.review_warnings) ? payload.review_warnings : []);
      setTimingErrors(Array.isArray(payload.timing_errors) ? payload.timing_errors : []);
    } catch (e: any) {
      setError(e?.message ?? "Could not generate the guest document text.");
    } finally {
      setIsGenerating(false);
    }
  }, [createConversation, tourId]);

  const updateDay = useCallback((date: string, patch: Partial<GuestItineraryDay>) => {
    setDraft((current) =>
      current
        ? { ...current, days: current.days.map((d) => (d.date === date ? { ...d, ...patch } : d)) }
        : current,
    );
  }, []);

  const discard = useCallback(() => {
    setDraft(null);
    setReviewWarnings([]);
    setTimingErrors([]);
    setError(null);
  }, []);

  /**
   * Build the PDF and store it in the tour's Guest Document slot. The endpoint
   * revalidates timing coverage, so an edit that drops a confirmed time fails.
   * Returns { needsConfirmation, existingFileName } when a document already exists.
   */
  const save = useCallback(
    async (
      confirmReplace = false,
    ): Promise<
      | { saved: true; result: SaveResult }
      | { saved: false; needsConfirmation: true; existingFileName: string | null }
    > => {
      if (!draft) throw new Error("There is no draft to save.");
      setIsSaving(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-guest-document-docx",
          {
            body: {
              tour_id: tourId,
              itinerary_id: itineraryId,
              confirm_replace: confirmReplace,
              review_warnings: reviewWarnings,
              draft,
            },
          },
        );

        if (fnError) {
          // Non-2xx responses surface as FunctionsHttpError; read the body for detail.
          const ctx: Response | undefined = (fnError as any)?.context;
          const body = ctx ? await ctx.clone().json().catch(() => ({})) : {};
          if (body?.error === "confirmation_required") {
            return {
              saved: false,
              needsConfirmation: true,
              existingFileName: body.existing_file_name ?? null,
            };
          }
          if (body?.error === "timing_coverage_incomplete") {
            setTimingErrors(Array.isArray(body.missing) ? body.missing : []);
            throw new Error(
              body?.message ??
                "Some confirmed Activity times are missing from the narrative, so this document was not saved.",
            );
          }
          throw new Error(body?.message || "Could not save the Guest Document.");
        }

        queryClient.invalidateQueries({ queryKey: ["itinerary", tourId] });
        return {
          saved: true,
          result: {
            file_name: data.file_name,
            replaced_file_name: data.replaced_file_name ?? null,
          },
        };
      } finally {
        setIsSaving(false);
      }
    },
    [draft, itineraryId, queryClient, reviewWarnings, tourId],
  );

  return {
    draft,
    reviewWarnings,
    timingErrors,
    isGenerating,
    isSaving,
    error,
    generate,
    updateDay,
    discard,
    save,
  };
}
