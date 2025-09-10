import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSendBookingConfirmation } from "@/hooks/useBookingEmail";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
}

interface BookingEmailData {
  subject: string;
  recipientEmail: string;
  recipientName: string;
  htmlContent: string;
}

export const EmailPreviewModal = ({ open, onOpenChange, bookingId }: EmailPreviewModalProps) => {
  const [emailData, setEmailData] = useState<BookingEmailData | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const sendEmail = useSendBookingConfirmation();

  // Fetch booking details to generate email preview
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-email-preview', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours:tour_id (name, start_date, end_date, location),
          customers:lead_passenger_id (first_name, last_name, email),
          hotel_bookings (
            check_in_date,
            check_out_date,
            room_type,
            room_upgrade,
            bedding,
            hotels (name)
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId && open,
  });

  useEffect(() => {
    if (booking) {
      const subject = `Booking Confirmation - ${booking.tours?.name || 'Your Tour'}`;
      const recipientEmail = booking.customers?.email || '';
      const recipientName = `${booking.customers?.first_name} ${booking.customers?.last_name}`;

      // Generate hotel details
      const hotelDetails = booking.hotel_bookings?.map((hb: any) => 
        `• ${hb.hotels?.name || 'Hotel TBD'}: ${new Date(hb.check_in_date).toLocaleDateString()} - ${new Date(hb.check_out_date).toLocaleDateString()}, ${hb.room_type || 'Standard'} room, ${hb.bedding || 'Double'} bed${hb.room_upgrade ? `, Upgrade: ${hb.room_upgrade}` : ''}`
      ).join('\n') || 'No hotel bookings';

      const textContent = `
Dear ${recipientName},

Thank you for your booking! Please find your booking confirmation details below:

TOUR DETAILS:
• Tour: ${booking.tours?.name || 'TBD'}
• Location: ${booking.tours?.location || 'TBD'}
• Tour Dates: ${booking.tours?.start_date ? new Date(booking.tours.start_date).toLocaleDateString() : 'TBD'} - ${booking.tours?.end_date ? new Date(booking.tours.end_date).toLocaleDateString() : 'TBD'}

PASSENGER INFORMATION:
• Lead Passenger: ${recipientName}
• Total Passengers: ${booking.passenger_count}${booking.passenger_2_name ? `\n• Passenger 2: ${booking.passenger_2_name}` : ''}${booking.passenger_3_name ? `\n• Passenger 3: ${booking.passenger_3_name}` : ''}${booking.group_name ? `\n• Group Name: ${booking.group_name}` : ''}

ACCOMMODATION:
${hotelDetails}${booking.dietary_restrictions ? `\n\nDIETARY REQUIREMENTS:\n${booking.dietary_restrictions}` : ''}${booking.extra_requests ? `\n\nSPECIAL REQUESTS:\n${booking.extra_requests}` : ''}

If you have any questions or need to make changes to your booking, please reply to this email and we'll get back to you promptly.

Best regards,
The Team
      `.trim();

      setEmailData({
        subject,
        recipientEmail,
        recipientName,
        htmlContent: textContent
      });
      setEditedSubject(subject);
      setEditedContent(textContent);
    }
  }, [booking]);

  const handleSendEmail = async () => {
    if (!bookingId) return;
    
    try {
      await sendEmail.mutateAsync(bookingId);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (!bookingId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Email Preview & Approval</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading email preview...</span>
          </div>
        ) : emailData ? (
          <div className="flex-1 space-y-4 overflow-hidden">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="recipient">To:</Label>
                <Input
                  id="recipient"
                  value={`${emailData.recipientName} <${emailData.recipientEmail}>`}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject:</Label>
                <Input
                  id="subject"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1">
              <Label htmlFor="content">Email Content:</Label>
              <ScrollArea className="h-64 mt-2 border rounded-md">
                <Textarea
                  id="content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[240px] border-0 resize-none"
                  placeholder="Email content..."
                />
              </ScrollArea>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Preview:</h4>
              <ScrollArea className="h-32 bg-white p-3 rounded border">
                <pre className="text-sm whitespace-pre-wrap font-sans">
                  {editedContent}
                </pre>
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendEmail.isPending || !editedContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendEmail.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Approve & Send Email'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No booking data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};