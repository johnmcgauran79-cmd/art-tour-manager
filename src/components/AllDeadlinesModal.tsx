
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { TourDetailModal } from "@/components/TourDetailModal";

interface Deadline {
  id: string;
  type: 'payment' | 'tour_start' | 'instalment' | 'final_payment';
  title: string;
  date: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  tourName?: string;
  tourId?: string;
}

interface AllDeadlinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AllDeadlinesModal = ({ open, onOpenChange }: AllDeadlinesModalProps) => {
  const { data: tours } = useTours();
  const { data: bookings } = useBookings();
  const [selectedTour, setSelectedTour] = useState(null);
  const [tourDetailModalOpen, setTourDetailModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const getDeadlines = (): Deadline[] => {
    const deadlines: Deadline[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // Tour start dates
    tours?.forEach(tour => {
      const startDate = new Date(tour.start_date);
      if (startDate >= today && startDate <= thirtyDaysFromNow) {
        const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        deadlines.push({
          id: `tour-start-${tour.id}`,
          type: 'tour_start',
          title: 'Tour Starting',
          date: tour.start_date,
          description: tour.name,
          priority: daysUntil <= 7 ? 'high' : daysUntil <= 14 ? 'medium' : 'low',
          tourName: tour.name,
          tourId: tour.id,
        });
      }

      // Instalment dates
      if (tour.instalment_date) {
        const instalmentDate = new Date(tour.instalment_date);
        if (instalmentDate >= today && instalmentDate <= thirtyDaysFromNow) {
          const daysUntil = Math.ceil((instalmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          deadlines.push({
            id: `instalment-${tour.id}`,
            type: 'instalment',
            title: 'Instalment Due',
            date: tour.instalment_date,
            description: `${tour.name} - $${tour.instalment_amount}`,
            priority: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
            tourName: tour.name,
            tourId: tour.id,
          });
        }
      }

      // Final payment dates
      if (tour.final_payment_date) {
        const finalDate = new Date(tour.final_payment_date);
        if (finalDate >= today && finalDate <= thirtyDaysFromNow) {
          const daysUntil = Math.ceil((finalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          deadlines.push({
            id: `final-payment-${tour.id}`,
            type: 'final_payment',
            title: 'Final Payment Due',
            date: tour.final_payment_date,
            description: tour.name,
            priority: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
            tourName: tour.name,
            tourId: tour.id,
          });
        }
      }
    });

    // Sort by date (earliest first)
    return deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const deadlines = getDeadlines();
  const totalPages = Math.ceil(deadlines.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeadlines = deadlines.slice(startIndex, endIndex);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDaysUntil = (date: string) => {
    const today = new Date();
    const targetDate = new Date(date);
    const daysUntil = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil < 0) return 'Overdue';
    return `${daysUntil} days`;
  };

  const handleRowClick = (deadline: Deadline) => {
    if (deadline.tourId && tours) {
      const tour = tours.find(t => t.id === deadline.tourId);
      if (tour) {
        setSelectedTour(tour);
        setTourDetailModalOpen(true);
      }
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle>All Upcoming Deadlines</DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <DialogDescription>
              Complete list of important dates and payment deadlines in the next 30 days
            </DialogDescription>
          </DialogHeader>

          {deadlines.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No upcoming deadlines in the next 30 days</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead>Tour Name</TableHead>
                      <TableHead>Days Remaining</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentDeadlines.map((deadline) => (
                      <TableRow
                        key={deadline.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => handleRowClick(deadline)}
                      >
                        <TableCell className="font-medium">{deadline.title}</TableCell>
                        <TableCell>{deadline.tourName || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getPriorityColor(deadline.priority)}`}
                          >
                            {getDaysUntil(deadline.date)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateToDDMMYYYY(deadline.date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNumber)}
                              isActive={currentPage === pageNumber}
                              className="cursor-pointer"
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              <div className="text-center text-sm text-muted-foreground mt-4">
                Showing {startIndex + 1} to {Math.min(endIndex, deadlines.length)} of {deadlines.length} deadlines
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TourDetailModal
        tour={selectedTour}
        open={tourDetailModalOpen}
        onOpenChange={setTourDetailModalOpen}
      />
    </>
  );
};
