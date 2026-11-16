-- Amorim Beauty · esquema Postgres para Neon
-- Execute no SQL Editor do Neon antes do primeiro deploy.

create extension if not exists pgcrypto;

-- Conta da administração. Nenhuma linha é criada pelo seed:
-- a primeira conta é cadastrada na tela de "Primeiro acesso" (POST /api/setup).
-- A senha nunca é gravada em texto puro (bcrypt via pgcrypto).
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Valores importados de valores.xlsx (em centavos).
-- repeat_price_cents: valor a partir da 2ª sessão (para Hidra Gloss).
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Outros',
  duration_min integer not null check (duration_min > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  repeat_price_cents integer check (repeat_price_cents >= 0),
  first_session_rule boolean not null default false,
  active boolean not null default true
);

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'Profissional',
  color text not null default 'rose',
  phone text not null default '',
  active boolean not null default true,
  hours jsonb not null default '{}'::jsonb
);

-- Vagas liberadas pela administração. Não têm serviço fixo:
-- a cliente escolhe qualquer serviço ativo ao reservar.
create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  appt_date date not null,
  start_time time not null,
  duration_min integer not null default 60 check (duration_min > 0),
  professional_id uuid not null references professionals(id) on delete restrict,
  status text not null default 'livre'
    check (status in ('livre', 'reservado')),
  appointment_id uuid,
  created_at timestamptz not null default now(),
  unique (professional_id, appt_date, start_time)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  service_id uuid references services(id) on delete set null,
  service_name text,
  professional_id uuid not null references professionals(id) on delete restrict,
  appt_date date not null,
  start_time time not null,
  duration_min integer not null check (duration_min > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  status text not null default 'agendado'
    check (status in ('agendado', 'confirmado', 'concluido', 'faltou', 'cancelado')),
  is_fit_in boolean not null default false,
  notes text not null default '',
  slot_id uuid references slots(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists appointments_date_idx on appointments (appt_date);
create index if not exists appointments_prof_idx on appointments (professional_id, appt_date, start_time);
create index if not exists appointments_client_idx on appointments (client_id, appt_date);
create index if not exists slots_date_idx on slots (appt_date, status);
