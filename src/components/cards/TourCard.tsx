import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MapPin, DollarSign, Edit, Copy, FlaskConical } from "lucide-react";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getTourStatusColor, formatStatusText, getHostFlightStatusStyle } from "@/lib/statusColors";
import { typography } from "@/lib/typography";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";
import { ManualHandlingIndicator } from "@/components/ManualHandlingIndicator";
import { useAuth } from "@/hooks/useAuth";

interface TourCardProps {
  tour: any;
  totalPassengers?: number;
  onView?: (tour: any) => void;
  onEdit?: (tour: any) => void;
  onDuplicate?: (tour: any) => void;
}

export const TourCard = ({ tour, totalPassengers = 0, onView, onEdit, onDuplicate }: TourCardProps) => {
  const { hasEditAccess } = usePermissions();
  const { userRole } = useAuth();
  
  const handleCardClick = () => {
    if (onView) {
      onView(tour);
    }
  };

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${getTourStatusColor(tour.status)} self-start`}>
              {formatStatusText(tour.status)}
            </Badge>
            {(tour as any).is_test_tour && userRole === 'admin' && (
              <Badge variant="secondary" className="gap-1 self-start">
                <FlaskConical className="h-3 w-3" /> TEST
              </Badge>
            )}
            <ManualHandlingIndicator
              tour={{ manual_billing: (tour as any).manual_billing, manual_emails: (tour as any).manual_emails }}
            />
          </div>
          <div className="min-w-0">
            <h3 className={`${typography.cardTitle} line-clamp-2 mb-1`}>
              {tour.name}
            </h3>
            {tour.location && (
              <div className={`flex items-center gap-1.5 ${typography.metadata}`}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{tour.location}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className={typography.label.small}>Start Date</div>
              <div className={`${typography.body.small} font-medium truncate`}>{formatDateToDDMMYYYY(tour.start_date)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className={typography.label.small}>End Date</div>
              <div className={`${typography.body.small} font-medium truncate`}>{formatDateToDDMMYYYY(tour.end_date)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className={typography.label.small}>Capacity</div>
              <div className={`${typography.body.small} font-medium`}>
                {totalPassengers} / {tour.max_passengers || 0}
              </div>
            </div>
          </div>

          {tour.price && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className={typography.label.small}>Price</div>
                <div className={`${typography.body.small} font-medium`}>${tour.price}</div>
              </div>
            </div>
          )}
        </div>

        {/* Host Info */}
        {tour.tour_host && (
          <div className="pt-2 border-t">
            <div className={typography.label.small}>Tour Host</div>
            {tour.tour_host !== 'TBD' ? (
              <Badge className={`${getHostFlightStatusStyle(tour.host_flights_status)} mt-1`}>
                {tour.tour_host}
              </Badge>
            ) : (
              <div className={`${typography.body.small} font-medium text-muted-foreground`}>{tour.tour_host}</div>
            )}
          </div>
        )}

        {/* Actions - Only Edit and Duplicate buttons */}
        {(onEdit || onDuplicate) && (
          <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <PermissionButton
                resource="tour"
                action="edit"
                variant="outline"
                size="sm"
                onClick={() => onEdit(tour)}
                className="flex-1 hover-scale"
              >
                <Edit className="h-4 w-4 mr-1.5" />
                Edit
              </PermissionButton>
            )}
            {onDuplicate && hasEditAccess && (
              <PermissionButton
                resource="tour"
                action="create"
                variant="outline"
                size="sm"
                onClick={() => onDuplicate(tour)}
                className="hover-scale"
              >
                <Copy className="h-4 w-4" />
              </PermissionButton>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};