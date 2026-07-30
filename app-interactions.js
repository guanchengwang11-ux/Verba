(() => {
  const ui = window.VerbaUi;
  const sourceText = document.querySelector("#sourceText");
  const copyButton = document.querySelector("#copyText");
  const pasteButton = document.querySelector("#clearText")?.nextElementSibling;
  const regenerateButton = document.querySelector(".result-footer .small-action");
  const newTranslationButton = document.querySelector(".new-chat");
  const helpButton = document.querySelector(".help-button");

  pasteButton?.setAttribute("aria-label", "粘贴");
  regenerateButton?.setAttribute("aria-label", "重新生成");
  newTranslationButton?.setAttribute("aria-label", "新建翻译");
  helpButton?.setAttribute("aria-label", "帮助中心");

  ui.bindDialog({ overlay: document.querySelector("#settingsOverlay") });
  ui.bindDialog({ overlay: document.querySelector("#glossaryOverlay") });

  copyButton?.addEventListener("click", async (event) => {
    event.stopImmediatePropagation();
    try {
      ui.setButtonState(copyButton, "loading");
      await navigator.clipboard.writeText(document.querySelector("#translatedText").textContent);
      ui.setButtonState(copyButton, "success", { label: "已复制" });
      ui.showFeedback("译文已复制到剪贴板。", "success");
    } catch (error) {
      ui.setButtonState(copyButton, "error", { label: "复制失败" });
      ui.showFeedback(error.message || "复制译文失败，请重试。", "error");
    }
  }, true);

  pasteButton?.addEventListener("click", async () => {
    try {
      ui.setButtonState(pasteButton, "loading");
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error("剪贴板中没有可粘贴的文本。");
      sourceText.value = text;
      sourceText.dispatchEvent(new Event("input", { bubbles: true }));
      ui.setButtonState(pasteButton, "success", { label: "已粘贴" });
      sourceText.focus();
    } catch (error) {
      ui.setButtonState(pasteButton, "error", { label: "粘贴失败" });
      ui.showFeedback(error.message || "无法读取剪贴板。", "error");
    }
  });

  regenerateButton?.addEventListener("click", () => document.querySelector("#translateButton")?.click());
  newTranslationButton?.addEventListener("click", () => sourceText.focus());
  document.querySelector("#saveSettings")?.addEventListener("click", () => ui.showFeedback("翻译引擎设置已保存。", "success"));
  document.querySelector("#saveGlossary")?.addEventListener("click", () => ui.showFeedback("术语词典已保存。", "success"));
  helpButton?.addEventListener("click", () => ui.showFeedback("帮助中心即将推出。", "success"));
})();
