import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, Save, FolderOpen, Type, LayoutGrid, Minus, AlertTriangle, Space, GripVertical, Bold, Italic, ChevronDown, ChevronRight, Filter, Zap, BookOpen } from "lucide-react";
import { MERGE_FIELDS, MERGE_FIELD_CATEGORIES, getConditionOptions } from "@/utils/mergeFields";

// Inline formatting helper: wraps selected text or full value in a tag
function wrapWithTag(
  inputEl: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  tag: 'strong' | 'em'
): string {
  if (!inputEl) return value;
  const start = inputEl.selectionStart ?? 0;
  const end = inputEl.selectionEnd ?? value.length;
  const selected = start !== end ? value.slice(start, end) : value;
  const wrapped = `<${tag}>${selected}</${tag}>`;
  if (start !== end) {
    return value.slice(0, start) + wrapped + value.slice(end);
  }
  return wrapped;
}

// Small formatting toolbar for text inputs
const FormatToolbar = ({ inputRef, value, onChange }: {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
}) => (
  <div className="flex items-center gap-0.5 mb-1">
    <Button
      type="button" variant="ghost" size="sm"
      className="h-5 w-5 p-0"
      title="Bold selection"
      onClick={() => onChange(wrapWithTag(inputRef.current, value, 'strong'))}
    >
      <Bold className="h-3 w-3" />
    </Button>
    <Button
      type="button" variant="ghost" size="sm"
      className="h-5 w-5 p-0"
      title="Italic selection"
      onClick={() => onChange(wrapWithTag(inputRef.current, value, 'em'))}
    >
      <Italic className="h-3 w-3" />
    </Button>
  </div>
);

type RowType = 'free_text' | 'data_grid' | 'divider' | 'highlight' | 'spacer';

interface CardRow {
  id: string;
  type: RowType;
  // free_text
  text?: string;
  // data_grid
  label?: string;
  value?: string;
  // highlight
  highlightText?: string;
  // spacer
  spacerSize?: 'sm' | 'md' | 'lg';
  // conditional display
  condition?: string; // e.g. "#has_passenger_2" or "^has_accommodation"
}

interface SavedCardTemplate {
  name: string;
  headerTitle: string;
  headerEmoji: string;
  accentColor: string;
  rows: CardRow[];
}

const ACCENT_COLORS = [
  { value: 'grey', label: 'Grey (Default)', bg: '#f8f9fa', text: '#1a2332', border: '#e5e7eb', dot: '#9ca3af' },
  { value: 'gold', label: 'Gold Accent', bg: '#232628', text: '#F5C518', border: '#232628', dot: '#F5C518' },
  { value: 'navy', label: 'Navy', bg: '#1a2332', text: '#ffffff', border: '#1a2332', dot: '#1a2332' },
  { value: 'blue', label: 'Blue', bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', dot: '#3b82f6' },
  { value: 'green', label: 'Green', bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', dot: '#22c55e' },
  { value: 'amber', label: 'Amber', bg: '#fffbeb', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
];

const COMMON_EMOJIS = ['📋', '📌', '✈️', '🏨', '👤', '📞', '📧', '💰', '🎫', '📄', '⚡', '🔔', '🗓️', '📍', '🎯', '✅', '⭐', '🚗', '🍽️', '💼'];

const SAVED_CARDS_KEY = 'email_custom_card_templates';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getSavedCards(): SavedCardTemplate[] {
  try {
    const saved = localStorage.getItem(SAVED_CARDS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveCards(cards: SavedCardTemplate[]) {
  localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(cards));
}

// Reusable row with bold/italic formatting buttons and merge field insert
const FormattedTextRow = ({ value, onChange, placeholder, multiline, onInsertField }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
  onInsertField?: (callback: (field: string) => void) => void;
}) => {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Register the insert callback so parent can push a field into this input
  if (onInsertField) {
    onInsertField((field: string) => {
      const el = ref.current;
      if (!el) {
        onChange(value + field);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newVal = value.slice(0, start) + field + value.slice(end);
      onChange(newVal);
      // Restore cursor position after insert
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + field.length;
        el.setSelectionRange(pos, pos);
      });
    });
  }

  return (
    <div>
      <FormatToolbar inputRef={ref} value={value} onChange={onChange} />
      {multiline ? (
        <Textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[60px] text-xs"
          placeholder={placeholder}
        />
      ) : (
        <Input
          ref={ref as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs"
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

// Merge field picker panel (compact version for the card builder)
const MergeFieldPicker = ({ onInsert }: { onInsert: (field: string) => void }) => {
  const [activeTab, setActiveTab] = useState('customer');
  // Exclude conditions from the picker tabs - they're handled separately per-row
  const pickerCategories = ['customer', 'lead_passenger', 'passenger_2', 'passenger_3', 'tour', 'booking', 'hotel', 'activity', 'actions'];

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-0.5 bg-transparent p-0">
          {pickerCategories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-[10px] h-6 px-2 data-[state=active]:bg-primary/10">
              {MERGE_FIELD_CATEGORIES[cat] || cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {pickerCategories.map(category => (
          <TabsContent key={category} value={category} className="mt-1">
            <ScrollArea className="h-[180px] border rounded-md p-1">
              <div className="space-y-0.5">
                {MERGE_FIELDS[category]?.map((field, index) => {
                  if (field.startsWith('---')) {
                    return (
                      <div key={index} className="text-[10px] font-semibold text-muted-foreground px-2 pt-2 pb-0.5 border-b border-border">
                        {field.replace(/---/g, '').trim()}
                      </div>
                    );
                  }
                  return (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start font-mono text-[10px] w-full h-6 px-2"
                      onClick={() => onInsert(field)}
                    >
                      {field}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export interface CustomCardInsertData {
  html: string;
  title: string;
  emoji: string;
  accentColor: string;
}

interface CustomCardBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (data: CustomCardInsertData) => void;
}

const conditionOptions = getConditionOptions();

export const CustomCardBuilderModal = ({ open, onOpenChange, onInsert }: CustomCardBuilderModalProps) => {
  const [headerTitle, setHeaderTitle] = useState('Card Title');
  const [headerEmoji, setHeaderEmoji] = useState('📋');
  const [accentColor, setAccentColor] = useState('grey');
  const [rows, setRows] = useState<CardRow[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCardTemplate[]>(getSavedCards());
  const [showMergeFields, setShowMergeFields] = useState(false);
  // Track which row/field is "active" for merge field insertion
  const activeInsertCallbackRef = useRef<((field: string) => void) | null>(null);

  const accent = ACCENT_COLORS.find(c => c.value === accentColor) || ACCENT_COLORS[0];

  const addRow = (type: RowType) => {
    const newRow: CardRow = { id: generateId(), type };
    if (type === 'free_text') newRow.text = 'Your text here';
    if (type === 'data_grid') { newRow.label = 'Label'; newRow.value = 'Value'; }
    if (type === 'highlight') newRow.highlightText = 'Important information here';
    if (type === 'spacer') newRow.spacerSize = 'md';
    setRows(prev => [...prev, newRow]);
  };

  const updateRow = (id: string, updates: Partial<CardRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const moveRow = (index: number, direction: 'up' | 'down') => {
    const newRows = [...rows];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRows.length) return;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    setRows(newRows);
  };

  const generateHtml = useCallback(() => {
    const labelStyle = 'padding:6px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;';
    const valueStyle = 'padding:6px 0 6px 12px;color:#1a2332;font-size:13px;font-weight:500;vertical-align:top;';

    let innerHtml = '';
    for (const row of rows) {
      let rowHtml = '';
      switch (row.type) {
        case 'free_text':
          rowHtml = `<p style="margin:8px 0;font-size:14px;color:#55575d;line-height:1.6;">${row.text || ''}</p>`;
          break;
        case 'data_grid':
          rowHtml = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="${labelStyle}">${row.label || ''}</td><td style="${valueStyle}">${row.value || ''}</td></tr></table>`;
          break;
        case 'divider':
          rowHtml = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />`;
          break;
        case 'highlight':
          rowHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr><td style="background-color:#fef3c7;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 4px 4px 0;font-size:13px;color:#92400e;font-weight:500;">${row.highlightText || ''}</td></tr></table>`;
          break;
        case 'spacer': {
          const heights = { sm: '8', md: '16', lg: '28' };
          const h = heights[row.spacerSize || 'md'];
          rowHtml = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</td></tr></table>`;
          break;
        }
      }

      // Wrap in condition if set
      if (row.condition) {
        const prefix = row.condition.charAt(0); // # or ^
        const key = row.condition.slice(1);
        rowHtml = `{{${prefix}${key}}}${rowHtml}{{/${key}}}`;
      }

      innerHtml += rowHtml;
    }

    return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border:1px solid ${accent.border};border-radius:8px;overflow:hidden;"><tr><td style="background-color:${accent.bg};padding:12px 16px;border-bottom:1px solid ${accent.border};"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding-right:10px;vertical-align:middle;font-size:16px;">${headerEmoji}</td><td style="vertical-align:middle;"><strong style="font-size:15px;color:${accent.text};letter-spacing:0.5px;">${headerTitle}</strong></td></tr></table></td></tr><tr><td style="padding:16px;">${innerHtml}</td></tr></table>`;
  }, [rows, headerTitle, headerEmoji, accent]);

  const handleInsert = () => {
    onInsert({
      html: generateHtml(),
      title: headerTitle,
      emoji: headerEmoji,
      accentColor,
    });
    onOpenChange(false);
    resetBuilder();
  };

  const resetBuilder = () => {
    setHeaderTitle('Card Title');
    setHeaderEmoji('📋');
    setAccentColor('grey');
    setRows([]);
    setShowSaveInput(false);
    setSaveName('');
    setShowSaved(false);
    setShowMergeFields(false);
  };

  const handleSaveTemplate = () => {
    if (!saveName.trim()) return;
    const template: SavedCardTemplate = { name: saveName.trim(), headerTitle, headerEmoji, accentColor, rows };
    const updated = [...savedCards, template];
    saveCards(updated);
    setSavedCards(updated);
    setShowSaveInput(false);
    setSaveName('');
  };

  const handleLoadTemplate = (template: SavedCardTemplate) => {
    setHeaderTitle(template.headerTitle);
    setHeaderEmoji(template.headerEmoji);
    setAccentColor(template.accentColor);
    setRows(template.rows.map(r => ({ ...r, id: generateId() })));
    setShowSaved(false);
  };

  const handleDeleteSaved = (index: number) => {
    const updated = savedCards.filter((_, i) => i !== index);
    saveCards(updated);
    setSavedCards(updated);
  };

  const handleMergeFieldInsert = (field: string) => {
    if (activeInsertCallbackRef.current) {
      activeInsertCallbackRef.current(field);
    }
  };

  const getConditionLabel = (condition: string) => {
    const opt = conditionOptions.find(o => o.value === condition);
    return opt?.label || condition;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Custom Card Builder
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_1fr] gap-4 flex-1 overflow-hidden">
          {/* Left: Builder */}
          <ScrollArea className="pr-4" style={{ maxHeight: '65vh' }}>
            <div className="space-y-4">
              {/* Saved Templates */}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowSaved(!showSaved)}>
                  <FolderOpen className="h-3 w-3" />
                  Saved Cards ({savedCards.length})
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowSaveInput(!showSaveInput)}>
                  <Save className="h-3 w-3" />
                  Save Current
                </Button>
              </div>

              {showSaveInput && (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  <Input placeholder="Template name..." value={saveName} onChange={(e) => setSaveName(e.target.value)} className="h-7 text-xs" />
                  <Button type="button" size="sm" className="h-7 text-xs" disabled={!saveName.trim()} onClick={handleSaveTemplate}>Save</Button>
                </div>
              )}

              {showSaved && savedCards.length > 0 && (
                <div className="border rounded-md p-2 space-y-1 bg-muted/20">
                  {savedCards.map((card, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <button type="button" className="text-xs font-medium text-left flex-1" onClick={() => handleLoadTemplate(card)}>
                        {card.headerEmoji} {card.name}
                      </button>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteSaved(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Card Header Config */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Card Header</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Accent Color</Label>
                    <Select value={accentColor} onValueChange={setAccentColor}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCENT_COLORS.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.dot }} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Icon</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COMMON_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`w-8 h-8 rounded text-lg hover:bg-muted flex items-center justify-center ${headerEmoji === emoji ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                        onClick={() => setHeaderEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Merge Fields Panel */}
              <Collapsible open={showMergeFields} onOpenChange={setShowMergeFields}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full justify-between text-xs gap-2">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      Available Merge Fields
                    </span>
                    {showMergeFields ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-md p-2 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Click a field below to insert it at the cursor position in the last-focused text input above. Focus a text field first, then click a merge field.
                    </p>
                    <MergeFieldPicker onInsert={handleMergeFieldInsert} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Add Row Buttons */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Card Rows</h4>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow('free_text')}>
                    <Type className="h-3 w-3" /> Free Text
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow('data_grid')}>
                    <LayoutGrid className="h-3 w-3" /> Data Grid
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow('divider')}>
                    <Minus className="h-3 w-3" /> Divider
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow('highlight')}>
                    <AlertTriangle className="h-3 w-3" /> Highlight
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addRow('spacer')}>
                    <Space className="h-3 w-3" /> Spacer
                  </Button>
                </div>
              </div>

              {/* Row List */}
              {rows.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Add rows using the buttons above to build your card content.</p>
              )}

              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={row.id} className="border rounded-md p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="secondary" className="text-[10px]">
                          {row.type === 'free_text' ? 'Free Text' : row.type === 'data_grid' ? 'Data Grid' : row.type === 'divider' ? 'Divider' : row.type === 'highlight' ? 'Highlight' : 'Spacer'}
                        </Badge>
                        {row.condition && (
                          <Badge variant="outline" className="text-[9px] gap-1 bg-amber-50 text-amber-700 border-amber-200">
                            <Filter className="h-2.5 w-2.5" />
                            Conditional
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={index === 0} onClick={() => moveRow(index, 'up')}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={index === rows.length - 1} onClick={() => moveRow(index, 'down')}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeRow(row.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Condition Selector */}
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Show when:
                      </Label>
                      <Select
                        value={row.condition || 'always'}
                        onValueChange={(v) => updateRow(row.id, { condition: v === 'always' ? undefined : v })}
                      >
                        <SelectTrigger className="h-6 text-[10px] flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always" className="text-xs">Always show</SelectItem>
                          {conditionOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {row.type === 'free_text' && (
                      <FormattedTextRow
                        value={row.text || ''}
                        onChange={(val) => updateRow(row.id, { text: val })}
                        multiline
                        placeholder="Enter text, merge fields like {{customer_first_name}}, or action tags like {{travel_docs_button}}"
                        onInsertField={(cb) => {
                          // Store the callback; it will be called when a merge field is clicked
                          const el = document.activeElement;
                          const textareas = document.querySelectorAll(`textarea`);
                          // We register on focus
                          activeInsertCallbackRef.current = cb;
                        }}
                      />
                    )}

                    {row.type === 'data_grid' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Label</Label>
                          <FormattedTextRow
                            value={row.label || ''}
                            onChange={(val) => updateRow(row.id, { label: val })}
                            placeholder="e.g. Check In"
                            onInsertField={(cb) => { activeInsertCallbackRef.current = cb; }}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Value (text or merge field)</Label>
                          <FormattedTextRow
                            value={row.value || ''}
                            onChange={(val) => updateRow(row.id, { value: val })}
                            placeholder="e.g. {{tour_start_date}}"
                            onInsertField={(cb) => { activeInsertCallbackRef.current = cb; }}
                          />
                        </div>
                      </div>
                    )}

                    {row.type === 'highlight' && (
                      <FormattedTextRow
                        value={row.highlightText || ''}
                        onChange={(val) => updateRow(row.id, { highlightText: val })}
                        placeholder="Important notice text..."
                        onInsertField={(cb) => { activeInsertCallbackRef.current = cb; }}
                      />
                    )}

                    {row.type === 'spacer' && (
                      <Select value={row.spacerSize || 'md'} onValueChange={(v) => updateRow(row.id, { spacerSize: v as 'sm' | 'md' | 'lg' })}>
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sm">Small</SelectItem>
                          <SelectItem value="md">Medium</SelectItem>
                          <SelectItem value="lg">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          {/* Right: Live Preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <h4 className="text-sm font-semibold">Live Preview</h4>
            </div>
            <div className="border rounded-lg p-4 bg-white overflow-auto" style={{ maxHeight: '60vh' }}>
              {/* Preview rendering */}
              <div style={{ border: `1px solid ${accent.border}`, borderRadius: '8px', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
                {/* Header */}
                <div style={{ backgroundColor: accent.bg, padding: '12px 16px', borderBottom: `1px solid ${accent.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>{headerEmoji}</span>
                  <strong style={{ fontSize: '15px', color: accent.text, letterSpacing: '0.5px' }}>{headerTitle}</strong>
                </div>
                {/* Body */}
                <div style={{ padding: '16px' }}>
                  {rows.length === 0 && (
                    <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', margin: '16px 0' }}>
                      Add rows to see preview...
                    </p>
                  )}
                  {rows.map((row) => {
                    const conditionBadge = row.condition ? (
                      <div style={{ fontSize: '10px', color: '#92400e', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px', marginBottom: '4px', display: 'inline-block' }}>
                        ⚡ {getConditionLabel(row.condition)}
                      </div>
                    ) : null;

                    switch (row.type) {
                      case 'free_text':
                        return (
                          <div key={row.id}>
                            {conditionBadge}
                            <p style={{ margin: '8px 0', fontSize: '14px', color: '#55575d', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: (row.text || '').replace(/</g, '&lt;').replace(/&lt;(\/?(strong|em|b|i))>/g, '<$1>') }} />
                          </div>
                        );
                      case 'data_grid':
                        return (
                          <div key={row.id}>
                            {conditionBadge}
                            <div style={{ display: 'flex', padding: '6px 0' }}>
                              <span style={{ width: '140px', color: '#6b7280', fontSize: '13px', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (row.label || '').replace(/</g, '&lt;').replace(/&lt;(\/?(strong|em|b|i))>/g, '<$1>') }} />
                              <span style={{ color: '#1a2332', fontSize: '13px', fontWeight: 500, paddingLeft: '12px' }} dangerouslySetInnerHTML={{ __html: (row.value || '').replace(/</g, '&lt;').replace(/&lt;(\/?(strong|em|b|i))>/g, '<$1>') }} />
                            </div>
                          </div>
                        );
                      case 'divider':
                        return (
                          <div key={row.id}>
                            {conditionBadge}
                            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />
                          </div>
                        );
                      case 'highlight':
                        return (
                          <div key={row.id}>
                            {conditionBadge}
                            <div style={{ backgroundColor: '#fef3c7', borderLeft: '3px solid #f59e0b', padding: '10px 14px', borderRadius: '0 4px 4px 0', fontSize: '13px', color: '#92400e', fontWeight: 500, margin: '8px 0' }} dangerouslySetInnerHTML={{ __html: (row.highlightText || '').replace(/</g, '&lt;').replace(/&lt;(\/?(strong|em|b|i))>/g, '<$1>') }} />
                          </div>
                        );
                      case 'spacer': {
                        const heights = { sm: 8, md: 16, lg: 28 };
                        return <div key={row.id} style={{ height: heights[row.spacerSize || 'md'] }} />;
                      }
                      default:
                        return null;
                    }
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { onOpenChange(false); resetBuilder(); }}>
            Cancel
          </Button>
          <Button type="button" onClick={handleInsert} disabled={rows.length === 0}>
            Insert Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
