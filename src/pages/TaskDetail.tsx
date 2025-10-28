import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle, Clock, User, Calendar, MapPin, AlertTriangle, Link, Trash2, X, Save, UserPlus, ArrowLeft } from "lucide-react";
import { Task, useUpdateTask, useDeleteTask, useTasks } from "@/hooks/useTasks";
import { useAutoUnblockTasks } from "@/hooks/useTaskDependencies";
import { formatDistanceToNow, format } from "date-fns";
import { TaskCommentsSection } from "@/components/TaskCommentsSection";
import { TaskAttachmentsSection } from "@/components/TaskAttachmentsSection";
import { TaskDependencyChain } from "@/components/TaskDependencyChain";
import { TaskAssignmentSection } from "@/components/TaskAssignmentSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTours } from "@/hooks/useTours";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useToast } from "@/hooks/use-toast";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: allTasks, isLoading } = useTasks();
  const task = allTasks?.find(t => t.id === id);
  
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const autoUnblock = useAutoUnblockTasks();
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
    if (!task || !hasChanges()) return;
    
    updateTask.mutate({
      taskId: task.id,
      updates: editedTask
    }, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Task updated successfully",
        });
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

  const handleDelete = () => {
    if (!task) return;
    
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
        navigate("/");
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to delete task",
          variant: "destructive",
        });
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (!task) return;
    
    updateTask.mutate({
      taskId: task.id,
      updates: { status: newStatus as any }
    }, {
      onSuccess: () => {
        if (newStatus === 'completed') {
          autoUnblock.mutate(task.id);
        }
        toast({
          title: "Success",
          description: "Task status updated",
        });
      },
    });
  };

  const hasChanges = () => {
    if (!task) return false;
    
    return (
      editedTask.title !== task.title ||
      editedTask.description !== task.description ||
      editedTask.status !== task.status ||
      editedTask.priority !== task.priority ||
      editedTask.category !== task.category ||
      editedTask.due_date !== (task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd\'T\'HH:mm') : '') ||
      editedTask.url_reference !== (task.url_reference || '') ||
      editedTask.tour_id !== (task.tour_id || '')
    );
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
          <Button onClick={() => navigate("/")}>
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

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isBlocked = task.dependent_task && task.dependent_task.status !== 'completed';
  const tour = tours?.find(t => t.id === task.tour_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumbs
          items={[
            { label: "Tasks", href: "/?tab=operations" },
            ...(tour ? [{ label: tour.name, href: `/tours/${tour.id}` }] : []),
            { label: task.title }
          ]}
        />
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Input
              value={editedTask.title || ''}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              className="text-3xl font-bold border-0 px-0 focus-visible:ring-0"
            />
            <div className="flex gap-2 mt-2">
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
              <Badge className={getStatusColor(task.status)}>
                {formatStatus(task.status)}
              </Badge>
              {task.category && (
                <Badge variant="outline">{task.category}</Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(tour ? `/tours/${tour.id}` : "/?tab=operations")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {hasChanges() && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={updateTask.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this task? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alerts */}
        {isOverdue && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700">
                This task is overdue by {formatDistanceToNow(new Date(task.due_date!))}
              </p>
            </div>
          </div>
        )}

        {isBlocked && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-yellow-500 mr-2" />
              <p className="text-sm text-yellow-700">
                This task is blocked by: {task.dependent_task?.title}
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-6">
            <div className="bg-card rounded-lg border p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={editedTask.description || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
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
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Input
                    value={editedTask.category || ''}
                    onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value as any })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Due Date</label>
                  <Input
                    type="datetime-local"
                    value={editedTask.due_date || ''}
                    onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Reference URL</label>
                  <Input
                    value={editedTask.url_reference || ''}
                    onChange={(e) => setEditedTask({ ...editedTask, url_reference: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <TaskAssignmentSection taskId={task.id} />
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-6">
            <TaskCommentsSection taskId={task.id} />
          </TabsContent>

          <TabsContent value="attachments" className="mt-6">
            <TaskAttachmentsSection taskId={task.id} />
          </TabsContent>

          <TabsContent value="dependencies" className="mt-6">
            <TaskDependencyChain task={task} allTasks={allTasks || []} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
