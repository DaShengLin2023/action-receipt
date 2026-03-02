import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildReceiptFromDraft } from "./receipt-builder.js";
import {
  getActiveSigningMaterial,
  getVerificationMaterial,
  listKeyMetadata
} from "./keyring.js";
import {
  appendReceipt,
  getReceiptById,
  openReceiptStore
} from "./store.js";
import { verifyReceipt } from "./verification.js";

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    await openReceiptStore();
    const metadata = listKeyMetadata();
    res.json({
      ok: true,
      trust_domain: metadata.trustDomain,
      active_key_id: metadata.activeKeyId
    });
  });

  app.post("/verify-receipt", async (req, res) => {
    try {
      const body = req.body ?? {};
      let receipt = body.receipt;

      if (!receipt && typeof body.receipt_id === "string") {
        const stored = await getReceiptById(body.receipt_id);
        if (!stored) {
          return res.status(404).json({
            error: "receipt_not_found",
            receipt_id: body.receipt_id
          });
        }
        receipt = stored.receipt;
      }

      if (!receipt || typeof receipt !== "object") {
        return res.status(400).json({
          error: "invalid_request",
          message: "Provide receipt object in `receipt` or a `receipt_id`."
        });
      }

      const keyId = receipt?.integrity?.key_id;
      const verificationKey = typeof keyId === "string" ? getVerificationMaterial(keyId) : null;
      const signedBy = verificationKey ? `${verificationKey.trustDomain}@0.1` : "unknown@0.1";

      const result = verifyReceipt(receipt, {
        publicKey: verificationKey?.publicKey,
        signedBy
      });

      return res.status(200).json({
        valid: result.valid,
        tampered: result.tampered,
        signed_by: result.signed_by,
        verification_level: result.verification_level,
        signature_valid: result.signature_valid,
        schema_valid: result.schema_valid,
        schema_errors: result.schema_errors
      });
    } catch (error) {
      return res.status(500).json({
        error: "verification_failed",
        message: error.message
      });
    }
  });

  app.post("/receipts", async (req, res) => {
    try {
      const draftCandidate = req.body?.draft ?? req.body;
      if (!draftCandidate || typeof draftCandidate !== "object") {
        return res.status(400).json({
          error: "invalid_request",
          message: "Provide receipt draft object."
        });
      }

      const signing = getActiveSigningMaterial();
      const receipt = buildReceiptFromDraft(
        {
          ...draftCandidate,
          trust_domain: signing.trustDomain
        },
        {
          keyId: signing.keyId,
          sigAlg: "Ed25519",
          privateKey: signing.privateKey
        }
      );

      const stored = await appendReceipt(receipt);

      return res.status(201).json({
        receipt_id: receipt.receipt_id,
        trust_domain: receipt.trust_domain,
        key_id: receipt.integrity.key_id,
        created_at: stored.created_at,
        receipt
      });
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        return res.status(409).json({
          error: "receipt_exists",
          message: "receipt_id already exists"
        });
      }

      return res.status(400).json({
        error: "receipt_issue_failed",
        message: error.message
      });
    }
  });

  return app;
}

export async function startApiServer(options = {}) {
  await openReceiptStore();
  const metadata = listKeyMetadata();
  const app = createApiApp();
  const requestedPort = Number(options.port ?? process.env.PORT ?? 8787);
  return new Promise((resolve) => {
    const server = app.listen(requestedPort, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : requestedPort;
      resolve({
        app,
        server,
        port,
        trustDomain: metadata.trustDomain,
        activeKeyId: metadata.activeKeyId
      });
    });
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryFile === path.resolve(thisFile)) {
  startApiServer().then(({ port, trustDomain, activeKeyId }) => {
    console.log(`Receipt server running at http://localhost:${port}`);
    console.log(`trust_domain: ${trustDomain}`);
    console.log(`active_key_id: ${activeKeyId}`);
  });
}
