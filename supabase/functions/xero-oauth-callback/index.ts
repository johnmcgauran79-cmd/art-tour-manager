import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
  const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    return new Response('Xero credentials not configured', { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // Action: Generate auth URL for the user to click
    if (action === 'authorize') {
      const redirectUri = `${SUPABASE_URL}/functions/v1/xero-oauth-callback`;
      const scopes = 'openid profile email accounting.transactions accounting.transactions.read accounting.contacts.read accounting.contacts offline_access';
      const state = crypto.randomUUID();
      
      console.log('Generating Xero auth URL with:', {
        clientId: XERO_CLIENT_ID,
        redirectUri,
        scopes,
        state,
      });

      const authUrl = `https://login.xero.com/identity/connect/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(XERO_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `state=${encodeURIComponent(state)}`;

      console.log('Generated auth URL:', authUrl);

      return new Response(JSON.stringify({ authUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Disconnect
    if (action === 'disconnect') {
      await supabase
        .from('xero_integration_settings')
        .update({
          is_connected: false,
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          tenant_id: null,
          tenant_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq('is_connected', true);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Refresh token
    if (action === 'refresh') {
      const { data: settings } = await supabase
        .from('xero_integration_settings')
        .select('*')
        .eq('is_connected', true)
        .maybeSingle();

      if (!settings?.refresh_token) {
        return new Response(JSON.stringify({ error: 'No refresh token available' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: settings.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', errorText);
        
        await supabase
          .from('xero_integration_settings')
          .update({ is_connected: false, updated_at: new Date().toISOString() })
          .eq('id', settings.id);

        return new Response(JSON.stringify({ error: 'Token refresh failed', details: errorText }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokens = await tokenResponse.json();
      
      await supabase
        .from('xero_integration_settings')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default: Handle OAuth callback (code exchange)
    const code = url.searchParams.get('code');
    
    if (!code) {
      return new Response('Missing authorization code', { status: 400 });
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/xero-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(`Token exchange failed: ${errorText}`, { status: 400 });
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens received successfully');

    // Get Xero tenant (organisation) info
    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    const connections = await connectionsResponse.json();
    const tenant = connections[0]; // Use first connected org

    if (!tenant) {
      return new Response('No Xero organisation found', { status: 400 });
    }

    // Store tokens and tenant info
    await supabase
      .from('xero_integration_settings')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        is_connected: true,
        updated_at: new Date().toISOString(),
      })
      .not('id', 'is', null); // Update the single row

    // Log the connection
    await supabase.from('xero_sync_log').insert({
      sync_type: 'oauth',
      entity_type: 'connection',
      action: 'connected',
      details: { tenant_name: tenant.tenantName, tenant_id: tenant.tenantId },
      status: 'success',
    });

    // Redirect back to the app settings page
    const appUrl = Deno.env.get('APP_URL') || 'https://art-tour-manager.lovable.app';
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${appUrl}/?tab=settings&xero=connected` },
    });

  } catch (error: any) {
    console.error('Xero OAuth error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
