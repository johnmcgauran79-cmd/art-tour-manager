-- Make storage buckets private (only authenticated users can access)

-- Update attachments bucket to be private
UPDATE storage.buckets SET public = false WHERE id = 'attachments';

-- Update contact-avatars bucket to be private
UPDATE storage.buckets SET public = false WHERE id = 'contact-avatars';

-- Drop the public access policy for attachments
DROP POLICY IF EXISTS "Allow users to view all files" ON storage.objects;

-- Drop the public access policy for contact-avatars
DROP POLICY IF EXISTS "Contact avatars are publicly accessible" ON storage.objects;

-- Create new policy that requires authentication for viewing attachments
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

-- Create new policy that requires authentication for viewing contact-avatars
CREATE POLICY "Authenticated users can view contact avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'contact-avatars');