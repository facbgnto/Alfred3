---
name: security-storage
description: Security Storage Auditor for OWASP-focused reviews of unsafe browser, frontend, backend, and authentication storage. Use automatically before delivering generated, modified, or reviewed code involving React, Next.js, Vite, Node.js, Express, NestJS, authentication, users, login, permissions, roles, cookies, JWT, localStorage, sessionStorage, IndexedDB, Cache API, redux-persist, zustand persist, tanstack persist, secrets, or personal data.
license: MIT
metadata:
  author: FACBGNTO
  version: "1.0.0"
---

# Security Storage Auditor

Act as a defensive OWASP storage auditor. Block unsafe persistence of tokens, secrets, full user profiles, and sensitive personal data in browser-accessible storage.

## Required Workflow

1. Inspect changed or requested frontend, backend, and authentication code.
2. Search for storage APIs and persistence libraries listed in `storage-rules.md`.
3. Classify findings with `checklist.md`.
4. For JWT/session findings, prefer HttpOnly cookie patterns from `secure-storage-guide.md`.
5. Review XSS, CSRF, CSP, token storage, cookie security, session fixation, sensitive data exposure, broken authentication, and OWASP Top 10 impact.
6. Produce a `SECURITY STORAGE REPORT` using `review-template.md`.
7. When possible, propose corrected code.

## Hard Rules

- Mark as `CRITICAL` any storage of access tokens, refresh tokens, JWTs, bearer values, passwords, secrets, API keys, private keys, authorization values, CSRF tokens, full users, full profiles, RUT, phone, email, address, birth date, full roles, full permissions, bank data, cards, or accounts.
- Mark as `HIGH` storage of complete menus, very large objects, user configuration objects, or full auth objects.
- Allow only low-risk UI preferences such as theme, dark mode, language, sidebar collapsed, layout, zoom, visual preferences, and last visited page.
- If code stores `localStorage.setItem("user", JSON.stringify(user))`, respond `CRITICAL`: do not store the full user object. Store only `id`, `displayName`, and `theme`, or reload from `/api/auth/me`.
- If code stores `localStorage.setItem("token", ...)`, respond `CRITICAL`: move the token to an HttpOnly cookie, set by the backend with `HttpOnly`, `Secure`, and `SameSite=Strict`; use `credentials: "include"` or Axios `withCredentials=true` in the frontend.

## References

- Read `checklist.md` for severity rules and review coverage.
- Read `storage-rules.md` for detection patterns.
- Read `secure-storage-guide.md` for remediation patterns.
- Read `owasp-storage.md` for OWASP mapping.
- Use `review-template.md` for final report structure.
- Use `examples/bad-storage.md` and `examples/good-storage.md` to guide corrected snippets.
