import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, DollarSign, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useBookings } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useFilterCounts } from "@/hooks/useBookingQueries";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { differenceInDays } from "date-fns";

export default function PaymentStatus() {
  const navigate = useNavigate();
  const { data: allBookings, isLoading: bookingsLoading } = useBookings();
  const { data: tours, isLoading: toursLoading } = useTours();
  const { data: filterCounts } = useFilterCounts();

  const isLoading = bookingsLoading || toursLoading;

  const toursMap = useMemo(() => {
    const map = new Map<string, { name: string; instalment_required: boolean; instalment_date: string | null; final_payment_date: string | null }>();
    tours?.forEach(t => map.set(t.id, {
      name: t.name,
      instalment_required: t.instalment_required,
      instalment_date: t.instalment_date,
      final_payment_date: t.final_payment_date,
    }));
    return map;
  }, [tours]);

  const { depositsOwing, instalmentsOwing, finalPaymentDue } = useMemo(() => {
    if (!allBookings || !tours) return { depositsOwing: [], instalmentsOwing: [], finalPaymentDue: [] };

    const today = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const activeBookings = allBookings.filter(
      (b: any) => b.status !== 'cancelled' && b.status !== 'waitlisted' && b.status !== 'host' && b.status !== 'complimentary'
    );

    // Deposits owing: invoiced status 7+ days after booking created
    const deposits = activeBookings.filter((b: any) => {
      if (b.status !== 'invoiced') return false;
      return new Date(b.created_at) < cutoffDate;
    });

    // Instalments owing
    const instalments = activeBookings.filter((b: any) => {
      const tour = toursMap.get(b.tour_id);
      if (!tour?.instalment_required || !tour.instalment_date) return false;
      if (today <= new Date(tour.instalment_date)) return false;
      return b.status !== 'instalment_paid' && b.status !== 'fully_paid';
    });

    // Final payment due
    const finalPayment = activeBookings.filter((b: any) => {
      const tour = toursMap.get(b.tour_id);
      if (!tour?.final_payment_date) return false;
      if (today <= new Date(tour.final_payment_date)) return false;
      return b.status !== 'fully_paid';
    });

    return { depositsOwing: deposits, instalmentsOwing: instalments, finalPaymentDue: finalPayment };
  }, [allBookings, tours, toursMap]);

  // Group bookings by tour
  const groupByTour = (bookings: any[]) => {
    const groups = new Map<string, { tourName: string; bookings: any[] }>();
    bookings.forEach(b => {
      const tourName = b.tours?.name || toursMap.get(b.tour_id)?.name || 'Unknown Tour';
      if (!groups.has(b.tour_id)) {
        groups.set(b.tour_id, { tourName, bookings: [] });
      }
      groups.get(b.tour_id)!.bookings.push(b);
    });
    // Sort by tour name
    return Array.from(groups.entries()).sort((a, b) => a[1].tourName.localeCompare(b[1].tourName));
  };

  const totalIssues = (filterCounts?.depositsOwing || 0) + (filterCounts?.instalmentsOwing || 0) + (filterCounts?.paymentDue || 0);

  const renderBookingRow = (booking: any) => {
    const customer = booking.customers;
    const passengerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : 'Unknown';
    const statusColor = getBookingStatusColor(booking.status);

    return (
      <TableRow
        key={booking.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => navigate(`/bookings/${booking.id}`)}
      >
        <TableCell className="font-medium">{passengerName}</TableCell>
        <TableCell>{booking.group_name || '—'}</TableCell>
        <TableCell>{booking.tours?.name || toursMap.get(booking.tour_id)?.name || '—'}</TableCell>
        <TableCell>{formatDateToDDMMYYYY(booking.created_at)}</TableCell>
        <TableCell>
          <Badge className={statusColor}>{formatStatusText(booking.status)}</Badge>
        </TableCell>
      </TableRow>
    );
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    bookings: any[],
    badgeVariant: "destructive" | "default" | "secondary" | "outline",
    description: string
  ) => {
    const groups = groupByTour(bookings);

    return (
      <Card className="border-brand-navy/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg">
              {icon}
              {title}
            </div>
            <Badge variant={bookings.length > 0 ? badgeVariant : "secondary"}>
              {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CheckCircle className="h-4 w-4 text-green-500" />
              No outstanding issues
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(([tourId, group]) => (
                <div key={tourId}>
                  <h4 className="text-sm font-semibold text-brand-navy mb-2">{group.tourName}</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Passenger Name</TableHead>
                          <TableHead>Group</TableHead>
                          <TableHead>Tour</TableHead>
                          <TableHead>Booking Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.bookings.map(renderBookingRow)}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="p-6"><div className="text-center">Loading payment status...</div></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppBreadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Operations", href: "/?tab=operations" },
          { label: "Payment Status Report" }
        ]}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/?tab=operations")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Status Report</h1>
          <p className="text-muted-foreground">
            Review outstanding deposits, instalments and final payments across all tours
          </p>
        </div>
        {totalIssues > 0 && (
          <Badge variant="destructive" className="ml-auto text-lg px-3 py-1">
            {totalIssues} total issues
          </Badge>
        )}
      </div>

      {renderSection(
        "Deposits Owing",
        <Clock className="h-5 w-5 text-amber-500" />,
        depositsOwing,
        "destructive",
        "Bookings with 'Invoiced' status for 7+ days without deposit payment"
      )}

      {renderSection(
        "Instalments Owing",
        <AlertTriangle className="h-5 w-5 text-orange-500" />,
        instalmentsOwing,
        "destructive",
        "Bookings past the instalment due date that haven't paid their instalment"
      )}

      {renderSection(
        "Final Payment Due",
        <DollarSign className="h-5 w-5 text-red-500" />,
        finalPaymentDue,
        "destructive",
        "Bookings past the final payment date that are not fully paid"
      )}
    </div>
  );
}
