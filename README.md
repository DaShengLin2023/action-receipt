# AI Action Receipt (v0.1)

AI Action Receipt lets you cryptographically sign AI tool executions and later prove whether they were tampered.
It is not a SaaS control plane; it is a local accountability layer you can embed and verify.

## 30-second quickstart (read first)

### Step 1 - Start the server (30 seconds)

```bash
npm install
npm run dev
```

Expected startup output:

```text
Receipt server running at http://localhost:8787
trust_domain: dev.local
active_key_id: dev-key-1
```

### Step 2 - Create a receipt (curl)

```bash
curl -X POST http://localhost:8787/receipts \
  -H "Content-Type: application/json" \
  -d @examples/sample-action.json
```

Example response (minimal shape):

```json
{
  "receipt_id": "f741acde-f48a-4797-ab99-8db36f1f5062",
  "trust_domain": "dev.local",
  "key_id": "dev-key-1",
  "receipt": { "integrity": { "..." : "..." }, "...": "..." }
}
```

Full schema below (`schema/receipt.schema.json`).

### Step 3 - Verify tampering (the key moment)

```bash
curl -X POST http://localhost:8787/verify-receipt \
  -H "Content-Type: application/json" \
  -d @examples/tampered-receipt.json
```

Expected: `tampered=true`

Example response:

```json
{
  "valid": false,
  "tampered": true,
  "signed_by": "dev.local@0.1",
  "verification_level": "low",
  "signature_valid": false,
  "schema_valid": true,
  "schema_errors": []
}
```

## v0.1 scope

Included:

- `schema_version`
- `observed_at` + `issued_at`
- `trust_domain`
- integrity metadata: `canonicalization`, `hash_alg`, `sig_alg`, `key_id`
- verification output: `verification_level`
- fixed `action.input_hash` rule
- immutable receipt principle (append-only)

Deferred to v0.2:

- `revokes_receipt_id`
- lifecycle state machine
- multi-party signatures
- timestamp authority integration
- advanced revocation logic

## Dev key strategy (implemented)

- Default trust domain: `dev.local`
- Keyring file: `server/keyring.json` (auto-created, git-ignored)
- Default active key: `dev-key-1`
- Multiple keys supported; only one active key in v0.1
- Verify can resolve historical `key_id`

Template: `server/keyring.example.json`

## SQLite append-only store (implemented)

DB file: `server/data/receipts.sqlite`
v0.1 uses `sql.js` for zero-setup portability. Production deployments may swap storage adapters.

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

## API

- `POST /verify-receipt` (core demo endpoint)
- `POST /receipts`
- `GET /health`

## Scripts

```bash
npm run dev
npm run demo
npm run demo:tamper
npm run api:smoke
```

## Blind cold-start test before v0.1 tag

Give the repo to a JS developer who did not participate in development.
Do not give verbal help. Pass criteria:

| Metric | Pass line |
|---|---|
| Can start server | <= 3 min |
| Can create receipt | <= 10 min |
| Can explain `tampered` | <= 15 min |

If any step fails, fix README first and delay the tag.

## Standards

- Execution standard: `docs/EXECUTION_STANDARD_v0.1.md`
- Frozen schema: `schema/receipt.schema.json`
