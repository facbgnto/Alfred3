# Storage Rules

## Browser APIs

Flag all uses of:

```text
localStorage.setItem(
sessionStorage.setItem(
window.localStorage
window.sessionStorage
document.cookie
indexedDB
caches.open
navigator.storage
StorageManager
persist()
```

## Persistence Libraries

Flag all uses of:

```text
redux-persist
persistReducer
persistStore
zustand/middleware
persist(
createJSONStorage
tanstack persist
PersistQueryClientProvider
createSyncStoragePersister
createAsyncStoragePersister
```

## Suspicious Key Names

Treat these storage keys as sensitive until proven otherwise:

```text
token
accessToken
refreshToken
jwt
auth
session
user
profile
roles
permissions
rut
email
phone
address
bank
card
account
```

## Review Heuristic

If the stored value is `JSON.stringify(...)`, inspect the object's shape. If the shape is unknown, require narrowing to an explicit allowlist before storage.
