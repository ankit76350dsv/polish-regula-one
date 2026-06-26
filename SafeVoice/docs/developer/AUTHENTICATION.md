# SafeVoice Authentication — Developer Guide

How staff sign in to SafeVoice, explained in plain language so a new developer can
understand it in one read. No prior knowledge of our auth code assumed.

> **TL;DR.** SafeVoice has **no login form of its own**. Staff sign in once on the central
> **RegulaOne** page; that sets a shared cookie; SafeVoice just checks "is that cookie
> valid?" on every visit. This is **Single Sign-On (SSO)**. The public report pages stay
> open to anonymous whistleblowers — they are never asked to sign in.

---

## 1. The mental model (read this first)

Picture an office building:

- **RegulaOne** is the building's **front desk**.
- **SafeVoice** is **one office** inside that building (KSeFFlow, WorkPulse… are other offices).
- You sign in **once** at the front desk and get a **wristband**.
- Each office only checks *"do you have a valid wristband?"* — it never asks for your password.

That wristband is a **cookie**: a small piece of data the browser stores and **automatically
sends** to the backend on every request.

Two facts about the wristband that drive every design decision:

1. **It is `httpOnly`.** Our JavaScript **cannot read it** — only the browser and the backend
   can. So even if a hacker injects evil JavaScript (an XSS attack), they still cannot steal
   it. We never store a token in `localStorage` or in Redux.
2. **It is shared across the whole RegulaOne domain.** One sign-in works for every module.

---

## 2. Key words (the only jargon you need)

| Word | Plain meaning |
|---|---|
| **SSO** | Sign in once, get into everything. |
| **Cookie** | The "wristband" the browser carries and shows automatically. |
| **`credentials: "include"`** | The line in our fetch calls that says "browser, please attach the cookie." |
| **`/api/auth/me`** | The backend question: *"Here's my cookie — who am I?"* |
| **Token refresh** | Quietly swapping an about-to-expire wristband for a fresh one. |
| **Redux** | A central memory box that remembers "are you signed in, and who are you?" so the whole app agrees. |
| **Thunk** | A Redux action that does async work (like a network call) before saving the result. |
| **Gate / guard** | A component that decides "show the page" vs "send you to login." |

---

## 3. The flow in one picture

```
  You open SafeVoice
        │
        ▼
  initSession ──→ GET /api/auth/me   (browser attaches the cookie automatically)
        │
   ┌────┴───────────────┬─────────────────────┐
   ▼                    ▼                     ▼
 200 OK              401 (no cookie)        no answer / timeout
 status:             status:                status:
 "authenticated"     "unauthenticated"      "error"
   │                    │                     │
   ▼                    ▼                     ▼
 AuthGate shows      <Login> redirects      "Try again" button
 the staff page      to RegulaOne ──┐       (re-runs the check)
                                    ▼
                       you sign in on RegulaOne (type password THERE)
                                    │
                                    ▼
                       browser returns to /auth/sso-callback
                                    │
                                    ▼
                       App forwards you to /dashboard ✅

  (in the background, every ~55 min: silently refresh the wristband)
```

---

## 4. The flow step by step

### Step 1 — App wakes up and asks "Who am I?"

When SafeVoice loads, [`App.jsx`](../../frontend/src/App.jsx) immediately dispatches one thing:

```js
useEffect(() => { dispatch(initSession()); }, [dispatch]);
```

`initSession` (a **thunk** in [`authSlice.js`](../../frontend/src/slices/authSlice.js)) calls
`fetchMe()` in [`authService.js`](../../frontend/src/services/authService.js), which asks the
RegulaOne backend:

> **`GET /api/auth/me`** → "Here's my cookie. Who am I?"

We **never touch the cookie** — the browser attaches it because every call uses
`credentials: "include"`.

### Step 2 — The backend gives one of three answers

[`authSlice.js`](../../frontend/src/slices/authSlice.js) records which one happened in a single
field called `status`:

| Backend reply | Meaning | `status` becomes |
|---|---|---|
| `200` with user data | Valid cookie ✅ | `authenticated` |
| `401` "I don't know you" | No / expired cookie | `unauthenticated` |
| *(no reply / timeout)* | Server down or wrong address | `error` |

This answer lives in **Redux** so the whole app reads the same truth. We ask **once**, not
on every page.

### Step 3 — The bouncer at the staff door

Staff pages are wrapped in [`AuthGate.jsx`](../../frontend/src/components/auth/AuthGate.jsx).
It reads `status` from Redux and decides what to show — in this exact priority:

```
loading?          → spinner ("Verifying your session…")
error?            → "Try again" button
unauthenticated?  → <Login> (which redirects to RegulaOne)
no permission?    → the "access blocked" modal
all good?         → the real page ✅
```

> 🔑 **Public pages are NOT behind the bouncer.** `/report` and `/track` render directly so an
> anonymous whistleblower can use them without signing in. This is a **legal requirement**
> (EU Directive 2019/1937 + the Polish 2024 Whistleblower Act), enforced in
> [`App.jsx`](../../frontend/src/App.jsx) via the `STAFF_PREFIXES` list.

### Step 4 — Not signed in? Go to the front desk

If `status === "unauthenticated"`, [`Login.jsx`](../../frontend/src/components/auth/Login.jsx)
runs. It shows no form — it sends the browser to the RegulaOne login page and leaves a note
saying "send them back here afterwards":

```js
window.location.href = `${CENTRAL_LOGIN_URL}?redirect_uri=${returnTo}`;
//                                            └── "come back to /auth/sso-callback"
```

### Step 5 — Sign in, then come back

You type your password **on RegulaOne** (never on SafeVoice). RegulaOne sets the cookie and
sends the browser back to `…/auth/sso-callback`. This effect in
[`App.jsx`](../../frontend/src/App.jsx) notices you're back **and** now authenticated, and
forwards you to where you were going:

```js
if (isAuthenticated && currentPath === "/auth/sso-callback") {
  navigate(returnPath || "/dashboard");
}
```

✅ You're in. Steps 1–5 take a couple of seconds.

---

## 5. Two safety nets (the tricky parts)

### Net 1 — The wristband expires every hour → silent refresh

The login token only lasts about an hour. Instead of kicking the user out, we quietly get a
fresh one. There are two layers:

- **Reactive** — in [`api.js`](../../frontend/src/services/api.js): if any request returns
  `401`, we call `POST /api/sso/refresh` **once**, then **retry the original request**. The
  user sees nothing.

  ```js
  if (res.status === 401) {
    if (!_retry && await tryRefreshSession()) {
      return apiFetch(path, options, true);  // retry the SAME request once
    }
    redirectToLogin();                        // refresh failed → really logged out
  }
  ```

- **Proactive** — in [`App.jsx`](../../frontend/src/App.jsx): a timer refreshes every
  **55 minutes**, just before the hour is up, so active users rarely even hit a 401.

### Net 2 — The "page keeps reloading" loop guard

Sometimes the cookie is valid at the front desk but **rejected at the office** (common after a
machine's IP address changes). Without protection you get:

```
office → "go to login" → login → "you're fine, go back" → office → "rejected!" → login → … forever
```

To the user that looks like the page **reloading by itself, endlessly**. So
[`api.js`](../../frontend/src/services/api.js) **counts redirects**: more than **3 in 30
seconds** = a loop. We then **stop**, fire a `safevoice:sso-loop` event, and
[`Login.jsx`](../../frontend/src/components/auth/Login.jsx) shows a friendly explanation
instead of reloading again.

---

## 6. "Are you *allowed* in SafeVoice?" (separate from "are you signed in?")

Being signed in is not the same as being allowed into **this** module. A user might have a
valid RegulaOne account but their company never bought SafeVoice. That rule lives in one pure
function, [`utils/access.js`](../../frontend/src/utils/access.js):

| Reason | Meaning | What the user sees |
|---|---|---|
| `unauthenticated` | not signed in | → login redirect |
| `disabled` | account switched off | blocking modal |
| `module` | plan doesn't include SafeVoice | blocking modal |
| `package` | subscription expired | blocking modal |
| `null` | allowed ✅ | the page |

`Super Admin` (the platform operator) bypasses the module/plan checks — but a **disabled**
account is always blocked first, even for them.

---

## 7. Signing out

The Sign out button (sidebar + navbar) dispatches `signOut` in
[`authSlice.js`](../../frontend/src/slices/authSlice.js):

1. `POST /api/sso/logout` → the backend **deletes the cookie**.
2. The browser is sent to the central logout page.

No cookie means the next visit answers `401` at Step 2, and the flow starts over.

---

## 8. The file map

Everything follows the project's mandatory **Redux Toolkit** structure
(`store` / `slices` / `services`).

| File | Its job in plain words |
|---|---|
| [`services/api.js`](../../frontend/src/services/api.js) | The "phone line" to the backend: attaches the cookie, unwraps responses, handles expired cookies (refresh + retry), and runs the loop guard. |
| [`services/authService.js`](../../frontend/src/services/authService.js) | The two specific calls — `fetchMe()` ("who am I?") and `logout()` — plus RegulaOne → SafeVoice role mapping. |
| [`slices/authSlice.js`](../../frontend/src/slices/authSlice.js) | The **memory**: `status`, `user`, `error`, `ssoLoop`, and the `initSession` / `signOut` thunks. |
| [`store/store.js`](../../frontend/src/store/store.js) | The box that holds that memory for the whole app. |
| [`components/auth/AuthGate.jsx`](../../frontend/src/components/auth/AuthGate.jsx) | The **bouncer** in front of staff pages. |
| [`components/auth/Login.jsx`](../../frontend/src/components/auth/Login.jsx) | Redirects to the RegulaOne front desk (with loop explanation). |
| [`components/auth/SafeVoiceAccessModal.jsx`](../../frontend/src/components/auth/SafeVoiceAccessModal.jsx) | The "you can't enter SafeVoice" blocking screen. |
| [`utils/access.js`](../../frontend/src/utils/access.js) | The rulebook: *is this signed-in user allowed in SafeVoice?* |
| [`App.jsx`](../../frontend/src/App.jsx) | The conductor: starts the check, gates staff routes, handles the callback, runs the refresh timer. |
| [`main.jsx`](../../frontend/src/main.jsx) | Wraps the app in the Redux `<Provider>`. |

---

## 9. Configuration

Set these in a `.env` file (see [`.env.example`](../../frontend/.env.example)). Defaults match
local development.

| Variable | What it points at | Default |
|---|---|---|
| `VITE_REGULAONE_API_URL` | RegulaOne backend (`/api/auth/me`, `/api/sso/refresh`, `/api/sso/logout`) | `http://localhost:8080` |
| `VITE_APP_URL` | This SafeVoice frontend (used to build the return URL) | `http://localhost:1003` |
| `VITE_CENTRAL_LOGIN_URL` | The central RegulaOne login page | `http://localhost:3000/login` |

---

## 10. How to test it locally

You need the RegulaOne backend running, because SafeVoice has no login of its own.

1. Start the RegulaOne backend (default `:8080`) and central login app (default `:3000`).
2. `cd SafeVoice/frontend && npm run dev` (serves on `:1003`).
3. Visit a **staff** page, e.g. `http://localhost:1003/dashboard`.
   - **Not signed in?** You should bounce to the RegulaOne login, then return to the dashboard.
   - **Signed in?** The dashboard loads, and your name + role show in the sidebar and navbar.
4. Visit a **public** page `http://localhost:1003/report` — it must load with **no** sign-in.
5. **Sign out** from the sidebar/navbar → you should land back on the central login.

**Quick checks without a backend:**
- `status: "error"` path: point `VITE_REGULAONE_API_URL` at a dead port → staff pages should
  show the "Try again" screen (not an infinite spinner).
- `npm run build` should pass — it catches import/syntax mistakes.

---

## 11. How to extend it

- **Gate a new staff route:** add its path prefix to `STAFF_PREFIXES` in
  [`App.jsx`](../../frontend/src/App.jsx). Done — `AuthGate` now protects it.
- **Keep a route public:** just *don't* add it to `STAFF_PREFIXES`.
- **Read the current user anywhere:** `useSelector(selectCurrentUser)` from
  [`authSlice.js`](../../frontend/src/slices/authSlice.js). Never call `/api/auth/me` yourself —
  the slice already holds the answer.
- **Add a new backend call:** put the request in a `services/` file and dispatch it from a
  thunk in a slice. Components should not call the network directly (project rule).
- **Change a permission rule:** edit the single pure function in
  [`utils/access.js`](../../frontend/src/utils/access.js) so every guard stays in sync.

---

## 12. Golden rules (do / don't)

**Do**
- Always send `credentials: "include"` on backend calls so the cookie travels.
- Let the backend decide identity and tenant from the cookie.
- Read auth state from Redux selectors.

**Don't**
- ❌ Don't read, store, or log the token — it's `httpOnly` for a reason.
- ❌ Don't send a tenant id or user id from the client; the backend derives them (tenant
  isolation).
- ❌ Don't gate the public `/report` and `/track` pages — anonymous access is the law.
- ❌ Don't add a second source of truth for "am I logged in?" — there is only the slice.

---

_This guide mirrors the same SSO model used by the KSeFFlow module, adapted to SafeVoice's
Redux structure. Last reviewed: 2026-06-26._
