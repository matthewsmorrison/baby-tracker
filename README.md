# beanlo — newborn tracker

A mobile-first tracker for the first days and weeks of life. Parents log
nappies, feeds, sleep, weight and more; the app shows day-by-day expectations
(feeding-mix-aware stool colour, wet/dirty counts, expected weight band from
sex-specific WHO centiles) and red flags to watch — all grounded in NHS, NCT
and WHO guidance. Multiple caregivers share one log, and a healthcare
professional can be connected read-only.

**beanlo is a tracking aid, not medical advice or diagnosis.**

## Features

- **Logging** — nappies (with photos), combined feeds (per-breast timers,
  expressed, formula), sleep (location + how they settled), weight/length/head
  circumference, pumping, temperature, milestones, carer sleep, and
  medications (mother's or baby's) with push reminders.
- **Today** — rolling 24-hour dashboard: nappy quota vs NCT guidance, KPIs,
  expected stool colour for the day and feeding mix, weight vs the WHO band,
  red flags.
- **Prediction engines** (`lib/predict.ts`) — next-feed guess and a
  Huckleberry-style nap "sweet spot" window, learned from the baby's own
  rhythm with age-based defaults until there's history. Both self-grade
  against what actually happened.
- **Bea (AI, Anthropic API)** — a chat assistant that answers from the baby's
  logged data with web search restricted to trusted health domains (NHS
  first); natural-language quick logging ("fed 15 min left, wet nappy at
  3am"); an evening digest push notification; drafted answers to saved
  questions; and a one-page AI handover report for midwife/health-visitor
  appointments. All server-side, gated to the `advanced` membership tier.
- **Friends** — add other beanlo parents by email, see an MSN-style presence
  dot (green whenever they have the app open, pulsing while a feed timer
  runs — company for the 3am shift), and message them. Messages are
  end-to-end encrypted in the browser (ECDH + AES-GCM); the database only
  stores ciphertext.
- **Sharing & export** — email invites with roles (owner / caregiver /
  viewer), CSV export, printable reports.
- **PWA** — installable, with web-push notifications (feed due, low nappy
  count, medication reminders, evening digest).

## Stack

Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth,
Storage, **RLS for all authorization**) · Anthropic API (server-side only) ·
recharts · web-push. Deployed on Vercel; scheduled work runs via GitHub
Actions. Original product spec in [`spec.md`](./spec.md).

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply every file in [`supabase/migrations/`](./supabase/migrations/) in
   filename order — either link the repo and `supabase db push`, or paste them
   into the SQL Editor. This creates the schema, RLS policies, column
   privileges, triggers, and the private `nappy-photos` storage bucket.
3. **Authentication → Providers**: Email (magic links) works out of the box;
   optionally add Google OAuth credentials.
4. **Authentication → URL Configuration**: set the Site URL and add
   `http://localhost:3000/auth/callback` plus
   `https://<your-domain>/auth/callback` as redirect URLs.

### 2. Environment

```sh
cp .env.example .env.local
```

Fill in the values — the file documents each one. You'll need: the Supabase
URL + publishable key + secret key (Project Settings → API Keys), an Anthropic
API key (console.anthropic.com — set a spend limit), VAPID keys for web push
(`npx web-push generate-vapid-keys`), and a long random `CRON_SECRET`.
`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY` and `VAPID_PRIVATE_KEY` are
server-only — never prefix them with `NEXT_PUBLIC_`.

### 3. Run locally

```sh
npm install
npm run dev
```

### 4. Deploy (Vercel)

Add the same env vars to the Vercel project, set `NEXT_PUBLIC_APP_URL` to the
deployed URL, deploy via the git integration, and add the production callback
URL in Supabase Auth settings.

### 5. Scheduled notifications (optional)

Push notifications (feed due, low nappies, medication reminders, the evening
Bea digest) are sent by `POST /api/cron/notify`, triggered by
[`.github/workflows/notify.yml`](./.github/workflows/notify.yml) every 15
minutes. To enable: set two GitHub Actions **repository secrets** —
`CRON_SECRET` (same value as the env var) and `APP_URL` (your deployed URL).
`keepalive.yml` pings Supabase every two days so free-tier projects don't
pause.

## Architecture notes

- **Authorization is Postgres RLS, not app code.** Roles: `owner` /
  `caregiver` write, `viewer` (healthcare professional) is read-only —
  enforced by policies in the migrations, with column-level privileges for
  fields users must not write (e.g. `babies.membership_tier`).
  `scripts/rls-test.mjs` exercises the policies.
- **`lib/clinical.ts` is the single source of truth** for day-of-life norms,
  feeding mix and weight bands, shared by the UI and every AI prompt. It must
  stay conservative: general newborn norms only, no diagnostic thresholds.
- **Backdating-correct**: every entry has an editable `occurred_at`; norms
  always compute from it, never "now".
- **AI**: `lib/aiContext.ts` serialises the (small) dataset into a
  prompt-cached system block — no RAG needed at newborn scale. Bea's chat can
  search the web, restricted to an allowlist of trusted health domains. All
  AI routes are authenticated, tier-gated, and rate-limited
  (`lib/rateLimit.ts`).
- **Photos** live in a private bucket, scoped per baby by RLS, served via
  short-TTL signed URLs.
- **Predictions** are deliberately statistical (medians over the baby's own
  gaps, day/night aware), not LLM calls — cheap, explainable, and self-graded
  in the UI.

## Security

See [SECURITY.md](./SECURITY.md) for the reporting policy and the threat-model
notes. Please report vulnerabilities privately.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — especially the rules around
clinical content.

## License

[AGPL-3.0](./LICENSE). You're welcome to self-host and modify; if you run a
modified version as a service, you must share your changes under the same
license. "beanlo" is the name of the maintainer's hosted instance.
