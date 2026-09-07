import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  fieldsForForm,
  resolveStandardFields,
  type StandardFieldKey,
  type StandardFieldSetting,
} from "@/lib/marketing/standardFields";

interface StandardFieldsEditorProps {
  /** The form being edited (needs form_type + field_config). */
  page: Record<string, any>;
  onChange: (fieldConfig: Record<string, StandardFieldSetting>) => void;
}

/**
 * On/off, required and wording controls for the built-in questions on a public
 * form, so staff can reshape the form without code changes.
 */
export function StandardFieldsEditor({ page, onChange }: StandardFieldsEditorProps) {
  const settings = resolveStandardFields(page as any);
  const defs = fieldsForForm(page.form_type);
  const groups = Array.from(new Set(defs.map((d) => d.group)));

  const update = (key: StandardFieldKey, patch: Partial<StandardFieldSetting>) => {
    const next: Record<string, StandardFieldSetting> = {};
    for (const d of defs) next[d.key] = { ...settings[d.key] };
    next[key] = { ...next[key], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div>
        <Label className="text-sm font-semibold">Questions on this form</Label>
        <p className="text-xs text-muted-foreground">
          Switch questions on or off, mark them compulsory and change the wording people see.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          <div className="space-y-2">
            {defs
              .filter((d) => d.group === group)
              .map((d) => {
                const s = settings[d.key];
                return (
                  <div
                    key={d.key}
                    className="grid items-center gap-2 sm:grid-cols-[1.6fr_auto_auto] rounded-md bg-muted/40 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.enabled}
                        disabled={d.locked}
                        aria-label={`Show ${d.label}`}
                        onCheckedChange={(enabled) => update(d.key, { enabled })}
                      />
                      <Input
                        className="h-8"
                        value={s.label ?? d.label}
                        disabled={!s.enabled}
                        onChange={(e) => update(d.key, { label: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {d.locked ? (
                        <Badge variant="outline">Always asked</Badge>
                      ) : d.requirable ? (
                        <label className="flex items-center gap-1.5">
                          <Switch
                            checked={s.required}
                            disabled={!s.enabled}
                            onCheckedChange={(required) => update(d.key, { required })}
                          />
                          Required
                        </label>
                      ) : (
                        <span className="text-muted-foreground">Optional</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
