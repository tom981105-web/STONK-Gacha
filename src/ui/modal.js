export function showModal({ title, body, actions = [] }) {
  closeModal();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.dataset.modal = "active";
  overlay.innerHTML = `
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h2 id="modal-title">${title}</h2>
        <button class="icon-button" type="button" data-close-modal aria-label="닫기">×</button>
      </div>
      <div class="modal-body">${body}</div>
      ${
        actions.length
          ? `<div class="modal-actions">${actions
              .map((action) => `<button type="button" class="${action.className}" data-modal-action="${action.id}">${action.label}</button>`)
              .join("")}</div>`
          : ""
      }
    </section>
  `;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close-modal]")) {
      closeModal();
    }
  });

  for (const action of actions) {
    overlay.querySelector(`[data-modal-action="${action.id}"]`)?.addEventListener("click", () => {
      action.onClick?.();
    });
  }

  document.body.appendChild(overlay);
}

export function closeModal() {
  document.querySelector("[data-modal='active']")?.remove();
}
