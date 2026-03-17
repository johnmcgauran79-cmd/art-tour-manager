interface ReportItem {
  id: string;
  type: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix' | 'passport';
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
      headers = ['Lead Passenger', 'Additional Passengers', 'Pax', 'Bedding', 'Check In', 'Check Out', 'Nights'];
      csvData = report.data.map(item => ({
        leadpassenger: item.leadPassenger,
        additionalpassengers: item.additionalPassengers.join(', '),
        pax: item.passengerCount,
        bedding: item.bedding || '-',
        checkin: item.checkIn,
        checkout: item.checkOut,
        nights: item.nights
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
    case 'passport':
      headers = ['Passenger Name', 'Booking Ref', 'Group', 'Name as per Passport', 'Passport No', 'Country', 'Nationality', 'Date of Birth', 'Expiry'];
      csvData = report.data.map(item => ({
        passengername: item.passengerName,
        bookingref: item.bookingReference,
        group: item.groupName || '',
        nameasperpassport: item.nameAsPerPassport || '',
        passportno: item.passportNumber || '',
        country: item.passportCountry || '',
        nationality: item.nationality || '',
        dateofbirth: item.dateOfBirth || '',
        expiry: item.passportExpiry || ''
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
          <thead><tr><th>Lead Passenger</th><th>Additional Passengers</th><th>Pax</th><th>Bedding</th><th>Check In</th><th>Check Out</th><th>Nights</th></tr></thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td>${item.leadPassenger}</td>
                <td>${item.additionalPassengers.join(', ')}</td>
                <td>${item.passengerCount}</td>
                <td style="text-transform: capitalize;">${item.bedding || '-'}</td>
                <td>${item.checkIn}</td>
                <td>${item.checkOut}</td>
                <td>${item.nights}</td>
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
    case 'passport':
      tableHTML = `
        <table>
          <thead><tr><th>Passenger</th><th>Name as per Passport</th><th>Passport No.</th><th>Country</th><th>Nationality</th><th>DOB</th><th>Expiry</th></tr></thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td>${item.passengerName}${item.groupName ? `<br><small style="color:#666">${item.groupName}</small>` : ''}</td>
                <td>${item.nameAsPerPassport || '-'}</td>
                <td>${item.passportNumber || '-'}</td>
                <td>${item.passportCountry || '-'}</td>
                <td>${item.nationality || '-'}</td>
                <td>${item.dateOfBirth || '-'}</td>
                <td>${item.passportExpiry || '-'}</td>
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

// Generate HTML content for PDF viewing
export const generateReportHTML = (report: ReportItem, tourName: string): string => {
  const title = `${report.title} - ${tourName}`;
  
  let tableContent = '';
  
  switch (report.type) {
    case 'contacts':
      tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">First Name</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Last Name</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Phone</th>
            </tr>
          </thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.firstName}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.lastName}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.phone}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'dietary':
      tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Lead Passenger</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Additional Passengers</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Dietary Requirements</th>
            </tr>
          </thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.leadPassenger}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.additionalPassengers.join(', ')}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.dietaryRequirements}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'summary':
      tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Lead Passenger</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Additional Passengers</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Pax</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Bedding</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Check In</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Check Out</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Nights</th>
            </tr>
          </thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.leadPassenger}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.additionalPassengers.join(', ')}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.passengerCount}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-transform: capitalize;">${item.bedding || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.checkIn}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.checkOut}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.nights}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'passengerlist':
      tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Passenger Name</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Dietary Requirements</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Notes / Meal Orders</th>
            </tr>
          </thead>
          <tbody>
            ${report.data.map(item => `
              <tr style="height: 50px;">
                <td style="border: 1px solid #ddd; padding: 12px;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.dietaryRequirements || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px; border-left: 3px solid #333; min-height: 40px;">_________________________</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    case 'passport':
      tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Passenger</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Name as per Passport</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Passport No.</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Country</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Nationality</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">DOB</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #f5f5f5; text-align: left; font-weight: bold;">Expiry</th>
            </tr>
          </thead>
          <tbody>
            ${report.data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.passengerName}${item.groupName ? `<br><small style="color:#666">${item.groupName}</small>` : ''}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.nameAsPerPassport || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px; font-family: monospace;">${item.passportNumber || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.passportCountry || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.nationality || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.dateOfBirth || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.passportExpiry || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;
    default:
      tableContent = '<p>No data available for this report.</p>';
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .tour-name {
          font-size: 24px;
          font-weight: bold;
          color: #1e3a8a;
          margin-bottom: 5px;
        }
        .report-title {
          font-size: 18px;
          color: #666;
          margin-bottom: 10px;
        }
        .report-date {
          font-size: 14px;
          color: #888;
        }
        .content {
          margin-top: 30px;
        }
        .summary {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
          border-left: 4px solid #1e3a8a;
        }
        @media print {
          body { margin: 20px; }
          .header { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="tour-name">${tourName}</div>
        <div class="report-title">${report.title}</div>
        <div class="report-date">Generated on ${new Date().toLocaleDateString('en-AU')}</div>
      </div>
      
      <div class="content">
        <div class="summary">
          <strong>Summary:</strong> ${report.description}<br>
          <strong>Total Records:</strong> ${report.data?.length || 0}
        </div>
        
        ${report.type === 'passengerlist' ? '<p><strong>Instructions:</strong> Use the blank spaces in the Notes column to write meal orders, preferences, or other tour-related notes for each passenger.</p>' : ''}
        
        ${tableContent}
      </div>
    </body>
    </html>
  `;
};
