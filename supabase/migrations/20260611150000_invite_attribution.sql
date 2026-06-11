-- Invite attribution: track who invited whom so inviters get credit.

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  joined_user_id uuid references public.profiles(id),
  joined_at timestamptz
);

create index if not exists invites_group_inviter_idx on public.invites(group_id, inviter_id);

alter table public.invites enable row level security;

-- Inviters see their own invites; all writes happen via service role / RPC
drop policy if exists "invites_inviter_select" on public.invites;
create policy "invites_inviter_select" on public.invites
  for select to authenticated using (inviter_id = auth.uid());

-- join_group v2: optional invite id marks the conversion.
-- Only attributes when the joiner is genuinely new to the group.
drop function if exists public.join_group(text);
create function public.join_group(code text, invite uuid default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  gid uuid;
  was_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select g.id into gid from public.groups g where g.invite_code = upper(trim(code));
  if gid is null then
    raise exception 'Invalid invite code';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  ) into was_member;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;

  if invite is not null and not was_member then
    update public.invites
      set joined_user_id = auth.uid(), joined_at = now()
      where id = invite and group_id = gid and joined_user_id is null;
  end if;

  return gid;
end;
$$;
