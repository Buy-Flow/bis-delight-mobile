
create policy "user reads own deliveries"
on public.push_deliveries
for select to authenticated
using (
  exists (
    select 1 from public.push_subscriptions s
    where s.id = push_deliveries.subscription_id and s.user_id = auth.uid()
  )
);

create policy "user marks own delivery opened"
on public.push_deliveries
for update to authenticated
using (
  exists (
    select 1 from public.push_subscriptions s
    where s.id = push_deliveries.subscription_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.push_subscriptions s
    where s.id = push_deliveries.subscription_id and s.user_id = auth.uid()
  )
);

create policy "user reads campaigns of own deliveries"
on public.push_campaigns
for select to authenticated
using (
  exists (
    select 1 from public.push_deliveries d
    join public.push_subscriptions s on s.id = d.subscription_id
    where d.campaign_id = push_campaigns.id and s.user_id = auth.uid()
  )
);

grant select on public.push_deliveries to authenticated;
grant update (opened_at) on public.push_deliveries to authenticated;
grant select on public.push_campaigns to authenticated;
