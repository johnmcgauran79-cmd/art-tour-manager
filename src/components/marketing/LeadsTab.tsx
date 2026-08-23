import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { ExternalLink, Mail, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeads, useUpdateLead, type LeadRow } from "@/hooks/useMarketing";
import { LEAD_STAGES } from "@/lib/edm/audience";

export function LeadsTab() {
  const { data: leads = [], isLoading } = useLeads();
  const update = useUpdateLead();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return leads;
    return leads.filter((l) =>
      `${l.first_name || ""} ${l.last_name || ""} ${l.email || ""}`.toLowerCase().includes(s)
    );
  }, [leads, search]);

  const byStage = (stage: string) => filtered.filter((l) => l.lead_stage === stage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Every enquiry from your forms lands here, linked to the contact and its task.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="w-64"
        />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {LEAD_STAGES.map((stage) => (
              <Card key={stage.value} className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    {stage.label}
                    <Badge variant="secondary">{byStage(stage.value).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {byStage(stage.value).map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onStageChange={(lead_stage) => update.mutate({ id: lead.id, lead_stage })}
                    />
                  ))}
                  {byStage(stage.value).length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">Empty</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Tour of interest</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Loading leads…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        No leads yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {l.first_name} {l.last_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{l.email}</div>
                        {l.phone && <div className="text-muted-foreground">{l.phone}</div>}
                      </TableCell>
                      <TableCell>{l.state || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={l.lead_stage}
                          onValueChange={(lead_stage) => update.mutate({ id: l.id, lead_stage })}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STAGES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{l.lead_source || "—"}</TableCell>
                      <TableCell className="text-sm">{l.interested_tour?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(l.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/contacts/${l.id}`}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadCard({
  lead,
  onStageChange,
}: {
  lead: LeadRow;
  onStageChange: (stage: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-background p-2.5 text-xs">
      <Link to={`/contacts/${lead.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
        <User className="h-3.5 w-3.5" />
        {lead.first_name} {lead.last_name}
      </Link>
      {lead.email && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Mail className="h-3 w-3" /> <span className="truncate">{lead.email}</span>
        </div>
      )}
      {lead.phone && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3 w-3" /> {lead.phone}
        </div>
      )}
      {lead.interested_tour?.name && (
        <Badge variant="outline" className="max-w-full truncate">
          {lead.interested_tour.name}
        </Badge>
      )}
      <Select value={lead.lead_stage} onValueChange={onStageChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
