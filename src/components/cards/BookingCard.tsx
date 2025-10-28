import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MapPin, Eye } from "lucide-react";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";

interface BookingCardProps {
  booking: any;
  onView?: (booking: any) => void;
}

export const BookingCard = ({ booking, onView }: BookingCardProps) => {
  const leadPassenger = booking.customers 
    ? `${booking.customers.first_name} ${booking.customers.last_name}`
    : 'Unknown';

  const otherPassengers = [
    booking.passenger_2_name,
    booking.passenger_3_name,
  ].filter(Boolean);

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate mb-1">
              {leadPassenger}
            </h3>
            {booking.tours?.name && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{booking.tours.name}</span>
              </div>
            )}
          </div>
          <Badge className={getBookingStatusColor(booking.status || 'pending')}>
            {formatStatusText(booking.status || 'pending')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Check In</div>
              <div className="font-medium truncate">{formatDateToDDMMYYYY(booking.check_in_date)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Check Out</div>
              <div className="font-medium truncate">{formatDateToDDMMYYYY(booking.check_out_date)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Passengers</div>
              <div className="font-medium">{booking.passenger_count || 1}</div>
            </div>
          </div>

          {booking.total_nights && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Nights</div>
                <div className="font-medium">{booking.total_nights}</div>
              </div>
            </div>
          )}
        </div>

        {/* Other Passengers */}
        {otherPassengers.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Other Passengers</div>
            <div className="text-sm space-y-0.5">
              {otherPassengers.map((name, idx) => (
                <div key={idx} className="truncate">{name}</div>
              ))}
            </div>
          </div>
        )}

        {/* Group Name */}
        {booking.group_name && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Group</div>
            <div className="text-sm font-medium truncate">{booking.group_name}</div>
          </div>
        )}

        {/* Notes */}
        {booking.extra_requests && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Notes</div>
            <div className="text-sm line-clamp-2">{booking.extra_requests}</div>
          </div>
        )}

        {/* Actions */}
        {onView && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(booking);
              }}
              className="w-full hover-scale"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              View Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
