-- Add avatar_url column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for contact avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-avatars', 'contact-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload contact avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contact-avatars');

-- Allow authenticated users to update their uploads
CREATE POLICY "Users can update contact avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'contact-avatars');

-- Allow authenticated users to delete avatars
CREATE POLICY "Users can delete contact avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'contact-avatars');

-- Allow public read access to avatars
CREATE POLICY "Contact avatars are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'contact-avatars');