import { createHash } from "node:crypto";

export const SDK_VERSION = "0.1.0";

function defaultSerializeInput(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === "string") {
    return Buffer.from(input, "utf8");
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(input);
  }

  return Buffer.from(JSON.stringify(input), "utf8");
}

export function hashToolInput(input, serializeInput = defaultSerializeInput) {
  const payload = serializeInput(input);
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  return createHash("sha256").update(bytes).digest("hex");
}

export function wrapTool(originalTool, config = {}) {
  if (typeof originalTool !== "function") {
    throw new TypeError("wrapTool expects a function");
  }

  const toolName = config.toolName ?? originalTool.name ?? "anonymous_tool";

  return async function wrappedTool(input, ...rest) {
    const observedAt = new Date().toISOString();
    const inputHash = hashToolInput(input, config.serializeInput);

    const draft = {
      trust_domain: config.trustDomain ?? "dev.local",
      observed_at: observedAt,
      agent_id: config.agentId ?? "unknown-agent",
      action: {
        tool: toolName,
        type: config.actionType ?? "other",
        input_hash: inputHash,
        risk_class: config.riskClass ?? "medium",
        creates_commitment: Boolean(config.createsCommitment),
        asset_involved: Boolean(config.assetInvolved)
      },
      environment: {
        sdk_version: config.sdkVersion ?? SDK_VERSION,
        model: config.model ?? "unknown-model"
      }
    };

    let result;
    let thrownError;

    try {
      result = await originalTool(input, ...rest);
      return result;
    } catch (error) {
      thrownError = error;
      throw error;
    } finally {
      if (typeof config.emitDraft === "function") {
        await config.emitDraft(draft, { result, error: thrownError });
      }
    }
  };
}
