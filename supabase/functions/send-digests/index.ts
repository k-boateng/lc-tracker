// Unified daily nudge — ONE email per user per day, max.
// Triggers merged into a single message: rank drops, streak at risk,
// invites accepted. Scheduled hourly by pg_cron; no-ops outside 20:00 UTC
// (≈4pm ET, four hours before the UTC-midnight streak deadline).
// Invoke with ?force=true to bypass the hour gate when testing.
//
// Secrets: RESEND_API_KEY, DIGEST_FROM, APP_URL (already set).

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface RankDrop {
  group_name: string
  rank: number
  prev_rank: number
  gap_pts: number
  ahead_username: string
}

interface InviteAccepted {
  username: string
  group_name: string
}

interface PendingNudge {
  user_id: string
  email: string
  username: string
  streak_days: number
  rank_drops: RankDrop[]
  invites_accepted: InviteAccepted[]
  current_ranks: { group_id: string; rank: number }[]
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('DIGEST_FROM') ?? 'LC Tracker <noreply@lc-tracker.com>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://lc-tracker.com'
// Fire at 4pm app-local (≈4 hours before the local-midnight streak deadline)
const APP_TZ = 'America/New_York'
const SEND_HOUR_LOCAL = 16

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function buildEmail(p: PendingNudge) {
  const sections: { html: string; text: string }[] = []

  for (const d of p.rank_drops) {
    const who = d.ahead_username || 'someone'
    const line = `${who} passed you in ${d.group_name} — you're ${ordinal(d.rank)} now, ${d.gap_pts} pts behind.`
    sections.push({
      html: `<p style="font-size:14px;line-height:1.6;color:#c8d3f5;margin:14px 0 0;"><span style="color:#f7768e;">▼</span> <span style="color:#22d3ee;font-weight:700;">${who}</span> passed you in <span style="color:#e0af68;">${d.group_name}</span> &mdash; you're ${ordinal(d.rank)} now, <span style="color:#e0af68;font-weight:700;">${d.gap_pts} pts</span> behind.</p>`,
      text: line,
    })
  }

  if (p.streak_days > 0) {
    sections.push({
      html: `<p style="font-size:14px;line-height:1.6;color:#c8d3f5;margin:14px 0 0;"><span style="color:#e0af68;">●</span> your <span style="color:#e0af68;font-weight:700;">${p.streak_days}-day streak</span> needs one review today to stay alive.</p>`,
      text: `Your ${p.streak_days}-day streak needs one review today to stay alive.`,
    })
  }

  for (const a of p.invites_accepted) {
    sections.push({
      html: `<p style="font-size:14px;line-height:1.6;color:#c8d3f5;margin:14px 0 0;"><span style="color:#9ece6a;">+</span> <span style="color:#22d3ee;font-weight:700;">${a.username}</span> accepted your invite to <span style="color:#e0af68;">${a.group_name}</span>. they're on the board.</p>`,
      text: `${a.username} accepted your invite to ${a.group_name}.`,
    })
  }

  // Subject: most urgent trigger wins
  let subject: string
  if (p.rank_drops.length > 0) {
    const d = p.rank_drops[0]
    subject = `${d.ahead_username || 'someone'} passed you in ${d.group_name}`
  } else if (p.streak_days > 0) {
    subject = `keep your ${p.streak_days}-day streak going`
  } else {
    subject = `${p.invites_accepted[0]?.username ?? 'a friend'} accepted your invite`
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background:#0b0e14;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0e14" style="background:#0b0e14;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f131b" style="background:#0f131b;border:1px solid #1b2233;max-width:520px;">
      <tr><td style="padding:28px;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;">
        <div style="color:#22d3ee;font-weight:700;letter-spacing:-0.02em;font-size:14px;">~/lc-tracker</div>
        <div style="color:#545c7e;font-size:11px;margin-top:4px;">daily check-in</div>

        <div style="margin-top:24px;font-size:15px;color:#c8d3f5;">
          <span style="color:#22d3ee;">&gt;</span> hey ${p.username},
        </div>

        ${sections.map(s => s.html).join('\n')}

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
          <tr><td bgcolor="#0b1d24" style="background:#0b1d24;border:1px solid #22d3ee;">
            <a href="${APP_URL}" style="display:inline-block;padding:10px 22px;color:#22d3ee;text-decoration:none;font-size:13px;font-family:'IBM Plex Mono',ui-monospace,monospace;">
              Open lc-tracker
            </a>
          </td></tr>
        </table>

        <div style="border-top:1px solid #1b2233;margin-top:32px;padding-top:14px;font-size:11px;color:#545c7e;">
          One email a day, max. Don't want these? <a style="color:#22d3ee;text-decoration:underline;" href="${APP_URL}/settings">Turn off in settings</a> &middot; <a style="color:#545c7e;text-decoration:underline;" href="${APP_URL}/unsubscribe?u=${p.user_id}">unsubscribe</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const text = `Hey ${p.username},

${sections.map(s => s.text).join('\n')}

Open lc-tracker: ${APP_URL}

One email a day, max. Turn off at ${APP_URL}/settings
Unsubscribe: ${APP_URL}/unsubscribe?u=${p.user_id}`

  return { subject, html, text }
}

async function sendOne(p: PendingNudge): Promise<boolean> {
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

Deno.serve(async (req) => {
  if (!RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not configured', { status: 500 })
  }

  // Deployed with --no-verify-jwt (the gateway rejects legacy HS256 JWTs);
  // we authenticate the caller ourselves. The pg_cron job sends the legacy
  // service_role JWT (stored as CRON_SECRET); the runtime-injected
  // SUPABASE_SERVICE_ROLE_KEY is accepted too in case formats converge.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const allowed = [
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('CRON_SECRET'),
  ].filter(Boolean)
  if (!bearer || !allowed.includes(bearer)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const force = new URL(req.url).searchParams.get('force') === 'true'
  const localHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: APP_TZ, hour: '2-digit', hour12: false })
      .format(new Date())
  ) % 24
  if (!force && localHour !== SEND_HOUR_LOCAL) {
    return new Response(JSON.stringify({ skipped: 'outside send window', localHour }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase.rpc('list_pending_nudges')
  if (error) {
    return new Response(`rpc error: ${error.message}`, { status: 500 })
  }
  const pending = (data ?? []) as PendingNudge[]

  let sent = 0
  let failed = 0
  for (const p of pending) {
    const hasTrigger =
      p.streak_days > 0 || p.rank_drops.length > 0 || p.invites_accepted.length > 0
    if (!hasTrigger) continue
    const ok = await sendOne(p)
    if (ok) {
      await supabase.rpc('mark_digest_sent', { uid: p.user_id })
      sent++
    } else {
      failed++
    }
  }

  // Snapshot today's ranks for everyone processed (sent or not) so
  // tomorrow's comparison is day-over-day
  const snapshots = pending.flatMap(p =>
    p.current_ranks.map(r => ({
      group_id: r.group_id,
      user_id: p.user_id,
      rank: r.rank,
      updated_at: new Date().toISOString(),
    }))
  )
  if (snapshots.length > 0) {
    const { error: snapError } = await supabase
      .from('rank_snapshots')
      .upsert(snapshots, { onConflict: 'group_id,user_id' })
    if (snapError) console.error('snapshot upsert failed', snapError)
  }

  return new Response(
    JSON.stringify({ checked: pending.length, sent, failed, snapshots: snapshots.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
