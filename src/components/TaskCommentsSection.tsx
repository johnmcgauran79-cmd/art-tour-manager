
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTaskComments, useCreateTaskComment } from "@/hooks/useTaskComments";
import { useTaskCommentAttachments, useUploadCommentAttachments, useDeleteCommentAttachment, TaskCommentAttachment } from "@/hooks/useTaskCommentAttachments";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send, Paperclip, X, Download } from "lucide-react";
import { UserMentionInput } from "@/components/UserMentionInput";

interface TaskCommentsSectionProps {
  taskId: string;
}

export const TaskCommentsSection = ({ taskId }: TaskCommentsSectionProps) => {
  const [newComment, setNewComment] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { data: comments, isLoading } = useTaskComments(taskId);
  const { data: attachments } = useTaskCommentAttachments(taskId);
  const createComment = useCreateTaskComment();
  const uploadAttachments = useUploadCommentAttachments();
  const deleteAttachment = useDeleteCommentAttachment();

  const handleSubmitComment = async () => {
    if (!newComment.trim() && pendingFiles.length === 0) return;

    try {
      const created = await createComment.mutateAsync({
        task_id: taskId,
        comment: newComment.trim() || '(attachment)',
        mentioned_users: mentionedUsers,
      });
      if (pendingFiles.length > 0 && created?.id) {
        await uploadAttachments.mutateAsync({ commentId: created.id, taskId, files: pendingFiles });
      }
      setNewComment("");
      setMentionedUsers([]);
      setPendingFiles([]);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDownload = async (att: TaskCommentAttachment) => {
    const { data, error } = await supabase.storage.from('attachments').download(att.file_path);
    if (error) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = att.file_name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getUserDisplayName = (comment: any) => {
    if (comment.profiles) {
      const name = `${comment.profiles.first_name || ''} ${comment.profiles.last_name || ''}`.trim();
      return name || comment.profiles.email;
    }
    return 'Unknown User';
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading comments...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h4 className="font-medium">Comments ({comments?.length || 0})</h4>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments && comments.length > 0 ? (
          comments.map((comment) => {
            const commentAttachments = (attachments || []).filter(a => a.comment_id === comment.id);
            return (
            <div key={comment.id} className="border-l-2 border-border pl-3 py-2">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium text-foreground">
                  {getUserDisplayName(comment)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                {comment.comment.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')}
              </p>
              {commentAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {commentAttachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <button onClick={() => handleDownload(att)} className="flex-1 text-left hover:underline truncate">
                        {att.file_name}
                      </button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleDownload(att)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteAttachment.mutate(att)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to comment!</p>
        )}
      </div>

      {/* Add Comment */}
      <div className="space-y-2">
        <UserMentionInput
          value={newComment}
          onChange={setNewComment}
          onMentionedUsersChange={setMentionedUsers}
          placeholder="Add a comment... Use @username to mention users"
          rows={3}
        />
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                <Paperclip className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{f.name}</span>
                <button onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmitComment}
            disabled={(!newComment.trim() && pendingFiles.length === 0) || createComment.isPending || uploadAttachments.isPending}
            size="sm"
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {createComment.isPending || uploadAttachments.isPending ? "Adding..." : "Add Comment"}
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setPendingFiles([...pendingFiles, ...files]);
                e.target.value = '';
              }}
            />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Attach files
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
