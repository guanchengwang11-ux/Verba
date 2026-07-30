(() => {
  uiText.zh.apiKeys = "API 密钥";
  uiText.zh.apiKeyDescriptionTitle = "管理你的翻译服务密钥";
  uiText.zh.apiKeyDescription = "密钥会安全保存到本机 Verba 配置中，不会显示在翻译界面中。";
  uiText.zh.keysLocal = "仅保存在此电脑的 Verba 配置中";
  uiText.zh.saveKeys = "保存密钥";
  uiText.en.apiKeys = "API keys";
  uiText.en.apiKeyDescriptionTitle = "Manage your translation service keys";
  uiText.en.apiKeyDescription = "Keys are securely saved to this computer's Verba configuration and never shown in the translation workspace.";
  uiText.en.keysLocal = "Saved only in this computer's Verba configuration";
  uiText.en.saveKeys = "Save keys";

  const ui = window.VerbaUi;
  const apiKeyOverlay = document.querySelector("#apiKeyOverlay");
  const apiKeyInputs = {
    openai: document.querySelector("#openaiKey"),
    gemini: document.querySelector("#geminiKey"),
    deepseek: document.querySelector("#deepseekKey")
  };
  const saveButton = document.querySelector("#saveApiKeys");
  const saveMessage = document.querySelector("#keySaveMessage");

  function showKeyStatus(keys) {
    for (const provider of Object.keys(apiKeyInputs)) {
      const status = document.querySelector(`#${provider}Status`);
      status.textContent = keys[provider] ? "● 已配置" : "● 未配置";
      status.classList.toggle("configured", Boolean(keys[provider]));
    }
  }

  async function loadKeyStatus() {
    const response = await fetch("/api/config");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load API key status.");
    showKeyStatus(data.keys);
  }

  ui.bindDialog({
    overlay: apiKeyOverlay,
    opener: document.querySelector("#openApiKeys"),
    closeButton: document.querySelector("#closeApiKeys"),
    onOpen: async () => {
      Object.values(apiKeyInputs).forEach((input) => { input.value = ""; });
      await loadKeyStatus();
    }
  });

  saveButton.addEventListener("click", async () => {
    const keys = Object.fromEntries(Object.entries(apiKeyInputs).map(([provider, input]) => [provider, input.value]));
    try {
      ui.setButtonState(saveButton, "loading");
      const response = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save API keys.");
      showKeyStatus(data.keys);
      Object.values(apiKeyInputs).forEach((input) => { input.value = ""; });
      saveMessage.textContent = "已保存，翻译可立即使用。";
      ui.setButtonState(saveButton, "success", { label: "已保存" });
      ui.showFeedback("API 密钥已保存。", "success");
    } catch (error) {
      saveMessage.textContent = error.message || "保存失败，请重试。";
      ui.setButtonState(saveButton, "error", { label: "保存失败" });
      ui.showFeedback(error.message || "保存 API 密钥失败。", "error");
    }
  });
})();
