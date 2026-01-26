import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { 
  useTourHostAssignments, 
  useHostUsers, 
  useAssignHostToTour, 
  useRemoveHostFromTour 
} from "@/hooks/useTourHostAssignments";
import { useTours } from "@/hooks/useTours";

interface TourHostAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId?: string;
  tourName?: string;
  hostUserId?: string; // If provided, we're assigning tours to a specific host
  hostEmail?: string;
}

export function TourHostAssignmentModal({
  open,
  onOpenChange,
  tourId,
  tourName,
  hostUserId,
  hostEmail,
}: TourHostAssignmentModalProps) {
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [selectedTour, setSelectedTour] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: assignments = [], isLoading: loadingAssignments } = useTourHostAssignments(tourId);
  const { data: hostUsers = [], isLoading: loadingHosts } = useHostUsers();
  const { data: tours = [], isLoading: loadingTours } = useTours();
  const assignHost = useAssignHostToTour();
  const removeHost = useRemoveHostFromTour();

  // Mode detection: Tour-centric (assign hosts to a tour) vs Host-centric (assign tours to a host)
  const isTourMode = !!tourId;

  const handleAssign = async () => {
    if (isTourMode && selectedHost) {
      await assignHost.mutateAsync({
        tourId: tourId!,
        hostUserId: selectedHost,
        notes: notes || undefined,
      });
      setSelectedHost("");
      setNotes("");
    } else if (!isTourMode && selectedTour && hostUserId) {
      await assignHost.mutateAsync({
        tourId: selectedTour,
        hostUserId: hostUserId,
        notes: notes || undefined,
      });
      setSelectedTour("");
      setNotes("");
    }
  };

  const handleRemove = async (assignmentId: string) => {
    await removeHost.mutateAsync({ assignmentId, tourId: tourId || "" });
  };

  // Filter out already assigned hosts/tours
  const availableHosts = hostUsers.filter(
    host => !assignments.some(a => a.host_user_id === host.id)
  );

  const assignedHostsWithProfiles = assignments.map(assignment => {
    const hostProfile = hostUsers.find(h => h.id === assignment.host_user_id);
    return {
      ...assignment,
      hostEmail: hostProfile?.email || 'Unknown',
      hostName: hostProfile ? `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || hostProfile.email : 'Unknown',
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isTourMode 
              ? `Manage Host Assignments - ${tourName || 'Tour'}`
              : `Assign Tours to ${hostEmail || 'Host'}`
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Assignments */}
          <div>
            <Label className="text-sm font-medium">Current Assignments</Label>
            {loadingAssignments ? (
              <p className="text-sm text-muted-foreground mt-2">Loading...</p>
            ) : assignedHostsWithProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                No hosts assigned to this tour yet.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {assignedHostsWithProfiles.map((assignment) => (
                  <div 
                    key={assignment.id} 
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium">{assignment.hostName}</p>
                      <p className="text-xs text-muted-foreground">{assignment.hostEmail}</p>
                      {assignment.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{assignment.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(assignment.id)}
                      disabled={removeHost.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Assignment */}
          {isTourMode && (
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Add Host</Label>
              
              {loadingHosts ? (
                <p className="text-sm text-muted-foreground mt-2">Loading hosts...</p>
              ) : availableHosts.length === 0 ? (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    No available hosts. Create users with the "Host" role first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  <Select value={selectedHost} onValueChange={setSelectedHost}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a host..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableHosts.map((host) => (
                        <SelectItem key={host.id} value={host.id}>
                          {host.first_name} {host.last_name} ({host.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div>
                    <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this assignment..."
                      className="h-20"
                    />
                  </div>

                  <Button 
                    onClick={handleAssign}
                    disabled={!selectedHost || assignHost.isPending}
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {assignHost.isPending ? "Assigning..." : "Assign Host"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Host mode - assign tours to a host */}
          {!isTourMode && hostUserId && (
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Assign Tour</Label>
              
              {loadingTours ? (
                <p className="text-sm text-muted-foreground mt-2">Loading tours...</p>
              ) : (
                <div className="space-y-3 mt-2">
                  <Select value={selectedTour} onValueChange={setSelectedTour}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tour..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tours
                        .filter(t => t.status !== 'past')
                        .map((tour) => (
                          <SelectItem key={tour.id} value={tour.id}>
                            {tour.name} ({new Date(tour.start_date).toLocaleDateString()})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <div>
                    <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this assignment..."
                      className="h-20"
                    />
                  </div>

                  <Button 
                    onClick={handleAssign}
                    disabled={!selectedTour || assignHost.isPending}
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {assignHost.isPending ? "Assigning..." : "Assign Tour"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
