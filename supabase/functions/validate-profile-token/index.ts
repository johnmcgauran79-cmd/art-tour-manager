import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateTokenPayload {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token }: ValidateTokenPayload = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required", valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token lookup error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired link", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired", valid: false }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last used timestamp
    await supabase
      .from("customer_access_tokens")
      .update({ 
        last_used_at: new Date().toISOString(),
        use_count: tokenData.use_count + 1 
      })
      .eq("id", tokenData.id);

    // Return customer data (only safe fields)
    const customer = tokenData.customers;
    
    return new Response(
      JSON.stringify({
        valid: true,
        customer: {
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          city: customer.city,
          state: customer.state,
          country: customer.country,
          dietary_requirements: customer.dietary_requirements,
          emergency_contact_name: customer.emergency_contact_name,
          emergency_contact_phone: customer.emergency_contact_phone,
          emergency_contact_relationship: customer.emergency_contact_relationship,
          medical_conditions: customer.medical_conditions,
          accessibility_needs: customer.accessibility_needs,
        },
        expiresAt: tokenData.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in validate-profile-token:", error);
    return new Response(
      JSON.stringify({ error: error.message, valid: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
