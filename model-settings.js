window.VerbaI18n.ready.then(() => {
  const i18n = window.VerbaI18n;
  const ui = window.VerbaUi;
  const status = document.querySelector("#modelStatus");
  const refreshButton = document.querySelector("#refreshModels");
  const toggle = document.querySelector("#manualModelToggle");
  const input = document.querySelector("#manualModelInput");
  const allowHighCost = document.querySelector("#allowHighCostModels");
  const saveButton = document.querySelector("#saveModelOverride");
  const message = document.querySelector("#modelMessage");
  const geminiSelect = document.querySelector("#geminiModelSelect");
  const provider = () => window.VerbaCurrentProvider?.() || "gemini";
  const cachedModels = new Map();
  const pending = new Set();
  const pendingSelections = new Map();
  let viewGeneration = 0;
  let requestSequence = 0;
  let activeRequest = 0;

  const statusKey = (value) => ({ ready: "status.ready", not_checked: "status.notChecked", checking: "status.checking", missing_key: "status.missingKey", key_error: "status.invalidKey", quota_error: "status.insufficientQuota", rate_limited: provider() === "groq" ? "api.groqRateLimit" : "gemini.rateLimited", cache_only: "status.cacheOnly", no_compatible_model: "status.noCompatibleModel", manual_override_invalid: "status.manualOverrideInvalid", degraded: "status.degraded" }[value] || "status.notChecked");

  function context() {
    activeRequest = ++requestSequence;
    return { provider: provider(), generation: viewGeneration, request: activeRequest };
  }
  function isCurrent(request) {
    return request.provider === provider() && request.generation === viewGeneration && request.request === activeRequest;
  }
  function modelError(model) {
    const code = model.selectionErrorCode || model.errorCode;
    if (code) {
      if (model.provider === "groq" && code === "PROVIDER_RATE_LIMIT") return i18n.t("api.groqRateLimit");
      if (model.provider === "gemini" && code === "PROVIDER_RATE_LIMIT") return `Google (Gemini): ${i18n.t("gemini.rateLimited")}`;
      return `${model.provider === "gemini" ? "Google (Gemini): " : model.provider === "groq" ? "Groq: " : ""}${i18n.error(code)}`;
    }
    return model.lastError || i18n.t(statusKey(model.status));
  }
  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("model-error", error);
  }
  function option(value, text) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = text;
    return item;
  }
  function choiceLabel(choice, currentProvider) {
    const labels = [choice.id];
    if (choice.recommended) labels.push(i18n.t("gemini.recommended"));
    if (currentProvider === "groq" && ["capability", "speed"].includes(choice.preference)) labels.push(i18n.t(`groq.${choice.preference}`));
    if (choice.lifecycle === "legacy") labels.push(i18n.t("gemini.legacy"));
    labels.push(choice.health === "healthy" && Number.isFinite(choice.latencyMs)
      ? i18n.t("gemini.latency", { milliseconds: new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 0 }).format(choice.latencyMs) })
      : i18n.t("gemini.notMeasured"));
    return labels.join(" · ");
  }
  function render(model = {}) {
    const currentProvider = provider();
    const google = currentProvider === "gemini";
    const groq = currentProvider === "groq";
    const dropdown = google || groq;
    const busy = pending.has(currentProvider);
    model = { provider: currentProvider, ...model };
    const heading = document.querySelector(".model-management-heading strong");
    const description = document.querySelector(".model-management-heading p");
    heading.textContent = i18n.t(google ? "gemini.models" : groq ? "groq.models" : "api.autoModels");
    description.textContent = i18n.t(google ? "gemini.description" : groq ? "groq.description" : "api.autoModelsDescription");
    status.classList.toggle("gemini-model-status", dropdown);
    document.querySelector("#modelCurrentValue").hidden = dropdown;
    geminiSelect.hidden = !dropdown;
    document.querySelector("#legacyModelControls").hidden = dropdown;
    document.querySelector("#geminiModelHelp").hidden = !google;
    document.querySelector("#groqModelHelp").hidden = !groq;
    geminiSelect.setAttribute("aria-describedby", groq ? "groqModelHelp" : "geminiModelHelp");
    document.querySelector("#currentModelLabel").textContent = i18n.t("api.currentModel");
    document.querySelector("#modelStatusLabel").textContent = i18n.t("api.status");
    document.querySelector("#modelCheckedLabel").textContent = i18n.t("api.lastChecked");
    document.querySelector("#modelCurrentValue").textContent = model.selectedModel || model.lastKnownGoodModel || model.primaryModel || "—";
    document.querySelector("#modelStatusValue").textContent = i18n.t(statusKey(busy ? "checking" : model.status));
    const checked = new Date(model.lastHealthCheckAt || "");
    document.querySelector("#modelCheckedValue").textContent = Number.isFinite(checked.getTime())
      ? new Intl.DateTimeFormat(i18n.locale, { dateStyle: "short", timeStyle: "short" }).format(checked) : "—";

    input.setAttribute("list", currentProvider === "groq" ? "groqModels" : "");
    document.querySelector("#groqModels").replaceChildren(...(model.models || []).map(id => option(id, id)));
    toggle.checked = Boolean(model.manualOverride);
    input.disabled = !toggle.checked;
    input.value = model.manualOverride || "";
    input.placeholder = i18n.t("api.manualPlaceholder");
    allowHighCost.checked = Boolean(model.allowHighCost);
    saveButton.disabled = busy;
    refreshButton.disabled = busy;
    geminiSelect.disabled = busy;
    geminiSelect.setAttribute("aria-busy", String(busy));

    if (dropdown) {
      const choices = (model.modelChoices || []).filter(choice => typeof choice.id === "string");
      const recommended = choices.find(choice => choice.recommended);
      const validCurrent = choices.find(choice => choice.id === model.selectedModel);
      const automaticModel = model.automatic && validCurrent ? validCurrent.id : recommended?.id || "";
      const automatic = option("", automaticModel
        ? i18n.t("gemini.automaticWithModel", { model: automaticModel })
        : i18n.t("gemini.automatic"));
      geminiSelect.replaceChildren(automatic, ...choices.map(choice => option(choice.id, choiceLabel(choice, currentProvider))));
      const selected = pendingSelections.has(currentProvider) ? pendingSelections.get(currentProvider) : model.manualOverride || "";
      if (selected && !choices.some(choice => choice.id === selected)) {
        const unavailable = option("__saved_unavailable__", i18n.t("gemini.savedUnavailable"));
        unavailable.disabled = true;
        geminiSelect.prepend(unavailable);
        geminiSelect.value = unavailable.value;
      } else geminiSelect.value = selected;
      geminiSelect.setAttribute("aria-invalid", String(Boolean(model.selectionErrorCode || model.errorCode)));
      document.querySelector("#geminiFreeTierNote").textContent = i18n.t("gemini.freeTierNote")
        + (model.catalogCheckedAt ? ` ${i18n.t("gemini.catalogChecked", { date: model.catalogCheckedAt })}` : "");
      document.querySelector("#geminiRankingNote").textContent = i18n.t("gemini.rankingNote");
      const selectedChoice = choices.find(choice => choice.id === (selected || model.selectedModel));
      const lifecycle = document.querySelector("#geminiLifecycleNote");
      lifecycle.hidden = !selectedChoice?.shutdownDate;
      lifecycle.textContent = selectedChoice?.shutdownDate ? i18n.t("gemini.retires", { date: selectedChoice.shutdownDate }) : "";
    }
    const hasError = Boolean(model.selectionErrorCode || model.errorCode || model.lastError);
    showMessage(busy ? i18n.t("gemini.saving") : hasError ? modelError(model)
      : google ? i18n.t("gemini.selectionHelp")
      : model.provider === "groq" ? i18n.t("groq.selectionHelp")
      : model.automatic ? i18n.t("api.automaticEnabled") : i18n.t("api.manualEnabled"), !busy && hasError);
  }

  async function requestModels(request, action, extra = {}) {
    const response = await fetch("/api/models", action ? {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: request.provider, action, ...extra })
    } : {});
    const data = await response.json();
    if (!response.ok) throw new Error(i18n.error(data.errorCode));
    return data.models[request.provider];
  }
  async function load() {
    if (pending.has(provider())) return render(cachedModels.get(provider()));
    const request = context();
    try {
      const model = await requestModels(request);
      if (!isCurrent(request)) return;
      cachedModels.set(request.provider, model);
      render(model);
    } catch (error) {
      if (isCurrent(request)) showMessage(error.message, true);
    }
  }
  async function saveOrRefresh(action, extra, button) {
    if (pending.has(provider())) return;
    const request = context();
    pending.add(request.provider);
    if (action === "select") pendingSelections.set(request.provider, extra.model);
    render(cachedModels.get(request.provider));
    if (button) ui.setButtonState(button, "loading");
    let failure;
    try {
      const model = await requestModels(request, action, extra);
      if (!isCurrent(request)) return;
      cachedModels.set(request.provider, model);
      if (["gemini", "groq"].includes(request.provider) && (model.status !== "ready" || model.selectionErrorCode || model.errorCode)) throw new Error(modelError(model));
    } catch (error) { failure = error; }
    finally {
      pending.delete(request.provider);
      pendingSelections.delete(request.provider);
      if (isCurrent(request)) {
        render(cachedModels.get(request.provider));
        if (failure) {
          showMessage(failure.message, true);
          if (button) ui.setButtonState(button, "error", { label: i18n.t(action === "refresh" ? "api.modelDetectionFailed" : "common.error") });
        } else {
          if (action === "select") showMessage(i18n.t("api.modelSaved"));
          if (button) ui.setButtonState(button, "success", { label: i18n.t(action === "refresh" ? "api.modelDetected" : "api.modelSaved") });
        }
      } else if (provider() === request.provider) load();
    }
  }

  refreshButton.addEventListener("click", () => saveOrRefresh("refresh", {}, refreshButton));
  geminiSelect.addEventListener("change", () => {
    if (["gemini", "groq"].includes(provider()) && geminiSelect.value !== "__saved_unavailable__") saveOrRefresh("select", { model: geminiSelect.value });
  });
  toggle.addEventListener("change", () => { input.disabled = !toggle.checked; if (!toggle.checked) input.value = ""; });
  saveButton.addEventListener("click", () => saveOrRefresh("override", { model: toggle.checked ? input.value.trim() : "", allowHighCost: allowHighCost.checked }, saveButton));
  window.addEventListener("verba:provider-changed", () => {
    viewGeneration += 1;
    ui.setButtonState(refreshButton);
    ui.setButtonState(saveButton);
    render(cachedModels.get(provider()));
    load();
  });
  window.addEventListener("verba:locale-changed", () => render(cachedModels.get(provider())));
  document.querySelector("#openSettings").addEventListener("click", () => { render(cachedModels.get(provider())); load(); });
  render();
});
