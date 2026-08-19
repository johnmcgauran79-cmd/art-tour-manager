import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import {
  useTaskStatuses,
  useCreateTaskStatus,
  useUpdateTaskStatus,
  useDeleteTaskStatus,
  type TaskStatusRow,
} from "@/hooks/useTaskStatuses";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const toValue = (label: string) =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const TaskStatusManagementModal = ({ open, onOpenChange }: Props) => {
  const { data: statuses = [] } = useTaskStatuses();
  const createMutation = useCreateTaskStatus();
  const updateMutation = useUpdateTaskStatus();
  const deleteMutation = useDeleteTaskStatus();

  const [newLabel, setNewLabel] = useState("");
  const [newFinished, setNewFinished] = useState(false);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const value = toValue(newLabel);
    if (!value) return;
    const maxOrder = statuses.reduce((m, s) => Math.max(m, s.sort_order), 0);
    createMutation.mutate(
      { value, label: newLabel.trim(), sort_order: maxOrder + 10, is_finished: newFinished },
      {
        onSuccess: () => {
          setNewLabel("");
          setNewFinished(false);
        },
      },
    );
  };

  const swap = (a: TaskStatusRow, b: TaskStatusRow) => {
    updateMutation.mutate({ id: a.id, sort_order: b.sort_order });
    updateMutation.mutate({ id: b.id, sort_order: a.sort_order });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Task Statuses</DialogTitle>
          <DialogDescription>
            Manage the statuses available to tasks across the system. Built-in statuses can be
            renamed or reordered but not deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {statuses.map((s, idx) => (
            <div
              key={s.id}
              className="flex items-center gap-2 border rounded-md p-2 bg-card"
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={idx === 0}
                  onClick={() => swap(s, statuses[idx - 1])}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={idx === statuses.length - 1}
                  onClick={() => swap(s, statuses[idx + 1])}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={s.label}
                onChange={(e) =>
                  updateMutation.mutate({ id: s.id, label: e.target.value })
                }
                className="flex-1"
              />
              <code className="text-xs text-muted-foreground w-48 truncate">{s.value}</code>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <Checkbox
                  checked={s.is_finished}
                  onCheckedChange={(checked) =>
                    updateMutation.mutate({ id: s.id, is_finished: !!checked })
                  }
                />
                Closed
              </label>
              <Button
                variant="ghost"
                size="icon"
                disabled={s.is_system}
                onClick={() => {
                  if (confirm(`Remove "${s.label}"?`)) deleteMutation.mutate(s.id);
                }}
                aria-label="Delete status"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 mt-4 space-y-3">
          <Label>Add a new status</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Status label (e.g. Ready for Review)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-1"
            />
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
              <Checkbox
                checked={newFinished}
                onCheckedChange={(c) => setNewFinished(!!c)}
              />
              Closed status
            </label>
            <Button onClick={handleAdd} disabled={!newLabel.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            "Closed" statuses count as finished — tasks with this status are excluded from active
            lists.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};