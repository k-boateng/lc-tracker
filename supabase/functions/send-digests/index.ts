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
  // Subject deliberately calm — Gmail flags urgency/loss-aversion language
  const subject = `Keep your ${p.streak_days}-day streak going`
  // Table-based dark theme — Gmail strips <body> styles. bgcolor attrs and
  // inline styles on every cell are what actually render.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background:#0b0e14;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0e14" style="background:#0b0e14;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f131b" style="background:#0f131b;border:1px solid #1b2233;max-width:520px;">
      <tr><td style="padding:28px;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;">
        <div style="color:#22d3ee;font-weight:700;letter-spacing:-0.02em;font-size:14px;">~/lc-tracker</div>
        <div style="color:#545c7e;font-size:11px;margin-top:4px;">spaced repetition</div>

        <div style="margin-top:28px;font-size:16px;color:#c8d3f5;">
          <span style="color:#22d3ee;">&gt;</span> hey ${p.username},
        </div>

        <p style="font-size:14px;line-height:1.6;color:#c8d3f5;margin:18px 0 0;">
          Quick reminder &mdash; you have a <span style="color:#e0af68;font-weight:700;">${p.streak_days}-day streak</span> going. One review today keeps it rolling.
        </p>

        <p style="font-size:14px;line-height:1.6;color:#545c7e;margin:14px 0 0;">
          Easy problems still count. It only takes a few minutes.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
          <tr><td bgcolor="#0b1d24" style="background:#0b1d24;border:1px solid #22d3ee;">
            <a href="${APP_URL}" style="display:inline-block;padding:10px 22px;color:#22d3ee;text-decoration:none;font-size:13px;font-family:'IBM Plex Mono',ui-monospace,monospace;">
              Open lc-tracker
            </a>
          </td></tr>
        </table>

        <div style="border-top:1px solid #1b2233;margin-top:32px;padding-top:14px;font-size:11px;color:#545c7e;">
          Don't want these? <a style="color:#22d3ee;text-decoration:underline;" href="${APP_URL}/settings">Turn off in settings</a> &middot; <a style="color:#545c7e;text-decoration:underline;" href="${APP_URL}/unsubscribe?u=${p.user_id}">unsubscribe</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  const text = `Hey ${p.username},

You have a ${p.streak_days}-day streak going on lc-tracker. One review today keeps it rolling.

Easy problems still count.

Open lc-tracker: ${APP_URL}

Don't want these emails? Turn them off at ${APP_URL}/settings
Unsubscribe: ${APP_URL}/unsubscribe?u=${p.user_id}`
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
      reply_to: 'hello@lc-tracker.com',
      subject,
      html,
      text,
      // Gmail 2024 bulk sender requirements — one-click unsubscribe
      headers: {
        'List-Unsubscribe': `<${APP_URL}/unsubscribe?u=${p.user_id}>, <mailto:unsubscribe@lc-tracker.com?subject=unsub-${p.user_id}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
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
