# Google sign-in recovery

Observed in the previous code: the visible custom button called One Tap and, if a moment callback reported it unavailable, attempted a synthetic click on an offscreen Google-rendered element. This depended on One Tap delivery and a private DOM structure. Vercel CSP also omitted Google's required GIS stylesheet origin/path. These are confirmed implementation defects, not proof of the exact cause of the reported user attempt.

The login page now displays Google's actual renderButton control, retaining the existing ID-token exchange and SHA-256/raw nonce pairing. Initialization is bounded and cleans up on unmount; stale callbacks and duplicate exchanges are ignored. Rejected token requests release loading and show an actionable message. CSP permits only the additional Google GIS stylesheet. No OAuth secrets, authorized origins, user roles, database schema, or financial calculations are changed.

Supabase auth log aggregates for the available last-24-hour window showed Login/request-completed messages and no error values. They do not establish the outcome of a particular user attempt. Current Google/Supabase documentation was checked, including the Supabase changelog.

Validation: npm run check (63 tests, TypeScript, build; lint zero errors with 258 existing warnings). Component tests cover nonce pairing, visible control, rejected exchange, duplicate/stale callbacks, loading timeout/retry, disabled interaction and CSP. A real Google account login on the user's device is still required to confirm recovery; browser end-to-end verification is unavailable in this environment.

References:
- https://developers.google.com/identity/gsi/web/guides/display-button
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://supabase.com/docs/guides/auth/social-login/auth-google
