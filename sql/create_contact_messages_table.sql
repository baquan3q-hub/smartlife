-- Create contact_messages table for storing public contact form submissions
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow any unauthenticated user to insert messages (public form submissions)
CREATE POLICY "Allow public insert to contact_messages" 
ON public.contact_messages 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow admins (or authenticated users, depending on requirement) to view messages
-- For safety, only authenticated users or admin users can read them. Here we allow authenticated users:
CREATE POLICY "Allow authenticated users to read contact_messages" 
ON public.contact_messages 
FOR SELECT 
USING (auth.role() = 'authenticated');
