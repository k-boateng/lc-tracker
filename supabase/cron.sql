-- Run AFTER deploying the send-digests Edge Function.
-- This wires pg_cron to hit it hourly. The function itself filters which
-- users actually get an email (timezone, streak-at-risk, no dupes).

-- 1. Enable the extensions (idempotent)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- 2. Replace these with your own Supabase project values before running.
--    Project ref is the first part of your URL (e.g. abcd1234 from
--    abcd1234.supabase.co). Get the service_role key from Dashboard ->
--    Project Settings -> API -> service_role (KEEP THIS SECRET).

-- 3. Schedule it. The job posts to the Edge Function URL with the
--    service_role key so the function runs with full DB access.

select cron.schedule(
  'send-streak-digests-hourly',
  '0 * * * *',  -- top of every hour, UTC
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-digests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    )
  );
  $$
);

-- To inspect scheduled jobs:
--   select * from cron.job;
-- To remove the schedule:
--   select cron.unschedule('send-streak-digests-hourly');
