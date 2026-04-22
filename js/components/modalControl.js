// ===== MODAL CONTROL MODULE =====

// ===== MODAL MANAGEMENT =====

const kModalOverlayDismiss = Symbol.for('st.modalOverlayDismiss');
const kModalFocusTrap = Symbol.for('st.modalFocusTrap');

const MODAL_FOCUS_TRAP_IDS = new Set(['project-modal', 'task-modal', 'task-viewer-modal']);

function getModalFocusableRoots(overlayEl) {
  const panel = overlayEl.querySelector('.modal');
  return panel || overlayEl;
}

function listFocusableInModal(root) {
  if (!root) return [];
  const sel =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll(sel)].filter(el => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.disabled) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function teardownModalFocusTrap(overlayEl) {
  if (!overlayEl) return;
  const fn = overlayEl[kModalFocusTrap];
  if (typeof fn === 'function') {
    overlayEl.removeEventListener('keydown', fn);
    overlayEl[kModalFocusTrap] = null;
  }
  const prev = overlayEl._modalFocusTrapPrev;
  overlayEl._modalFocusTrapPrev = null;
  if (prev && typeof prev.focus === 'function') {
    try {
      window.setTimeout(() => {
        if (document.body.contains(prev)) prev.focus();
      }, 0);
    } catch (_) { /* noop */ }
  }
}

function setupModalFocusTrap(id, overlayEl) {
  teardownModalFocusTrap(overlayEl);
  const root = getModalFocusableRoots(overlayEl);
  overlayEl._modalFocusTrapPrev = document.activeElement;
  const onKey = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (id === 'task-viewer-modal' && typeof window.closeTaskViewerModal === 'function') {
        window.closeTaskViewerModal();
      } else {
        closeModal(id);
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = listFocusableInModal(root);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const cur = document.activeElement;
    if (e.shiftKey) {
      if (cur === first || !root.contains(cur)) {
        e.preventDefault();
        last.focus();
      }
    } else if (cur === last || !root.contains(cur)) {
      e.preventDefault();
      first.focus();
    }
  };
  overlayEl[kModalFocusTrap] = onKey;
  overlayEl.addEventListener('keydown', onKey);
  window.requestAnimationFrame(() => {
    const nodes = listFocusableInModal(root);
    if (nodes[0]) nodes[0].focus();
  });
}

function detachModalOverlayDismiss(overlayEl) {
  if (!overlayEl) return;
  const fn = overlayEl[kModalOverlayDismiss];
  if (typeof fn === 'function') {
    overlayEl.removeEventListener('click', fn);
    overlayEl[kModalOverlayDismiss] = null;
  }
}

function shouldAttachOverlayDismiss(id, overlayEl) {
  if (id === 'confirm-modal') return false;
  if (overlayEl.classList.contains('modal-no-dismiss')) return false;
  if (overlayEl.hasAttribute('data-no-dismiss')) return false;
  return true;
}

/**
 * Close a modal by ID
 * @param {string} id - Modal element ID
 */
export function closeModal(id) {
  if (id === 'note-modal' && typeof window._onNoteModalClosing === 'function') {
    try {
      window._onNoteModalClosing();
    } catch (_) {
      /* noop */
    }
  }
  const modal = document.getElementById(id);
  if (modal) {
    detachModalOverlayDismiss(modal);
    if (MODAL_FOCUS_TRAP_IDS.has(id)) teardownModalFocusTrap(modal);
    modal.classList.remove('open');
  }
  if (id === 'project-modal' && modal) {
    modal.classList.remove('project-modal--create-step-1', 'project-modal--create-step-2', 'project-modal--edit');
  }
  if (id === 'note-modal' && typeof window._onNoteModalClose === 'function') {
    try {
      window._onNoteModalClose();
    } catch (_) {
      /* noop */
    }
  }
  if (id === 'comments-thread-modal' && typeof window._onCommentsThreadModalClose === 'function') {
    try {
      window._onCommentsThreadModalClose();
    } catch (_) { /* noop */ }
  }
}

/**
 * Open a modal by ID
 * @param {string} id - Modal element ID
 */
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  detachModalOverlayDismiss(modal);

  // CRÍTICO: Sincronizar tema antes de mostrar modal
  const root = document.documentElement;
  const themeClass = Array.from(root.classList).find(c => c.startsWith('tema-'));
  if (!themeClass) {
    // Si no hay tema, aplicar tema claro por defecto
    root.classList.add('tema-claro');
  }
  modal.classList.add('open');

  if (MODAL_FOCUS_TRAP_IDS.has(id)) setupModalFocusTrap(id, modal);

  if (!shouldAttachOverlayDismiss(id, modal)) return;

  function onOverlayClick(e) {
    if (e.target === modal) {
      closeModal(id);
    }
  }
  modal[kModalOverlayDismiss] = onOverlayClick;
  modal.addEventListener('click', onOverlayClick);
}

// ===== CONFIRMATION MODAL =====

// Estado para la modal de confirmación
let pendingConfirmAction = null;

/**
 * Show confirmation modal with options
 * @param {Object} options - Configuration options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {string} options.messageHtml - Modal message as HTML
 * @param {string} options.icon - Icon emoji
 * @param {string} options.confirmLabel - Confirm button text
 * @param {boolean} options.destructive - Whether this is a destructive action
 * @param {Function} options.onConfirm - Callback function when confirmed
 */
export function showConfirmModal(options) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;

  modal.classList.toggle('confirm-modal--destructive', !!options.destructive);
  const iconEl = document.getElementById('confirm-icon');
  if (iconEl) iconEl.textContent = options.icon != null ? options.icon : '⚠️';
  document.getElementById('confirm-title').textContent = options.title || '¿Estás seguro?';
  const msgEl = document.getElementById('confirm-message');
  if (msgEl) {
    if (options.messageHtml) msgEl.innerHTML = options.messageHtml;
    else {
      msgEl.textContent = options.message || '';
    }
  }
  const btn = document.getElementById('confirm-btn');
  if (btn) btn.textContent = options.confirmLabel || 'Eliminar';
  pendingConfirmAction = options.onConfirm || null;

  modal.classList.remove('hidden');
  modal.classList.add('open');
}

/**
 * Close the confirmation modal
 */
export function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('open');
    modal.classList.remove('confirm-modal--destructive');
  }
  const msgEl = document.getElementById('confirm-message');
  if (msgEl) msgEl.innerHTML = '';
  pendingConfirmAction = null;
}

/**
 * Execute the pending confirmation action
 */
export function executeConfirm() {
  if (pendingConfirmAction && typeof pendingConfirmAction === 'function') {
    pendingConfirmAction();
  }
  closeConfirmModal();
}

// ===== TOAST NOTIFICATIONS =====

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type ('success', 'error', 'info', 'warning')
 * @param {number} duration - Duration in milliseconds
 * @param {{ undoLabel?: string, onUndo?: () => void, retryFn?: () => void, retryLabel?: string }|null} [options]
 */
export function showToast(message, type = 'info', duration = 3000, options = null) {
  const esc = str => {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  };
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const undoFn = options && typeof options.onUndo === 'function' ? options.onUndo : null;
  const undoLabel = (options && options.undoLabel) || 'Deshacer';
  const retryFn = options && typeof options.retryFn === 'function' ? options.retryFn : null;
  const retryLabel = (options && options.retryLabel) || 'Reintentar';
  const hasAction = undoFn || retryFn;
  const effectiveDuration = hasAction ? Math.max(duration, 8000) : duration;

  const existing = document.getElementById('toast-container');
  if (!existing) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${esc(String(message))}</span>
    ${undoFn ? `<button type="button" class="toast-undo">${esc(undoLabel)}</button>` : ''}
    ${retryFn ? `<button type="button" class="toast-retry">${esc(retryLabel)}</button>` : ''}
    <button type="button" class="toast-close" aria-label="Cerrar">✕</button>
  `;

  const undoBtn = toast.querySelector('.toast-undo');
  if (undoBtn && undoFn) {
    undoBtn.addEventListener('click', () => {
      try {
        undoFn();
      } catch (e) {
        console.error(e);
      }
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    });
  }

  const retryBtn = toast.querySelector('.toast-retry');
  if (retryBtn && retryFn) {
    retryBtn.addEventListener('click', () => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
      try {
        retryFn();
      } catch (e) {
        console.error(e);
      }
    });
  }
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    });
  }

  document.getElementById('toast-container').appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, effectiveDuration);
}

/**
 * Get toast icon based on type
 * @param {string} type - Toast type
 * @returns {string} Icon emoji
 */
function getToastIcon(type) {
  switch (type) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info':
    default: return 'ℹ️';
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escape HTML but allow some tags for chat display
 * @param {string} str - String to escape
 * @returns {string} Escaped string with allowed tags
 */
export function escapeChatHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}