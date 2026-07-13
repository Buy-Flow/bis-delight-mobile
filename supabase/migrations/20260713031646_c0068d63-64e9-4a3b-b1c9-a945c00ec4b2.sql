UPDATE public.whatsapp_messages
   SET status = CASE
     WHEN status IN ('delivery_ack') THEN 'delivered'
     WHEN status IN ('read', 'played') THEN 'read'
     WHEN status IN ('error') THEN 'failed'
     WHEN status IN ('pending', 'server_ack') AND evolution_id IS NOT NULL THEN 'sent'
     ELSE status
   END,
       read_at = CASE
         WHEN status IN ('read', 'played') AND read_at IS NULL THEN now()
         ELSE read_at
       END
 WHERE direction = 'out'
   AND status IN ('pending', 'server_ack', 'delivery_ack', 'played', 'error')
   AND evolution_id IS NOT NULL;