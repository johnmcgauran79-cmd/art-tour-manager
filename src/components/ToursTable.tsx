
import { useState } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Eye, Search } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { useBookings } from "@/hooks/useBookings";
import { AddTourModal } from "@/components/AddTourModal";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getTourStatusColor, formatStatusText } from "@/lib/statusColors";
import { TourCard } from "@/components/cards/TourCard";
import { ViewToggle } from "@/components/ViewToggle";
import { useAuth } from "@/hooks/useAuth";

interface ToursTableProps {
  showOnlyActive?: boolean;
  onViewAll?: () => void;
}

export const ToursTable = ({ showOnlyActive = false, onViewAll }: ToursTableProps) => {
  const { navigateWithContext } = useNavigationContext();
  const { data: tours, isLoading } = useTours();
  const { data: bookings } = useBookings();
  const { userRole } = useAuth();
  const [showAddTour, setShowAddTour] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [showArchived, setShowArchived] = useState(false);
  
  // Agent and host users have view-only access
  const isAgent = userRole === 'agent';
  const isHost = userRole === 'host';
  const isViewOnly = isAgent || isHost;

  // Filter tours based on archived status and showOnlyActive prop
  const filteredByStatus = tours?.filter(tour => {
    // First, filter out archived tours unless showArchived is true
    if (!showArchived && (tour.status as string) === 'archived') {
      return false;
    }
    
    // If showing only active tours, apply the active filter
    if (showOnlyActive) {
      // Active tours are not past, archived, or cancelled, and have end date in the future or today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(tour.end_date);
      endDate.setHours(0, 0, 0, 0);
      const status = tour.status as string;
      return status !== 'past' && status !== 'archived' && status !== 'cancelled' && endDate >= today;
    }
    
    return true;
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
    navigateWithContext(`/tours/${tour.id}`);
  };

  if (isLoading) {
    return <div>Loading tours...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          {/* Title and buttons - stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                {showOnlyActive ? 'Active Tours' : 'All Tours'}{' '}
                ({searchFilteredTours.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {showOnlyActive 
                  ? 'Current active tours'
                  : 'Complete list of all tours'
                }
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showOnlyActive && onViewAll && (
                <Button onClick={onViewAll} variant="outline" size="sm">
                  <Eye className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">View All</span>
                </Button>
              )}
              {!isViewOnly && (
                <Button 
                  onClick={() => setShowAddTour(true)}
                  size="sm"
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Tour</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Search, filters, and toggle - stacks on mobile */}
          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search tours..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="show-archived" 
                  checked={showArchived}
                  onCheckedChange={(checked) => setShowArchived(checked as boolean)}
                />
                <Label 
                  htmlFor="show-archived" 
                  className="text-xs sm:text-sm font-medium leading-none cursor-pointer whitespace-nowrap"
                >
                  Show Archived
                </Label>
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
                  onEdit={() => navigateWithContext(`/tours/${tour.id}/edit`)}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Mobile card view for table mode */}
              <div className="block md:hidden space-y-3">
                {searchFilteredTours.map((tour) => (
                  <TourCard
                    key={tour.id}
                    tour={tour}
                    totalPassengers={getTotalPassengers(tour.id)}
                    onView={handleTourClick}
                    onEdit={() => navigateWithContext(`/tours/${tour.id}/edit`)}
                  />
                ))}
              </div>
              
              {/* Desktop table view */}
              <div className="hidden md:block border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Tour Name</TableHead>
                      <TableHead className="min-w-[120px]">Tour Host</TableHead>
                      <TableHead className="min-w-[100px]">Start Date</TableHead>
                      <TableHead className="min-w-[120px]">Location</TableHead>
                      <TableHead className="min-w-[80px]">Total Pax</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[150px]">Notes</TableHead>
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
                          <div className="max-w-[150px] truncate" title={tour.notes || ''}>
                            {tour.notes || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
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
