INSERT INTO public.categories (id, name, emoji, icon, sort_order, active)
VALUES ('monte-voce-mesmo', 'Monte Você Mesmo', '🧑‍🍳', 'ChefHat', 7, true)
ON CONFLICT (id) DO NOTHING;