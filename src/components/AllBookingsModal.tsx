import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginatedBookings } from "@/hooks/useBookings";
import { EditBookingModal } from "./EditBookingModal";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const getStatusColor = (status: string) => {
  switch (status) {
    case "fully_paid": return "bg-green-100 text-green-800";
    case "instalment_paid": return "bg-purple-100 text-purple-800";
    case "deposited": return "bg-blue-100 text-blue-800";
    case "invoiced": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "host": return "bg-emerald-100 text-emerald-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface AllBookingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingClick: (booking: any) => void;
}

export const AllBookingsModal = ({ open, onOpenChange, onBookingClick }: AllBookingsModalProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const pageSize = 25;
  
  const { data: paginatedData, isLoading } = usePaginatedBookings(currentPage, pageSize);
  const bookings = paginatedData?.data || [];
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setShowEditBooking(true);
  };

  if (isLoading && bookings.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Bookings</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">Loading bookings...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Bookings ({totalCount} total)</DialogTitle>
          </DialogHeader>
          
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Tour</TableHead>
                  <TableHead className="w-[120px]">Lead Passenger</TableHead>
                  <TableHead className="w-[120px]">Other Passengers</TableHead>
                  <TableHead className="w-[60px]">Pax</TableHead>
                  <TableHead className="w-[100px]">Check In</TableHead>
                  <TableHead className="w-[100px]">Check Out</TableHead>
                  <TableHead className="w-[70px]">Nights</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow 
                    key={booking.id} 
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleBookingClick(booking)}
                  >
                    <TableCell className="w-[140px]">{booking.tours?.name || 'No Tour'}</TableCell>
                    <TableCell className="w-[120px]">
                      {booking.customers?.first_name} {booking.customers?.last_name}
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <div className="space-y-1">
                        {booking.passenger_2_name && <div>{booking.passenger_2_name}</div>}
                        {booking.passenger_3_name && <div>{booking.passenger_3_name}</div>}
                        {booking.group_name && <div className="text-sm text-muted-foreground">Group: {booking.group_name}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="w-[60px]">{booking.passenger_count}</TableCell>
                    <TableCell className="w-[100px]">
                      {formatDateToDDMMYYYY(booking.check_in_date)}
                    </TableCell>
                    <TableCell className="w-[100px]">
                      {formatDateToDDMMYYYY(booking.check_out_date)}
                    </TableCell>
                    <TableCell className="w-[70px]">{booking.total_nights || '-'}</TableCell>
                    <TableCell className="w-[80px]">
                      <Badge className={getStatusColor(booking.status || 'pending')}>
                        {(booking.status || 'pending').replace("_", " ").replace("fully paid", "FULLY PAID").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[100px]">
                      <div className="truncate" title={booking.extra_requests || ''}>
                        {booking.extra_requests || '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} bookings
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>

      <EditBookingModal 
        booking={selectedBooking} 
        open={showEditBooking} 
        onOpenChange={setShowEditBooking} 
      />
    </>
  );
};
