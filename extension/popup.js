// Google sign-in for the extension. Same idea as consumeHashSession in
// src/contexts/AuthContext.tsx (the web app manually parses the OAuth
// redirect's #access_token=...&refresh_token=... fragment rather than
// trusting supabase-js's own URL detection) — here the redirect comes back
// from chrome.identity.launchWebAuthFlow instead of a normal page load, but
// the fragment format and the JWT-decode step are the same.

const app = document.getElementById('app')

function decodeJwt(accessToken) {
  const b64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
  return JSON.parse(decodeURIComponent(escape(atob(padded))))
}

function renderSignedOut(errorMessage) {
  app.innerHTML = ''
  app.appendChild(el('div', { class: 'lcn-title' }, 'lc-notes'))

  const btn = el('button', { type: 'button', class: 'lcn-btn-primary' }, 'Sign in with Google')
  btn.addEventListener('click', handleSignIn)
  app.appendChild(btn)

  if (errorMessage) {
    app.appendChild(el('div', { class: 'lcn-status-error' }, errorMessage))
  }
}

function renderSignedIn(session) {
  app.innerHTML = ''
  app.appendChild(el('div', { class: 'lcn-title' }, 'lc-notes'))
  app.appendChild(el('div', { class: 'lcn-muted' }, `Signed in as ${session.user.email ?? session.user.id}`))
  app.appendChild(el('div', { class: 'lcn-muted' }, 'Open a leetcode.com/problems/* page to log or review.'))

  const btn = el('button', { type: 'button', class: 'lcn-btn-secondary' }, 'Sign out')
  btn.addEventListener('click', handleSignOut)
  app.appendChild(btn)
}

async function handleSignIn() {
  try {
    if (!globalThis.LC_NOTES_CONFIG || globalThis.LC_NOTES_CONFIG.SUPABASE_URL.includes('your-project-ref')) {
      throw new Error('Missing config.local.js — copy config.example.js and fill in your Supabase project URL.')
    }
    const { SUPABASE_URL } = globalThis.LC_NOTES_CONFIG
    const redirectTo = chrome.identity.getRedirectURL()
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`

    const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true })
    if (!responseUrl) throw new Error('Sign-in was cancelled.')

    const hashIndex = responseUrl.indexOf('#')
    if (hashIndex === -1) {
      throw new Error('No session in the redirect — check that this extension\'s redirect URL is whitelisted in Supabase Auth settings.')
    }
    const params = new URLSearchParams(responseUrl.slice(hashIndex + 1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) {
      throw new Error(params.get('error_description') || 'Sign-in failed.')
    }
    const expires_in = parseInt(params.get('expires_in') ?? '3600', 10)
    const payload = decodeJwt(access_token)

    const session = {
      access_token,
      refresh_token,
      expires_in,
      expires_at: Math.floor(Date.now() / 1000) + expires_in,
      token_type: params.get('token_type') ?? 'bearer',
      user: {
        id: payload.sub,
        email: payload.email,
        user_metadata: payload.user_metadata ?? {},
      },
    }
    await saveSession(session)
    renderSignedIn(session)
  } catch (e) {
    renderSignedOut(e.message)
  }
}

async function handleSignOut() {
  await clearSession()
  renderSignedOut()
}

function el(tag, attrs, text) {
  const e = document.createElement(tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') e.style.cssText = v
      else if (k === 'class') e.className = v
      else e.setAttribute(k, v)
    }
  }
  if (text != null) e.textContent = text
  return e
}

;(async function init() {
  try {
    const session = await loadSession()
    if (session) renderSignedIn(session)
    else renderSignedOut()
  } catch (e) {
    renderSignedOut(e.message)
  }
})()
