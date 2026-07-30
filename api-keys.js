window.VerbaI18n.ready.then(() => {
  const i18n = window.VerbaI18n;
  const ui = window.VerbaUi;
  const overlay = document.querySelector("#apiKeyOverlay");
  const inputs = { openai: document.querySelector("#openaiKey"), gemini: document.querySelector("#geminiKey"), deepseek: document.querySelector("#deepseekKey") };
  const saveButton = document.querySelector("#saveApiKeys");
  const message = document.querySelector("#keySaveMessage");
  function showStatus(keys) { Object.keys(inputs).forEach((provider) => { const status = document.querySelector(`#${provider}Status`); status.textContent = `● ${keys[provider] ? i18n.t("api.keyConfigured") : i18n.t("api.keyMissing")}`; status.classList.toggle("configured", Boolean(keys[provider])); }); }
  async function load() { const response = await fetch("/api/config"); const data = await response.json(); if (!response.ok) throw new Error(i18n.error(data.errorCode)); showStatus(data.keys); }
  ui.bindDialog({ overlay, opener: document.querySelector("#openApiKeys"), closeButton: document.querySelector("#closeApiKeys"), onOpen: async () => { Object.values(inputs).forEach((input) => { input.value = ""; }); await load(); } });
  saveButton.addEventListener("click", async () => { const keys = Object.fromEntries(Object.entries(inputs).map(([provider, input]) => [provider, input.value])); try { ui.setButtonState(saveButton, "loading"); const response = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys }) }); const data = await response.json(); if (!response.ok) throw new Error(i18n.error(data.errorCode)); showStatus(data.keys); Object.values(inputs).forEach((input) => { input.value = ""; }); message.textContent = i18n.t("api.keysSaved"); ui.setButtonState(saveButton, "success", { label: i18n.t("common.success") }); ui.showFeedback(i18n.t("api.keysSaved"), "success"); } catch (error) { message.textContent = error.message; ui.setButtonState(saveButton, "error", { label: i18n.t("common.error") }); ui.showFeedback(error.message, "error"); } });
  window.addEventListener("verba:locale-changed", () => load().catch(() => {}));
});
