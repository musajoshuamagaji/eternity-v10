-- Run this whole file in Supabase Dashboard > SQL Editor > New query.
-- The service-role key is used only by Vercel server functions. Never put it in browser code.

create extension if not exists pgcrypto;

create table if not exists public.access_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false,
  is_owner boolean not null default false,
  created_by_key_id uuid references public.access_keys(id) on delete set null
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  event_type text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists access_keys_created_at_idx on public.access_keys(created_at desc);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

alter table public.access_keys enable row level security;
alter table public.activity_logs enable row level security;

-- No anon/authenticated policies are intentionally created. Browser clients cannot read or change these tables.
-- Vercel API routes use SUPABASE_SERVICE_ROLE_KEY server-side.
