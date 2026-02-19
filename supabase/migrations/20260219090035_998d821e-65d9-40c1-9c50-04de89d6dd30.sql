
-- Change xero_sync_log FK to SET NULL so deleting a customer keeps the sync log entry
-- (prevents re-import from Xero) but allows the customer record to be removed
ALTER TABLE public.xero_sync_log
  DROP CONSTRAINT xero_sync_log_customer_id_fkey,
  ADD CONSTRAINT xero_sync_log_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id)
    ON DELETE SET NULL;
