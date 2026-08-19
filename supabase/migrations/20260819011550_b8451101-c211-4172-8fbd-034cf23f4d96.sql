GRANT EXECUTE ON FUNCTION public.calculate_nights(date, date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.calculate_nights(date, date) FROM anon;