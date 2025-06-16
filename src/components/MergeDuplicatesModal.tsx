
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DuplicateGroup, useMergeDuplicateContacts } from "@/hooks/useCustomers";
import { Merge } from "lucide-react";

interface MergeDuplicatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: DuplicateGroup[];
}

export const MergeDuplicatesModal = ({ open, onOpenChange, duplicateGroups }: MergeDuplicatesModalProps) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const mergeDuplicates = useMergeDuplicateContacts();

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

  const handleMerge = () => {
    const groupsToMerge = duplicateGroups.filter(group => selectedGroups.has(group.key));
    if (groupsToMerge.length > 0) {
      mergeDuplicates.mutate(groupsToMerge, {
        onSuccess: () => {
          setSelectedGroups(new Set());
          onOpenChange(false);
        }
      });
    }
  };

  const totalContactsToMerge = duplicateGroups
    .filter(group => selectedGroups.has(group.key))
    .reduce((total, group) => total + (group.contacts.length - 1), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Duplicate Contacts
          </DialogTitle>
          <DialogDescription>
            Found {duplicateGroups.length} groups of duplicate contacts. Select which groups to merge.
            {selectedGroups.size > 0 && (
              <span className="block mt-2 font-medium text-foreground">
                {selectedGroups.size} groups selected ({totalContactsToMerge} contacts will be merged)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedGroups.size === duplicateGroups.length}
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
                        {group.contacts.length - 1} to merge
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Merged Result:</h4>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleMerge}
            disabled={selectedGroups.size === 0 || mergeDuplicates.isPending}
          >
            {mergeDuplicates.isPending ? "Merging..." : `Merge Selected (${selectedGroups.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
