UPDATE public.whatsapp_messages
   SET status = CASE
     WHEN status = 'delivery_ack' THEN 'delivered'
     WHEN status = 'played' THEN 'read'
     WHEN status = 'server_ack' THEN 'sent'
     WHEN status = 'error' THEN 'failed'
     ELSE status
   END
 WHERE status IN ('delivery_ack', 'played', 'server_ack', 'error');