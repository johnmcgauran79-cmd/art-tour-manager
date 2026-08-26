import { Fragment } from "react";
import { Plus, Trash2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AU_STATES, LEAD_STAGES } from "@/lib/edm/audience";
import {
  FIELD_META,
  OPERATOR_LABELS,
  defaultRule,
  emptyGroup,
  type AudienceGroup,
  type AudienceNode,
  type AudienceRule,
  type RuleField,
  type RuleOperator,
} from "@/lib/edm/audienceRules";

export interface RuleBuilderOptions {
  tags: { id: string; name: string }[];
  tours: { id: string; name: string }[];
  leadSources: string[];
}

interface Props {
  value: AudienceGroup;
  onChange: (next: AudienceGroup) => void;
  options: RuleBuilderOptions;
}

const replaceNode = (node: AudienceNode, id: string, next: AudienceNode | null): AudienceNode | null => {
  if (node.id === id) return next;
  if (node.kind === "group") {
    return {
      ...node,
      children: node.children
        .map((c) => replaceNode(c, id, next))
        .filter((c): c is AudienceNode => c !== null),
    };
  }
  return node;
};

const MultiSelect = ({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className="h-9 min-w-[10rem] justify-start font-normal">
        {selected.length
          ? options
              .filter((o) => selected.includes(o.value))
              .map((o) => o.label)
              .join(", ")
              .slice(0, 40)
          : `Select ${label.toLowerCase()}…`}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto">
      <div className="space-y-2">
        {options.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing to choose yet.</p>
        )}
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(o.value)}
              onCheckedChange={() => onToggle(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

const RuleRow = ({
  rule,
  options,
  onChange,
  onRemove,
}: {
  rule: AudienceRule;
  options: RuleBuilderOptions;
  onChange: (next: AudienceRule) => void;
  onRemove: () => void;
}) => {
  const meta = FIELD_META[rule.field];
  const listValue = Array.isArray(rule.value) ? rule.value.map(String) : [];

  const toggle = (v: string) =>
    onChange({
      ...rule,
      value: listValue.includes(v) ? listValue.filter((x) => x !== v) : [...listValue, v],
    });

  const valueControl = () => {
    if (["never", "is_true", "is_false"].includes(rule.operator)) return null;

    if (rule.operator === "in") {
      if (rule.field === "state")
        return (
          <MultiSelect
            label="states"
            options={AU_STATES.map((s) => ({
              value: s,
              label:
                options.stateCounts?.[s] !== undefined
                  ? `${s} (${options.stateCounts[s]})`
                  : s,
            }))}
            selected={listValue}
            onToggle={toggle}
          />
        );

      if (rule.field === "lead_stage")
        return (
          <MultiSelect
            label="stages"
            options={LEAD_STAGES}
            selected={listValue}
            onToggle={toggle}
          />
        );
      if (rule.field === "tag")
        return (
          <MultiSelect
            label="tags"
            options={options.tags.map((t) => ({ value: t.id, label: t.name }))}
            selected={listValue}
            onToggle={toggle}
          />
        );
      if (rule.field === "lead_source")
        return (
          <MultiSelect
            label="sources"
            options={options.leadSources.map((s) => ({ value: s, label: s }))}
            selected={listValue}
            onToggle={toggle}
          />
        );
    }

    if (rule.field === "interested_tour")
      return (
        <Select value={String(rule.value || "")} onValueChange={(v) => onChange({ ...rule, value: v })}>
          <SelectTrigger className="h-9 min-w-[12rem]">
            <SelectValue placeholder="Select a tour" />
          </SelectTrigger>
          <SelectContent>
            {options.tours.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    if (rule.operator === "before" || rule.operator === "after")
      return (
        <Input
          type="date"
          className="h-9 w-40"
          value={String(rule.value || "")}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        />
      );

    if (rule.operator === "within_days" || rule.operator === "not_within_days")
      return (
        <Input
          type="number"
          min={1}
          className="h-9 w-28"
          placeholder="days"
          value={rule.value === undefined || rule.value === null ? "" : String(rule.value)}
          onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
        />
      );

    return (
      <Input
        className="h-9 w-44"
        placeholder="value"
        value={String(rule.value ?? "")}
        onChange={(e) => onChange({ ...rule, value: e.target.value })}
      />
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox
          checked={!!rule.negate}
          onCheckedChange={(v) => onChange({ ...rule, negate: !!v })}
        />
        NOT
      </label>

      <Select
        value={rule.field}
        onValueChange={(field) => {
          const f = field as RuleField;
          onChange({
            ...rule,
            field: f,
            operator: FIELD_META[f].operators[0],
            value: FIELD_META[f].operators[0] === "in" ? [] : "",
          });
        }}
      >
        <SelectTrigger className="h-9 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FIELD_META).map(([key, m]) => (
            <SelectItem key={key} value={key}>
              {m.group} · {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={rule.operator}
        onValueChange={(operator) =>
          onChange({
            ...rule,
            operator: operator as RuleOperator,
            value: operator === "in" ? [] : "",
          })
        }
      >
        <SelectTrigger className="h-9 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {meta.operators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {valueControl()}

      <Button
        variant="ghost"
        size="icon"
        className="ml-auto text-destructive"
        aria-label="Remove rule"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const GroupBlock = ({
  group,
  options,
  depth,
  onChange,
  onRemove,
}: {
  group: AudienceGroup;
  options: RuleBuilderOptions;
  depth: number;
  onChange: (next: AudienceGroup) => void;
  onRemove?: () => void;
}) => {
  const update = (child: AudienceNode, next: AudienceNode | null) =>
    onChange({
      ...group,
      children: group.children
        .map((c) => (c.id === child.id ? next : c))
        .filter((c): c is AudienceNode => c !== null),
    });

  return (
    <div className={depth > 0 ? "space-y-2 rounded-md border border-dashed bg-muted/30 p-3" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{depth === 0 ? "Match" : "Group"}</Badge>
        <Select
          value={group.combinator}
          onValueChange={(v) => onChange({ ...group, combinator: v as "and" | "or" })}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">ALL (AND)</SelectItem>
            <SelectItem value="or">ANY (OR)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={!!group.negate}
            onCheckedChange={(v) => onChange({ ...group, negate: !!v })}
          />
          NOT this group
        </label>
        <div className="ml-auto flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onChange({ ...group, children: [...group.children, defaultRule()] })}
          >
            <Plus className="h-3.5 w-3.5" /> Rule
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onChange({
                ...group,
                children: [...group.children, { ...emptyGroup("or"), children: [defaultRule()] }],
              })
            }
          >
            <FolderPlus className="h-3.5 w-3.5" /> Group
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Remove group"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {group.children.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No rules yet — everyone with marketing consent will match.
        </p>
      )}

      <div className="space-y-2">
        {group.children.map((child, i) => (
          <Fragment key={child.id}>
            {i > 0 && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.combinator === "and" ? "and" : "or"}
              </p>
            )}
            {child.kind === "rule" ? (
              <RuleRow
                rule={child}
                options={options}
                onChange={(next) => update(child, next)}
                onRemove={() => update(child, null)}
              />
            ) : (
              <GroupBlock
                group={child}
                options={options}
                depth={depth + 1}
                onChange={(next) => update(child, next)}
                onRemove={() => update(child, null)}
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export function AudienceRuleBuilder({ value, onChange, options }: Props) {
  return (
    <div className="space-y-2">
      <Label>Rules</Label>
      <GroupBlock group={value} options={options} depth={0} onChange={onChange} />
    </div>
  );
}

export { replaceNode };
