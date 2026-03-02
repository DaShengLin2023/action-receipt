# AI Action Receipt - Execution Standard v0.1

## Scope

This document freezes the v0.1 implementation boundary for the reference signer/verifier.

Included in v0.1:

- `schema_version`
- separated `observed_at` and `issued_at`
- `trust_domain`
- integrity metadata: `canonicalization`, `hash_alg`, `sig_alg`, `key_id`
- verification output: `verification_level`
- fixed `action.input_hash` rule
- immutable receipt principle

Deferred to v0.2:

- `revokes_receipt_id`
- lifecycle state machine
- multi-party signatures
- timestamp authority integration
- advanced revocation workflow

## Runtime role boundary

The server in v0.1 is a **Reference Verifier & Signer**, not a SaaS control plane.

v0.1 explicitly excludes:

- tenant/account/auth systems
- dashboard requirements
- production multi-tenant concerns

## Canonicalization and integrity

- Canonicalization must use mature libraries only (no custom implementation in v0.1).
- Profile: `JCS-RFC8785`
- Hash: `SHA-256`
- Signature: `Ed25519` (primary), `HMAC-SHA256` optional internal fallback

Signing pipeline:

1. Build receipt payload.
2. Remove `integrity.content_hash` and `integrity.signature`.
3. Canonicalize payload.
4. Compute SHA-256 `content_hash`.
5. Sign `content_hash`.
6. Attach integrity fields and persist.

## Dev key strategy

- Default trust domain: `dev.local`
- Keyring file: `server/keyring.json`
- Keyring shape:
  - `trust_domain`
  - `active_key_id`
  - `keys` object
- v0.1 key behavior:
  - multiple keys allowed
  - only one active key
  - verify supports historical keys by `key_id`

Not included in v0.1:

- automatic key expiry
- CRL/revocation list
- full key lifecycle policies

## Input hash rule

`action.input_hash` is SHA-256 over exact SDK boundary input bytes.

- strings: UTF-8 bytes
- binary: original bytes
- structured objects (current JS demo): `JSON.stringify(input)` bytes, no canonical sorting

## Immutability principle

- Receipt is immutable once issued.
- Store behavior must be append-only.
- Corrections/cancellations are new receipts (formal revocation deferred to v0.2).

## Storage rule (SQLite minimal)

Required table:

```sql
CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  receipt_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

No update path in v0.1.

## Verification semantics

`POST /verify-receipt` returns:

```json
{
  "valid": true,
  "tampered": false,
  "signed_by": "dev.local@0.1",
  "verification_level": "high"
}
```

Rules:

- `tampered=true` if recomputed canonical hash differs from `integrity.content_hash`
- `valid=true` only when signature verifies and `tampered=false`
- `verification_level`
  - `high`: valid + schema complete
  - `medium`: valid + schema incomplete
  - `low`: otherwise

## Implementation order

1. fixed keyring and active key policy
2. SQLite append-only store
3. `POST /verify-receipt`
4. `POST /receipts`
5. cold-start onboarding check
