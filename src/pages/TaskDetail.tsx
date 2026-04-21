import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, AlertTriangle, Trash2, Save, ArrowLeft } from "lucide-react";
import { useUpdateTask, useDeleteTask, useTasks } from "@/hooks/useTasks";
import { useAutoUnblockTasks } from "@/hooks/useTaskDependencies";
import { formatDistanceToNow, format } from "date-fns";
import { TaskCommentsSection } from "@/components/TaskCommentsSection";
import { TaskAttachmentsSection } from "@/components/TaskAttachmentsSection";
import { TaskDependencyChain } from "@/components/TaskDependencyChain";
import { TaskAssignmentSection } from "@/components/TaskAssignmentSection";
import { TaskActivityFeed } from "@/components/tasks/TaskActivityFeed";
import { TaskSubtasksSection } from "@/components/tasks/TaskSubtasksSection";
import { TaskWatchersSection } from "@/components/tasks/TaskWatchersSection";
import { TaskQuickUpdate } from "@/components/tasks/TaskQuickUpdate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTours } from "@/hooks/useTours";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useToast } from "@/hooks/use-toast";

export default function TaskDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { navigateWithContext, goBack } = useNavigationContext();
  const { toast } = useToast();
  const { data: allTasks, isLoading } = useTasks();
  const task = allTasks?.find(t => t.id === id);
  const [currentTab, setCurrentTab] = useState(searchParams.get('tab') || "details");
  
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const autoUnblock = useAutoUnblockTasks();
  const { data: tours } = useTours();

  // Update tab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setCurrentTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleDelete = () => {
    if (!task) return;
    
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
        goBack("/?tab=operations");
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
            <h1 className="text-3xl font-bold">{task.title}</h1>
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
              onClick={() => goBack("/?tab=operations")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWithContext(`/tasks/${id}/edit`)}
            >
              <Save className="mr-2 h-4 w-4" />
              Edit
            </Button>
            
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

        {/* Quick Update */}
        <TaskQuickUpdate
          taskId={task.id}
          currentUpdate={task.quick_update}
          updatedAt={task.quick_update_at}
        />

        {/* Main Content */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card rounded-lg border p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <p className="text-sm whitespace-pre-wrap">{task.description || '—'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Priority</label>
                    <p className="text-sm">{task.priority}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <p className="text-sm">{task.category || '—'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Due Date</label>
                    <p className="text-sm">
                      {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy HH:mm') : '—'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Reference URL</label>
                    {task.url_reference ? (
                      <a href={task.url_reference} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {task.url_reference}
                      </a>
                    ) : (
                      <p className="text-sm">—</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <TaskAssignmentSection taskId={task.id} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-card rounded-lg border p-4">
                  <TaskSubtasksSection taskId={task.id} />
                </div>
                <div className="bg-card rounded-lg border p-4">
                  <TaskWatchersSection taskId={task.id} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <div className="bg-card rounded-lg border p-6">
              <TaskActivityFeed taskId={task.id} />
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-6">
            <TaskCommentsSection taskId={task.id} />
          </TabsContent>

          <TabsContent value="subtasks" className="mt-6">
            <div className="bg-card rounded-lg border p-6">
              <TaskSubtasksSection taskId={task.id} />
            </div>
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
