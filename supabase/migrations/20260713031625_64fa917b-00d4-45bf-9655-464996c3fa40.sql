UPDATE public.whatsapp_messages
   SET status = 'sent'
 WHERE direction = 'out'
   AND status IN ('pending', 'server_ack')
   AND evolution_id IS NOT NULL;