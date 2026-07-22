# Privacy Policy — lc-notes

_Last updated: July 21, 2026_

lc-notes is a Chrome extension that helps you log and review LeetCode
problems, syncing with a companion web app (lc-tracker).

## What data is collected

- **Google account email address**, via Google Sign-In (OAuth), used
  to identify your account.
- **Authentication session data**: OAuth access and refresh tokens,
  obtained during sign-in and stored only on your own device (Chrome's
  local extension storage). These are used to authenticate requests to
  your own Supabase project — they are not readable by other users and
  are not transmitted anywhere except to Supabase's authentication API
  to establish or refresh your session.
- **Problem data you enter or the extension scrapes from LeetCode's own
  page**: problem name, number, URL, difficulty, pattern/category tags,
  your notes, comfort ratings, review dates, and — if you use the
  review timer — time spent in minutes.
- **Draft autosave data**: while you're filling out the log or review
  form, your in-progress entries (before you press Save/Submit) are
  autosaved to your own device a few hundred milliseconds after you
  stop typing, so an accidental reload doesn't lose what you've typed.
  A draft is deleted automatically once you successfully save or
  submit; until then it stays only on your device and is never sent to
  Supabase.
- **Panel preferences**: position, size, and collapsed state, stored
  only on your own device.

## How it's used

This data is used exclusively to provide the extension's core
functionality — logging problems, scheduling spaced-repetition
reviews, and syncing your notes between this extension and the
lc-tracker web app.

## Where it's stored

Two separate places, depending on the data:

- **Your own device only, never transmitted to Supabase** (via
  Chrome's local extension storage — not synced across your other
  devices or browsers): authentication session tokens, in-progress
  draft entries, and panel position/size/collapsed preferences.
- **Supabase (PostgreSQL) database**: problem and review data, once
  you press Save or Submit. Access is restricted by row-level security
  policies, meaning your data is only ever readable or writable by
  your own authenticated account — not by other users of the
  extension, and this is the same database and the same account used
  by the lc-tracker web app.

## What is not done with your data

- Not sold, rented, or shared with third parties.
- Not used for advertising.
- Not used for any purpose beyond the extension's stated functionality.

## Third-party services

- **Google Sign-In** is used for authentication. Google's own privacy
  policy governs their handling of your account information during
  sign-in.
- **Supabase** is used as the database provider. Data is stored under
  the developer's own Supabase project.

## Data retention and deletion

Your data remains stored until you request its deletion. To request
deletion of your account data, contact kirui1420@gmail.com.

## Changes to this policy

This policy may be updated as the extension's functionality changes.
Continued use of the extension after changes constitutes acceptance of
the updated policy.

## Contact

Questions about this policy or your data: kirui1420@gmail.com