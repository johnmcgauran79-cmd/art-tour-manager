import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserDepartments } from "@/hooks/useUserDepartments";

export type WebsiteChangeSection =
  | "description"
  | "inclusions"
  | "exclusions"
  | "itinerary"
  | "itinerary_photos";

export const WEBSITE_SECTION_LABELS: Record<WebsiteChangeSection, string> = {
  description: "Website Description",
  inclusions: "Inclusions",
  exclusions: "Exclusions",
  itinerary: "Itinerary Text",
  itinerary_photos: "Itinerary Photos",
};

export interface WebsiteChangeRequest {
  id: string;
  tour_id: string;
  section: WebsiteChangeSection;
  status: "pending" | "approved" | "rejected";
  change_count: number;
  last_changed_by: string | null;
  first_changed_at: string;
  last_changed_at: string;
  tourName: string | null;
  tourStartDate: string | null;
  changedByName: string | null;
}

export interface WebsiteChangeGroup {
  tourId: string;
  tourName: string;
  tourStartDate: string | null;
  requests: WebsiteChangeRequest[];
  totalChanges: number;
  lastChangedAt: string;
}

export interface WebsiteChangeEvent {
  id: string;
  request_id: string;
  section: WebsiteChangeSection;
  summary: string;
  before_value: unknown;
  after_value: unknown;
  changed_by: string | null;
  changed_at: string;
  changedByName: string | null;
}

/** Admin, manager and anyone in the marketing department may approve & publish. */
export const useIsWebsiteApprover = () => {
  const { userRole } = useAuth();
  const { data: departments = [] } = useUserDepartments();
  return (
    userRole === "admin" ||
    userRole === "manager" ||
    departments.includes("marketing")
  );
};

const loadNames = async (ids: string[]): Promise<Map<string, string>> => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique);
  const map = new Map<string, string>();
  (data ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) =>
    map.set(p.id, p.full_name || p.email || "Unknown user"),
  );
  return map;
};

/** Pending website change requests, grouped by tour. */
export const useWebsiteChangeGroups = (tourId?: string) =>
  useQuery({
    queryKey: ["website-change-groups", tourId ?? "all"],
    staleTime: 30000,
    refetchInterval: 120000,
    queryFn: async (): Promise<WebsiteChangeGroup[]> => {
      let q = supabase
        .from("website_change_requests")
        .select(
          "id, tour_id, section, status, change_count, last_changed_by, first_changed_at, last_changed_at, tours(name, start_date)",
        )
        .eq("status", "pending")
        .order("last_changed_at", { ascending: false });
      if (tourId) q = q.eq("tour_id", tourId);
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const names = await loadNames(rows.map((r) => r.last_changed_by).filter(Boolean));

      const groups = new Map<string, WebsiteChangeGroup>();
      rows.forEach((r) => {
        const request: WebsiteChangeRequest = {
          id: r.id,
          tour_id: r.tour_id,
          section: r.section,
          status: r.status,
          change_count: r.change_count ?? 1,
          last_changed_by: r.last_changed_by,
          first_changed_at: r.first_changed_at,
          last_changed_at: r.last_changed_at,
          tourName: r.tours?.name ?? null,
          tourStartDate: r.tours?.start_date ?? null,
          changedByName: r.last_changed_by ? names.get(r.last_changed_by) ?? null : null,
        };
        const existing = groups.get(r.tour_id);
        if (existing) {
          existing.requests.push(request);
          existing.totalChanges += request.change_count;
          if (request.last_changed_at > existing.lastChangedAt)
            existing.lastChangedAt = request.last_changed_at;
        } else {
          groups.set(r.tour_id, {
            tourId: r.tour_id,
            tourName: request.tourName ?? "Unnamed tour",
            tourStartDate: request.tourStartDate,
            requests: [request],
            totalChanges: request.change_count,
            lastChangedAt: request.last_changed_at,
          });
        }
      });

      return [...groups.values()].sort((a, b) => b.lastChangedAt.localeCompare(a.lastChangedAt));
    },
  });

/** Total number of individual pending edits awaiting marketing approval. */
export const usePendingWebsiteChangeCount = () =>
  useQuery({
    queryKey: ["pending-website-change-count"],
    staleTime: 30000,
    refetchInterval: 120000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_change_requests")
        .select("change_count")
        .eq("status", "pending");
      if (error) throw error;
      return ((data as any[]) ?? []).reduce((s, r) => s + (r.change_count || 0), 0);
    },
  });

/** The individual tracked edits behind a set of pending requests. */
export const useWebsiteChangeEvents = (requestIds: string[]) =>
  useQuery({
    queryKey: ["website-change-events", requestIds.slice().sort().join(",")],
    enabled: requestIds.length > 0,
    queryFn: async (): Promise<WebsiteChangeEvent[]> => {
      const { data, error } = await supabase
        .from("website_change_events")
        .select("id, request_id, section, summary, before_value, after_value, changed_by, changed_at")
        .in("request_id", requestIds)
        .order("changed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const names = await loadNames(rows.map((r) => r.changed_by).filter(Boolean));
      return rows.map((r) => ({
        ...r,
        changedByName: r.changed_by ? names.get(r.changed_by) ?? null : null,
      })) as WebsiteChangeEvent[];
    },
  });

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", {
    body: { op, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ["website-change-groups"] });
  queryClient.invalidateQueries({ queryKey: ["pending-website-change-count"] });
  queryClient.invalidateQueries({ queryKey: ["website-change-events"] });
};

/** Publish the approved sections to WordPress, then close off the pending requests. */
export const useApproveWebsiteChanges = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      tourId,
      requests,
    }: {
      tourId: string;
      requests: WebsiteChangeRequest[];
    }) => {
      const sections = requests.map((r) => r.section);
      const contentSections = sections.filter(
        (s): s is "inclusions" | "exclusions" | "description" =>
          s === "inclusions" || s === "exclusions" || s === "description",
      );
      const needsItinerary = sections.some(
        (s) => s === "itinerary" || s === "itinerary_photos",
      );

      const published: string[] = [];

      if (contentSections.length > 0) {
        const res = await callProxy<{ pushed: string[] }>("push_inclusions", {
          art_tour_id: tourId,
          sections: contentSections,
        });
        published.push(...(res.pushed ?? []));
      }
      if (needsItinerary) {
        const res = await callProxy<{ rows_published: number; photos_uploaded: number }>(
          "push_itinerary",
          { art_tour_id: tourId },
        );
        if (res.rows_published) published.push(`${res.rows_published} itinerary day(s)`);
        if (res.photos_uploaded) published.push(`${res.photos_uploaded} photo(s)`);
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("website_change_requests")
        .update({
          status: "approved",
          reviewed_by: user?.id ?? null,
          reviewed_at: now,
          published_at: now,
        })
        .in(
          "id",
          requests.map((r) => r.id),
        );
      if (error) throw error;

      return published;
    },
    onSuccess: (published) => {
      toast.success(
        published.length > 0
          ? `Approved & published: ${published.join(", ")}`
          : "Approved — the website already matched the system",
      );
      invalidateAll(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Reject the changes — nothing is published and the queue entry is closed. */
export const useRejectWebsiteChanges = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ requestIds, note }: { requestIds: string[]; note?: string }) => {
      const { error } = await supabase
        .from("website_change_requests")
        .update({
          status: "rejected",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_note: note ?? null,
        })
        .in("id", requestIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Changes rejected — nothing was published");
      invalidateAll(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};