import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useHotels, Hotel } from "./useHotels";
import { useActivities, Activity } from "./useActivities";

interface TourOpsReview {
  id: string;
  tour_id: string;
  reviewed_by: string;
  reviewed_at: string;
  data_snapshot: Record<string, any>;
  created_at: string;
}

interface ReviewerProfile {
  first_name: string | null;
  last_name: string | null;
}

// Build a snapshot of all displayed fields for hotels and activities
const buildSnapshot = (hotels: Hotel[], activities: Activity[]) => {
  const snapshot: Record<string, any> = {};
  
  hotels.forEach(hotel => {
    snapshot[`hotel_${hotel.id}`] = {
      name: hotel.name,
      address: hotel.address,
      default_check_in: hotel.default_check_in,
      default_check_out: hotel.default_check_out,
      default_room_type: hotel.default_room_type,
      rooms_reserved: hotel.rooms_reserved,
      operations_notes: hotel.operations_notes,
    };
  });

  activities.forEach(activity => {
    snapshot[`activity_${activity.id}`] = {
      name: activity.name,
      activity_date: activity.activity_date,
      start_time: activity.start_time,
      depart_for_activity: activity.depart_for_activity,
      end_time: activity.end_time,
      transport_mode: activity.transport_mode,
      hospitality_inclusions: activity.hospitality_inclusions,
      notes: activity.notes,
    };
  });

  return snapshot;
};

// Compare current data against snapshot, return set of changed field keys like "hotel_xyz.name"
export const getChangedFields = (
  hotels: Hotel[],
  activities: Activity[],
  snapshot: Record<string, any> | null
): Set<string> => {
  const changed = new Set<string>();
  if (!snapshot) return changed;

  const current = buildSnapshot(hotels, activities);

  // Check current items against snapshot
  for (const [key, currentFields] of Object.entries(current)) {
    const snapshotFields = snapshot[key];
    if (!snapshotFields) {
      // Entirely new item — mark all fields as changed
      for (const field of Object.keys(currentFields)) {
        changed.add(`${key}.${field}`);
      }
      continue;
    }
    for (const [field, value] of Object.entries(currentFields)) {
      if (String(value ?? '') !== String(snapshotFields[field] ?? '')) {
        changed.add(`${key}.${field}`);
      }
    }
  }

  return changed;
};

export const useTourOpsReview = (tourId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: hotels = [] } = useHotels(tourId);
  const { data: activities = [] } = useActivities(tourId);

  const { data: review, isLoading } = useQuery({
    queryKey: ["tourOpsReview", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_ops_reviews")
        .select("*")
        .eq("tour_id", tourId)
        .maybeSingle();
      if (error) throw error;
      return data as TourOpsReview | null;
    },
    enabled: !!tourId,
  });

  // Fetch reviewer profile separately
  const { data: reviewerProfile } = useQuery({
    queryKey: ["tourOpsReviewer", review?.reviewed_by],
    queryFn: async () => {
      if (!review?.reviewed_by) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", review.reviewed_by)
        .maybeSingle();
      if (error) throw error;
      return data as ReviewerProfile | null;
    },
    enabled: !!review?.reviewed_by,
  });

  const changedFields = getChangedFields(
    hotels,
    activities,
    review?.data_snapshot as Record<string, any> | null
  );

  const markReviewed = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const snapshot = buildSnapshot(hotels, activities);
      
      const { error } = await supabase
        .from("tour_ops_reviews")
        .upsert(
          {
            tour_id: tourId,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            data_snapshot: snapshot,
          },
          { onConflict: "tour_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tourOpsReview", tourId] });
    },
  });

  return {
    review,
    reviewerProfile,
    isLoading,
    changedFields,
    changeCount: changedFields.size,
    markReviewed,
  };
};
