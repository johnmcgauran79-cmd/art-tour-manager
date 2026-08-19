
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Lock, Globe } from "lucide-react";
import { useBookingComments, useCreateBookingComment } from "@/hooks/useBookingComments";
import { formatDistanceToNow } from "date-fns";

interface BookingCommentsSectionProps {
  bookingId: string;
}

export const BookingCommentsSection = ({ bookingId }: BookingCommentsSectionProps) => {
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [commentType, setCommentType] = useState("general");

  const { data: comments, isLoading } = useBookingComments(bookingId);
  const createComment = useCreateBookingComment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    createComment.mutate({
      booking_id: bookingId,
      comment: newComment,
      is_internal: isInternal,
      comment_type: commentType,
    }, {
      onSuccess: () => {
        setNewComment("");
        setIsInternal(false);
        setCommentType("general");
      }
    });
  };

  if (isLoading) {
    return <div>Loading comments...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-brand-navy" />
        <h3 className="text-lg font-semibold text-brand-navy">Communication Log</h3>
      </div>

      {/* Add new comment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Comment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment about this booking..."
                rows={3}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_internal"
                    checked={isInternal}
                    onCheckedChange={setIsInternal}
                  />
                  <Label htmlFor="is_internal" className="flex items-center gap-1">
                    {isInternal ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    {isInternal ? "Internal" : "Public"}
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="comment_type">Type:</Label>
                  <Select value={commentType} onValueChange={setCommentType}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="accommodation">Hotel</SelectItem>
                      <SelectItem value="activities">Activities</SelectItem>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={createComment.isPending || !newComment.trim()}
                className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                {createComment.isPending ? 'Adding...' : 'Add Comment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Comments list */}
      <div className="space-y-3">
        {comments?.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No comments yet.</p>
        ) : (
          comments?.map((comment) => (
            <Card key={comment.id} className={comment.is_internal ? "border-orange-200 bg-orange-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">
                        {comment.profiles?.first_name} {comment.profiles?.last_name}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {comment.comment_type}
                      </span>
                      {comment.is_internal && (
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Internal
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{comment.comment}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
