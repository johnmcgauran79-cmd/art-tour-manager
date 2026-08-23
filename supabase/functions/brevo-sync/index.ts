// Ongoing Brevo connection (used after the migration is finished).
//  - status: is Brevo connected, and how many ART contacts are linked
//  - pull_new: bring newly created Brevo contacts into ART as new contacts
//  - push_contact: push a single ART contact's details up to Brevo
import {
  adminClient,
  brevoConfigured,
  brevoRequest,
  corsHeaders,
  formatPhoneIntl,
  json,
  requireAdminOrManager,
  sleep,
} from "../_shared/crmMigration.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();

  try {
    const guard = await requireAdminOrManager(req, supabase);
    if (guard.error) return guard.error;

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "status";

    if (action === "status") {
      if (!brevoConfigured()) {
        return json({ connected: false, reason: "Brevo is not connected in Lovable yet." });
      }
      let account: any = null;
      try {
        account = await brevoRequest("account");
      } catch (err: any) {
        return json({ connected: false, reason: err?.message ?? String(err) });
      }
      const { count: linked } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .not("brevo_contact_id", "is", null);
      const { count: totalContacts } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });

      return json({
        connected: true,
        company: account?.companyName ?? null,
        email: account?.email ?? null,
        plan: account?.plan ?? null,
        linkedContacts: linked ?? 0,
        totalContacts: totalContacts ?? 0,
      });
    }

    if (!brevoConfigured()) {
      return json({ error: "Brevo is not connected in Lovable yet.", needsBrevo: true }, 400);
    }

    // -- pull contacts created in Brevo that ART does not have yet ----------
    if (action === "pull_new") {
      const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);
      const offset = Math.max(Number(body?.offset) || 0, 0);
      const res = await brevoRequest(
        `contacts?limit=${limit}&offset=${offset}&sort=desc`,
      );
      const contacts = res?.contacts ?? [];

      let created = 0;
      let linked = 0;
      let skipped = 0;

      for (const c of contacts) {
        const email = String(c?.email ?? "").trim().toLowerCase();
        if (!email) { skipped += 1; continue; }
        const attrs = c?.attributes ?? {};

        const { data: existing } = await supabase
          .from("customers")
          .select("id, brevo_contact_id")
          .eq("email", email)
          .maybeSingle();

        if (existing) {
          if (!existing.brevo_contact_id) {
            await supabase
              .from("customers")
              .update({
                brevo_contact_id: String(c.id),
                brevo_synced_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            linked += 1;
          } else {
            skipped += 1;
          }
          continue;
        }

        const firstName = attrs.FIRSTNAME ?? attrs.FIRST_NAME ?? null;
        const lastName = attrs.LASTNAME ?? attrs.LAST_NAME ?? null;
        if (!firstName && !lastName) { skipped += 1; continue; }

        const { error } = await supabase.from("customers").insert({
          first_name: firstName ?? "",
          last_name: lastName ?? "",
          email,
          phone: formatPhoneIntl(attrs.SMS ?? attrs.PHONE ?? null),
          city: attrs.CITY ?? null,
          state: attrs.STATE ?? null,
          country: attrs.COUNTRY ?? null,
          brevo_contact_id: String(c.id),
          brevo_synced_at: new Date().toISOString(),
          crm_source: "brevo",
        });
        if (error) {
          console.error(`Failed creating ART contact for ${email}: ${error.message}`);
          skipped += 1;
        } else {
          created += 1;
        }
      }

      return json({
        processed: contacts.length,
        created,
        linked,
        skipped,
        hasMore: contacts.length === limit,
        nextOffset: offset + contacts.length,
      });
    }

    // -- push one ART contact up to Brevo ----------------------------------
    if (action === "push_contact") {
      const customerId: string | undefined = body?.customerId;
      if (!customerId) return json({ error: "customerId is required" }, 400);

      const { data: customer, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone, city, state, country, latest_tour_name")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      if (!customer) return json({ error: "Contact not found" }, 404);
      if (!customer.email) return json({ error: "Contact has no email address" }, 400);

      const attributes: Record<string, string> = { ART_SOURCE: "art_admin" };
      if (customer.first_name) attributes.FIRSTNAME = customer.first_name;
      if (customer.last_name) attributes.LASTNAME = customer.last_name;
      const phone = formatPhoneIntl(customer.phone);
      if (phone) attributes.SMS = phone;
      const loc = normaliseLocation(customer.city ? null : null, customer.city, customer.country);
      const norm = normaliseLocation(customer.state, customer.city, customer.country);
      void loc;
      if (norm.city) attributes.CITY = norm.city;
      if (norm.state) attributes.STATE = norm.state;
      if (norm.country) attributes.COUNTRY = norm.country;
      if (customer.latest_tour_name) attributes.LATEST_TOUR = customer.latest_tour_name;


      const res = await brevoRequest("contacts", {
        method: "POST",
        body: { email: customer.email, attributes, updateEnabled: true },
      });

      let brevoId = res?.id ? String(res.id) : null;
      if (!brevoId) {
        const fetched = await brevoRequest(`contacts/${encodeURIComponent(customer.email)}`);
        brevoId = fetched?.id ? String(fetched.id) : null;
      }

      await supabase
        .from("customers")
        .update({ brevo_contact_id: brevoId, brevo_synced_at: new Date().toISOString() })
        .eq("id", customer.id);

      await sleep(100);
      return json({ success: true, brevoContactId: brevoId });
    }

    // -- make sure the location fields exist in Brevo, then fill them in ----
    // Brevo has no built-in STATE / CITY / COUNTRY field, so anything we sent
    // during the migration was dropped. This creates the fields and writes the
    // values we hold in ART, so State/Country segments can be built in Brevo.
    if (action === "ensure_location_fields") {
      const wanted = ["STATE", "CITY", "COUNTRY", "LATEST_TOUR"];
      const existing = await brevoRequest("contacts/attributes");
      const have = new Set(
        (existing?.attributes ?? []).map((a: any) => String(a?.name ?? "").toUpperCase()),
      );
      const created: string[] = [];
      for (const name of wanted) {
        if (have.has(name)) continue;
        await brevoRequest(`contacts/attributes/normal/${name}`, {
          method: "POST",
          body: { type: "text" },
        });
        created.push(name);
        await sleep(150);
      }
      return json({ done: true, created, alreadyPresent: wanted.filter((n) => have.has(n)) });
    }

    if (action === "backfill_locations") {
      const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 200);
      const offset = Math.max(Number(body?.offset) || 0, 0);
      const source: string = body?.source === "migration" ? "migration" : "customers";

      let rows: any[] = [];
      if (source === "customers") {
        const { data, error } = await supabase
          .from("customers")
          .select("email, city, state, country, latest_tour_name")
          .not("email", "is", null)
          .or("state.not.is.null,city.not.is.null,country.not.is.null")
          .order("email")
          .range(offset, offset + limit - 1);
        if (error) throw error;
        rows = (data ?? []).map((c: any) => ({
          email: c.email,
          city: c.city,
          state: c.state,
          country: c.country,
          latestTour: c.latest_tour_name,
        }));
      } else {
        const { data, error } = await supabase
          .from("crm_migration_contacts")
          .select("email, city, state, country")
          .not("email", "is", null)
          .or("state.not.is.null,city.not.is.null,country.not.is.null")
          .order("email")
          .range(offset, offset + limit - 1);
        if (error) throw error;
        rows = (data ?? []).map((c: any) => ({
          email: c.email,
          city: c.city,
          state: c.state,
          country: c.country,
          latestTour: null,
        }));
      }

      let updated = 0;
      let failed = 0;
      for (const row of rows) {
        const loc = normaliseLocation(row.state, row.city, row.country);
        const attributes: Record<string, string> = {};
        if (loc.state) attributes.STATE = loc.state;
        if (loc.city) attributes.CITY = loc.city;
        if (loc.country) attributes.COUNTRY = loc.country;
        if (row.latestTour) attributes.LATEST_TOUR = String(row.latestTour);
        if (Object.keys(attributes).length === 0) continue;

        try {
          await brevoRequest(`contacts/${encodeURIComponent(String(row.email))}`, {
            method: "PUT",
            body: { attributes },
          });
          updated += 1;
        } catch (err: any) {
          const message = err?.message ?? String(err);
          // 404 simply means the contact does not exist in Brevo.
          if (!message.includes("404")) {
            console.error(`Location backfill failed for ${row.email}: ${message}`);
            failed += 1;
          }
          if (message.includes("429")) await sleep(2000);
        }
        await sleep(120);
      }

      return json({
        processed: rows.length,
        updated,
        failed,
        hasMore: rows.length === limit,
        nextOffset: offset + rows.length,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("brevo-sync error:", message);
    return json({ error: message }, 500);
  }
});
