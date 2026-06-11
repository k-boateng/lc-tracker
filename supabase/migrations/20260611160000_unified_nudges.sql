-- Unified daily nudge: one email per user per day, max. Triggers merged:
-- streak at risk, rank drops since yesterday's snapshot, invites accepted.

create table if not exists public.rank_snapshots (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Service-role only: RLS on, no policies
alter table public.rank_snapshots enable row level security;

-- Superseded by list_pending_nudges
drop function if exists public.list_pending_digests();

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
  week_start date := date_trunc('week', (now() at time zone 'utc'))::date;
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
      and (p.last_digest_sent_at is null or p.last_digest_sent_at::date < current_date)
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
    -- streak at risk: last reviewed exactly yesterday
    case when e.last_review_date = current_date - 1 then
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
    -- rank drops vs snapshot
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
    -- invites accepted since last notice (or last 24h)
    coalesce((
      select jsonb_agg(jsonb_build_object('username', jp.username, 'group_name', g2.name))
      from public.invites i
      join public.profiles jp on jp.id = i.joined_user_id
      join public.groups g2 on g2.id = i.group_id
      where i.inviter_id = e.id
        and i.joined_at is not null
        and i.joined_at >= coalesce(e.last_digest_sent_at, now() - interval '1 day')
    ), '[]'::jsonb),
    -- current ranks for snapshot upsert
    coalesce((
      select jsonb_agg(jsonb_build_object('group_id', rn2.group_id, 'rank', rn2.rnk))
      from ranked rn2 where rn2.uid = e.id
    ), '[]'::jsonb)
  from eligible e;
end;
$$;
