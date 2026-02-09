-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create site_settings table for dynamic website content management
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, key)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Only shop owners can manage settings
CREATE POLICY "Shop owners manage site settings"
  ON public.site_settings
  FOR ALL
  USING (is_shop_owner(auth.uid(), shop_id))
  WITH CHECK (is_shop_owner(auth.uid(), shop_id));

-- Users in shop can view settings
CREATE POLICY "Users view site settings"
  ON public.site_settings
  FOR SELECT
  USING (shop_id IN (SELECT get_user_shops(auth.uid())));

-- Create index
CREATE INDEX idx_site_settings_shop_key ON public.site_settings(shop_id, key);

-- Add trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();