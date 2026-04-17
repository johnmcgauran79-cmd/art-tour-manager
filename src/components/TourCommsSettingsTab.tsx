import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Clock, Zap, RotateCcw, ArrowRight, FileText, AlertTriangle, MailOpen } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAutomatedEmailRules } from "@/hooks/useAutomatedEmailRules";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useTourEmailOverrides, useUpsertTourEmailOverride, useDeleteTourEmailOverride } from "@/hooks/useTourEmailOverrides";
import { useTourTemplateSendSummaries } from "@/hooks/useSentEmailsReport";
import { SentEmailsReportModal } from "@/components/operations/SentEmailsReportModal";

interface TourCommsSettingsTabProps {
  tourId: string;
  tourName: string;
}

export const TourCommsSettingsTab = ({ tourId, tourName }: TourCommsSettingsTabProps) => {
  const { data: rules, isLoading: rulesLoading } = useAutomatedEmailRules();
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { data: overrides, isLoading: overridesLoading } = useTourEmailOverrides(tourId);
  const upsertOverride = useUpsertTourEmailOverride();
  const deleteOverride = useDeleteTourEmailOverride();

  const activeRules = rules?.filter(r => r.is_active) || [];
  const isLoading = rulesLoading || templatesLoading || overridesLoading;

  const getOverrideForRule = (ruleId: string) => {
    return overrides?.find(o => o.rule_id === ruleId);
  };

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return "No template";
    return templates?.find(t => t.id === templateId)?.name || "Unknown template";
  };

  const getTriggerLabel = (rule: any) => {
    if (rule.trigger_type === 'on_status_change') {
      return 'On status change';
    }
    if (rule.trigger_type === 'days_after_booking') {
      return `${rule.days_before_tour} days after booking`;
    }
    return `${rule.days_before_tour} days before tour`;
  };

  const getTriggerIcon = (rule: any) => {
    if (rule.trigger_type === 'on_status_change') return <Zap className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getRuleTypeBadge = (rule: any) => {
    const typeLabels: Record<string, string> = {
      travel_documents_request: 'Travel Docs',
      waiver_request: 'Waiver',
      pickup_request: 'Pickup',
      profile_update_request: 'Profile Update',
      custom_form_request: 'Custom Form',
      payment_reminder: 'Payment',
      tour_update: 'Tour Update',
      welcome_email: 'Welcome',
      dietary_request: 'Dietary',
    };
    const label = typeLabels[rule.rule_type];
    if (label) return <Badge variant="secondary">{label}</Badge>;
    return <Badge variant="outline">Booking Email</Badge>;
  };

  const handleTemplateChange = (ruleId: string, templateId: string) => {
    if (templateId === 'default') {
      deleteOverride.mutate({ tourId, ruleId });
    } else {
      upsertOverride.mutate({ tourId, ruleId, emailTemplateId: templateId });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activeRules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Comms Settings
          </CardTitle>
          <CardDescription>
            No active automated email rules found. Create rules in Settings → Automated Emails first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Comms Settings
          </CardTitle>
          <CardDescription>
            Assign tour-specific email templates to each automated email rule. If no override is set, the global default template from Settings will be used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeRules.map((rule: any) => {
              const override = getOverrideForRule(rule.id);
              const hasOverride = !!override;
              const defaultTemplateName = getTemplateName(rule.email_template_id);

              return (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-4 space-y-3 ${hasOverride ? 'border-primary/30 bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{rule.rule_name}</h4>
                        {getRuleTypeBadge(rule)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {getTriggerIcon(rule)}
                        <span>{getTriggerLabel(rule)}</span>
                        {rule.recipient_filter !== 'all' && (
                          <>
                            <span>·</span>
                            <span className="capitalize">{rule.recipient_filter?.replace('_', ' ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {hasOverride && (
                      <Badge variant="default" className="text-xs flex-shrink-0">
                        Custom
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-[200px]">
                      <Select
                        value={hasOverride ? override.email_template_id : 'default'}
                        onValueChange={(value) => handleTemplateChange(rule.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground">Global default:</span>
                              <span>{defaultTemplateName}</span>
                            </span>
                          </SelectItem>
                          {templates?.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {hasOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteOverride.mutate({ tourId, ruleId: rule.id })}
                        className="flex-shrink-0"
                        title="Reset to global default"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {hasOverride && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      Overrides global default: <span className="italic">{defaultTemplateName}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
