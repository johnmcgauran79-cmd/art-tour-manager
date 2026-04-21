import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, AlertTriangle, Trash2, Save, ArrowLeft } from "lucide-react";
import { useUpdateTask, useDeleteTask, useTasks, Task } from "@/hooks/useTasks";
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
import { getTaskStatusColor, getTaskPriorityColor, formatStatusText } from "@/lib/statusColors";
import { cn } from "@/lib/utils";

type EditableFields = Pick<Task, "title" | "description" | "priority" | "category" | "due_date" | "url_reference">;

export default function TaskDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { navigateWithContext, goBack } = useNavigationContext();
  const { toast } = useToast();
  const { data: allTasks, isLoading } = useTasks();
  const task = allTasks?.find((t) => t.id === id);
  const [currentTab, setCurrentTab] = useState(searchParams.get("tab") || "comments");

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const autoUnblock = useAutoUnblockTasks();
  const { data: tours } = useTours();

  // Editable form state
  const [edited, setEdited] = useState<Partial<EditableFields>>({});

  useEffect(() => {
    if (task) {
      setEdited({
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : "",
        url_reference: task.url_reference || "",
      });
    }
  }, [task?.id]);

  // Update tab when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) setCurrentTab(tabFromUrl);
  }, [searchParams]);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!task) return false;
    const originalDue = task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : "";
    return (
      (edited.title ?? "") !== (task.title ?? "") ||
      (edited.description ?? "") !== (task.description ?? "") ||
      (edited.priority ?? "") !== (task.priority ?? "") ||
      (edited.category ?? "") !== (task.category ?? "") ||
      (edited.due_date ?? "") !== originalDue ||
      (edited.url_reference ?? "") !== (task.url_reference ?? "")
    );
  }, [edited, task]);

  // Warn on browser unload
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Pending in-app navigation guard
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);

  const guardedNavigate = (action: () => void) => {
    if (isDirty) {
      setPendingNav(() => action);
    } else {
      action();
    }
  };

  const handleDelete = () => {
    if (!task) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: "Success", description: "Task deleted successfully" });
        goBack("/?tab=tasks");
      },
      onError: (error: any) => {
        toast({ title: "Error", description: error.message || "Failed to delete task", variant: "destructive" });
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (!task) return;
    updateTask.mutate(
      { taskId: task.id, updates: { status: newStatus as any } },
      {
        onSuccess: () => {
          if (newStatus === "completed") autoUnblock.mutate(task.id);
          toast({ title: "Success", description: "Task status updated" });
        },
      }
    );
  };

  const handleSave = () => {
    if (!task) return;
    const normalized: Partial<EditableFields> = { ...edited };
    (["due_date", "url_reference", "description"] as const).forEach((key) => {
      if ((normalized as any)[key] === "") (normalized as any)[key] = null;
    });
    updateTask.mutate(
      { taskId: task.id, updates: normalized as any },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: "Task changes saved" });
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  const handleDiscard = () => {
    if (!task) return;
    setEdited({
      title: task.title,
      description: task.description,
      priority: task.priority,
      category: task.category,
      due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : "",
      url_reference: task.url_reference || "",
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
          <Button onClick={() => goBack("/?tab=tasks")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Action Items
          </Button>
        </div>
      </div>
    );
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";
  const isBlocked = task.dependent_task && task.dependent_task.status !== "completed";
  const tour = tours?.find((t) => t.id === task.tour_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumbs
          items={[
            { label: "Action Items", href: "/?tab=tasks" },
            ...(tour ? [{ label: tour.name, href: `/tours/${tour.id}` }] : []),
            { label: task.title },
          ]}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold truncate">{edited.title || task.title}</h1>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => guardedNavigate(() => goBack("/?tab=tasks"))}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
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
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {isOverdue && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
            <p className="text-sm text-destructive">
              This task is overdue by {formatDistanceToNow(new Date(task.due_date!))}
            </p>
          </div>
        </div>
      )}

      {isBlocked && (
        <div className="bg-warning/10 border-l-4 border-warning p-4 rounded">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-warning mr-2" />
            <p className="text-sm text-warning-foreground">
              This task is blocked by: {task.dependent_task?.title}
            </p>
          </div>
        </div>
      )}

      {/* Details (top block, edit mode by default) */}
      <div className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Details</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={!isDirty || updateTask.isPending}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isDirty || updateTask.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateTask.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={edited.title || ""}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={edited.priority}
              onValueChange={(value) => setEdited({ ...edited, priority: value as any })}
            >
              <SelectTrigger
                id="priority"
                className={cn(
                  "border-transparent font-medium",
                  getTaskPriorityColor(edited.priority || task.priority)
                )}
              >
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
            <Label htmlFor="status-inline">Status</Label>
            <Select value={task.status} onValueChange={handleStatusChange}>
              <SelectTrigger
                id="status-inline"
                className={cn(
                  "border-transparent font-medium",
                  getTaskStatusColor(task.status)
                )}
              >
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
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={edited.description || ""}
            onChange={(e) => setEdited({ ...edited, description: e.target.value })}
            rows={4}
            placeholder="Add a description…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={edited.category}
              onValueChange={(value) => setEdited({ ...edited, category: value as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          <div>
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={edited.due_date || ""}
              onChange={(e) => setEdited({ ...edited, due_date: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="url_reference">Reference URL</Label>
            <Input
              id="url_reference"
              value={edited.url_reference || ""}
              onChange={(e) => setEdited({ ...edited, url_reference: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <Label className="mb-2 block">Assignments</Label>
          <TaskAssignmentSection taskId={task.id} />
        </div>
      </div>

      {/* Quick Update */}
      <TaskQuickUpdate
        taskId={task.id}
        currentUpdate={task.quick_update}
        updatedAt={task.quick_update_at}
      />

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="watchers">Watchers</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

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

        <TabsContent value="watchers" className="mt-6">
          <div className="bg-card rounded-lg border p-6">
            <TaskWatchersSection taskId={task.id} />
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <div className="bg-card rounded-lg border p-6">
            <TaskActivityFeed taskId={task.id} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Unsaved-changes confirmation */}
      <AlertDialog open={pendingNav !== null} onOpenChange={(open) => { if (!open) setPendingNav(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this task. If you leave now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNav(null)}>Stay on page</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const fn = pendingNav;
                setPendingNav(null);
                fn?.();
              }}
            >
              Discard & leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
