# Setup: Supabase + Google Auth + Vercel

The code is done — these are the manual steps to bring the backend online.
Each takes a few minutes in a browser dashboard.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → sign in (GitHub login works) → **New project**
2. Name: `lc-tracker`, pick the free tier, choose a region near you (US East)
3. Wait ~2 min for it to provision

## 2. Run the database schema

1. In the Supabase dashboard: **SQL Editor** → **New query**
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Click **Run**. You should see "Success. No rows returned"

## 3. Set up Google sign-in

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `lc-tracker`)
2. **APIs & Services → OAuth consent screen**: External, fill in app name + your email, add yourself as a test user (or publish)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: Web application
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find your project ref in Supabase → Project Settings → General)
4. Copy the **Client ID** and **Client Secret**
5. In Supabase: **Authentication → Sign In / Up → Google** → enable, paste Client ID + Secret, save

## 4. Local env vars

1. Copy `.env.example` to `.env.local`
2. Fill in from Supabase → **Project Settings → API**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = `anon` `public` key
3. `npm run dev` — you should see the login page, and Google sign-in should work

## 5. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**
2. Import `k-boateng/lc-tracker` (framework auto-detects as Vite)
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`)
4. Deploy

## 6. Allow the production URL in Supabase

1. Supabase → **Authentication → URL Configuration**
2. Site URL: your Vercel URL (e.g. `https://lc-tracker-xyz.vercel.app`)
3. Redirect URLs: add both `https://<vercel-url>/**` and `http://localhost:5173/**`

Done. Sign in on the prod URL, and share the invite code from the Groups page with friends.
