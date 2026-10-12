-- Pausen-Timer für Push-Mitteilungen am Pausenende.
-- Nur die Server-Funktion (service role) liest und schreibt; für die App gibt es keinen direkten Zugriff.
create table if not exists public.rest_timers (
  device     text primary key,
  job        uuid not null,
  ends_at    timestamptz not null,
  sub        jsonb not null,
  title      text,
  body       text,
  created_at timestamptz not null default now()
);

alter table public.rest_timers enable row level security;
-- Bewusst keine Policies: anon/authenticated haben damit keinen Zugriff.
