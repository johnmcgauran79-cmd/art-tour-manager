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
  normaliseLocation,
  requireAdminOrManager,

  sleep,
} from "../_shared/crmMigration.ts";
import { normaliseStateCode } from "../_shared/auStates.ts";

const errorStatusFromMessage = (message: string) => {
  const match = message.match(/\[(\d{3})\]/);
  const status = match ? Number(match[1]) : 500;
  return status >= 400 && status < 600 ? status : 500;
};

const tagSlug = (name: string, listId: number) =>
  `${
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brevo-list"
  }-${listId}`;


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
      const norm = normaliseLocation(customer.state, customer.city, customer.country);

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

    // -- Audience alignment: Brevo lists -> ART tags, states, consent -------
    // `audience_lists` returns every Brevo list plus the ART tag it maps to.
    if (action === "audience_lists") {
      const lists: any[] = [];
      for (let offset = 0; ; offset += 50) {
        const res = await brevoRequest(`contacts/lists?limit=50&offset=${offset}`);
        const page = res?.lists ?? [];
        lists.push(...page);
        if (page.length < 50) break;
        await sleep(120);
      }

      const { data: tags } = await supabase
        .from("tags")
        .select("id, name, brevo_list_id")
        .not("brevo_list_id", "is", null);
      const byList = new Map<number, any>((tags ?? []).map((t: any) => [t.brevo_list_id, t]));

      return json({
        lists: lists
          .map((l: any) => ({
            id: l.id,
            name: l.name,
            folderId: l.folderId,
            subscribers: l.uniqueSubscribers ?? 0,
            tagId: byList.get(l.id)?.id ?? null,
            tagName: byList.get(l.id)?.name ?? null,
          }))
          .sort((a, b) => b.subscribers - a.subscribers),
      });
    }

    // Sync one page of one Brevo list. Preview mode writes nothing.
    if (action === "audience_sync_list") {
      const listId = Number(body?.listId);
      if (!listId) return json({ error: "listId is required" }, 400);
      const listName = String(body?.listName ?? `Brevo list ${listId}`).trim();
      const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 50);
      const offset = Math.max(Number(body?.offset) || 0, 0);
      const apply = body?.apply === true;
      const slug = tagSlug(listName, listId);

      const res = await brevoRequest(
        `contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}`,
      );
      const contacts: any[] = res?.contacts ?? [];

      // Resolve (or create) the ART tag for this list.
      let tagId: string | null = null;
      const { data: existingTag, error: existingTagErr } = await supabase
        .from("tags")
        .select("id")
        .eq("brevo_list_id", listId)
        .maybeSingle();
      if (existingTagErr) throw existingTagErr;
      if (existingTag) {
        tagId = existingTag.id;
      } else if (apply) {
        const { data: byName, error: byNameErr } = await supabase
          .from("tags")
          .select("id")
          .ilike("name", listName)
          .maybeSingle();
        if (byNameErr) throw byNameErr;
        if (byName) {
          const { error: tagLinkErr } = await supabase
            .from("tags")
            .update({ brevo_list_id: listId })
            .eq("id", byName.id);
          if (tagLinkErr) throw tagLinkErr;
          tagId = byName.id;
        } else {
          const { data: created, error: tagErr } = await supabase
            .from("tags")
            .insert({
              name: listName,
              slug,
              category: "Audience",
              brevo_list_id: listId,
            })
            .select("id")
            .single();
          if (tagErr) throw tagErr;
          tagId = created.id;
        }
      }

      const emails = contacts
        .map((c: any) => String(c?.email ?? "").trim().toLowerCase())
        .filter(Boolean);

      if (emails.length === 0) {
        return json({
          listId,
          listName,
          apply,
          tagId,
          processed: contacts.length,
          matched: 0,
          unmatched: 0,
          unmatchedSample: [],
          tagged: 0,
          statesFilled: 0,
          consentOff: 0,
          linked: 0,
          hasMore: contacts.length === limit,
          nextOffset: offset + contacts.length,
        });
      }

      const { data: matches, error: matchErr } = await supabase
        .from("customers")
        .select("id, email, state, brevo_contact_id, marketing_consent")
        .in("email", emails);
      if (matchErr) throw matchErr;
      const byEmail = new Map<string, any>(
        (matches ?? []).map((m: any) => [String(m.email).trim().toLowerCase(), m]),
      );

      let matched = 0;
      let unmatched = 0;
      let tagged = 0;
      let statesFilled = 0;
      let consentOff = 0;
      let linked = 0;
      const unmatchedSample: string[] = [];
      const tagRows: Array<{ customer_id: string; tag_id: string }> = [];
      const queuedTagRows = new Set<string>();

      for (const c of contacts) {
        const email = String(c?.email ?? "").trim().toLowerCase();
        if (!email) continue;
        const cust = byEmail.get(email);
        if (!cust) {
          unmatched += 1;
          if (unmatchedSample.length < 25) unmatchedSample.push(email);
          continue;
        }
        matched += 1;

        const attrs = c?.attributes ?? {};
        const blocked = c?.emailBlacklisted === true || c?.smsBlacklisted === true;
        const updates: Record<string, unknown> = {};

        if (!cust.state) {
          const code = normaliseStateCode(
            attrs.STATE ?? attrs.state ?? attrs.CITY ?? attrs.COUNTRY ?? null,
          );
          if (code) {
            updates.state = code;
            statesFilled += 1;
          }
        }
        if (blocked && cust.marketing_consent !== false) {
          updates.marketing_consent = false;
          updates.marketing_consent_source = "brevo_unsubscribed";
          consentOff += 1;
        }
        if (!cust.brevo_contact_id && c?.id) {
          updates.brevo_contact_id = String(c.id);
          linked += 1;
        }

        if (tagId && !queuedTagRows.has(cust.id)) {
          tagged += 1;
          queuedTagRows.add(cust.id);
          if (apply) tagRows.push({ customer_id: cust.id, tag_id: tagId });
        }

        if (apply) {
          if (Object.keys(updates).length) {
            updates.brevo_synced_at = new Date().toISOString();
            const { error: updateErr } = await supabase
              .from("customers")
              .update(updates)
              .eq("id", cust.id);
            if (updateErr) throw updateErr;
          }
        }
      }

      if (apply && tagRows.length > 0) {
        const { error: contactTagsErr } = await supabase
          .from("contact_tags")
          .upsert(tagRows, { onConflict: "customer_id,tag_id", ignoreDuplicates: true });
        if (contactTagsErr) throw contactTagsErr;
      }

      return json({
        listId,
        listName,
        apply,
        tagId,
        processed: contacts.length,
        matched,
        unmatched,
        unmatchedSample,
        tagged,
        statesFilled,
        consentOff,
        linked,
        hasMore: contacts.length === limit,
        nextOffset: offset + contacts.length,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);


  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("brevo-sync error:", message);
    return json({ error: message }, errorStatusFromMessage(message));
  }
});
