import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// Helper to detect permission errors
const isPermissionError = (error: any): boolean => {
  return error?.code === '42501' || 
         error?.code === 'PGRST301' || 
         error?.message?.toLowerCase().includes('permission') ||
         error?.message?.toLowerCase().includes('policy') ||
         error?.message?.toLowerCase().includes('row-level security');
};

export interface ItineraryEntry {
  id: string;
  day_id: string;
  time_slot: string | null;
  subject: string;
  content: string | null;
  sort_order: number;
}

export interface ItineraryDay {
  id: string;
  itinerary_id: string;
  day_number: number;
  activity_date: string;
  entries: ItineraryEntry[];
}

export interface Itinerary {
  id: string;
  tour_id: string;
  version: number;
  is_current: boolean;
  title: string | null;
  notes: string | null;
  snapshot_file_path: string | null;
  snapshot_file_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  days: ItineraryDay[];
}

export const useItinerary = (tourId: string) => {
  return useQuery({
    queryKey: ['itinerary', tourId],
    queryFn: async () => {
      const { data: itinerary, error: itineraryError } = await supabase
        .from('tour_itineraries')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_current', true)
        .single();

      if (itineraryError && itineraryError.code !== 'PGRST116') {
        throw itineraryError;
      }

      if (!itinerary) {
        return null;
      }

      const { data: days, error: daysError } = await supabase
        .from('tour_itinerary_days')
        .select('*')
        .eq('itinerary_id', itinerary.id)
        .order('day_number');

      if (daysError) throw daysError;

      // Fetch entries for all days
      const { data: entries, error: entriesError } = await supabase
        .from('tour_itinerary_entries')
        .select('*')
        .in('day_id', days?.map(day => day.id) || [])
        .order('sort_order');

      if (entriesError) throw entriesError;

      const daysWithEntries = days?.map(day => ({
        ...day,
        entries: entries?.filter(entry => entry.day_id === day.id) || []
      })) || [];

      return {
        ...itinerary,
        days: daysWithEntries
      } as Itinerary;
    }
  });
};

export const useCreateItinerary = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [permissionError, setPermissionError] = useState(false);

  return {
    ...useMutation({
    mutationFn: async ({ tourId, startDate, endDate }: { 
      tourId: string; 
      startDate: string; 
      endDate: string; 
    }) => {
      // Create the itinerary
      const { data: itinerary, error: itineraryError } = await supabase
        .from('tour_itineraries')
        .insert({
          tour_id: tourId,
          title: 'Tour Itinerary',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (itineraryError) throw itineraryError;

      // Generate days between start and end date
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push({
          itinerary_id: itinerary.id,
          day_number: days.length + 1,
          activity_date: d.toISOString().split('T')[0]
        });
      }

      // Insert all days
      const { data: createdDays, error: daysError } = await supabase
        .from('tour_itinerary_days')
        .insert(days)
        .select();

      if (daysError) throw daysError;

      return { itinerary, days: createdDays };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', variables.tourId] });
      toast({
        title: "Itinerary Created",
        description: "Tour itinerary has been created successfully.",
      });
    },
    onError: (error: any) => {
      if (isPermissionError(error)) {
        setPermissionError(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to create itinerary. Please try again.",
          variant: "destructive",
        });
      }
      console.error('Error creating itinerary:', error);
    },
  }),
    permissionError,
    setPermissionError
  };
};

export const useUpdateItineraryEntry = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [permissionError, setPermissionError] = useState(false);

  return {
    ...useMutation({
    mutationFn: async ({ 
      entryId, 
      dayId, 
      tourId,
      timeSlot, 
      subject, 
      content, 
      sortOrder 
    }: { 
      entryId?: string;
      dayId: string;
      tourId: string;
      timeSlot: string | null;
      subject: string;
      content: string | null;
      sortOrder: number;
    }) => {
      if (entryId) {
        // Update existing entry
        const { data, error } = await supabase
          .from('tour_itinerary_entries')
          .update({ time_slot: timeSlot, subject, content, sort_order: sortOrder })
          .eq('id', entryId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new entry
        const { data, error } = await supabase
          .from('tour_itinerary_entries')
          .insert({
            day_id: dayId,
            time_slot: timeSlot,
            subject,
            content,
            sort_order: sortOrder
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', variables.tourId] });
    },
    onError: (error: any) => {
      if (isPermissionError(error)) {
        setPermissionError(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to save entry. Please try again.",
          variant: "destructive",
        });
      }
      console.error('Error saving entry:', error);
    },
  }),
    permissionError,
    setPermissionError
  };
};

export const useDeleteItineraryEntry = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [permissionError, setPermissionError] = useState(false);

  return {
    ...useMutation({
    mutationFn: async ({ entryId, tourId }: { entryId: string; tourId: string }) => {
      const { error } = await supabase
        .from('tour_itinerary_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', variables.tourId] });
      toast({
        title: "Entry Deleted",
        description: "Itinerary entry has been deleted.",
      });
    },
    onError: (error: any) => {
      if (isPermissionError(error)) {
        setPermissionError(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to delete entry. Please try again.",
          variant: "destructive",
        });
      }
      console.error('Error deleting entry:', error);
    },
  }),
    permissionError,
    setPermissionError
  };
};