import { useBookingTravelDocs } from "@/hooks/useBookingTravelDocs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { CheckCircle2, AlertCircle, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BookingTravelDocsDisplayProps {
  bookingId: string;
  passengerCount: number;
  leadPassenger?: {
    first_name: string;
    last_name: string;
  } | null;
  passenger2?: {
    first_name: string;
    last_name: string;
  } | null;
  passenger3?: {
    first_name: string;
    last_name: string;
  } | null;
}

export const BookingTravelDocsDisplay = ({
  bookingId,
  passengerCount,
  leadPassenger,
  passenger2,
  passenger3,
}: BookingTravelDocsDisplayProps) => {
  const { data: travelDocs = [], isLoading } = useBookingTravelDocs(bookingId);

  const getPassengerName = (slot: number): string => {
    switch (slot) {
      case 1:
        return leadPassenger ? `${leadPassenger.first_name} ${leadPassenger.last_name}` : 'Lead Passenger';
      case 2:
        return passenger2 ? `${passenger2.first_name} ${passenger2.last_name}` : 'Passenger 2';
      case 3:
        return passenger3 ? `${passenger3.first_name} ${passenger3.last_name}` : 'Passenger 3';
      default:
        return `Passenger ${slot}`;
    }
  };

  const getPassengerLabel = (slot: number): string => {
    switch (slot) {
      case 1:
        return 'Lead';
      case 2:
        return 'Pax 2';
      case 3:
        return 'Pax 3';
      default:
        return `Pax ${slot}`;
    }
  };

  const hasDocuments = (doc: typeof travelDocs[0] | undefined): boolean => {
    if (!doc) return false;
    return !!(doc.passport_number || doc.passport_first_name || doc.passport_surname || doc.nationality || doc.date_of_birth);
  };

  const isPassportExpiringSoon = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return expiry <= sixMonthsFromNow;
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading travel documents...</div>;
  }

  // Build array of expected passengers based on passenger_count
  const expectedSlots = Array.from({ length: passengerCount }, (_, i) => i + 1);
  
  // Create a map of existing docs by slot
  const docsMap = new Map(travelDocs.map(doc => [doc.passenger_slot, doc]));

  // Check if any documents exist
  const hasAnyDocs = travelDocs.length > 0 && travelDocs.some(hasDocuments);

  if (!hasAnyDocs) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No travel documents have been submitted yet. Use the "Request Travel Docs" button to send a request to passengers.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Passenger</TableHead>
              <TableHead>First Name (Passport)</TableHead>
              <TableHead>Middle Name (Passport)</TableHead>
              <TableHead>Surname (Passport)</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Passport Number</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Nationality</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expectedSlots.map(slot => {
              const doc = docsMap.get(slot);
              const hasDoc = hasDocuments(doc);
              const expiringSoon = doc?.passport_expiry_date ? isPassportExpiringSoon(doc.passport_expiry_date) : false;

              return (
                <TableRow key={slot}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{getPassengerName(slot)}</div>
                        <Badge variant="outline" className="text-xs mt-0.5">
                          {getPassengerLabel(slot)}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.passport_first_name || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.passport_middle_name || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.passport_surname || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.date_of_birth ? formatDateToDDMMYYYY(doc.date_of_birth) : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {doc?.passport_number || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.passport_expiry_date ? (
                      <span className={expiringSoon ? 'text-destructive font-medium' : ''}>
                        {formatDateToDDMMYYYY(doc.passport_expiry_date)}
                        {expiringSoon && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Expiring Soon
                          </Badge>
                        )}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.passport_country || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {doc?.nationality || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasDoc ? (
                      <CheckCircle2 className="h-5 w-5 mx-auto" style={{ color: 'hsl(var(--chart-2))' }} />
                    ) : (
                      <AlertCircle className="h-5 w-5 mx-auto" style={{ color: 'hsl(var(--chart-4))' }} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Travel documents are securely stored and automatically purged 30 days after the tour ends.
      </p>
    </div>
  );
};
