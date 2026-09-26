-- Esquema Supabase para "Viaje a España"
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query > Run

create table if not exists public.trip_items (
  id uuid primary key,
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_items_collection_idx on public.trip_items (collection);

alter table public.trip_items enable row level security;

-- Todos los usuarios autenticados comparten el mismo viaje.
drop policy if exists "trip_items_select" on public.trip_items;
create policy "trip_items_select" on public.trip_items
  for select to authenticated using (true);

drop policy if exists "trip_items_insert" on public.trip_items;
create policy "trip_items_insert" on public.trip_items
  for insert to authenticated with check (true);

drop policy if exists "trip_items_update" on public.trip_items;
create policy "trip_items_update" on public.trip_items
  for update to authenticated using (true) with check (true);

drop policy if exists "trip_items_delete" on public.trip_items;
create policy "trip_items_delete" on public.trip_items
  for delete to authenticated using (true);

-- Nota: NO se usa trigger de updated_at a propósito.
-- La app controla "updated_at" para resolver conflictos (gana el último cambio).

-- ============================================================
-- Almacenamiento de entradas (PDF, .pkpass, imágenes)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('entradas', 'entradas', false)
on conflict (id) do nothing;

drop policy if exists "entradas_select" on storage.objects;
create policy "entradas_select" on storage.objects
  for select to authenticated using (bucket_id = 'entradas');

drop policy if exists "entradas_insert" on storage.objects;
create policy "entradas_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'entradas');

drop policy if exists "entradas_update" on storage.objects;
create policy "entradas_update" on storage.objects
  for update to authenticated using (bucket_id = 'entradas');

drop policy if exists "entradas_delete" on storage.objects;
create policy "entradas_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'entradas');

