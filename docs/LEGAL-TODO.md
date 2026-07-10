# Legal & compliance — before going live

These pages are **drafts, not legal advice**. Because hearth handles special
category (health) data about infants, get them reviewed by a solicitor before
you rely on them publicly.

## 1. Fill in the placeholders
All operator/legal details live in one file: **`lib/legal.ts`**. Replace:
- `OPERATOR` — your legal name (or company name once formed)
- `CONTACT_EMAIL` — a real privacy/support inbox
- `WEBSITE` — your live domain
- `LAST_UPDATED` — bump whenever you change the documents

## 2. Register with the ICO (likely required)
As an individual/sole trader processing personal data electronically, you most
likely must pay the ICO **data protection fee** (Tier 1, ~£40–60/year) and
register as a data controller. Check with the ICO self-assessment:
https://ico.org.uk/for-organisations/data-protection-fee/

## 3. Consider forming a company
There is currently **no registered company**. Operating as an individual means
you are personally the data controller and personally liable. A limited company
would ring-fence liability — worth discussing with an accountant/solicitor
given this is health-adjacent.

## 4. Medical device / MHRA
hearth is positioned as a **tracking aid, not a medical device** — it doesn't
diagnose, and the AI is a labeller that never gives an all-clear. Keep it that
way. If you ever add diagnostic claims or clinical decision support, it could
fall under UK Medical Device Regulations (MHRA) and need registration. Get
advice before changing the framing.

## 5. Sub-processors & transfers
The privacy policy names Supabase (EU), Anthropic (US), and Vercel. Confirm:
- Data Processing Agreements are in place with each.
- International transfer safeguards (UK IDTA / SCCs) cover Anthropic (US).
- Region settings keep data in the EU/UK where possible.

## 6. Age gate & consent
Terms require users to be 18+ and the baby's parent/carer. Consent for health
data is obtained by use; deletion withdraws it. A solicitor should confirm this
is sufficient for your setup.

## Pages
- `/` landing, `/privacy`, `/terms`, `/cookies`, `/disclaimer`
- Linked from the landing footer and the login screen.
