-- Weekly leaderboard rounds: points reset every Monday 00:00 UTC.
-- weekly_points / reviews_this_week now count from the start of the current
-- ISO week instead of a rolling 7-day window. prev_week_points lets the
-- client crown last week's winner.

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
  week_start date := date_trunc('week', (now() at time zone 'utc'))::date;
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
