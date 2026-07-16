# Security policy

beanlo stores sensitive family data (a baby's feeding, health and growth log,
plus photos). Security reports are taken seriously and appreciated.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use
GitHub's private vulnerability reporting on this repository
(Security → Report a vulnerability). You should get a first response within a
few days.

## Scope notes for researchers

- All data access is enforced by Postgres Row-Level Security
  (`supabase/migrations/`), not just application code. `scripts/rls-test.mjs`
  exercises the policies. Anything reachable through the public Supabase REST
  API with the anon key that shouldn't be is in scope and high value.
- The service-role key is used only in server code (`lib/supabase/service.ts`
  call sites); any path that returns service-role query results to a user
  without an authorization check is a bug.
- `viewer` (healthcare professional) is a read-only role — any write it can
  perform is a bug.
- The AI routes (`/api/chat`, `/api/handover`, `/api/quicklog`,
  `/api/notes/draft`) interpolate user-authored text into model prompts.
  Prompt injection that alters Bea's tone is expected LLM behaviour; prompt
  injection that leads to cross-family data access or unauthorized writes is
  in scope.

## Hardening notes for self-hosters

- Set a long random `CRON_SECRET`; the cron route rejects requests when it is
  unset.
- The AI routes have a best-effort in-memory rate limit per user
  (`lib/rateLimit.ts`). It is per serverless instance — if you expect
  adversarial load, back it with Redis/Upstash and set a spend limit on your
  Anthropic API key.
- Keep `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY` and `VAPID_PRIVATE_KEY`
  server-side only (never `NEXT_PUBLIC_`-prefixed).
