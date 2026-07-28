# Arcus Investments — Frontend

React 19 + TypeScript single-page app serving the Arcus public site, the Innovation Hub student
portal, and the commercial admin back office.

**Live:** [arcusinvest.up.railway.app](https://arcusinvest.up.railway.app)

The API lives in a separate repository (`Arcus_invest_backend`). Full system documentation —
architecture, security model, API reference, operations — is in that repo under `docs/`.

---

## Running it

```bash
npm install
cp .env.example .env
npm run dev -- --port 5179
```

`VITE_API_BASE_URL` is the only configuration. Point it at a running API (`http://localhost:8032/api/v1`
by default).

If you run on a port other than 5179, add that origin to `CORS_ORIGINS` on the API. The refresh
cookie is sent with credentials, and browsers refuse credentialed requests against an origin that is
not explicitly allowed — a missing origin breaks sign-in outright rather than degrading.

```bash
npx tsc --noEmit && npm run build
```

---

## Styling

**No Tailwind, no component kit.** Plain CSS in `src/styles.css` plus inline `style={{}}` props.
Radix primitives are used for behaviour only (dialogs: focus trapping, escape handling, portals) and
are styled by the existing CSS.

The palette, if you are adding UI: `#111512` text, `#5a625d` labels, `#8a908a` muted, `#f7f8f3`
input background, `#dfe1da` borders, `#5f7c29` accent, `#a00` danger.

---

## Structure

```
src/
  components/   Modal, NumberField, NotificationBell, SessionExpiredDialog, SignContractModal
  lib/          api.ts (client), auth.tsx (session context), assets.ts
  pages/        PublicSite, Login, ForgotPassword, ResetPassword, ClaimInvitation, Admin, Student
  types/        shared API types, kept in step with the Go models
```

`AdminPage.tsx` holds every admin section in one component; sections are local state rather than
routes, so the admin area is a single URL.

---

## Three things that are easy to break

**Modals are driven by an `open` prop and stay mounted.** Do not conditionally render a `<Modal>`.
Focus restoration is handled manually because Radix restores to a `<Dialog.Trigger>` these dialogs
do not have, and unmounting defeats it.

**The session dialog must never clear `user`.** When a session expires, `SessionExpiredDialog`
renders *over* the app. Clearing `user` — or redirecting to `/login` — unmounts the admin tree and
destroys every open form, including the contract `File` handle and the signature canvas, neither of
which can be serialised and restored. That is the entire reason the dialog exists.

**Route gating asks about permissions, not roles.** `canReachAdmin()` reads the permissions payload
from `/auth/me`. A hardcoded role list here is a second source of truth that drifts from the
backend's — it did, and every custom role was locked out of the app by an infinite redirect.

---

## API client behaviour

`src/lib/api.ts` centralises three things every call inherits:

- **Cold-start retry** — the API sleeps when idle; network failures are retried with backoff. Safe
  methods only. An HTTP status is an answer and is never retried, and a POST is never replayed on a
  guess.
- **Transparent refresh** — a 401 triggers a single *shared* refresh and one replay. Shared because
  refresh tokens rotate, so concurrent refreshes look like a replay attack and would revoke the
  session.
- **`ApiError`** — carries HTTP status and the full response body, so callers can tell "blocked
  pending approval" (409 with an `approval_request_id`) from an ordinary failure.
