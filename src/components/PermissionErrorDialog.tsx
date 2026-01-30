import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PermissionErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string;
  reason?: string;
}

export const PermissionErrorDialog = ({ 
  open, 
  onOpenChange, 
  action = "perform this action" 
}: PermissionErrorDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permission Denied</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>You don't have permission to {action}.</p>
            <p className="text-sm text-muted-foreground">
              If you believe you should have access to this feature, please contact your administrator.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
