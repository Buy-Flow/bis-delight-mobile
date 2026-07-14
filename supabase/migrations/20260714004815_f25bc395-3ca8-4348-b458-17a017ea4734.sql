
-- Singleton global controls
CREATE TABLE IF NOT EXISTS public.sound_alert_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  master_volume INT NOT NULL DEFAULT 80 CHECK (master_volume BETWEEN 0 AND 100),
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_start TIME NOT NULL DEFAULT '22:00',
  quiet_end TIME NOT NULL DEFAULT '07:00',
  late_after_minutes INT NOT NULL DEFAULT 30 CHECK (late_after_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sound_alert_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sound_alert_settings TO authenticated;
GRANT ALL ON public.sound_alert_settings TO service_role;

ALTER TABLE public.sound_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sound settings"
  ON public.sound_alert_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

INSERT INTO public.sound_alert_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Per-event alerts
CREATE TABLE IF NOT EXISTS public.sound_alerts (
  event_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  preset TEXT NOT NULL DEFAULT 'beep',
  waveform TEXT NOT NULL DEFAULT 'sine' CHECK (waveform IN ('sine','square','triangle','sawtooth')),
  frequency INT NOT NULL DEFAULT 880 CHECK (frequency BETWEEN 80 AND 8000),
  duration_ms INT NOT NULL DEFAULT 220 CHECK (duration_ms BETWEEN 40 AND 5000),
  repeats INT NOT NULL DEFAULT 2 CHECK (repeats BETWEEN 1 AND 10),
  interval_ms INT NOT NULL DEFAULT 180 CHECK (interval_ms BETWEEN 0 AND 3000),
  volume INT NOT NULL DEFAULT 90 CHECK (volume BETWEEN 0 AND 100),
  custom_url TEXT,
  speak_enabled BOOLEAN NOT NULL DEFAULT false,
  speak_text TEXT,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sound_alerts TO authenticated;
GRANT ALL ON public.sound_alerts TO service_role;

ALTER TABLE public.sound_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sound alerts"
  ON public.sound_alerts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_sound_alerts_updated
  BEFORE UPDATE ON public.sound_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_sound_alert_settings_updated
  BEFORE UPDATE ON public.sound_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (each event has distinctive sonic signature)
INSERT INTO public.sound_alerts (event_key, label, description, preset, waveform, frequency, duration_ms, repeats, interval_ms, volume, speak_text, sort_index) VALUES
  ('new_order','Novo pedido','Toca quando entra um pedido novo.','chime','sine',1046,260,3,150,95,'Novo pedido recebido',10),
  ('paid_order','Pagamento confirmado','Toca quando um pedido é pago.','ding','triangle',1568,180,2,120,85,'Pagamento confirmado',20),
  ('late_order','Pedido atrasado','Toca quando um pedido passa do tempo esperado.','alarm','square',440,320,4,200,100,'Atenção, pedido atrasado',30),
  ('cancelled_order','Pedido cancelado','Toca quando um pedido é cancelado.','buzz','sawtooth',220,500,2,220,90,'Pedido cancelado',40),
  ('dispatched_order','Saiu para entrega','Motoboy saiu com o pedido.','beep','sine',740,160,2,120,75,NULL,50),
  ('delivered_order','Pedido entregue','Entrega concluída.','ding','sine',1318,180,3,120,70,NULL,60),
  ('low_stock','Estoque baixo','Item do estoque abaixo do mínimo.','klaxon','square',330,260,3,140,85,'Estoque baixo',70),
  ('new_review','Nova avaliação','Cliente enviou uma avaliação.','chime','triangle',987,200,2,150,70,NULL,80)
ON CONFLICT (event_key) DO NOTHING;
