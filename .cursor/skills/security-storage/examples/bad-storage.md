# Bad Storage Examples

## Full User Object

```ts
localStorage.setItem("user", JSON.stringify(user));
```

Severity: `CRITICAL`

Do not store the full user object. Store only low-risk display fields or fetch the user from `/api/auth/me`.

## JWT in localStorage

```ts
localStorage.setItem("token", response.token);
```

Severity: `CRITICAL`

Move the token to an HttpOnly cookie set by the backend.

## Persisted Auth Store

```ts
export const useAuthStore = create(
  persist(
    (set) => ({ user, token, roles, permissions }),
    { name: "auth" }
  )
);
```

Severity: `CRITICAL`

Do not persist authentication objects, roles, permissions, or tokens in browser-readable storage.
