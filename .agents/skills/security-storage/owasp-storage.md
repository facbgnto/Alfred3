# OWASP Storage Mapping

Map findings to:

- A01 Broken Access Control: persisted roles or permissions can be tampered with client-side.
- A02 Cryptographic Failures: sensitive data exposed in browser-readable storage.
- A03 Injection: XSS can exfiltrate localStorage, sessionStorage, IndexedDB, and readable cookies.
- A04 Insecure Design: auth state stored in client objects instead of server-controlled sessions.
- A05 Security Misconfiguration: missing cookie flags or weak CSP.
- A07 Identification and Authentication Failures: JWTs or refresh tokens stored in localStorage.
- A09 Security Logging and Monitoring Failures: secrets or personal data logged during storage flows.

For cookie sessions, also evaluate CSRF, SameSite strategy, token rotation, logout revocation, and session fixation protections.
