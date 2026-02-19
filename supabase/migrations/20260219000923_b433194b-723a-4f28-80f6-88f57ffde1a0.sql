
-- Create storage bucket for shop logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for shop logos
CREATE POLICY "Anyone can view shop logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-logos');

CREATE POLICY "Shop owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'shop-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Shop owners can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'shop-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Shop owners can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'shop-logos' AND auth.uid() IS NOT NULL);

-- Function to check super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Super admin RLS policies for shops
CREATE POLICY "Super admin can view all shops"
ON public.shops FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update all shops"
ON public.shops FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can delete shops"
ON public.shops FOR DELETE
USING (is_super_admin(auth.uid()));

-- Super admin can view all sales
CREATE POLICY "Super admin can view all sales"
ON public.sales FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admin can view all products
CREATE POLICY "Super admin can view all products"
ON public.products FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update all products"
ON public.products FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can delete all products"
ON public.products FOR DELETE
USING (is_super_admin(auth.uid()));

-- Super admin can view all customers
CREATE POLICY "Super admin can view all customers"
ON public.customers FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can delete customers"
ON public.customers FOR DELETE
USING (is_super_admin(auth.uid()));

-- Super admin can view all loans
CREATE POLICY "Super admin can view all loans"
ON public.loans FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update all loans"
ON public.loans FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can delete loans"
ON public.loans FOR DELETE
USING (is_super_admin(auth.uid()));

-- Super admin can view all loan payments
CREATE POLICY "Super admin can view all loan payments"
ON public.loan_payments FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admin can view and manage all user roles
CREATE POLICY "Super admin can view all user roles"
ON public.user_roles FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage all user roles"
ON public.user_roles FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Super admin can view all profiles
CREATE POLICY "Super admin can view all profiles"
ON public.profiles FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admin can view all staff credentials
CREATE POLICY "Super admin can view all staff credentials"
ON public.staff_credentials FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage staff credentials"
ON public.staff_credentials FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Super admin can view all sale items
CREATE POLICY "Super admin can view all sale items"
ON public.sale_items FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admin can view all stock movements
CREATE POLICY "Super admin can view all stock movements"
ON public.stock_movements FOR SELECT
USING (is_super_admin(auth.uid()));
