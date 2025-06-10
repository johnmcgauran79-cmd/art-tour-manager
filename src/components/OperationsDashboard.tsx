
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";

const operationsData = [
  {
    tourName: "Melbourne Cup Carnival 2024",
    hotelStatus: "confirmed",
    activityStatus: "pending",
    issues: ["Transport pickup time TBC"],
    overbooked: false
  },
  {
    tourName: "Formula 1 Australian Grand Prix",
    hotelStatus: "confirmed",
    activityStatus: "confirmed",
    issues: [],
    overbooked: false
  },
  {
    tourName: "Bathurst 1000 Experience",
    hotelStatus: "pending",
    activityStatus: "enquiry-sent",
    issues: ["Hotel response overdue", "Activity capacity issue"],
    overbooked: true
  }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "confirmed": return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
    case "enquiry-sent": return <Clock className="h-4 w-4 text-blue-600" />;
    default: return <XCircle className="h-4 w-4 text-red-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed": return "bg-green-100 text-green-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "enquiry-sent": return "bg-blue-100 text-blue-800";
    default: return "bg-red-100 text-red-800";
  }
};

export const OperationsDashboard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Operations Overview
        </CardTitle>
        <CardDescription>
          Monitor tour status, capacity issues, and operational requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {operationsData.map((tour, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-lg">{tour.tourName}</h3>
                {tour.overbooked && (
                  <Badge className="bg-red-100 text-red-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    OVERBOOKED
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded">
                  <span className="font-medium">Hotel Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(tour.hotelStatus)}
                    <Badge className={getStatusColor(tour.hotelStatus)}>
                      {tour.hotelStatus.replace("-", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-accent/50 rounded">
                  <span className="font-medium">Activity Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(tour.activityStatus)}
                    <Badge className={getStatusColor(tour.activityStatus)}>
                      {tour.activityStatus.replace("-", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              {tour.issues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Issues Requiring Attention
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {tour.issues.map((issue, issueIndex) => (
                      <li key={issueIndex} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
