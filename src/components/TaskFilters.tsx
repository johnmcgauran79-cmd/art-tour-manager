
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X, AtSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

interface TaskFiltersProps {
  onFiltersChange: (filters: {
    search?: string;
    assigneeId?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    mentionsMe?: boolean;
  }) => void;
  onClearFilters: () => void;
}

export const TaskFilters = ({ onFiltersChange, onClearFilters }: TaskFiltersProps) => {
  const [search, setSearch] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [mentionsMe, setMentionsMe] = useState(false);

  // Fetch users for assignee filter
  const { data: users } = useQuery({
    queryKey: ['users-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data;
    },
  });

  const applyFilters = (overrides?: { mentionsMe?: boolean }) => {
    const m = overrides?.mentionsMe ?? mentionsMe;
    onFiltersChange({
      search: search.trim() || undefined,
      assigneeId: assigneeId !== "all" ? assigneeId : undefined,
      status: status !== "all" ? status : undefined,
      priority: priority !== "all" ? priority : undefined,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      mentionsMe: m || undefined,
    });
  };

  const handleSearch = () => applyFilters();

  const handleClear = () => {
    setSearch("");
    setAssigneeId("all");
    setStatus("all");
    setPriority("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setMentionsMe(false);
    onClearFilters();
  };

  const getUserDisplayName = (user: any) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        <h3 className="font-medium">Filter Tasks</h3>
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <AtSign className="h-4 w-4 text-primary" />
          <Label htmlFor="mentions-me" className="cursor-pointer">
            Mentions me
          </Label>
          <span className="text-xs text-muted-foreground">
            Tasks where I have unread @mentions
          </span>
        </div>
        <Switch
          id="mentions-me"
          checked={mentionsMe}
          onCheckedChange={(checked) => {
            setMentionsMe(checked);
            applyFilters({ mentionsMe: checked });
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Assignee */}
        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {getUserDisplayName(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="not_required">Not Required</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="awaiting_further_information">Awaiting Further Information</SelectItem>
              <SelectItem value="with_third_party">With Third Party</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Start Date */}
        <div className="space-y-2">
          <Label>Due Date From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <Label>Due Date To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSearch} className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Apply Filters
        </Button>
        <Button onClick={handleClear} variant="outline" className="flex items-center gap-2">
          <X className="h-4 w-4" />
          Clear All
        </Button>
      </div>
    </div>
  );
};
