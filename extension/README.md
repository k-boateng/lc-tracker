# lc-notes (Chrome extension)

Companion to the main lc-tracker app. Injects a panel on
`leetcode.com/problems/*` that logs a new problem or reviews a due one,
writing straight into the same `problems` / `reviews` tables via the
same Supabase project — no separate backend.

## Why it exists
lc-tracker already handled logging problems and spaced-repetition
review scheduling — but doing that meant leaving LeetCode, opening
lc-tracker, finding the problem, and copying details over by hand. This
extension closes that loop: it lives directly on the LeetCode problem
page, auto-detects whether you're solving something new or reviewing
something due, and writes straight into the same database lc-tracker
already reads from. No separate note-taking system, no manual re-entry
— the review habit and the tool live in the same place you're actually
doing the work.

## What it does

- **New problem, not yet logged**: panel shows a log form. Scrapes name,
  difficulty, and URL from the page DOM; pattern is a dropdown matching
  the app's own `ALL_PATTERNS` list exactly. Comfort rating (1–5) is
  required at log time and feeds the same SM-2-style scheduling the app
  uses, so a newly logged problem gets a real initial review date.
- **Existing problem, due for review** (`next_review <= today`): panel
  shows a review form — comfort rating, notes, a timer. Submitting
  writes a new row to `reviews` and updates the problem's schedule
  fields, same two-write sequence the app itself uses.
- **Existing problem, not due yet**: panel shows existing notes/pattern
  read-only, then auto-collapses to a small pill so it doesn't block the
  page when there's no action to take.
- Panel is draggable (by its header), resizable (bottom-right handle),
  and collapsible. Position/size/collapsed state persist across page
  loads via `chrome.storage.local`.
- In-progress notes autosave as a draft (debounced) and restore if the
  page reloads before you submit.

## Setup

1. **Config**: `cp config.example.js config.local.js` and fill in
   `SUPABASE_URL` / `SUPABASE_ANON_KEY` — same values as this repo's
   `.env.local` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
   `config.local.js` is gitignored.

2. **Load unpacked**: `chrome://extensions` → enable Developer mode →
   "Load unpacked" → select this `extension/` folder.

3. Click the extension icon → **Sign in with Google**.

4. Open any `leetcode.com/problems/<slug>/` page.

## Sharing with others

This extension isn't published to the Chrome Web Store — it's shared as
source, loaded unpacked.

- `manifest.json` has a pinned `"key"` field so the extension ID stays
  identical across every install, regardless of whose machine loads it
  or what path it's loaded from. Don't remove this — without it, each
  person's install gets a different ID, which breaks the OAuth redirect.
- Each person needs their own `config.local.js` (same
  SUPABASE_URL/ANON_KEY as everyone else's — this shares one Supabase
  project via RLS, so each signed-in user only ever sees their own rows).
- The OAuth redirect URL only needs to be whitelisted once in Supabase
  (Authentication → URL Configuration → Redirect URLs), since the
  pinned key keeps the ID — and therefore the redirect URL — the same
  for every install.
- From there, setup is identical to the steps above.

## How auth works here

Rather than trust supabase-js's own URL/session detection (this app
pins `flowType: 'implicit'`, `detectSessionInUrl: false`), the OAuth
redirect's `#access_token=...&refresh_token=...` fragment is parsed by
hand and the JWT is decoded locally — same idea as
`src/contexts/AuthContext.tsx`'s `consumeHashSession`, adapted for:

- Redirect coming from `chrome.identity.launchWebAuthFlow` (popup.js),
  not a normal page navigation.
- Session stored in `chrome.storage.local`, not `localStorage` — a
  content script's `localStorage` belongs to leetcode.com, and a service
  worker has no `localStorage` at all.
- The content script reads the stored session on init and calls
  `supabase.auth.setSession()` on its own client (`persistSession: false`
  — storage handled manually, see `src/session.js`).

## Debugging

There's no background service worker (popup.js talks to
`chrome.identity` directly), so logs live where the code actually runs:

- **`src/content.js`** (panel logic, drag/resize/collapse, tagged
  `[lc-notes]`) logs to the **leetcode.com tab's own DevTools console**.
- **`popup.js`** logs to the popup's own console — right-click the
  toolbar icon → **Inspect popup**.

## Styling

`src/panel.css` ports the app's actual design tokens — dark-theme hex
values, sharp-corners-everywhere convention, badge/comfort-color classes,
and the terminal-window chrome bar from the app's own login screen. See
the comment at the top of `panel.css` for the full source mapping.

## Known limitations

- **No cross-context token refresh.** Each context calls `setSession()`
  independently; when the access token expires, sign in again from the
  popup.
- **DOM scraping is best-effort.** LeetCode's markup has changed before
  and will again — scraped values are editable fields in the log form
  so a bad scrape doesn't silently write garbage, but it can fail to
  find a match entirely.
- **`pattern` has no DB-level enum** — `src/patterns.js` is a manual
  copy of the app's pattern list and needs updating by hand if that
  list changes.