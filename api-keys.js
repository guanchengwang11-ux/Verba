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

const apiKeyOverlay = document.querySelector("#apiKeyOverlay");
const apiKeyInputs = {
  openai: document.querySelector("#openaiKey"),
  gemini: document.querySelector("#geminiKey"),
  deepseek: document.querySelector("#deepseekKey")
};

function showKeyStatus(keys) {
  for (const provider of Object.keys(apiKeyInputs)) {
    const status = document.querySelector(`#${provider}Status`);
    status.textContent = keys[provider] ? "● 已配置" : "○ 未配置";
    status.classList.toggle("configured", Boolean(keys[provider]));
  }
}

async function loadKeyStatus() {
  const response = await fetch("/api/config");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load API key status.");
  showKeyStatus(data.keys);
}

document.querySelector("#openApiKeys").addEventListener("click", async () => {
  Object.values(apiKeyInputs).forEach((input) => { input.value = ""; });
  apiKeyOverlay.hidden = false;
  try { await loadKeyStatus(); } catch (error) { document.querySelector("#keySaveMessage").textContent = error.message; }
});

document.querySelector("#closeApiKeys").addEventListener("click", () => { apiKeyOverlay.hidden = true; });
apiKeyOverlay.addEventListener("click", (event) => { if (event.target === apiKeyOverlay) apiKeyOverlay.hidden = true; });

document.querySelector("#saveApiKeys").addEventListener("click", async () => {
  const button = document.querySelector("#saveApiKeys");
  const message = document.querySelector("#keySaveMessage");
  const keys = Object.fromEntries(Object.entries(apiKeyInputs).map(([provider, input]) => [provider, input.value]));
  button.disabled = true;
  try {
    const response = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save API keys.");
    showKeyStatus(data.keys);
    Object.values(apiKeyInputs).forEach((input) => { input.value = ""; });
    message.textContent = "已保存，翻译可立即使用。";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("keydown", (event) => { if (event.key === "Escape") apiKeyOverlay.hidden = true; });
