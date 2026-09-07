import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Mail, Plus, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import {
  useCreateMailbox,
  useMailboxAccess,
  useMailboxSyncRuns,
  useMailboxes,
  useRunMailSync,
  useSetMailboxAccess,
  useUpdateMailbox,
  type Mailbox,
} from "@/hooks/useCrmEmails";

const statusBadge = (m: Mailbox) => {
  if (!m.is_enabled) return <Badge variant="outline">Not connected</Badge>;
  if (m.last_sync_status === "error")
    return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Error</Badge>;
  if (m.last_sync_status === "running")
    return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Syncing</Badge>;
  if (m.last_sync_status === "ok")
    return <Badge className="bg-green-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</Badge>;
  return <Badge variant="secondary">Waiting for first sync</Badge>;
};

/** Admin view: connected mailboxes, sync health, history import and access. */
export function MailboxIntegrationSettings() {
  const { data: mailboxes = [], isLoading } = useMailboxes();
  const { data: runs = [] } = useMailboxSyncRuns();
  const { data: staff = [] } = useAssignableUsers();
  const update = useUpdateMailbox();
  const create = useCreateMailbox();
  const runSync = useRunMailSync();
  const setAccess = useSetMailboxAccess();

  const [addOpen, setAddOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"shared" | "individual">("shared");
  const [accessFor, setAccessFor] = useState<Mailbox | null>(null);
  const { data: access = [] } = useMailboxAccess(accessFor?.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Microsoft 365 mailboxes
            </CardTitle>
            <CardDescription>
              Correspondence from these mailboxes appears on contacts and enquiries. Central business mailboxes
              are readable by all staff; a personal mailbox is only readable by its owner, the people named on
              it, and Admins and Managers.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={runSync.isPending}
              onClick={() => runSync.mutate({ mode: "manual" })}
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${runSync.isPending ? "animate-spin" : ""}`} /> Sync all now
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add mailbox
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading mailboxes…</p>}
          {mailboxes.map((m) => (
            <div key={m.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.display_name || m.address}</span>
                <span className="text-xs text-muted-foreground">{m.address}</span>
                <Badge variant="secondary" className="capitalize">{m.kind === "shared" ? "Business mailbox" : "Personal mailbox"}</Badge>
                {statusBadge(m)}
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">On</Label>
                    <Switch
                      checked={m.is_enabled}
                      onCheckedChange={(v) =>
                        update.mutate({ id: m.id, is_enabled: v, connected_at: v ? new Date().toISOString() : null } as any)
                      }
                    />
                  </div>
                  {m.kind === "individual" && (
                    <Button variant="outline" size="sm" onClick={() => setAccessFor(m)}>
                      <Users className="mr-1 h-3.5 w-3.5" /> Who can read
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-end gap-3 text-xs text-muted-foreground">
                <span>
                  Last successful sync:{" "}
                  {m.last_success_at ? format(new Date(m.last_success_at), "dd/MM/yyyy HH:mm") : "never"}
                </span>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">History (months)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    className="h-8 w-20"
                    value={m.history_months}
                    onChange={(e) => update.mutate({ id: m.id, history_months: Number(e.target.value) })}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!m.is_enabled || runSync.isPending}
                  onClick={() => runSync.mutate({ mailboxId: m.id, mode: "manual" })}
                >
                  Sync now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!m.is_enabled || runSync.isPending}
                  onClick={() => runSync.mutate({ mailboxId: m.id, mode: "historical", months: m.history_months })}
                >
                  Import history
                </Button>
              </div>

              {m.last_error && (
                <p className="mt-2 text-xs text-destructive">{m.last_error}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent syncs</CardTitle>
          <CardDescription>Anything that fails stays visible here until it succeeds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No syncs have run yet.</p>}
          {runs.map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm">
              <span className="font-medium">{r.mailbox?.display_name || r.mailbox?.address || "All mailboxes"}</span>
              <Badge variant="secondary" className="capitalize">{r.run_type}</Badge>
              <Badge variant={r.status === "error" ? "destructive" : r.status === "ok" ? "default" : "secondary"}>
                {r.status === "ok" ? "Completed" : r.status === "error" ? "Failed" : "Running"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(r.started_at), "dd/MM/yyyy HH:mm")} · {r.messages_scanned} scanned ·{" "}
                {r.messages_stored} new · {r.messages_matched} matched to contacts · {r.messages_unmatched} unmatched
                {r.errors ? ` · ${r.errors} errors` : ""}
              </span>
              {r.error_message && <span className="w-full text-xs text-destructive">{r.error_message}</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a mailbox</DialogTitle>
            <DialogDescription>
              It stays switched off until you turn it on, and Microsoft must have approved access for it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email address</Label>
              <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="name@australianracingtours.com.au" />
            </div>
            <div>
              <Label>Name shown in ART Admin</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Bookings" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newKind} onValueChange={(v: any) => setNewKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Business mailbox (all staff can read)</SelectItem>
                  <SelectItem value="individual">Personal mailbox (restricted)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!newAddress.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({
                  address: newAddress.trim().toLowerCase(),
                  display_name: newName.trim() || undefined,
                  kind: newKind,
                });
                setNewAddress("");
                setNewName("");
                setAddOpen(false);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessFor} onOpenChange={(v) => !v && setAccessFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who can read {accessFor?.display_name || accessFor?.address}</DialogTitle>
            <DialogDescription>
              Admins and Managers always can. Add anyone else who needs this person's client correspondence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {staff.map((u) => {
              const granted = access.some((a: any) => a.user_id === u.id);
              return (
                <div key={u.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                  <span>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</span>
                  <Switch
                    className="ml-auto"
                    checked={granted}
                    onCheckedChange={(v) =>
                      accessFor && setAccess.mutate({ mailboxId: accessFor.id, userId: u.id, grant: v })
                    }
                  />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
