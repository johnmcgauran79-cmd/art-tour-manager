
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Check, X, Edit } from "lucide-react";

interface ActivityRowProps {
  activity: any;
  currentValue: number;
  isEditing: boolean;
  isSaving: boolean;
  tempEditValue: string;
  onStartEditing: (activityId: string) => void;
  onAllocationChange: (value: string) => void;
  onSave: (activityId: string) => void;
  onCancel: () => void;
  onKeyPress: (e: React.KeyboardEvent, activityId: string) => void;
}

export const ActivityRow = ({
  activity,
  currentValue,
  isEditing,
  isSaving,
  tempEditValue,
  onStartEditing,
  onAllocationChange,
  onSave,
  onCancel,
  onKeyPress,
}: ActivityRowProps) => {
  return (
    <TableRow>
      <TableCell className="font-medium">{activity.name}</TableCell>
      <TableCell>
        {activity.activity_date 
          ? new Date(activity.activity_date).toLocaleDateString('en-AU')
          : 'TBD'
        }
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            id={`activity-input-${activity.id}`}
            type="number"
            min="0"
            value={tempEditValue}
            onChange={(e) => onAllocationChange(e.target.value)}
            onKeyDown={(e) => onKeyPress(e, activity.id)}
            className="w-20"
            disabled={isSaving}
          />
        ) : (
          <div 
            className="cursor-pointer hover:bg-muted p-2 rounded w-20 text-center border border-transparent hover:border-muted-foreground/30 select-none"
            onClick={() => onStartEditing(activity.id)}
            title="Click to edit"
          >
            {currentValue}
          </div>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSave(activity.id)}
              disabled={isSaving}
              className="h-8 w-8 p-0"
              title="Save changes"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
              className="h-8 w-8 p-0"
              title="Cancel changes"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStartEditing(activity.id)}
            className="h-8 w-8 p-0"
            title="Edit attendance"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};
