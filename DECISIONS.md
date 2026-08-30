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
