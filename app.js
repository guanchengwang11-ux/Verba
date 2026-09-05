window.VerbaI18n.ready.then(() => {
  const i18n = window.VerbaI18n;
  let currentMode = "email";
  let direction = "zhToEn";
  let provider = localStorage.getItem("verba-provider") || "openai";
  const source = document.querySelector("#sourceText");
  const result = document.querySelector("#translatedText");
  const meaning = document.querySelector("#meaningText");
  const counter = document.querySelector("#counter");
  const toneNote = document.querySelector("#toneNote");
  const translateButton = document.querySelector("#translateButton");
  const settingsOverlay = document.querySelector("#settingsOverlay");
  const glossaryOverlay = document.querySelector("#glossaryOverlay");
  const glossaryRows = document.querySelector("#glossaryRows");
  window.VerbaCurrentProvider = () => provider;

  const t = (key, values) => i18n.t(key, values);
  function updateCounter() { counter.textContent = `${source.value.length} / 1000`; }
  function updateMode() { document.querySelector("#modeName").textContent = currentMode === "email" ? t("studio.email") : t("studio.chat"); document.querySelector("#modeSub").textContent = currentMode === "email" ? t("studio.professionalTone") : t("studio.collaborativeTone"); }
  function updateLanguages() { document.querySelector("#sourceLanguage").innerHTML = `${direction === "zhToEn" ? t("studio.sourceChinese") : t("studio.sourceEnglish")} <span>⌄</span>`; document.querySelector("#targetLanguage").innerHTML = `${direction === "zhToEn" ? t("studio.sourceEnglish") : t("studio.sourceChinese")} <span>⌄</span>`; }
  function resetResult() { result.classList.remove("translation-error"); result.textContent = source.value.trim() ? "" : t("studio.empty"); meaning.textContent = ""; toneNote.textContent = ""; }
  function updateDynamicText() { source.placeholder = t("studio.placeholder"); document.querySelector("#interfaceLanguage").textContent = i18n.locale === "zh-CN" ? t("studio.sourceEnglish") : t("studio.sourceChinese"); updateMode(); updateLanguages(); if (!result.classList.contains("translation-error") && !meaning.textContent && !source.value.trim()) resetResult(); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
  function createGlossaryRow(entry = {}) { const row = document.createElement("div"); row.className = "glossary-row"; row.innerHTML = `<input class="glossary-source" maxlength="120" value="${escapeHtml(entry.source || "")}" placeholder="${escapeHtml(t("glossary.sourcePlaceholder"))}"><input class="glossary-target" maxlength="120" value="${escapeHtml(entry.target || "")}" placeholder="${escapeHtml(t("glossary.targetPlaceholder"))}"><button class="remove-term" aria-label="${escapeHtml(t("glossary.remove"))}">×</button>`; row.querySelector(".remove-term").addEventListener("click", () => row.remove()); glossaryRows.append(row); }
  function getGlossary() { return [...glossaryRows.querySelectorAll(".glossary-row")].map((row) => ({ source: row.querySelector(".glossary-source").value.trim(), target: row.querySelector(".glossary-target").value.trim() })).filter((entry) => entry.source && entry.target).slice(0, 50); }
  function loadGlossary() { glossaryRows.innerHTML = ""; try { JSON.parse(localStorage.getItem("verba-glossary") || "[]").forEach(createGlossaryRow); } catch { localStorage.removeItem("verba-glossary"); } }
  function refreshProviderUi() { document.querySelectorAll(".provider-option").forEach((button) => button.classList.toggle("active", button.dataset.provider === provider)); }
  function closeAllOverlays() { window.VerbaUi.closeDialog(settingsOverlay); window.VerbaUi.closeDialog(glossaryOverlay); }
  function openSettings() { refreshProviderUi(); window.VerbaUi.openDialog(settingsOverlay, document.querySelector("#openSettings")); }
  function openGlossary() { loadGlossary(); window.VerbaUi.openDialog(glossaryOverlay, document.querySelector("#openGlossary")); }
  async function requestTranslation() {
    const text = source.value.trim();
    if (!text) return resetResult();
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    window.VerbaUi.setButtonState(translateButton, "loading"); result.classList.remove("translation-error"); result.textContent = t("studio.waiting"); meaning.textContent = "";
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode: currentMode, direction, provider, glossary: getGlossary() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(i18n.error(data.errorCode));
      result.textContent = data.translation; meaning.textContent = data.englishMeaning; toneNote.textContent = currentMode === "email" ? t("studio.emailDescription") : t("studio.chatDescription");
      if (data.translation) document.dispatchEvent(new CustomEvent("verba:translation-complete", { detail: { source: text, translation: data.translation, englishMeaning: data.englishMeaning, direction, mode: currentMode, provider, requestId } }));
    } catch (error) { result.classList.add("translation-error"); result.textContent = error.message || i18n.error("TRANSLATION_FAILED"); window.VerbaUi.showFeedback(result.textContent, "error"); }
    finally { window.VerbaUi.setButtonState(translateButton); }
  }
  document.querySelectorAll(".mode-card").forEach((card) => card.addEventListener("click", () => { currentMode = card.dataset.mode; document.querySelectorAll(".mode-card").forEach((item) => item.classList.toggle("active", item === card)); updateMode(); }));
  document.querySelector("#interfaceLanguage").addEventListener("click", () => i18n.setLocale(i18n.locale === "zh-CN" ? "en-US" : "zh-CN"));
  document.querySelector("#swapLanguages").addEventListener("click", () => { direction = direction === "zhToEn" ? "enToZh" : "zhToEn"; updateLanguages(); resetResult(); });
  document.querySelector("#openSettings").addEventListener("click", openSettings); document.querySelector("#openGlossary").addEventListener("click", openGlossary); document.querySelector("#closeSettings").addEventListener("click", closeAllOverlays); document.querySelector("#closeGlossary").addEventListener("click", closeAllOverlays);
  [settingsOverlay, glossaryOverlay].forEach((overlay) => overlay.addEventListener("click", (event) => { if (event.target === overlay) closeAllOverlays(); }));
  document.querySelectorAll(".provider-option").forEach((button) => button.addEventListener("click", () => { provider = button.dataset.provider; refreshProviderUi(); window.dispatchEvent(new Event("verba:provider-changed")); }));
  document.querySelector("#saveSettings").addEventListener("click", () => { localStorage.setItem("verba-provider", provider); window.VerbaUi.showFeedback(t("api.useProvider"), "success"); closeAllOverlays(); });
  document.querySelector("#addTerm").addEventListener("click", () => createGlossaryRow()); document.querySelector("#saveGlossary").addEventListener("click", () => { localStorage.setItem("verba-glossary", JSON.stringify(getGlossary())); closeAllOverlays(); });
  source.addEventListener("input", () => { updateCounter(); resetResult(); }); document.querySelector("#translateButton").addEventListener("click", requestTranslation); document.querySelector("#clearText").addEventListener("click", () => { source.value = ""; updateCounter(); resetResult(); source.focus(); });
  document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") requestTranslation(); if (event.key === "Escape") closeAllOverlays(); });
  window.addEventListener("verba:locale-changed", updateDynamicText); updateCounter(); updateDynamicText();
});
