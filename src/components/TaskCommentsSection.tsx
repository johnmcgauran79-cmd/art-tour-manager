
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTaskComments, useCreateTaskComment } from "@/hooks/useTaskComments";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send } from "lucide-react";

interface TaskCommentsSectionProps {
  taskId: string;
}

export const TaskCommentsSection = ({ taskId }: TaskCommentsSectionProps) => {
  const [newComment, setNewComment] = useState("");
  const { data: comments, isLoading } = useTaskComments(taskId);
  const createComment = useCreateTaskComment();

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({
        task_id: taskId,
        comment: newComment.trim(),
      });
      setNewComment("");
    } catch (error) {
      console.error('Error adding comment:', error);
    }
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
          comments.map((comment) => (
            <div key={comment.id} className="border-l-2 border-gray-200 pl-3 py-2">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {getUserDisplayName(comment)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-gray-700">{comment.comment}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">No comments yet. Be the first to comment!</p>
        )}
      </div>

      {/* Add Comment */}
      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
        />
        <Button
          onClick={handleSubmitComment}
          disabled={!newComment.trim() || createComment.isPending}
          size="sm"
          className="flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
          {createComment.isPending ? "Adding..." : "Add Comment"}
        </Button>
      </div>
    </div>
  );
};
