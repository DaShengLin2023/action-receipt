import canonicalize from "canonicalize";
import {
  createHash,
  createHmac,
  sign as edSign,
  verify as edVerify
} from "node:crypto";
import {
  DEFAULT_CANONICALIZATION,
  DEFAULT_HASH_ALG,
  DEFAULT_SIG_ALG
} from "./constants.js";

function cloneForHash(receipt) {
  const candidate = structuredClone(receipt);
  candidate.integrity = candidate.integrity ?? {};
  delete candidate.integrity.content_hash;
  delete candidate.integrity.signature;
  return candidate;
}

export function canonicalizeReceipt(receipt) {
  const canonical = canonicalize(cloneForHash(receipt));
  if (typeof canonical !== "string") {
    throw new Error("Failed to canonicalize receipt");
  }
  return canonical;
}

export function sha256Hex(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

export function computeContentHash(receipt) {
  return sha256Hex(canonicalizeReceipt(receipt));
}

export function signContentHash(contentHash, options) {
  const sigAlg = options.sigAlg ?? DEFAULT_SIG_ALG;

  if (sigAlg === "Ed25519") {
    const signature = edSign(null, Buffer.from(contentHash, "hex"), options.privateKey);
    return signature.toString("base64");
  }

  if (sigAlg === "HMAC-SHA256") {
    if (!options.hmacSecret) {
      throw new Error("hmacSecret is required when sig_alg=HMAC-SHA256");
    }
    return createHmac("sha256", options.hmacSecret).update(contentHash).digest("base64");
  }

  throw new Error(`Unsupported signature algorithm: ${sigAlg}`);
}

export function verifyContentHashSignature(contentHash, signature, options) {
  const sigAlg = options.sigAlg ?? DEFAULT_SIG_ALG;

  if (sigAlg === "Ed25519") {
    if (!options.publicKey) {
      return false;
    }
    return edVerify(
      null,
      Buffer.from(contentHash, "hex"),
      options.publicKey,
      Buffer.from(signature, "base64")
    );
  }

  if (sigAlg === "HMAC-SHA256") {
    if (!options.hmacSecret) {
      return false;
    }
    const expected = createHmac("sha256", options.hmacSecret).update(contentHash).digest("base64");
    return expected === signature;
  }

  return false;
}

export function issueSignedReceipt(draft, options) {
  const sigAlg = options.sigAlg ?? DEFAULT_SIG_ALG;
  const now = options.issuedAt ?? new Date().toISOString();

  const receipt = {
    ...draft,
    schema_version: draft.schema_version,
    issued_at: now,
    integrity: {
      canonicalization: DEFAULT_CANONICALIZATION,
      hash_alg: DEFAULT_HASH_ALG,
      sig_alg: sigAlg,
      key_id: options.keyId,
      content_hash: "",
      signature: ""
    }
  };

  receipt.integrity.content_hash = computeContentHash(receipt);
  receipt.integrity.signature = signContentHash(receipt.integrity.content_hash, {
    sigAlg,
    privateKey: options.privateKey,
    hmacSecret: options.hmacSecret
  });

  return receipt;
}
