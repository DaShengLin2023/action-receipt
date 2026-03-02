import { randomUUID } from "node:crypto";
import {
  DEFAULT_TRUST_DOMAIN,
  SCHEMA_VERSION
} from "./constants.js";
import { issueSignedReceipt } from "./integrity.js";
import { validateReceiptSchema } from "./schema.js";

export function buildReceiptFromDraft(draft, signingOptions) {
  if (!draft || typeof draft !== "object") {
    throw new TypeError("draft must be an object");
  }

  const normalizedDraft = {
    receipt_id: draft.receipt_id ?? randomUUID(),
    schema_version: SCHEMA_VERSION,
    trust_domain: draft.trust_domain ?? DEFAULT_TRUST_DOMAIN,
    observed_at: draft.observed_at ?? new Date().toISOString(),
    issued_at: draft.issued_at,
    agent_id: draft.agent_id ?? "unknown-agent",
    action: {
      tool: draft.action?.tool ?? "unknown_tool",
      type: draft.action?.type ?? "other",
      input_hash: draft.action?.input_hash ?? "",
      risk_class: draft.action?.risk_class ?? "medium",
      creates_commitment: Boolean(draft.action?.creates_commitment),
      asset_involved: Boolean(draft.action?.asset_involved)
    },
    environment: {
      sdk_version: draft.environment?.sdk_version ?? "0.1.0",
      model: draft.environment?.model ?? "unknown-model"
    }
  };

  const receipt = issueSignedReceipt(normalizedDraft, signingOptions);
  const validation = validateReceiptSchema(receipt);
  if (!validation.valid) {
    const details = validation.errors.map((error) => `${error.instancePath} ${error.message}`).join("; ");
    throw new Error(`receipt schema validation failed: ${details}`);
  }
  return receipt;
}
