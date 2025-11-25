import { AuditLogEntry } from "@/hooks/useBookingAuditLog";
import { formatDistanceToNow } from "date-fns";
import { User, Clock, FileText } from "lucide-react";

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
        } else if (key === 'dietary_restrictions') {
          changes.push(`Dietary restrictions updated`);
        } else if (key === 'medical_conditions') {
          changes.push(`Medical conditions updated`);
        } else if (key === 'accessibility_needs') {
          changes.push(`Accessibility needs updated`);
        } else if (key === 'emergency_contact') {
          changes.push(`Emergency contact updated`);
        } else if (key === 'passport') {
          changes.push(`Passport information updated`);
        }
      });
    }

    if (operation === 'ADD_HOTEL_TO_BOOKING') {
      changes.push(`Check-in: ${details.check_in || 'TBD'}`);
      changes.push(`Check-out: ${details.check_out || 'TBD'}`);
      changes.push(`Bedding: ${details.bedding || 'TBD'}`);
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

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
        <p>No audit trail entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const userName = entry.profiles
          ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() || entry.profiles.email || 'Unknown User'
          : 'System';
        
        const changes = formatChangeDetails(entry.operation_type, entry.details);

        return (
          <div key={entry.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatOperationType(entry.operation_type)}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              by {userName}
            </div>

            {changes.length > 0 && (
              <div className="mt-2 pl-6 border-l-2 border-border space-y-1">
                {changes.map((change, idx) => (
                  <div key={idx} className="text-sm text-foreground">
                    {change}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
