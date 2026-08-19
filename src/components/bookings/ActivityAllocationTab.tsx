import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Activity {
  id: string;
  name: string;
  activity_date: string | null;
}

interface ActivityAllocationTabProps {
  activities: Activity[];
  activityAllocations: Record<string, number>;
  setActivityAllocations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  passengerCount: number;
  onBack: () => void;
  onContinue: () => void;
}

export const ActivityAllocationTab = ({
  activities,
  activityAllocations,
  setActivityAllocations,
  passengerCount,
  onBack,
  onContinue,
}: ActivityAllocationTabProps) => {
  const handleAllocationChange = (activityId: string, value: number) => {
    setActivityAllocations(prev => ({
      ...prev,
      [activityId]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Activity Allocations</h3>
        {activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => {
              const allocation = activityAllocations[activity.id] ?? passengerCount;

              return (
                <Card key={activity.id}>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div>
                        <p className="font-medium">{activity.name}</p>
                        {activity.activity_date && (
                          <p className="text-sm text-muted-foreground">
                            {new Date(activity.activity_date).toLocaleDateString('en-AU')}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Passengers Attending</Label>
                        <Input
                          type="number"
                          min="0"
                          value={allocation}
                          onChange={(e) => handleAllocationChange(activity.id, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No activities available for this tour.</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          type="button"
          onClick={onContinue}
          className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
        >
          Continue to Medical Details
        </Button>
      </div>
    </div>
  );
};
