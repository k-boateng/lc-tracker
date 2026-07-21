-- Lets the login page show "you've been invited to join <name>" before auth.
-- Only exposes the group name, and only to someone who already holds the
-- invite code — same capability the code itself grants.
drop function if exists public.peek_group(text);
create function public.peek_group(code text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select g.name from public.groups g where g.invite_code = upper(trim(code));
$$;
