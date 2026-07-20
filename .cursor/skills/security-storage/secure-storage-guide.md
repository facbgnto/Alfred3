# Secure Storage Guide

## Never Store in Browser-Readable Storage

Never store access tokens, refresh tokens, JWTs, bearer strings, passwords, API keys, private keys, full user objects, personal data, roles, permissions, or financial data in localStorage, sessionStorage, IndexedDB, Cache API, Redux Persist, Zustand persist, or TanStack persisters.

## Allowed Storage

Only store low-risk UI state:

```ts
localStorage.setItem("theme", theme);
localStorage.setItem("sidebarCollapsed", String(collapsed));
localStorage.setItem("language", locale);
```

## JWT and Session Pattern

Backend should set authentication cookies:

```ts
res.cookie("access_token", accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 15 * 60 * 1000,
});
```

Frontend should send credentials:

```ts
await fetch("/api/auth/me", {
  credentials: "include",
});
```

Axios:

```ts
axios.defaults.withCredentials = true;
```

## Refresh Tokens

- Store refresh tokens only in HttpOnly, Secure cookies.
- Rotate refresh tokens after use.
- Bind sessions server-side when possible.
- Revoke refresh tokens on logout and suspicious activity.
- Keep access tokens short-lived.

## React Protection

- Do not hydrate auth state from localStorage user objects.
- Fetch current user from `/api/auth/me`.
- Store only display-safe UI fields when needed.
- Sanitize rendering paths and avoid `dangerouslySetInnerHTML`.
- Use CSP to reduce XSS exploitability.

## Node Protection

- Set cookie flags consistently.
- Validate origin and CSRF protections for state-changing routes.
- Do not log tokens, cookies, authorization headers, or personal data.
- Clear cookies on logout with the same path and sameSite attributes.
