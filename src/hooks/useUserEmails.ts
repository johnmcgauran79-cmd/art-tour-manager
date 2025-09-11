import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserEmails = () => {
  return useQuery({
    queryKey: ['user-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .not('email', 'is', null)
        .order('email');
      
      if (error) throw error;
      
      // Add the default emails if not already in the list
      const emails = data.map(profile => profile.email);
      const defaultEmails = [
        'bookings@australianracingtours.com.au',
        'info@australianracingtours.com.au'
      ];
      
      // Add default emails to the beginning if they're not already included
      defaultEmails.reverse().forEach(defaultEmail => {
        if (!emails.includes(defaultEmail)) {
          emails.unshift(defaultEmail);
        }
      });
      
      return emails;
    },
  });
};