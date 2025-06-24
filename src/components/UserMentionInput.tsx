
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(cursor);
    
    // Check for @ mentions
    const textBeforeCursor = newValue.substring(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
    }

    // Extract mentioned user IDs from the text with improved regex
    const mentions = newValue.match(/@\[([^\]]+)\]\(([^)]+)\)/g) || [];
    const mentionedIds = mentions.map(mention => {
      const match = mention.match(/@\[([^\]]+)\]\(([^)]+)\)/);
      return match ? match[2] : null; // match[2] is the user ID
    }).filter(Boolean) as string[];
    
    console.log('Extracted mentioned user IDs:', mentionedIds);
    console.log('Full text with mentions:', newValue);
    
    onMentionedUsersChange(mentionedIds);
  };

  const handleUserMention = (user: User) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    
    // Remove the @ and partial name
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown';
    const mentionText = `@[${displayName}](${user.id})`;
    
    const newValue = beforeMention + mentionText + " " + textAfterCursor;
    console.log('Adding mention for user:', user.id, 'Display:', displayName);
    console.log('New value with mention:', newValue);
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const filteredUsers = users.filter(user => {
    if (!mentionQuery) return true;
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const searchText = (displayName || user.email || '').toLowerCase();
    return searchText.includes(mentionQuery.toLowerCase());
  });

  // Convert mentions back to display format for the textarea
  const displayValue = value.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        rows={rows}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setShowSuggestions(false);
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
    </div>
  );
};
