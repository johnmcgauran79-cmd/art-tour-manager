import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Check, ExternalLink, Loader2, UserPlus, X, ArrowUpRight, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import {
  PersonalTodo,
  useConvertTodoToTask,
  useDeleteTodo,
  useShareTodo,
  useTodoShares,
  useUnshareTodo,
  useUpdateTodo,
} from "@/hooks/usePersonalTodos";

interface TodoDetailDialogProps {
  todo: PersonalTodo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TodoDetailDialog = ({ todo, open, onOpenChange }: TodoDetailDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const updateTodo = useUpdateTodo();
  const shareTodo = useShareTodo();
  const unshareTodo = useUnshareTodo();
  const deleteTodo = useDeleteTodo();
  const convertTodo = useConvertTodoToTask();
  const { data: shares = [] } = useTodoShares(todo?.id);
  const { data: users = [] } = useAssignableUsers();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [due, setDue] = useState<Date | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const isOwner = !!todo && todo.user_id === user?.id;

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title);
    setNotes(todo.notes || "");
    setLinkUrl(todo.link_url || "");
    setDue(todo.due_date ? parseISO(todo.due_date) : undefined);
  }, [todo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!todo) return null;

  const sharedUserIds = shares.map((s) => s.user_id);
  const available = users.filter((u) => u.id !== todo.user_id && !sharedUserIds.includes(u.id));
  const nameFor = (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return "Unknown user";
    return `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Unknown user";
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    const trimmedLink = linkUrl.trim();
    const normalisedLink = trimmedLink
      ? /^https?:\/\//i.test(trimmedLink)
        ? trimmedLink
        : `https://${trimmedLink}`
      : null;
    await updateTodo.mutateAsync({
      id: todo.id,
      title: title.trim(),
      notes: notes.trim() || null,
      link_url: normalisedLink,
      due_date: due ? format(due, "yyyy-MM-dd") : null,
    });
    onOpenChange(false);
  };

  const handleConvert = async (keepTodo: boolean) => {
    const task = await convertTodo.mutateAsync({ todo, keepTodo });
    setConvertOpen(false);
    onOpenChange(false);
    if (task?.id) navigate(`/tasks/${task.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isOwner ? "Edit to-do" : "Shared to-do"}</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Short, simple jobs. Convert to a Task when it needs approvals, links or in-depth notes."
              : `Shared with you by ${nameFor(todo.user_id)} — you can tick it off but not edit it.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="todo-title">Title</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isOwner}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="todo-notes">Notes</Label>
            <Textarea
              id="todo-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Any quick detail you need to remember…"
              disabled={!isOwner}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="todo-link">Reference link</Label>
            <div className="flex gap-2">
              <Input
                id="todo-link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                disabled={!isOwner}
              />
              {linkUrl.trim() && (
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  aria-label="Open reference link"
                >
                  <a
                    href={/^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Due date</Label>
            <div className="flex gap-2">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!isOwner}
                    className={cn("justify-start", !due && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {due ? format(due, "dd/MM/yyyy") : "No due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={due}
                    onSelect={(d) => {
                      setDue(d);
                      setPickerOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {due && isOwner && (
                <Button variant="ghost" size="icon" onClick={() => setDue(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Shared with</Label>
            <div className="flex flex-wrap gap-2">
              {sharedUserIds.length === 0 && (
                <p className="text-sm text-muted-foreground">Just you for now.</p>
              )}
              {sharedUserIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {nameFor(id)}
                  {isOwner && (
                    <button
                      onClick={() => unshareTodo.mutate({ todoId: todo.id, userId: id })}
                      className="ml-1 hover:text-destructive"
                      aria-label={`Remove ${nameFor(id)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {isOwner && available.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add someone
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1" align="start">
                  <div className="max-h-56 overflow-auto">
                    {available.map((u) => (
                      <button
                        key={u.id}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                        onClick={() => shareTodo.mutate({ todoId: todo.id, userIds: [u.id] })}
                      >
                        {nameFor(u.id)}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isOwner && (
              <p className="text-xs text-muted-foreground">
                People you add get a Teams notification and see it in their own to-do list.
              </p>
            )}
          </div>

          {todo.converted_task_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/tasks/${todo.converted_task_id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open linked Task
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isOwner ? (
            <div className="flex gap-2">
              {!todo.converted_task_id && (
                <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={convertTodo.isPending}>
                      {convertTodo.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                      )}
                      Convert to Task
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Convert to a full Task?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{todo.title}" will become a Task with everyone it's shared with assigned.
                        Do you want to keep the original to-do as a completed, linked record so you
                        can still see it in your list, or delete it once the Task is created?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button variant="outline" onClick={() => handleConvert(true)} disabled={convertTodo.isPending}>
                        Keep the to-do
                      </Button>
                      <Button onClick={() => handleConvert(false)} disabled={convertTodo.isPending}>
                        Delete the to-do
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this to-do?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{todo.title}" will be permanently removed. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteTodo.mutate(todo.id);
                        onOpenChange(false);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {isOwner && (
              <Button onClick={handleSave} disabled={!title.trim() || updateTodo.isPending}>
                {updateTodo.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
