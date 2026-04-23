
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  InlineEntitySuggestions,
  detectHashTrigger,
  type InlineSuggestionItem,
} from "@/components/entityLinks/InlineEntitySuggestions";
import { buildEntityToken } from "@/lib/entityLinks";

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface UserMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionedUsersChange: (userIds: string[]) => void;
  placeholder?: string;
  rows?: number;
}

export const UserMentionInput = ({
  value,
  onChange,
  onMentionedUsersChange,
  placeholder,
  rows = 3
}: UserMentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [displayValue, setDisplayValue] = useState(value);
  const [mentionPositions, setMentionPositions] = useState<Array<{start: number, end: number, userId: string, displayName: string}>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inline `#` entity-link trigger (mirrors LinkableTextarea behaviour)
  const [hashTrigger, setHashTrigger] = useState<{ start: number; query: string } | null>(null);
  const [entityActiveIndex, setEntityActiveIndex] = useState(0);
  const entityItemsRef = useRef<InlineSuggestionItem[]>([]);

  const closeHashTrigger = () => {
    setHashTrigger(null);
    setEntityActiveIndex(0);
    entityItemsRef.current = [];
  };

  // Fetch users for mentions
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-mentions'],
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Convert structured mentions to display format and extract user IDs
  useEffect(() => {
    console.log('Processing value for mentions:', value);
    
    // Convert @[Name](id) format to display format @Name for textarea
    const displayText = value.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
    setDisplayValue(displayText);
    
    // Track mention positions for reconstruction
    const mentions: Array<{start: number, end: number, userId: string, displayName: string}> = [];
    const mentionMatches = [...value.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)];
    
    let offset = 0;
    mentionMatches.forEach(match => {
      if (match.index !== undefined) {
        const displayName = match[1];
        const userId = match[2];
        const structuredLength = match[0].length;
        const displayLength = displayName.length + 1; // +1 for @
        
        mentions.push({
          start: match.index - offset,
          end: match.index - offset + displayLength,
          userId: userId,
          displayName: displayName
        });
        
        offset += structuredLength - displayLength;
      }
    });
    
    setMentionPositions(mentions);
    
    // Extract mentioned user IDs from the structured format
    const mentionedIds = mentionMatches.map(match => match[2]);
    
    console.log('Extracted mentioned user IDs from value:', value);
    console.log('Found mentioned IDs:', mentionedIds);
    
    onMentionedUsersChange(mentionedIds);
  }, [value, onMentionedUsersChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDisplayValue = e.target.value;
    const cursor = e.target.selectionStart;
    
    setDisplayValue(newDisplayValue);
    setCursorPosition(cursor);
    
    // Check for @ mentions at cursor position
    const textBeforeCursor = newDisplayValue.substring(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
    }

    // Check for # entity-link trigger (independent of @ mentions)
    const hash = detectHashTrigger(newDisplayValue, cursor);
    setHashTrigger(hash);
    if (!hash) setEntityActiveIndex(0);
    
    // Reconstruct structured value by finding existing mentions in the new display text
    let newStructuredValue = newDisplayValue;
    
    // Sort mentions by position (reverse order to avoid position shifts)
    const sortedMentions = [...mentionPositions].sort((a, b) => b.start - a.start);
    
    sortedMentions.forEach(mention => {
      const mentionText = `@${mention.displayName}`;
      const mentionStart = newDisplayValue.indexOf(mentionText, Math.max(0, mention.start - 10));
      
      if (mentionStart !== -1) {
        const beforeMention = newStructuredValue.substring(0, mentionStart);
        const afterMention = newStructuredValue.substring(mentionStart + mentionText.length);
        const structuredMention = `@[${mention.displayName}](${mention.userId})`;
        
        newStructuredValue = beforeMention + structuredMention + afterMention;
      }
    });
    
    onChange(newStructuredValue);
  };

  const handleUserMention = (user: User) => {
    const textBeforeCursor = displayValue.substring(0, cursorPosition);
    const textAfterCursor = displayValue.substring(cursorPosition);
    
    // Remove the @ and partial name from display
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown';
    
    // Create the structured mention format for the actual value
    const mentionText = `@[${displayName}](${user.id})`;
    const newValue = beforeMention + mentionText + " " + textAfterCursor;
    
    console.log('Adding mention for user:', user.id, 'Display:', displayName);
    console.log('New structured value:', newValue);
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = beforeMention.length + displayName.length + 2; // +2 for "@" and space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const insertEntityToken = (item: InlineSuggestionItem) => {
    if (!hashTrigger) return;
    const before = displayValue.slice(0, hashTrigger.start);
    const after = displayValue.slice(cursorPosition);
    const token = buildEntityToken(item.type, item.id, item.label);
    const needsTrailingSpace = !after.startsWith(" ");
    const insertion = `${token}${needsTrailingSpace ? " " : ""}`;
    const next = `${before}${insertion}${after}`;
    setDisplayValue(next);
    onChange(next);
    closeHashTrigger();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = (before + insertion).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const filteredUsers = users.filter(user => {
    if (!mentionQuery) return true;
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const searchText = (displayName || user.email || '').toLowerCase();
    return searchText.includes(mentionQuery.toLowerCase());
  });

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        rows={rows}
        onClick={(e) => {
          const c = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
          setCursorPosition(c);
          setHashTrigger(detectHashTrigger(displayValue, c));
        }}
        onBlur={() => setTimeout(closeHashTrigger, 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setShowSuggestions(false);
            closeHashTrigger();
            return;
          }
          if (hashTrigger) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setEntityActiveIndex((i) =>
                Math.min(entityItemsRef.current.length - 1, i + 1)
              );
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setEntityActiveIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              if (entityItemsRef.current.length > 0) {
                e.preventDefault();
                insertEntityToken(entityItemsRef.current[entityActiveIndex]);
              }
            }
          }
        }}
      />
      
      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-32 overflow-y-auto">
          {filteredUsers.slice(0, 5).map((user) => {
            const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            return (
              <button
                key={user.id}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-sm"
                onClick={() => handleUserMention(user)}
              >
                <div className="font-medium">{displayName || user.email}</div>
                {displayName && user.email && (
                  <div className="text-xs text-gray-500">{user.email}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {hashTrigger && !showSuggestions && (
        <InlineEntitySuggestions
          query={hashTrigger.query}
          activeIndex={entityActiveIndex}
          onItemsChange={(items) => {
            entityItemsRef.current = items;
            if (entityActiveIndex >= items.length) setEntityActiveIndex(0);
          }}
          onPick={insertEntityToken}
          onDismiss={closeHashTrigger}
        />
      )}
    </div>
  );
};
