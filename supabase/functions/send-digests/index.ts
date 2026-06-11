// Supabase Edge Function — sends streak-at-risk emails via Resend.
//
// Scheduled hourly by pg_cron. The SQL function `list_pending_digests` picks
// only the right people at the right hour, so this just loops, sends, and
// marks each as sent. Failures don't mark sent so they'll retry next hour.
//
// Required secrets (set via `supabase secrets set NAME=value`):
//   RESEND_API_KEY    — your Resend API key
//   DIGEST_FROM       — e.g. "LC Tracker <noreply@lc-tracker.com>"
//   APP_URL           — e.g. "https://lc-tracker.com"
//
// Supabase auto-injects: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface PendingDigest {
  user_id: string
  email: string
  username: string
  streak_days: number
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('DIGEST_FROM') ?? 'LC Tracker <noreply@lc-tracker.com>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://lc-tracker.com'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function buildEmail(p: PendingDigest) {
  const subject = `your ${p.streak_days}-day streak dies tonight`
  const html = `
<!doctype html>
<html><body style="font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;background:#0b0e14;color:#c8d3f5;padding:32px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#0f131b;border:1px solid #1b2233;padding:28px;">
    <div style="color:#22d3ee;font-weight:700;letter-spacing:-0.02em;font-size:14px;">~/lc-tracker</div>
    <div style="color:#545c7e;font-size:11px;margin-top:4px;">spaced repetition</div>

    <div style="margin-top:28px;font-size:16px;color:#c8d3f5;">
      <span style="color:#22d3ee;">❯</span> hey ${p.username},
    </div>

    <p style="font-size:14px;line-height:1.6;color:#c8d3f5;margin-top:18px;">
      your <span style="color:#e0af68;font-weight:700;">${p.streak_days}-day streak</span> ends in a few hours unless you review one problem before midnight.
    </p>

    <p style="font-size:14px;line-height:1.6;color:#545c7e;margin-top:14px;">
      one review keeps it alive. easy problems still count.
    </p>

    <a href="${APP_URL}" style="display:inline-block;margin-top:22px;padding:10px 20px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.4);color:#22d3ee;text-decoration:none;font-size:13px;">
      open lc-tracker ↵
    </a>

    <div style="border-top:1px solid #1b2233;margin-top:32px;padding-top:14px;font-size:11px;color:#545c7e;">
      no longer want these? <a style="color:#545c7e;" href="${APP_URL}/settings">turn off in settings</a>
    </div>
  </div>
</body></html>`
  const text = `hey ${p.username},

your ${p.streak_days}-day streak ends in a few hours unless you review one problem before midnight.

one review keeps it alive. easy problems still count.

${APP_URL}

Turn off these emails at ${APP_URL}/settings`
  return { subject, html, text }
}

async function sendOne(p: PendingDigest): Promise<boolean> {
  const { subject, html, text } = buildEmail(p)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [p.email],
      subject,
      html,
      text,
    }),
  })
  if (!res.ok) {
    console.error('Resend failure', p.email, res.status, await res.text())
    return false
  }
  return true
}

Deno.serve(async () => {
  if (!RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not configured', { status: 500 })
  }

  const { data, error } = await supabase.rpc('list_pending_digests')
  if (error) {
    return new Response(`rpc error: ${error.message}`, { status: 500 })
  }
  const pending = (data ?? []) as PendingDigest[]

  let sent = 0
  let failed = 0
  for (const p of pending) {
    const ok = await sendOne(p)
    if (ok) {
      await supabase.rpc('mark_digest_sent', { uid: p.user_id })
      sent++
    } else {
      failed++
    }
  }

  return new Response(
    JSON.stringify({ checked: pending.length, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
