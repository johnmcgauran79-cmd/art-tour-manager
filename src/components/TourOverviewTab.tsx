import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock, User } from "lucide-react";
import { formatDateToLongFormat, formatDateToMonthYear } from "@/lib/utils";

interface TourOverviewTabProps {
  tour: {
    dates: string;
    duration: string;
    location: string;
    pickupPoint: string;
    totalCapacity: number;
    status: string;
    tourHost: string;
    pricing: {
      single: number;
      double: number;
      twin: number;
    };
    deposit: number;
    instalmentAmount: number;
    instalmentDate: string;
    finalPaymentDate: string;
    inclusions: string;
    exclusions: string;
    notes: string;
  };
}

export const TourOverviewTab = ({ tour }: TourOverviewTabProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Tour Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{tour.dates}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{tour.duration}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{tour.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Tour Host: {tour.tourHost}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Capacity: {tour.totalCapacity}</span>
            </div>
            {tour.pickupPoint && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Start Location: {tour.pickupPoint}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant="secondary" className="uppercase">{tour.status}</Badge>
            <div className="space-y-1">
              {tour.pricing.single > 0 && (
                <div className="flex items-center gap-2">
                  <span>Single: ${tour.pricing.single}</span>
                </div>
              )}
              {tour.pricing.double > 0 && (
                <div className="flex items-center gap-2">
                  <span>Double: ${tour.pricing.double}</span>
                </div>
              )}
              {tour.pricing.twin > 0 && (
                <div className="flex items-center gap-2">
                  <span>Twin: ${tour.pricing.twin}</span>
                </div>
              )}
              {tour.deposit > 0 && (
                <div className="flex items-center gap-2">
                  <span>Deposit: ${tour.deposit}</span>
                </div>
              )}
              {tour.instalmentAmount > 0 && (
                <div className="flex items-center gap-2">
                  <span>Instalment: ${tour.instalmentAmount}</span>
                </div>
              )}
              {tour.instalmentDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Instalment Date: {formatDateToLongFormat(tour.instalmentDate)}</span>
                </div>
              )}
              {tour.finalPaymentDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Final Payment: {formatDateToMonthYear(tour.finalPaymentDate)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tour.inclusions && (
          <Card>
            <CardHeader>
              <CardTitle>Inclusions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap">{tour.inclusions}</div>
            </CardContent>
          </Card>
        )}

        {tour.exclusions && (
          <Card>
            <CardHeader>
              <CardTitle>Exclusions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap">{tour.exclusions}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {tour.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap">{tour.notes}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
