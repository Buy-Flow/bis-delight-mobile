
-- Roles
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- First signup becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.user_roles where role='admin') = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Timestamps helper
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- Categories
create table public.categories (
  id text primary key,
  name text not null,
  emoji text not null default '✨',
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public read categories" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger set_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- Products
create table public.products (
  id text primary key,
  name text not null,
  category text not null references public.categories(id) on update cascade,
  image_url text,
  description text not null default '',
  ingredients jsonb not null default '[]'::jsonb,
  base_price numeric(10,2) not null default 0,
  sizes jsonb not null default '[]'::jsonb,
  flavors jsonb,
  extras jsonb,
  removable jsonb,
  badge text,
  hero boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read active products" on public.products for select using (active = true);
create policy "admins read all products" on public.products for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "admins manage products" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger set_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create index products_category_idx on public.products(category);
create index products_hero_idx on public.products(hero) where hero = true;

-- Site settings (single row)
create table public.site_settings (
  id integer primary key default 1,
  name text not null default 'Quero Bis',
  tagline text not null default 'Sorveteria & Açaí',
  city text not null default '',
  address text not null default '',
  hours text not null default '',
  whatsapp text not null default '',
  whatsapp_display text not null default '',
  maps_url text not null default '',
  map_embed text not null default '',
  delivery_fee numeric(10,2) not null default 0,
  logo_url text,
  texture_url text,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "public read settings" on public.site_settings for select using (true);
create policy "admins manage settings" on public.site_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger set_site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
insert into public.site_settings (id) values (1);
