
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { formatDisplayDate } from "@/lib/utils";

const getDaysUntilTour = (startDate: string) => {
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = start.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getDaysColorClass = (days: number) => {
  if (days > 60) return "bg-green-100 text-green-800";
  if (days >= 31) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
};

const getMilestoneDate = (startDate: string, daysOffset: number) => {
  const start = new Date(startDate);
  const milestone = new Date(start);
  milestone.setDate(milestone.getDate() - daysOffset);
  return milestone.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const OperationsToursOverview = () => {
  const { data: tours, isLoading } = useTours();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Current Tours Operations Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading tours...</div>
        </CardContent>
      </Card>
    );
  }

  if (!tours || tours.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Current Tours Operations Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">No tours available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Current Tours Operations Status
        </CardTitle>
        <CardDescription>
          Monitor tour status, capacity issues, and operational requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {tours.map((tour) => {
            const daysUntilTour = getDaysUntilTour(tour.start_date);
            const daysColorClass = getDaysColorClass(daysUntilTour);
            
            return (
              <div key={tour.id} className="border rounded-lg p-4">
                {/* Tour Name */}
                <h3 className="font-semibold text-lg mb-3">{tour.name}</h3>
                
                {/* Date Milestones Row */}
                <div className="grid grid-cols-5 gap-2 mb-4 text-xs">
                  <div className="text-center">
                    <div className="font-medium">6mths out:</div>
                    <div>{getMilestoneDate(tour.start_date, 180)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">90 days:</div>
                    <div>{getMilestoneDate(tour.start_date, 90)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">60 days:</div>
                    <div>{getMilestoneDate(tour.start_date, 60)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">30 days:</div>
                    <div>{getMilestoneDate(tour.start_date, 30)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Start date:</div>
                    <div>{formatDisplayDate(tour.start_date).split(',')[0]}</div>
                  </div>
                </div>

                {/* Main Operations Table */}
                <div className="grid grid-cols-12 gap-2 text-sm">
                  {/* Column 1: Days Remaining (10% width) */}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className={`px-3 py-6 rounded text-center font-bold ${daysColorClass}`}>
                      {daysUntilTour}
                    </div>
                  </div>
                  
                  {/* Column 2: Operations Notes Breakdown (50% width) */}
                  <div className="col-span-6 space-y-2">
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Accommodation:</span>
                      <span className="text-muted-foreground">{tour.ops_accomm_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Races:</span>
                      <span className="text-muted-foreground">{tour.ops_races_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Transport:</span>
                      <span className="text-muted-foreground">{tour.ops_transport_notes || "No notes"}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24 shrink-0">Dinner:</span>
                      <span className="text-muted-foreground">{tour.ops_dinner_notes || "No notes"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">Activities:</span>
                      <span className="text-muted-foreground mt-1">{tour.ops_activities_notes || "No notes"}</span>
                    </div>
                  </div>
                  
                  {/* Column 3: General Operations Notes (40% width) */}
                  <div className="col-span-5">
                    <div className="bg-accent/30 p-3 rounded h-full">
                      <div className="font-medium mb-2">General Operations Notes:</div>
                      <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {tour.ops_notes || "No general operations notes"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
