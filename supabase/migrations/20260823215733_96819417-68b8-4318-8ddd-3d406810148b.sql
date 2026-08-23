-- 1. Lead fields on customers
DO $$ BEGIN
  CREATE TYPE public.lead_stage AS ENUM ('none','new','contacted','qualified','proposal','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lead_stage public.lead_stage NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS lead_owner_id uuid,
  ADD COLUMN IF NOT EXISTS interested_tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_next_action_date date,
  ADD COLUMN IF NOT EXISTS lead_notes text,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_source text;

CREATE INDEX IF NOT EXISTS idx_customers_lead_stage ON public.customers(lead_stage) WHERE lead_stage <> 'none';

-- 2. Audiences
CREATE TABLE public.marketing_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_count integer,
  last_counted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_audiences TO authenticated;
GRANT ALL ON public.marketing_audiences TO service_role;
ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage audiences" ON public.marketing_audiences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Campaigns
CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preheader text,
  from_name text,
  from_email text,
  reply_to text,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  audience_id uuid REFERENCES public.marketing_audiences(id) ON DELETE SET NULL,
  audience_filters jsonb,
  editor_mode text NOT NULL DEFAULT 'blocks',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  html_body text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_send_at timestamptz,
  send_started_at timestamptz,
  send_completed_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  bounce_count integer NOT NULL DEFAULT 0,
  unsubscribe_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketing_campaigns TO authenticated;
GRANT DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read campaigns" ON public.marketing_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff write campaigns" ON public.marketing_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update campaigns" ON public.marketing_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete campaigns" ON public.marketing_campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 4. Recipients
CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
GRANT SELECT ON public.campaign_recipients TO authenticated;
GRANT ALL ON public.campaign_recipients TO service_role;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read recipients" ON public.campaign_recipients FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_msgid ON public.campaign_recipients(provider_message_id);

-- 5. Events
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  email text,
  event_type text NOT NULL,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaign_events TO authenticated;
GRANT ALL ON public.campaign_events TO service_role;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read campaign events" ON public.campaign_events FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON public.campaign_events(campaign_id, event_type);

-- 6. EDM templates
CREATE TABLE public.edm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  editor_mode text NOT NULL DEFAULT 'blocks',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  html_body text,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edm_templates TO authenticated;
GRANT ALL ON public.edm_templates TO service_role;
ALTER TABLE public.edm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage edm templates" ON public.edm_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Landing pages
CREATE TABLE public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  headline text,
  subheadline text,
  body_html text,
  hero_image_url text,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent_text text,
  thank_you_message text,
  lead_source text,
  lead_owner_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  submission_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.landing_pages TO authenticated;
GRANT DELETE ON public.landing_pages TO authenticated;
GRANT ALL ON public.landing_pages TO service_role;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read landing pages" ON public.landing_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert landing pages" ON public.landing_pages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update landing pages" ON public.landing_pages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete landing pages" ON public.landing_pages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 8. Submissions
CREATE TABLE public.landing_page_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_name text,
  last_name text,
  email text,
  phone text,
  state text,
  message text,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  consent_given boolean NOT NULL DEFAULT false,
  consent_text text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_page_submissions TO authenticated;
GRANT ALL ON public.landing_page_submissions TO service_role;
ALTER TABLE public.landing_page_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read submissions" ON public.landing_page_submissions FOR SELECT TO authenticated USING (true);

-- 9. Automation rules + log
CREATE TABLE public.marketing_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketing_automation_rules TO authenticated;
GRANT DELETE ON public.marketing_automation_rules TO authenticated;
GRANT ALL ON public.marketing_automation_rules TO service_role;
ALTER TABLE public.marketing_automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read rules" ON public.marketing_automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert rules" ON public.marketing_automation_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update rules" ON public.marketing_automation_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete rules" ON public.marketing_automation_rules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.marketing_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.marketing_automation_rules(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.landing_page_submissions(id) ON DELETE SET NULL,
  action_summary text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketing_automation_log TO authenticated;
GRANT ALL ON public.marketing_automation_log TO service_role;
ALTER TABLE public.marketing_automation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read automation log" ON public.marketing_automation_log FOR SELECT TO authenticated USING (true);

-- 10. Marketing preferences (public preference centre, token-based)
CREATE TABLE public.marketing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  subscribed boolean NOT NULL DEFAULT true,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketing_preferences TO authenticated;
GRANT ALL ON public.marketing_preferences TO service_role;
ALTER TABLE public.marketing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read preferences" ON public.marketing_preferences FOR SELECT TO authenticated USING (true);

-- 11. updated_at triggers
CREATE TRIGGER trg_marketing_audiences_updated BEFORE UPDATE ON public.marketing_audiences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketing_campaigns_updated BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_edm_templates_updated BEFORE UPDATE ON public.edm_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_landing_pages_updated BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketing_rules_updated BEFORE UPDATE ON public.marketing_automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketing_prefs_updated BEFORE UPDATE ON public.marketing_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();