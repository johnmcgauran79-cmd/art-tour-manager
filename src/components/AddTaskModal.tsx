import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Users, Link, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useCreateTask, useTasks } from "@/hooks/useTasks";
import { useTours } from "@/hooks/useTours";
import { cn } from "@/lib/utils";
import { validateTaskData, sanitizeTaskInput } from "@/utils/taskValidation";
import { LinkableTextarea } from "@/components/entityLinks/LinkableTextarea";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";

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
  const [urlReference, setUrlReference] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const createTask = useCreateTask();

  // Fetch tours for the dropdown
  const { data: tours } = useTours();

  // Fetch existing tasks for dependency selection
  const { data: existingTasks } = useTasks();

  // Only Admin and Manager users can be assigned to tasks.
  const { data: users } = useAssignableUsers();

  // Update selectedTourId when tourId prop changes
  useEffect(() => {
    setSelectedTourId(tourId);
  }, [tourId]);

  // Real-time validation
  useEffect(() => {
    const taskData = {
      title: sanitizeTaskInput(title),
      description: sanitizeTaskInput(description),
      priority,
      category,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
      depends_on_task_id: dependsOnTaskId,
      assignee_ids: selectedUsers,
    };

    const validation = validateTaskData(taskData);
    setValidationErrors(validation.errors);
    setValidationWarnings(validation.warnings);
  }, [title, description, priority, category, dueDate, dependsOnTaskId, selectedUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedTitle = sanitizeTaskInput(title);
    const sanitizedDescription = sanitizeTaskInput(description);
    
    const taskData = {
      title: sanitizedTitle,
      description: sanitizedDescription,
      priority,
      category,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
      depends_on_task_id: dependsOnTaskId,
      url_reference: urlReference.trim() || undefined,
      assignee_ids: selectedUsers,
    };

    const validation = validateTaskData(taskData);
    
    if (!validation.isValid) {
      console.log('Validation failed:', validation.errors);
      return;
    }

    try {
      console.log('Submitting task with data:', {
        ...taskData,
        tour_id: selectedTourId,
      });

      await createTask.mutateAsync({
        ...taskData,
        tour_id: selectedTourId,
      });

      console.log('Task created successfully, resetting form');

      // Reset form
      setTitle("");
      setDescription("");
      setPriority('medium');
      setCategory('operations');
      setDueDate(undefined);
      setSelectedUsers([]);
      setSelectedTourId(tourId);
      setDependsOnTaskId(undefined);
      setUrlReference("");
      setValidationErrors([]);
      setValidationWarnings([]);
      
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
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new task with details, priority, and assignments.
          </DialogDescription>
        </DialogHeader>

        {/* Validation Messages */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validationWarnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

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
            <Label htmlFor="url_reference" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL Reference (optional)
            </Label>
            <Input
              id="url_reference"
              type="url"
              value={urlReference}
              onChange={(e) => setUrlReference(e.target.value)}
              placeholder="https://example.com/related-link"
            />
            <p className="text-xs text-gray-500">
              Add a link to external resources related to this task.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <LinkableTextarea
              id="description"
              value={description}
              onChange={setDescription}
              placeholder="Enter task description (optional). Use 'Link record' to reference a booking, hotel, tour, etc."
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
              disabled={validationErrors.length > 0 || !title.trim() || createTask.isPending}
            >
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
