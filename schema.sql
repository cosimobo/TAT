create table if not exists people (
  id text primary key,
  name text not null
);

create table if not exists duties (
  date date primary key,
  person_id text not null references people(id)
);

create table if not exists swaps (
  id uuid primary key default gen_random_uuid(),
  from_person_id text not null references people(id),
  to_person_id text not null references people(id),
  date date not null references duties(date),
  status text not null check (status in ('pending','accepted','declined','cancelled')) default 'pending',
  created_at timestamptz not null default now()
);

-- Convenience: simple view of today's/tomorrow's assignees
create or replace view v_upcoming as
select
  d.date,
  d.person_id
from duties d
where d.date between current_date and current_date + interval '1 day'
order by d.date;
