export const SCHEMA_VERSION = "0.1.0";
export const DEFAULT_TRUST_DOMAIN = "dev.local";
export const DEFAULT_ACTIVE_KEY_ID = "dev-key-1";
export const DEFAULT_CANONICALIZATION = "JCS-RFC8785";
export const DEFAULT_HASH_ALG = "SHA-256";
export const DEFAULT_SIG_ALG = "Ed25519";

export const ACTION_TYPES = [
  "information_access",
  "external_communication",
  "system_mutation",
  "asset_transfer",
  "commitment_creation",
  "content_generation",
  "other"
];

export const RISK_CLASSES = ["low", "medium", "high", "critical"];
export const VERIFICATION_LEVELS = ["low", "medium", "high"];
