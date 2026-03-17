import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Clock, Zap, RotateCcw, ArrowRight } from "lucide-react";
import { useAutomatedEmailRules } from "@/hooks/useAutomatedEmailRules";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";

export interface CommsOverride {
  ruleId: string;
  emailTemplateId: string;
}

interface TourCommsSettingsInlineProps {
  overrides: CommsOverride[];
  onChange: (overrides: CommsOverride[]) => void;
}

export const TourCommsSettingsInline = ({ overrides, onChange }: TourCommsSettingsInlineProps) => {
  const { data: rules, isLoading: rulesLoading } = useAutomatedEmailRules();
  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();

  const activeRules = rules?.filter(r => r.is_active) || [];
  const isLoading = rulesLoading || templatesLoading;

  const getOverrideForRule = (ruleId: string) => {
    return overrides.find(o => o.ruleId === ruleId);
  };

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return "No template";
    return templates?.find(t => t.id === templateId)?.name || "Unknown template";
  };

  const getTriggerLabel = (rule: any) => {
    if (rule.trigger_type === 'on_status_change') return 'On status change';
    if (rule.trigger_type === 'days_after_booking') return `${rule.days_before_tour} days after booking`;
    return `${rule.days_before_tour} days before tour`;
  };

  const getTriggerIcon = (rule: any) => {
    if (rule.trigger_type === 'on_status_change') return <Zap className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getRuleTypeBadge = (rule: any) => {
    if (rule.rule_type === 'travel_documents_request') return <Badge variant="secondary">Travel Docs</Badge>;
    return <Badge variant="outline">Booking Email</Badge>;
  };

  const handleTemplateChange = (ruleId: string, templateId: string) => {
    if (templateId === 'default') {
      onChange(overrides.filter(o => o.ruleId !== ruleId));
    } else {
      const existing = overrides.find(o => o.ruleId === ruleId);
      if (existing) {
        onChange(overrides.map(o => o.ruleId === ruleId ? { ...o, emailTemplateId: templateId } : o));
      } else {
        onChange([...overrides, { ruleId, emailTemplateId: templateId }]);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (activeRules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active automated email rules found. Create rules in Settings → Automated Emails first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activeRules.map((rule: any) => {
        const override = getOverrideForRule(rule.id);
        const hasOverride = !!override;
        const defaultTemplateName = getTemplateName(rule.email_template_id);

        return (
          <div
            key={rule.id}
            className={`border rounded-lg p-3 space-y-2 ${hasOverride ? 'border-primary/30 bg-primary/5' : ''}`}
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
                <Badge variant="default" className="text-xs flex-shrink-0">Custom</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-[200px]">
                <Select
                  value={hasOverride ? override.emailTemplateId : 'default'}
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
                  type="button"
                  onClick={() => handleTemplateChange(rule.id, 'default')}
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
  );
};
