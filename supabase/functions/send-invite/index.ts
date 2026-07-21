// Sends a group invite email via Resend.
// Caller must be authenticated AND a member of the group — this is what
// stops the endpoint being used as a spam relay.
//
// Body: { group_id: string, email: string }
// Uses the same secrets as send-digests: RESEND_API_KEY, DIGEST_FROM, APP_URL.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('DIGEST_FROM') ?? 'LC Tracker <noreply@lc-tracker.com>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://lc-tracker.com'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildInviteEmail(inviter: string, groupName: string, code: string, inviteId: string) {
  const link = `${APP_URL}/join/${code}?i=${inviteId}`
  const subject = `${inviter} invited you to grind LeetCode together`
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background:#0b0e14;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0e14" style="background:#0b0e14;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f131b" style="background:#0f131b;border:1px solid #1b2233;max-width:520px;">
      <tr><td style="padding:28px;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;">
        <div style="color:#22d3ee;font-weight:700;letter-spacing:-0.02em;font-size:14px;">~/lc-tracker</div>
        <div style="color:#545c7e;font-size:11px;margin-top:4px;">spaced repetition for problem grinding</div>

        <p style="font-size:14px;line-height:1.6;color:#c8d3f5;margin:28px 0 0;">
          <span style="color:#22d3ee;font-weight:700;">${inviter}</span> invited you to join
          <span style="color:#e0af68;font-weight:700;">${groupName}</span> &mdash; a group that tracks
          LeetCode practice with spaced repetition and a weekly leaderboard.
        </p>

        <p style="font-size:14px;line-height:1.6;color:#545c7e;margin:14px 0 0;">
          Sign in with Google and you're on the board. Takes about 20 seconds.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
          <tr><td bgcolor="#0b1d24" style="background:#0b1d24;border:1px solid #22d3ee;">
            <a href="${link}" style="display:inline-block;padding:10px 22px;color:#22d3ee;text-decoration:none;font-size:13px;font-family:'IBM Plex Mono',ui-monospace,monospace;">
              Join ${groupName}
            </a>
          </td></tr>
        </table>

        <div style="border-top:1px solid #1b2233;margin-top:32px;padding-top:14px;font-size:11px;color:#545c7e;">
          Not interested? Just ignore this email &mdash; nothing happens without you signing in.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  const text = `${inviter} invited you to join "${groupName}" on lc-tracker — spaced-repetition LeetCode practice with a weekly leaderboard.

Join here (sign in with Google, ~20 seconds): ${link}

Not interested? Just ignore this email.`
  return { subject, html, text }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (!RESEND_API_KEY) return json({ error: 'email not configured' }, 500)

  // Identify the caller from their JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) return json({ error: 'not authenticated' }, 401)
  const callerId = userData.user.id

  let body: { group_id?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }
  const groupId = body.group_id ?? ''
  const email = (body.email ?? '').trim().toLowerCase()
  if (!groupId || !EMAIL_RE.test(email)) return json({ error: 'invalid group or email' }, 400)

  // Caller must be a member of the group they're inviting to
  const { data: membership } = await admin
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', callerId)
    .maybeSingle()
  if (!membership) return json({ error: 'not a member of this group' }, 403)

  const [{ data: group }, { data: profile }] = await Promise.all([
    admin.from('groups').select('name, invite_code').eq('id', groupId).single(),
    admin.from('profiles').select('username').eq('id', callerId).single(),
  ])
  if (!group || !profile) return json({ error: 'group not found' }, 404)

  // Record the invite so the conversion can be attributed on join
  const { data: inviteRow, error: inviteError } = await admin
    .from('invites')
    .insert({ group_id: groupId, inviter_id: callerId, email })
    .select('id')
    .single()
  if (inviteError || !inviteRow) {
    console.error('invite insert failed', inviteError)
    return json({ error: 'could not record invite' }, 500)
  }

  const { subject, html, text } = buildInviteEmail(profile.username, group.name, group.invite_code, inviteRow.id)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: 'hello@lc-tracker.com',
      subject,
      html,
      text,
    }),
  })
  if (!res.ok) {
    console.error('Resend failure', email, res.status, await res.text())
    return json({ error: 'send failed' }, 502)
  }
  return json({ sent: true })
})
