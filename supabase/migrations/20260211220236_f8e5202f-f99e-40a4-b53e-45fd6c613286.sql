
-- Add email column to staff_credentials for login lookup
ALTER TABLE public.staff_credentials ADD COLUMN IF NOT EXISTS email text;
