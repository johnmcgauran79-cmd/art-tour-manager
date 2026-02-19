
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DuplicateGroup, useMergeDuplicateContacts, useDeleteSelectedContacts, countFilledFields } from "@/hooks/useCustomers";
import { Merge, Trash2, Crown, User, ChevronDown, ChevronUp, X, Zap } from "lucide-react";
import {
  AlertDialog,
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

const ContactInfoGrid = ({ contact, compact = false }: { contact: any; compact?: boolean }) => {
  const textSize = compact ? "text-xs" : "text-sm";
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-1 ${textSize}`}>
      <div><span className="text-muted-foreground">Email:</span> {contact.email || "—"}</div>
      <div><span className="text-muted-foreground">Phone:</span> {contact.phone || "—"}</div>
      <div><span className="text-muted-foreground">City:</span> {contact.city || "—"}</div>
      <div><span className="text-muted-foreground">State:</span> {contact.state || "—"}</div>
      {contact.spouse_name && <div><span className="text-muted-foreground">Spouse:</span> {contact.spouse_name}</div>}
      {contact.dietary_requirements && <div><span className="text-muted-foreground">Dietary:</span> {contact.dietary_requirements}</div>}
      {contact.notes && (
        <div className="col-span-2 truncate"><span className="text-muted-foreground">Notes:</span> {contact.notes}</div>
      )}
    </div>
  );
};

export const MergeDuplicatesModal = ({ open, onOpenChange, duplicateGroups }: MergeDuplicatesModalProps) => {
  // Track individual selected duplicate contact IDs
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(duplicateGroups.slice(0, 3).map(g => g.key)));
  const [confirmAction, setConfirmAction] = useState<'merge' | 'delete' | 'merge-empty' | null>(null);
  const mergeDuplicates = useMergeDuplicateContacts();
  const deleteSelected = useDeleteSelectedContacts();

  const isPending = mergeDuplicates.isPending || deleteSelected.isPending;

  const toggleExpand = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedGroups(next);
  };

  const toggleDuplicate = (id: string) => {
    const next = new Set(selectedDuplicateIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedDuplicateIds(next);
  };

  const selectAllDuplicatesInGroup = (group: DuplicateGroup, checked: boolean) => {
    const next = new Set(selectedDuplicateIds);
    // Skip index 0 (primary), select/deselect the rest
    group.contacts.slice(1).forEach(c => {
      if (checked) next.add(c.id); else next.delete(c.id);
    });
    setSelectedDuplicateIds(next);
  };

  const selectAllDuplicates = (checked: boolean) => {
    const next = new Set<string>();
    if (checked) {
      duplicateGroups.forEach(group => {
        group.contacts.slice(1).forEach(c => next.add(c.id));
      });
    }
    setSelectedDuplicateIds(next);
  };

  // For merge: we need to identify which groups have selected duplicates
  const getGroupsWithSelectedDuplicates = (): DuplicateGroup[] => {
    return duplicateGroups.filter(group =>
      group.contacts.slice(1).some(c => selectedDuplicateIds.has(c.id))
    );
  };

  const handleMerge = () => {
    const groups = getGroupsWithSelectedDuplicates();
    if (groups.length > 0) {
      // Filter each group to only include selected duplicates + primary
      const filteredGroups: DuplicateGroup[] = groups.map(group => ({
        ...group,
        contacts: [group.contacts[0], ...group.contacts.slice(1).filter(c => selectedDuplicateIds.has(c.id))],
      }));
      mergeDuplicates.mutate(filteredGroups, {
        onSuccess: () => {
          setSelectedDuplicateIds(new Set());
          setConfirmAction(null);
        },
        onSettled: () => setConfirmAction(null),
      });
    }
  };

  const handleDelete = () => {
    const ids = Array.from(selectedDuplicateIds);
    if (ids.length > 0) {
      deleteSelected.mutate(ids, {
        onSuccess: () => {
          setSelectedDuplicateIds(new Set());
          setConfirmAction(null);
        },
        onSettled: () => setConfirmAction(null),
      });
    }
  };

  const totalAllDuplicates = duplicateGroups.reduce((t, g) => t + (g.contacts.length - 1), 0);
  const allSelected = totalAllDuplicates > 0 && selectedDuplicateIds.size === totalAllDuplicates;

  // Find groups where ALL contacts (including primary) have no filled fields — auto-merge candidates
  const emptyDuplicateGroups = duplicateGroups.filter(group =>
    group.contacts.every(c => countFilledFields(c) === 0)
  );
  const totalEmptyDuplicates = emptyDuplicateGroups.reduce((t, g) => t + (g.contacts.length - 1), 0);

  const handleMergeAllEmpty = () => {
    if (emptyDuplicateGroups.length > 0) {
      mergeDuplicates.mutate(emptyDuplicateGroups, {
        onSuccess: () => {
          setSelectedDuplicateIds(new Set());
          setConfirmAction(null);
        },
        onSettled: () => setConfirmAction(null),
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Manage Duplicate Contacts
            </DialogTitle>
            <DialogDescription>
              {duplicateGroups.length} groups with {totalAllDuplicates} duplicate contacts.
              Select individual duplicates to delete or merge into the primary contact.
            </DialogDescription>
          </DialogHeader>

          {/* Actions bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-dupes"
                checked={allSelected}
                onCheckedChange={selectAllDuplicates}
              />
              <label htmlFor="select-all-dupes" className="text-sm font-medium">
                Select all duplicates ({totalAllDuplicates})
              </label>
            </div>
            <div className="flex items-center gap-2">
              {selectedDuplicateIds.size > 0 && (
                <span className="text-sm text-muted-foreground mr-2">
                  {selectedDuplicateIds.size} selected
                </span>
              )}
              {totalEmptyDuplicates > 0 && (
                <Button
                  onClick={() => setConfirmAction('merge-empty')}
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Merge All Empty ({totalEmptyDuplicates})
                </Button>
              )}
              <Button
                onClick={() => setConfirmAction('delete')}
                variant="destructive"
                size="sm"
                disabled={selectedDuplicateIds.size === 0 || isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button
                onClick={() => setConfirmAction('merge')}
                size="sm"
                disabled={selectedDuplicateIds.size === 0 || isPending}
              >
                <Merge className="h-4 w-4 mr-1" />
                Merge
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[450px] pr-4">
            <div className="space-y-3">
              {duplicateGroups.map((group) => {
                const primary = group.contacts[0];
                const duplicates = group.contacts.slice(1);
                const primaryFields = countFilledFields(primary);
                const isExpanded = expandedGroups.has(group.key);
                const allGroupDupesSelected = duplicates.every(c => selectedDuplicateIds.has(c.id));
                const someGroupDupesSelected = duplicates.some(c => selectedDuplicateIds.has(c.id));

                return (
                  <Card key={group.key}>
                    {/* Group header with primary contact */}
                    <div
                      className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(group.key)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Crown className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-semibold text-base">
                            {primary.first_name} {primary.last_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Primary · {primaryFields} fields
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <ContactInfoGrid contact={primary} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                        <Checkbox
                          checked={allGroupDupesSelected}
                          onCheckedChange={(checked) => {
                            // Prevent card toggle
                            selectAllDuplicatesInGroup(group, !!checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select all duplicates in ${primary.first_name} ${primary.last_name} group`}
                        />
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Duplicates list (expanded) */}
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4">
                        <Separator className="mb-3" />
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Duplicates</p>
                        <div className="space-y-2">
                          {duplicates.map((dup) => {
                            const dupFields = countFilledFields(dup);
                            const isSelected = selectedDuplicateIds.has(dup.id);
                            return (
                              <div
                                key={dup.id}
                                className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                                  isSelected ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/20'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleDuplicate(dup.id)}
                                  className="mt-0.5"
                                  aria-label={`Select duplicate ${dup.first_name} ${dup.last_name}`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                      {dup.first_name} {dup.last_name}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {dupFields} fields
                                    </Badge>
                                  </div>
                                  <ContactInfoGrid contact={dup} compact />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open && !isPending) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'delete'
                ? `Delete ${selectedDuplicateIds.size} Duplicate Contact${selectedDuplicateIds.size !== 1 ? 's' : ''}?`
                : confirmAction === 'merge-empty'
                ? `Merge All ${totalEmptyDuplicates} Empty Duplicates?`
                : `Merge ${selectedDuplicateIds.size} Duplicate${selectedDuplicateIds.size !== 1 ? 's' : ''} into Primary?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete'
                ? `This will permanently delete ${selectedDuplicateIds.size} selected contact${selectedDuplicateIds.size !== 1 ? 's' : ''}. Primary contacts are never deleted. Contacts with bookings will be skipped.`
                : confirmAction === 'merge-empty'
                ? `This will automatically merge ${totalEmptyDuplicates} duplicate contacts across ${emptyDuplicateGroups.length} groups where no contact has any details filled in. The primary contact will be kept in each group.`
                : `This will merge data from ${selectedDuplicateIds.size} selected duplicate${selectedDuplicateIds.size !== 1 ? 's' : ''} into their primary contact and then delete the duplicates. Booking references will be reassigned.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              onClick={confirmAction === 'delete' ? handleDelete : confirmAction === 'merge-empty' ? handleMergeAllEmpty : handleMerge}
              disabled={isPending}
              variant={confirmAction === 'delete' ? 'destructive' : 'default'}
            >
              {isPending ? "Processing..." : confirmAction === 'delete' ? 'Delete Selected' : confirmAction === 'merge-empty' ? 'Merge All Empty' : 'Merge Selected'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
