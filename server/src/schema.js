import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(dirname, "../../schema/receipt.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const validate = ajv.compile(schema);

export function validateReceiptSchema(receipt) {
  const valid = validate(receipt);
  return {
    valid: Boolean(valid),
    errors: validate.errors ?? []
  };
}

export function getReceiptSchema() {
  return schema;
}
