import { useBookings } from "@/hooks/useBookings";

interface TourAttendeesReportProps {
  tourId: string;
  tourName: string;
}

export const useTourAttendeesData = (tourId: string) => {
  const { data: allBookings } = useBookings();

  const tourBookings = (allBookings || []).filter(booking =>
    booking.tour_id === tourId &&
    booking.status !== 'cancelled' &&
    booking.status !== 'waitlisted' &&
    booking.whatsapp_group_comms === true
  );

  const attendees: string[] = [];

  tourBookings.forEach(booking => {
    const leadName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim();
    if (leadName) attendees.push(leadName);

    if (booking.passenger_2_name) attendees.push(booking.passenger_2_name);
    if (booking.passenger_3_name) attendees.push(booking.passenger_3_name);
  });

  return attendees.sort((a, b) => a.localeCompare(b));
};

export const TourAttendeesReport = ({ tourId, tourName }: TourAttendeesReportProps) => {
  const attendees = useTourAttendeesData(tourId);

  return (
    <div>
      {/* Branded Header */}
      <div style={{ backgroundColor: '#232628', padding: '24px 32px', textAlign: 'center' as const }}>
        <img
          src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
          alt="ART Logo"
          style={{ height: '50px', maxWidth: '200px', width: 'auto', margin: '0 auto' }}
        />
      </div>

      {/* Tour Name & Title */}
      <div style={{ padding: '24px 32px', textAlign: 'center' as const }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">{tourName}</h1>
        <h2 className="text-xl text-muted-foreground">Tour Attendees</h2>
        <p className="text-sm text-muted-foreground mt-2">{attendees.length} attendees</p>
      </div>

      {/* Attendees List */}
      <div className="px-8 pb-8">
        {attendees.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            {attendees.map((name, index) => (
              <div
                key={index}
                className="py-2 px-3 border-b border-border flex items-center gap-3"
              >
                <span className="text-sm text-muted-foreground w-6 text-right">{index + 1}.</span>
                <span className="text-sm font-medium text-foreground">{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No attendees found with WhatsApp Group Communications enabled.
          </p>
        )}
      </div>
    </div>
  );
};

export const generateTourAttendeesHTML = (attendees: string[], tourName: string): string => {
  const logoUrl = `${window.location.origin}/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Tour Attendees - ${tourName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; }
        .branded-header { background-color: #232628; padding: 24px 32px; text-align: center; }
        .branded-header img { height: 50px; max-width: 200px; width: auto; display: inline-block; }
        .title-section { padding: 24px 32px; text-align: center; }
        .tour-name { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
        .report-title { font-size: 20px; color: #666; margin-bottom: 8px; }
        .count { font-size: 14px; color: #888; }
        .attendees-list { padding: 0 32px 32px; }
        .attendee-row { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        .attendee-num { color: #888; display: inline-block; width: 30px; text-align: right; margin-right: 12px; }
        .attendee-name { font-weight: 500; }
        .columns { display: flex; gap: 32px; }
        .column { flex: 1; }
        @media print {
          body { margin: 0; }
          .branded-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="branded-header">
        <img src="${logoUrl}" alt="ART Logo" />
      </div>
      <div class="title-section">
        <div class="tour-name">${tourName}</div>
        <div class="report-title">Tour Attendees</div>
        <div class="count">${attendees.length} attendees</div>
      </div>
      <div class="attendees-list">
        <div class="columns">
          <div class="column">
            ${attendees.slice(0, Math.ceil(attendees.length / 2)).map((name, i) => `
              <div class="attendee-row">
                <span class="attendee-num">${i + 1}.</span>
                <span class="attendee-name">${name}</span>
              </div>
            `).join('')}
          </div>
          <div class="column">
            ${attendees.slice(Math.ceil(attendees.length / 2)).map((name, i) => `
              <div class="attendee-row">
                <span class="attendee-num">${Math.ceil(attendees.length / 2) + i + 1}.</span>
                <span class="attendee-name">${name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
