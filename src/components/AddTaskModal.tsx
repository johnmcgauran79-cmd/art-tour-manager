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
import { CalendarIcon, Users, Link, AlertTriangle, ListChecks, Plus, Trash2, User as UserIcon, Eye, Paperclip, FileText } from "lucide-react";
import { format } from "date-fns";
import { useCreateTask, useTasks } from "@/hooks/useTasks";
import { useUpdateTask } from "@/hooks/useTaskMutations";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useRequestApproval, ApprovalPolicy } from "@/hooks/useTaskApprovers";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTours } from "@/hooks/useTours";
import { cn } from "@/lib/utils";
import { validateTaskData, sanitizeTaskInput } from "@/utils/taskValidation";
import { LinkableTextarea } from "@/components/entityLinks/LinkableTextarea";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { isTaskFinished } from "@/lib/taskStatuses";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTaskTemplates } from "@/hooks/useTaskTemplates";
import { Sparkles } from "lucide-react";

interface DraftSubtask {
  id: string; // local-only id for keying
  title: string;
  assignee_id: string | null;
  due_date: string | null; // yyyy-MM-dd
}

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
  const [selectedFollowers, setSelectedFollowers] = useState<string[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string | undefined>(tourId);
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string | undefined>();
  const [urlReference, setUrlReference] = useState("");
  const [status, setStatus] = useState<string>("not_started");
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>("all");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<File[]>([]);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const requestApproval = useRequestApproval();
  const { data: taskStatuses } = useTaskStatuses();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: allTemplates } = useTaskTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

  const usableTemplates = (allTemplates || []).filter((t) => t.is_active);

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") return;
    const tpl = usableTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.name);
    setDescription(tpl.description || "");
    setPriority(tpl.priority);
    setCategory(tpl.category);
    setUrlReference(tpl.default_url_reference || "");
    setStatus(tpl.default_status || "not_started");
    setApprovalPolicy((tpl.approval_policy || "all") as ApprovalPolicy);
    setApproverIds(tpl.approver_user_ids || []);
    setSelectedUsers(tpl.assignee_user_ids || []);
  };

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

      const created = await createTask.mutateAsync({
        ...taskData,
        tour_id: selectedTourId,
      });

      // Apply selected status / approval flow after creation
      if (created?.id) {
        if (status === "approval_required" && approverIds.length > 0) {
          await requestApproval.mutateAsync({
            taskId: created.id,
            userIds: approverIds,
            policy: approvalPolicy,
          });
        } else if (status && status !== "not_started") {
          await updateTask.mutateAsync({
            taskId: created.id,
            updates: { status: status as any },
            silent: true,
          });
        }
      }

      // Persist any draft subtasks created in this modal
      const subtasksToInsert = draftSubtasks
        .map((s) => ({ ...s, title: s.title.trim() }))
        .filter((s) => s.title.length > 0);
      if (created?.id && subtasksToInsert.length > 0) {
        const { data: userRes } = await supabase.auth.getUser();
        const actorId = userRes.user?.id ?? null;
        const rows = subtasksToInsert.map((s, idx) => ({
          task_id: created.id,
          title: s.title,
          created_by: actorId!,
          assignee_id: s.assignee_id ?? actorId,
          due_date: s.due_date,
          sort_order: idx,
        }));
        const { error: subtaskError } = await supabase.from('task_subtasks').insert(rows);
        if (subtaskError) {
          console.error('Error creating subtasks:', subtaskError);
          toast({
            title: "Subtasks not created",
            description: subtaskError.message,
            variant: "destructive",
          });
        } else {
          queryClient.invalidateQueries({ queryKey: ['task-subtasks', created.id] });
        }
      }

      // Persist any selected followers (no notification — follower != assignee)
      if (created?.id && selectedFollowers.length > 0) {
        const { data: userRes } = await supabase.auth.getUser();
        const actorId = userRes.user?.id ?? null;
        const watcherRows = selectedFollowers.map((uid) => ({
          task_id: created.id,
          user_id: uid,
          added_by: actorId,
        }));
        const { error: watcherError } = await supabase
          .from('task_watchers')
          .insert(watcherRows);
        if (watcherError) {
          console.error('Error adding followers:', watcherError);
          toast({
            title: "Followers not added",
            description: watcherError.message,
            variant: "destructive",
          });
        } else {
          queryClient.invalidateQueries({ queryKey: ['task-watchers', created.id] });
        }
      }

      // Upload any attachments selected in this modal
      if (created?.id && draftAttachments.length > 0) {
        const { data: userRes } = await supabase.auth.getUser();
        const actorId = userRes.user?.id ?? null;
        for (const file of draftAttachments) {
          try {
            const fileName = `${Date.now()}-${file.name}`;
            const filePath = `tasks/${created.id}/${fileName}`;
            const { error: uploadError } = await supabase.storage
              .from('attachments')
              .upload(filePath, file);
            if (uploadError) throw uploadError;
            const { error: dbError } = await supabase.from('task_attachments').insert({
              task_id: created.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: actorId!,
            });
            if (dbError) throw dbError;
          } catch (attachError) {
            console.error('Error uploading attachment:', attachError);
            toast({
              title: "Attachment not uploaded",
              description: `Failed to upload ${file.name}.`,
              variant: "destructive",
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['task-attachments', created.id] });
      }

      console.log('Task created successfully, resetting form');

      // Reset form
      setTitle("");
      setDescription("");
      setPriority('medium');
      setCategory('operations');
      setDueDate(undefined);
      setSelectedUsers([]);
      setSelectedFollowers([]);
      setSelectedTourId(tourId);
      setDependsOnTaskId(undefined);
      setUrlReference("");
      setStatus("not_started");
      setApproverIds([]);
      setApprovalPolicy("all");
      setValidationErrors([]);
      setValidationWarnings([]);
      setDraftSubtasks([]);
      setNewSubtaskTitle("");
      setDraftAttachments([]);
      
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

  const userLabel = (u?: { first_name: string | null; last_name: string | null; email: string | null } | null) => {
    if (!u) return "Unassigned";
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return name || u.email || "Unknown";
  };

  const addDraftSubtask = () => {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    setDraftSubtasks((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: t,
        assignee_id: null,
        due_date: null,
      },
    ]);
    setNewSubtaskTitle("");
  };

  const updateDraftSubtask = (id: string, patch: Partial<DraftSubtask>) => {
    setDraftSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeDraftSubtask = (id: string) => {
    setDraftSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const addDraftAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDraftAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removeDraftAttachment = (index: number) => {
    setDraftAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  // Filter tasks for dependency selection (exclude finished tasks)
  const availableDependentTasks = existingTasks?.filter(task => !isTaskFinished(task.status)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new task with details, priority, and assignments.
          </DialogDescription>
        </DialogHeader>

        {usableTemplates.length > 0 && (
          <div className="space-y-2 p-3 border rounded-md bg-muted/30">
            <Label className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" />
              Start from a template (optional)
            </Label>
            <Select value={selectedTemplateId} onValueChange={applyTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template or create fresh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Create fresh task</SelectItem>
                {usableTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.template_type === 'standalone' ? '' : ' (tour-based)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              All loaded values can be edited below before saving.
            </p>
          </div>
        )}

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

          {/* Initial Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Initial Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(taskStatuses ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status === "approval_required" && (
              <p className="text-xs text-muted-foreground">
                Select approvers below — they will be auto-assigned to the task and notified.
              </p>
            )}
          </div>

          {/* Approvers (only when status is approval_required) */}
          {status === "approval_required" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Required Approvers
              </Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                {users && users.length > 0 ? (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div key={`approver-${user.id}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`approver-${user.id}`}
                          checked={approverIds.includes(user.id)}
                          onCheckedChange={(checked) =>
                            setApproverIds((prev) =>
                              checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                            )
                          }
                        />
                        <Label
                          htmlFor={`approver-${user.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {getUserDisplayName(user)}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No eligible approvers available</p>
                )}
              </div>
              {approverIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {approverIds.length} approver(s) selected
                </p>
              )}
              <div className="space-y-1 pt-2">
                <Label className="text-sm">Approval policy</Label>
                <RadioGroup
                  value={approvalPolicy}
                  onValueChange={(v) => setApprovalPolicy(v as ApprovalPolicy)}
                  className="flex gap-4"
                >
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <RadioGroupItem value="all" id="add-policy-all" />
                    All required
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <RadioGroupItem value="any" id="add-policy-any" />
                    Any one is enough
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

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

          {/* Followers Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Followers (optional)
            </Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
              {users && users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={`follower-${user.id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`follower-${user.id}`}
                        checked={selectedFollowers.includes(user.id)}
                        onCheckedChange={(checked) =>
                          setSelectedFollowers((prev) =>
                            checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                          )
                        }
                      />
                      <Label
                        htmlFor={`follower-${user.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {getUserDisplayName(user)}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No users available to follow</p>
              )}
            </div>
            {selectedFollowers.length > 0 && (
              <p className="text-xs text-gray-600">
                {selectedFollowers.length} follower(s) selected — they'll see updates but won't be notified about being added.
              </p>
            )}
          </div>

          {/* Subtasks Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              <Label className="font-medium">
                Subtasks{" "}
                {draftSubtasks.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    ({draftSubtasks.length})
                  </span>
                )}
              </Label>
            </div>

            {draftSubtasks.length > 0 && (
              <div className="space-y-2">
                {draftSubtasks.map((st) => {
                  const assignee = st.assignee_id
                    ? users?.find((u) => u.id === st.assignee_id)
                    : null;
                  const dueDateObj = st.due_date ? new Date(st.due_date + "T00:00:00") : undefined;
                  return (
                    <div
                      key={st.id}
                      className="group rounded border border-border/60 px-3 py-2 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={st.title}
                          onChange={(e) => updateDraftSubtask(st.id, { title: e.target.value })}
                          placeholder="Subtask title"
                          className="h-8 flex-1"
                        />

                        <Select
                          value={st.assignee_id ?? "unassigned"}
                          onValueChange={(val) =>
                            updateDraftSubtask(st.id, {
                              assignee_id: val === "unassigned" ? null : val,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-auto min-w-[8rem] gap-1 px-2 text-xs">
                            <UserIcon className="h-3 w-3 text-muted-foreground" />
                            <SelectValue>
                              <span className="truncate">{userLabel(assignee)}</span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {users?.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {userLabel(u)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(
                                "h-8 gap-1 px-2 text-xs font-normal",
                                !dueDateObj && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="h-3 w-3" />
                              {dueDateObj ? format(dueDateObj, "d MMM yyyy") : "Due date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={dueDateObj}
                              onSelect={(date) =>
                                updateDraftSubtask(st.id, {
                                  due_date: date ? format(date, "yyyy-MM-dd") : null,
                                })
                              }
                              initialFocus
                              className="pointer-events-auto"
                            />
                            {dueDateObj && (
                              <div className="p-2 border-t">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="w-full h-7 text-xs"
                                  onClick={() => updateDraftSubtask(st.id, { due_date: null })}
                                >
                                  Clear due date
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDraftSubtask(st.id)}
                          aria-label="Remove subtask"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Add a subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftSubtask();
                  }
                }}
                className="h-9"
              />
              <Button
                type="button"
                onClick={addDraftSubtask}
                size="sm"
                disabled={!newSubtaskTitle.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Subtasks will be created with the main task.
            </p>
          </div>

          {/* Attachments Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <Label className="font-medium">
                Attachments{" "}
                {draftAttachments.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    ({draftAttachments.length})
                  </span>
                )}
              </Label>
            </div>

            {draftAttachments.length > 0 && (
              <div className="space-y-2">
                {draftAttachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded border border-border/60 px-3 py-2"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeDraftAttachment(index)}
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Input
                id="task-attachments"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addDraftAttachments(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("task-attachments")?.click()}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add files
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Files will be uploaded when the task is created.
            </p>
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
              disabled={
                validationErrors.length > 0 ||
                !title.trim() ||
                createTask.isPending ||
                (status === "approval_required" && approverIds.length === 0)
              }
            >
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
