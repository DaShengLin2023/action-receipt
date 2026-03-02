import { startApiServer } from "@action-receipt/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { server, port } = await startApiServer({ port: 0 });
const baseUrl = `http://127.0.0.1:${port}`;
const dirname = path.dirname(fileURLToPath(import.meta.url));

const sampleAction = JSON.parse(await readFile(path.join(dirname, "sample-action.json"), "utf8"));
const tamperedReceiptFile = JSON.parse(
  await readFile(path.join(dirname, "tampered-receipt.json"), "utf8")
);

try {
  const createResponse = await fetch(`${baseUrl}/receipts`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(sampleAction)
  });

  const created = await createResponse.json();
  console.log("POST /receipts =>", {
    status: createResponse.status,
    receipt_id: created.receipt_id,
    key_id: created.key_id
  });

  const verifyResponse = await fetch(`${baseUrl}/verify-receipt`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      receipt: created.receipt
    })
  });
  const verified = await verifyResponse.json();
  console.log("POST /verify-receipt (clean) =>", verified);

  const tamperedResponse = await fetch(`${baseUrl}/verify-receipt`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(tamperedReceiptFile)
  });
  const tampered = await tamperedResponse.json();
  console.log("POST /verify-receipt (tampered) =>", tampered);
} finally {
  await new Promise((resolve) => {
    server.close(resolve);
  });
}
