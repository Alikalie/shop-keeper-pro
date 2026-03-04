
-- Table to track overpayments / change owed by shop to customer
CREATE TABLE public.overpayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  receipt_id text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.overpayments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users view overpayments in accessible shops"
  ON public.overpayments FOR SELECT TO authenticated
  USING (shop_id IN (SELECT get_user_shops(auth.uid())));

CREATE POLICY "Users create overpayments in accessible shops"
  ON public.overpayments FOR INSERT TO authenticated
  WITH CHECK (shop_id IN (SELECT get_user_shops(auth.uid())));

CREATE POLICY "Shop owners update overpayments"
  ON public.overpayments FOR UPDATE TO authenticated
  USING (is_shop_owner(auth.uid(), shop_id))
  WITH CHECK (is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Shop owners delete overpayments"
  ON public.overpayments FOR DELETE TO authenticated
  USING (is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Super admin view all overpayments"
  ON public.overpayments FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));
