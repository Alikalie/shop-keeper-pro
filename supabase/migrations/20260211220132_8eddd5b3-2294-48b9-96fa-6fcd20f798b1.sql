
-- Add plan_type and staff_limit to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'personal';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS staff_limit integer NOT NULL DEFAULT 5;

-- Create staff_credentials table for username-based login
CREATE TABLE public.staff_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(username)
);

ALTER TABLE public.staff_credentials ENABLE ROW LEVEL SECURITY;

-- Shop owners manage staff credentials
CREATE POLICY "Shop owners manage staff credentials"
ON public.staff_credentials FOR ALL
USING (is_shop_owner(auth.uid(), shop_id))
WITH CHECK (is_shop_owner(auth.uid(), shop_id));

-- Staff can view their own credentials
CREATE POLICY "Staff view own credentials"
ON public.staff_credentials FOR SELECT
USING (user_id = auth.uid());

-- Allow anyone to look up username for login (read-only, just username -> user mapping)
CREATE POLICY "Anyone can lookup username"
ON public.staff_credentials FOR SELECT
USING (true);
