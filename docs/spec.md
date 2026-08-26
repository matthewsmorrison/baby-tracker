# Newborn Tracker — Build Spec

A production build brief for Claude Code. Working name: **`hearth`** (rename freely). This supersedes the prototype we built in `NappyTracker.jsx`; that file is the reference implementation for the UI and the clinical logic — **port its logic, rebuild it as a real multi-user app.**

---

## 1. What this app is

A mobile-first newborn tracker for the first days and weeks of life. Parents log **nappies (wees/poos), feeds (breast / formula / expressed) and weight**, and the app turns that into day-by-day output: whether output and weight are on track, what stool colour to expect for the baby's day of life and current feeding mix, and red flags to watch. A photo of a nappy can be analysed by Claude (via the Anthropic API) to assess colour/consistency **for that baby's specific day of life and feeding pattern**.

Clinical context that shapes the whole product: the baby was supplemented with formula in hospital for dehydration and the family is transitioning toward full breastfeeding. So the app must be **feeding-mix aware** (formula stool differs from breastfed stool; expressed breastmilk counts as breastfed for stool purposes) and treat weight as the objective tie-breaker.

### Non-negotiable safety framing

This is a **tracking aid, not medical advice or diagnosis** — including the AI photo analysis. This copy and behaviour must survive into production:

- The AI must **never give an all-clear that could delay care**. Pale/white/chalky stool, blood, or meconium still present at day 5+ are hard-flagged to "contact midwife today / seek advice now".
- No specific feeding/nutrition targets beyond the general norms already in the clinical module.
- A persistent, quiet disclaimer on output screens; a first-run note.

---

## 2. What changed vs the prototype (read this first)

These five requirements drive the new architecture:

1. **Multi-carer per baby.** A baby has many members. Both parents can log in and see/edit the same baby.
2. **Backdating.** Every tracking entry (nappy, feed, weight) has an editable `occurred_at`. A parent signing up at day 5 can enter all of days 1–4. Day-of-life, expected norms and feeding mix are always computed relative to `occurred_at`, never "now".
3. **Read-only healthcare professional.** A `viewer` role (midwife / health visitor / GP) can read everything but cannot create, edit or delete. Enforced at the database (RLS), not just the UI.
4. **Historical weight, weight-in-log.** Weight is a normal loggable entry type with its own `occurred_at`, entered in the Log tab, appearing in the unified history, and plotted on the Weight chart.
5. **Log is the only input surface.** All creation/editing/deletion of tracking data happens in **Log**. **Today, Weight and History are strictly read-only output.** Account admin (invite carers, edit birth details, membership) lives in **Profile** — that's not tracking data, so it's exempt from the "Log-only" rule.

---

## 3. Tech stack & deployment

- **Next.js (App Router) + TypeScript.** Server Components by default; Client Components only where interactive (Log forms, charts).
- **Tailwind CSS** for styling (design tokens in §6).
- **Supabase**: Postgres + Auth (email magic link + Google OAuth) + Storage (nappy photos) + Row Level Security.
- **Anthropic API** for stool photo analysis — **server-side only** (Route Handler). Never expose the key to the client.
- **Vercel** for hosting. Supabase is external.
- **recharts** for the weight chart. **lucide-react** for icons.
- Supabase access via `@supabase/ssr` (server client with cookies; separate service-role client for the analysis route only).

### 4. Environment variables (`.env.local` / Vercel project env)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only — used by the analyze route to read images
ANTHROPIC_API_KEY=                # server only
ANTHROPIC_MODEL=claude-haiku-4-5  # default; see §12
NEXT_PUBLIC_APP_URL=              # for invite links
```

`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` must be plain (non-`NEXT_PUBLIC_`) so they stay server-side.

### 5. Repo structure (suggested)

```
app/
  (auth)/login/page.tsx
  (app)/layout.tsx            # nav shell (sidebar desktop / bottom bar mobile)
  (app)/today/page.tsx        # OUTPUT
  (app)/log/page.tsx          # INPUT (only)
  (app)/weight/page.tsx       # OUTPUT
  (app)/history/page.tsx      # OUTPUT
  (app)/profile/page.tsx      # ADMIN
  onboarding/page.tsx         # create or join a baby
  invite/[token]/page.tsx     # accept invite
  api/entries/[id]/analyze/route.ts   # server: Anthropic stool analysis
lib/
  clinical.ts                 # ported day-of-life / norms / weight band / mix logic
  supabase/{server,client,service}.ts
  types.ts
components/
  log/{NappyForm,FeedForm,WeightForm,OccurredAtField,RecentEntries}.tsx
  output/{KpiCard,FeedingCard,ColourCard,WeightChart,RedFlags,Timeline}.tsx
  ui/*                        # buttons, sheet, chips per design system
supabase/migrations/*.sql
```

---

## 6. Design system — Nous style

Derived from the Nous reference screens: warm sand background, white rounded cards, near-black ink, a honey/amber brand accent used sparingly, sage green for positive/"on-track" states, black pill CTAs, generous whitespace, clean grotesque type.

### Palette (define as CSS variables / Tailwind theme)

```
--bg:            #EDE9E1   /* warm sand app background */
--bg-glow:       #F6E3C6   /* soft amber radial glow behind hero on Today */
--surface:       #FFFFFF   /* cards */
--surface-alt:   #FAF8F3   /* inset tiles, inputs */
--ink:           #1B1B1A   /* primary text, black CTAs */
--muted:         #8C8677   /* secondary text */
--faint:         #B4AE9F   /* tertiary / placeholders */
--line:          #E7E1D6   /* hairlines, borders */

--accent:        #E9A23B   /* honey/amber — brand, premium, small highlights ONLY */
--accent-soft:   #F7E9CF

--positive:      #3C6B4E   /* "on target" text, savings-style green */
--positive-bg:   #DEE9DE
--positive-bar:  #7FB08A   /* progress fill */

--alert:         #C0483B   /* red flags */
--alert-bg:      #F6E0DC
```

Stool-colour swatches (functional, keep as-is from the prototype):
`meconium #2E2E28 · transitional #6E5A34 · yellow(breastfed) #E3B44A · tan(formula/mixed) #BFA173 · brown(formula) #7A5A3A · green #5C7A3A · pale ⚠ #ECE7D6 · blood ⚠ #9E3B32`.

### Typography

- **Schibsted Grotesk** via `next/font/google` for display + UI (close to the Nous wordmark's clean grotesque). Weights 400/500/600/700. Fallback `system-ui, sans-serif`.
- Big numbers ("Day 5", stat values): weight 700, tight tracking (`-0.02em`), **tabular-nums** so stats don't jitter.
- Body 400–500, comfortable line-height (1.5) for tired-eye legibility.
- Headings sentence case, not title case (matches Nous).

### Shape & elevation

- Cards: radius **24px** (`rounded-3xl`), border `1px --line`, shadow `0 1px 2px rgba(0,0,0,.04), 0 10px 30px rgba(0,0,0,.05)`.
- Inputs / inset tiles: radius **16px** (`rounded-2xl`).
- Buttons: **pill** (`rounded-full`). Primary = solid `--ink` / white text. Secondary = `--surface` with `--line` border. Never use amber for large fills — amber is an accent only.
- Segmented controls (feed type, etc.): pill container, active segment solid `--ink`.

### Motion & a11y

Subtle only: card fade/slide on load, gentle progress-bar fill. Respect `prefers-reduced-motion`. Visible keyboard focus rings. Full mobile responsiveness is the priority since this is used one-handed at night.

### Layout

- **Desktop**: left sidebar nav (like Nous) — Today, Log, Weight, History, Profile — with the baby name/day badge in the header.
- **Mobile**: bottom tab bar, with **Log as the emphasised centre action**. Everything must work at ~380px.

---

## 7. Roles & permissions

Three roles on `baby_members.role`:

| Role        | Who                             | Can read | Can create/edit/delete entries | Can manage members & baby settings |
| ----------- | ------------------------------- | -------- | ------------------------------ | ---------------------------------- |
| `owner`     | The parent who created the baby | ✅       | ✅                             | ✅                                 |
| `caregiver` | Other parent / family           | ✅       | ✅                             | ❌                                 |
| `viewer`    | Healthcare professional         | ✅       | ❌                             | ❌                                 |

The `viewer` (read-only healthcare professional) is enforced in the database: write policies only match `owner`/`caregiver`, so a viewer's inserts/updates/deletes are rejected by RLS regardless of the UI. The UI additionally hides all input affordances (the whole Log tab's add/edit controls) for viewers and shows a "read-only access" note.

---

## 8. Information architecture

Single rule: **input lives in Log; the rest is output or admin.**

- **Log — the only tracking input.** Three quick-add flows (Nappy, Feed, Weight), each with an editable `occurred_at` (defaults to now, supports backdating). Plus a "Recent entries" list where existing entries are edited or deleted. This is the only screen that mutates tracking data.
- **Today — output.** Day-of-life hero; KPI cards (wet / dirty / feeds / latest weight vs expected); feeding-today breakdown with the mix badge; "colour to expect" (feeding-aware); weight-loss/gain % vs birth; red-flags card; disclaimer.
- **Weight — output.** The expected-band chart with the baby's plotted weights and the birth-weight reference line; below it, a read-only list of weight entries with % vs birth and expected midpoint.
- **History — output.** Unified reverse-chronological timeline grouped by day-of-life, including nappies (with photo thumbnails + AI verdict chip), feeds (with per-side minutes / ml), and weights. Read-only.
- **Profile — admin.** Baby card (name, address optional, day badge); members list with roles; invite carers / invite a healthcare professional (viewer); edit birth date/time & birth weight (owner only); membership tier. Admin actions are allowed here (this is not tracking data).

Viewers see Today / Weight / History / Profile (read-only) and a disabled/absent Log.

---

## 9. Data model (Supabase / Postgres)

Single polymorphic `entries` table keeps the unified timeline and "weight-in-log" trivial. Ship as a migration.

```sql
-- ENUMS
create type member_role as enum ('owner','caregiver','viewer');
create type entry_type  as enum ('nappy','feed','weight');
create type invite_status as enum ('pending','accepted','revoked');

-- PROFILES (mirror of auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- BABIES
create table babies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_at timestamptz not null,          -- drives day-of-life
  birth_weight_g integer not null,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);

-- MEMBERSHIP (multi-carer + read-only healthcare)
create table baby_members (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null default 'caregiver',
  created_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

-- INVITES (email-based)
create table baby_invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  email text not null,
  role member_role not null default 'caregiver',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users,
  status invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- ENTRIES (nappies + feeds + weights)
create table entries (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  type entry_type not null,
  occurred_at timestamptz not null,        -- EDITABLE; supports backdating
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- nappy
  wet boolean,
  dirty boolean,
  stool_colour text,        -- meconium|transitional|yellow|tan|brown|green|pale|blood

  -- feed
  feed_type text,           -- breast|formula|expressed
  left_min integer,
  right_min integer,
  volume_ml integer,        -- formula or expressed

  -- weight
  weight_g integer,

  -- shared
  note text,
  photo_path text,          -- storage object path for nappy image
  ai jsonb                  -- Claude analysis result
);

create index entries_baby_time_idx on entries (baby_id, occurred_at desc);
create index entries_baby_type_time_idx on entries (baby_id, type, occurred_at desc);

-- updated_at trigger
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger entries_updated_at before update on entries
  for each row execute function set_updated_at();
```

### RLS

```sql
alter table profiles enable row level security;
alter table babies enable row level security;
alter table baby_members enable row level security;
alter table baby_invites enable row level security;
alter table entries enable row level security;

-- SECURITY DEFINER helpers avoid recursive policy evaluation
create or replace function is_baby_member(bid uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from baby_members
                 where baby_id = bid and user_id = auth.uid());
$$;

create or replace function can_edit_baby(bid uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from baby_members
                 where baby_id = bid and user_id = auth.uid()
                   and role in ('owner','caregiver'));
$$;

create or replace function is_baby_owner(bid uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from baby_members
                 where baby_id = bid and user_id = auth.uid() and role = 'owner');
$$;

-- profiles
create policy "own profile read"  on profiles for select using (id = auth.uid());
create policy "own profile write" on profiles for update using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());

-- babies
create policy "member reads baby"  on babies for select using (is_baby_member(id));
create policy "owner updates baby"  on babies for update using (is_baby_owner(id));
create policy "creator inserts baby" on babies for insert with check (created_by = auth.uid());

-- baby_members
create policy "member reads members" on baby_members for select using (is_baby_member(baby_id));
create policy "owner manages members" on baby_members for all
  using (is_baby_owner(baby_id)) with check (is_baby_owner(baby_id));
-- allow a user to insert their OWN membership when accepting an invite (see §13 note)

-- entries: viewers can read but NOT write
create policy "member reads entries" on entries for select using (is_baby_member(baby_id));
create policy "editor inserts entries" on entries for insert with check (can_edit_baby(baby_id));
create policy "editor updates entries" on entries for update using (can_edit_baby(baby_id));
create policy "editor deletes entries" on entries for delete using (can_edit_baby(baby_id));

-- invites: owner manages; invitee can read by matching email
create policy "owner manages invites" on baby_invites for all
  using (is_baby_owner(baby_id)) with check (is_baby_owner(baby_id));
create policy "invitee reads own invite" on baby_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));
```

> Note: the very first `owner` membership row is created in the same transaction as the baby (via a server action or a Postgres trigger on `babies` insert). Invite acceptance is handled server-side with the service role to insert the membership safely (see §13).

### Storage

- Bucket **`nappy-photos`**, private. Object path convention: `{baby_id}/{entry_id}.jpg`.
- Storage RLS on `storage.objects`:
  - read/insert/delete allowed when `is_baby_member((storage.foldername(name))[1]::uuid)` for read, and `can_edit_baby(...)` for insert/delete.
- The client uploads a compressed JPEG (max ~768px, quality ~0.7). The analyze route reads it with the service-role client. Output/History display uses **signed URLs** (short TTL), never public URLs — this is health-adjacent data.

---

## 10. Onboarding & auth

- Login: Supabase email magic link + Google OAuth.
- After first login → `/onboarding`:
  - **Create a baby**: name, date & time of birth, birth weight (g). Creator becomes `owner`. (Default birth date to ~5 days ago is fine as a convenience, per the prototype.)
  - **or Join a baby**: if the user has a pending invite matching their email, show "Join {baby name}" → accept.
- A user can belong to multiple babies; if so, show a baby switcher in the nav header. (MVP can assume one, but model supports many.)

---

## 11. Screen specs

### Log (input only)

Top: a segmented switch **Nappy · Feed · Weight**. Each form includes an **`OccurredAtField`** — a date+time control defaulting to now, freely editable into the past (this is how history is entered). On save, insert an `entries` row with the chosen `occurred_at`.

- **Nappy**: Wet toggle, Dirty toggle (tick both for a combined nappy — one nappy = one wet + one dirty). If Dirty: stool-colour chips (with swatches; pale & blood show an inline red warning). Optional photo → compress → upload → create entry → call analyze route → show AI verdict card. Optional note. Default the colour chip from `expectedColourKey(day, mix)`.
- **Feed**: type segmented **Breast / Formula / Expressed**. Breast → Left (min) + Right (min). Formula/Expressed → ml with 30/60/90 quick chips. Copy reminder on Expressed: _expressed breastmilk counts as breastfeeding for his poo; it's the formula that changes colour and texture._
- **Weight**: grams input (naked, same scales guidance shown). Backdatable. This is the only weight input in the app.
- **Recent entries**: a list of the latest entries across all types with edit + delete (opens the same form pre-filled). This keeps edit/delete inside Log so the output tabs stay read-only.

Editing an existing entry with a photo should allow re-running analysis if the photo or `occurred_at`/feeding context changed.

### Today (output)

Port the prototype's Today: day-of-life hero (amber glow), KPI cards (wet vs `expectedWet(day)`, dirty vs `expectedDirty(day)`, feeds vs 8–12, latest weight vs expected band), feeding-today card with mix badge (breastmilk only / mixed / formula only) and the "watch stools trend tan→yellow-seedy" note when formula is in the mix, colour-to-expect card (feeding-aware), weight loss/gain % vs birth with the 7%/10% thresholds, red-flags card, disclaimer.

### Weight (output)

recharts `ComposedChart`: shaded expected band (low/high) + dashed expected midline + solid line of the baby's actual weights (dots), plus a dashed **birth-weight** reference line. Domain padded. X axis = day-of-life. Below: read-only weight list (grams · Day N · % vs birth · expected midpoint). Emphasise the message: the signal to watch is the line **turning upward**.

### History (output)

Grouped by day-of-life, reverse chronological. Each row: icon or photo thumbnail, label (Feed detail / "Wet + Dirty" / weight), time, stool-colour swatch, AI verdict chip, note. Day header shows totals (wet · dirty · feeds · formula ml). Read-only.

### Profile (admin)

Baby card + day badge; **Members** list (name, role) with **Invite carer** and **Invite healthcare professional (read-only)**; owner-only **Edit birth details**; **Membership**. Show current user's own role. Viewers see this read-only except leaving the baby.

---

## 12. Clinical logic — `lib/clinical.ts` (port from prototype)

Port these pure functions verbatim (they already exist in `NappyTracker.jsx`), keeping them the single source of truth used by both output screens and the AI route:

- `dayOfLife(birthAt, occurredAt)` — **must** take the entry's `occurred_at`, not `Date.now()`, so backdated entries compute correctly.
- `expectedWet(day)`, `expectedDirty(day)`.
- `expectedColour(day, mix)` and `expectedColourKey(day, mix)` — feeding-mix aware (breast/mixed/formula), meconium→transitional in days 1–4 regardless.
- `summariseFeeds(entries)` → `{breastCount, breastMin, formulaMl, expressedMl, sessions, mix}` where `mix` is `breast | mixed | formula | unknown`, and **expressed breastmilk counts as breast** (only formula shifts the stool type).
- `expectedWeightBand(day, birthWeight)` using the anchor table (birth 3800 example): d3≈3625, nadir ~d4, back to birth by ~d10, +150–200 g/week after, with a ±40 g band.
- Red-flags list.

For the AI route and for `mix` used on any given entry, compute `summariseFeeds` over the **24 hours preceding that entry's `occurred_at`** — not the last 24h of wall-clock time — so backdated analysis is correct.

---

## 13. AI stool analysis — `api/entries/[id]/analyze/route.ts`

Server-only Route Handler. Flow:

1. Auth the request (user session) and confirm `can_edit_baby(baby_id)` for the entry.
2. Load the entry + baby. Compute `day = dayOfLife(baby.birth_at, entry.occurred_at)` and `mix`/`feedSummary` from the 24h before `occurred_at`.
3. Read the image from Storage with the **service-role** client; base64-encode.
4. Call the Anthropic Messages API (`https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`, `x-api-key: ANTHROPIC_API_KEY`) or `@anthropic-ai/sdk`, with an image content block + the prompt. Use **structured outputs / a JSON schema** (or a single tool) so the reply is reliably parseable.
5. Parse and write the result to `entries.ai`; return it.

**Model:** default `claude-haiku-4-5` (fast, cheap, vision-capable) — set via `ANTHROPIC_MODEL`. For low-confidence/ambiguous cases you may escalate to `claude-sonnet-5`. All current Claude models support image input. (Confirm current IDs at the models overview in the Claude docs before shipping.)

**Prompt (port from prototype, keep the safety rules intact).** Must include: day of life, birth weight, the "supplemented for dehydration, transitioning to breastfeeding" context, the last-24h **feeding summary**, and the rule that stool type depends on feeding — breastfed/EBM = yellow seedy runny; formula = tan/brown pasty stronger-smelling; mixed = in between — judge against the matching pattern, and note when stools are trending tan→yellow-seedy (a good transition sign).

**Required JSON shape** (unchanged from prototype):

```json
{
  "visibleContents": "poo|wee|both|unclear",
  "colour": "…",
  "consistency": "…",
  "feedTypeLikely": "more breastfed-type|more formula-type|mixed|unclear",
  "matchesExpected": "yes|partly|no|unclear",
  "assessment": "1–2 sentences for this day AND feeding pattern",
  "redFlags": [
    "pale/white/chalky | blood | black tarry after d4 | meconium at d5+"
  ],
  "action": "log_and_continue|mention_at_next_check|contact_midwife_today|seek_urgent_advice",
  "note": "one calm sentence"
}
```

**Hard rules in the prompt:** never give an all-clear that could delay care; pale/white/chalky, blood, or meconium-at-day-5+ → `contact_midwife_today`/`seek_urgent_advice`; do **not** flag normal formula-type tan/brown pasty stool as abnormal when the baby is having formula; unclear image → say what's needed.

Render the result with the action colour-coding from the prototype (green/amber/orange/red) and the chips (colour, consistency, feedTypeLikely, match).

---

## 14. Invites & multi-user flow

- Owner enters an email + role (`caregiver` or `viewer`) → server action inserts a `baby_invites` row and sends a link `${NEXT_PUBLIC_APP_URL}/invite/{token}`.
- Invitee opens the link, logs in / signs up, and the server (service role) verifies the token + email, inserts a `baby_members` row with the invited role, marks the invite `accepted`.
- Enforce role at every layer: RLS for data, and UI gating (viewers get no Log tab and read-only Profile).
- Email delivery: use Supabase Auth email or a provider (Resend). MVP may display the invite link for manual sharing if email isn't wired yet — mark clearly as a stub.

---

## 15. Backdating & historical entry (explicit behaviour)

- The `OccurredAtField` is the mechanism: default now, editable to any past datetime. No "today only" constraints.
- Signing up at day 5 → user enters days 1–4 by creating entries with earlier `occurred_at`. History and Weight populate immediately because everything keys off `occurred_at`.
- Photos can be attached to backdated nappies; analysis uses the day-of-life and feeding mix **as of `occurred_at`**.
- Weight entries are backdatable the same way and feed the chart at the correct day-of-life.

---

## 16. Security & privacy

- This is health-adjacent data about an infant. RLS on every table; **viewer role cannot write** (DB-enforced).
- `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Photos in a **private** bucket; display via short-TTL **signed URLs**; the service role reads them only inside the analyze route.
- Don't log image bytes or PII in server logs. Consider a data-deletion path (delete baby → cascade entries + storage objects).
- Compress/resize images client-side before upload.

---

## 17. Build phases (with acceptance criteria)

**Phase 0 — Scaffold & design system.** Next.js + TS + Tailwind on Vercel; Supabase project; Schibsted Grotesk via `next/font`; palette tokens; base UI (pill buttons, cards, segmented control). _Done when_ a themed empty shell deploys and matches the Nous look on mobile + desktop.

**Phase 1 — Auth & data model.** Migrations for all tables + RLS + storage bucket; magic-link + Google login; `profiles` upsert on sign-in. _Done when_ a user can log in and RLS blocks cross-baby access (verified with two test users).

**Phase 2 — Baby + membership + onboarding.** Create baby (creator→owner), baby switcher. _Done when_ a user creates a baby and is its owner.

**Phase 3 — Log (input).** Nappy/Feed/Weight forms with `OccurredAtField` (backdating), Recent-entries edit/delete. Port `lib/clinical.ts`. _Done when_ all three types can be created, backdated, edited and deleted, and appear in the DB.

**Phase 4 — Output screens.** Today, Weight (recharts), History — all read-only, computing off `occurred_at`. _Done when_ they reflect logged + backdated data correctly, including the expected weight band and feeding-aware colour guidance.

**Phase 5 — Photos + AI.** Storage upload, analyze route, result rendering + persistence, backdating-aware day/mix. _Done when_ a (possibly backdated) nappy photo returns a correctly-framed verdict with the safety rules holding (test pale/white → urgent).

**Phase 6 — Members & roles.** Invite caregiver + read-only healthcare professional; accept flow; UI gating; RLS verified. _Done when_ a viewer can read everything but the DB rejects any write, and a second parent can fully log.

**Phase 7 — Profile/admin & membership polish.** Edit birth details (owner), members management, membership tier. Disclaimers/first-run note. _Done when_ the full IA is navigable and the "Log-only input" rule holds everywhere.

---

## 18. Notes for Claude Code

- **Port, don't reinvent** the clinical logic, prompt, colour swatches, action colour-coding and safety copy from `NappyTracker.jsx`. That prototype is the behavioural reference.
- **Keep the safety framing** exactly: tracking aid not diagnosis; no all-clears that delay care; the specific red flags.
- **Do not invent clinical thresholds** beyond what's in the clinical module.
- **`occurred_at` everywhere** — never compute day-of-life or feeding mix from `Date.now()` in output or analysis; always from the entry's `occurred_at`.
- **Log is the only mutation surface** for tracking data; Today/Weight/History must not contain create/edit/delete controls.
- Enforce roles in **both** RLS and UI; treat RLS as the source of truth.
- Amber is an accent only; positive states are sage green; alerts red — per the palette.

```

```
