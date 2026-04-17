import { format } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklyChange {
  id: string;
  timestamp: string;
  operation_type: string;
  booking_id: string;
  customer_name: string;
  tour_name: string;
  user_name: string;
  details?: any;
}

interface BookingChangesReportPDFProps {
  changes: WeeklyChange[];
  period: string;
}

const formatOperationType = (type: string, details?: any): string => {
  const typeMap: Record<string, string> = {
    'CREATE': 'New Booking',
    'CREATE_BOOKING': 'New Booking',
    'ADD_HOTEL_TO_BOOKING': 'Hotel Added',
    'REMOVE_HOTEL_FROM_BOOKING': 'Hotel Removed',
    'ADD_ACTIVITY_TO_BOOKING': 'Activity Added',
    'REMOVE_ACTIVITY_FROM_BOOKING': 'Activity Removed',
    'DELETE_BOOKING': 'Booking Deleted',
    'CANCEL_BOOKING': 'Booking Cancelled',
  };
  
  if (type === 'UPDATE_HOTEL_BOOKING_DATES' || (type === 'UPDATE_HOTEL_BOOKING' && details?.hotel_dates)) {
    const changes = [];
    if (details?.hotel_dates?.old?.check_in !== details?.hotel_dates?.new?.check_in) {
      changes.push(`check-in changed`);
    }
    if (details?.hotel_dates?.old?.check_out !== details?.hotel_dates?.new?.check_out) {
      changes.push(`check-out changed`);
    }
    if (changes.length > 0) {
      return `Hotel Date Change: ${changes.join(', ')}`;
    }
    return 'Hotel Date Change';
  }
  
  if (type === 'UPDATE_HOTEL_BOOKING_ROOM' || (type === 'UPDATE_HOTEL_BOOKING' && (details?.bedding || details?.room_requests) && !details?.hotel_dates)) {
    const changes = [];
    if (details?.bedding) {
      changes.push(`bedding: ${details.bedding.old || '(none)'} → ${details.bedding.new || '(none)'}`);
    }
    if (details?.room_requests) {
      const oldVal = details.room_requests.old?.trim() || '(none)';
      const newVal = details.room_requests.new?.trim() || '(none)';
      changes.push(`room requests: "${oldVal}" → "${newVal}"`);
    }
    if (changes.length > 0) {
      return `Hotel Room/Bedding Change: ${changes.join(', ')}`;
    }
    return 'Hotel Room/Bedding Change';
  }
  
  if (type === 'UPDATE_ACTIVITY_BOOKING') {
    return 'Activity Updated';
  }
  
  if (type === 'UPDATE_ACTIVITIES_CONSOLIDATED') {
    return 'Activities Updated';
  }
  
  return typeMap[type] || type;
};

const generateHTML = (changes: WeeklyChange[], period: string): string => {
  const currentDate = format(new Date(), 'dd/MM/yyyy');
  
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Booking Changes Report</title>
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1a1a1a;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 3px solid #2c3e50;
            page-break-after: avoid;
            break-after: avoid;
          }
          .header h1 {
            margin: 0 0 6px 0;
            font-size: 24px;
            font-weight: 700;
            color: #2c3e50;
          }
          .header p {
            margin: 2px 0;
            color: #555;
            font-size: 12px;
            font-weight: 500;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            page-break-before: avoid;
            break-before: avoid;
          }
          thead {
            page-break-after: avoid;
            break-after: avoid;
          }
          th {
            background-color: #34495e;
            color: white;
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            border: none;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 12px;
            color: #333;
            line-height: 1.5;
          }
          tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          tbody tr:hover {
            background-color: #e9ecef;
          }
          tbody tr:last-child td {
            border-bottom: 2px solid #34495e;
          }
          .footer {
            margin-top: 25px;
            padding-top: 15px;
            border-top: 2px solid #dee2e6;
            font-size: 11px;
            color: #6c757d;
            text-align: center;
          }
          .summary {
            margin-top: 20px;
            padding: 15px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .summary strong {
            display: block;
            font-size: 16px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Booking Changes Report</h1>
          <p>Report Period: Last ${period} Days</p>
          <p>Generated: ${currentDate}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 16%">Date & Time</th>
              <th style="width: 24%">Customer</th>
              <th style="width: 26%">Tour</th>
              <th style="width: 20%">Action</th>
              <th style="width: 14%">Changed By</th>
            </tr>
          </thead>
          <tbody>
            ${changes.map(change => `
              <tr>
                <td><strong>${format(new Date(change.timestamp), 'dd/MM/yyyy HH:mm')}</strong></td>
                <td>${change.customer_name}</td>
                <td>${change.tour_name}</td>
                <td>${formatOperationType(change.operation_type, change.details)}</td>
                <td>${change.user_name}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <strong>Total Changes: ${changes.length}</strong>
        </div>
        
        <div class="footer">
          <p>This report was automatically generated by the Tour Operations Management System</p>
          <p>Australian Racing Tours • Confidential</p>
        </div>
      </body>
    </html>
  `;
};

export const BookingChangesReportPDF = ({ changes, period }: BookingChangesReportPDFProps) => {
  const handlePrint = () => {
    const htmlContent = generateHTML(changes, period);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <Button onClick={handlePrint}>
      <Printer className="h-4 w-4" />
      Print PDF
    </Button>
  );
};
