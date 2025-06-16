
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Calendar, FileText, Mail, Settings } from "lucide-react";

interface QuickActionsPanelProps {
  onAddBooking: () => void;
  onAddTour: () => void;
  onAddContact: () => void;
  onViewBookings: () => void;
  onViewTours: () => void;
  onViewContacts: () => void;
}

export const QuickActionsPanel = ({
  onAddBooking,
  onAddTour,
  onAddContact,
  onViewBookings,
  onViewTours,
  onViewContacts,
}: QuickActionsPanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>
          Common tasks and shortcuts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Button
            onClick={onAddBooking}
            className="flex flex-col h-auto py-4 px-3 bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            <Plus className="h-5 w-5 mb-2" />
            <span className="text-sm">New Booking</span>
          </Button>
          
          <Button
            onClick={onAddTour}
            variant="outline"
            className="flex flex-col h-auto py-4 px-3 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
          >
            <Calendar className="h-5 w-5 mb-2" />
            <span className="text-sm">New Tour</span>
          </Button>
          
          <Button
            onClick={onAddContact}
            variant="outline"
            className="flex flex-col h-auto py-4 px-3 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
          >
            <Users className="h-5 w-5 mb-2" />
            <span className="text-sm">New Contact</span>
          </Button>
          
          <Button
            onClick={onViewBookings}
            variant="ghost"
            className="flex flex-col h-auto py-4 px-3 hover:bg-accent"
          >
            <FileText className="h-5 w-5 mb-2" />
            <span className="text-sm">View Bookings</span>
          </Button>
          
          <Button
            onClick={onViewTours}
            variant="ghost"
            className="flex flex-col h-auto py-4 px-3 hover:bg-accent"
          >
            <Calendar className="h-5 w-5 mb-2" />
            <span className="text-sm">View Tours</span>
          </Button>
          
          <Button
            onClick={onViewContacts}
            variant="ghost"
            className="flex flex-col h-auto py-4 px-3 hover:bg-accent"
          >
            <Users className="h-5 w-5 mb-2" />
            <span className="text-sm">View Contacts</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
