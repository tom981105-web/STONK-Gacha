let toastRoot;

export function showToast(message, tone = "info") {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";
    document.body.appendChild(toastRoot);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  toastRoot.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("toast-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 2600);
}
