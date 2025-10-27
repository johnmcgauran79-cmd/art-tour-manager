import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://cdn.skypack.dev/svix";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature, webhook-id, webhook-timestamp, webhook-signature",
};


const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.text();
    
    // Verify webhook signature using Svix library
    const wh = new Webhook(webhookSecret);
    const headers = {
      "svix-id": req.headers.get("svix-id") || req.headers.get("webhook-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || req.headers.get("webhook-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || req.headers.get("webhook-signature") || "",
    };
    
    try {
      wh.verify(payload, headers);
      console.log("Webhook signature verified successfully");
    } catch (err) {
      console.error("Invalid webhook signature:", err.message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(payload);
    console.log("Received webhook event:", event.type, "for message:", event.data?.email_id);

    // Extract event data
    const { type, data } = event;
    const messageId = data?.email_id;

    if (!messageId) {
      console.error("No message ID in webhook event");
      return new Response(
        JSON.stringify({ error: "Missing message ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the email log entry
    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .select("id")
      .eq("message_id", messageId)
      .single();

    if (logError || !emailLog) {
      console.error("Email log not found for message:", messageId, logError);
      // Don't fail the webhook - might be an email we didn't track
      return new Response(
        JSON.stringify({ message: "Email log not found, event ignored" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "delayed",
      "email.complained": "complained",
      "email.bounced": "bounced",
      "email.opened": "opened",
      "email.clicked": "clicked",
    };

    const eventType = eventTypeMap[type] || type;

    // Insert event record
    const { error: insertError } = await supabase
      .from("email_events")
      .insert({
        email_log_id: emailLog.id,
        message_id: messageId,
        event_type: eventType,
        event_data: data,
      });

    if (insertError) {
      console.error("Error inserting email event:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully recorded ${eventType} event for message ${messageId}`);

    return new Response(
      JSON.stringify({ message: "Webhook processed successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in resend-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
