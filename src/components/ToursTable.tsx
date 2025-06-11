
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Search } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";
import { TourDetailModal } from "@/components/TourDetailModal";
import { AddTourModal } from "@/components/AddTourModal";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface ToursTableProps {
  showOnlyActive?: boolean;
  onViewAll?: () => void;
}

export const ToursTable = ({ showOnlyActive = false, onViewAll }: ToursTableProps) => {
  const { data: tours, isLoading } = useTours();
  const { data: bookings } = useBookings();
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [showTourDetail, setShowTourDetail] = useState(false);
  const [showAddTour, setShowAddTour] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter tours based on showOnlyActive prop
  const filteredTours = tours?.filter(tour => {
    if (!showOnlyActive) return true;
    
    // Active tours are not past and have start date in the future
    const today = new Date();
    const startDate = new Date(tour.start_date);
    return tour.status !== 'past' && startDate > today;
  }) || [];

  // Further filter tours based on search query
  const searchFilteredTours = filteredTours.filter(tour => {
    if (!searchQuery) return true;
    return tour.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Calculate total passengers attending for each tour
  const getTotalPassengers = (tourId: string) => {
    return bookings?.filter(booking => 
      booking.tour_id === tourId && booking.status !== 'cancelled'
    ).reduce((sum, booking) => sum + booking.passenger_count, 0) || 0;
  };

  const handleTourClick = (tour: any) => {
    setSelectedTour(tour);
    setShowTourDetail(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'sold_out': return 'bg-red-100 text-red-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'past': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
              <CardTitle>{showOnlyActive ? 'Active Tours' : 'All Tours'}</CardTitle>
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
          <div className="flex items-center space-x-2 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by tour name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {searchFilteredTours.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No tours found matching your search.' : (showOnlyActive ? 'No active tours found.' : 'No tours found.')}
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
                      <Badge className={getStatusColor(tour.status)}>
                        {tour.status.replace('_', ' ').toUpperCase()}
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

      <TourDetailModal
        tour={selectedTour}
        open={showTourDetail}
        onOpenChange={setShowTourDetail}
      />

      <AddTourModal
        open={showAddTour}
        onOpenChange={setShowAddTour}
      />
    </>
  );
};
