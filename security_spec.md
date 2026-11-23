# Security Specification — VruGuard Redeem Codes & Subscriptions (Serverless Firestore Architecture)

## 1. Data Invariants
1. **Hash-Only Code Storage:** Plaintext Redeem codes (`VRU-PREM-XXXX-...`) are NEVER persisted to `/redeem_codes/{codeHash}`; the document ID and `codeHash` field are strictly the 64-character lowercase SHA-256 hex digest of the normalized code.
2. **No Enumeration:** Non-admin users cannot `list` `/redeem_codes`. Only single-document `get` by exact 64-char SHA-256 `codeHash` is permitted so possession of the secret code is required.
3. **Zero PII in Shared Code Docs:** `/redeem_codes/{codeHash}` stores zero user emails or UIDs. Claimer attribution is isolated in `/redeem_claims/{claimId}` (`read`: owner or admin only).
4. **One-Claim-Per-User Guarantee:** Every redemption atomically creates `/redeem_claims/{codeHash}_{uid}` inside a transaction and rejects duplicates via `!exists(/redeem_claims/{codeHash}_{uid})`.
5. **Atomic Tri-Document Sync:** Updating `/redeem_codes/{codeHash}`, creating `/redeem_claims/{codeHash}_{uid}`, and creating/updating `/subscriptions/{uid}` MUST happen together in one transaction verified via `existsAfter`/`getAfter`.
6. **No Self-Subscription Forgery:** Users cannot write `/subscriptions/{uid}` directly without an atomic, valid, unexpired, unconsumed `/redeem_codes/{codeHash}` + `/redeem_claims/{codeHash}_{uid}` proof, and `endDate` is strictly bounded by `code.durationDays` (or `null` only when `code.isLifetime == true || code.plan == 'BUSINESS'`). Suspended subscriptions cannot be overwritten by users.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Direct Subscription Escalation (Create):** User creates `/subscriptions/{uid}` with `plan: "PREMIUM"`, `paymentProvider: "stripe"`, `paymentVerified: true` without a redeem code.
2. **Direct Subscription Escalation (Update):** User updates `/subscriptions/{uid}` changing `plan` from `"PREMIUM"` to `"BUSINESS"` or extending `endDate` by +10 years without a claim.
3. **Plan Mismatch Spoof:** User redeems a `"PREMIUM"` code but writes `plan: "FAMILY"` to `/subscriptions/{uid}` or `/redeem_claims/{claimId}`.
4. **Duration Inflation Spoof:** User redeems a `30`-day (`1m`) code (`isLifetime: false`) and writes `endDate: null` (`isLifetime: true`) or `endDate: now + 365 days`.
5. **Double Claim Replay:** User re-submits a second redemption of the same multi-use (`maxUses: 100`) code; blocked by `!exists(/redeem_claims/{codeHash}_{uid})`.
6. **Code Status Tampering:** Non-admin updates `/redeem_codes/{codeHash}` changing `maxUses` from `1` to `999`, `plan`, or `status` from `"revoked"` to `"available"`.
7. **Orphaned Increment Attack:** User increments `/redeem_codes/{codeHash}.usesCount` without creating `/redeem_claims/{codeHash}_{uid}` or updating `/subscriptions/{uid}` (`existsAfter` check fails).
8. **Cross-User Subscription Grant:** User A redeems a code and tries to write `/subscriptions/{userB}` or `/redeem_claims/{codeHash}_{userB}`.
9. **Enumeration / Code Scraping:** Non-admin executes a collection `list` query on `/redeem_codes` or `/redeem_claims` for other users' claims.
10. **Pioneer / Early Tester Self-Grant:** User sets `isEarlyTester: true` in `/subscriptions/{uid}` during a redeem update.
11. **Ghost Field Injection (Shadow Update):** Payload includes unexpected extra key (e.g., `adminOverride: true`) rejected by `hasOnly` schema blueprint.
12. **Timestamp Tampering:** User submits forged `usedAt` or `updatedAt` != `request.time` (`serverTimestamp()`).
