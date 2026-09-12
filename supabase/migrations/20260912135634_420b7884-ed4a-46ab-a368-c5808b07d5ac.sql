REVOKE ALL ON FUNCTION public.dq_contact_issues() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dq_lead_issues() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dq_finance_issues() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dq_is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dq_contact_issues() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dq_lead_issues() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dq_finance_issues() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dq_is_staff() TO authenticated, service_role;