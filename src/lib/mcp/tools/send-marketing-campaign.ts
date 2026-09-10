import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { invokeFunction, sendingDisabledResult, sendingEnabled } from "./_sending";

export default defineTool({
  name: "send_marketing_campaign",
  title: "Send or test a marketing campaign (currently switched off)",
  description:
    "Send a prepared marketing campaign, or send a test copy to one address. DISABLED until ART authorises AI-initiated sending; until then it returns an explanation and sends nothing. Consent, unsubscribe and suppression rules always apply.",
  inputSchema: {
    campaign_id: z.string(),
    action: z.enum(["send", "test"]).describe("send = full audience, test = single test address."),
    test_email: z.string().email().optional().describe("Required for action 'test'."),
    confirm: z.literal(true).describe("Must be true to confirm a real send."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  handler: async ({ campaign_id, action, test_email, confirm }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!sendingEnabled()) return sendingDisabledResult();
    if (confirm !== true)
      return { content: [{ type: "text", text: "confirm must be true for a send." }], isError: true };
    if (action === "test" && !test_email)
      return { content: [{ type: "text", text: "test_email is required for a test send." }], isError: true };

    const res = await invokeFunction(ctx, "marketing-send-campaign", {
      action,
      campaignId: campaign_id,
      testEmail: test_email,
    });
    if (!res.ok)
      return { content: [{ type: "text", text: `Send failed (${res.status}): ${JSON.stringify(res.data)}` }], isError: true };
    return {
      content: [{ type: "text", text: `Campaign ${action} requested.` }],
      structuredContent: { result: res.data },
    };
  },
});
