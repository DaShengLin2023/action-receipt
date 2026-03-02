import { wrapTool } from "@action-receipt/sdk";
import {
  buildReceiptFromDraft,
  loadSigningMaterial,
  verifyReceipt
} from "@action-receipt/server";

const signingMaterial = loadSigningMaterial();
let receipt = null;

async function originalSendEmail(input) {
  return { ok: true, to: input.to };
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
    receipt = buildReceiptFromDraft(draft, {
      keyId: signingMaterial.keyId,
      sigAlg: "Ed25519",
      privateKey: signingMaterial.privateKey
    });
  }
});

await sendEmail({
  to: "bob@example.com",
  subject: "hello",
  body: "tamper test"
});

const originalVerification = verifyReceipt(receipt, {
  publicKey: signingMaterial.publicKey,
  signedBy: `${signingMaterial.trustDomain}@0.1`
});

const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.action.risk_class = "critical";

const tamperedVerification = verifyReceipt(tamperedReceipt, {
  publicKey: signingMaterial.publicKey,
  signedBy: `${signingMaterial.trustDomain}@0.1`
});

console.log("Original:", originalVerification);
console.log("Tampered:", tamperedVerification);
