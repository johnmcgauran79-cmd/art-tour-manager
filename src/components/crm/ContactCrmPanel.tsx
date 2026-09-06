import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Heart, Plus, Trash2, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useTours } from "@/hooks/useTours";
import { LeadDialog } from "@/components/crm/LeadDialog";
import {
  useAddTourInterest,
  useContactRelationships,
  useCrmConfig,
  useCustomerLeads,
  useRemoveRelationship,
  useRemoveTourInterest,
  useTourInterests,
  type Lead,
} from "@/hooks/useCrm";
import { INTEREST_LEVELS, RELATIONSHIP_TYPES, labelFor, priorityBadgeClass } from "@/lib/crm/constants";

interface Props {
  customerId: string;
}

/** Enquiries, tour interests and family/friend links for one contact. */
export function ContactCrmPanel({ customerId }: Props) {
  const { data: leads = [] } = useCustomerLeads(customerId);
  const { data: config } = useCrmConfig();
  const { data: interests = [] } = useTourInterests({ customerId });
  const { data: relationships = [] } = useContactRelationships(customerId);
  const { data: tours = [] } = useTours();
  const addInterest = useAddTourInterest();
  const removeInterest = useRemoveTourInterest();
  const removeRelationship = useRemoveRelationship();

  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [tourToAdd, setTourToAdd] = useState("");
  const [levelToAdd, setLevelToAdd] = useState("interested");

  const stageOf = (lead: Lead) => config?.stages.find((s) => s.key === lead.stage);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-base">Enquiries</CardTitle>
            <CardDescription>
              One record per thing they're asking about, with its own stage and owner.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setNewLeadOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New enquiry
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {leads.map((l) => {
            const stage = stageOf(l);
            return (
              <Link
                key={l.id}
                to={`/leads/${l.id}`}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{l.tour?.name || "General enquiry"}</span>
                {stage && (
                  <Badge style={{ backgroundColor: stage.color, color: "#fff" }}>{stage.label}</Badge>
                )}
                <Badge className={priorityBadgeClass(l.priority)}>{l.priority}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {l.next_action_date
                    ? `Next: ${formatDateToDDMMYYYY(l.next_action_date)}`
                    : formatDateToDDMMYYYY(l.created_at)}
                </span>
              </Link>
            );
          })}
          {leads.length === 0 && (
            <p className="text-sm text-muted-foreground">No enquiries recorded for this contact.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4" /> Tour interests
          </CardTitle>
          <CardDescription>Which tours they've told us they'd like to do.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={tourToAdd} onValueChange={setTourToAdd}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choose a tour" /></SelectTrigger>
              <SelectContent>
                {tours.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelToAdd} onValueChange={setLevelToAdd}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTEREST_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!tourToAdd || addInterest.isPending}
              onClick={async () => {
                await addInterest.mutateAsync({
                  customer_id: customerId,
                  tour_id: tourToAdd,
                  interest_level: levelToAdd,
                  source: "staff",
                });
                setTourToAdd("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add interest
            </Button>
          </div>

          <div className="space-y-2">
            {interests.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                <span className="truncate font-medium">{i.tour?.name}</span>
                <Badge variant="outline">{labelFor(INTEREST_LEVELS, i.interest_level)}</Badge>
                <Badge variant="secondary" className="capitalize">{i.status}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(i.created_at), "dd/MM/yyyy")}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeInterest.mutate(i.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {interests.length === 0 && (
              <p className="text-sm text-muted-foreground">No tour interests recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="h-4 w-4" /> Travels with
          </CardTitle>
          <CardDescription>Partners, family and friends linked to this person.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {relationships.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
              <Link to={`/contacts/${r.related_customer_id}`} className="font-medium hover:underline">
                {r.related?.first_name} {r.related?.last_name}
              </Link>
              <Badge variant="outline">{labelFor(RELATIONSHIP_TYPES, r.relationship_type)}</Badge>
              {r.notes && <span className="truncate text-muted-foreground">{r.notes}</span>}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => removeRelationship.mutate(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {relationships.length === 0 && (
            <p className="text-sm text-muted-foreground">Nobody linked yet.</p>
          )}
        </CardContent>
      </Card>

      <LeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} customerId={customerId} />
    </div>
  );
}
