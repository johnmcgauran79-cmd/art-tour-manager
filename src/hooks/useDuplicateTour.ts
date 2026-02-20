
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useDuplicateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ originalTourId, newName }: { originalTourId: string; newName?: string }) => {
      console.log('Duplicating tour:', originalTourId);

      // Fetch the original tour
      const { data: originalTour, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', originalTourId)
        .single();

      if (tourError) throw tourError;

      // Calculate new dates (add 1 year)
      const startDate = new Date(originalTour.start_date);
      const endDate = new Date(originalTour.end_date);
      const newStartDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
      const newEndDate = new Date(endDate.getFullYear() + 1, endDate.getMonth(), endDate.getDate());

      // Use provided name or default naming convention
      const tourName = newName || `${originalTour.name} ${newStartDate.getFullYear()}`;

      // Create new tour with updated dates
      const newTourData = {
        name: tourName,
        tour_host: originalTour.tour_host,
        start_date: newStartDate.toISOString().split('T')[0],
        end_date: newEndDate.toISOString().split('T')[0],
        days: originalTour.days,
        nights: originalTour.nights,
        location: originalTour.location,
        pickup_point: originalTour.pickup_point,
        status: 'pending' as const,
        notes: originalTour.notes,
        inclusions: originalTour.inclusions,
        exclusions: originalTour.exclusions,
        price_single: originalTour.price_single,
        price_double: originalTour.price_double,
        price_twin: originalTour.price_twin,
        deposit_required: originalTour.deposit_required,
        instalment_amount: originalTour.instalment_amount,
        instalment_required: originalTour.instalment_required,
        instalment_date: originalTour.instalment_date ? 
          new Date(new Date(originalTour.instalment_date).getFullYear() + 1, 
                   new Date(originalTour.instalment_date).getMonth(), 
                   new Date(originalTour.instalment_date).getDate()).toISOString().split('T')[0] : null,
        final_payment_date: originalTour.final_payment_date ? 
          new Date(new Date(originalTour.final_payment_date).getFullYear() + 1, 
                   new Date(originalTour.final_payment_date).getMonth(), 
                   new Date(originalTour.final_payment_date).getDate()).toISOString().split('T')[0] : null,
        capacity: originalTour.capacity,
        minimum_passengers_required: originalTour.minimum_passengers_required,
        travel_documents_required: originalTour.travel_documents_required,
        tour_type: originalTour.tour_type,
        url_reference: null,
        // Copy operations notes
        ops_notes: originalTour.ops_notes,
        ops_accomm_notes: originalTour.ops_accomm_notes,
        ops_races_notes: originalTour.ops_races_notes,
        ops_transport_notes: originalTour.ops_transport_notes,
        ops_dinner_notes: originalTour.ops_dinner_notes,
        ops_activities_notes: originalTour.ops_activities_notes,
        ops_other_notes: originalTour.ops_other_notes,
        // Reset host-specific fields
        tour_hosts_notes: null,
        host_flights_status: 'not_booked',
        outbound_flight_number: null,
        outbound_flight_date: null,
        return_flight_number: null,
        return_flight_date: null,
      };

      const { data: newTour, error: createError } = await supabase
        .from('tours')
        .insert(newTourData)
        .select()
        .single();

      if (createError) throw createError;

      // Fetch and duplicate hotels
      const { data: originalHotels, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .eq('tour_id', originalTourId);

      if (hotelsError) throw hotelsError;

      if (originalHotels && originalHotels.length > 0) {
        const newHotels = originalHotels.map(hotel => ({
          tour_id: newTour.id,
          name: hotel.name,
          address: hotel.address,
          contact_name: hotel.contact_name,
          contact_phone: hotel.contact_phone,
          contact_email: hotel.contact_email,
          rooms_reserved: hotel.rooms_reserved,
          booking_status: 'pending' as const,
          default_room_type: hotel.default_room_type,
          default_check_in: hotel.default_check_in ? 
            new Date(new Date(hotel.default_check_in).getFullYear() + 1, 
                     new Date(hotel.default_check_in).getMonth(), 
                     new Date(hotel.default_check_in).getDate()).toISOString().split('T')[0] : null,
          default_check_out: hotel.default_check_out ? 
            new Date(new Date(hotel.default_check_out).getFullYear() + 1, 
                     new Date(hotel.default_check_out).getMonth(), 
                     new Date(hotel.default_check_out).getDate()).toISOString().split('T')[0] : null,
          extra_night_price: hotel.extra_night_price,
          operations_notes: hotel.operations_notes,
          upgrade_options: hotel.upgrade_options,
        }));

        const { error: hotelsInsertError } = await supabase
          .from('hotels')
          .insert(newHotels);

        if (hotelsInsertError) throw hotelsInsertError;
      }

      // Fetch and duplicate activities
      const { data: originalActivities, error: activitiesError } = await supabase
        .from('activities')
        .select('*, activity_journeys(*)')
        .eq('tour_id', originalTourId);

      if (activitiesError) throw activitiesError;

      if (originalActivities && originalActivities.length > 0) {
        for (const activity of originalActivities) {
          const { data: newActivity, error: actInsertErr } = await supabase
            .from('activities')
            .insert({
              tour_id: newTour.id,
              name: activity.name,
              location: activity.location,
              activity_date: activity.activity_date ? 
                new Date(new Date(activity.activity_date).getFullYear() + 1, 
                         new Date(activity.activity_date).getMonth(), 
                         new Date(activity.activity_date).getDate()).toISOString().split('T')[0] : null,
              start_time: activity.start_time,
              end_time: activity.end_time,
              depart_for_activity: activity.depart_for_activity,
              spots_available: activity.spots_available,
              activity_status: 'pending' as const,
              transport_status: 'pending' as const,
              transport_mode: activity.transport_mode,
              contact_name: activity.contact_name,
              contact_phone: activity.contact_phone,
              contact_email: activity.contact_email,
              transport_company: activity.transport_company,
              transport_contact_name: activity.transport_contact_name,
              transport_phone: activity.transport_phone,
              transport_email: activity.transport_email,
              driver_name: activity.driver_name,
              driver_phone: activity.driver_phone,
              hospitality_inclusions: activity.hospitality_inclusions,
              notes: activity.notes,
              operations_notes: activity.operations_notes,
              transport_notes: activity.transport_notes,
            })
            .select('id')
            .single();

          if (actInsertErr) throw actInsertErr;

          // Duplicate journeys
          const journeys = (activity as any).activity_journeys || [];
          if (newActivity && journeys.length > 0) {
            const newJourneys = journeys.map((j: any) => ({
              activity_id: newActivity.id,
              journey_number: j.journey_number,
              pickup_time: j.pickup_time,
              pickup_location: j.pickup_location,
              destination: j.destination,
              sort_order: j.sort_order,
            }));
            await supabase.from('activity_journeys').insert(newJourneys);
          }
        }
      }

      return newTour;
    },
    onSuccess: (newTour) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast({
        title: "Tour Duplicated Successfully",
        description: `"${newTour.name}" has been created with updated dates and copied hotels/activities.`,
      });
    },
    onError: (error) => {
      console.error('Error duplicating tour:', error);
      toast({
        title: "Error Duplicating Tour",
        description: "Failed to duplicate the tour. Please try again.",
        variant: "destructive",
      });
    },
  });
};
