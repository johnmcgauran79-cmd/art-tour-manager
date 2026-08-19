import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AtSign, Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AdditionalFromEmail,
  useAdditionalFromEmails,
  useCreateAdditionalFromEmail,
  useDeleteAdditionalFromEmail,
  useUpdateAdditionalFromEmail,
} from "@/hooks/useAdditionalFromEmails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AdditionalFromEmailsCard = () => {
  const { data: emails, isLoading } = useAdditionalFromEmails();
  const createMut = useCreateAdditionalFromEmail();
  const updateMut = useUpdateAdditionalFromEmail();
  const deleteMut = useDeleteAdditionalFromEmail();

  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdditionalFromEmail | null>(null);

  const handleAdd = () => {
    if (!EMAIL_RE.test(newEmail.trim())) return;
    const nextSort = ((emails?.[emails.length - 1]?.sort_order ?? 0) + 10);
    createMut.mutate(
      { email: newEmail, label: newLabel || null, sort_order: nextSort },
      {
        onSuccess: () => {
          setNewEmail("");
          setNewLabel("");
        },
      }
    );
  };

  const startEdit = (row: AdditionalFromEmail) => {
    setEditingId(row.id);
    setEditEmail(row.email);
    setEditLabel(row.label ?? "");
  };

  const saveEdit = (id: string) => {
    if (!EMAIL_RE.test(editEmail.trim())) return;
    updateMut.mutate(
      { id, email: editEmail, label: editLabel },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AtSign className="h-5 w-5" />
          Additional From Email Addresses
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage shared mailbox addresses (e.g. bookings@, info@, admin@) that staff can choose as the
          "From" address when sending emails, reports, rooming lists, and itineraries. These appear
          alongside individual user email addresses.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="new-from-email">Email address</Label>
              <Input
                id="new-from-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-from-label">Label (optional)</Label>
              <Input
                id="new-from-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Admin"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={createMut.isPending || !EMAIL_RE.test(newEmail.trim())}
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !emails || emails.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No additional addresses yet. Add one above.
          </p>
        ) : (
          <div className="space-y-2">
            {emails.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border bg-background px-3 py-2"
                >
                  {isEditing ? (
                    <>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="flex-1 min-w-[220px]"
                      />
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className="w-40"
                      />
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEdit(row.id)}
                          disabled={updateMut.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-[220px]">
                        <div className="font-medium text-sm">{row.email}</div>
                        {row.label && (
                          <div className="text-xs text-muted-foreground">{row.label}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(checked) =>
                            updateMut.mutate({ id: row.id, is_active: checked })
                          }
                          aria-label={`${row.is_active ? "Disable" : "Enable"} ${row.email}`}
                        />
                        <span className="text-xs text-muted-foreground w-14">
                          {row.is_active ? "Active" : "Hidden"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(row)}
                          aria-label={`Edit ${row.email}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(row)}
                          aria-label={`Remove ${row.email}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this from-email address?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{pendingDelete?.email}</span> will no longer appear in
              "From" dropdowns. Existing sent emails are unaffected. You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  deleteMut.mutate(pendingDelete.id, {
                    onSuccess: () => setPendingDelete(null),
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};