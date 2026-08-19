import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

interface ContactBookingsListProps {
  contactId: string;
}

interface ContactBooking {
  id: string;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice';
  passenger_count: number;
  created_at: string;
  tours: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string;
  } | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'invoiced':
      return 'bg-blue-100 text-blue-800';
    case 'deposited':
      return 'bg-purple-100 text-purple-800';
    case 'instalment_paid':
      return 'bg-orange-100 text-orange-800';
    case 'fully_paid':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'host':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'instalment_paid':
      return 'Instalment Paid';
    case 'fully_paid':
      return 'Fully Paid';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

export const ContactBookingsList = ({ contactId }: ContactBookingsListProps) => {
  const navigate = useNavigate();

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['contact-bookings', contactId],
    queryFn: async () => {
      const selectFields = `
        id,
        status,
        passenger_count,
        created_at,
        tours (
          id,
          name,
          start_date,
          end_date,
          location
        )
      `;

      const [leadRes, p2Res, p3Res] = await Promise.all([
        supabase.from('bookings').select(selectFields).eq('lead_passenger_id', contactId).order('created_at', { ascending: false }),
        supabase.from('bookings').select(selectFields).eq('passenger_2_id', contactId).order('created_at', { ascending: false }),
        supabase.from('bookings').select(selectFields).eq('passenger_3_id', contactId).order('created_at', { ascending: false }),
      ]);

      if (leadRes.error) throw leadRes.error;
      if (p2Res.error) throw p2Res.error;
      if (p3Res.error) throw p3Res.error;

      // Deduplicate by booking id
      const seen = new Set<string>();
      const all: ContactBooking[] = [];
      for (const booking of [...(leadRes.data || []), ...(p2Res.data || []), ...(p3Res.data || [])]) {
        if (!seen.has(booking.id)) {
          seen.add(booking.id);
          all.push(booking as ContactBooking);
        }
      }
      return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const handleRowClick = (bookingId: string) => {
    navigate(`/bookings/${bookingId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading bookings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-red-500">Error loading bookings</div>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Bookings Found</h3>
        <p className="text-gray-500">This contact hasn't made any tour bookings yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-navy" />
          <h3 className="text-lg font-medium">Tour Bookings ({bookings.length})</h3>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tour</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Passengers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow 
                  key={booking.id} 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(booking.id)}
                >
                  <TableCell className="font-medium">
                    {booking.tours?.name || 'Unknown Tour'}
                  </TableCell>
                  <TableCell>
                    {booking.tours?.start_date && booking.tours?.end_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(booking.tours.start_date), 'd MMM')} - {format(new Date(booking.tours.end_date), 'd MMM yyyy')}
                      </div>
                    ) : (
                      <span className="text-gray-400">No dates set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {booking.tours?.location ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {booking.tours.location}
                      </div>
                    ) : (
                      <span className="text-gray-400">No location</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {booking.passenger_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(booking.status)}>
                      {getStatusLabel(booking.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(booking.created_at), 'd MMM yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};
