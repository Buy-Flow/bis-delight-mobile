-- 0) has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 1) PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, phone text, address text, reference text, birthday date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) LOYALTY
CREATE TABLE public.loyalty (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stamps int NOT NULL DEFAULT 0,
  total_redeemed int NOT NULL DEFAULT 0,
  last_birthday_bonus text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty TO authenticated;
GRANT ALL ON public.loyalty TO service_role;
ALTER TABLE public.loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loyalty select" ON public.loyalty FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin read loyalty" ON public.loyalty FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER loyalty_updated_at BEFORE UPDATE ON public.loyalty FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('entrega','retirada')),
  customer_name text NOT NULL, phone text NOT NULL,
  address text, reference text, note text,
  subtotal numeric(10,2) NOT NULL,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','preparando','entregue','cancelado')),
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created_idx ON public.orders(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders select" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) ORDER_ITEMS (product_id = text para casar com products.id)
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text,
  name text NOT NULL,
  size text, flavor text,
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  removed jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  quantity int NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_product_idx ON public.order_items(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order items select" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "own order items insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "admin read order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5) FAVORITES (product_id = text)
CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites select" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own favorites insert" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favorites delete" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6) LOYALTY COUPONS
CREATE TABLE public.loyalty_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_coupons_user_idx ON public.loyalty_coupons(user_id, used_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_coupons TO authenticated;
GRANT ALL ON public.loyalty_coupons TO service_role;
ALTER TABLE public.loyalty_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coupons select" ON public.loyalty_coupons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin read coupons" ON public.loyalty_coupons FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7) handle_new_user extend
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_roles WHERE role='admin') = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  INSERT INTO public.profiles (id, full_name, phone) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.loyalty (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO public.loyalty (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;

-- 8) loyalty auto-stamp
CREATE OR REPLACE FUNCTION public.grant_loyalty_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_stamps int;
  bonus int := 0;
  this_month text := to_char(now(), 'YYYY-MM');
  bday date;
  last_bonus text;
  new_code text;
BEGIN
  IF NEW.total < 20 THEN RETURN NEW; END IF;
  INSERT INTO public.loyalty (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT birthday INTO bday FROM public.profiles WHERE id = NEW.user_id;
  SELECT last_birthday_bonus INTO last_bonus FROM public.loyalty WHERE user_id = NEW.user_id;
  IF bday IS NOT NULL
     AND to_char(bday, 'MM') = to_char(now(), 'MM')
     AND (last_bonus IS NULL OR last_bonus <> this_month) THEN
    bonus := 1;
    UPDATE public.loyalty SET last_birthday_bonus = this_month WHERE user_id = NEW.user_id;
  END IF;
  UPDATE public.loyalty SET stamps = stamps + 1 + bonus
  WHERE user_id = NEW.user_id RETURNING stamps INTO current_stamps;
  WHILE current_stamps >= 10 LOOP
    new_code := 'BIS-' || upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 8));
    INSERT INTO public.loyalty_coupons (user_id, code) VALUES (NEW.user_id, new_code);
    UPDATE public.loyalty SET stamps = stamps - 10, total_redeemed = total_redeemed + 1
    WHERE user_id = NEW.user_id RETURNING stamps INTO current_stamps;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER orders_grant_loyalty AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.grant_loyalty_stamp();
