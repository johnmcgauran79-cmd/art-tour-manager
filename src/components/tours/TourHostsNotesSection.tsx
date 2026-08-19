import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Edit, Save, X } from "lucide-react";
import { useTours, useUpdateTour } from "@/hooks/useTours";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TourHostsNotesSectionProps {
  tourId: string;
}

export const TourHostsNotesSection = ({ tourId }: TourHostsNotesSectionProps) => {
  const { data: tours } = useTours();
  const updateTour = useUpdateTour();
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");

  const tour = tours?.find(t => t.id === tourId);
  const currentNotes = tour?.tour_hosts_notes || "";

  // Check if user can edit - admins, managers, and hosts can edit; booking agents cannot
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'host';

  const handleEdit = () => {
    setEditingNotes(currentNotes);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingNotes("");
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateTour.mutateAsync({
        tourId: tourId,
        updates: { tour_hosts_notes: editingNotes }
      });
      setIsEditing(false);
      toast({
        title: "Tour Hosts Notes updated",
        description: "Your notes have been saved successfully."
      });
    } catch (error) {
      toast({
        title: "Error updating notes",
        description: "Failed to save notes. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>Tour Hosts Notes</CardTitle>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleCancel}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={updateTour.isPending}
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleEdit}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            placeholder="Add notes about this tour for future reference... (e.g., changes, observations, recommendations)"
            className="min-h-[120px]"
          />
        ) : (
          <div className="min-h-[80px] p-3 border border-border rounded-md bg-muted whitespace-pre-wrap">
            {currentNotes || (
              <span className="text-muted-foreground italic">
                No host notes yet. {canEdit ? "Click Edit to add notes for future reference." : ""}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Use this section to record observations, recommendations, or changes for future tours.
        </p>
      </CardContent>
    </Card>
  );
};
