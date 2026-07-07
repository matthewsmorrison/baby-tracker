# hearth — newborn tracker

A mobile-first tracker for the first days and weeks of life. Parents log
nappies, feeds and weight; the app shows day-by-day expectations (feeding-mix
aware stool colour, wet/dirty counts, expected weight band) and red flags to
watch. A nappy photo can be checked by Claude against the baby's day of life
and feeding pattern.

**Hearth is a tracking aid, not medical advice or diagnosis.**

Built with Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres,
Auth, Storage, RLS), the Anthropic API (server-side only), recharts, and
lucide-react. Full product spec in [`spec.md`](./spec.md).

## Setup

### 1. Supabase

1. In your Supabase project, open **SQL Editor** and run
   [`supabase/migrations/20260707000001_init.sql`](./supabase/migrations/20260707000001_init.sql)
   (or link the project and `supabase db push`). This creates the schema, RLS
   policies, triggers, and the private `nappy-photos` storage bucket.
2. **Authentication → Providers**: leave **Email** enabled (magic links). To
   enable **Google**, add your OAuth client ID/secret from Google Cloud
   Console.
3. **Authentication → URL Configuration**: set the Site URL to your production
   URL and add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-domain>/auth/callback`

### 2. Environment

Copy `.env.example` to `.env.local` and fill in the values (Supabase Project
Settings → API Keys for the URL, `sb_publishable_...` and `sb_secret_...`
keys; Anthropic Console for the API key). `SUPABASE_SECRET_KEY` and
`ANTHROPIC_API_KEY` are server-only — never prefix them with `NEXT_PUBLIC_`.

### 3. Run locally

```sh
npm install
npm run dev
```

### 4. Deploy to Vercel

Add the same env vars to the Vercel project (Settings → Environment
Variables), set `NEXT_PUBLIC_APP_URL` to the deployed URL, then deploy
(`vercel --prod` or via git integration). Remember to add the production
callback URL in Supabase Auth settings.

## Architecture notes

- **Log is the only input surface.** Today / Weight / History are strictly
  read-only output; account admin lives in Profile.
- **Backdating**: every entry has an editable `occurred_at`; day-of-life,
  norms and feeding mix always compute from `occurred_at`, never "now"
  (`lib/clinical.ts` is the single source of truth, shared with the AI route).
- **Roles**: `owner` / `caregiver` can write; `viewer` (healthcare
  professional) is read-only, enforced by RLS — not just the UI.
- **Photos** live in a private bucket, displayed via short-TTL signed URLs;
  the secret key reads them only inside
  `app/api/entries/[id]/analyze/route.ts`.
- **AI safety**: the analyze route enforces a server-side floor on the
  verdict — pale/chalky or blood can never come back with a reassuring
  action, regardless of what the model says.

## Invites

Owners invite carers or a read-only healthcare professional from Profile.
Email delivery is not wired up yet — after creating an invite, copy the link
and share it manually (marked as a stub in the UI). Acceptance is verified
server-side against the invitee's signed-in email.
