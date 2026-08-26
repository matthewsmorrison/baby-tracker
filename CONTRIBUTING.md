# Contributing

Thanks for your interest! Beanlo is a small, opinionated app; contributions
are welcome, especially bug fixes, accessibility improvements, and
translations of the clinical copy against authoritative sources.

## Ground rules

- **Clinical content is conservative by design.** Norms live in
  `lib/clinical.ts` and are sourced from NHS/NCT/WHO guidance; that module
  must not gain diagnostic thresholds beyond what is there. Changes to
  clinical copy need a citation to an authoritative source (NHS, NICE, WHO,
  RCPCH) in the PR description.
- **The app is a tracking aid, not medical advice.** Nothing may weaken the
  disclaimers or make the AI give all-clears.
- **Security model:** all authorization is Postgres RLS. New tables need
  policies in a migration plus coverage in `scripts/rls-test.mjs`. Server
  actions and API routes must never trust client-supplied baby/user IDs
  without going through RLS or an explicit membership check.
- **Migrations** are append-only files in `supabase/migrations/` named
  `YYYYMMDDNNNNNN_description.sql`.

## Developing

```sh
cp .env.example .env.local   # fill in your own Supabase/Anthropic keys
npm install
npm run dev
npm run lint && npm run build   # both must pass before a PR
```

See the README for full environment setup (Supabase, push keys, cron).

## Style

Match the surrounding code: TypeScript, App Router server components by
default, Tailwind, comments only where the code can't speak for itself. Keep
UI copy warm and calm — the reader is a tired parent.
