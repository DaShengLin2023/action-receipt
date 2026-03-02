import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wrapTool } from "@action-receipt/sdk";
import {
  buildReceiptFromDraft,
  loadSigningMaterial,
  verifyReceipt
} from "@action-receipt/server";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(dirname, "out");

const signingMaterial = loadSigningMaterial();
let finalReceipt = null;

async function originalSendEmail(input) {
  return {
    message_id: "mock-msg-001",
    status: "queued",
    to: input.to
  };
}

const sendEmail = wrapTool(originalSendEmail, {
  toolName: "send_email",
  actionType: "external_communication",
  riskClass: "medium",
  createsCommitment: false,
  assetInvolved: false,
  agentId: "openclaw-agent-01",
  model: "gpt-4.1-mini",
  trustDomain: "dev.local",
  async emitDraft(draft) {
    finalReceipt = buildReceiptFromDraft(draft, {
      keyId: signingMaterial.keyId,
      sigAlg: "Ed25519",
      privateKey: signingMaterial.privateKey
    });
  }
});

const toolResult = await sendEmail({
  to: "alice@example.com",
  subject: "Welcome",
  body: "Thanks for trying Action Receipt"
});

if (!finalReceipt) {
  throw new Error("receipt was not generated");
}

const verificationResult = verifyReceipt(finalReceipt, {
  publicKey: signingMaterial.publicKey,
  signedBy: `${signingMaterial.trustDomain}@0.1`
});

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "receipt.json"), JSON.stringify(finalReceipt, null, 2), "utf8");
await writeFile(
  path.join(outputDir, "verification.json"),
  JSON.stringify(verificationResult, null, 2),
  "utf8"
);

console.log("Tool result:", toolResult);
console.log("Verification:", verificationResult);
console.log("Saved:", path.join(outputDir, "receipt.json"));
