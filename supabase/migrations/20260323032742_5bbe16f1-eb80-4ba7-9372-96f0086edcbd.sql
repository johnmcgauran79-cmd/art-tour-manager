
-- Add email header image URL to general_settings
INSERT INTO public.general_settings (setting_key, setting_value, description)
VALUES ('email_header_image_url', '"https://art-tour-manager.lovable.app/images/email-header-default.png"', 'Default header image URL used in email templates')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now();

-- Add header_image_url column to email_templates for per-template overrides
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS header_image_url text DEFAULT NULL;

-- Create email-assets storage bucket for uploaded header images
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to email-assets
CREATE POLICY "Authenticated users can upload email assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets');

-- Allow anyone to read email assets (needed for email rendering)
CREATE POLICY "Public read access for email assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'email-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete email assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-assets');
