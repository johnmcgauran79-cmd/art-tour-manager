import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MapPin, DollarSign, Eye, Edit, Copy } from "lucide-react";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { getTourStatusColor, formatStatusText } from "@/lib/statusColors";
import { typography } from "@/lib/typography";

interface TourCardProps {
  tour: any;
  totalPassengers?: number;
  onView?: (tour: any) => void;
  onEdit?: (tour: any) => void;
  onDuplicate?: (tour: any) => void;
}

export const TourCard = ({ tour, totalPassengers = 0, onView, onEdit, onDuplicate }: TourCardProps) => {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`${typography.cardTitle} truncate mb-1`}>
              {tour.name}
            </h3>
            {tour.location && (
              <div className={`flex items-center gap-1.5 ${typography.metadata}`}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{tour.location}</span>
              </div>
            )}
          </div>
          <Badge className={getTourStatusColor(tour.status)}>
            {formatStatusText(tour.status)}
          </Badge>
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
            <div className={`${typography.body.small} font-medium`}>{tour.tour_host}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(tour);
              }}
              className="flex-1 hover-scale"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              View
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tour);
              }}
              className="flex-1 hover-scale"
            >
              <Edit className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
          {onDuplicate && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(tour);
              }}
              className="hover-scale"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
