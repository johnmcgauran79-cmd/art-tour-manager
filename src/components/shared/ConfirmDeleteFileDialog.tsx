import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName?: string | null;
  itemLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
}

export const ConfirmDeleteFileDialog = ({
  open,
  onOpenChange,
  fileName,
  itemLabel = "file",
  isPending,
  onConfirm,
}: ConfirmDeleteFileDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this {itemLabel}?</AlertDialogTitle>
        <AlertDialogDescription>
          {fileName ? <><strong>{fileName}</strong> will be permanently removed. </> : `This ${itemLabel} will be permanently removed. `}
          This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => { e.preventDefault(); onConfirm(); }}
          disabled={isPending}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isPending ? "Deleting..." : "Delete"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
