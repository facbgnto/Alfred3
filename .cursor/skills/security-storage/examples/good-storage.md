# Good Storage Examples

## UI Preference Only

```ts
localStorage.setItem("theme", theme);
localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
```

## Minimal Display Cache

```ts
localStorage.setItem(
  "userDisplay",
  JSON.stringify({
    id: user.id,
    displayName: user.displayName,
    theme: user.theme,
  })
);
```

Only use this when the fields are non-sensitive and not authorization decisions.

## Current User from Server

```ts
const response = await fetch("/api/auth/me", {
  credentials: "include",
});

const currentUser = await response.json();
```

## HttpOnly Cookie Backend

```ts
res.cookie("access_token", accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 15 * 60 * 1000,
});
```
