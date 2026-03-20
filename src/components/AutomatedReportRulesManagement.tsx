import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Calendar, X, ChevronDown } from "lucide-react";
import { useAutomatedReportRules, useCreateAutomatedReportRule, useUpdateAutomatedReportRule, useDeleteAutomatedReportRule, useAutomatedReportLog, useSendTestAutomatedReport, type AutomatedReportRule } from "@/hooks/useAutomatedReportRules";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserEmails } from "@/hooks/useUserEmails";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
const REPORT_TYPES = [{
  value: 'rooming_list',
  label: 'Rooming List'
}, {
  value: 'booking_changes',
  label: 'Booking Changes Report'
}, {
  value: 'passenger_list',
  label: 'Passenger List'
}, {
  value: 'activity_matrix',
  label: 'Activity Allocation Matrix'
}, {
  value: 'bedding_review',
  label: 'Bedding Type Review'
}];
const SCHEDULE_TYPES = [{
  value: 'weekly',
  label: 'Weekly'
}, {
  value: 'monthly',
  label: 'Monthly'
}, {
  value: 'days_before_tour',
  label: 'Days Before Tour'
}];
const WEEKDAYS = [{
  value: 0,
  label: 'Sunday'
}, {
  value: 1,
  label: 'Monday'
}, {
  value: 2,
  label: 'Tuesday'
}, {
  value: 3,
  label: 'Wednesday'
}, {
  value: 4,
  label: 'Thursday'
}, {
  value: 5,
  label: 'Friday'
}, {
  value: 6,
  label: 'Saturday'
}];
export const AutomatedReportRulesManagement = () => {
  const { toast } = useToast();
  const {
    data: rules,
    isLoading
  } = useAutomatedReportRules();
  const {
    data: logs
  } = useAutomatedReportLog();
  const createRule = useCreateAutomatedReportRule();
  const updateRule = useUpdateAutomatedReportRule();
  const deleteRule = useDeleteAutomatedReportRule();
  const sendTest = useSendTestAutomatedReport();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomatedReportRule | null>(null);
  const [formData, setFormData] = useState<Partial<AutomatedReportRule>>({
    rule_name: '',
    schedule_type: 'weekly',
    schedule_value: 1,
    report_types: [],
    recipient_emails: [],
    tour_ids: null,
    is_active: true
  });
  const [emailInput, setEmailInput] = useState('');

  // Fetch upcoming tours for selection
  const { data: upcomingTours } = useQuery({
    queryKey: ['upcoming-tours-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, name, start_date')
        .gte('start_date', new Date().toISOString())
        .neq('status', 'archived')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  
  const handleSendTest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Could not determine your email address.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.report_types?.length) {
      toast({
        title: "Validation Error",
        description: "Please select at least one report to test.",
        variant: "destructive",
      });
      return;
    }
    
    await sendTest.mutateAsync({
      report_types: formData.report_types,
      recipient_email: user.email,
      schedule_type: formData.schedule_type || 'weekly',
      schedule_value: formData.schedule_value || 1,
    });
  };
  
  const handleSubmit = async () => {
    if (!formData.rule_name) {
      toast({
        title: "Validation Error",
        description: "Please enter a rule name.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.report_types?.length) {
      toast({
        title: "Validation Error",
        description: "Please select at least one report to include.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.recipient_emails?.length) {
      toast({
        title: "Validation Error",
        description: "Please add at least one recipient email address.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingRule) {
      await updateRule.mutateAsync({
        id: editingRule.id,
        ...formData
      });
    } else {
      await createRule.mutateAsync(formData as Omit<AutomatedReportRule, 'id' | 'created_at' | 'created_by' | 'updated_at'>);
    }
    setDialogOpen(false);
    resetForm();
  };
  const resetForm = () => {
    setFormData({
      rule_name: '',
      schedule_type: 'weekly',
      schedule_value: 1,
      report_types: [],
      recipient_emails: [],
      tour_ids: null,
      is_active: true
    });
    setEditingRule(null);
    setEmailInput('');
  };

  const toggleTour = (tourId: string) => {
    const currentTourIds = formData.tour_ids || [];
    if (currentTourIds.includes(tourId)) {
      const newTourIds = currentTourIds.filter(id => id !== tourId);
      setFormData({
        ...formData,
        tour_ids: newTourIds.length > 0 ? newTourIds : null
      });
    } else {
      setFormData({
        ...formData,
        tour_ids: [...currentTourIds, tourId]
      });
    }
  };

  const clearTourSelection = () => {
    setFormData({
      ...formData,
      tour_ids: null
    });
  };
  const handleEdit = (rule: AutomatedReportRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setDialogOpen(true);
  };
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this automated report rule?')) {
      await deleteRule.mutateAsync(id);
    }
  };
  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      setFormData({
        ...formData,
        recipient_emails: [...(formData.recipient_emails || []), emailInput]
      });
      setEmailInput('');
    }
  };
  const removeEmail = (email: string) => {
    setFormData({
      ...formData,
      recipient_emails: formData.recipient_emails?.filter(e => e !== email) || []
    });
  };
  const toggleReportType = (reportType: string) => {
    const currentTypes = formData.report_types || [];
    if (currentTypes.includes(reportType)) {
      setFormData({
        ...formData,
        report_types: currentTypes.filter(t => t !== reportType)
      });
    } else {
      setFormData({
        ...formData,
        report_types: [...currentTypes, reportType]
      });
    }
  };
  const getScheduleDescription = (rule: AutomatedReportRule) => {
    if (rule.schedule_type === 'weekly') {
      const day = WEEKDAYS.find(d => d.value === rule.schedule_value);
      return `Every ${day?.label}`;
    } else if (rule.schedule_type === 'monthly') {
      return `Day ${rule.schedule_value} of each month`;
    } else {
      return `${rule.schedule_value} days before tour`;
    }
  };
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Automated Report Distribution</h3>
          <p className="text-sm text-muted-foreground">Configure automated reports to be sent on a schedule - weekly, monthly, or days before tours.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit' : 'Create'} Automated Report Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input value={formData.rule_name} onChange={e => setFormData({
                ...formData,
                rule_name: e.target.value
              })} placeholder="e.g., Weekly Operations Report" />
              </div>

              <div className="space-y-2">
                <Label>Schedule Type</Label>
                <Select value={formData.schedule_type} onValueChange={(value: any) => setFormData({
                ...formData,
                schedule_type: value,
                schedule_value: 1
              })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {formData.schedule_type === 'weekly' ? 'Day of Week' : formData.schedule_type === 'monthly' ? 'Day of Month' : 'Days Before Tour'}
                </Label>
                {formData.schedule_type === 'weekly' ? <Select value={formData.schedule_value?.toString()} onValueChange={value => setFormData({
                ...formData,
                schedule_value: parseInt(value)
              })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map(day => <SelectItem key={day.value} value={day.value.toString()}>{day.label}</SelectItem>)}
                    </SelectContent>
                  </Select> : <Input type="number" min={1} max={formData.schedule_type === 'monthly' ? 31 : 365} value={formData.schedule_value} onChange={e => setFormData({
                ...formData,
                schedule_value: parseInt(e.target.value) || 1
              })} />}
              </div>

              <div className="space-y-2">
                <Label>Reports to Include</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map(type => <div key={type.value} className="flex items-center space-x-2">
                      <Switch checked={formData.report_types?.includes(type.value)} onCheckedChange={() => toggleReportType(type.value)} />
                      <Label className="cursor-pointer" onClick={() => toggleReportType(type.value)}>
                        {type.label}
                      </Label>
                    </div>)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Specific Tours (Optional)</Label>
                  {formData.tour_ids && formData.tour_ids.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearTourSelection} className="h-6 text-xs">
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to send for all upcoming tours, or select specific tours.
                </p>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {upcomingTours?.map(tour => (
                    <div key={tour.id} className="flex items-center space-x-2">
                      <Switch 
                        checked={formData.tour_ids?.includes(tour.id) || false} 
                        onCheckedChange={() => toggleTour(tour.id)} 
                      />
                      <Label className="cursor-pointer text-sm" onClick={() => toggleTour(tour.id)}>
                        {tour.name} ({format(new Date(tour.start_date), 'dd MMM yyyy')})
                      </Label>
                    </div>
                  ))}
                </div>
                {formData.tour_ids && formData.tour_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.tour_ids.map(tourId => {
                      const tour = upcomingTours?.find(t => t.id === tourId);
                      return tour ? (
                        <Badge key={tourId} variant="secondary" className="gap-1">
                          {tour.name}
                          <button onClick={() => toggleTour(tourId)} className="ml-1 hover:text-destructive">×</button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Recipients</Label>
                <div className="flex gap-2">
                  <Input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addEmail())} placeholder="email@example.com" />
                  <Button type="button" onClick={addEmail}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.recipient_emails?.map(email => <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button onClick={() => removeEmail(email)} className="ml-1 hover:text-destructive">×</button>
                    </Badge>)}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch checked={formData.is_active} onCheckedChange={checked => setFormData({
                ...formData,
                is_active: checked
              })} />
                <Label>Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button 
                  variant="secondary" 
                  onClick={handleSendTest}
                  disabled={sendTest.isPending}
                >
                  {sendTest.isPending ? 'Sending...' : 'Send Test'}
                </Button>
                <Button onClick={handleSubmit}>
                  {editingRule ? 'Update' : 'Create'} Rule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Active Rules</TabsTrigger>
          <TabsTrigger value="history">Send History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {isLoading ? <div>Loading...</div> : !rules?.length ? <div className="text-center py-8 text-muted-foreground">
              No automated report rules configured yet
            </div> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Tours</TableHead>
                  <TableHead>Reports</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {getScheduleDescription(rule)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.tour_ids && rule.tour_ids.length > 0 ? "secondary" : "outline"}>
                        {rule.tour_ids && rule.tour_ids.length > 0 
                          ? `${rule.tour_ids.length} tour${rule.tour_ids.length > 1 ? 's' : ''}` 
                          : 'All tours'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.report_types.length} reports</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.recipient_emails.length} recipients</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {!logs?.length ? <div className="text-center py-8 text-muted-foreground">
              No reports sent yet
            </div> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Tour</TableHead>
                  <TableHead>Reports Sent</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => <TableRow key={log.id}>
                    <TableCell>{log.automated_report_rules?.rule_name}</TableCell>
                    <TableCell>{log.tour_id || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.report_types?.length || 0} reports</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.recipient_emails?.length || 0} recipients</Badge>
                    </TableCell>
                    <TableCell>{log.sent_at ? format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>}
        </TabsContent>
      </Tabs>
    </div>;
};