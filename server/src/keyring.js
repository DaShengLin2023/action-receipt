import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync
} from "node:crypto";
import {
  DEFAULT_ACTIVE_KEY_ID,
  DEFAULT_TRUST_DOMAIN
} from "./constants.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultKeyringPath = path.resolve(dirname, "../keyring.json");

function pemPair() {
  const keys = generateKeyPairSync("ed25519");
  return {
    private_key_pem: keys.privateKey.export({ format: "pem", type: "pkcs8" }),
    public_key_pem: keys.publicKey.export({ format: "pem", type: "spki" })
  };
}

function buildDefaultKeyring(options = {}) {
  const keyId = options.activeKeyId ?? process.env.RECEIPT_ACTIVE_KEY_ID ?? DEFAULT_ACTIVE_KEY_ID;
  return {
    trust_domain: options.trustDomain ?? process.env.RECEIPT_TRUST_DOMAIN ?? DEFAULT_TRUST_DOMAIN,
    active_key_id: keyId,
    keys: {
      [keyId]: {
        ...pemPair(),
        status: "active"
      }
    }
  };
}

function normalizeKeyringPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("keyring payload must be an object");
  }

  if (!payload.trust_domain || typeof payload.trust_domain !== "string") {
    throw new Error("keyring.trust_domain is required");
  }

  if (!payload.active_key_id || typeof payload.active_key_id !== "string") {
    throw new Error("keyring.active_key_id is required");
  }

  if (!payload.keys || typeof payload.keys !== "object") {
    throw new Error("keyring.keys is required");
  }

  const keyIds = Object.keys(payload.keys);
  if (keyIds.length === 0) {
    throw new Error("keyring.keys cannot be empty");
  }

  if (!payload.keys[payload.active_key_id]) {
    throw new Error("keyring.active_key_id must exist in keyring.keys");
  }

  return payload;
}

export function resolveKeyringPath(options = {}) {
  return options.keyringPath ?? process.env.RECEIPT_KEYRING_PATH ?? defaultKeyringPath;
}

export function ensureKeyring(options = {}) {
  const keyringPath = resolveKeyringPath(options);
  if (existsSync(keyringPath)) {
    return keyringPath;
  }

  mkdirSync(path.dirname(keyringPath), { recursive: true });
  const keyring = buildDefaultKeyring(options);
  writeFileSync(keyringPath, `${JSON.stringify(keyring, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(keyringPath, 0o600);
  return keyringPath;
}

export function readKeyring(options = {}) {
  const keyringPath = ensureKeyring(options);
  const raw = readFileSync(keyringPath, "utf8");
  const payload = JSON.parse(raw);
  return {
    keyringPath,
    keyring: normalizeKeyringPayload(payload)
  };
}

export function getActiveSigningMaterial(options = {}) {
  const { keyringPath, keyring } = readKeyring(options);
  const keyRecord = keyring.keys[keyring.active_key_id];

  return {
    trustDomain: keyring.trust_domain,
    keyId: keyring.active_key_id,
    privateKey: createPrivateKey(keyRecord.private_key_pem),
    publicKey: createPublicKey(keyRecord.public_key_pem),
    source: "keyring",
    keyringPath
  };
}

export function getVerificationMaterial(keyId, options = {}) {
  const { keyring } = readKeyring(options);
  const keyRecord = keyring.keys[keyId];
  if (!keyRecord) {
    return null;
  }

  return {
    trustDomain: keyring.trust_domain,
    keyId,
    publicKey: createPublicKey(keyRecord.public_key_pem),
    status: keyRecord.status ?? "unknown"
  };
}

export function listKeyMetadata(options = {}) {
  const { keyring } = readKeyring(options);
  return {
    trustDomain: keyring.trust_domain,
    activeKeyId: keyring.active_key_id,
    keys: Object.entries(keyring.keys).map(([keyId, keyRecord]) => ({
      key_id: keyId,
      status: keyRecord.status ?? "unknown"
    }))
  };
}

// Backward-compatible alias used by current demos.
export const loadSigningMaterial = getActiveSigningMaterial;
