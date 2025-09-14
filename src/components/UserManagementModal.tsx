import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { UserManagement } from "./UserManagement";

interface UserManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserManagementModal = ({ open, onOpenChange }: UserManagementModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>User Management</DialogTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="mt-4">
          <UserManagement onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};