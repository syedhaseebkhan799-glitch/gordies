# Gordies 💬

Chat app for Gordon College friends. Next.js + Supabase.

- **Website:** https://gordies.vercel.app
- **Android APK:** https://github.com/syedhaseebkhan799-glitch/gordies/releases/latest/download/gordies.apk (rebuilt automatically on every push to `master`)
- **Windows app:** https://github.com/syedhaseebkhan799-glitch/gordies/releases/latest/download/gordies-setup.exe

## What it does (v1)

- Sign up / sign in with email + password (stays logged in)
- Forgot password with a reset link sent by email
- Profile setup: unique username, display name, optional photo
- **Members list**: everyone who joined Gordies, Online / Offline (like a server), tap to chat
- **# General** group chat: everyone who joins is in it (sender names + photos, "X is typing…", unread count)
- Find people by username, then 1-to-1 chat
- Live messages, ✓ sent / ✓✓ seen ticks, "typing…", green online dot, unread count
- Themes: Auto / Light / Dark / Black, 6 colors, 3 wallpapers, round or sharp bubbles
- No internet: red banner "net on kar gandu", old chats still readable, sending locked

## Setup (one time)

1. Create a free project at https://supabase.com.
2. Supabase → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
3. Supabase → **Authentication → Sign In / Providers → Email**: turn **OFF** "Confirm email" (easier for friends).
4. Supabase → **Authentication → URL Configuration** → **Redirect URLs** → add `http://localhost:3000/**` (and later your Vercel link + `/**`). Needed for the password-reset link.
5. Copy `.env.local.example` to `.env.local` and paste your values from Supabase → **Project Settings → API**.
6. Run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy (Vercel, free)

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new → import the repo (framework: Next.js, no changes needed).
3. Under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `.env.local`).
4. Click **Deploy**. Share the `https://<name>.vercel.app` link with friends.
5. Supabase → **Authentication → URL Configuration** → set **Site URL** to that Vercel link.

The build is a static site (`out/` folder), so it also works on Netlify, Cloudflare Pages or GitHub Pages.

Already ran `schema.sql` before the Members list was added? Run it again — it is safe and turns on live member updates and creates the # General group chat.

## Test offline

Chrome DevTools (F12) → **Network** tab → change "No throttling" to **Offline**.

## Coming next


Note: Supabase's free email service only sends a few emails per hour, so password reset is rate-limited.
