# StudioSpace server

Single-file Express 5 + MongoDB API. Not a monorepo: the Next.js client is a separate project at `../studiospace-client` (see its `AGENTS.md`). No tests, lint, build, TypeScript, or ODM — `index.js` is the entire app and `seed.js` is the only other source file.

## Commands

- `npm install`
- Copy `.env.example` → `.env` before anything else; `.env` is gitignored and absent on a fresh clone, so the app cannot reach MongoDB without it.
- `npm run dev` — `node --watch index.js` on `:5000` (`PORT`).
- `npm start` — plain node, same port.
- `npm run seed` — demo studios. It only deletes/reinserts docs with `ownerEmail: "host@studiospace.dev"`; it does not reset the DB, and other studios/bookings are untouched.
- Verification: `node --check index.js` (and `seed.js`) for syntax, then curl the route against `npm run dev`. There is no test suite to run.

## Env gotchas

- Code defaults `DB_NAME` to lowercase `studiospace`, but the client's Atlas DB is `StudioSpace`. The lowercase name is rejected on the existing cluster with Mongo error 13297 (`db already exists with different case`); set `DB_NAME=StudioSpace`.
- `JWT_SECRET` must be byte-identical to the client's `.env.local`; any mismatch makes every authed route return 401.
- `CLIENT_URL` is a comma-separated origin allowlist for credentialed CORS. It is split without trimming — no spaces after commas. Port 5000 here must match the client's `API_URL`.
- `.env.example` is committed and includes a live-looking Atlas URI and the shared JWT secret. Keep it in sync with the client, but never commit `.env`.

## Architecture

- `getDb()` lazily connects once and creates the `bookings` index `{studioId, status, startAt, endAt}`. Middleware puts `req.db` on every request; collections are `studios` and `bookings`.
- Auth is cookie-only: `requireAuth` verifies `req.cookies.ss_token` and sets `req.user` (`email`, `name`, `image`). It never reads an `Authorization` header. See README for which routes are protected.
- Keep `GET /api/studios/mine` declared before `GET /api/studios/:id`, or `mine` gets parsed as an ObjectId.
- Studios pass through `cleanStudio` + `validStudio`; `PUT` is a full replace (`$set`), not a partial patch. Ownership is `studio.ownerEmail === req.user.email`.
- Bookings store `studioId` as a **string**, while studio `_id` is an ObjectId. Convert with `String(studio._id)` and validate path ids with `oid()`; mixing the two silently matches nothing.
- Booking times are UTC: `toDates` builds `${date}T${time}:00Z`. Don't replace it with `new Date(date + " " + time)` (server-local). Overlap is half-open `[startAt, endAt)` and checked only against `status: "Confirmed"` — on create and again on Pending→Confirmed — returning 409.
- Booking status changes are a whitelist in `PATCH /api/bookings/:id` (guest: cancel Pending; host: confirm Pending, complete Confirmed, cancel Pending/Confirmed). Extend that table instead of adding ad-hoc checks.
- `app.listen` is skipped when `VERCEL` is set and `app` is exported default for serverless. Don't remove the export or move `listen`.
- Response field names are a typed contract with the client (`../studiospace-client/src/lib/types.ts`); adding/renaming a field means updating those types too.

## Repo quirk

Git toplevel is `C:\Users\TAHSIN` (home directory, zero commits), not this folder. `git status`/`git diff` dump the entire home directory and cannot scope changes; verify edits by file path.
