import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar, Users, MapPin, Eye, Camera, Upload, Loader2 } from "lucide-react";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { typography } from "@/lib/typography";
import { ContactAvatar } from "@/components/ContactAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BookingCardProps {
  booking: any;
  onView?: (booking: any) => void;
}

export const BookingCard = ({ booking, onView }: BookingCardProps) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const leadPassenger = booking.customers 
    ? `${booking.customers.first_name} ${booking.customers.last_name}`
    : 'Unknown';

  const otherPassengers = [
    booking.passenger_2_name,
    booking.passenger_3_name,
  ].filter(Boolean);

  const avatarUrl = booking.customers?.avatar_url;
  const contactId = booking.customers?.id;
  const initials = booking.customers 
    ? `${booking.customers.first_name?.[0] || ''}${booking.customers.last_name?.[0] || ''}`
    : '?';

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullImage(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contactId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${contactId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update the customer record
      const { error: updateError } = await supabase
        .from('customers')
        .update({ avatar_url: publicUrl })
        .eq('id', contactId);

      if (updateError) throw updateError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      toast.success('Profile photo updated');
      setShowFullImage(false);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {booking.customers && (
                <div 
                  onClick={handleAvatarClick}
                  className="cursor-pointer"
                >
                  <ContactAvatar
                    contactId={booking.customers.id}
                    avatarUrl={avatarUrl || null}
                    firstName={booking.customers.first_name}
                    lastName={booking.customers.last_name}
                    editable={false}
                    size="sm"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className={`${typography.cardTitle} truncate mb-1`}>
                  {leadPassenger}
                </h3>
                {booking.tours?.name && (
                  <div className={`flex items-center gap-1.5 ${typography.metadata}`}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{booking.tours.name}</span>
                  </div>
                )}
              </div>
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

      {/* Full Image Dialog with Update Option */}
      <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
        <DialogContent className="max-w-sm p-4">
          <div className="space-y-4">
            <div className="text-center font-medium">{leadPassenger}</div>
            
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={leadPassenger}
                className="w-full h-auto rounded-lg max-h-80 object-contain"
              />
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-4xl text-muted-foreground">{initials}</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {avatarUrl ? 'Change Photo' : 'Add Photo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
