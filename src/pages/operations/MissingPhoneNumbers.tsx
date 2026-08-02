import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, PhoneOff, CheckCircle, RefreshCw, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getBookingStatusColor, formatStatusText } from "@/lib/statusColors";
import { isPlaceholderBooking } from "@/lib/placeholderBookings";
import { toast } from "sonner";

export default function MissingPhoneNumbers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["missing-phone-numbers"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, group_name, status, tour_id, lead_passenger_id, tours!inner(name, start_date), customers!bookings_lead_passenger_id_fkey(id, first_name, last_name, phone, phone_missing_acknowledged_at)"
        )
        .neq("status", "cancelled")
        .gte("tours.start_date", today)
        .order("start_date", { foreignTable: "tours", ascending: true });

      if (error) throw error;

      return (data || []).filter((b: any) => {
        const c = b.customers;
        const hasPhone = c?.phone && c.phone.trim() !== "";
        if (hasPhone) return false;
        if (isPlaceholderBooking(b.status, c?.first_name, c?.last_name)) return false;
        if (c?.phone_missing_acknowledged_at) return false;
        return true;
      });
    },
  });

  const acknowledge = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .from("customers")
        .update({ phone_missing_acknowledged_at: new Date().toISOString() })
        .eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missing-phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["missing-phone-count"] });
      toast.success("Acknowledged — hidden from report");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to acknowledge"),
  });

  const refreshAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("customers")
        .update({ phone_missing_acknowledged_at: null })
        .not("phone_missing_acknowledged_at", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missing-phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["missing-phone-count"] });
      toast.success("Report refreshed — previously acknowledged entries are back");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to refresh"),
  });

  const groups = useMemo(() => {
    const map = new Map<string, { tourName: string; startDate: string | null; bookings: any[] }>();
    rows.forEach((b: any) => {
      const tourName = b.tours?.name || "Unknown Tour";
      if (!map.has(b.tour_id)) {
        map.set(b.tour_id, { tourName, startDate: b.tours?.start_date ?? null, bookings: [] });
      }
      map.get(b.tour_id)!.bookings.push(b);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      return a.tourName.localeCompare(b.tourName);
    });
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="p-6"><div className="text-center">Loading report...</div></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppBreadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Bookings", href: "/?tab=bookings" },
          { label: "Missing Phone Numbers" },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/?tab=bookings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Missing Phone Numbers</h1>
          <p className="text-muted-foreground">
            Future bookings whose lead passenger has no contact phone number on file
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {rows.length > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {rows.length} booking{rows.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Refresh the report? This clears all acknowledgments so any lead passenger still missing a phone number will re-appear.")) {
                refreshAll.mutate();
              }
            }}
            disabled={refreshAll.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshAll.isPending ? "animate-spin" : ""}`} />
            Refresh Report
          </Button>
        </div>
      </div>

      <Card className="border-brand-navy/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PhoneOff className="h-5 w-5 text-red-500" />
            Lead Passengers Without a Phone Number
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Placeholder and cancelled bookings are excluded
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Every future booking has a lead passenger phone number
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.tourName}>
                  <h4 className="text-sm font-semibold text-brand-navy mb-2">
                    {group.tourName}
                    {group.startDate && (
                      <span className="text-muted-foreground font-normal"> — {formatDateToDDMMYYYY(group.startDate)}</span>
                    )}
                  </h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead Passenger</TableHead>
                          <TableHead>Group</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[140px] text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.bookings.map((b: any) => {
                          const c = b.customers;
                          const name = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "Unknown";
                          return (
                            <TableRow
                              key={b.id}
                              className="hover:bg-muted/50"
                            >
                              <TableCell
                                className="font-medium cursor-pointer"
                                onClick={() => navigate(`/bookings/${b.id}`)}
                              >
                                {name || "Unknown"}
                              </TableCell>
                              <TableCell className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                                {b.group_name || "—"}
                              </TableCell>
                              <TableCell className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                                <Badge className={getBookingStatusColor(b.status)}>{formatStatusText(b.status)}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {c?.id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      acknowledge.mutate(c.id);
                                    }}
                                    disabled={acknowledge.isPending}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Acknowledge
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}