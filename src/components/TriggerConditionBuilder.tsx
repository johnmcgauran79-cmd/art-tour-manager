import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, X } from "lucide-react";
import { useTours } from "@/hooks/useTours";

// Field definitions with their allowed operators
const CONDITION_FIELDS = [
  { 
    value: 'booking.status', 
    label: 'Booking Status',
    type: 'multi-select',
    operators: ['in', 'not_in'],
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'invoiced', label: 'Invoiced' },
      { value: 'deposited', label: 'Deposited' },
      { value: 'rb_invoiced', label: 'RB Invoiced' },
      { value: 'instalment_paid', label: 'Instalment Paid' },
      { value: 'fully_paid', label: 'Fully Paid' },
      { value: 'host', label: 'Host' },
      { value: 'complimentary', label: 'Complimentary' },
      { value: 'waitlisted', label: 'Waitlisted' },
      { value: 'cancelled', label: 'Cancelled' },
    ]
  },
  { 
    value: 'tour.tour_type', 
    label: 'Tour Type',
    type: 'single-select',
    operators: ['equals', 'not_equals'],
    options: [
      { value: 'domestic', label: 'Domestic' },
      { value: 'international', label: 'International' },
    ]
  },
  { 
    value: 'tour.id', 
    label: 'Specific Tour',
    type: 'tour-select',
    operators: ['in', 'not_in'],
    options: [] // Will be populated from useTours
  },
  { 
    value: 'booking.passenger_count', 
    label: 'Passenger Count',
    type: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than'],
    options: []
  },
];

const OPERATOR_LABELS: Record<string, string> = {
  'equals': 'equals',
  'not_equals': 'does not equal',
  'in': 'is one of',
  'not_in': 'is not one of',
  'greater_than': 'is greater than',
  'less_than': 'is less than',
};

export interface Condition {
  field: string;
  operator: string;
  value?: string;
  values?: string[];
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
  groups?: ConditionGroup[];
}

interface TriggerConditionBuilderProps {
  value: ConditionGroup | null;
  onChange: (conditions: ConditionGroup) => void;
}

export const TriggerConditionBuilder = ({ value, onChange }: TriggerConditionBuilderProps) => {
  const { data: tours } = useTours();
  
  // Initialize with empty group if null
  const conditions = value || { operator: 'AND' as const, conditions: [], groups: [] };

  const addCondition = () => {
    onChange({
      ...conditions,
      conditions: [
        ...conditions.conditions,
        { field: 'booking.status', operator: 'in', values: [] }
      ]
    });
  };

  const addGroup = () => {
    onChange({
      ...conditions,
      groups: [
        ...(conditions.groups || []),
        { operator: 'OR', conditions: [{ field: 'booking.status', operator: 'in', values: [] }], groups: [] }
      ]
    });
  };

  const removeCondition = (index: number) => {
    const newConditions = [...conditions.conditions];
    newConditions.splice(index, 1);
    onChange({ ...conditions, conditions: newConditions });
  };

  const removeGroup = (index: number) => {
    const newGroups = [...(conditions.groups || [])];
    newGroups.splice(index, 1);
    onChange({ ...conditions, groups: newGroups });
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    
    // Reset values when field changes
    if (updates.field) {
      const fieldDef = CONDITION_FIELDS.find(f => f.value === updates.field);
      if (fieldDef) {
        if (fieldDef.type === 'number') {
          newConditions[index] = { 
            ...newConditions[index], 
            operator: fieldDef.operators[0], 
            value: '', 
            values: undefined 
          };
        } else if (fieldDef.type === 'single-select') {
          newConditions[index] = { 
            ...newConditions[index], 
            operator: fieldDef.operators[0], 
            value: '', 
            values: undefined 
          };
        } else {
          newConditions[index] = { 
            ...newConditions[index], 
            operator: fieldDef.operators[0], 
            values: [], 
            value: undefined 
          };
        }
      }
    }
    
    onChange({ ...conditions, conditions: newConditions });
  };

  const updateGroup = (index: number, group: ConditionGroup) => {
    const newGroups = [...(conditions.groups || [])];
    newGroups[index] = group;
    onChange({ ...conditions, groups: newGroups });
  };

  const toggleGroupOperator = (groupIndex: number) => {
    const newGroups = [...(conditions.groups || [])];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      operator: newGroups[groupIndex].operator === 'AND' ? 'OR' : 'AND'
    };
    onChange({ ...conditions, groups: newGroups });
  };

  const addConditionToGroup = (groupIndex: number) => {
    const newGroups = [...(conditions.groups || [])];
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      conditions: [
        ...newGroups[groupIndex].conditions,
        { field: 'booking.status', operator: 'in', values: [] }
      ]
    };
    onChange({ ...conditions, groups: newGroups });
  };

  const removeConditionFromGroup = (groupIndex: number, conditionIndex: number) => {
    const newGroups = [...(conditions.groups || [])];
    const newConditions = [...newGroups[groupIndex].conditions];
    newConditions.splice(conditionIndex, 1);
    newGroups[groupIndex] = { ...newGroups[groupIndex], conditions: newConditions };
    onChange({ ...conditions, groups: newGroups });
  };

  const updateConditionInGroup = (groupIndex: number, conditionIndex: number, updates: Partial<Condition>) => {
    const newGroups = [...(conditions.groups || [])];
    const newConditions = [...newGroups[groupIndex].conditions];
    newConditions[conditionIndex] = { ...newConditions[conditionIndex], ...updates };
    
    // Reset values when field changes
    if (updates.field) {
      const fieldDef = CONDITION_FIELDS.find(f => f.value === updates.field);
      if (fieldDef) {
        if (fieldDef.type === 'number') {
          newConditions[conditionIndex] = { 
            ...newConditions[conditionIndex], 
            operator: fieldDef.operators[0], 
            value: '', 
            values: undefined 
          };
        } else if (fieldDef.type === 'single-select') {
          newConditions[conditionIndex] = { 
            ...newConditions[conditionIndex], 
            operator: fieldDef.operators[0], 
            value: '', 
            values: undefined 
          };
        } else {
          newConditions[conditionIndex] = { 
            ...newConditions[conditionIndex], 
            operator: fieldDef.operators[0], 
            values: [], 
            value: undefined 
          };
        }
      }
    }
    
    newGroups[groupIndex] = { ...newGroups[groupIndex], conditions: newConditions };
    onChange({ ...conditions, groups: newGroups });
  };

  const toggleValue = (conditionIndex: number, val: string, isGroup: boolean = false, groupIndex?: number) => {
    if (isGroup && groupIndex !== undefined) {
      const condition = (conditions.groups || [])[groupIndex].conditions[conditionIndex];
      const currentValues = condition.values || [];
      const newValues = currentValues.includes(val)
        ? currentValues.filter(v => v !== val)
        : [...currentValues, val];
      updateConditionInGroup(groupIndex, conditionIndex, { values: newValues });
    } else {
      const condition = conditions.conditions[conditionIndex];
      const currentValues = condition.values || [];
      const newValues = currentValues.includes(val)
        ? currentValues.filter(v => v !== val)
        : [...currentValues, val];
      updateCondition(conditionIndex, { values: newValues });
    }
  };

  const renderConditionRow = (
    condition: Condition, 
    index: number, 
    isGroup: boolean = false, 
    groupIndex?: number
  ) => {
    const fieldDef = CONDITION_FIELDS.find(f => f.value === condition.field);
    const tourOptions = tours?.map(t => ({ value: t.id, label: t.name })) || [];
    
    const handleUpdate = (updates: Partial<Condition>) => {
      if (isGroup && groupIndex !== undefined) {
        updateConditionInGroup(groupIndex, index, updates);
      } else {
        updateCondition(index, updates);
      }
    };

    const handleRemove = () => {
      if (isGroup && groupIndex !== undefined) {
        removeConditionFromGroup(groupIndex, index);
      } else {
        removeCondition(index);
      }
    };

    return (
      <div key={index} className="flex items-start gap-2 flex-wrap">
        {/* Field selector */}
        <Select
          value={condition.field}
          onValueChange={(val) => handleUpdate({ field: val })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_FIELDS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator selector */}
        <Select
          value={condition.operator}
          onValueChange={(val) => handleUpdate({ operator: val })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldDef?.operators.map(op => (
              <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input - varies by field type */}
        {fieldDef?.type === 'number' && (
          <Input
            type="number"
            value={condition.value || ''}
            onChange={(e) => handleUpdate({ value: e.target.value })}
            className="w-[100px]"
            placeholder="Value"
          />
        )}

        {fieldDef?.type === 'single-select' && (
          <Select
            value={condition.value || ''}
            onValueChange={(val) => handleUpdate({ value: val })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {fieldDef.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {fieldDef?.type === 'multi-select' && (
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[40px] bg-background">
              {(condition.values || []).map(val => {
                const opt = fieldDef.options.find(o => o.value === val);
                return (
                  <Badge 
                    key={val} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleValue(index, val, isGroup, groupIndex)}
                  >
                    {opt?.label || val}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                );
              })}
              <Select
                value=""
                onValueChange={(val) => toggleValue(index, val, isGroup, groupIndex)}
              >
                <SelectTrigger className="w-auto border-0 h-6 px-2 shadow-none focus:ring-0">
                  <span className="text-muted-foreground text-sm">+ Add</span>
                </SelectTrigger>
                <SelectContent>
                  {fieldDef.options
                    .filter(opt => !(condition.values || []).includes(opt.value))
                    .map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {fieldDef?.type === 'tour-select' && (
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[40px] bg-background">
              {(condition.values || []).map(val => {
                const tour = tours?.find(t => t.id === val);
                return (
                  <Badge 
                    key={val} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleValue(index, val, isGroup, groupIndex)}
                  >
                    {tour?.name || val}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                );
              })}
              <Select
                value=""
                onValueChange={(val) => toggleValue(index, val, isGroup, groupIndex)}
              >
                <SelectTrigger className="w-auto border-0 h-6 px-2 shadow-none focus:ring-0">
                  <span className="text-muted-foreground text-sm">+ Add tour</span>
                </SelectTrigger>
                <SelectContent>
                  {tourOptions
                    .filter(opt => !(condition.values || []).includes(opt.value))
                    .map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={handleRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Main operator toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Match</span>
        <Button
          variant={conditions.operator === 'AND' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange({ ...conditions, operator: 'AND' })}
        >
          ALL
        </Button>
        <Button
          variant={conditions.operator === 'OR' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange({ ...conditions, operator: 'OR' })}
        >
          ANY
        </Button>
        <span className="text-sm text-muted-foreground">of the following conditions:</span>
      </div>

      {/* Root level conditions */}
      <div className="space-y-2 pl-4 border-l-2 border-muted">
        {conditions.conditions.map((condition, index) => (
          <div key={index}>
            {index > 0 && (
              <div className="text-xs text-muted-foreground mb-1 -ml-4 pl-2">
                {conditions.operator}
              </div>
            )}
            {renderConditionRow(condition, index)}
          </div>
        ))}
        
        <Button variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-1" />
          Add condition
        </Button>
      </div>

      {/* Nested groups */}
      {(conditions.groups || []).map((group, groupIndex) => (
        <Card key={groupIndex} className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="uppercase text-xs">
                  {conditions.operator}
                </Badge>
                <span className="text-sm text-muted-foreground">Match</span>
                <Button
                  variant={group.operator === 'AND' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => toggleGroupOperator(groupIndex)}
                >
                  {group.operator === 'AND' ? 'ALL' : 'ANY'}
                </Button>
                <span className="text-sm text-muted-foreground">of:</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeGroup(groupIndex)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              {group.conditions.map((condition, condIndex) => (
                <div key={condIndex}>
                  {condIndex > 0 && (
                    <div className="text-xs text-muted-foreground mb-1 -ml-4 pl-2">
                      {group.operator}
                    </div>
                  )}
                  {renderConditionRow(condition, condIndex, true, groupIndex)}
                </div>
              ))}
              
              <Button variant="outline" size="sm" onClick={() => addConditionToGroup(groupIndex)}>
                <Plus className="h-4 w-4 mr-1" />
                Add condition
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addGroup}>
        <Plus className="h-4 w-4 mr-1" />
        Add condition group
      </Button>

      {/* Preview of what conditions match */}
      {(conditions.conditions.length > 0 || (conditions.groups || []).length > 0) && (
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">This rule will trigger when:</p>
          <p className="text-sm font-medium">
            {conditions.operator === 'AND' ? 'ALL' : 'ANY'} of {conditions.conditions.length} condition(s)
            {(conditions.groups || []).length > 0 && ` ${conditions.operator} ${(conditions.groups || []).length} group(s)`} match
          </p>
        </div>
      )}
    </div>
  );
};
