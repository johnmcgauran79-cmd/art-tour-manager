// Keeps each tour's Xero Product/Service sale price equal to the ART Admin
// twin/double share price. ART Admin is the single source of truth.
// Actions:
//   { action: "check" }                 -> list current/upcoming tours and whether Xero matches
//   { action: "sync", tourIds?: [...] } -> push ART price to Xero for mismatched tours
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getAuth(supabase: any) {
  const { data: settings } = await supabase
    .from('xero_integration_settings').select('*').eq('is_connected', true).maybeSingle();
  if (!settings) return null;
  if (Date.now() < new Date(settings.token_expires_at).getTime() - 300000) {
    return { token: settings.access_token, tenantId: settings.tenant_id };
  }
  const id = Deno.env.get('XERO_CLIENT_ID'); const secret = Deno.env.get('XERO_CLIENT_SECRET');
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.refresh_token }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  await supabase.from('xero_integration_settings').update({
    access_token: t.access_token, refresh_token: t.refresh_token,
    token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', settings.id).eq('refresh_token', settings.refresh_token);
  return { token: t.access_token, tenantId: settings.tenant_id };
}

async function xero(auth: any, path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId,
      Accept: 'application/json', 'Content-Type': 'application/json',
    },
  });
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get('Retry-After') || 5) * 1000;
    await res.text().catch(() => {});
    await sleep(wait);
    return xero(auth, path, init, attempt + 1);
  }
  return res;
}

const artPrice = (t: any): number | null => {
  const v = t.price_double ?? t.price_twin;
  return v == null ? null : Number(v);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Caller must be admin or manager.
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await supabase.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'Not signed in' }, 401);
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', u.user.id);
    if (!(roles || []).some((r: any) => ['admin', 'manager'].includes(r.role))) {
      return json({ error: 'Only admin and manager users can update Xero prices' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action === 'sync' ? 'sync' : 'check';
    const onlyIds: string[] | null = Array.isArray(body.tourIds) ? body.tourIds.filter((x: any) => typeof x === 'string') : null;

    const auth = await getAuth(supabase);
    if (!auth) return json({ error: 'Xero is not connected or the connection has expired — reconnect Xero.' }, 400);

    const today = new Date().toISOString().split('T')[0];
    let q = supabase.from('tours')
      .select('id, name, start_date, end_date, status, xero_product_id, price_double, price_twin, is_test_tour')
      .gte('end_date', today)
      .not('status', 'in', '("cancelled","past","archived")')
      .order('start_date');
    if (onlyIds?.length) q = q.in('id', onlyIds);
    const { data: tours, error } = await q;
    if (error) throw error;

    const itemsRes = await xero(auth, 'Items');
    if (!itemsRes.ok) {
      const t = await itemsRes.text();
      return json({ error: 'Could not read Products & Services from Xero', status: itemsRes.status, details: t }, 502);
    }
    const items: any[] = (await itemsRes.json()).Items || [];
    const byCode = new Map(items.map((i) => [String(i.Code || '').trim().toUpperCase(), i]));

    const rows = (tours || []).map((t: any) => {
      const code = (t.xero_product_id || '').trim();
      const price = artPrice(t);
      const item = code ? byCode.get(code.toUpperCase()) : undefined;
      const xeroPrice = item?.SalesDetails?.UnitPrice ?? null;
      let state: string;
      if (!code) state = 'no_code';
      else if (!item) state = 'code_not_in_xero';
      else if (price == null) state = 'no_art_price';
      else if (xeroPrice != null && Math.abs(Number(xeroPrice) - price) < 0.005) state = 'match';
      else state = 'mismatch';
      return {
        tour_id: t.id, tour_name: t.name, start_date: t.start_date, code: code || null,
        art_price: price, xero_price: xeroPrice == null ? null : Number(xeroPrice),
        xero_item_name: item?.Name ?? null, state, _item: item,
      };
    });

    const results: any[] = [];
    if (action === 'sync') {
      for (const r of rows.filter((r) => r.state === 'mismatch')) {
        const it = r._item;
        const payload = {
          Items: [{
            ItemID: it.ItemID, Code: it.Code,
            SalesDetails: {
              UnitPrice: r.art_price,
              ...(it.SalesDetails?.AccountCode ? { AccountCode: it.SalesDetails.AccountCode } : {}),
              ...(it.SalesDetails?.TaxType ? { TaxType: it.SalesDetails.TaxType } : {}),
            },
          }],
        };
        const res = await xero(auth, `Items/${it.ItemID}`, { method: 'POST', body: JSON.stringify(payload) });
        if (res.ok) {
          await res.text().catch(() => {});
          r.state = 'updated'; r.xero_price = r.art_price;
          results.push({ tour_id: r.tour_id, ok: true });
        } else {
          const details = await res.text();
          console.error(`Xero item update failed [${res.status}] ${r.code}: ${details}`);
          r.state = res.status === 401 || res.status === 403 ? 'no_permission' : 'failed';
          results.push({ tour_id: r.tour_id, ok: false, status: res.status, details: details.slice(0, 500) });
        }
        await sleep(300);
      }
    }

    return json({ rows: rows.map(({ _item, ...r }) => r), results });
  } catch (e) {
    console.error('xero-item-price-sync error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
