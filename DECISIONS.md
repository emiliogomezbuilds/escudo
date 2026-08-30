# DECISIONS

## Session 1 — 2026-08-30 — Feature 1: scaffold + Supabase connection

**What happened**
- Scaffolded the app with `create-next-app -e with-supabase` (Next.js App Router, TypeScript,
  Tailwind, shadcn/ui) — merged into repo root alongside existing `docs/`, `README.md`,
  `manifiesto.md`.
- Created a Vercel project (`emilio-builds/escudo`), linked to this repo's GitHub remote
  (`emiliogomezbuilds/escudo`).
- User created the Supabase project directly (I can't complete OAuth/password logins on their
  behalf); they pasted the Project URL, anon/publishable key, and service_role key back into
  chat. Set as Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) across development/preview/production — never committed.
- Verified the anon key and service_role key both authenticate against the live Supabase project
  (REST endpoint returns a clean PGRST205 "table not found" for anon, 200 for service_role —
  i.e. real auth, not a connection failure).
- Deployed to production: **https://escudo-sandy.vercel.app** — loads with no "Connect Supabase"
  warning banner, confirming the client picks up real env vars in prod.
- Fixed `.gitignore` so `.vercel link`'s blanket `.env*` addition didn't also swallow
  `.env.example` (re-added a negation so the template stays committed).
- Expanded `.env.example` to document the full var set from `docs/BUILD_PROMPT.md`
  (`GEMINI_API_KEY`, `TWILIO_*`) even though only the Supabase vars are wired up yet.

**Naming deviation from BUILD_PROMPT.md**: used `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of the literal `SUPABASE_URL` / `SUPABASE_ANON_KEY`
named in the prompt — this is the current Supabase/Next.js SSR convention (the starter template's
code reads these exact names; `NEXT_PUBLIC_` is required for the browser client to see them,
"publishable key" is Supabase's current name for the anon key).

**Not done yet (by design — stopped after Feature 1 per instruction)**
- Feature 2 (Google sign-in via Supabase Auth) — Google OAuth provider not yet enabled in
  Supabase; app has the auth UI scaffolded (from the starter) but no Google provider wired.
- Data model / RLS, family setup, simulate-event logic, Gemini script generation, Twilio calling,
  alert history — all pending per `docs/BUILD_PROMPT.md`.

**Tomorrow's first move**: enable Google as an OAuth provider in the Supabase dashboard
(Authentication → Providers), then build Feature 2 per `docs/BUILD_PROMPT.md`.

## Session 2 — 2026-08-30 — Feature 2 (Google auth), Feature 3 (data model + RLS), Feature 4 (family setup)

**What happened**
- Enabled Google as an OAuth provider in Supabase (Authentication → Sign In / Providers), using a
  Google Cloud OAuth client. Set Supabase **URL Configuration**: Site URL
  `https://escudo-sandy.vercel.app`, Redirect URLs for both the production domain and
  `localhost:3000`.
- Verified end-to-end: signing in with Google at `/auth/login` lands on `/dashboard`, showing the
  signed-in email; the route redirects unauthenticated visitors to login (confirmed via
  `WelcomeMessage`'s `getClaims()` check).
- Created the four tables from `docs/BUILD_PROMPT.md` §3 in the Supabase SQL Editor, all with RLS
  **on** and an `owner_id = auth.uid()` policy (or, for `alert_calls`, ownership via its parent
  `risk_events` row): `family_contacts`, `alert_thresholds`, `risk_events`, `alert_calls`. Ran
  successfully ("Success. No rows returned"); confirmed all four appear in Table Editor with the
  RLS lock icon. Saved the exact SQL to `supabase/schema.sql` for version-controlled reference
  (not auto-applied by any migration tool yet — run manually in the SQL Editor if reproducing).
- Built Feature 4 (family contact + threshold setup) in the app:
  - `app/dashboard/actions.ts` — server actions `addFamilyContact`, `verifyFamilyContact`,
    `deleteFamilyContact`, `saveThreshold`. Inputs validated server-side (E.164 phone regex,
    threshold > 0) before touching the DB. Inserts rely on `family_contacts.owner_id` /
    `alert_thresholds.owner_id` defaulting to `auth.uid()`, using the request-scoped
    (cookie-authenticated) Supabase client — never the service-role key.
  - `components/family-contact-form.tsx`, `components/threshold-form.tsx` — client forms using
    `useActionState` for inline error/success feedback.
  - `components/family-contact-list.tsx` — lists saved contacts with a verified/pending badge and
    per-row "Confirmar número" / "Eliminar" buttons (server actions bound with `.bind(null, id)`).
  - `app/dashboard/page.tsx` rewritten to fetch contacts + threshold server-side and render both
    cards, replacing the "coming soon" placeholder text.
- **Verification approach deviates from a literal reading of BUILD_PROMPT.md §4**: no Twilio
  credentials exist in this project yet (`.env.local` only has the Supabase vars — `GEMINI_API_KEY`
  and `TWILIO_*` are still blank in `.env.example`), so contact verification here is the explicitly
  allowed fallback — "a simple manual confirmation flow" — not Twilio Verify. A contact starts
  `verified = false` and is visibly badged "Verificación pendiente"; the owner clicks "Confirmar
  número" to flip it to `true`. Real Twilio Verify (or keeping this manual flow deliberately) should
  be revisited once Twilio credentials exist, alongside Feature 7 (voice call placement).
- Checked: `npm run lint` and `npx tsc --noEmit` both clean. `npm run build` could not run in this
  sandbox (no network access to fetch the Turbopack/SWC binary) — this is a sandbox limitation, not
  a code issue; Vercel's build environment has this cached and should build normally.

- **Build failures after the first push, both fixed the same session**: the initial Feature 4
  deploy failed prerendering `/dashboard` (`Error occurred prerendering page "/dashboard"`) because
  the new page made the whole component async and read cookies/queried per-user rows directly, with
  no `<Suspense>` boundary — this project has `cacheComponents: true` in `next.config.ts` (Next.js
  Cache Components), which tries to prerender a static shell and needs dynamic/per-request work
  isolated behind Suspense to bail out of that shell cleanly. Adding `export const dynamic =
  "force-dynamic"` (the old App Router escape hatch) made it worse — that flag is explicitly
  incompatible with `cacheComponents` and failed the build outright with a clearer error naming the
  conflict. Fix: reverted to the original scaffold's actual pattern (which had worked) — an inner
  async `FamilyDashboardContent` component holding all cookie/DB-dependent code, wrapped in
  `<Suspense>` in the page's default export. Lesson for future features: any new Server Component
  that touches `cookies()` or per-user Supabase queries must go inside a Suspense-wrapped
  subcomponent, not directly in the page body.
- Confirmed live end-to-end after the fix: added a contact ("Test Contacto"), saved a threshold
  ("Doña Mari", 3000) — both persisted and rendered correctly on
  `https://escudo-sandy.vercel.app/dashboard`.
- Built Feature 5 (simulate-event form + pattern-match logic):
  - `simulateRiskEvent` server action in `app/dashboard/actions.ts` — validates inputs (minutes
    since unknown call, minutes since bank app opened, transfer amount, payee label, payee-is-new
    checkbox), loads the owner's saved threshold (errors if none saved yet), and computes `matched`
    with a **plain boolean rule, no ML**: payee is new AND amount > saved threshold AND the call was
    within the last 30 minutes AND the app-open was within the last 15 minutes AND the call happened
    before (or same time as) the app-open. Writes a `risk_events` row either way
    (`is_simulated: true`), consistent with the Shadow Clause — no content/media judgment anywhere
    in this logic.
  - `components/simulate-event-form.tsx` — client form, clearly bannered "DATOS SIMULADOS", shows
    inline "patrón coincide" vs "sin coincidencia" feedback after submit; blocked with a message if
    no threshold is saved yet.
  - Wired into `app/dashboard/page.tsx` as a third card.
  - Checked: `npx tsc --noEmit` and `npm run lint` both clean.

**Not done yet**
- Gemini alert script generation (Feature 6).
- Twilio Voice call placement + real Twilio Verify for contacts (Feature 7).
- Alert history dashboard (Feature 8).

**Tomorrow's first move**: push this commit, confirm the Vercel deploy builds and the simulate-event
form works end-to-end on `https://escudo-sandy.vercel.app/dashboard` (submit a matching event, then
a non-matching one — e.g. known payee or amount under threshold — and confirm the feedback message
differs), then start Feature 6 (Gemini alert script generation) per `docs/BUILD_PROMPT.md`. Will need
`GEMINI_API_KEY` set in Vercel env vars before that feature can be tested live.
