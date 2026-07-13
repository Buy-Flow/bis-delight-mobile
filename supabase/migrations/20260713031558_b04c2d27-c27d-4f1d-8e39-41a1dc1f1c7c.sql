UPDATE public.whatsapp_messages
   SET status = 'sent'
 WHERE direction = 'out'
   AND status = 'pending'
   AND evolution_id IS NOT NULL;