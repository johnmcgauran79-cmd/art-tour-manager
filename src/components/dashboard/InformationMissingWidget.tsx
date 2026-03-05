import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileWarning, Plane, MapPin, FileText, CheckCircle } from "lucide-react";
import { useGlobalDocumentAlerts, TourDocumentBreakdown } from "@/hooks/useGlobalDocumentAlerts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";

type DetailType = "passports" | "pickups" | "forms";

export const InformationMissingWidget = () => {
  const { totalPassports, totalPickups, totalForms, tourBreakdowns, isLoading } = useGlobalDocumentAlerts();
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const navigate = useNavigate();

  const totalMissing = totalPassports + totalPickups + totalForms;

  const getFilteredTours = (type: DetailType): TourDocumentBreakdown[] => {
    return tourBreakdowns.filter(t => {
      if (type === "passports") return t.missingPassports > 0;
      if (type === "pickups") return t.missingPickups > 0;
      if (type === "forms") return t.missingForms > 0;
      return false;
    }).sort((a, b) => {
      const aVal = type === "passports" ? a.missingPassports : type === "pickups" ? a.missingPickups : a.missingForms;
      const bVal = type === "passports" ? b.missingPassports : type === "pickups" ? b.missingPickups : b.missingForms;
      return bVal - aVal;
    });
  };

  const getDetailTitle = (type: DetailType) => {
    if (type === "passports") return "Missing Passport Details by Tour";
    if (type === "pickups") return "Missing Pickup Locations by Tour";
    return "Missing Form Responses by Tour";
  };

  const getCount = (tour: TourDocumentBreakdown, type: DetailType) => {
    if (type === "passports") return tour.missingPassports;
    if (type === "pickups") return tour.missingPickups;
    return tour.missingForms;
  };

  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <FileWarning className="h-5 w-5" />
            Information Missing
            {totalMissing > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {totalMissing}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : totalMissing === 0 ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
              <CheckCircle className="h-4 w-4 text-green-600" />
              All information complete
            </div>
          ) : (
            <>
              {totalPassports > 0 && (
                <button
                  onClick={() => setDetailType("passports")}
                  className="flex items-center justify-between w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm flex items-center gap-2">
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    Passport Details
                  </span>
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                    {totalPassports}
                  </Badge>
                </button>
              )}
              {totalPickups > 0 && (
                <button
                  onClick={() => setDetailType("pickups")}
                  className="flex items-center justify-between w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Pickup Locations
                  </span>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    {totalPickups}
                  </Badge>
                </button>
              )}
              {totalForms > 0 && (
                <button
                  onClick={() => setDetailType("forms")}
                  className="flex items-center justify-between w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Form Details
                  </span>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                    {totalForms}
                  </Badge>
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailType} onOpenChange={(open) => !open && setDetailType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailType && getDetailTitle(detailType)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {detailType && getFilteredTours(detailType).map(tour => (
              <button
                key={tour.tourId}
                onClick={() => {
                  setDetailType(null);
                  navigate(`/tours/${tour.tourId}`);
                }}
                className="flex items-center justify-between w-full p-3 rounded-md border hover:bg-muted/50 transition-colors text-left"
              >
                <div>
                  <div className="font-medium text-sm">{tour.tourName}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(tour.startDate), "d MMM yyyy")}
                  </div>
                </div>
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                  {getCount(tour, detailType)} missing
                </Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
