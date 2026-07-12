import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Send,
  Square,
  Copy,
  RefreshCw,
  Pin,
  PinOff,
  Wrench,
  Loader2,
  X,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import artAiLogo from "@/assets/art-ai-logo.png";
import { AiMarkdown } from "./AiMarkdown";
import {
  useAiConversations,
  useAiMessages,
  useCreateAiConversation,
  useDeleteAiConversation,
  useSetRetainIndefinitely,
  streamAiChat,
  type AiMessage,
  type AiMessagePart,
  type AiConversationContext,
  type StreamOptions,
} from "@/hooks/useAiChat";
import {
  QUICK_SKILLS,
  COMING_SOON_SKILLS,
  SKILL_LAUNCH_PROMPTS,
  type SkillGroup,
} from "@/lib/artAiSkills";
import type { ArtAiLaunchState } from "@/hooks/useLaunchArtAiSkill";

const GROUPS: SkillGroup[] = ["Operations", "Finance", "Administration"];

interface LiveState {
  streaming: boolean;
  text: string;
  tools: { tool_name: string; status: string; duration_ms?: number; result_count?: number | null }[];
}

interface ContextChip {
  label: string;
  context: AiConversationContext;
  skillId: "explain_booking" | "explain_client";
  entryPoint: string;
}

const ToolActivity = ({ parts }: { parts: AiMessagePart[] }) => {
  const tools = parts.filter((p) => p.type === "tool_activity_summary");
  if (tools.length === 0) return null;
  return (
    <details className="mt-2 rounded-md border border-border/60 bg-muted/40 text-xs">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-muted-foreground">
        <Wrench className="mr-1.5 inline h-3 w-3" />
        {tools.length} tool {tools.length === 1 ? "call" : "calls"}
      </summary>
      <div className="space-y-1 px-3 pb-2">
        {tools.map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="font-mono">{t.tool_name}</span>
            <span className="text-muted-foreground">
              {t.status}
              {t.result_count != null ? ` · ${t.result_count} rows` : ""}
              {t.duration_ms != null ? ` · ${t.duration_ms}ms` : ""}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
};

export const ArtAiWorkspace = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: conversations = [] } = useAiConversations();
  const createConvo = useCreateAiConversation();
  const deleteConvo = useDeleteAiConversation();
  const setRetain = useSetRetainIndefinitely();

  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: messages = [] } = useAiMessages(activeId);
  const [input, setInput] = useState("");
  const [live, setLive] = useState<LiveState>({ streaming: false, text: "", tools: [] });
  const [contextChip, setContextChip] = useState<ContextChip | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const launchHandledRef = useRef<string | null>(null);

  const activeConvo = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    // Focus composer on load and when switching conversations.
    textareaRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, live]);

  const send = useCallback(
    async (text: string, options?: StreamOptions, convoIdOverride?: string) => {
      const trimmed = text.trim();
      if (!trimmed || live.streaming) return;

      let convoId = convoIdOverride ?? activeId;
      if (!convoId) {
        try {
          const convo = await createConvo.mutateAsync(undefined);
          convoId = convo.id;
          setActiveId(convo.id);
        } catch (e) {
          // Most commonly an expired/invalid session: the conversation insert
          // is rejected by RLS before we ever reach the chat function. Surface
          // it instead of silently doing nothing.
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            toast({
              title: "Session expired",
              description: "Please sign in again to use ART AI.",
              variant: "destructive",
            });
            navigate("/login");
          } else {
            toast({
              title: "Couldn't start conversation",
              description: "Something went wrong starting the chat. Please try again.",
              variant: "destructive",
            });
          }
          return;
        }
      }

      setInput("");
      setLive({ streaming: true, text: "", tools: [] });
      // Optimistically show the user message immediately.
      qc.setQueryData<AiMessage[]>(["ai-messages", convoId], (old = []) => [
        ...old,
        {
          id: `optimistic-${Date.now()}`,
          conversation_id: convoId!,
          role: "user",
          content: trimmed,
          parts: [{ type: "text", text: trimmed }],
          created_at: new Date().toISOString(),
        },
      ]);

      abortRef.current = streamAiChat(convoId, trimmed, {
        onDelta: (t) => setLive((s) => ({ ...s, text: s.text + t })),
        onTool: (evt) =>
          setLive((s) => {
            const others = s.tools.filter((x) => x.tool_name !== evt.tool_name || x.status !== "running");
            return { ...s, tools: [...others.filter((x) => !(x.tool_name === evt.tool_name && evt.status !== "running" && x.status === "running")), evt] };
          }),
        onDone: () => {
          setLive({ streaming: false, text: "", tools: [] });
          qc.invalidateQueries({ queryKey: ["ai-messages", convoId] });
          qc.invalidateQueries({ queryKey: ["ai-conversations"] });
          setTimeout(() => textareaRef.current?.focus(), 0);
        },
        onError: (evt) => {
          setLive({ streaming: false, text: "", tools: [] });
          qc.invalidateQueries({ queryKey: ["ai-messages", convoId] });
          if (evt.error === "RATE_LIMIT_EXCEEDED") {
            toast({
              title: "Rate limit reached",
              description: `Please wait ${evt.retry_after_seconds ?? 60}s before asking again.`,
              variant: "destructive",
            });
          } else if (evt.error === "AI_TIMEOUT") {
            toast({ title: "Request timed out", description: "The request took too long. Please try again.", variant: "destructive" });
          } else {
            toast({ title: "ART AI error", description: "Something went wrong. Please try again.", variant: "destructive" });
          }
        },
      }, options);
    },
    [activeId, live.streaming, createConvo, qc, toast],
  );

  // ---- Auto-launch a deterministic skill arriving from a context button ----
  useEffect(() => {
    const launch = (location.state as { artAiLaunch?: ArtAiLaunchState } | null)?.artAiLaunch;
    if (!launch) return;
    if (launchHandledRef.current === launch.conversationId) return;
    launchHandledRef.current = launch.conversationId;
    // Clear router state so a refresh/back doesn't re-fire the skill.
    navigate(location.pathname, { replace: true, state: null });

    setActiveId(launch.conversationId);
    setContextChip({
      label: launch.context.context_label ?? "Context",
      context: launch.context,
      skillId: launch.skillId,
      entryPoint: launch.entryPoint,
    });
    const prompt = SKILL_LAUNCH_PROMPTS[launch.skillId] ?? "Explain this.";
    void send(
      prompt,
      {
        mode: "deterministic_skill",
        skillId: launch.skillId,
        entryPoint: launch.entryPoint,
        context: launch.context,
      },
      launch.conversationId,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const runSkillCard = (skillId: "explain_booking" | "explain_client", landingPrompt: string) => {
    // From the landing page there is no record context — launch a curated
    // generic-chat prompt that guides the user to identify the record.
    void send(landingPrompt, { mode: "generic_chat", entryPoint: "landing_card" });
  };

  const stop = () => {
    abortRef.current?.abort();
    setLive({ streaming: false, text: "", tools: [] });
  };

  const regenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) send(lastUser.content);
  };

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: "Copied" });
  };

  const newConversation = async () => {
    setActiveId(null);
    setLive({ streaming: false, text: "", tools: [] });
    setContextChip(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-lg border border-border bg-card md:flex">
        <div className="p-3">
          <Button onClick={newConversation} className="w-full justify-start gap-2" size="sm">
            <Plus className="h-4 w-4" /> New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-2">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  activeId === c.id && "bg-accent",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className="flex-1 truncate text-left"
                  title={c.title}
                >
                  {c.retain_indefinitely && <Pin className="mr-1 inline h-3 w-3 text-primary" />}
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => setRetain.mutate({ id: c.id, retain: !c.retain_indefinitely })}
                  className="opacity-0 group-hover:opacity-100"
                  title={c.retain_indefinitely ? "Stop keeping indefinitely" : "Keep indefinitely"}
                >
                  {c.retain_indefinitely ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteConvo.mutate(c.id);
                    if (activeId === c.id) setActiveId(null);
                  }}
                  className="opacity-0 group-hover:opacity-100"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-card">
        <div ref={scrollRef} className="flex-1 overflow-auto p-4">
          {messages.length === 0 && !live.streaming ? (
            <div className="mx-auto max-w-3xl py-8">
              <div className="text-center">
                <img src={artAiLogo} alt="ART AI" width={64} height={64} className="mx-auto mb-4 h-16 w-16 rounded-xl" />
                <h2 className="font-display text-xl font-bold">Ask ART AI</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your operational assistant. Pick a quick skill or ask your own question.
                </p>
              </div>
              <div className="mt-6 space-y-5">
                {GROUPS.map((group) => {
                  const active = QUICK_SKILLS.filter((s) => s.group === group);
                  const soon = COMING_SOON_SKILLS.filter((s) => s.group === group);
                  if (active.length === 0 && soon.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {active.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              s.kind === "deterministic"
                                ? runSkillCard(s.skillId!, s.landingPrompt ?? "")
                                : send(s.prompt ?? "", { entryPoint: "landing_card" })
                            }
                            className="rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-accent"
                          >
                            <p className="text-sm font-medium">{s.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                          </button>
                        ))}
                        {soon.map((s) => (
                          <div
                            key={s.id}
                            aria-disabled="true"
                            className="pointer-events-none select-none rounded-lg border border-dashed border-border bg-muted/40 p-3 text-left opacity-60"
                          >
                            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                              <Lock className="h-3 w-3" /> {s.label}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Coming soon
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-2.5 text-sm",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <>
                        <AiMarkdown>{m.content}</AiMarkdown>
                        <ToolActivity parts={m.parts} />
                        <div className="mt-1.5 flex gap-2 text-muted-foreground">
                          <button type="button" onClick={() => copyText(m.content)} title="Copy">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={regenerate} title="Regenerate">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {live.streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-4 py-2.5 text-sm">
                    {live.tools.length > 0 && (
                      <div className="mb-2 space-y-1 text-xs text-muted-foreground">
                        {live.tools.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {t.status === "running" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wrench className="h-3 w-3" />
                            )}
                            <span className="font-mono">{t.tool_name}</span>
                            <span>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {live.text ? (
                      <AiMarkdown>{live.text}</AiMarkdown>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          {contextChip && (
            <div className="mx-auto mb-2 flex max-w-3xl items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <img src={artAiLogo} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded" />
                {contextChip.label}
                <button
                  type="button"
                  onClick={() => setContextChip(null)}
                  className="ml-0.5 rounded-full hover:bg-primary/20"
                  title="Remove context"
                  aria-label="Remove context"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask ART AI about tours, bookings, activities, hotels or finances…"
              className="max-h-40 min-h-[44px] resize-none"
              rows={1}
            />
            {live.streaming ? (
              <Button onClick={stop} variant="secondary" size="icon" title="Stop">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => send(input)} size="icon" disabled={!input.trim()} title="Send">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          {activeConvo && (
            <p className="mx-auto mt-1.5 max-w-3xl text-[10px] text-muted-foreground">
              {activeConvo.retain_indefinitely
                ? "Kept indefinitely."
                : `Auto-deletes on ${new Date(activeConvo.expires_at).toLocaleDateString("en-AU")}.`}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};