UPDATE public.whatsapp_messages
   SET status = 'sent'
 WHERE direction = 'out'
   AND status = 'pending'
   AND created_at < now() - interval '2 minutes'
   AND evolution_id IS NOT NULL;