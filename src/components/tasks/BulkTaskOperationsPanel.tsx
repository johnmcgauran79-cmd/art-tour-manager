
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Users, RefreshCw, Archive, CheckCircle2, X } from "lucide-react";
import { useBulkUpdateTasks, useBulkAssignTasks, useBulkDeleteTasks } from "@/hooks/useBulkTaskOperations";
import { Task } from "@/hooks/useTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TASK_STATUS_OPTIONS } from "@/lib/taskStatuses";

interface BulkTaskOperationsPanelProps {
  selectedTasks: string[];
  tasks: Task[];
  onClearSelection: () => void;
}

export const BulkTaskOperationsPanel = ({
  selectedTasks,
  tasks,
  onClearSelection,
}: BulkTaskOperationsPanelProps) => {
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("");
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const bulkUpdate = useBulkUpdateTasks();
  const bulkAssign = useBulkAssignTasks();
  const bulkDelete = useBulkDeleteTasks();

  const { data: users } = useQuery({
    queryKey: ['users-for-bulk-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data;
    },
  });

  if (selectedTasks.length === 0) return null;

  const selectedTaskObjects = tasks.filter(task => selectedTasks.includes(task.id));

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus) return;
    
    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { status: bulkStatus as any },
      });
      setBulkStatus("");
      onClearSelection();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleBulkPriorityUpdate = async () => {
    if (!bulkPriority) return;
    
    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { priority: bulkPriority as any },
      });
      setBulkPriority("");
      onClearSelection();
    } catch (error) {
      console.error('Error updating task priority:', error);
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (!bulkCategory) return;
    
    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { category: bulkCategory as any },
      });
      setBulkCategory("");
      onClearSelection();
    } catch (error) {
      console.error('Error updating task category:', error);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedUserId) return;
    
    try {
      await bulkAssign.mutateAsync({
        taskIds: selectedTasks,
        userIds: [selectedUserId],
      });
      setSelectedUserId("");
      onClearSelection();
    } catch (error) {
      console.error('Error assigning tasks:', error);
    }
  };

  const handleBulkComplete = async () => {
    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { status: 'completed' as any },
      });
      onClearSelection();
    } catch (error) {
      console.error('Error completing tasks:', error);
    }
  };

  const handleBulkArchive = async () => {
    try {
      await bulkUpdate.mutateAsync({
        taskIds: selectedTasks,
        updates: { status: 'archived' as any },
      });
      onClearSelection();
    } catch (error) {
      console.error('Error archiving tasks:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedTasks.length} task(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      await bulkDelete.mutateAsync(selectedTasks);
      onClearSelection();
    } catch (error) {
      console.error('Error deleting tasks:', error);
    }
  };

  const getUserDisplayName = (user: any) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-blue-800">
            Bulk Operations
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedTasks.length} tasks selected
          </Badge>
          <span className="text-xs text-blue-600">
            {selectedTaskObjects.filter(t => t.status !== 'completed').length} active
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div>
          <h4 className="text-sm font-medium mb-2">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleBulkComplete}
              size="sm"
              variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50"
              disabled={bulkUpdate.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark Complete
            </Button>
            <Button
              onClick={handleBulkArchive}
              size="sm"
              variant="outline"
              disabled={bulkUpdate.isPending}
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>
            <Button
              onClick={handleBulkDelete}
              size="sm"
              variant="destructive"
              disabled={bulkDelete.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>

        <Separator />

        {/* Status Update */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Update Status</h4>
          <div className="flex gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select status" />
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
          <h4 className="text-sm font-medium">Update Priority</h4>
          <div className="flex gap-2">
            <Select value={bulkPriority} onValueChange={setBulkPriority}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select priority" />
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

        {/* Category Update */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Update Category</h4>
          <div className="flex gap-2">
            <Select value={bulkCategory} onValueChange={setBulkCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="booking">Booking</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleBulkCategoryUpdate}
              disabled={!bulkCategory || bulkUpdate.isPending}
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Assignment */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Assign Tasks</h4>
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select user" />
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
              disabled={!selectedUserId || bulkAssign.isPending}
              size="sm"
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
