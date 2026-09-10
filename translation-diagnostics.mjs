import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const TRANSLATION_ERROR_CODES = Object.freeze({
  PROVIDER_NETWORK_ERROR: "PROVIDER_NETWORK_ERROR",
  PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT",
  PROVIDER_QUOTA_ERROR: "PROVIDER_QUOTA_ERROR",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  MODEL_OUTPUT_INVALID: "MODEL_OUTPUT_INVALID",
  JSON_PARSE_FAILED: "JSON_PARSE_FAILED",
  ENTITY_RESTORE_FAILED: "ENTITY_RESTORE_FAILED",
  ENTITY_VALIDATION_FAILED: "ENTITY_VALIDATION_FAILED",
  SEMANTIC_VALIDATION_FAILED: "SEMANTIC_VALIDATION_FAILED",
  TRANSLATION_EMPTY: "TRANSLATION_EMPTY",
  LOCAL_SERVER_ERROR: "LOCAL_SERVER_ERROR",
  REQUEST_CANCELLED: "REQUEST_CANCELLED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR"
});

const allowedCodes = new Set(Object.values(TRANSLATION_ERROR_CODES));
let diagnosticsDirectory = "";
let latestDiagnostic = null;

export class TranslationError extends Error {
  constructor(code, message, options = {}) {
    super(message || code, options.cause ? { cause: options.cause } : undefined);
    this.name = "TranslationError";
    this.internalCode = allowedCodes.has(code) ? code : TRANSLATION_ERROR_CODES.UNKNOWN_ERROR;
    this.stage = options.stage || "unknown";
    this.status = Number(options.status) || 0;
    this.providerErrorCode = String(options.providerErrorCode || "");
    this.provider = String(options.provider || "");
    this.model = String(options.model || "");
  }
}

export function createTranslationError(code, options = {}) {
  return new TranslationError(code, options.message, options);
}

function indicatesQuota(error) {
  const value = `${error?.code || ""} ${error?.providerErrorCode || ""} ${error?.message || ""}`;
  return /(insufficient[_ -]?quota|quota.*exceed|billing|credit|resource_exhausted)/i.test(value);
}

export function classifyProviderError(error) {
  if (error?.internalCode && allowedCodes.has(error.internalCode)) return error.internalCode;
  const status = Number(error?.status) || 0;
  if (!status || /fetch failed|network|socket|econn|enotfound|timed?\s*out/i.test(error?.message || "")) {
    return TRANSLATION_ERROR_CODES.PROVIDER_NETWORK_ERROR;
  }
  if (status === 429) return indicatesQuota(error)
    ? TRANSLATION_ERROR_CODES.PROVIDER_QUOTA_ERROR
    : TRANSLATION_ERROR_CODES.PROVIDER_RATE_LIMIT;
  if (status === 404 || /(invalid model|model.*not found|deprecated|does not exist|not available)/i.test(error?.message || "")) {
    return TRANSLATION_ERROR_CODES.MODEL_NOT_FOUND;
  }
  if ([502, 503, 504].includes(status)) return TRANSLATION_ERROR_CODES.PROVIDER_UNAVAILABLE;
  if (status === 422) return TRANSLATION_ERROR_CODES.MODEL_OUTPUT_INVALID;
  return TRANSLATION_ERROR_CODES.PROVIDER_UNAVAILABLE;
}

export function normalizeTranslationError(error, defaults = {}) {
  if (error instanceof TranslationError) {
    if (!error.provider) error.provider = defaults.provider || "";
    if (!error.model) error.model = defaults.model || "";
    return error;
  }
  const code = classifyProviderError(error);
  return createTranslationError(code, {
    message: error?.message || code,
    status: error?.status,
    providerErrorCode: error?.code,
    provider: defaults.provider,
    model: defaults.model,
    stage: defaults.stage || "provider_request",
    cause: error
  });
}

function safeEvent(event) {
  const allowed = [
    "event", "requestId", "timestamp", "attempt", "validationAttempt", "provider", "model",
    "result", "stage", "internalCode", "httpStatus", "providerErrorCode", "latencyMs",
    "modelSwitched", "willRetry", "willRegenerate", "severity", "issueCodes", "ruleIds",
    "disposition", "retryReason", "success", "validationMs", "providerRequestCount", "totalLatencyMs"
  ];
  return Object.fromEntries(allowed.filter((key) => event[key] !== undefined).map((key) => [key, event[key]]));
}

async function writeLog(event) {
  const safe = safeEvent(event);
  const line = `${JSON.stringify(safe)}\n`;
  console.info(line.trimEnd());
  if (!diagnosticsDirectory) return;
  try {
    await mkdir(diagnosticsDirectory, { recursive: true });
    await appendFile(join(diagnosticsDirectory, "translation-diagnostics.log"), line, "utf8");
  } catch (error) {
    console.warn(JSON.stringify({ event: "translation_diagnostic_log_failed", code: error.code || "UNKNOWN" }));
  }
}

export function configureTranslationDiagnostics(configurationDirectory) {
  diagnosticsDirectory = configurationDirectory ? join(configurationDirectory, "logs") : "";
}

export class TranslationDiagnosticSession {
  constructor(provider, { maxProviderAttempts = 4, timeoutMs = 30000 } = {}) {
    this.requestId = randomUUID();
    this.provider = provider;
    this.model = "";
    this.attempt = 0;
    this.modelSwitched = false;
    this.events = [];
    this.startedAt = Date.now();
    this.maxProviderAttempts = maxProviderAttempts;
    this.timeoutMs = timeoutMs;
    this.validationMs = 0;
    this.totalLatencyMs = 0;
    this.cancelled = false;
    this.finalStatus = "running";
    this.finalErrorCode = "";
    this.httpStatus = 0;
    this.providerErrorCode = "";
    this.stage = "request_received";
    this.publish();
  }

  nextAttempt() {
    if (!this.canAttempt()) {
      throw createTranslationError(this.cancelled ? TRANSLATION_ERROR_CODES.REQUEST_CANCELLED : TRANSLATION_ERROR_CODES.PROVIDER_UNAVAILABLE, {
        message: this.cancelled ? "The translation request was cancelled." : "The translation attempt budget was exhausted.",
        status: this.cancelled ? 499 : 503,
        provider: this.provider,
        model: this.model,
        stage: this.cancelled ? "request_cancelled" : "attempt_budget"
      });
    }
    this.attempt += 1;
    return this.attempt;
  }

  canAttempt() {
    return !this.cancelled && this.attempt < this.maxProviderAttempts && this.remainingMs() > 0;
  }

  remainingMs() {
    return Math.max(0, this.timeoutMs - (Date.now() - this.startedAt));
  }

  cancel() {
    this.cancelled = true;
  }

  record(event) {
    const entry = safeEvent({
      event: event.event || "translation_diagnostic",
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      provider: event.provider || this.provider,
      ...event
    });
    if (entry.model) this.model = entry.model;
    if (entry.modelSwitched) this.modelSwitched = true;
    if (entry.httpStatus) this.httpStatus = entry.httpStatus;
    if (entry.providerErrorCode) this.providerErrorCode = entry.providerErrorCode;
    if (entry.stage) this.stage = entry.stage;
    if (entry.internalCode) this.finalErrorCode = entry.internalCode;
    if (entry.validationMs) this.validationMs += entry.validationMs;
    if (entry.totalLatencyMs) this.totalLatencyMs = entry.totalLatencyMs;
    this.events.push(entry);
    this.publish();
    void writeLog(entry);
    return entry;
  }

  complete(model = this.model) {
    this.finalStatus = "success";
    this.finalErrorCode = "";
    this.model = model || this.model;
    this.stage = "complete";
    this.totalLatencyMs = Date.now() - this.startedAt;
    this.record({ event: "translation_complete", model: this.model, stage: "complete", success: true, providerRequestCount: this.attempt, totalLatencyMs: this.totalLatencyMs });
  }

  fail(error) {
    const normalized = normalizeTranslationError(error, { provider: this.provider, model: this.model, stage: error?.stage || this.stage });
    this.finalStatus = "failed";
    this.finalErrorCode = normalized.internalCode;
    this.httpStatus = normalized.status || this.httpStatus;
    this.providerErrorCode = normalized.providerErrorCode || this.providerErrorCode;
    this.stage = normalized.stage || this.stage;
    this.totalLatencyMs = Date.now() - this.startedAt;
    this.record({
      event: "translation_failed",
      model: normalized.model || this.model,
      stage: this.stage,
      internalCode: normalized.internalCode,
      httpStatus: this.httpStatus,
      providerErrorCode: this.providerErrorCode,
      modelSwitched: this.modelSwitched,
      success: false,
      providerRequestCount: this.attempt,
      totalLatencyMs: this.totalLatencyMs
    });
    return normalized;
  }

  summary() {
    return {
      requestId: this.requestId,
      timestamp: new Date(this.startedAt).toISOString(),
      provider: this.provider,
      model: this.model,
      status: this.finalStatus,
      errorCode: this.finalErrorCode,
      stage: this.stage,
      httpStatus: this.httpStatus,
      providerErrorCode: this.providerErrorCode,
      modelSwitched: this.modelSwitched,
      attemptCount: this.attempt,
      validationMs: this.validationMs,
      totalLatencyMs: this.totalLatencyMs || Date.now() - this.startedAt,
      events: this.events.slice(-20)
    };
  }

  publish() {
    latestDiagnostic = this.summary();
  }
}

export function createTranslationDiagnosticSession(provider, options) {
  return new TranslationDiagnosticSession(provider, options);
}

export function getLatestTranslationDiagnostic() {
  return latestDiagnostic || {
    requestId: "",
    timestamp: "",
    provider: "",
    model: "",
    status: "not_run",
    errorCode: "",
    stage: "",
    httpStatus: 0,
    providerErrorCode: "",
    modelSwitched: false,
    attemptCount: 0,
    validationMs: 0,
    totalLatencyMs: 0,
    events: []
  };
}
