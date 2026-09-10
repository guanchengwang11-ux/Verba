import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProviderError,
  createTranslationDiagnosticSession,
  getLatestTranslationDiagnostic,
  TRANSLATION_ERROR_CODES
} from "../translation-diagnostics.mjs";

function providerError(status, message, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("classifies provider failures into distinct internal error codes", () => {
  assert.equal(classifyProviderError(providerError(0, "fetch failed")), TRANSLATION_ERROR_CODES.PROVIDER_NETWORK_ERROR);
  assert.equal(classifyProviderError(providerError(429, "Too many requests")), TRANSLATION_ERROR_CODES.PROVIDER_RATE_LIMIT);
  assert.equal(classifyProviderError(providerError(429, "Insufficient quota", "insufficient_quota")), TRANSLATION_ERROR_CODES.PROVIDER_QUOTA_ERROR);
  assert.equal(classifyProviderError(providerError(503, "Service unavailable")), TRANSLATION_ERROR_CODES.PROVIDER_UNAVAILABLE);
  assert.equal(classifyProviderError(providerError(404, "Model not found")), TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND);
  assert.equal(classifyProviderError(providerError(422, "Unexpected output")), TRANSLATION_ERROR_CODES.MODEL_OUTPUT_INVALID);
});

test("diagnostics record attempts and model switches without sensitive values", () => {
  const diagnostics = createTranslationDiagnosticSession("gemini");
  diagnostics.record({
    event: "translation_attempt",
    attempt: diagnostics.nextAttempt(),
    model: "model-a",
    result: "failed",
    stage: "provider_request",
    internalCode: "PROVIDER_UNAVAILABLE",
    httpStatus: 503,
    providerErrorCode: "UNAVAILABLE",
    latencyMs: 25,
    willRetry: false,
    text: "private source text",
    apiKey: "secret-key"
  });
  diagnostics.record({
    event: "translation_attempt",
    attempt: diagnostics.nextAttempt(),
    model: "model-b",
    result: "success",
    stage: "provider_request",
    httpStatus: 200,
    latencyMs: 20,
    modelSwitched: true,
    success: true
  });
  diagnostics.complete("model-b");
  const summary = getLatestTranslationDiagnostic();
  assert.equal(summary.attemptCount, 2);
  assert.equal(summary.modelSwitched, true);
  assert.equal(summary.status, "success");
  assert.equal(summary.model, "model-b");
  assert.doesNotMatch(JSON.stringify(summary), /private source text|secret-key/);
});
