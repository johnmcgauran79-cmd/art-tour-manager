
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DuplicateGroup, useMergeDuplicateContacts, useDeleteDuplicateContacts } from "@/hooks/useCustomers";
import { Merge, Trash2 } from "lucide-react";
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

interface MergeDuplicatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: DuplicateGroup[];
}

export const MergeDuplicatesModal = ({ open, onOpenChange, duplicateGroups }: MergeDuplicatesModalProps) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'merge' | 'delete' | null>(null);
  const mergeDuplicates = useMergeDuplicateContacts();
  const deleteDuplicates = useDeleteDuplicateContacts();

  const isPending = mergeDuplicates.isPending || deleteDuplicates.isPending;

  const handleSelectGroup = (groupKey: string, checked: boolean) => {
    const newSelected = new Set(selectedGroups);
    if (checked) {
      newSelected.add(groupKey);
    } else {
      newSelected.delete(groupKey);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGroups(new Set(duplicateGroups.map(group => group.key)));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const getSelectedGroups = () => duplicateGroups.filter(group => selectedGroups.has(group.key));

  const handleMerge = () => {
    const groupsToMerge = getSelectedGroups();
    if (groupsToMerge.length > 0) {
      mergeDuplicates.mutate(groupsToMerge, {
        onSuccess: () => {
          setSelectedGroups(new Set());
          setConfirmAction(null);
          onOpenChange(false);
        },
        onSettled: () => setConfirmAction(null),
      });
    }
  };

  const handleDelete = () => {
    const groupsToDelete = getSelectedGroups();
    if (groupsToDelete.length > 0) {
      deleteDuplicates.mutate(groupsToDelete, {
        onSuccess: () => {
          setSelectedGroups(new Set());
          setConfirmAction(null);
          onOpenChange(false);
        },
        onSettled: () => setConfirmAction(null),
      });
    }
  };

  const totalDuplicates = getSelectedGroups()
    .reduce((total, group) => total + (group.contacts.length - 1), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Manage Duplicate Contacts
            </DialogTitle>
            <DialogDescription>
              Found {duplicateGroups.length} groups of duplicate contacts. Select groups then choose to merge (combine data) or delete duplicates (keep primary only).
              {selectedGroups.size > 0 && (
                <span className="block mt-2 font-medium text-foreground">
                  {selectedGroups.size} groups selected ({totalDuplicates} duplicate contacts)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedGroups.size === duplicateGroups.length && duplicateGroups.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                Select all groups
              </label>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {duplicateGroups.map((group) => (
                  <Card key={group.key} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedGroups.has(group.key)}
                          onCheckedChange={(checked) => handleSelectGroup(group.key, !!checked)}
                        />
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {group.mergedContact.first_name} {group.mergedContact.last_name}
                          </CardTitle>
                          <CardDescription>
                            {group.contacts.length} duplicate contacts found
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">
                          {group.contacts.length - 1} duplicates
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Merged Result (if merging):</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm bg-muted p-3 rounded">
                          <div><strong>Email:</strong> {group.mergedContact.email || "None"}</div>
                          <div><strong>Phone:</strong> {group.mergedContact.phone || "None"}</div>
                          <div><strong>City:</strong> {group.mergedContact.city || "None"}</div>
                          <div><strong>State:</strong> {group.mergedContact.state || "None"}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2">Original Contacts:</h4>
                        <div className="space-y-2">
                          {group.contacts.map((contact, index) => (
                            <div key={contact.id} className="grid grid-cols-2 gap-2 text-xs p-2 border rounded">
                              <div><strong>Email:</strong> {contact.email || "None"}</div>
                              <div><strong>Phone:</strong> {contact.phone || "None"}</div>
                              <div><strong>City:</strong> {contact.city || "None"}</div>
                              <div><strong>State:</strong> {contact.state || "None"}</div>
                              {index === 0 && (
                                <div className="col-span-2">
                                  <Badge variant="outline" className="text-xs">Primary (will be kept)</Badge>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => setConfirmAction('delete')}
              variant="destructive"
              disabled={selectedGroups.size === 0 || isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isPending ? "Processing..." : `Delete Duplicates (${selectedGroups.size})`}
            </Button>
            <Button 
              onClick={() => setConfirmAction('merge')}
              disabled={selectedGroups.size === 0 || isPending}
            >
              <Merge className="h-4 w-4 mr-2" />
              {isPending ? "Processing..." : `Merge Selected (${selectedGroups.size})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open && !isPending) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'delete' 
                ? `Delete ${totalDuplicates} Duplicate Contacts?`
                : `Merge ${selectedGroups.size} Duplicate Groups?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete'
                ? `This will permanently delete ${totalDuplicates} duplicate contacts and keep only the primary contact in each group. The primary contact's data will NOT be updated. Duplicates with bookings will be skipped.`
                : `This will merge data from ${totalDuplicates} duplicate contacts into the primary contact and then delete the duplicates. Booking references will be reassigned to the primary contact.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              onClick={confirmAction === 'delete' ? handleDelete : handleMerge}
              disabled={isPending}
              variant={confirmAction === 'delete' ? 'destructive' : 'default'}
            >
              {isPending ? "Processing..." : confirmAction === 'delete' ? 'Delete Duplicates' : 'Merge Contacts'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
