// ===== CHAT MODULE =====

// Import required dependencies
import { currentUser, USERS, sameId, currentView, notes, postitCards, projects, docs } from './data.js';
import { showToast, escapeChatHtml, openModal, closeModal } from './modalControl.js';

// ===== CHAT DATA =====
export let chatMessages = [];
let currentChatThreadId = null;
let closedChatThreads = {};
let chatPendingLinks = [];

function chatLinkIcon(kind) {
  return { note: '📋', postit: '🗂', project: '🎯', doc: '📚', task: '✓' }[kind] || '🔗';
}

// ===== CHAT STORAGE =====

/**
 * Reload chat messages from localStorage
 */
export function reloadChatFromStorage() {
  try {
    const savedChat = localStorage.getItem('diario_chat');
    chatMessages = savedChat ? JSON.parse(savedChat) : [];
    if (!Array.isArray(chatMessages)) chatMessages = [];
  } catch {
    chatMessages = [];
  }
}

/**
 * Save chat messages to localStorage
 */
export function saveChatData() {
  localStorage.setItem('diario_chat', JSON.stringify(chatMessages));
  if (currentUser) updateChatNavBadge();
}

/**
 * Get closed threads key for current user
 * @returns {string|null} Storage key
 */
function getClosedThreadsKey() {
  return currentUser ? `diario_chat_closed_${currentUser.id}` : null;
}

/**
 * Load closed threads for current user
 * @returns {Array} Array of closed thread IDs
 */
export function loadClosedThreads() {
  const key = getClosedThreadsKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save closed threads for current user
 * @param {Array} threads - Array of closed thread IDs
 */
function saveClosedThreads(threads) {
  const key = getClosedThreadsKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(threads));
}

/**
 * Tras iniciar sesión: cargar hilos cerrados y reiniciar hilo activo / enlaces pendientes.
 */
export function initChatSessionAfterLogin() {
  if (!currentUser) return;
  closedChatThreads[currentUser.id] = loadClosedThreads();
  currentChatThreadId = null;
  chatPendingLinks = [];
}

// ===== CHAT UTILITIES =====

/**
 * Get group chat thread ID
 * @returns {string} Group thread ID
 */
export function chatGroupThreadId() {
  return 'grp:' + currentUser.group;
}

/**
 * Get DM thread ID for peer
 * @param {number} peerId - Peer user ID
 * @returns {string} DM thread ID
 */
export function chatDmThreadId(peerId) {
  const a = currentUser.id, b = peerId;
  return 'dm:' + Math.min(a, b) + ':' + Math.max(a, b);
}

/**
 * Check if user can access thread
 * @param {string} threadId - Thread ID
 * @returns {boolean} True if can access
 */
export function chatCanAccessThread(threadId) {
  if (threadId.startsWith('grp:')) return threadId === chatGroupThreadId();
  const m = /^dm:(\d+):(\d+)$/.exec(threadId);
  if (!m) return false;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  return sameUserId(currentUser.id, a) || sameUserId(currentUser.id, b);
}

/**
 * Check if two user IDs are the same (handles string/number conversion)
 * @param {*} a - First ID
 * @param {*} b - Second ID
 * @returns {boolean} True if same
 */
function sameUserId(a, b) {
  return Number(a) === Number(b);
}

/**
 * Check if chat message is visible in current thread
 * @param {Object} m - Chat message
 * @returns {boolean} True if visible
 */
function chatMessageVisibleInThread(m) {
  if (!currentUser) return false;
  if (!chatCanAccessThread(m.threadId)) return false;
  if (m.threadId.startsWith('grp:')) {
    const author = USERS.find(u => sameUserId(u.id, m.authorId));
    return !!(author && author.group === currentUser.group);
  }
  return true;
}

// ===== CHAT READ STATUS =====

/**
 * Get chat read map for current user
 * @returns {Object} Read timestamps by thread
 */
function getChatReadMap() {
  if (!currentUser) return {};
  const key = 'diario_chat_read_' + currentUser.id;
  const raw = localStorage.getItem(key);
  if (!raw) {
    const map = {};
    chatMessages.forEach(m => {
      if (!chatMessageVisibleInThread(m)) return;
      const t = new Date(m.createdAt).getTime();
      if (!Number.isFinite(t)) return;
      const tid = m.threadId;
      if (!map[tid] || t > map[tid]) map[tid] = t;
    });
    localStorage.setItem(key, JSON.stringify(map));
    return map;
  }
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

/**
 * Save chat read map
 * @param {Object} map - Read timestamps by thread
 */
function saveChatReadMap(map) {
  if (!currentUser) return;
  localStorage.setItem('diario_chat_read_' + currentUser.id, JSON.stringify(map));
}

/**
 * Get latest visible chat time for thread
 * @param {string} threadId - Thread ID
 * @returns {number} Latest timestamp
 */
function latestVisibleChatTime(threadId) {
  let maxT = 0;
  chatMessages.forEach(m => {
    if (m.threadId !== threadId || !chatMessageVisibleInThread(m)) return;
    const t = new Date(m.createdAt).getTime();
    if (!Number.isFinite(t)) return;
    if (t > maxT) maxT = t;
  });
  return maxT;
}

/**
 * Get latest other user's visible chat time for thread
 * @param {string} threadId - Thread ID
 * @returns {number} Latest timestamp from other users
 */
function latestOtherVisibleChatTime(threadId) {
  let maxT = 0;
  chatMessages.forEach(m => {
    if (m.threadId !== threadId || !chatMessageVisibleInThread(m)) return;
    if (sameUserId(m.authorId, currentUser.id)) return;
    const t = new Date(m.createdAt).getTime();
    if (!Number.isFinite(t)) return;
    if (t > maxT) maxT = t;
  });
  return maxT;
}

/**
 * Mark chat thread as read
 * @param {string} threadId - Thread ID
 */
export function markChatThreadRead(threadId) {
  if (!currentUser || !threadId) return;
  const map = { ...getChatReadMap() };
  const maxMsg = latestVisibleChatTime(threadId);
  map[threadId] = Math.max(maxMsg, Date.now());
  saveChatReadMap(map);
  updateChatNavBadge();
}

/**
 * Check if thread has unread messages
 * @param {string} threadId - Thread ID
 * @returns {boolean} True if has unread
 */
function chatThreadHasUnread(threadId) {
  if (!currentUser) return false;
  const map = getChatReadMap();
  const lastRead = map[threadId] || 0;
  return latestOtherVisibleChatTime(threadId) > lastRead;
}

/**
 * Get count of unread chat threads
 * @returns {number} Count of unread threads
 */
function getUnreadChatThreadCount() {
  if (!currentUser) return 0;
  const seen = new Set();
  chatMessages.forEach(m => {
    if (!chatMessageVisibleInThread(m)) return;
    seen.add(m.threadId);
  });
  let n = 0;
  seen.forEach(tid => { if (chatThreadHasUnread(tid)) n++; });
  return n;
}

/**
 * Update chat navigation badge
 */
export function updateChatNavBadge() {
  const el = document.getElementById('chat-nav-badge');
  if (!el || !currentUser) return;
  if (currentView === 'chat') {
    el.classList.add('hidden');
    return;
  }
  const count = getUnreadChatThreadCount();
  if (count > 0) {
    el.textContent = count > 99 ? '99+' : String(count);
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ===== CHAT RENDERING =====

/**
 * Render chat interface
 */
export function renderChat() {
  if (!currentUser) return;
  if (!currentChatThreadId || !chatCanAccessThread(currentChatThreadId)) currentChatThreadId = chatGroupThreadId();
  renderChatThreads();
  const closeBtn = document.getElementById('chat-close-opened-btn');
  if (closeBtn) closeBtn.classList.toggle('hidden', !currentChatThreadId || currentChatThreadId.startsWith('grp:'));
  renderChatMessages();
  renderChatPendingLinks();
  updateChatNavBadge();
}

/**
 * Render chat thread buttons
 */
export function renderChatThreads() {
  const el = document.getElementById('chat-thread-buttons');
  if (!el) return;
  const gid = chatGroupThreadId();

  // Identify open DM chats (intervals with messages), plus current thread if manually opened
  const openThreads = new Map();
  chatMessages.forEach(m => {
    if (!chatCanAccessThread(m.threadId)) return;
    const t = openThreads.get(m.threadId) || { threadId: m.threadId, lastAt: 0 };
    const stamp = new Date(m.createdAt).getTime();
    if (stamp > t.lastAt) t.lastAt = stamp;
    openThreads.set(m.threadId, t);
  });
  if (currentChatThreadId && currentChatThreadId !== gid && !openThreads.has(currentChatThreadId)) {
    openThreads.set(currentChatThreadId, { threadId: currentChatThreadId, lastAt: Date.now() });
  }

  let html = `<button type="button" class="chat-thread-item ${currentChatThreadId === gid ? 'active' : ''}" onclick='selectChatThread(${JSON.stringify(gid)})' title="Canal de grupo">
    <span class="chat-thread-icon">#</span>
    <span class="chat-thread-name">Canal ${escapeChatHtml(currentUser.group)} <span style="font-size:9px;color:var(--text-muted);font-weight:400">(solo tu equipo)</span></span>
    ${chatThreadHasUnread(gid) ? '<span class="chat-thread-unread" aria-label="Mensajes sin leer"></span>' : ''}
  </button>`;

  const hidden = new Set(closedChatThreads[currentUser.id] || []);
  const threads = Array.from(openThreads.values()).filter(t => t.threadId !== gid && !hidden.has(t.threadId))
    .sort((a, b) => b.lastAt - a.lastAt);

  threads.forEach(t => {
    const m = /^dm:(\d+):(\d+)$/.exec(t.threadId);
    if (!m) return;
    const peerId = parseInt(m[1], 10) === currentUser.id ? parseInt(m[2], 10) : parseInt(m[1], 10);
    const user = USERS.find(u => u.id === peerId);
    if (!user) return;
    html += `<button type="button" class="chat-thread-item ${t.threadId === currentChatThreadId ? 'active' : ''}" onclick='selectChatThread(${JSON.stringify(t.threadId)})' title="Chat privado">
      <span class="chat-thread-icon">${escapeChatHtml(user.initials)}</span>
      <span class="chat-thread-name">${escapeChatHtml(user.name)}</span>
      ${chatThreadHasUnread(t.threadId) ? '<span class="chat-thread-unread" aria-label="Mensajes sin leer"></span>' : ''}
      <button type="button" class="chat-thread-close" onclick='closeChatThread(event, ${JSON.stringify(t.threadId)})' title="Cerrar chat" aria-label="Cerrar chat">×</button>
    </button>`;
  });

  el.innerHTML = html;
}

/**
 * Close chat thread
 * @param {Event} e - Click event
 * @param {string} threadId - Thread ID to close
 */
export function closeChatThread(e, threadId) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (!currentUser) return;
  closedChatThreads[currentUser.id] = closedChatThreads[currentUser.id] || [];
  if (!closedChatThreads[currentUser.id].includes(threadId)) {
    closedChatThreads[currentUser.id].push(threadId);
  }
  saveClosedThreads(closedChatThreads[currentUser.id]);
  if (currentChatThreadId === threadId) {
    currentChatThreadId = chatGroupThreadId();
  }
  renderChat();
}

/**
 * Close current chat thread
 */
export function closeCurrentChatThread() {
  if (!currentChatThreadId || currentChatThreadId.startsWith('grp:')) return;
  closeChatThread({ stopPropagation: () => {} }, currentChatThreadId);
}

// ===== PLACEHOLDER FUNCTIONS =====
// These will be implemented with more chat functionality

function renderChatMessages() {
  const area = document.getElementById('chat-messages');
  if (!area || !currentChatThreadId) return;
  const list = chatMessages
    .filter(m => {
      if (m.threadId !== currentChatThreadId) return false;
      if (m.threadId.startsWith('grp:')) {
        const author = USERS.find(u => sameUserId(u.id, m.authorId));
        return !!(author && author.group === currentUser.group);
      }
      return true;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (list.length === 0) {
    area.innerHTML = '<div class="chat-empty-hint">No hay mensajes aún. Escribe abajo o enlaza una nota, tarea o documento.</div>';
    markChatThreadRead(currentChatThreadId);
    if (currentView === 'chat') renderChatThreads();
    return;
  }
  area.innerHTML = list.map(m => {
    const author = USERS.find(u => sameUserId(u.id, m.authorId)) || { initials: '?', color: '#888', name: '?' };
    const mine = sameUserId(m.authorId, currentUser.id);
    const time = new Date(m.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const links = (m.links || []).map(l =>
      `<span class="chat-link-chip">${chatLinkIcon(l.kind)} ${escapeChatHtml(l.label || '')}</span>`
    ).join('');
    return `<div class="chat-msg ${mine ? 'mine' : ''}">
      <div class="chat-msg-av" style="background:${author.color}">${author.initials}</div>
      <div class="chat-msg-bubble">
        <div class="chat-msg-meta"><span style="font-weight:600;color:var(--text)">${escapeChatHtml(author.name)}</span><span>${time}</span></div>
        ${m.text ? `<div class="chat-msg-text">${escapeChatHtml(m.text)}</div>` : ''}
        ${links ? `<div class="chat-msg-links">${links}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  area.scrollTop = area.scrollHeight;
  markChatThreadRead(currentChatThreadId);
  if (currentView === 'chat') renderChatThreads();
}

function renderChatPendingLinks() {
  const el = document.getElementById('chat-pending-links');
  if (!el) return;
  el.innerHTML = chatPendingLinks.map((l, i) =>
    `<span class="chat-pending-chip">${chatLinkIcon(l.kind)} ${escapeChatHtml(l.label || '')}<button type="button" onclick="removeChatPendingLink(${i})" aria-label="Quitar">✕</button></span>`
  ).join('');
}

export function selectChatThread(threadId) {
  if (!chatCanAccessThread(threadId)) return;
  currentChatThreadId = threadId;
  renderChat();
}

export function removeChatPendingLink(i) {
  chatPendingLinks.splice(i, 1);
  renderChatPendingLinks();
}

export function openNewChatModal() {
  if (!currentUser) return;
  const searchEl = document.getElementById('new-chat-search');
  if (searchEl) searchEl.value = '';
  renderNewChatUsersList('');
  openModal('new-chat-modal');
  setTimeout(() => { if (searchEl) searchEl.focus(); }, 80);
}

function renderNewChatUsersList(query) {
  const listEl = document.getElementById('new-chat-users-list');
  if (!listEl) return;
  const q = (query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let users = USERS.filter(u => u.id !== currentUser.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (q) {
    users = users.filter(u => {
      const n = u.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const g = u.group.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n.includes(q) || g.includes(q);
    });
  }
  if (users.length === 0) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 4px">No se encontraron usuarios.</div>';
    return;
  }
  listEl.innerHTML = users.map(u => {
    const threadId = chatDmThreadId(u.id);
    const hasUnread = chatThreadHasUnread(threadId);
    return `<button type="button" class="chat-thread-item" style="padding:10px 12px;border-radius:var(--radius-sm);" onclick="startNewChatWith(${u.id})">
      <span class="chat-thread-avatar" style="background:${u.color}">${u.initials}</span>
      <span class="chat-thread-name">${escapeChatHtml(u.name)} <span style="font-size:9px;color:var(--text-muted);font-weight:400;">(${escapeChatHtml(u.group)})</span></span>
      ${hasUnread ? '<span class="chat-thread-unread" aria-label="Mensajes sin leer"></span>' : ''}
    </button>`;
  }).join('');
}

export function filterNewChatUsers(query) {
  renderNewChatUsersList(query);
}

export function startNewChatWith(userId) {
  const other = USERS.find(u => u.id === userId);
  if (!other || !currentUser) return;
  const threadId = chatDmThreadId(userId);
  const arr = (closedChatThreads[currentUser.id] || []).filter(t => t !== threadId);
  closedChatThreads[currentUser.id] = arr;
  saveClosedThreads(arr);
  currentChatThreadId = threadId;
  closeModal('new-chat-modal');
  renderChat();
}

export function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !currentChatThreadId) return;
  const text = input.value.trim();
  if (!text && chatPendingLinks.length === 0) return;
  if (!chatCanAccessThread(currentChatThreadId)) return;
  if (currentChatThreadId.startsWith('grp:') && currentChatThreadId !== chatGroupThreadId()) return;
  const msg = {
    id: Date.now(),
    threadId: currentChatThreadId,
    group: currentChatThreadId.startsWith('dm:') ? null : currentUser.group,
    authorId: currentUser.id,
    text,
    links: chatPendingLinks.map(l => ({ ...l })),
    createdAt: new Date().toISOString()
  };
  chatMessages.push(msg);
  input.value = '';
  chatPendingLinks = [];
  renderChatPendingLinks();
  saveChatData();
  renderChatMessages();
}

export function openChatLinkPicker() {
  const sel = document.getElementById('chat-link-kind');
  if (sel) sel.value = 'note';
  buildChatLinkTargetList();
  openModal('chat-link-modal');
}

export function buildChatLinkTargetList() {
  const kind = document.getElementById('chat-link-kind')?.value || 'note';
  const el = document.getElementById('chat-link-target-list');
  if (!el || !currentUser) return;
  const g = currentUser.group;
  if (kind === 'note') {
    const list = notes.filter(n => n.group === g).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 80);
    if (!list.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No hay notas en tu departamento.</p>'; return; }
    el.innerHTML = `<label class="form-label">Nota</label><select class="form-select" id="chat-pick-note">${list.map(n => `<option value="${n.id}">${escapeChatHtml(n.title)} (${escapeChatHtml(n.date)})</option>`).join('')}</select>`;
    return;
  }
  if (kind === 'postit') {
    const list = postitCards.filter(c => c.group === g).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 80);
    if (!list.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No hay post-its.</p>'; return; }
    el.innerHTML = `<label class="form-label">Tarjeta</label><select class="form-select" id="chat-pick-postit">${list.map(c => `<option value="${c.id}">${escapeChatHtml(c.title)}</option>`).join('')}</select>`;
    return;
  }
  if (kind === 'project') {
    const list = projects.filter(p => p.group === g);
    if (!list.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No hay proyectos.</p>'; return; }
    el.innerHTML = `<label class="form-label">Proyecto</label><select class="form-select" id="chat-pick-project">${list.map(p => `<option value="${p.id}">${escapeChatHtml(p.name)}</option>`).join('')}</select>`;
    return;
  }
  if (kind === 'doc') {
    const list = docs.filter(d => d.group === g).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 80);
    if (!list.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No hay documentos.</p>'; return; }
    el.innerHTML = `<label class="form-label">Documento</label><select class="form-select" id="chat-pick-doc">${list.map(d => `<option value="${d.id}">${escapeChatHtml(d.title)}</option>`).join('')}</select>`;
    return;
  }
  if (kind === 'task') {
    const plist = projects.filter(p => p.group === g);
    if (!plist.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No hay proyectos con tareas.</p>'; return; }
    el.innerHTML = `<label class="form-label">Proyecto</label><select class="form-select" id="chat-pick-task-project" onchange="buildChatTaskOptions()">${plist.map(p => `<option value="${p.id}">${escapeChatHtml(p.name)}</option>`).join('')}</select><label class="form-label" style="margin-top:10px">Tarea</label><select class="form-select" id="chat-pick-task"></select>`;
    buildChatTaskOptions();
  }
}

export function buildChatTaskOptions() {
  const selP = document.getElementById('chat-pick-task-project');
  const selT = document.getElementById('chat-pick-task');
  if (!selP || !selT) return;
  const p = projects.find(pr => pr.id === parseInt(selP.value, 10));
  if (!p || !p.tasks) { selT.innerHTML = ''; return; }
  selT.innerHTML = p.tasks.map(t => `<option value="${t.id}">${escapeChatHtml(t.name)}</option>`).join('');
}

export function confirmChatLinkPick() {
  const kind = document.getElementById('chat-link-kind')?.value;
  let link = { kind, id: null, projectId: null, label: '' };
  if (kind === 'note') {
    const id = parseInt(document.getElementById('chat-pick-note')?.value, 10);
    const n = notes.find(x => x.id === id);
    if (!n) { showToast('Selecciona una nota', 'error'); return; }
    link.id = id; link.label = n.title;
  } else if (kind === 'postit') {
    const id = parseInt(document.getElementById('chat-pick-postit')?.value, 10);
    const c = postitCards.find(x => x.id === id);
    if (!c) { showToast('Selecciona una tarjeta', 'error'); return; }
    link.id = id; link.label = c.title;
  } else if (kind === 'project') {
    const id = parseInt(document.getElementById('chat-pick-project')?.value, 10);
    const p = projects.find(x => x.id === id);
    if (!p) { showToast('Selecciona un proyecto', 'error'); return; }
    link.id = id; link.label = p.name;
  } else if (kind === 'doc') {
    const id = parseInt(document.getElementById('chat-pick-doc')?.value, 10);
    const d = docs.find(x => x.id === id);
    if (!d) { showToast('Selecciona un documento', 'error'); return; }
    link.id = id; link.label = d.title;
  } else if (kind === 'task') {
    const pid = parseInt(document.getElementById('chat-pick-task-project')?.value, 10);
    const tid = parseInt(document.getElementById('chat-pick-task')?.value, 10);
    const p = projects.find(x => x.id === pid);
    const t = p && p.tasks && p.tasks.find(x => x.id === tid);
    if (!t) { showToast('Selecciona una tarea', 'error'); return; }
    link.id = tid; link.projectId = pid; link.label = p.name + ' · ' + t.name;
  }
  if (chatPendingLinks.length >= 8) { showToast('Máximo 8 enlaces por mensaje', 'error'); return; }
  chatPendingLinks.push(link);
  renderChatPendingLinks();
  closeModal('chat-link-modal');
  showToast('Enlace añadido', 'success');
}