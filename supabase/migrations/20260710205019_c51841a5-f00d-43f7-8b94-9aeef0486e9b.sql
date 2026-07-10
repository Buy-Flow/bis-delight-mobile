
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cleanup-old-push-deliveries') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-push-deliveries');

SELECT cron.schedule(
  'cleanup-old-push-deliveries',
  '0 3 * * *',
  $$
  DELETE FROM public.push_deliveries WHERE created_at < now() - INTERVAL '15 days';
  DELETE FROM public.push_campaigns WHERE created_at < now() - INTERVAL '15 days' AND status IN ('sent','expired','failed');
  $$
);
