# Implementation Prompt — Week 3 Build
### Paste this whole file to your coding agent (Claude Code) to start building.

## Context

I'm building the MVP described in `docs/PACKET.md` in this repo — read that file first for
full context (problem, user, benchmark, flow diagram). Summary: a family-shield tool against
voice-clone extortion. It never analyzes whether a call or video is fake — it reacts to a
labeled, simulated on-device behavioral pattern (unknown-number call, then banking-app activity,
then a transfer above a threshold) by generating an alert script with an LLM and placing a real
outbound phone call to a pre-registered family contact via a voice API.

**Stack:** Next.js (React) on Vercel · Supabase (Postgres + Auth, "Sign in with Google") ·
Gemini (free tier) for alert-script generation · Twilio Voice (free trial, no card required,
verified numbers only) for the real outbound call · all secrets in Vercel environment variables,
never in the repo.

**Non-negotiable:** the system must never claim to detect or judge whether a call, voice, or
video is synthetic. It only ever reacts to a transaction/behavior pattern. This is the Shadow
Clause from the packet — violating it breaks the entire premise of the ship.

## Build in this order — small, testable, one feature per commit

### 1. Project scaffold + Supabase connection
- Next.js app deployed to Vercel (empty page is fine for the first deploy).
- Supabase project created; env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`) set in Vercel, never committed.
- **Acceptance:** app loads at a live Vercel URL; Supabase client connects with no errors.

### 2. Auth — "Sign in with Google" via Supabase Auth
- Single role this week: the family admin managing their own shield configuration.
- **Acceptance:** a real Google account can sign in and land on the setup dashboard;
  signed-out users can't reach any data page.

### 3. Data model + Row Level Security
Tables (all in Supabase Postgres, RLS **ON** for every one):
- `family_contacts` — `id, owner_id, name, phone_e164, verified boolean, created_at`
- `alert_thresholds` — `id, owner_id, min_amount, protected_person_label`
- `risk_events` — `id, owner_id, event_type, amount, payee_label, matched boolean, created_at, is_simulated boolean`
- `alert_calls` — `id, risk_event_id, script_text, call_status, placed_at`
- **Acceptance:** an owner querying any of these tables only ever sees rows where
  `owner_id = auth.uid()`. Verify by attempting a cross-account read and confirming zero rows.

### 4. Family setup — contact + threshold
- Form to add a family contact (name + phone number) and set an alert threshold (amount +
  what counts as "new payee").
- Because Twilio's trial account can only call **verified** numbers, add a verification step:
  send a code via Twilio Verify (or a simple manual confirmation flow) before a contact can
  receive real calls — label clearly if verification is pending.
- **Acceptance:** a contact and threshold can be saved and retrieved; an unverified contact is
  visibly marked as such.

### 5. Simulate Event form + pattern-match logic
- A form clearly labeled "SIMULATED — stands in for an on-device detector" where you input:
  time since unknown-number call, time since banking app opened, transfer amount, payee (new or
  known).
- Server-side logic checks the pattern against the saved threshold — **no ML, no content
  judgment, just the rule** — and writes a `risk_events` row with `matched` true/false.
- **Acceptance:** an event below threshold or to a known payee is logged as `matched = false`
  and triggers nothing further. A qualifying event is logged as `matched = true`.

### 6. LLM alert script generation
- On a matched event, call Gemini to generate a short, calm, specific script referencing the
  actual event details (e.g., "Detectamos una llamada de un número desconocido seguida de un
  intento de transferencia de $8,500 a un destinatario nuevo en la cuenta de [nombre]").
- The prompt to the LLM must explicitly forbid the script from claiming any call or video was
  confirmed fake — only that a pattern was detected.
- **Acceptance:** a matched event produces a script stored in `alert_calls.script_text` that
  never uses words like "confirmed," "verified fake," or similar — only pattern language.

### 7. Voice call placement
- On script generation, call Twilio Voice's API to place a real outbound call to the verified
  family contact's number, using TTS (Twilio's `<Say>` in a TwiML response, in Spanish) to read
  the generated script aloud.
- Log the call status (`initiated`, `completed`, `failed`) in `alert_calls`.
- **Acceptance:** triggering a matched simulated event results in a real phone ringing at the
  verified number, reading the generated script. Confirm by testing with your own verified
  number.

### 8. Alert history display
- Dashboard section showing past risk events and their resulting calls (or lack thereof for
  non-matches), so the family admin can review what happened.
- **Acceptance:** the event and call history for one account is visible only to that account
  (re-confirm RLS here specifically).

## Security floor (check before every deploy)
1. No secrets in code or repo — Vercel env vars only (this includes Twilio credentials).
2. Every page with personal data requires auth.
3. RLS on for every table above.
4. Every form validates input (phone format, amount type/range) before it touches the DB, the
   LLM prompt, or the Twilio API.
5. All seeded/demo data (family contacts used for testing) should be your own real verified
   number for the live demo, or clearly labeled test data — never someone else's real phone
   number without their consent.

## Commit plan (minimum 5 commits, 2 deploys)
1. `scaffold: Next.js + Supabase connection, first deploy`
2. `feat: Google auth`
3. `feat: data model + RLS policies`
4. `feat: family contact + threshold setup, Twilio verification`
5. `feat: simulate-event form + pattern-match logic (labeled simulated)`
6. `feat: LLM alert script generation`
7. `feat: Twilio voice call placement, second deploy`
8. `feat: alert history dashboard`

End every session per the course's Session Close: update `DECISIONS.md` with what happened,
note tomorrow's first move, commit, push.
