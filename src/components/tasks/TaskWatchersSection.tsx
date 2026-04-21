import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, X, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskWatchers, useAddWatcher, useRemoveWatcher } from "@/hooks/useTaskWatchers";

interface TaskWatchersSectionProps {
  taskId: string;
}

export const TaskWatchersSection = ({ taskId }: TaskWatchersSectionProps) => {
  const { user } = useAuth();
  const { data: watchers, isLoading } = useTaskWatchers(taskId);
  const addWatcher = useAddWatcher();
  const removeWatcher = useRemoveWatcher();
  const [selectedUser, setSelectedUser] = useState("");

  const { data: users } = useQuery({
    queryKey: ['users-for-watchers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');
      return data || [];
    },
  });

  const watcherIds = new Set((watchers || []).map(w => w.user_id));
  const isWatching = user?.id ? watcherIds.has(user.id) : false;

  const formatName = (p: any) => {
    const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
    return name || p?.email || 'Unknown';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <h4 className="font-medium text-sm">Watchers ({watchers?.length || 0})</h4>
        </div>
        {user?.id && (
          <Button
            size="sm"
            variant={isWatching ? "secondary" : "outline"}
            onClick={() => isWatching
              ? removeWatcher.mutate({ task_id: taskId, user_id: user.id })
              : addWatcher.mutate({ task_id: taskId, user_id: user.id })
            }
          >
            {isWatching ? <><EyeOff className="h-3 w-3 mr-1" />Unwatch</> : <><Eye className="h-3 w-3 mr-1" />Watch</>}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {watchers && watchers.length > 0 ? watchers.map(w => (
            <Badge key={w.id} variant="secondary" className="flex items-center gap-1 pr-1">
              {formatName(w.profile)}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={() => removeWatcher.mutate({ task_id: taskId, user_id: w.user_id })}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )) : (
            <span className="text-sm text-muted-foreground">No watchers yet</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Add watcher..." />
          </SelectTrigger>
          <SelectContent>
            {users?.filter(u => !watcherIds.has(u.id)).map(u => (
              <SelectItem key={u.id} value={u.id}>{formatName(u)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!selectedUser}
          onClick={() => {
            if (selectedUser) {
              addWatcher.mutate({ task_id: taskId, user_id: selectedUser });
              setSelectedUser("");
            }
          }}
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
