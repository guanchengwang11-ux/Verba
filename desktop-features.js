const historyOverlay = document.querySelector("#historyOverlay");
const appSettingsOverlay = document.querySelector("#appSettingsOverlay");
const historyList = document.querySelector("#historyList");
const historySearch = document.querySelector("#historySearch");
const updateStatus = document.querySelector("#updateStatus");
const installUpdateButton = document.querySelector("#installUpdate");
let historyItems = [];
let pendingHistorySave;

function closeOverlay(overlay) { overlay.hidden = true; }
function escapeText(value) { return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

async function loadHistory() {
  const query = historySearch.value.trim();
  const response = await fetch(`/api/history?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load history.");
  historyItems = data.history;
  historyList.innerHTML = historyItems.length ? historyItems.map((item) => `<button class="history-item" data-id="${item.id}"><span>${escapeText(item.source)}</span><small>${escapeText(item.translation)}</small><em>${new Date(item.createdAt).toLocaleString()}</em></button>`).join("") : "<p class=\"history-empty\">暂无历史记录</p>";
}

function queueHistorySave() {
  clearTimeout(pendingHistorySave);
  pendingHistorySave = setTimeout(async () => {
    const source = document.querySelector("#sourceText").value.trim();
    const translation = document.querySelector("#translatedText").textContent.trim();
    const englishMeaning = document.querySelector("#meaningText").textContent.trim();
    const hasError = document.querySelector("#translatedText").classList.contains("translation-error");
    if (!source || !translation || !englishMeaning || hasError) return;
    await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, translation, englishMeaning }) });
  }, 250);
}

new MutationObserver(queueHistorySave).observe(document.querySelector("#translatedText"), { childList: true, characterData: true, subtree: true });

document.querySelector("#openHistory").addEventListener("click", async () => { historyOverlay.hidden = false; try { await loadHistory(); } catch (error) { historyList.innerHTML = `<p class="history-empty">${escapeText(error.message)}</p>`; } });
document.querySelector("#closeHistory").addEventListener("click", () => closeOverlay(historyOverlay));
historyOverlay.addEventListener("click", (event) => { if (event.target === historyOverlay) closeOverlay(historyOverlay); });
historySearch.addEventListener("input", () => { clearTimeout(historySearch.timer); historySearch.timer = setTimeout(loadHistory, 200); });
historyList.addEventListener("click", (event) => {
  const button = event.target.closest(".history-item");
  const item = historyItems.find((entry) => entry.id === button?.dataset.id);
  if (!item) return;
  document.querySelector("#sourceText").value = item.source;
  document.querySelector("#counter").textContent = `${item.source.length} / 1000`;
  document.querySelector("#translatedText").textContent = item.translation;
  document.querySelector("#meaningText").textContent = item.englishMeaning;
  closeOverlay(historyOverlay);
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
