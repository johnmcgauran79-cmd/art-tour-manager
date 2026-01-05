import { AuditLogEntry } from "@/hooks/useBookingAuditLog";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BookingAuditTrailProps {
  entries: AuditLogEntry[];
}

export const BookingAuditTrail = ({ entries }: BookingAuditTrailProps) => {
  const formatOperationType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'CREATE_BOOKING': 'Created booking',
      'UPDATE_BOOKING': 'Updated booking',
      'ADD_HOTEL_TO_BOOKING': 'Added hotel',
      'UPDATE_HOTEL_BOOKING': 'Updated hotel',
      'REMOVE_HOTEL_FROM_BOOKING': 'Removed hotel',
      'ADD_ACTIVITY_TO_BOOKING': 'Added activity',
      'UPDATE_ACTIVITY_BOOKING': 'Updated activity',
      'REMOVE_ACTIVITY_FROM_BOOKING': 'Removed activity',
      'DELETE_BOOKING': 'Deleted booking',
    };
    return typeMap[type] || type;
  };

  const formatChangeDetails = (operation: string, details: any): string[] => {
    const changes: string[] = [];

    if (operation === 'CREATE_BOOKING') {
      changes.push(`Passenger count: ${details.passenger_count}`);
      changes.push(`Status: ${details.status}`);
      return changes;
    }

    if (operation === 'UPDATE_BOOKING') {
      Object.keys(details).forEach(key => {
        const change = details[key];
        if (key === 'status') {
          changes.push(`Status: ${change.old} → ${change.new}`);
        } else if (key === 'passenger_count') {
          changes.push(`Passenger count: ${change.old} → ${change.new}`);
        } else if (key === 'check_in_date') {
          changes.push(`Check-in date: ${change.old || 'none'} → ${change.new || 'none'}`);
        } else if (key === 'check_out_date') {
          changes.push(`Check-out date: ${change.old || 'none'} → ${change.new || 'none'}`);
        } else if (key === 'accommodation_required') {
          changes.push(`Accommodation required: ${change.old ? 'Yes' : 'No'} → ${change.new ? 'Yes' : 'No'}`);
        } else if (key === 'passport') {
          changes.push(`Passport information updated`);
        }
      });
    }

    if (operation === 'ADD_HOTEL_TO_BOOKING') {
      changes.push(`Check-in: ${details.check_in || 'TBD'}, Check-out: ${details.check_out || 'TBD'}, Bedding: ${details.bedding || 'TBD'}`);
    }

    if (operation === 'UPDATE_HOTEL_BOOKING') {
      if (details.hotel_dates) {
        changes.push(`Hotel dates: ${details.hotel_dates.old.check_in} to ${details.hotel_dates.old.check_out} → ${details.hotel_dates.new.check_in} to ${details.hotel_dates.new.check_out}`);
      }
      if (details.bedding) {
        changes.push(`Bedding: ${details.bedding.old} → ${details.bedding.new}`);
      }
    }

    if (operation === 'ADD_ACTIVITY_TO_BOOKING') {
      changes.push(`Passengers attending: ${details.passengers_attending}`);
    }

    if (operation === 'UPDATE_ACTIVITY_BOOKING') {
      if (details.passengers_attending) {
        changes.push(`Passengers attending: ${details.passengers_attending.old} → ${details.passengers_attending.new}`);
      }
    }

    return changes;
  };

  // Filter out generic UPDATE_BOOKING entries since specific changes are tracked separately
  const filteredEntries = entries.filter(entry => entry.operation_type !== 'UPDATE_BOOKING');

  if (filteredEntries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
        <p>No audit trail entries yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Date & Time</TableHead>
            <TableHead className="w-[150px]">User</TableHead>
            <TableHead className="w-[180px]">Action</TableHead>
            <TableHead>Changes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredEntries.map((entry) => {
            const userName = entry.profiles
              ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email || 'Unknown User'
              : 'System';
            
            const changes = formatChangeDetails(entry.operation_type, entry.details);

            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-sm">
                  {format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-sm">{userName}</TableCell>
                <TableCell className="text-sm">{formatOperationType(entry.operation_type)}</TableCell>
                <TableCell className="text-sm">
                  {changes.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {changes.map((change, idx) => (
                        <li key={idx}>{change}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
