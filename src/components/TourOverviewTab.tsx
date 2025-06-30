
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, DollarSign, FileText, Clock, UserCheck } from "lucide-react";

interface TourOverviewTabProps {
  tour: {
    id: string;
    name: string;
    dates: string;
    duration: string;
    location: string;
    pickupPoint: string;
    status: string;
    notes: string;
    inclusions: string;
    exclusions: string;
    pricing: {
      single: number;
      double: number;
      twin: number;
    };
    deposit: number;
    instalmentAmount: number;
    instalmentDate: string;
    finalPaymentDate: string;
    totalCapacity: number;
    minimumPassengers?: number;
    tourHost: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'closed':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'sold_out':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'past':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const TourOverviewTab = ({ tour }: TourOverviewTabProps) => {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dates & Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-semibold">{tour.dates}</p>
              <p className="text-sm text-muted-foreground">{tour.duration}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="font-semibold">{tour.location || "TBD"}</p>
              {tour.pickupPoint && (
                <p className="text-sm text-muted-foreground">Pickup: {tour.pickupPoint}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status & Host
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getStatusColor(tour.status)}>
                {tour.status?.replace('_', ' ').toUpperCase()}
              </Badge>
              <p className="text-sm">
                <span className="font-medium">Host:</span> {tour.tourHost}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Capacity Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Maximum Capacity:</span>
                <span className="font-semibold">{tour.totalCapacity || "Not set"}</span>
              </div>
              {tour.minimumPassengers && (
                <div className="flex justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    Minimum Required:
                  </span>
                  <span className="font-semibold text-orange-600">{tour.minimumPassengers}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tour.pricing.single > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Single:</span>
                  <span className="font-semibold">${tour.pricing.single}</span>
                </div>
              )}
              {tour.pricing.double > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Double:</span>
                  <span className="font-semibold">${tour.pricing.double}</span>
                </div>
              )}
              {tour.pricing.twin > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Twin:</span>
                  <span className="font-semibold">${tour.pricing.twin}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Information */}
      {(tour.deposit > 0 || tour.instalmentAmount > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Payment Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tour.deposit > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Deposit Required</span>
                  <p className="font-semibold">${tour.deposit}</p>
                </div>
              )}
              {tour.instalmentAmount > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Instalment</span>
                  <p className="font-semibold">${tour.instalmentAmount}</p>
                  {tour.instalmentDate && (
                    <p className="text-xs text-muted-foreground">Due: {new Date(tour.instalmentDate).toLocaleDateString()}</p>
                  )}
                </div>
              )}
              {tour.finalPaymentDate && (
                <div>
                  <span className="text-sm text-muted-foreground">Final Payment</span>
                  <p className="text-xs text-muted-foreground">Due: {new Date(tour.finalPaymentDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inclusions & Exclusions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tour.inclusions && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Inclusions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{tour.inclusions}</p>
            </CardContent>
          </Card>
        )}

        {tour.exclusions && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Exclusions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{tour.exclusions}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {tour.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{tour.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
