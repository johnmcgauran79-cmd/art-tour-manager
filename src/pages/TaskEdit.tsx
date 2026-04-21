import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import { Task, useUpdateTask, useTasks } from "@/hooks/useTasks";
import { format } from "date-fns";
import { TaskAssignmentSection } from "@/components/TaskAssignmentSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTours } from "@/hooks/useTours";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useToast } from "@/hooks/use-toast";
import { TaskCommentsSection } from "@/components/TaskCommentsSection";

export default function TaskEdit() {
  const { id } = useParams();
  const { goBack } = useNavigationContext();
  const { toast } = useToast();
  const { data: allTasks, isLoading } = useTasks();
  const task = allTasks?.find(t => t.id === id);
  
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  
  const updateTask = useUpdateTask();
  const { data: tours } = useTours();

  useEffect(() => {
    if (task) {
      setEditedTask({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        category: task.category,
        due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd\'T\'HH:mm') : '',
        url_reference: task.url_reference || '',
        tour_id: task.tour_id || ''
      });
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;

    // Normalize empty strings to null so optional fields (e.g. due_date)
    // can be cleared without sending "" to a timestamp column.
    const normalized: Partial<Task> = { ...editedTask };
    const nullableKeys: (keyof Task)[] = ['due_date', 'url_reference', 'tour_id', 'description'];
    nullableKeys.forEach((key) => {
      if (normalized[key] === '') {
        (normalized as any)[key] = null;
      }
    });

    updateTask.mutate({
      taskId: task.id,
      updates: normalized,
    }, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Task updated successfully",
        });
        goBack(`/tasks/${task.id}`);
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to update task",
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Task Not Found</h1>
          <Button onClick={() => goBack("/?tab=operations")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const tour = tours?.find(t => t.id === task.tour_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumbs
          items={[
            { label: "Tasks", href: "/?tab=operations" },
            ...(tour ? [{ label: tour.name, href: `/tours/${tour.id}` }] : []),
            { label: task.title, href: `/tasks/${task.id}` },
            { label: "Edit" }
          ]}
        />
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Edit Task - {task.title}</h1>
            <div className="flex gap-2 mt-2">
              <Badge className={getPriorityColor(editedTask.priority || task.priority)}>
                {editedTask.priority || task.priority}
              </Badge>
              <Badge className={getStatusColor(editedTask.status || task.status)}>
                {formatStatus(editedTask.status || task.status)}
              </Badge>
              {(editedTask.category || task.category) && (
                <Badge variant="outline">{editedTask.category || task.category}</Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goBack(`/tasks/${task.id}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={updateTask.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateTask.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-6">
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={editedTask.title || ''}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="text-lg"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                rows={6}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editedTask.status}
                  onValueChange={(value) => setEditedTask({ ...editedTask, status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={editedTask.priority}
                  onValueChange={(value) => setEditedTask({ ...editedTask, priority: value as any })}
                >
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

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={editedTask.category || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value as any })}
                />
              </div>

              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={editedTask.due_date || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="url_reference">Reference URL</Label>
                <Input
                  id="url_reference"
                  value={editedTask.url_reference || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, url_reference: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <TaskAssignmentSection taskId={task.id} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => goBack(`/tasks/${task.id}`)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateTask.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateTask.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-6">
          <TaskCommentsSection taskId={task.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
