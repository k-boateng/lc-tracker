-- Move all day/week windows from UTC to the app timezone (America/New_York)
-- so streaks, weekly rounds, and points line up with users' local days.
-- Keep this 'America/New_York' literal in sync with APP_TZ in src/utils/dates.ts.

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
  today_local date := (now() at time zone 'America/New_York')::date;
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
       where r.user_id = p.id and r.date >= today_local - 90),
      '{}'::date[]
    )
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = gid;
end;
$$;

drop function if exists public.list_pending_nudges();
create function public.list_pending_nudges()
returns table (
  user_id uuid,
  email text,
  username text,
  streak_days int,
  rank_drops jsonb,
  invites_accepted jsonb,
  current_ranks jsonb
)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  week_start date := date_trunc('week', (now() at time zone 'America/New_York'))::date;
  today_local date := (now() at time zone 'America/New_York')::date;
begin
  return query
  with eligible as (
    select p.id, p.username as uname, u.email::text as em, p.last_digest_sent_at,
      coalesce(
        (select max(r.date) from public.reviews r where r.user_id = p.id),
        '1970-01-01'::date
      ) as last_review_date
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.email_digest_enabled = true
      and u.email is not null
      and (p.last_digest_sent_at is null
           or (p.last_digest_sent_at at time zone 'America/New_York')::date < today_local)
  ),
  member_points as (
    select gm.group_id, gm.user_id as uid,
      (select coalesce(sum(x.pts), 0)::int + 5 * count(distinct x.date)
       from (
         select distinct r.problem_id, r.date,
           case pr.difficulty when 'Easy' then 10 when 'Medium' then 20 else 30 end as pts
         from public.reviews r
         join public.problems pr on pr.id = r.problem_id
         where r.user_id = gm.user_id and r.date >= week_start
       ) x) as pts
    from public.group_members gm
    where gm.group_id in (
      select gm2.group_id from public.group_members gm2
      join eligible e on e.id = gm2.user_id
    )
  ),
  ranked as (
    select mp.group_id, mp.uid, mp.pts,
      rank() over (partition by mp.group_id order by mp.pts desc) as rnk
    from member_points mp
  )
  select
    e.id,
    e.em,
    e.uname,
    case when e.last_review_date = today_local - 1 then
      coalesce((
        select count(*)::int from (
          select r.date,
            r.date - (row_number() over (order by r.date))::int * interval '1 day' as grp
          from (select distinct rr.date from public.reviews rr where rr.user_id = e.id) r
        ) g
        where g.date <= e.last_review_date
        group by g.grp
        order by max(g.date) desc
        limit 1
      ), 0)
    else 0 end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'group_name', g.name,
        'rank', rn.rnk,
        'prev_rank', s.rank,
        'gap_pts', greatest(0, coalesce(ahead.pts, rn.pts) - rn.pts),
        'ahead_username', coalesce(ap.username, '')
      ))
      from ranked rn
      join public.rank_snapshots s on s.group_id = rn.group_id and s.user_id = rn.uid
      join public.groups g on g.id = rn.group_id
      left join lateral (
        select r2.uid, r2.pts from ranked r2
        where r2.group_id = rn.group_id and r2.rnk < rn.rnk
        order by r2.rnk desc limit 1
      ) ahead on true
      left join public.profiles ap on ap.id = ahead.uid
      where rn.uid = e.id and rn.rnk > s.rank
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('username', jp.username, 'group_name', g2.name))
      from public.invites i
      join public.profiles jp on jp.id = i.joined_user_id
      join public.groups g2 on g2.id = i.group_id
      where i.inviter_id = e.id
        and i.joined_at is not null
        and i.joined_at >= coalesce(e.last_digest_sent_at, now() - interval '1 day')
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('group_id', rn2.group_id, 'rank', rn2.rnk))
      from ranked rn2 where rn2.uid = e.id
    ), '[]'::jsonb)
  from eligible e;
end;
$$;
