import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTaskComments, useCreateTaskComment, useUpdateTaskComment, TaskComment } from "@/hooks/useTaskComments";
import { useTaskCommentAttachments, useUploadCommentAttachments, useDeleteCommentAttachment, TaskCommentAttachment } from "@/hooks/useTaskCommentAttachments";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send, Paperclip, X, Download, CornerDownRight, Reply, Pencil } from "lucide-react";
import { UserMentionInput } from "@/components/UserMentionInput";
import { useAuth } from "@/hooks/useAuth";
import { EntityLinkPicker } from "@/components/entityLinks/EntityLinkPicker";
import { LinkedTextRenderer } from "@/components/entityLinks/LinkedTextRenderer";

interface TaskCommentsSectionProps {
  taskId: string;
}

export const TaskCommentsSection = ({ taskId }: TaskCommentsSectionProps) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMentionedUsers, setReplyMentionedUsers] = useState<string[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editMentionedUsers, setEditMentionedUsers] = useState<string[]>([]);
  const [editPreviousText, setEditPreviousText] = useState("");

  const { data: comments, isLoading } = useTaskComments(taskId);
  const { data: attachments } = useTaskCommentAttachments(taskId);
  const createComment = useCreateTaskComment();
  const updateComment = useUpdateTaskComment();
  const uploadAttachments = useUploadCommentAttachments();
  const deleteAttachment = useDeleteCommentAttachment();

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const top: TaskComment[] = [];
    const map: Record<string, TaskComment[]> = {};
    (comments || []).forEach((c) => {
      if (c.parent_comment_id) {
        if (!map[c.parent_comment_id]) map[c.parent_comment_id] = [];
        map[c.parent_comment_id].push(c);
      } else {
        top.push(c);
      }
    });
    return { topLevelComments: top, repliesByParent: map };
  }, [comments]);

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

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim() && replyFiles.length === 0) return;
    try {
      const created = await createComment.mutateAsync({
        task_id: taskId,
        comment: replyText.trim() || '(attachment)',
        mentioned_users: replyMentionedUsers,
        parent_comment_id: parentId,
      });
      if (replyFiles.length > 0 && created?.id) {
        await uploadAttachments.mutateAsync({ commentId: created.id, taskId, files: replyFiles });
      }
      setReplyText("");
      setReplyMentionedUsers([]);
      setReplyFiles([]);
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText("");
    setReplyMentionedUsers([]);
    setReplyFiles([]);
  };

  const startEdit = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditText(comment.comment);
    setEditPreviousText(comment.comment);
    setEditMentionedUsers([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditPreviousText("");
    setEditMentionedUsers([]);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    try {
      await updateComment.mutateAsync({
        id: commentId,
        task_id: taskId,
        comment: editText.trim(),
        mentioned_users: editMentionedUsers,
        previous_comment: editPreviousText,
      });
      cancelEdit();
    } catch (error) {
      console.error('Error updating comment:', error);
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

  const renderAttachments = (commentId: string) => {
    const items = (attachments || []).filter((a) => a.comment_id === commentId);
    if (items.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {items.map((att) => (
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
    );
  };

  const cleanMentions = (text: string) => text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

  const appendToken = (current: string, setter: (s: string) => void, token: string) => {
    const sep = current && !/\s$/.test(current) ? " " : "";
    setter(`${current}${sep}${token} `);
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
      <div className="space-y-3 max-h-[28rem] overflow-y-auto">
        {topLevelComments.length > 0 ? (
          topLevelComments.map((comment) => {
            const replies = repliesByParent[comment.id] || [];
            const isReplyOpen = replyingTo === comment.id;
            const isEditing = editingId === comment.id;
            const canEdit = !!user && comment.user_id === user.id;
            return (
              <div key={comment.id} className="border-l-2 border-border pl-3 py-2">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {getUserDisplayName(comment)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    {comment.edited_at && (
                      <span className="ml-1 italic">(edited)</span>
                    )}
                  </span>
                </div>
                {isEditing ? (
                  <div className="space-y-2 mt-1">
                    <UserMentionInput
                      value={editText}
                      onChange={setEditText}
                      onMentionedUsersChange={setEditMentionedUsers}
                      placeholder="Edit your comment..."
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={!editText.trim() || updateComment.isPending}
                        size="sm"
                      >
                        {updateComment.isPending ? 'Saving...' : 'Save'}
                      </Button>
                      <Button onClick={cancelEdit} size="sm" variant="ghost">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                      <LinkedTextRenderer text={cleanMentions(comment.comment)} />
                    </p>
                    {renderAttachments(comment.id)}

                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => (isReplyOpen ? cancelReply() : setReplyingTo(comment.id))}
                      >
                        <Reply className="h-3 w-3 mr-1" />
                        {isReplyOpen ? 'Cancel' : 'Reply'}
                      </Button>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(comment)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Replies (expanded inline) */}
                {replies.length > 0 && (
                  <div className="mt-2 ml-4 space-y-2 border-l border-border/60 pl-3">
                    {replies.map((reply) => {
                      const isEditingReply = editingId === reply.id;
                      const canEditReply = !!user && reply.user_id === user.id;
                      return (
                        <div key={reply.id} className="py-1">
                          <div className="flex items-start gap-2">
                            <CornerDownRight className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-medium text-foreground">
                                  {getUserDisplayName(reply)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                  {reply.edited_at && (
                                    <span className="ml-1 italic">(edited)</span>
                                  )}
                                </span>
                              </div>
                              {isEditingReply ? (
                                <div className="space-y-2 mt-1">
                                  <UserMentionInput
                                    value={editText}
                                    onChange={setEditText}
                                    onMentionedUsersChange={setEditMentionedUsers}
                                    placeholder="Edit your reply..."
                                    rows={2}
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button
                                      onClick={() => handleSaveEdit(reply.id)}
                                      disabled={!editText.trim() || updateComment.isPending}
                                      size="sm"
                                    >
                                      {updateComment.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button onClick={cancelEdit} size="sm" variant="ghost">Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                                    <LinkedTextRenderer text={cleanMentions(reply.comment)} />
                                  </p>
                                  {renderAttachments(reply.id)}
                                  {canEditReply && (
                                    <div className="mt-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => startEdit(reply)}
                                      >
                                        <Pencil className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply composer */}
                {isReplyOpen && (
                  <div className="mt-3 ml-4 pl-3 border-l border-border/60 space-y-2">
                    <UserMentionInput
                      value={replyText}
                      onChange={setReplyText}
                      onMentionedUsersChange={setReplyMentionedUsers}
                      placeholder="Write a reply... Use @username to mention users"
                      rows={2}
                    />
                    {replyFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {replyFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{f.name}</span>
                            <button onClick={() => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={(!replyText.trim() && replyFiles.length === 0) || createComment.isPending || uploadAttachments.isPending}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {createComment.isPending || uploadAttachments.isPending ? 'Sending...' : 'Reply'}
                      </Button>
                      <Button onClick={cancelReply} size="sm" variant="ghost">Cancel</Button>
                      <label className="cursor-pointer ml-auto">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setReplyFiles([...replyFiles, ...files]);
                            e.target.value = '';
                          }}
                        />
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1">
                          <Paperclip className="h-3 w-3" /> Attach
                        </span>
                      </label>
                    </div>
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