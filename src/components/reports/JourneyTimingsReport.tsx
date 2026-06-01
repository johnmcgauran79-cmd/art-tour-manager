import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "@/hooks/useActivities";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { Bus } from "lucide-react";

interface JourneyTimingsReportProps {
  activities: Activity[];
  tourName: string;
}

const formatTime = (time: string | null) => {
  if (!time) return "-";
  const parts = time.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
  return time;
};

// Only private coach activities are relevant for the coach company report
export const getCoachActivities = (activities: Activity[]): Activity[] => {
  return [...activities]
    .filter((a) => a.transport_mode === "private_coach")
    .sort((a, b) => {
      if (a.activity_date && b.activity_date) {
        const dateCompare = a.activity_date.localeCompare(b.activity_date);
        if (dateCompare !== 0) return dateCompare;
      } else if (a.activity_date) {
        return -1;
      } else if (b.activity_date) {
        return 1;
      }
      return (a.depart_for_activity || a.start_time || "").localeCompare(
        b.depart_for_activity || b.start_time || ""
      );
    });
};

const sortedJourneys = (activity: Activity) =>
  [...(activity.activity_journeys || [])].sort(
    (a, b) => (a.journey_number || 0) - (b.journey_number || 0)
  );

export const JourneyTimingsReport = ({ activities, tourName }: JourneyTimingsReportProps) => {
  const coachActivities = getCoachActivities(activities);

  if (coachActivities.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No private coach activities found for this tour.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {coachActivities.map((activity) => {
        const journeys = sortedJourneys(activity);
        return (
          <div key={activity.id} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Badge variant="outline" className="font-semibold">
                {activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : "Date TBC"}
              </Badge>
              <span className="font-semibold text-foreground">{activity.name}</span>
              {activity.location && (
                <span className="text-sm text-muted-foreground">{activity.location}</span>
              )}
              <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
                <span>Depart: <strong className="text-foreground">{formatTime(activity.depart_for_activity)}</strong></span>
                <span>Start: <strong className="text-foreground">{formatTime(activity.start_time)}</strong></span>
                <span>End: <strong className="text-foreground">{formatTime(activity.end_time)}</strong></span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Leg</TableHead>
                  <TableHead className="w-32">Pickup Time</TableHead>
                  <TableHead>Pickup Location</TableHead>
                  <TableHead>Destination</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journeys.length > 0 ? (
                  journeys.map((leg) => (
                    <TableRow key={leg.id}>
                      <TableCell>{leg.journey_number}</TableCell>
                      <TableCell>{formatTime(leg.pickup_time)}</TableCell>
                      <TableCell>{leg.pickup_location || "-"}</TableCell>
                      <TableCell>{leg.destination || "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No journey legs recorded for this activity.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
};

export const generateJourneyTimingsHTML = (activities: Activity[], tourName: string): string => {
  const coachActivities = getCoachActivities(activities);

  const sections = coachActivities
    .map((activity) => {
      const journeys = sortedJourneys(activity);
      const legRows = journeys.length
        ? journeys
            .map(
              (leg) => `
              <tr>
                <td>${leg.journey_number ?? ""}</td>
                <td>${formatTime(leg.pickup_time)}</td>
                <td>${leg.pickup_location || "-"}</td>
                <td>${leg.destination || "-"}</td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="4" style="text-align:center;color:#888;">No journey legs recorded.</td></tr>`;

      return `
        <div class="activity">
          <div class="activity-header">
            <span class="badge">${activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : "Date TBC"}</span>
            <strong>${activity.name || ""}</strong>
            ${activity.location ? `<span class="loc">${activity.location}</span>` : ""}
            <span class="times">Depart: <b>${formatTime(activity.depart_for_activity)}</b> &nbsp; Start: <b>${formatTime(activity.start_time)}</b> &nbsp; End: <b>${formatTime(activity.end_time)}</b></span>
          </div>
          <table>
            <thead>
              <tr><th style="width:50px;">Leg</th><th style="width:110px;">Pickup Time</th><th>Pickup Location</th><th>Destination</th></tr>
            </thead>
            <tbody>${legRows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  const body =
    coachActivities.length > 0
      ? sections
      : `<p style="text-align:center;color:#888;">No private coach activities found for this tour.</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Journey Timings — ${tourName}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .subtitle { color: #666; margin: 0 0 20px; font-size: 13px; }
    .activity { margin-bottom: 18px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
    .activity-header { background: #f4f4f7; padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 13px; }
    .badge { border: 1px solid #bbb; border-radius: 4px; padding: 2px 8px; font-weight: 600; }
    .loc { color: #666; }
    .times { margin-left: auto; color: #444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 12px; border-top: 1px solid #eee; font-size: 13px; }
    th { background: #fafafa; }
  </style>
</head>
<body>
  <h1>Journey Timings — ${tourName}</h1>
  <p class="subtitle">Private coach activities &amp; pickup legs</p>
  ${body}
</body>
</html>`;
};

export const generateJourneyTimingsCSV = (activities: Activity[]): string => {
  const coachActivities = getCoachActivities(activities);
  const escape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  const header = ["Date", "Activity", "Location", "Depart", "Start", "End", "Leg", "Pickup Time", "Pickup Location", "Destination"];
  const rows: string[] = [header.map(escape).join(",")];

  coachActivities.forEach((activity) => {
    const base = [
      activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : "Date TBC",
      activity.name || "",
      activity.location || "",
      formatTime(activity.depart_for_activity),
      formatTime(activity.start_time),
      formatTime(activity.end_time),
    ];
    const journeys = sortedJourneys(activity);
    if (journeys.length === 0) {
      rows.push([...base, "", "", "", ""].map(escape).join(","));
    } else {
      journeys.forEach((leg) => {
        rows.push(
          [
            ...base,
            String(leg.journey_number ?? ""),
            formatTime(leg.pickup_time),
            leg.pickup_location || "",
            leg.destination || "",
          ].map(escape).join(",")
        );
      });
    }
  });

  return rows.join("\n");
};