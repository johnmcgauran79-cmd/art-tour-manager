import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserManagement } from "./UserManagement";

interface UserManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserManagementModal = ({ open, onOpenChange }: UserManagementModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Management</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <UserManagement onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};