
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { EditBookingModal } from "@/components/EditBookingModal";

interface ContactBookingsListProps {
  contactId: string;
}

interface ContactBooking {
  id: string;
  status: string;
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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['contact-bookings', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
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
        `)
        .eq('lead_passenger_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContactBooking[];
    },
  });

  const handleRowClick = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedBookingId(null);
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
                        {format(new Date(booking.tours.start_date), 'MMM d')} - {format(new Date(booking.tours.end_date), 'MMM d, yyyy')}
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
                    {format(new Date(booking.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedBookingId && (
        <EditBookingModal
          bookingId={selectedBookingId}
          open={isEditModalOpen}
          onOpenChange={handleCloseModal}
        />
      )}
    </>
  );
};
