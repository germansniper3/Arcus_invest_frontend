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

**Use the design tokens, not literals.** The palette above now exists as custom properties — `--ws-fg`,
`--ws-fg-muted`, `--ws-panel`, `--ws-canvas`, `--ws-border`, `--ws-border-strong`, `--accent`, the
`--fs-*` type scale and the `--space-*` scale. New code starts converted. The only files still on
literals are `PublicSite`, `GreenEngineeringPage`, `DocumentView` and `CounterReceipt` — the dark
marketing site and the printed artefacts, both deliberately excluded, the latter because their
palette is built to survive a monochrome printer.

Two shared classes worth knowing before you improvise one inline:

- **`.btn-ghost`** — the workspace secondary button. `.secondary` is the *marketing site's* (white
  text on a translucent white fill) and is invisible on a white modal card, which is why call sites
  used to hand-roll one and Cancel ended up borderless with a mismatched radius. Matches `.primary`'s
  box so the two sit level in a footer row.
- **`.scroll-x`** — a horizontally scrollable region, for tables carrying a `min-width`. Adds a
  right-edge shadow drawn with `background-attachment: local`, so it appears only at an edge that can
  really scroll, with no scroll listener. Also sets `overscroll-behavior-x: contain`, without which a
  horizontal drag chains to the page and loses to the vertical scroll under a thumb.

For `Badge`, use its `Tone` — there are ten, and zero literal `{bg,fg}` maps remain. Do not add one,
including as a ternary at the call site.

---

## Structure

```
src/
  components/   Modal, Badge, NumberField, Loadable, SectionAction, SectionMetrics,
                DocumentView, NotificationBell, SessionExpiredDialog, SignContractModal
  features/     one folder per workspace section — pipeline, contracts, receivables,
                payables, purchasing, counter, catalogue, accounts, approvals, users,
                students, events, intake, gallery, audit, overview
  lib/          api.ts (client + errorMessage), auth.tsx, permissions.ts (useCan),
                refresh.tsx (useRefreshSignal), adminSections.ts, money.ts, assets.ts
  pages/        PublicSite, Login, ForgotPassword, ResetPassword, ClaimInvitation, Admin, Student
  types/        shared API types, typed against the Go handlers
```

`AdminPage.tsx` is the shell: the rail, the header and the section slots. Each section is **its own
URL segment** (`/admin/pipeline`, `/admin/purchasing`), so a section can be linked and the back
button walks between them; bare `/admin` normalises to the canonical section URL.

Sections stay **mounted** and only their body is conditional on `active`. Radix restores focus on the
open→closed transition, and an unmounted dialog never emits one — the keyboard user gets dropped at
`<body>`. It is also why the section transition is driven by an alternating attribute rather than a
`key`: re-keying the wrapper would remount every section on each tab change.

Adding a section is a checklist, and one step fails the build on purpose. `ALL_RESOURCES` is derived
from a `Record<PermissionResource, true>` in `lib/adminSections.ts`, because the hand-maintained array
had silently drifted to 17 of 19 members and two resources could not be granted at all. So adding to
the `PermissionResource` union **fails typecheck until you give it a row** — that is intended; do not
widen the type to escape it. Then: `ADMIN_TABS`, `TAB_RESOURCE`, the rail entry and header title in
`AdminPage.tsx`, the render **inside** the `.section-swap` wrapper (outside it there is no enter
animation), `useRefreshSignal()` in the section, and the server-side permission.

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
