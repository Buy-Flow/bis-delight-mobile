
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.product_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  image_url text,
  base_price numeric NOT NULL DEFAULT 0,
  cost_price numeric,
  packaging_cost numeric,
  target_margin_pct numeric,
  ingredients jsonb DEFAULT '[]'::jsonb,
  sizes jsonb DEFAULT '[]'::jsonb,
  flavors jsonb DEFAULT '[]'::jsonb,
  extras jsonb DEFAULT '[]'::jsonb,
  removable jsonb DEFAULT '[]'::jsonb,
  option_groups jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT ARRAY[]::text[],
  is_official boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_templates TO authenticated;
GRANT ALL ON public.product_templates TO service_role;

ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates" ON public.product_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert templates" ON public.product_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update templates" ON public.product_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete templates" ON public.product_templates
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_product_templates_updated
  BEFORE UPDATE ON public.product_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_product_templates_category ON public.product_templates(category);
CREATE INDEX idx_product_templates_official ON public.product_templates(is_official);

INSERT INTO public.product_templates (name, description, category, base_price, cost_price, packaging_cost, target_margin_pct, tags, is_official) VALUES
('Açaí 300ml', 'Copo tradicional de açaí batido na hora, cremoso e refrescante. Ideal para clientes iniciantes.', 'Açaí', 14.90, 4.50, 0.80, 55, ARRAY['clássico','best-seller','sem lactose'], true),
('Açaí 500ml', 'Copo grande de açaí cremoso — porção familiar. Excelente margem por volume.', 'Açaí', 22.90, 7.20, 1.00, 55, ARRAY['clássico','família'], true),
('Açaí 700ml', 'Balde de açaí para dividir. Ticket médio elevado.', 'Açaí', 29.90, 9.80, 1.20, 55, ARRAY['família','compartilhar'], true),
('Tigela Fitness 500ml', 'Açaí + banana + granola + mel + morango. Foco em público fitness.', 'Tigelas', 26.90, 8.90, 1.50, 55, ARRAY['fit','saudável','proteico'], true),
('Tigela Power Whey', 'Açaí zero + whey protein + pasta de amendoim + banana. Alto valor agregado.', 'Tigelas', 32.90, 11.50, 1.50, 58, ARRAY['fit','proteico','premium'], true),
('Milkshake Ovomaltine 500ml', 'Milkshake cremoso com flocos crocantes de Ovomaltine. Campeão de pedidos.', 'Milkshakes', 18.90, 5.80, 0.80, 55, ARRAY['doce','best-seller'], true),
('Milkshake Nutella 500ml', 'Sorvete batido com Nutella cremosa e calda de chocolate.', 'Milkshakes', 22.90, 8.20, 0.80, 55, ARRAY['doce','premium'], true),
('Casquinha Tradicional', 'Sorvete em casquinha crocante — sabor à escolha. Perfeito para upsell.', 'Sorvetes', 6.90, 1.60, 0.20, 65, ARRAY['upsell','clássico'], true),
('Sundae Chocolate', 'Sorvete cremoso com calda quente de chocolate e amendoim.', 'Sorvetes', 12.90, 3.80, 0.60, 60, ARRAY['clássico','doce'], true),
('Combo Casal — 2x 500ml', 'Duas tigelas de açaí 500ml com desconto. Aumenta o ticket médio.', 'Combos', 39.90, 15.00, 2.00, 50, ARRAY['combo','promoção','família'], true),
('Combo Família — Balde + 3 Casquinhas', 'Balde 700ml + 3 casquinhas tradicionais. Alto ticket, entrega otimizada.', 'Combos', 44.90, 15.80, 2.00, 55, ARRAY['combo','família'], true),
('Sanduíche de Sorvete', 'Duas bolachas com sorvete no meio e granulado nas bordas.', 'Sorvetes', 9.90, 2.90, 0.40, 60, ARRAY['novidade','doce'], true),
('Açaí Zero 500ml', 'Versão sem açúcar do açaí tradicional. Público diet/fit.', 'Açaí', 24.90, 8.20, 1.00, 58, ARRAY['fit','zero','sem açúcar'], true),
('Copo Kids 200ml', 'Porção infantil com granulado, leite condensado e frutas.', 'Açaí', 9.90, 3.10, 0.60, 55, ARRAY['kids','infantil'], true),
('Brownie com Sorvete', 'Brownie quente + bola de sorvete + calda. Sobremesa premium.', 'Sobremesas', 16.90, 5.20, 0.80, 60, ARRAY['premium','doce'], true);
