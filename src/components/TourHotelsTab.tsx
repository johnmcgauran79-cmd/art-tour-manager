
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Bed, Edit, FileText, Users, NotebookPen, Calculator, Bell, Copy } from "lucide-react";
import { useHotels, Hotel } from "@/hooks/useHotels";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { HotelNightsBreakdownModal } from "@/components/HotelNightsBreakdownModal";
import { AddHotelModal } from "@/components/AddHotelModal";
import { StatusBadge, hotelStatusConfig } from "@/components/ui/status-badge";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTabAlerts } from "@/hooks/useTabAlerts";
import { TourAlert } from "@/hooks/useTourAlerts";

interface TourHotelsTabProps {
  tourId: string;
  alerts: TourAlert[];
  onAddHotel: () => void;
  onEditHotel: (hotel: any) => void;
  onRoomingList: (hotel: any) => void;
  onBulkEdit: (hotel: any) => void;
  onOpenAlerts?: () => void;
}

export const TourHotelsTab = ({ tourId, alerts, onAddHotel, onEditHotel, onRoomingList, onBulkEdit, onOpenAlerts }: TourHotelsTabProps) => {
  const { data: hotels } = useHotels(tourId);
  const [selectedHotelForBreakdown, setSelectedHotelForBreakdown] = useState<Hotel | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const { userRole } = useAuth();
  const { count: alertCount, criticalCount } = useTabAlerts(alerts, "hotels");
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  const calculateNights = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 0;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Hotels</h3>
          {alertCount > 0 && (
            <button 
              onClick={onOpenAlerts}
              className="relative cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-destructive' : 'text-yellow-600'}`} />
              <Badge 
                variant={criticalCount > 0 ? "destructive" : "secondary"}
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {alertCount}
              </Badge>
            </button>
          )}
        </div>
        {!isAgent && (
          <Button 
            onClick={onAddHotel}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Add Hotel
          </Button>
        )}
      </div>

      {hotels && hotels.length > 0 ? (
        <div className="grid gap-4">
          {hotels.map((hotel) => (
            <Card key={hotel.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{hotel.name}</CardTitle>
                    <StatusBadge 
                      status={hotel.booking_status}
                      variant={hotelStatusConfig[hotel.booking_status as keyof typeof hotelStatusConfig]?.variant || 'default'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditHotel(hotel)}
                      className="flex items-center gap-1"
                      disabled={isAgent}
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDuplicateData({
                          name: hotel.name,
                          address: hotel.address || "",
                          contact_name: hotel.contact_name || "",
                          contact_phone: hotel.contact_phone || "",
                          contact_email: hotel.contact_email || "",
                          rooms_reserved: hotel.rooms_reserved?.toString() || "",
                          booking_status: "pending",
                          default_room_type: hotel.default_room_type || "",
                          default_check_in: "",
                          default_check_out: "",
                          extra_night_price: hotel.extra_night_price?.toString() || "",
                          operations_notes: hotel.operations_notes || "",
                          upgrade_options: hotel.upgrade_options || "",
                          cancellation_policy: (hotel as any).cancellation_policy || "",
                          initial_rooms_cutoff_date: "",
                          final_rooms_cutoff_date: "",
                        });
                        setShowDuplicateModal(true);
                      }}
                      className="flex items-center gap-1"
                      disabled={isAgent}
                    >
                      <Copy className="h-3 w-3" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onBulkEdit(hotel)}
                      className="flex items-center gap-1"
                      disabled={isAgent}
                    >
                      <Users className="h-3 w-3" />
                      Bulk Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRoomingList(hotel)}
                      className="flex items-center gap-1"
                      disabled={isAgent}
                    >
                      <FileText className="h-3 w-3" />
                      Rooming List
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {hotel.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{hotel.address}</span>
                    </div>
                  )}
                  {hotel.default_check_in && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Check-in: {formatDateToDDMMYYYY(hotel.default_check_in)}</span>
                    </div>
                  )}
                  {hotel.default_check_out && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Check-out: {formatDateToDDMMYYYY(hotel.default_check_out)}</span>
                    </div>
                  )}
                  {hotel.default_check_in && hotel.default_check_out && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>Nights: {calculateNights(hotel.default_check_in, hotel.default_check_out)}</span>
                    </div>
                  )}
                  {hotel.default_room_type && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>Room Type: {hotel.default_room_type}</span>
                    </div>
                  )}
                  {hotel.extra_night_price && (
                    <div className="flex items-center gap-1">
                      <span>Extra Night: ${hotel.extra_night_price}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <span>Rooms Reserved: {hotel.rooms_reserved || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <span>Rooms Booked: {hotel.rooms_booked || 0}</span>
                  </div>
                  {/* Total Room Nights calculation */}
                  <div className="flex items-center gap-1">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span>Total Room Nights: {hotel.total_nights || 0}</span>
                  </div>
                </div>

                {/* Operations Notes */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-start gap-2">
                    <NotebookPen className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm font-bold">Operations Notes:</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                        {hotel.operations_notes || <span className="text-muted-foreground italic">Nil</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Third row with cutoff dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t">
                  {(hotel as any).initial_rooms_cutoff_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Initial Cutoff: {formatDateToDDMMYYYY((hotel as any).initial_rooms_cutoff_date)}</span>
                    </div>
                  )}
                  {(hotel as any).final_rooms_cutoff_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Final Cutoff: {formatDateToDDMMYYYY((hotel as any).final_rooms_cutoff_date)}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm font-bold">Cancellation:</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                        {(hotel as any).cancellation_policy || <span className="text-muted-foreground italic">Nil</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upgrade Options */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-start gap-2">
                    <Bed className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm font-bold">Upgrade Options:</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                        {hotel.upgrade_options || <span className="text-muted-foreground italic">Nil</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No hotels added yet.</p>
          <Button 
            onClick={onAddHotel}
            className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Add First Hotel
          </Button>
        </div>
      )}

      {selectedHotelForBreakdown && (
        <HotelNightsBreakdownModal
          hotelId={selectedHotelForBreakdown.id}
          hotelName={selectedHotelForBreakdown.name}
          open={!!selectedHotelForBreakdown}
          onOpenChange={(open) => !open && setSelectedHotelForBreakdown(null)}
        />
      )}
    </div>
  );
};
