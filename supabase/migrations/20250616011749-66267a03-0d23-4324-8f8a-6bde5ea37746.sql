
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create profiles table to store user information
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile, admins can view all profiles
CREATE POLICY "Users can view own profile, admins view all" 
    ON public.profiles 
    FOR SELECT 
    USING (
        auth.uid() = id 
        OR public.has_role(auth.uid(), 'admin')
    );

-- Only admins can insert profiles (when creating users)
CREATE POLICY "Only admins can create profiles" 
    ON public.profiles 
    FOR INSERT 
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can update their own profile, admins can update any
CREATE POLICY "Users can update own profile, admins update any" 
    ON public.profiles 
    FOR UPDATE 
    USING (
        auth.uid() = id 
        OR public.has_role(auth.uid(), 'admin')
    );

-- Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles" 
    ON public.profiles 
    FOR DELETE 
    USING (public.has_role(auth.uid(), 'admin'));

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name'
    );
    RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
