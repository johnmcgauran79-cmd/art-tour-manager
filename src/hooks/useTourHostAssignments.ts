import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface TourHostAssignment {
  id: string;
  tour_id: string;
  host_user_id: string;
  assigned_by: string;
  assigned_at: string;
  notes: string | null;
  // Joined data
  tour_name?: string;
  host_email?: string;
  host_first_name?: string;
  host_last_name?: string;
}

export const useTourHostAssignments = (tourId?: string) => {
  return useQuery({
    queryKey: ['tour-host-assignments', tourId],
    queryFn: async () => {
      let query = supabase
        .from('tour_host_assignments')
        .select(`
          id,
          tour_id,
          host_user_id,
          assigned_by,
          assigned_at,
          notes
        `);
      
      if (tourId) {
        query = query.eq('tour_id', tourId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as TourHostAssignment[];
    },
    enabled: true,
  });
};

export const useHostUsers = () => {
  return useQuery({
    queryKey: ['host-users'],
    queryFn: async () => {
      // Get all users with 'host' role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'host');
      
      if (roleError) throw roleError;
      
      if (!roleData || roleData.length === 0) {
        return [];
      }
      
      const hostUserIds = roleData.map(r => r.user_id);
      
      // Get profile information for these users
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', hostUserIds);
      
      if (profileError) throw profileError;
      
      return profileData || [];
    },
  });
};

export const useAssignHostToTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ tourId, hostUserId, notes }: { tourId: string; hostUserId: string; notes?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tour_host_assignments')
        .insert({
          tour_id: tourId,
          host_user_id: hostUserId,
          assigned_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tour-host-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tour-host-assignments', variables.tourId] });
      toast({
        title: "Host Assigned",
        description: "Host has been successfully assigned to the tour.",
      });
    },
    onError: (error: any) => {
      console.error('Error assigning host:', error);
      toast({
        title: "Assignment Failed",
        description: error.message?.includes('duplicate') 
          ? "This host is already assigned to this tour." 
          : error.message || "Failed to assign host to tour.",
        variant: "destructive",
      });
    },
  });
};

export const useRemoveHostFromTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ assignmentId, tourId }: { assignmentId: string; tourId: string }) => {
      const { error } = await supabase
        .from('tour_host_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tour-host-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tour-host-assignments', variables.tourId] });
      toast({
        title: "Host Removed",
        description: "Host has been removed from the tour.",
      });
    },
    onError: (error: any) => {
      console.error('Error removing host:', error);
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove host from tour.",
        variant: "destructive",
      });
    },
  });
};

// Hook to get tours assigned to a specific host user
export const useHostAssignedTours = (hostUserId?: string) => {
  return useQuery({
    queryKey: ['host-assigned-tours', hostUserId],
    queryFn: async () => {
      if (!hostUserId) return [];
      
      const { data, error } = await supabase
        .from('tour_host_assignments')
        .select(`
          id,
          tour_id,
          assigned_at,
          notes
        `)
        .eq('host_user_id', hostUserId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!hostUserId,
  });
};
