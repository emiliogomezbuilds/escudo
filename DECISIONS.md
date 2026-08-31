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

- Confirmed live: submitted both a matching event (checked "nuevo", amount over threshold) and a
  non-matching one (unchecked "nuevo") on `https://escudo-sandy.vercel.app/dashboard` — feedback
  message correctly differed between the two ("Patrón coincide" vs "Sin coincidencia").
- Built Feature 6 (Gemini alert script generation):
  - User provided a `GEMINI_API_KEY` directly in chat. Per my safety rules I never enter API keys,
    passwords, or other credentials into any field or system myself, even when a user hands one over
    for that exact purpose — so I did not set this in Vercel. **Action needed from the user**: add
    `GEMINI_API_KEY` in Vercel → escudo → Settings → Environment Variables (all environments), using
    the value they already generated in Google AI Studio.
  - `lib/gemini.ts` — `generateAlertScript()` calls the Gemini API (`@google/genai`, the current
    unified SDK; old `@google/generative-ai` is deprecated) via the Interactions API
    (`ai.interactions.create`), model `gemini-3.7-flash`. A system instruction explicitly forbids
    the model from claiming any call/voice/video was confirmed, verified, real, fake, cloned,
    synthetic, or AI-generated — consistent with the Shadow Clause. `isSafeScript()` is a code-level
    backstop: a regex denylist (falso/fake/deepfake/clonad-/sintétic-/confirm-/verific-) scans the
    model's output regardless of the system instruction, and `fallbackScript()` — a canned,
    template-filled sentence using only the event's own data — is used instead whenever the key is
    missing, the API errors, or the output fails that check. This means the "never claims
    authenticity" guarantee never actually depends on the model behaving.
  - Wired into `simulateRiskEvent` (`app/dashboard/actions.ts`): on a matched event, generates the
    script and inserts an `alert_calls` row (`script_text`, `call_status: "pending"` — Feature 7 will
    place the real call and update that status). The action now returns `scriptText` too.
  - `components/simulate-event-form.tsx` now shows the generated script text inline after a matching
    submission, so this can be verified without waiting for Feature 8's history view.
  - `npm install @google/genai` succeeded in this sandbox (unlike `next build`, plain npm registry
    reads/installs do have network access here) — `package.json`/`package-lock.json` updated for
    real, not hand-edited.
  - Checked: `npx tsc --noEmit` and `npm run lint` both clean. Untested against the live Gemini API
    (no key in this sandbox) — until the user adds the key to Vercel, matched events will silently
    use `fallbackScript()` rather than erroring, which is deliberate graceful degradation, not a bug.

- User added `GEMINI_API_KEY` to Vercel themselves (Settings → Environment Variables, all
  environments), pushed, deploy succeeded. **Confirmed live**: submitted a matching event and got a
  genuine Gemini response (~1 minute round trip, not the instant fallback) — specific to the actual
  event data ("Doña Mari", "$8,500 pesos", "cuenta nueva"), calm, asks the contact to call and check
  in directly, and contains no forbidden authenticity language (no "confirmado"/"falso"/"clonado"/
  etc. — `isSafeScript()` didn't need to intervene, but would have). Feature 6 fully verified
  end-to-end.

- User created a Twilio trial account (product: Twilio, not Flex), got a trial phone number, and
  verified a Caller ID (`+52 55 4090 1948`) in the Twilio Console. Added `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to Vercel themselves (same credential-handling rule as
  Gemini — I never enter API keys/tokens myself).
- Built Feature 7 (Twilio Voice call placement):
  - `lib/twilio.ts` — `placeAlertCall(toNumber, scriptText)` using the `twilio` npm package
    (`npm install twilio`, real install not hand-edited). Builds TwiML with `<Say language="es-MX">`
    reading the script aloud, and passes it **inline** via the Calls resource's `twiml` parameter
    (confirmed this parameter exists by reading the installed package's own `.d.ts`) rather than
    requiring a separately hosted TwiML webhook endpoint — simpler for a one-shot announcement call
    with no caller input to handle. Returns `{ ok, callSid, status }` or `{ ok: false, error }`,
    never throws.
  - Wired into `simulateRiskEvent`: on a matched event, after generating the script, looks up the
    owner's first `verified = true` family contact and calls `placeAlertCall`. Updates the
    `alert_calls` row's `call_status` to `"initiated"` or `"failed"` (with the Twilio error message
    returned to the UI, not swallowed) rather than leaving it at the placeholder `"pending"`. If no
    verified contact exists, logs `"failed"` with an explanatory message instead of silently no-oping.
  - `components/simulate-event-form.tsx` now shows the real call outcome inline (green "llamada real
    iniciada" or amber "no se pudo colocar la llamada" with the reason).
  - **Two layers of "verified" now exist and are easy to confuse**: our app's own `family_contacts
    .verified` flag (the "Confirmar número" button — a manual admin confirmation) is what gates
    whether `simulateRiskEvent` will even attempt a call. Twilio's own Verified Caller IDs (trial
    account restriction) is what gates whether Twilio will actually *place* that call. A contact can
    be verified in our app but not in Twilio, in which case `call_status` will show `"failed"` with
    a Twilio authorization error — that's expected on a trial account calling any number besides the
    one verified in the Twilio Console.
  - Checked: `npx tsc --noEmit` and `npm run lint` both clean. Not yet tested against the live
    Twilio API (no credentials in this sandbox) — next session should push, then run a matching
    simulated event and confirm the verified number actually rings.

- Pushed, deploy succeeded. **Confirmed live, twice**: first attempt failed with a real, specific
  Twilio error (`Account not authorized to call +525540901948. Perhaps you need to enable some
  international permissions...`) — a Mexico geo-permissions restriction Twilio applies by default,
  unrelated to our code; surfaced correctly in the UI instead of failing silently. User enabled
  Mexico under Twilio Console → Voice → Geo Permissions → Low-Risk, resubmitted the same event, and
  the verified phone **actually rang** and read the generated script aloud. `call_status` logged
  `"initiated"`. Feature 7 fully verified end-to-end.
  - Side note from testing: the two verified-contact test rows now both matter for later cleanup —
    "Test Contacto" (`+525571703533`, confirmed in our app but never verified in Twilio) is still in
    the list purely as demo/test data per the security floor in `docs/BUILD_PROMPT.md` §Security
    floor item 5; fine to leave for now since it's the user's own test data, not someone else's real
    number, but worth deleting before treating this as a finished deliverable.

- Built Feature 8 (alert history dashboard), the last feature in `docs/BUILD_PROMPT.md`:
  - `components/alert-history-list.tsx` — renders each `risk_events` row (amount, payee, matched/
    no-match badge, SIMULADO tag, timestamp) and, when one exists, its `alert_calls` row nested below
    (call status badge + the script text that was read aloud).
  - `app/dashboard/page.tsx` — added a third Supabase query using PostgREST's embedded-resource
    syntax (`risk_events.select("...alert_calls(...)")`) rather than a second round trip, ordered
    newest-first, capped at 20. Rendered as a fourth card, "Historial de alertas".
  - RLS coverage: this is a nested select across two tables, each still governed by its own policy —
    `risk_events` by `owner_id = auth.uid()` directly, `alert_calls` by the `exists (... risk_events
    ... owner_id = auth.uid())` policy from `supabase/schema.sql`. No new policy needed; re-confirms
    `docs/PACKET.md` test plan item 4 by construction, not by inspection alone — still worth the
    user manually confirming with a second account before calling this fully verified.
  - Checked: `npx tsc --noEmit` and `npm run lint` both clean.

**Not done yet**
- Nothing — all 8 features from `docs/BUILD_PROMPT.md` are now built. Remaining work is
  verification, not construction: push, confirm the deploy, and run the full test plan.

**Tomorrow's first move**: push this commit, confirm the deploy builds, then on
`https://escudo-sandy.vercel.app/dashboard` confirm the "Historial de alertas" card shows both the
matched and non-matched events from this session's testing, each matched one showing its script and
call status. Then run the remaining items from `docs/PACKET.md` §10 test plan as a final pre-delivery
pass: RLS test (sign in with a second Google account, confirm zero rows visible), mechanical pass
(fresh end-to-end run, fix anything found), persona test (walk through the setup screen as if new).
Also worth deleting the unverified "Test Contacto" row before calling this done, per the security
floor's demo-data note.
