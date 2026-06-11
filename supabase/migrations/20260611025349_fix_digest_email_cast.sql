-- Re-create digest functions with the email::text cast and qualified user_id.

alter table public.profiles add column if not exists email_digest_enabled boolean not null default true;
alter table public.profiles add column if not exists last_digest_sent_at timestamptz;

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
  where s.last_review_date = current_date - 1
    and coalesce(s.streak, 0) >= 1;
end;
$$;

drop function if exists public.mark_digest_sent(uuid);
create function public.mark_digest_sent(uid uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set last_digest_sent_at = now() where id = uid;
$$;
