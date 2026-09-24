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
import { Button } from "@/components/ui/button";

/** Close nested dialogs one at a time so the page never stays frozen. */
export const afterDialogClose = (fn: () => void) => {
  setTimeout(() => {
    fn();
    setTimeout(() => {
      document.body.style.pointerEvents = "";
    }, 150);
  }, 150);
};

export function UnsavedChangesDialog({
  open,
  saving,
  onKeepEditing,
  onDiscard,
  onSaveAndClose,
}: {
  open: boolean;
  saving?: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSaveAndClose: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onKeepEditing()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            Some of your latest edits haven't been saved yet. Save them before closing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onKeepEditing}>Keep editing</AlertDialogCancel>
          <Button variant="outline" onClick={onDiscard} disabled={saving}>
            Discard changes
          </Button>
          <AlertDialogAction onClick={onSaveAndClose} disabled={saving}>
            Save and close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SaveConflictDialog({
  open,
  onLoadLatest,
  onKeepMine,
}: {
  open: boolean;
  onLoadLatest: () => void;
  onKeepMine: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This email was changed somewhere else</AlertDialogTitle>
          <AlertDialogDescription>
            Someone else, or another tab or computer, saved this email after you opened it.
            Autosave is paused so nothing gets overwritten. Load their latest version, or keep
            yours and replace theirs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button variant="outline" onClick={onKeepMine}>
            Keep my version
          </Button>
          <AlertDialogAction onClick={onLoadLatest}>Load latest version</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
