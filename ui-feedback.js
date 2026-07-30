(() => {
  const originalLabels = new WeakMap();
  const dialogOpeners = new WeakMap();
  let feedbackTimer;

  function feedbackNode() {
    let node = document.querySelector("#actionFeedback");
    if (!node) {
      node = document.createElement("div");
      node.id = "actionFeedback";
      node.className = "action-feedback";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.append(node);
    }
    return node;
  }

  function showFeedback(message, type = "success") {
    const node = feedbackNode();
    clearTimeout(feedbackTimer);
    node.textContent = message;
    node.className = `action-feedback ${type} show`;
    feedbackTimer = setTimeout(() => node.classList.remove("show"), 1800);
  }

  function setButtonState(button, state = "default", options = {}) {
    if (!button) return;
    if (!originalLabels.has(button)) originalLabels.set(button, button.innerHTML);
    button.classList.remove("is-loading", "is-success", "is-error");
    button.removeAttribute("aria-busy");
    if (state === "default") {
      button.disabled = false;
      if (button.dataset.stateLabel) {
        button.innerHTML = originalLabels.get(button);
        delete button.dataset.stateLabel;
      }
      return;
    }
    if (state === "loading") {
      button.disabled = true;
      button.classList.add("is-loading");
      button.setAttribute("aria-busy", "true");
      return;
    }
    button.disabled = true;
    button.classList.add(state === "success" ? "is-success" : "is-error");
    if (options.label) {
      button.textContent = options.label;
      button.dataset.stateLabel = "true";
    }
    setTimeout(() => setButtonState(button), options.duration || 1800);
  }

  function firstFocusable(overlay) {
    return overlay.querySelector("[autofocus], input, button, [href], select, textarea, [tabindex]:not([tabindex='-1'])");
  }

  function openDialog(overlay, opener) {
    if (!overlay || !overlay.hidden) return;
    dialogOpeners.set(overlay, opener || document.activeElement);
    overlay.hidden = false;
    document.body.classList.add("has-modal");
    requestAnimationFrame(() => firstFocusable(overlay)?.focus());
  }

  function closeDialog(overlay) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (![...document.querySelectorAll(".settings-overlay")].some((item) => !item.hidden)) document.body.classList.remove("has-modal");
    dialogOpeners.get(overlay)?.focus?.();
  }

  function bindDialog({ overlay, opener, closeButton, onOpen }) {
    opener?.addEventListener("click", async () => {
      openDialog(overlay, opener);
      try { await onOpen?.(); } catch (error) { showFeedback(error.message || "操作失败，请重试。", "error"); }
    });
    closeButton?.addEventListener("click", () => closeDialog(overlay));
    overlay?.addEventListener("click", (event) => { if (event.target === overlay) closeDialog(overlay); });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const visibleOverlays = [...document.querySelectorAll(".settings-overlay")].filter((overlay) => !overlay.hidden);
    const overlay = visibleOverlays.at(-1);
    if (overlay) closeDialog(overlay);
  });

  window.VerbaUi = { bindDialog, closeDialog, openDialog, setButtonState, showFeedback };
})();
