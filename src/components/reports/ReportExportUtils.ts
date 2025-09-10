interface ReportItem {
  id: string;
  type: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix';
  title: string;
  description: string;
  count: number;
  data: any[];
}

export const exportReportToCSV = (report: ReportItem, tourName: string) => {
  let headers: string[] = [];
  let csvData: any[] = [];

  switch (report.type) {
    case 'contacts':
      headers = ['First Name', 'Last Name', 'Phone'];
      csvData = report.data.map(item => ({
        firstname: item.firstName,
        lastname: item.lastName,
        phone: item.phone
      }));
      break;
    case 'dietary':
      headers = ['Lead Passenger', 'Additional Passengers', 'Dietary Requirements'];
      csvData = report.data.map(item => ({
        leadpassenger: item.leadPassenger,
        additionalpassengers: item.additionalPassengers.join(', '),
        dietaryrequirements: item.dietaryRequirements
      }));
      break;
    case 'summary':
      headers = ['Lead Passenger', 'Additional Passengers', 'Passenger Count', 'Check In', 'Check Out', 'Nights', 'Status', 'Group Name', 'Notes'];
      csvData = report.data.map(item => ({
        leadpassenger: item.leadPassenger,
        additionalpassengers: item.additionalPassengers.join(', '),
        passengercount: item.passengerCount,
        checkin: item.checkIn,
        checkout: item.checkOut,
        nights: item.nights,
        status: item.status,
        groupname: item.groupName,
        notes: item.notes
      }));
      break;
    case 'passengerlist':
      headers = ['Passenger Name', 'Dietary Requirements', 'Notes'];
      csvData = report.data.map(item => ({
        passengername: item.name,
        dietaryrequirements: item.dietaryRequirements,
        notes: ''
      }));
      break;
  }

  const csvContent = [
    headers.join(','),
    ...csvData.map(row => headers.map(header => {
      const value = row[header.toLowerCase().replace(/\s+/g, '')] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${tourName}_${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  link.click();
};

export const printReport = (report: ReportItem, tourName: string) => {
  let tableHTML = '';
  
  switch (report.type) {
    case 'contacts':
      tableHTML = `
        <table>
          <thead><tr><th>First Name</th><th>Last Name</th><th>Phone</th></tr></thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td>${item.firstName}</td>
                <td>${item.lastName}</td>
                <td>${item.phone}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'dietary':
      tableHTML = `
        <table>
          <thead><tr><th>Lead Passenger</th><th>Additional Passengers</th><th>Dietary Requirements</th></tr></thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td>${item.leadPassenger}</td>
                <td>${item.additionalPassengers.join(', ')}</td>
                <td>${item.dietaryRequirements}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'summary':
      tableHTML = `
        <table>
          <thead><tr><th>Lead Passenger</th><th>Additional Passengers</th><th>Pax</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Status</th><th>Group</th><th>Notes</th></tr></thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td>${item.leadPassenger}</td>
                <td>${item.additionalPassengers.join(', ')}</td>
                <td>${item.passengerCount}</td>
                <td>${item.checkIn}</td>
                <td>${item.checkOut}</td>
                <td>${item.nights}</td>
                <td><span class="status ${item.status}">${item.status.toUpperCase()}</span></td>
                <td>${item.groupName}</td>
                <td>${item.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'passengerlist':
      tableHTML = `
        <table class="passenger-list">
          <thead><tr><th>Passenger Name</th><th>Dietary Requirements</th><th>Notes / Meal Orders</th></tr></thead>
          <tbody>
            ${report.data.map(item => `
              <tr class="passenger-row">
                <td>${item.name}</td>
                <td>${item.dietaryRequirements || '-'}</td>
                <td class="notes-column">_________________________</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
  }

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>${report.title} - ${tourName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            .status.paid { background-color: #dcfce7; color: #166534; }
            .status.deposited { background-color: #dbeafe; color: #1e40af; }
            .status.invoiced { background-color: #fef3c7; color: #92400e; }
            .status.pending { background-color: #f3f4f6; color: #374151; }
            .passenger-list .passenger-row { height: 50px; }
            .passenger-list .notes-column { border-left: 3px solid #333; min-height: 40px; }
            @media print { 
              body { margin: 0; }
              .passenger-list .passenger-row { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${report.title} - ${tourName}</h1>
          ${report.type === 'passengerlist' ? '<p><strong>Instructions:</strong> Use the blank spaces in the Notes column to write meal orders, preferences, or other tour-related notes for each passenger.</p>' : ''}
          ${tableHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
};
