-- Super admin can view all site settings
CREATE POLICY "Super admin can view all site settings"
ON public.site_settings FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admin can update all site settings
CREATE POLICY "Super admin can update all site settings"
ON public.site_settings FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Super admin can insert site settings
CREATE POLICY "Super admin can insert site settings"
ON public.site_settings FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- Super admin can delete site settings
CREATE POLICY "Super admin can delete site settings"
ON public.site_settings FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Add unique constraint on shop_id + key for upsert support
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_shop_id_key_unique UNIQUE (shop_id, key);