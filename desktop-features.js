const historyOverlay = document.querySelector("#historyOverlay");
const appSettingsOverlay = document.querySelector("#appSettingsOverlay");
const historyList = document.querySelector("#historyList");
const historySearch = document.querySelector("#historySearch");
const updateStatus = document.querySelector("#updateStatus");
const installUpdateButton = document.querySelector("#installUpdate");
const sourceText = document.querySelector("#sourceText");
const translatedText = document.querySelector("#translatedText");
const meaningText = document.querySelector("#meaningText");
const counter = document.querySelector("#counter");
let historyItems = [];
let historySearchTimer;
let historyRequestNumber = 0;

function closeOverlay(overlay) { overlay.hidden = true; }
function escapeText(value) { return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function selectedText() { return window.getSelection?.().toString().trim() || ""; }
function historyModeLabel(item) { return item.mode === "chat" ? "同事协作 / Team chat" : "专业邮件 / Professional email"; }
function historyLanguageLabel(item) {
  const sourceLanguage = item.sourceLanguageLabel || item.sourceLanguage || (item.direction === "enToZh" ? "English" : "中文");
  const targetLanguage = item.targetLanguageLabel || item.targetLanguage || (item.direction === "enToZh" ? "中文" : "English");
  return `${sourceLanguage} → ${targetLanguage}`;
}

function renderHistoryItem(item) {
  return `<article class="history-item" data-id="${escapeText(item.id)}"><div class="history-copy"><span class="history-source">${escapeText(item.source)}</span><small class="history-translation">${escapeText(item.translation)}</small></div><div class="history-meta"><span>${escapeText(historyLanguageLabel(item))} · ${escapeText(historyModeLabel(item))}</span><em>${new Date(item.createdAt).toLocaleString()}</em></div><div class="history-actions"><button type="button" class="history-action" data-history-action="copy-source">复制原文</button><button type="button" class="history-action" data-history-action="copy-translation">复制译文</button><button type="button" class="history-restore" data-history-action="restore">恢复到翻译页</button></div></article>`;
}

function renderHistoryEmpty(query) {
  historyList.innerHTML = `<p class="history-empty">${query ? "未找到相关历史记录" : "暂无历史记录"}</p>`;
}

async function loadHistory() {
  const query = historySearch.value.trim();
  const requestNumber = ++historyRequestNumber;
  const response = await fetch(`/api/history?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load history.");
  if (requestNumber !== historyRequestNumber) return;
  historyItems = data.history;
  historyList.innerHTML = historyItems.length ? historyItems.map(renderHistoryItem).join("") : "";
  if (!historyItems.length) renderHistoryEmpty(query);
}

async function saveHistory(detail) {
  const response = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(detail) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to save history.");
  return data;
}

function restoreHistory(item) {
  sourceText.value = item.source;
  counter.textContent = `${item.source.length} / 1000`;
  translatedText.classList.remove("translation-error");
  translatedText.textContent = item.translation;
  meaningText.textContent = item.englishMeaning;
  closeOverlay(historyOverlay);
}

async function copyHistoryValue(value) {
  await navigator.clipboard.writeText(value);
}

document.addEventListener("verba:translation-complete", (event) => {
  saveHistory(event.detail).catch((error) => console.error("Unable to save translation history:", error));
});

document.querySelector("#openHistory").addEventListener("click", async () => {
  historyOverlay.hidden = false;
  historySearch.value = "";
  try { await loadHistory(); } catch (error) { historyList.innerHTML = `<p class="history-empty">${escapeText(error.message)}</p>`; }
});
document.querySelector("#closeHistory").addEventListener("click", () => closeOverlay(historyOverlay));
historyOverlay.addEventListener("click", (event) => { if (event.target === historyOverlay) closeOverlay(historyOverlay); });
historySearch.addEventListener("input", () => {
  clearTimeout(historySearchTimer);
  historySearchTimer = setTimeout(() => loadHistory().catch((error) => { historyList.innerHTML = `<p class="history-empty">${escapeText(error.message)}</p>`; }), 180);
});
historyList.addEventListener("click", async (event) => {
  const card = event.target.closest(".history-item");
  if (!card) return;
  const item = historyItems.find((entry) => entry.id === card.dataset.id);
  if (!item) return;
  const action = event.target.closest("[data-history-action]")?.dataset.historyAction;
  if (action === "copy-source") return copyHistoryValue(item.source).catch((error) => console.error("Unable to copy source:", error));
  if (action === "copy-translation") return copyHistoryValue(item.translation).catch((error) => console.error("Unable to copy translation:", error));
  if (action === "restore") return restoreHistory(item);
  if (event.target.closest(".history-actions")) return;
  if (!selectedText()) restoreHistory(item);
});

function showUpdateState(update) {
  const messages = { idle: "尚未检查更新。", checking: "正在检查更新…", available: `发现新版本 ${update.version || ""}，正在下载。`, downloading: `正在下载更新：${Math.round(update.percent || 0)}%`, downloaded: `更新 ${update.version || ""} 已下载。`, "not-available": "当前已是最新版本。", unavailable: "更新服务仅在桌面应用中可用。", error: update.message || "暂时无法连接更新服务器。" };
  updateStatus.textContent = messages[update.status] || "更新状态未知。";
  installUpdateButton.hidden = update.status !== "downloaded";
}

async function refreshUpdateState() {
  const response = await fetch("/api/update");
  const data = await response.json();
  showUpdateState(data.update || { status: "unavailable" });
}

document.querySelector("#openAppSettings").addEventListener("click", async () => { appSettingsOverlay.hidden = false; try { await refreshUpdateState(); } catch (error) { showUpdateState({ status: "error", message: error.message }); } });
document.querySelector("#closeAppSettings").addEventListener("click", () => closeOverlay(appSettingsOverlay));
appSettingsOverlay.addEventListener("click", (event) => { if (event.target === appSettingsOverlay) closeOverlay(appSettingsOverlay); });
document.querySelector("#checkUpdates").addEventListener("click", async () => { try { const response = await fetch("/api/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check" }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to check for updates."); showUpdateState(payload.update || { status: "checking" }); setTimeout(() => refreshUpdateState().catch((error) => showUpdateState({ status: "error", message: error.message })), 500); } catch (error) { showUpdateState({ status: "error", message: error.message }); } });
installUpdateButton.addEventListener("click", async () => { try { const response = await fetch("/api/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "install" }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to install the update."); } catch (error) { showUpdateState({ status: "error", message: error.message }); } });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeOverlay(historyOverlay); closeOverlay(appSettingsOverlay); } });
