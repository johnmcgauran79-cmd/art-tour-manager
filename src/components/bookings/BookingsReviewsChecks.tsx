import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Grid3X3, Tag, AlertTriangle, PhoneOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderBooking } from "@/lib/placeholderBookings";
import { NameTagGeneratorModal } from "@/components/operations/NameTagGeneratorModal";
import { BouncedEmailsReportModal } from "@/components/operations/BouncedEmailsReportModal";

export const BookingsReviewsChecks = () => {
  const navigate = useNavigate();
  const [nameTagOpen, setNameTagOpen] = useState(false);
  const [bouncedEmailsOpen, setBouncedEmailsOpen] = useState(false);

  const { data: bouncedEmailsCount = 0 } = useQuery({
    queryKey: ['bounced-emails-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('email_suppressions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('acknowledged_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: activityMatrixIssuesCount = 0 } = useQuery({
    queryKey: ['activity-matrix-issues-count'],
    queryFn: async () => {
      const [discResult, ackResult] = await Promise.all([
        supabase.rpc('get_activity_allocation_discrepancies'),
        supabase.from('activity_discrepancy_acknowledgments').select('booking_id, activity_id, snapshot_passenger_count, snapshot_allocated_count')
      ]);
      if (discResult.error) throw discResult.error;
      const allDiscrepancies = discResult.data || [];
      const acknowledgments = ackResult.data || [];
      const unacknowledged = allDiscrepancies.filter((disc: any) => {
        const ack = acknowledgments.find(
          (a: any) => a.booking_id === disc.booking_id && a.activity_id === disc.activity_id
        );
        if (!ack) return true;
        return ack.snapshot_passenger_count !== disc.passenger_count ||
               ack.snapshot_allocated_count !== disc.allocated_count;
      });
      const bookingsWithIssues = new Set(unacknowledged.map((d: any) => d.booking_id));
      return bookingsWithIssues.size;
    },
  });

  const { data: missingPhoneCount = 0 } = useQuery({
    queryKey: ['missing-phone-count'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('bookings')
        .select('status, tours!inner(start_date), customers!bookings_lead_passenger_id_fkey(first_name, last_name, phone, phone_missing_acknowledged_at)')
        .neq('status', 'cancelled')
        .gte('tours.start_date', today);
      if (error) throw error;
      return (data || []).filter((b: any) => {
        const c = b.customers;
        const hasPhone = c?.phone && c.phone.trim() !== '';
        if (hasPhone) return false;
        if (c?.phone_missing_acknowledged_at) return false;
        return !isPlaceholderBooking(b.status, c?.first_name, c?.last_name);
      }).length;
    },
  });

  const checkActions = [
    {
      icon: Grid3X3,
      label: "Non-standard Activity Bookings",
      description: "Review all activity allocations",
      count: activityMatrixIssuesCount,
      onClick: () => navigate("/operations/activity-bookings"),
    },
    {
      icon: PhoneOff,
      label: "Missing Phone Numbers",
      description: "Future bookings whose lead passenger has no phone number",
      count: missingPhoneCount,
      onClick: () => navigate("/operations/missing-phone-numbers"),
    },
    {
      icon: AlertTriangle,
      label: "Bounced Emails",
      description: "Email addresses that bounced and are suppressed from sending",
      count: bouncedEmailsCount,
      onClick: () => setBouncedEmailsOpen(true),
    },
    {
      icon: Tag,
      label: "Name Tag Generator",
      description: "Generate first-name lists by tour for printing name tags",
      count: 0,
      onClick: () => setNameTagOpen(true),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Reviews & Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {checkActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant="outline"
                  className="h-auto min-h-[88px] flex-col items-start p-4 hover:bg-brand-navy hover:text-brand-yellow transition-all relative whitespace-normal text-left w-full"
                >
                  {action.count > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 min-w-[24px] h-6 flex items-center justify-center rounded-full px-1.5 z-10 text-xs font-bold shadow-md"
                    >
                      {action.count}
                    </Badge>
                  )}
                  <div className="flex items-start gap-2 mb-2 w-full min-w-0">
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm break-words leading-tight min-w-0 flex-1">{action.label}</span>
                  </div>
                  <span className="text-xs text-left opacity-80 break-words leading-snug w-full">
                    {action.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <NameTagGeneratorModal
        open={nameTagOpen}
        onOpenChange={setNameTagOpen}
      />

      <BouncedEmailsReportModal
        open={bouncedEmailsOpen}
        onOpenChange={setBouncedEmailsOpen}
      />
    </div>
  );
};