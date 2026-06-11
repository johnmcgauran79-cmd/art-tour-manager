import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useStaffMembers,
  useCreateStaffLeave,
  staffDisplayName,
} from "@/hooks/useStaffLeave";

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

export const LeaveDialog = ({ open, onOpenChange, defaultDate }: LeaveDialogProps) => {
  const { user } = useAuth();
  const { userRole } = usePermissions();
  const isAdmin = userRole === "admin";
  const { data: staff = [] } = useStaffMembers();
  const createLeave = useCreateStaffLeave();

  const [userId, setUserId] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setUserId(user?.id ?? "");
    setDescription("");
    setStartDate(defaultDate ?? "");
    setEndDate(defaultDate ?? "");
  }, [open, user?.id, defaultDate]);

  const canSave = useMemo(
    () => !!userId && description.trim() && startDate && endDate && endDate >= startDate,
    [userId, description, startDate, endDate]
  );

  const handleSave = async () => {
    if (!canSave) return;
    await createLeave.mutateAsync({
      user_id: userId,
      description: description.trim(),
      start_date: startDate,
      end_date: endDate,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isAdmin && (
            <div className="space-y-1.5">
              <Label>Staff member</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {staffDisplayName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Annual leave, Sick leave"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};