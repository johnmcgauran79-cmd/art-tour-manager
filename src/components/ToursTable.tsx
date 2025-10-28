
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Search } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";
import { AddTourModal } from "@/components/AddTourModal";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getTourStatusColor, formatStatusText } from "@/lib/statusColors";
import { TourCard } from "@/components/cards/TourCard";
import { ViewToggle } from "@/components/ViewToggle";

interface ToursTableProps {
  showOnlyActive?: boolean;
  onViewAll?: () => void;
}

export const ToursTable = ({ showOnlyActive = false, onViewAll }: ToursTableProps) => {
  const navigate = useNavigate();
  const { data: tours, isLoading } = useTours();
  const { data: bookings } = useBookings();
  const [showAddTour, setShowAddTour] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<'grid' | 'table'>('table');

  // Filter tours based on showOnlyActive prop first
  const filteredByStatus = tours?.filter(tour => {
    if (!showOnlyActive) return true;
    
    // Active tours are not past and have end date in the future or today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    const endDate = new Date(tour.end_date);
    endDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    return tour.status !== 'past' && endDate >= today;
  }) || [];

  // Then filter by search query across all matching tours
  const searchFilteredTours = filteredByStatus.filter(tour => {
    if (!searchQuery.trim()) return true;
    const searchTerm = searchQuery.toLowerCase();
    
    return (
      tour.name.toLowerCase().includes(searchTerm) ||
      tour.tour_host?.toLowerCase().includes(searchTerm) ||
      tour.location?.toLowerCase().includes(searchTerm) ||
      tour.notes?.toLowerCase().includes(searchTerm)
    );
  });

  // Calculate total passengers attending for each tour (confirmed bookings only)
  const getTotalPassengers = (tourId: string) => {
    return bookings?.filter(booking => 
      booking.tour_id === tourId && 
      booking.status !== 'cancelled' && 
      booking.status !== 'waitlisted'
    ).reduce((sum, booking) => sum + booking.passenger_count, 0) || 0;
  };

  const handleTourClick = (tour: any) => {
    navigate(`/tours/${tour.id}`);
  };

  if (isLoading) {
    return <div>Loading tours...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                {showOnlyActive ? 'Active Tours' : 'All Tours'} 
                ({searchFilteredTours.length} {searchQuery ? 'found' : showOnlyActive ? 'active' : 'total'})
              </CardTitle>
              <CardDescription>
                {showOnlyActive 
                  ? 'Current active tours'
                  : 'Complete list of all tours'
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {showOnlyActive && onViewAll && (
                <Button onClick={onViewAll} variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View All
                </Button>
              )}
              <Button 
                onClick={() => setShowAddTour(true)}
                className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tour
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by tour name, host, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <ViewToggle view={view} onViewChange={setView} />
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {searchFilteredTours.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'No tours found matching your search.' 
                  : (showOnlyActive ? 'No active tours found.' : 'No tours found.')
                }
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => setShowAddTour(true)}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Create Your First Tour
                </Button>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchFilteredTours.map((tour) => (
                <TourCard
                  key={tour.id}
                  tour={tour}
                  totalPassengers={getTotalPassengers(tour.id)}
                  onView={handleTourClick}
                  onEdit={() => navigate(`/tours/${tour.id}/edit`)}
                />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tour Name</TableHead>
                  <TableHead>Tour Host</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Total Pax</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchFilteredTours.map((tour) => (
                  <TableRow 
                    key={tour.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTourClick(tour)}
                  >
                    <TableCell className="font-medium">{tour.name}</TableCell>
                    <TableCell>{tour.tour_host}</TableCell>
                    <TableCell>{formatDateToDDMMYYYY(tour.start_date)}</TableCell>
                    <TableCell>{tour.location || '-'}</TableCell>
                    <TableCell>{getTotalPassengers(tour.id)}</TableCell>
                    <TableCell>
                      <Badge className={getTourStatusColor(tour.status)}>
                        {formatStatusText(tour.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={tour.notes || ''}>
                        {tour.notes || '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddTourModal
        open={showAddTour}
        onOpenChange={setShowAddTour}
      />
    </>
  );
};
