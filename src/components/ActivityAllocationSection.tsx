
import { useEffect } from "react";
import { useActivities } from "@/hooks/useActivities";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityRow } from "@/components/ActivityRow";
import { useActivityAllocation } from "@/hooks/useActivityAllocation";

interface ActivityAllocationSectionProps {
  tourId: string;
  bookingId: string;
  passengerCount: number;
}

export const ActivityAllocationSection = ({ 
  tourId, 
  bookingId, 
  passengerCount 
}: ActivityAllocationSectionProps) => {
  const { data: activities } = useActivities(tourId);

  // Sort activities by date, then by start time, then by creation date
  const sortedActivities = activities ? [...activities].sort((a, b) => {
    if (a.activity_date && b.activity_date) {
      const dateComparison = new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      if (a.start_time && b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      if (a.start_time && !b.start_time) return -1;
      if (!a.start_time && b.start_time) return 1;
    }
    
    if (a.activity_date && !b.activity_date) return -1;
    if (!a.activity_date && b.activity_date) return 1;
    
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }) : [];

  const {
    allocations,
    editingActivity,
    savingActivity,
    tempEditValue,
    startEditing,
    handleAllocationChange,
    handleSaveActivity,
    handleCancelEdit,
  } = useActivityAllocation({
    bookingId,
    passengerCount,
    activities: sortedActivities,
  });

  // Focus input when editing starts
  useEffect(() => {
    if (editingActivity) {
      setTimeout(() => {
        const input = document.getElementById(`activity-input-${editingActivity}`) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }
  }, [editingActivity]);

  const handleKeyPress = (e: React.KeyboardEvent, activityId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveActivity(activityId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  if (!sortedActivities || sortedActivities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No activities available for this tour.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Activity Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-32">Pax Attending</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActivities.map((activity) => {
            const isEditing = editingActivity === activity.id;
            const isSaving = savingActivity === activity.id;
            const currentValue = allocations[activity.id] ?? 0;

            return (
              <ActivityRow
                key={activity.id}
                activity={activity}
                currentValue={currentValue}
                isEditing={isEditing}
                isSaving={isSaving}
                tempEditValue={tempEditValue}
                onStartEditing={startEditing}
                onAllocationChange={handleAllocationChange}
                onSave={handleSaveActivity}
                onCancel={handleCancelEdit}
                onKeyPress={handleKeyPress}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
