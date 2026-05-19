import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskWatchers, useAddWatcher, useRemoveWatcher } from "@/hooks/useTaskWatchers";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";

interface TaskWatchersSectionProps {
  taskId: string;
}

export const TaskWatchersSection = ({ taskId }: TaskWatchersSectionProps) => {
  const { user } = useAuth();
  const { data: watchers, isLoading } = useTaskWatchers(taskId);
  const addWatcher = useAddWatcher();
  const removeWatcher = useRemoveWatcher();
  const [selectedUser, setSelectedUser] = useState("");

  const { data: users } = useAssignableUsers();

  const watcherIds = new Set((watchers || []).map(w => w.user_id));

  const formatName = (p: any) => {
    const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
    return name || p?.email || 'Unknown';
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading followers...</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Current followers (left-aligned chips) */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {watchers && watchers.length > 0 ? watchers.map(w => (
          <Badge
            key={w.id}
            variant="secondary"
            className="flex items-center gap-1 px-3 py-1"
          >
            {formatName(w.profile)}
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0 hover:bg-red-100"
              onClick={() => removeWatcher.mutate({ task_id: taskId, user_id: w.user_id })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )) : (
          <span className="text-sm text-muted-foreground">No followers</span>
        )}
      </div>

      {/* Add new follower (right-aligned on same row) */}
      <div className="flex items-center gap-2 ml-auto">
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select user to follow" />
          </SelectTrigger>
          <SelectContent>
            {users?.filter(u => !watcherIds.has(u.id)).map(u => (
              <SelectItem key={u.id} value={u.id}>{formatName(u)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!selectedUser || addWatcher.isPending}
          onClick={() => {
            if (selectedUser) {
              addWatcher.mutate({ task_id: taskId, user_id: selectedUser });
              setSelectedUser("");
            }
          }}
          className="flex items-center gap-1"
        >
          <UserPlus className="h-4 w-4" />
          {addWatcher.isPending ? "Adding..." : "Follow"}
        </Button>
      </div>
    </div>
  );
};
