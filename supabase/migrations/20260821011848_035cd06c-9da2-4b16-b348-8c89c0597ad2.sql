ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_sent_by_fkey;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.automated_email_log DROP CONSTRAINT IF EXISTS automated_email_log_approved_by_fkey;
ALTER TABLE public.automated_email_log ADD CONSTRAINT automated_email_log_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tour_alerts DROP CONSTRAINT IF EXISTS tour_alerts_acknowledged_by_fkey;
ALTER TABLE public.tour_alerts ADD CONSTRAINT tour_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.automated_report_rules DROP CONSTRAINT IF EXISTS automated_report_rules_created_by_fkey;
ALTER TABLE public.automated_report_rules ADD CONSTRAINT automated_report_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tour_host_assignments DROP CONSTRAINT IF EXISTS tour_host_assignments_assigned_by_fkey;
ALTER TABLE public.tour_host_assignments ADD CONSTRAINT tour_host_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.wordpress_tour_links DROP CONSTRAINT IF EXISTS wordpress_tour_links_linked_by_fkey;
ALTER TABLE public.wordpress_tour_links ADD CONSTRAINT wordpress_tour_links_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES auth.users(id) ON DELETE SET NULL;