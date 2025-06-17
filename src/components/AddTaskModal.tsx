
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Users, Link } from "lucide-react";
import { format } from "date-fns";
import { useCreateTask, useTasks } from "@/hooks/useTasks";
import { useTours } from "@/hooks/useTours";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId?: string;
}

export const AddTaskModal = ({ open, onOpenChange, tourId }: AddTaskModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState<'booking' | 'operations' | 'finance' | 'marketing' | 'maintenance' | 'general'>('operations');
  const [dueDate, setDueDate] = useState<Date>();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string | undefined>(tourId);
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string | undefined>();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const createTask = useCreateTask();

  // Fetch tours for the dropdown
  const { data: tours } = useTours();

  // Fetch existing tasks for dependency selection
  const { data: existingTasks } = useTasks();

  // Fetch users for assignment - simplified query to avoid relation issues
  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data;
    },
  });

  // Update selectedTourId when tourId prop changes
  useEffect(() => {
    setSelectedTourId(tourId);
  }, [tourId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      console.log('Title is empty, not submitting');
      return;
    }

    try {
      console.log('Submitting task with data:', {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category,
        due_date: dueDate?.toISOString(),
        tour_id: selectedTourId,
        depends_on_task_id: dependsOnTaskId,
        assignee_ids: selectedUsers,
      });

      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category,
        due_date: dueDate?.toISOString(),
        tour_id: selectedTourId,
        depends_on_task_id: dependsOnTaskId,
        assignee_ids: selectedUsers,
      });

      console.log('Task created successfully, resetting form');

      // Reset form
      setTitle("");
      setDescription("");
      setPriority('medium');
      setCategory('operations');
      setDueDate(undefined);
      setSelectedUsers([]);
      setSelectedTourId(tourId); // Reset to prop value
      setDependsOnTaskId(undefined);
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const getUserDisplayName = (user: any) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  };

  const handleDateSelect = (date: Date | undefined) => {
    setDueDate(date);
    setIsDatePickerOpen(false);
  };

  const getSelectedTourName = () => {
    if (!selectedTourId) return "No tour selected";
    const tour = tours?.find(t => t.id === selectedTourId);
    return tour ? tour.name : "Unknown tour";
  };

  // Filter tasks for dependency selection (exclude completed and current task if editing)
  const availableDependentTasks = existingTasks?.filter(task => 
    task.status !== 'completed' && 
    task.status !== 'cancelled' &&
    task.status !== 'archived'
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add New Task</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title*</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Tour Selection */}
          <div className="space-y-2">
            <Label htmlFor="tour">Assign to Tour (optional)</Label>
            {tourId ? (
              <div className="p-3 border rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">This task will be assigned to:</p>
                <p className="font-medium">{getSelectedTourName()}</p>
              </div>
            ) : (
              <Select value={selectedTourId || "unassigned"} onValueChange={(value) => setSelectedTourId(value === "unassigned" ? undefined : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tour or leave unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No tour (unassigned)</SelectItem>
                  {tours?.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>
                      {tour.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Task Dependency */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Depends on Task (optional)
            </Label>
            <Select value={dependsOnTaskId || "none"} onValueChange={(value) => setDependsOnTaskId(value === "none" ? undefined : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task this depends on" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No dependency</SelectItem>
                {availableDependentTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title} ({task.status.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              This task will be blocked until the selected task is completed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          {/* User Assignment Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign to Users (optional)
            </Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
              {users && users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => handleUserSelection(user.id, !!checked)}
                      />
                      <Label 
                        htmlFor={`user-${user.id}`} 
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {getUserDisplayName(user)}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No users available for assignment</p>
              )}
            </div>
            {selectedUsers.length > 0 && (
              <p className="text-xs text-gray-600">
                {selectedUsers.length} user(s) selected
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createTask.isPending}
            >
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
