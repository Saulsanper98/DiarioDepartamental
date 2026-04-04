// ===== MODAL CONTROL MODULE =====

// ===== MODAL MANAGEMENT =====

const kModalOverlayDismiss = Symbol.for('st.modalOverlayDismiss');

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
  const modal = document.getElementById(id);
  if (modal) {
    detachModalOverlayDismiss(modal);
    modal.classList.remove('open');
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
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getToastIcon(type)}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, duration);
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