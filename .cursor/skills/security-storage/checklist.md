# Security Storage Checklist

## Detection

Search every relevant diff and touched file for:

- `localStorage.setItem(`
- `sessionStorage.setItem(`
- `document.cookie`
- `indexedDB`
- `caches.open`
- `navigator.storage`
- `StorageManager`
- `window.localStorage`
- `window.sessionStorage`
- `.persist()`
- `redux-persist`
- `zustand` persist middleware
- TanStack persist clients or persisters

## CRITICAL

Mark as `CRITICAL` when browser-accessible storage contains or may contain:

- `access_token`, `refresh_token`, `jwt`, `bearer`, `authorization`
- `password`, `secret`, `api_key`, `private_key`
- CSRF tokens
- full `user`, full `profile`, full auth/session objects
- RUT, phone, email, address, birth date
- full roles, full permissions
- banking data, cards, accounts

## HIGH

Mark as `HIGH` when storage contains:

- complete menus or navigation trees
- very large objects
- user configuration objects with business or permission state
- complete authentication objects

## Allowed Low-Risk Values

Usually acceptable:

- `theme`, `darkMode`, `language`
- `sidebarCollapsed`, `layout`, `zoom`
- visual preferences
- last visited page without sensitive query parameters

## Required Review Areas

- XSS impact on stored data
- CSRF protections for cookie sessions
- CSP presence and strength
- token storage and rotation
- cookie flags
- session fixation
- sensitive data exposure
- broken authentication
- OWASP Top 10 mapping
