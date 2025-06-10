
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Edit } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TourActivitiesTabProps {
  tourId: string;
  onAddActivity: () => void;
  onEditActivity: (activity: any) => void;
}

export const TourActivitiesTab = ({ tourId, onAddActivity, onEditActivity }: TourActivitiesTabProps) => {
  const [editingSpots, setEditingSpots] = useState<Record<string, boolean>>({});
  const [spotsValues, setSpotsValues] = useState<Record<string, string>>({});
  
  const { data: activities } = useActivities(tourId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateActivitySpots = useMutation({
    mutationFn: async ({ activityId, spotsBooked }: { activityId: string; spotsBooked: number }) => {
      const { data, error } = await supabase
        .from('activities')
        .update({ spots_booked: spotsBooked })
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', tourId] });
      toast({
        title: "Success",
        description: "Spots booked updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating spots booked:', error);
      toast({
        title: "Error",
        description: "Failed to update spots booked. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    return `${hour12}:${minutes}${ampm}`;
  };

  const handleSpotsEdit = (activityId: string, currentSpots: number) => {
    setEditingSpots(prev => ({ ...prev, [activityId]: true }));
    setSpotsValues(prev => ({ ...prev, [activityId]: currentSpots.toString() }));
  };

  const handleSpotsSave = async (activityId: string) => {
    const newSpots = parseInt(spotsValues[activityId]) || 0;
    await updateActivitySpots.mutateAsync({ activityId, spotsBooked: newSpots });
    setEditingSpots(prev => ({ ...prev, [activityId]: false }));
  };

  const handleSpotsCancel = (activityId: string) => {
    setEditingSpots(prev => ({ ...prev, [activityId]: false }));
    setSpotsValues(prev => ({ ...prev, [activityId]: "" }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Activities</h3>
        <Button 
          onClick={onAddActivity}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Add Activity
        </Button>
      </div>

      {activities && activities.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Spots Available</TableHead>
                <TableHead>Spots Booked</TableHead>
                <TableHead>Pax Attending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{activity.name}</TableCell>
                  <TableCell>{activity.location || '-'}</TableCell>
                  <TableCell>
                    {activity.activity_date 
                      ? formatDateToDDMMYYYY(activity.activity_date)
                      : 'TBD'
                    }
                  </TableCell>
                  <TableCell>
                    {activity.start_time ? formatTime(activity.start_time) : '-'}
                  </TableCell>
                  <TableCell>{activity.spots_available || '-'}</TableCell>
                  <TableCell>
                    {editingSpots[activity.id] ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={spotsValues[activity.id] || ''}
                          onChange={(e) => setSpotsValues(prev => ({ 
                            ...prev, 
                            [activity.id]: e.target.value 
                          }))}
                          className="w-16 h-7"
                          min="0"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleSpotsSave(activity.id)}
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleSpotsCancel(activity.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                        onClick={() => handleSpotsEdit(activity.id, activity.spots_booked || 0)}
                      >
                        {activity.spots_booked || 0}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {activity.spots_booked || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={activity.activity_status === 'confirmed' ? 'default' : 'secondary'}>
                      {activity.activity_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditActivity(activity)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No activities added yet.</p>
          <Button 
            onClick={onAddActivity} 
            className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Add First Activity
          </Button>
        </div>
      )}
    </div>
  );
};
