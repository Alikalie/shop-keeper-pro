-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'staff');

-- 2. User roles table (separate from auth for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, shop_id, role)
);

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Shops table (multi-tenant root)
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  receipt_footer TEXT,
  currency TEXT DEFAULT 'Le',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(shop_id, name)
);

-- 6. Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  buying_price DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2) NOT NULL,
  quantity_on_hand INT DEFAULT 0,
  low_stock_level INT DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(shop_id, sku)
);

-- 7. Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  outstanding_balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  total_amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'returned')),
  receipt_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. Sale items table
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. Stock movements table
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity INT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. Loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'part-paid', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. Loan payments table
CREATE TABLE public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  received_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- SECURITY LAYER: Enable RLS on all tables
-- =====================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY DEFINER FUNCTIONS (prevent RLS recursion)
-- =====================================================

-- Check if user has a role in a shop
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _shop_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND shop_id = _shop_id
      AND role = _role
  )
$$;

-- Check if user is shop owner
CREATE OR REPLACE FUNCTION public.is_shop_owner(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shops
    WHERE id = _shop_id
      AND owner_id = _user_id
  )
$$;

-- Get user's shops
CREATE OR REPLACE FUNCTION public.get_user_shops(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT shop_id FROM public.user_roles WHERE user_id = _user_id
  UNION
  SELECT id FROM public.shops WHERE owner_id = _user_id
$$;

-- =====================================================
-- RLS POLICIES: user_roles
-- =====================================================

CREATE POLICY "Users view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Shop owners manage staff roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_shop_owner(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

-- =====================================================
-- RLS POLICIES: profiles
-- =====================================================

CREATE POLICY "Users view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES: shops
-- =====================================================

CREATE POLICY "Shop owners view own shop"
  ON public.shops
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Shop staff view their shop"
  ON public.shops
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT shop_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Shop owners update own shop"
  ON public.shops
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Shop owners insert shop"
  ON public.shops
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- =====================================================
-- RLS POLICIES: categories
-- =====================================================

CREATE POLICY "Users view categories in accessible shops"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Shop owners manage categories"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Shop owners update categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.is_shop_owner(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Shop owners delete categories"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.is_shop_owner(auth.uid(), shop_id));

-- =====================================================
-- RLS POLICIES: products
-- =====================================================

CREATE POLICY "Users view products in accessible shops"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Shop owners manage products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Shop owners update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_shop_owner(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Shop owners delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_shop_owner(auth.uid(), shop_id));

-- =====================================================
-- RLS POLICIES: customers
-- =====================================================

CREATE POLICY "Users view customers in accessible shops"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Users create customers in accessible shops"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Users update customers in accessible shops"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())))
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

-- =====================================================
-- RLS POLICIES: sales
-- =====================================================

CREATE POLICY "Users view sales in accessible shops"
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Staff view own sales"
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Users create sales in accessible shops"
  ON public.sales
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Users update sales in accessible shops"
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())))
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

-- =====================================================
-- RLS POLICIES: sale_items
-- =====================================================

CREATE POLICY "Users view sale items in accessible sales"
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (sale_id IN (
    SELECT id FROM public.sales
    WHERE shop_id IN (SELECT * FROM public.get_user_shops(auth.uid()))
  ));

CREATE POLICY "Users insert sale items"
  ON public.sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (sale_id IN (
    SELECT id FROM public.sales
    WHERE shop_id IN (SELECT * FROM public.get_user_shops(auth.uid()))
  ));

-- =====================================================
-- RLS POLICIES: stock_movements
-- =====================================================

CREATE POLICY "Users view stock movements in accessible shops"
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Users create stock movements in accessible shops"
  ON public.stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

-- =====================================================
-- RLS POLICIES: loans
-- =====================================================

CREATE POLICY "Users view loans in accessible shops"
  ON public.loans
  FOR SELECT
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Users create loans in accessible shops"
  ON public.loans
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

CREATE POLICY "Users update loans in accessible shops"
  ON public.loans
  FOR UPDATE
  TO authenticated
  USING (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())))
  WITH CHECK (shop_id IN (SELECT * FROM public.get_user_shops(auth.uid())));

-- =====================================================
-- RLS POLICIES: loan_payments
-- =====================================================

CREATE POLICY "Users view loan payments in accessible loans"
  ON public.loan_payments
  FOR SELECT
  TO authenticated
  USING (loan_id IN (
    SELECT id FROM public.loans
    WHERE shop_id IN (SELECT * FROM public.get_user_shops(auth.uid()))
  ));

CREATE POLICY "Users create loan payments"
  ON public.loan_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (loan_id IN (
    SELECT id FROM public.loans
    WHERE shop_id IN (SELECT * FROM public.get_user_shops(auth.uid()))
  ));

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_shop_id ON public.user_roles(shop_id);
CREATE INDEX idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX idx_products_shop_id ON public.products(shop_id);
CREATE INDEX idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX idx_sales_shop_id ON public.sales(shop_id);
CREATE INDEX idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX idx_loans_shop_id ON public.loans(shop_id);
CREATE INDEX idx_loans_customer_id ON public.loans(customer_id);
CREATE INDEX idx_stock_movements_shop_id ON public.stock_movements(shop_id);
CREATE INDEX idx_categories_shop_id ON public.categories(shop_id);