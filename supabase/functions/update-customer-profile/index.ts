import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateProfilePayload {
  token: string;
  updates: {
    preferred_name?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    dietary_requirements?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    medical_conditions?: string;
    accessibility_needs?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const { token, updates }: UpdateProfilePayload = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = tokenData.customers;
    const customerId = customer.id;

    // Track what changed
    const changes: Record<string, { old: any; new: any }> = {};
    const allowedFields = [
      'preferred_name', 'email', 'phone', 'city', 'state', 'country',
      'dietary_requirements', 'emergency_contact_name', 
      'emergency_contact_phone', 'emergency_contact_relationship',
      'medical_conditions', 'accessibility_needs'
    ];

    // Build update object and track changes
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    for (const field of allowedFields) {
      if (field in updates) {
        const newValue = updates[field as keyof typeof updates];
        const oldValue = customer[field];
        
        if (newValue !== oldValue) {
          changes[field] = { old: oldValue, new: newValue };
          updateData[field] = newValue;
        }
      }
    }

    // Only proceed if there are actual changes
    if (Object.keys(changes).length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No changes detected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update customer profile
    const { error: updateError } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", customerId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the update with IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabase.from("customer_profile_updates").insert({
      customer_id: customerId,
      token_id: tokenData.id,
      changes: changes,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ 
        last_used_at: new Date().toISOString(),
        use_count: tokenData.use_count + 1 
      })
      .eq("id", tokenData.id);

    // Send confirmation email
    const customerEmail = updates.email || customer.email;
    if (resend && customerEmail) {
      const changesHtml = Object.entries(changes)
        .map(([field, { old, new: newVal }]) => {
          const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${fieldName}</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #999; text-decoration: line-through;">${old || '(empty)'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #2e7d32;">${newVal || '(empty)'}</td>
          </tr>`;
        })
        .join('');

      try {
        await resend.emails.send({
          from: "Australian Racing Tours <info@australianracingtours.com.au>",
          to: [customerEmail],
          subject: "Your Profile Has Been Updated",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Profile Updated</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="margin-top: 0;">Dear ${customer.first_name},</p>
                
                <p>Your profile has been successfully updated. Here's a summary of the changes:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <thead>
                    <tr style="background: #f5f5f5;">
                      <th style="padding: 10px; text-align: left;">Field</th>
                      <th style="padding: 10px; text-align: left;">Previous</th>
                      <th style="padding: 10px; text-align: left;">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${changesHtml}
                  </tbody>
                </table>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                    ✓ Your changes have been saved to our system.
                  </p>
                </div>
                
                <p>If you didn't make these changes, please contact us immediately.</p>
                
                <p style="margin-bottom: 0;">Kind regards,<br><strong>Australian Racing Tours</strong></p>
              </div>
            </body>
            </html>
          `,
        });
        console.log("Confirmation email sent to:", customerEmail);
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Profile updated successfully",
        changesCount: Object.keys(changes).length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in update-customer-profile:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
