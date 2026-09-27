-- Глобальный реестр заданий «Уникум IQ».
-- Выполните этот скрипт в Supabase: SQL Editor → New query → Run.
--
-- Таблица хранит только отпечатки (128-битные хеши) выданных заданий.
-- Первичный ключ гарантирует, что одно и то же задание не достанется
-- двум людям: второй запрос на тот же отпечаток получит отказ, и сайт
-- сгенерирует вместо него новое задание.

create table if not exists public.iq_task_registry (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now()
);

-- Прямой доступ к таблице закрыт: политик нет, работать можно только
-- через функцию ниже.
alter table public.iq_task_registry enable row level security;

-- Пытается занять отпечатки. Возвращает те, что уже были заняты раньше.
create or replace function public.claim_iq_tasks(fingerprints text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  taken text[];
begin
  if fingerprints is null or coalesce(array_length(fingerprints, 1), 0) = 0 then
    return '{}';
  end if;
  if array_length(fingerprints, 1) > 100 then
    raise exception 'too many fingerprints';
  end if;

  with wanted as (
    select distinct f from unnest(fingerprints) as f where f ~ '^[0-9a-f]{32}$'
  ),
  inserted as (
    insert into iq_task_registry (fingerprint)
    select f from wanted
    on conflict (fingerprint) do nothing
    returning fingerprint
  )
  select coalesce(array_agg(w.f), '{}')
    into taken
    from wanted w
   where not exists (select 1 from inserted i where i.fingerprint = w.f);

  return taken;
end;
$$;

revoke all on function public.claim_iq_tasks(text[]) from public;
grant execute on function public.claim_iq_tasks(text[]) to anon, authenticated;
