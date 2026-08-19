import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Plus, Save, Edit2, Trash2 } from "lucide-react";
import {
  useActivityExternalLinks,
  useCreateActivityExternalLink,
  useUpdateActivityExternalLink,
  useDeleteActivityExternalLink,
} from "@/hooks/useActivityExternalLinks";

interface ActivityExternalLinksSectionProps {
  activityId: string;
  readOnly?: boolean;
}

export const ActivityExternalLinksSection = ({ activityId, readOnly = false }: ActivityExternalLinksSectionProps) => {
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [editingLink, setEditingLink] = useState<{ id: string; label: string; url: string } | null>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);

  const { data: externalLinks } = useActivityExternalLinks(activityId);
  const createExternalLink = useCreateActivityExternalLink();
  const updateExternalLink = useUpdateActivityExternalLink();
  const deleteExternalLink = useDeleteActivityExternalLink();

  const handleAdd = async () => {
    if (!newLink.label.trim() || !newLink.url.trim()) return;
    try {
      await createExternalLink.mutateAsync({ activityId, label: newLink.label.trim(), url: newLink.url.trim() });
      setNewLink({ label: "", url: "" });
      setIsAddingLink(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async () => {
    if (!editingLink || !editingLink.label.trim() || !editingLink.url.trim()) return;
    try {
      await updateExternalLink.mutateAsync({
        id: editingLink.id,
        activityId,
        label: editingLink.label.trim(),
        url: editingLink.url.trim(),
      });
      setEditingLink(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExternalLink.mutateAsync({ id, activityId });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-foreground">
            External Links ({externalLinks?.length || 0})
          </h4>
        </div>
        {!readOnly && !isAddingLink && (
          <Button
            type="button"
            onClick={() => setIsAddingLink(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Link
          </Button>
        )}
      </div>

      {!readOnly && isAddingLink && (
        <div className="space-y-3 p-3 border rounded bg-background">
          <div className="space-y-2">
            <Label htmlFor={`activity_link_label_${activityId}`}>Link Label</Label>
            <Input
              id={`activity_link_label_${activityId}`}
              value={newLink.label}
              onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
              placeholder="e.g., Venue Booking Portal, Supplier Confirmation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`activity_link_url_${activityId}`}>URL</Label>
            <Input
              id={`activity_link_url_${activityId}`}
              type="url"
              value={newLink.url}
              onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!newLink.label.trim() || !newLink.url.trim() || createExternalLink.isPending}
              size="sm"
            >
              <Save className="h-4 w-4 mr-1" />
              Save Link
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsAddingLink(false);
                setNewLink({ label: "", url: "" });
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {externalLinks && externalLinks.length > 0 ? (
          externalLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between p-3 border rounded bg-background"
            >
              {!readOnly && editingLink?.id === link.id ? (
                <div className="flex-1 space-y-2 mr-3">
                  <Input
                    value={editingLink.label}
                    onChange={(e) => setEditingLink({ ...editingLink, label: e.target.value })}
                    placeholder="Link label"
                  />
                  <Input
                    type="url"
                    value={editingLink.url}
                    onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                    placeholder="URL"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleUpdate}
                      disabled={
                        !editingLink.label.trim() ||
                        !editingLink.url.trim() ||
                        updateExternalLink.isPending
                      }
                      size="sm"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setEditingLink(null)}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{link.label}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all text-sm"
                  >
                    {link.url}
                  </a>
                </div>
              )}

              {!readOnly && editingLink?.id !== link.id && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() =>
                      setEditingLink({ id: link.id, label: link.label, url: link.url })
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleDelete(link.id)}
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={deleteExternalLink.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic">No external links added yet.</p>
        )}
      </div>
    </div>
  );
};
