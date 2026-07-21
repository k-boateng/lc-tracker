-- LC Tracker schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Idempotent-ish: uses IF NOT EXISTS where possible; drop-and-recreate for policies/functions.

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- False until the user picks their own handle on first login
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Email digest preferences: opt-in by default, last-sent tracking prevents
-- duplicate sends from the cron job
alter table public.profiles add column if not exists email_digest_enabled boolean not null default true;
alter table public.profiles add column if not exists last_digest_sent_at timestamptz;

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  leetcode_number integer,
  url text,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  pattern text not null,
  subpattern text,
  source text not null check (source in ('LeetCode', 'Codeforces', 'Other')),
  date_added date not null default current_date,
  notes text,
  next_review date not null,
  interval_days integer not null default 0,
  ease_factor numeric(4,2) not null default 2.5
);

create index if not exists problems_user_id_idx on public.problems(user_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  comfort smallint not null check (comfort between 1 and 5),
  time_spent_minutes integer,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists reviews_problem_id_idx on public.reviews(problem_id);
create index if not exists reviews_user_id_date_idx on public.reviews(user_id, date);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ============================================================
-- PROFILE AUTO-CREATION (trigger on signup)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_name text;
  candidate text;
  n int := 0;
begin
  base_name := coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    'user'
  );
  -- lowercase, strip to alphanumeric + dashes
  base_name := lower(regexp_replace(base_name, '[^a-zA-Z0-9_-]', '', 'g'));
  if base_name = '' then base_name := 'user'; end if;

  candidate := base_name;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base_name || n::text;
  end loop;

  insert into public.profiles (id, username, avatar_url)
  values (new.id, candidate, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- HELPER: membership check (security definer avoids RLS recursion)
-- ============================================================

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.reviews enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- profiles: anyone authenticated can read usernames/avatars (needed for member lists);
-- only the owner can update their own row. Sensitive columns (email_digest_*)
-- aren't returned by our existing select queries which name specific cols.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());

-- problems: owner-only, all operations
drop policy if exists "problems_owner_all" on public.problems;
create policy "problems_owner_all" on public.problems
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- reviews: owner-only, all operations
drop policy if exists "reviews_owner_all" on public.reviews;
create policy "reviews_owner_all" on public.reviews
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- groups: members can see their groups; creation goes through create_group RPC
drop policy if exists "groups_member_select" on public.groups;
create policy "groups_member_select" on public.groups
  for select to authenticated using (public.is_group_member(id));

-- group_members: members of the same group can see the member list;
-- users can remove themselves (leave). Inserts only via RPCs.
drop policy if exists "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "group_members_leave" on public.group_members;
create policy "group_members_leave" on public.group_members
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- RPCS
-- ============================================================

-- Create a group with a random 6-char invite code; creator auto-joins.
create or replace function public.create_group(group_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer set search_path = public
as $$
declare
  code text;
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(group_name)) = 0 then
    raise exception 'Group name required';
  end if;

  loop
    -- 6 chars, unambiguous alphabet (no 0/O/1/I)
    code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random() * 31)::int + 1, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.groups g where g.invite_code = code);
  end loop;

  insert into public.groups (name, invite_code, created_by)
  values (trim(group_name), code, auth.uid())
  returning groups.id into gid;

  insert into public.group_members (group_id, user_id) values (gid, auth.uid());

  return query select g.id, g.name, g.invite_code from public.groups g where g.id = gid;
end;
$$;

-- Join a group by invite code. Returns the group id.
create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select g.id into gid from public.groups g where g.invite_code = upper(trim(code));
  if gid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;

  return gid;
end;
$$;

-- Leaderboard: aggregate stats only — never exposes problem/review contents.
-- Caller must be a member of the group.
--
-- Weekly rounds: points reset every Monday 00:00 UTC. Each problem scores
-- at most once per day (anti-gaming) at Easy 10 / Medium 20 / Hard 30,
-- plus a +5 consistency bonus per active day. weekly_points ranks the
-- board; prev_week_points lets the client crown last week's winner.
--
-- Drop first: return-type changes are rejected by CREATE OR REPLACE.
drop function if exists public.get_group_leaderboard(uuid);
create function public.get_group_leaderboard(gid uuid)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  total_problems bigint,
  total_reviews bigint,
  reviews_this_week bigint,
  weekly_points bigint,
  prev_week_points bigint,
  total_points bigint,
  review_dates date[]
)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  week_start date := date_trunc('week', (now() at time zone 'America/New_York'))::date;
begin
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this group';
  end if;

  return query
  select
    p.id,
    p.username,
    p.avatar_url,
    (select count(*) from public.problems pr where pr.user_id = p.id),
    (select count(*) from public.reviews r where r.user_id = p.id),
    (select count(*) from public.reviews r where r.user_id = p.id and r.date >= week_start),
    (select coalesce(sum(x.pts), 0)::bigint + 5 * count(distinct x.date)
     from (
       select distinct r.problem_id, r.date,
         case pr.difficulty when 'Easy' then 10 when 'Medium' then 20 else 30 end as pts
       from public.reviews r
       join public.problems pr on pr.id = r.problem_id
       where r.user_id = p.id and r.date >= week_start
     ) x),
    (select coalesce(sum(x.pts), 0)::bigint + 5 * count(distinct x.date)
     from (
       select distinct r.problem_id, r.date,
         case pr.difficulty when 'Easy' then 10 when 'Medium' then 20 else 30 end as pts
       from public.reviews r
       join public.problems pr on pr.id = r.problem_id
       where r.user_id = p.id and r.date >= week_start - 7 and r.date < week_start
     ) x),
    (select coalesce(sum(x.pts), 0)::bigint + 5 * count(distinct x.date)
     from (
       select distinct r.problem_id, r.date,
         case pr.difficulty when 'Easy' then 10 when 'Medium' then 20 else 30 end as pts
       from public.reviews r
       join public.problems pr on pr.id = r.problem_id
       where r.user_id = p.id
     ) x),
    coalesce(
      (select array_agg(distinct r.date order by r.date)
       from public.reviews r
       where r.user_id = p.id and r.date >= current_date - 90),
      '{}'::date[]
    )
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = gid;
end;
$$;

-- ============================================================
-- EMAIL DIGEST
-- ============================================================

-- Find users who should get a "your streak dies tonight" email right now.
-- Run hourly by pg_cron. The function returns people who:
--   * have an at-risk streak (last reviewed yesterday, ≥1 day streak)
--   * have email digests enabled and a confirmed email
--   * haven't already been emailed today
-- The Edge Function loops over them, sends, then writes last_digest_sent_at.
-- Cron handles timing; this function just filters on state.
drop function if exists public.list_pending_digests();
create function public.list_pending_digests()
returns table (
  user_id uuid,
  email text,
  username text,
  streak_days int
)
language plpgsql
security definer set search_path = public
stable
as $$
begin
  return query
  with active as (
    select p.id, p.username, u.email::text as email,
      coalesce(
        (select max(r.date) from public.reviews r where r.user_id = p.id),
        '1970-01-01'::date
      ) as last_review_date
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.email_digest_enabled = true
      and u.email is not null
      and (p.last_digest_sent_at is null or p.last_digest_sent_at::date < current_date)
  ),
  streaked as (
    select a.*,
      (
        select count(*)::int
        from (
          select r.date,
            r.date - (row_number() over (order by r.date))::int * interval '1 day' as grp
          from (select distinct rr.date from public.reviews rr where rr.user_id = a.id) r
        ) g
        where g.date <= a.last_review_date
        group by g.grp
        order by max(g.date) desc
        limit 1
      ) as streak
    from active a
  )
  select s.id, s.email, s.username, coalesce(s.streak, 0)
  from streaked s
  where s.last_review_date = current_date - 1   -- last reviewed yesterday
    and coalesce(s.streak, 0) >= 1;               -- has a streak worth saving
end;
$$;

-- Marks a user's digest as sent so the cron doesn't double-fire today.
-- Only the Edge Function (with service_role key) should call this.
drop function if exists public.mark_digest_sent(uuid);
create function public.mark_digest_sent(uid uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set last_digest_sent_at = now() where id = uid;
$$;
