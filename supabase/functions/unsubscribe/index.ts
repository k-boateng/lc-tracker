// Public unsubscribe endpoint. Hit by Gmail's one-click unsubscribe (POST)
// and by the visible link in the email (GET). Auth is by user_id only —
// good enough for "opt me out of marketing email" non-sensitive flow.
// Deploy with --no-verify-jwt so Gmail and unauthenticated users can call.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const page = (msg: string, ok: boolean) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${ok ? 'Unsubscribed' : 'Error'}</title><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0b0e14;color:#c8d3f5;font-family:'IBM Plex Mono',ui-monospace,monospace;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0e14" style="background:#0b0e14;">
  <tr><td align="center" style="padding:80px 24px;">
    <table role="presentation" width="420" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f131b" style="background:#0f131b;border:1px solid #1b2233;max-width:420px;">
      <tr><td style="padding:32px;text-align:center;">
        <div style="color:#22d3ee;font-weight:700;font-size:14px;">~/lc-tracker</div>
        <div style="color:${ok ? '#9ece6a' : '#f7768e'};font-size:18px;margin-top:24px;">${ok ? '✓' : '✗'} ${msg}</div>
        <a href="https://lc-tracker.com" style="display:inline-block;margin-top:24px;padding:8px 18px;color:#22d3ee;text-decoration:none;font-size:13px;border:1px solid #22d3ee;">Back to lc-tracker</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const uid = url.searchParams.get('u')
  if (!uid) {
    return new Response(page('Missing user id', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  const { error } = await supabase
    .from('profiles')
    .update({ email_digest_enabled: false })
    .eq('id', uid)
  if (error) {
    console.error('unsubscribe error', error)
    return new Response(page('Could not unsubscribe', false), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return new Response(page('You won\'t receive any more emails', true), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})
