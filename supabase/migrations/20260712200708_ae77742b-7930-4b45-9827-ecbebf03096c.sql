
ALTER TABLE public.site_popups
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'weekly';

-- Backfill based on current configuration
UPDATE public.site_popups
SET kind = CASE
  WHEN starts_at IS NOT NULL AND ends_at IS NOT NULL
       AND (ends_at::date - starts_at::date) <= 1 THEN 'today'
  WHEN active = false AND (days_of_week IS NULL OR array_length(days_of_week, 1) IS NULL)
       AND starts_at IS NULL AND ends_at IS NULL THEN 'template'
  ELSE 'weekly'
END;

ALTER TABLE public.site_popups
  ADD CONSTRAINT site_popups_kind_check CHECK (kind IN ('today','weekly','template'));

CREATE INDEX IF NOT EXISTS site_popups_kind_active_idx ON public.site_popups(kind, active);
