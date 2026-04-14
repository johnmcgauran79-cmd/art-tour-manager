import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ItineraryDay } from "@/hooks/useItinerary";
import { ItineraryEntryModal } from "./ItineraryEntryModal";
import { useDeleteItineraryEntry } from "@/hooks/useItinerary";
import { useAuth } from "@/hooks/useAuth";
import { PermissionErrorDialog } from "../PermissionErrorDialog";

interface ItineraryDayCardProps {
  day: ItineraryDay;
  dayNumber: number;
  tourId: string;
  tourName?: string;
  onDeleteDay?: () => void;
  showDeleteDay?: boolean;
}

export const ItineraryDayCard = ({ day, dayNumber, tourId, tourName, onDeleteDay, showDeleteDay }: ItineraryDayCardProps) => {
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const deleteEntry = useDeleteItineraryEntry();
  const { userRole } = useAuth();
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowEntryModal(true);
  };

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setShowEntryModal(true);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteEntry.mutate({ entryId, tourId });
    }
  };

  return (
    <Card className="border-l-4 border-l-brand-navy">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/20">
              Day {dayNumber}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              {format(new Date(day.activity_date), 'EEEE, d MMMM yyyy')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showDeleteDay && onDeleteDay && (
              <Button
                onClick={onDeleteDay}
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remove this day"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {!isAgent && (
              <Button
                onClick={handleAddEntry}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Activity
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {day.entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No activities planned for this day</p>
            <p className="text-sm">Click "Add Activity" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {day.entries.map((entry) => (
              <div key={entry.id} className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {entry.time_slot && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {entry.time_slot}
                        </Badge>
                      )}
                      <h4 className="font-medium text-gray-900">{entry.subject}</h4>
                    </div>
                    {entry.content && (
                      <div 
                        className="text-gray-700 text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: entry.content }}
                      />
                    )}
                  </div>
                  {!isAgent && (
                    <div className="flex items-center gap-1 ml-3">
                      <Button
                        onClick={() => handleEditEntry(entry)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteEntry(entry.id)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <ItineraryEntryModal
          open={showEntryModal}
          onOpenChange={setShowEntryModal}
          day={day}
          entry={editingEntry}
          tourId={tourId}
          tourName={tourName}
        />
        
        <PermissionErrorDialog
          open={deleteEntry.permissionError}
          onOpenChange={(open) => deleteEntry.setPermissionError(open)}
          action="delete itinerary entries"
        />
      </CardContent>
    </Card>
  );
};