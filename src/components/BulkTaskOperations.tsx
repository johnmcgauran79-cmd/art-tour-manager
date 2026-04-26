
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Users, RefreshCw, Archive } from "lucide-react";
import { useBulkUpdateTasks, useBulkAssignTasks, useBulkDeleteTasks } from "@/hooks/useBulkTaskOperations";
import { Task } from "@/hooks/useTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TASK_STATUS_OPTIONS } from "@/lib/taskStatuses";

interface BulkTaskOperationsProps {
  tasks: Task[];
  selectedTasks: string[];
  onTaskSelection: (taskId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export const BulkTaskOperations = ({
  tasks,
  selectedTasks,
  onTaskSelection,
  onSelectAll,
}: BulkTaskOperationsProps) => {
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const bulkUpdate = useBulkUpdateTasks();
  const bulkAssign = useBulkAssignTasks();
  const bulkDelete = useBulkDeleteTasks();

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['users-for-bulk-assign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data;
    },
  });

  const allSelected = tasks.length > 0 && selectedTasks.length === tasks.length;
  const someSelected = selectedTasks.length > 0;

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedTasks.length === 0) return;

    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { status: bulkStatus as any },
      });
      setBulkStatus("");
    } catch (error) {
      console.error('Error updating tasks:', error);
    }
  };

  const handleBulkPriorityUpdate = async () => {
    if (!bulkPriority || selectedTasks.length === 0) return;

    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { priority: bulkPriority as any },
      });
      setBulkPriority("");
    } catch (error) {
      console.error('Error updating tasks:', error);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedUsers.length === 0 || selectedTasks.length === 0) return;

    try {
      await bulkAssign.mutateAsync({
        taskIds: selectedTasks,
        userIds: selectedUsers,
      });
      setSelectedUsers([]);
    } catch (error) {
      console.error('Error assigning tasks:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    
    if (selectedTasks.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedTasks.length} task(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      await bulkDelete.mutateAsync(selectedTasks);
    } catch (error) {
      console.error('Error deleting tasks:', error);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedTasks.length === 0) return;

    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { status: 'archived' as any },
      });
    } catch (error) {
      console.error('Error archiving tasks:', error);
    }
  };

  const getUserDisplayName = (user: any) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      {/* Selection Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => onSelectAll(!!checked)}
            className="data-[state=checked]:bg-primary"
          />
          <span className="text-sm font-medium">
            {someSelected ? `${selectedTasks.length} task(s) selected` : 'Select tasks for bulk operations'}
          </span>
        </div>
        {someSelected && (
          <Badge variant="secondary">{selectedTasks.length} selected</Badge>
        )}
      </div>

      {/* Bulk Operations */}
      {someSelected && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Update */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || bulkUpdate.isPending}
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Priority Update */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={bulkPriority} onValueChange={setBulkPriority}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Change priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkPriorityUpdate}
                disabled={!bulkPriority || bulkUpdate.isPending}
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Assign Users */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select
                value={selectedUsers.length > 0 ? selectedUsers[0] : ""}
                onValueChange={(value) => setSelectedUsers([value])}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Assign to user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getUserDisplayName(user)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkAssign}
                disabled={selectedUsers.length === 0 || bulkAssign.isPending}
                size="sm"
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Delete/Archive Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleBulkArchive}
              disabled={bulkUpdate.isPending}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              size="sm"
              variant="destructive"
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
