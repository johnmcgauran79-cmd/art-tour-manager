import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WaiverSubmission {
  token: string;
  signatures: Array<{
    slot: number;
    customer_id: string | null;
    signed_name: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, signatures }: WaiverSubmission = await req.json();

    if (!token || !signatures || signatures.length === 0) {
      return new Response(
        JSON.stringify({ error: "Token and signatures are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*")
      .eq("token", token)
      .eq("purpose", "waiver")
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get waiver text and version
    const { data: waiverTextSetting } = await supabase
      .from("general_settings")
      .select("setting_value")
      .eq("setting_key", "waiver_form_text")
      .single();

    const { data: waiverVersionSetting } = await supabase
      .from("general_settings")
      .select("setting_value")
      .eq("setting_key", "waiver_form_version")
      .single();

    const waiverText = waiverTextSetting?.setting_value || "";
    const waiverVersion = typeof waiverVersionSetting?.setting_value === "number" 
      ? waiverVersionSetting.setting_value 
      : Number(waiverVersionSetting?.setting_value) || 1;

    // Extract IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Insert waivers for each signature
    const waiverInserts = signatures.map(sig => ({
      booking_id: tokenData.booking_id,
      customer_id: sig.customer_id,
      passenger_slot: sig.slot,
      signed_name: sig.signed_name.trim(),
      waiver_version: waiverVersion,
      waiver_content: typeof waiverText === "string" ? waiverText : JSON.stringify(waiverText),
      token_id: tokenData.id,
      ip_address: ipAddress,
      user_agent: userAgent,
    }));

    const { error: insertError } = await supabase
      .from("booking_waivers")
      .insert(waiverInserts);

    if (insertError) {
      console.error("Error inserting waivers:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save waiver. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({
        last_used_at: new Date().toISOString(),
        use_count: tokenData.use_count + 1,
      })
      .eq("id", tokenData.id);

    return new Response(
      JSON.stringify({ success: true, count: signatures.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-waiver:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
