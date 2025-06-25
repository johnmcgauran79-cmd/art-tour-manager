
-- Add foreign key constraint between booking_comments and profiles
ALTER TABLE public.booking_comments 
ADD CONSTRAINT booking_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
