import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateAiConversation, type AiConversationContext } from "@/hooks/useAiChat";

export interface ArtAiLaunchState {
  conversationId: string;
  skillId: "explain_booking" | "explain_client";
  entryPoint: string;
  context: AiConversationContext;
}

/**
 * Create a fresh AI conversation carrying ID-based page context and navigate to
 * the ART AI workspace, which auto-invokes the deterministic skill. Only
 * id-based/display context is stored — never record payloads.
 */
export function useLaunchArtAiSkill() {
  const createConvo = useCreateAiConversation();
  const navigate = useNavigate();

  return useCallback(
    async (args: {
      skillId: "explain_booking" | "explain_client";
      entryPoint: string;
      context: AiConversationContext;
    }) => {
      const convo = await createConvo.mutateAsync(args.context);
      const state: ArtAiLaunchState = {
        conversationId: convo.id,
        skillId: args.skillId,
        entryPoint: args.entryPoint,
        context: args.context,
      };
      navigate("/art-ai", { state: { artAiLaunch: state } });
    },
    [createConvo, navigate],
  );
}