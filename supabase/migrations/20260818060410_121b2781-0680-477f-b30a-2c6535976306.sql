GRANT SELECT, UPDATE, DELETE ON public.website_change_requests TO authenticated;
GRANT ALL ON public.website_change_requests TO service_role;
GRANT SELECT ON public.website_change_events TO authenticated;
GRANT ALL ON public.website_change_events TO service_role;