
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDuplicateTour } from "@/hooks/useDuplicateTour";

interface DuplicateTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalTour: {
    id: string;
    name: string;
  } | null;
  onTourCreated: (newTour: any) => void;
}

export const DuplicateTourDialog = ({ 
  open, 
  onOpenChange, 
  originalTour, 
  onTourCreated 
}: DuplicateTourDialogProps) => {
  const [newTourName, setNewTourName] = useState("");
  const duplicateTour = useDuplicateTour();

  const handleConfirm = async () => {
    if (!originalTour || !newTourName.trim()) return;
    
    try {
      const newTour = await duplicateTour.mutateAsync({
        originalTourId: originalTour.id,
        newName: newTourName.trim()
      });
      
      onTourCreated(newTour);
      onOpenChange(false);
      setNewTourName("");
    } catch (error) {
      console.error('Error duplicating tour:', error);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewTourName("");
    }
    onOpenChange(isOpen);
  };

  // Set default name when dialog opens
  React.useEffect(() => {
    if (open && originalTour) {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      setNewTourName(`${originalTour.name} ${nextYear}`);
    }
  }, [open, originalTour]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Tour</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to create a duplicate of "{originalTour?.name}" with the same activities and hotels? 
            The new tour will have dates moved forward by one year.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2 py-4">
          <Label htmlFor="new-tour-name">New Tour Name</Label>
          <Input
            id="new-tour-name"
            value={newTourName}
            onChange={(e) => setNewTourName(e.target.value)}
            placeholder="Enter name for the new tour"
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={!newTourName.trim() || duplicateTour.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {duplicateTour.isPending ? "Creating..." : "Create Duplicate Tour"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
