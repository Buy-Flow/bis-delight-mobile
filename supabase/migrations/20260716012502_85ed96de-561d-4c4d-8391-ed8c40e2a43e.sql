ALTER TABLE public.abandoned_carts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.abandoned_carts;