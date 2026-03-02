import {
  computeContentHash,
  verifyContentHashSignature
} from "./integrity.js";
import { validateReceiptSchema } from "./schema.js";

function computeVerificationLevel({ valid, tampered, schemaValid }) {
  if (valid && !tampered && schemaValid) {
    return "high";
  }

  if (valid && !tampered && !schemaValid) {
    return "medium";
  }

  return "low";
}

export function verifyReceipt(receipt, options = {}) {
  const schemaResult = validateReceiptSchema(receipt);
  const contentHash = receipt?.integrity?.content_hash ?? "";
  const signature = receipt?.integrity?.signature ?? "";
  const sigAlg = receipt?.integrity?.sig_alg ?? options.sigAlg;

  let tampered = true;
  try {
    const recomputedHash = computeContentHash(receipt);
    tampered = recomputedHash !== contentHash;
  } catch {
    tampered = true;
  }

  const signatureValid = verifyContentHashSignature(contentHash, signature, {
    sigAlg,
    publicKey: options.publicKey,
    hmacSecret: options.hmacSecret
  });
  const valid = signatureValid && !tampered;

  const verificationLevel = computeVerificationLevel({
    valid,
    tampered,
    schemaValid: schemaResult.valid
  });

  return {
    valid,
    tampered,
    signed_by: options.signedBy ?? "receipt-core@0.1",
    verification_level: verificationLevel,
    signature_valid: signatureValid,
    schema_valid: schemaResult.valid,
    schema_errors: schemaResult.errors
  };
}
