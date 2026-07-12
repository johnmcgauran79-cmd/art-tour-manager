import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiConversation {
  id: string;
  title: string;
  retain_indefinitely: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AiMessagePart {
  type: string;
  text?: string;
  tool_name?: string;
  status?: string;
  duration_ms?: number;
  result_count?: number | null;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: AiMessagePart[];
  created_at: string;
}

export const useAiConversations = () =>
  useQuery({
    queryKey: ["ai-conversations"],
    queryFn: async (): Promise<AiConversation[]> => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, title, retain_indefinitely, expires_at, created_at, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiConversation[];
    },
  });

export const useAiMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: ["ai-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<AiMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("ai_messages")
        .select("id, conversation_id, role, content, parts, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiMessage[];
    },
  });

export const useCreateAiConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AiConversation> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({ user_id: uid })
        .select("id, title, retain_indefinitely, expires_at, created_at, updated_at")
        .single();
      if (error) throw error;
      return data as AiConversation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-conversations"] }),
  });
};

export const useDeleteAiConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete — 30-day recovery grace before permanent purge.
      const { error } = await supabase
        .from("ai_conversations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-conversations"] }),
  });
};

export const useSetRetainIndefinitely = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, retain }: { id: string; retain: boolean }) => {
      const { error } = await supabase
        .from("ai_conversations")
        .update({ retain_indefinitely: retain })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-conversations"] }),
  });
};

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onTool: (evt: { tool_name: string; status: string; duration_ms?: number; result_count?: number | null }) => void;
  onDone: (evt: { message_id: string | null; tool_calls: number }) => void;
  onError: (evt: { error: string; retry_after_seconds?: number }) => void;
}

/**
 * Stream a turn from the art-ai-chat Edge Function. Returns an AbortController
 * so callers can implement a Stop control.
 */
export const streamAiChat = (
  conversationId: string,
  message: string,
  handlers: StreamHandlers,
): AbortController => {
  const controller = new AbortController();
  (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        handlers.onError({ error: "unauthorized" });
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/art-ai-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId, message }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        handlers.onError({ error: "RATE_LIMIT_EXCEEDED", retry_after_seconds: body.retry_after_seconds });
        return;
      }
      if (!res.ok || !res.body) {
        handlers.onError({ error: "AI_ERROR" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const type = eventLine.slice(6).trim();
          let payload: any = {};
          try {
            payload = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }
          if (type === "delta") handlers.onDelta(payload.text ?? "");
          else if (type === "tool") handlers.onTool(payload);
          else if (type === "done") handlers.onDone(payload);
          else if (type === "error") handlers.onError(payload);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      handlers.onError({ error: "AI_ERROR" });
    }
  })();
  return controller;
};