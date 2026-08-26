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
              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Bus className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Private Coach</span>
              </div>
            </div>
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Leg</TableHead>
                  <TableHead className="w-24">Pickup Time</TableHead>
                  <TableHead className="w-[calc((100%-9rem)/2)]">Pickup Location</TableHead>
                  <TableHead className="w-[calc((100%-9rem)/2)]">Destination</TableHead>
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
          </div>
          <table>
            <thead>
              <tr><th style="width:40px;">Leg</th><th style="width:90px;">Pickup Time</th><th style="width:auto;">Pickup Location</th><th style="width:auto;">Destination</th></tr>
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
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
<style>
@font-face{font-family:'Larken';src:url('https://admin.australianracingtours.com.au/fonts/Larken-Regular.woff2') format('woff2'),url('https://admin.australianracingtours.com.au/fonts/Larken-Regular.woff') format('woff');font-weight:400;font-style:normal;font-display:swap;}
body,td,p,div,li,span{font-family:'Poppins', Arial, Helvetica, sans-serif;}
h1,h2,h3,h4,h5,h6{font-family:'Larken', Georgia, 'Times New Roman', serif;font-weight:400;text-transform:none;}
</style>
  <meta charset="utf-8" />
  <title>Journey Timings — ${tourName}</title>
  <style>
    body { font-family: 'Poppins', Arial, Helvetica, sans-serif; color: #1a1a2e; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .subtitle { color: #666; margin: 0 0 20px; font-size: 13px; }
    .activity { margin-bottom: 18px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
    .activity-header { background: #f4f4f7; padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 13px; }
    .badge { border: 1px solid #bbb; border-radius: 4px; padding: 2px 8px; font-weight: 600; }
    .loc { color: #666; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td { word-wrap: break-word; overflow-wrap: break-word; }
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
  const header = ["Date", "Activity", "Location", "Leg", "Pickup Time", "Pickup Location", "Destination"];
  const rows: string[] = [header.map(escape).join(",")];

  coachActivities.forEach((activity) => {
    const base = [
      activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : "Date TBC",
      activity.name || "",
      activity.location || "",
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