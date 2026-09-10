/// <reference types="node" />
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Outbound sending (marketing campaigns and individual emails) is built but
 * DISABLED until ART explicitly authorises it. Set the edge-function secret
 * MCP_SENDING_ENABLED to "true" to switch it on.
 */
export function sendingEnabled(): boolean {
  return (process.env.MCP_SENDING_ENABLED ?? "").trim().toLowerCase() === "true";
}

export function sendingDisabledResult() {
  return {
    content: [
      {
        type: "text" as const,
        text:
          "Sending is switched off. This tool exists but ART has not authorised AI-initiated sending yet. " +
          "An admin can enable it by setting MCP_SENDING_ENABLED to true in the Supabase edge function secrets.",
      },
    ],
    isError: true,
  };
}

/** Call one of the app's own edge functions as the signed-in MCP user. */
export async function invokeFunction(
  ctx: ToolContext,
  name: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const base = process.env.SUPABASE_URL!;
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)!;
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${ctx.getToken()}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, data };
}
