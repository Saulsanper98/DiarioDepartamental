// ===== COMMENTS MODULE =====
import { comments, USERS, currentUser, sameId, notes, docs, projects, postitCards, PUBLIC_NOTES_PER_GROUP_INITIAL, currentView, currentProjectId, editingPostitId, currentNoteView, SHIFTS, searchQuery, GROUPS, selectedMentionGroup, selectedMentions, selectedShift, selectedPriority, reminderOn, editingNoteId, editingNoteImages, collectImageMap, makeImageKey, registerTempImage, selectedNoteVisibility, setCurrentNoteView, setSelectedMentions, setComments, setCurrentProjectId, setSelectedMentionGroup } from './data.js';
import { renderMarkdown, handleSlashCommand, userCanSeeNote, userCanEditNote, noteBodyPreview, openNewNoteModal, editNote, renderNotes, renderPublicNotes, fillCollabTargetSelect } from './notes.js';
import { escapeChatHtml } from './modalControl.js';
import { showToast, openModal, closeModal } from './modalControl.js';
import { markMentionAsRead, loadReadMentions, saveReadMentions, updateBadges } from './views.js';
import { getPublicNoteShareContextsHtml } from './export.js';
import { renderPostitBoard } from './postit.js';
import { renderProjects, selectProject } from './projects.js';
import { renderDocsGrid, commentDraftImages } from './docs.js';
import {
  apiGetComments,
  apiCreateComment,
  apiDeleteComment,
} from '../api.js';
// Importar funciones compartidas desde docs.js para evitar duplicación
import { sameMaybeId, commentTargetKey, getCommentReadMap, saveCommentReadMap, getCommentMeta, hasUnreadComments, markCommentsAsRead, commentIndicators, getLatestCommentPreview, refreshCommentIndicators, insertImageIntoCommentTextarea, insertMentionIntoCommentTextarea, normalizeForSearch, getMentionQueryAtCaret, replaceMentionQueryAtCaret } from './docs.js';

// ── Aurora: portal .comment-mention-pop a document.body (evita stacking context del modal) ──
const commentMentionPopPortalRestore = new WeakMap();

function isAuroraTheme() {
  return document.documentElement.classList.contains('tema-aurora');
}

function getMentionAnchorForTextarea(textareaId) {
  const ta = document.getElementById(textareaId);
  if (!ta) return null;
  const next = ta.nextElementSibling;
  const menu = next && next.classList.contains('comment-mention-menu')
    ? next
    : ta.parentElement?.querySelector('.comment-mention-menu');
  return menu?.querySelector('button[title="Mencionar"]') || menu?.querySelector('button') || null;
}

function clearMentionPopPortalStyles(pop) {
  pop.style.position = '';
  pop.style.left = '';
  pop.style.top = '';
  pop.style.right = '';
  pop.style.bottom = '';
  pop.style.zIndex = '';
  pop.style.isolation = '';
  pop.style.maxHeight = '';
  pop.style.margin = '';
}

function detachMentionPopOutsideClose(pop) {
  if (!pop) return;
  if (pop._mentionPopOutsideTimeout != null) {
    clearTimeout(pop._mentionPopOutsideTimeout);
    pop._mentionPopOutsideTimeout = null;
  }
  if (typeof pop._mentionPopClickOutside === 'function') {
    document.removeEventListener('click', pop._mentionPopClickOutside);
    pop._mentionPopClickOutside = null;
  }
}

/** Aurora: cierra el pop al hacer clic fuera (listener en document). */
function attachMentionPopOutsideClose(pop) {
  if (!isAuroraTheme() || !pop) return;
  detachMentionPopOutsideClose(pop);
  function onClickOutside(e) {
    if (!pop.contains(e.target)) {
      document.removeEventListener('click', onClickOutside);
      pop._mentionPopClickOutside = null;
      if (isAuroraTheme()) {
        restoreCommentMentionPopFromBody(pop);
      }
      pop.classList.add('hidden');
    }
  }
  pop._mentionPopClickOutside = onClickOutside;
  pop._mentionPopOutsideTimeout = setTimeout(() => {
    pop._mentionPopOutsideTimeout = null;
    document.addEventListener('click', onClickOutside);
  }, 0);
}

function portalCommentMentionPopToBody(pop, textareaId) {
  if (!isAuroraTheme() || !pop) return;
  const ta = document.getElementById(textareaId);
  const anchor = getMentionAnchorForTextarea(textareaId);
  const rect = anchor
    ? anchor.getBoundingClientRect()
    : (ta ? ta.getBoundingClientRect() : { left: 16, top: 80, width: 220, bottom: 112, right: 236 });
  if (pop.parentNode !== document.body) {
    if (!commentMentionPopPortalRestore.has(pop)) {
      commentMentionPopPortalRestore.set(pop, { parent: pop.parentNode, nextSibling: pop.nextSibling });
    }
    document.body.appendChild(pop);
  }
  const gap = 4;
  const maxH = 180;
  const w = Math.max(rect.width || 0, 220);
  let left = rect.left;
  let top = (rect.bottom != null ? rect.bottom : rect.top + 32) + gap;
  pop.style.position = 'fixed';
  pop.style.left = `${Math.max(8, Math.min(left, window.innerWidth - w - 8))}px`;
  pop.style.top = `${top}px`;
  pop.style.bottom = 'auto';
  pop.style.right = 'auto';
  pop.style.zIndex = '999999';
  pop.style.isolation = 'isolate';
  pop.style.maxHeight = `${maxH}px`;
  pop.style.margin = '0';
  const ph = pop.getBoundingClientRect().height;
  if (top + ph > window.innerHeight - 8) {
    const above = (rect.top != null ? rect.top : top) - gap - ph;
    if (above >= 8) {
      pop.style.top = `${above}px`;
    } else {
      pop.style.maxHeight = `${Math.max(100, window.innerHeight - top - 8)}px`;
    }
  }
}

function restoreCommentMentionPopFromBody(pop) {
  if (!pop) return;
  detachMentionPopOutsideClose(pop);
  if (pop.parentNode !== document.body) {
    clearMentionPopPortalStyles(pop);
    return;
  }
  const info = commentMentionPopPortalRestore.get(pop);
  if (info && info.parent && document.body.contains(info.parent)) {
    try {
      if (info.nextSibling && info.nextSibling.parentNode === info.parent) {
        info.parent.insertBefore(pop, info.nextSibling);
      } else {
        info.parent.appendChild(pop);
      }
    } catch {
      info.parent.appendChild(pop);
    }
  } else {
    pop.remove();
  }
  commentMentionPopPortalRestore.delete(pop);
  clearMentionPopPortalStyles(pop);
}

function cleanupCommentMentionPortalPops() {
  document.querySelectorAll('body > .comment-mention-pop').forEach(pop => {
    restoreCommentMentionPopFromBody(pop);
    pop.classList.add('hidden');
  });
}

window._onCommentsThreadModalClose = cleanupCommentMentionPortalPops;

function toggleCommentMentionMenu(textareaId) {
  const popId = textareaId + '-mention-pop';
  const pop = document.getElementById(popId);
  if (!pop) return;
  const opening = pop.classList.contains('hidden');
  if (opening) {
    pop.classList.remove('hidden');
    if (isAuroraTheme()) {
      portalCommentMentionPopToBody(pop, textareaId);
      attachMentionPopOutsideClose(pop);
    }
  } else {
    if (isAuroraTheme()) {
      restoreCommentMentionPopFromBody(pop);
    }
    pop.classList.add('hidden');
  }
}

function toggleMentionPick(textareaId, userName, el) {
  if (!window._commentMentionSelected) window._commentMentionSelected = {};
  const key = textareaId;
  if (!window._commentMentionSelected[key]) window._commentMentionSelected[key] = new Set();
  const set = window._commentMentionSelected[key];
  if (set.has(userName)) {
    set.delete(userName);
    el.classList.remove('selected');
  } else {
    set.add(userName);
    el.classList.add('selected');
  }
}

function insertSelectedMentions(textareaId) {
  if (!window._commentMentionSelected || !window._commentMentionSelected[textareaId]) return;
  const set = window._commentMentionSelected[textareaId];
  if (set.size === 0) return;
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const text = Array.from(set).map(n => `@${n}`).join(' ') + ' ';
  const pos = textarea.selectionStart;
  const before = textarea.value.slice(0, pos);
  const after = textarea.value.slice(pos);
  textarea.value = before + text + after;
  textarea.focus();
  const next = before.length + text.length;
  textarea.setSelectionRange(next, next);
  set.clear();
  const pop = document.getElementById(textareaId + '-mention-pop');
  if (pop) {
    if (isAuroraTheme()) restoreCommentMentionPopFromBody(pop);
    pop.classList.add('hidden');
  }
}

function selectMentionAutocomplete(textareaId, userName) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  replaceMentionQueryAtCaret(textarea, userName);
  const auto = document.getElementById(textareaId + '-mention-auto');
  if (auto) {
    if (isAuroraTheme()) restoreCommentMentionPopFromBody(auto);
    auto.classList.add('hidden');
  }
}

function updateCommentMentionAutocomplete(textareaId) {
  const textarea = document.getElementById(textareaId);
  const auto = document.getElementById(textareaId + '-mention-auto');
  if (!textarea || !auto || !currentUser) return;
  const q = getMentionQueryAtCaret(textarea);
  if (!q) {
    if (isAuroraTheme()) restoreCommentMentionPopFromBody(auto);
    auto.classList.add('hidden');
    return;
  }
  const nq = normalizeForSearch(q);
  const users = USERS
    .filter(u => u.group === currentUser.group)
    .filter(u => normalizeForSearch(u.name).includes(nq))
    .slice(0, 8);
  if (!users.length) {
    if (isAuroraTheme()) restoreCommentMentionPopFromBody(auto);
    auto.classList.add('hidden');
    return;
  }
  const wasHidden = auto.classList.contains('hidden');
  auto.innerHTML = users.map(u => `
    <div class="comment-mention-item" data-mention-name="${escapeChatHtml(u.name)}" onclick="selectMentionAutocomplete('${textareaId}', this.getAttribute('data-mention-name'))">
      <div class="comment-mention-avatar" style="background:${u.color}">${u.initials}</div>
      <span>${u.name}</span>
    </div>
  `).join('');
  auto.classList.remove('hidden');
  if (isAuroraTheme()) {
    portalCommentMentionPopToBody(auto, textareaId);
    if (wasHidden) {
      attachMentionPopOutsideClose(auto);
    }
  }
}

function handleCommentInput(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  if (!commentDraftImages[textareaId]) commentDraftImages[textareaId] = {};
  handleSlashCommand(textarea, null, commentDraftImages[textareaId]);
  updateCommentMentionAutocomplete(textareaId);
}

/** Modal centrado único para hilos de comentarios (nota, post-it, proyecto, tarea). */
function openCommentsThreadModal(kind, targetId, extraId, title) {
  const el = document.getElementById('comments-thread-title');
  if (el) el.textContent = title || 'Comentarios';
  renderCommentsPanel(kind, targetId, 'comments-thread-body', extraId);
  openModal('comments-thread-modal');
}

/** Wrappers sin títulos embebidos en HTML (evita roturas por comillas en onclick). */
function openNoteCommentsModal(noteId) {
  const note = notes.find(n => sameId(n.id, noteId));
  if (!note) return;
  openCommentsThreadModal('note', note.id, null, 'Comentarios: ' + note.title);
}
function openDocCommentsModal(docId) {
  const d = docs.find(x => sameId(x.id, docId));
  if (!d) return;
  openCommentsThreadModal('doc', d.id, null, 'Comentarios: ' + d.title);
}
function openProjectCommentsModal(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) return;
  openCommentsThreadModal('project', p.id, null, 'Comentarios: ' + p.name);
}
function openTaskCommentsModal(projectId, taskId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const t = p && p.tasks ? p.tasks.find(x => sameId(x.id, taskId)) : null;
  openCommentsThreadModal('task', projectId, taskId, t ? 'Comentarios: ' + t.name : 'Comentarios');
}

function loadMorePublicNotes(sectionKey) {
  if (!window._publicNotesLimits) window._publicNotesLimits = {};
  const cur = window._publicNotesLimits[sectionKey] != null ? window._publicNotesLimits[sectionKey] : PUBLIC_NOTES_PER_GROUP_INITIAL;
  window._publicNotesLimits[sectionKey] = cur + 10;
  renderPublicNotes();
}

function openPostitCommentsFromModal() {
  if (!editingPostitId) {
    showToast('Guarda la tarjeta para poder añadir comentarios', 'info');
    return;
  }
  const c = postitCards.find(x => x.id === editingPostitId);
  openCommentsThreadModal('postit', editingPostitId, null, c ? 'Comentarios: ' + c.title : 'Comentarios');
}

function renderCommentsPanel(kind, targetId, containerId, extraId = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (typeof window._onCommentsThreadModalClose === 'function') {
    window._onCommentsThreadModalClose();
  }

  // Si el elemento no existe todavía (p.ej. Post-it nuevo sin id), no permitimos comentarios.
  if (targetId == null) {
    container.innerHTML = `
      <div class="comments-panel">
        <div class="comments-empty">Guarda la nota/tarjeta/proyecto antes de añadir comentarios.</div>
      </div>
    `;
    return;
  }

  if (!currentUser) {
    container.innerHTML = `
      <div class="comments-panel">
        <div class="comments-empty">Inicia sesión para ver y añadir comentarios.</div>
      </div>
    `;
    return;
  }

  if (commentDraftImages[containerId + '-input'] == null) {
    // Se inicializa al renderizar el textarea; no forzamos creación aquí
  }

  const relevant = comments
    .filter(c =>
      c.kind === kind &&
      sameId(c.targetId, targetId) &&
      sameMaybeId(c.extraId, extraId)
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const textareaId = containerId + '-input';
  if (!commentDraftImages[textareaId]) commentDraftImages[textareaId] = {};
  if (!window._commentMentionSelected) window._commentMentionSelected = {};
  if (!window._commentMentionSelected[textareaId]) window._commentMentionSelected[textareaId] = new Set();

  const listHtml = relevant.length === 0
    ? '<div class="comments-empty">Sin comentarios todavía.</div>'
    : relevant.map(c => {
      const u = USERS.find(u => sameId(u.id, c.authorId))
        || USERS.find(u => u.msId === c.authorId)
        || (c.authorName
          ? {
              name: c.authorName,
              initials: c.authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
              color: '#888',
            }
          : { initials: '?', color: '#888', name: 'Desconocido' });
      const body = renderMarkdown(c.body || '', c.images || {});
      const ts = new Date(c.createdAt).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      return `
        <div class="comment-item">
          <div class="comment-avatar" style="background:${u.color}">${u.initials}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <strong>${u.name}</strong>
              <span>${ts}</span>
            </div>
            <div class="comment-text">${body}</div>
          </div>
        </div>
      `;
    }).join('');

  const mentionMenuId = textareaId + '-mention-pop';
  const mentionAutoId = textareaId + '-mention-auto';
  const usersMenuHtml = USERS
    .filter(u => u.group === currentUser.group)
    .map(u => `<div class="comment-mention-item" data-mention-name="${escapeChatHtml(u.name)}" onclick="toggleMentionPick('${textareaId}', this.getAttribute('data-mention-name'), this)">
      <div class="comment-mention-avatar" style="background:${u.color}">${u.initials}</div>
      <span>${u.name}</span>
    </div>`).join('');

  container.innerHTML = `
    <div class="comments-panel">
      <div class="comments-header">
        <h4>Comentarios</h4>
        <div class="comments-count">${relevant.length}</div>
      </div>
      <div class="comments-list">
        ${listHtml}
      </div>
      <div class="comments-form">
        <textarea id="${textareaId}" placeholder="Escribe un comentario... (Markdown permitido)" oninput="handleCommentInput('${textareaId}')"></textarea>
        <div class="comment-mention-menu">
          <button class="btn-comment-image" type="button" data-comment-mention-btn title="Mencionar">＠</button>
          <div id="${mentionMenuId}" class="comment-mention-pop hidden">
            ${usersMenuHtml || '<div class="comments-empty" style="padding:8px 10px">Sin usuarios</div>'}
            ${usersMenuHtml ? `<div style="padding:8px 10px;border-top:1px solid var(--border)"><button class="btn-secondary" type="button" onclick="insertSelectedMentions('${textareaId}')">Insertar menciones</button></div>` : ''}
          </div>
          <div id="${mentionAutoId}" class="comment-mention-pop hidden"></div>
        </div>
        <button class="btn-comment-image" type="button" data-comment-image-btn>🖼️</button>
        <button class="btn-primary btn-comment-send" type="button" data-comment-submit data-c-kind="${kind}" data-c-tid="${String(targetId)}" data-c-eid="${extraId == null ? '' : String(extraId)}" data-c-cid="${containerId}">Añadir comentario</button>
      </div>
    </div>
  `;
  const sendBtn = container.querySelector('[data-comment-submit]');
  const mentionBtn = container.querySelector('[data-comment-mention-btn]');
  const imageBtn = container.querySelector('[data-comment-image-btn]');
  if (mentionBtn) {
    mentionBtn.addEventListener('click', () => toggleCommentMentionMenu(textareaId));
  }
  if (imageBtn) {
    imageBtn.addEventListener('click', () => insertImageIntoCommentTextarea(textareaId));
  }
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const rawExtraId = sendBtn.getAttribute('data-c-eid');
      void submitComment(
        sendBtn.getAttribute('data-c-kind'),
        sendBtn.getAttribute('data-c-tid'),
        rawExtraId === '' ? null : rawExtraId,
        sendBtn.getAttribute('data-c-cid')
      );
    });
  }
  markCommentsAsRead(kind, targetId, extraId);
  refreshCommentIndicators();
}

async function submitComment(kind, targetId, extraId, containerId) {
  if (!currentUser) return;
  const textareaId = containerId + '-input';
  const input = document.getElementById(textareaId);
  if (!input) return;

  const body = input.value.trim();
  if (!body) return;

  const draft = commentDraftImages[textareaId] || {};
  const images = collectImageMap(body, draft);

  const normalizedTargetId = Number.isFinite(Number(targetId)) ? Number(targetId) : String(targetId);
  const normalizedExtraId = extraId == null ? null : (Number.isFinite(Number(extraId)) ? Number(extraId) : String(extraId));
  const newComment = {
    id: Date.now(),
    kind,
    targetId: normalizedTargetId,
    extraId: normalizedExtraId,
    authorId: currentUser.id,
    authorName: currentUser.name,
    body,
    images,
    mentions: [],
    department: currentUser.group,
    createdAt: new Date().toISOString(),
  };

  try {
    const saved = await apiCreateComment(newComment);
    newComment.authorId = saved.authorId || newComment.authorId;
    newComment.authorName = saved.authorName || newComment.authorName;
    newComment._id = saved._id;
    newComment.id = saved._id || newComment.id;
  } catch (err) {
    console.error('Error creando comentario:', err);
    showToast('Error al guardar comentario', 'error');
    return;
  }
  comments.push(newComment);

  commentDraftImages[textareaId] = {};
  input.value = '';
  renderCommentsPanel(kind, targetId, containerId, extraId);
  refreshCommentIndicators();
  if (kind === 'postit' && currentView === 'postit') renderPostitBoard();
  if ((kind === 'task' || kind === 'project') && currentView === 'projects' && currentProjectId) {
    selectProject(currentProjectId);
  }
}

// ===== SCATTERED FUNCTIONS =====

// From lines 4674-4684
function reloadCommentsFromStorage() {
  try {
    const raw = localStorage.getItem('diario_comments');
    let next = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(next)) next = [];
    setComments(next);
  } catch {
    setComments([]);
  }
}

function saveComments() {
  // Ya no guarda en localStorage
}

export async function loadCommentsFromAPI() {
  try {
    const data = await apiGetComments(null, null);
    const mapped = data.map(c => ({
      ...c,
      id: c._id || c.id,
      targetId: c.targetId,
      extraId: c.extraId || null,
    }));
    setComments(mapped);
    return mapped;
  } catch (err) {
    console.error('Error cargando comentarios desde API:', err);
    try {
      const local = localStorage.getItem('diario_comments');
      if (local) setComments(JSON.parse(local));
    } catch {}
    return [];
  }
}

function inlinePlain(text, query) {
  let t = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/@([A-Za-záéíóúÁÉÍÓÚñÑ]+ ?[A-Za-záéíóúÁÉÍÓÚñÑ]*)/g,'<span class="mention">@$1</span>');
  if (query) t = t.replace(new RegExp(`(${query})`,'gi'),'<mark class="highlight">$1</mark>');
  return t;
}

function highlight(text) {
  if (!searchQuery) return text;
  return text.replace(new RegExp(`(${searchQuery})`,'gi'),'<mark class="highlight">$1</mark>');
}

function openDetail(id) {
  const note = notes.find(n => sameId(n.id, id));
  if (!note || !userCanSeeNote(note)) return;
  const author = USERS.find(u => sameId(u.id, note.authorId)) || {color:'#888',initials:'?',name:'Desconocido'};
  const shift = SHIFTS[note.shift];
  const mentionedUsers = (note.mentions || []).map(mid => USERS.find(u => sameId(u.id, mid))).filter(Boolean);
  let body = note.body;
  body = renderMarkdown(body, note.images || {});
  document.getElementById('detail-body').innerHTML = `
    <div class="note-detail-scroll">
      <div class="note-detail-meta">
        <div class="mention-chip"><div class="chip-avatar mention-avatar" style="background:${author.color}">${author.initials}</div>${author.name}</div>
        <span class="note-tag note-tag-shift">${shift.emoji} ${shift.label}</span>
        ${note.priority!=='normal'?`<span class="note-tag priority-${note.priority}">${note.priority==='alta'?'🔴 Alta':'Media'}</span>`:''}
        ${note.visibility==='public'?'<span class="note-tag note-tag-public">🌐 Pública</span>':note.visibility==='department'?'<span class="note-tag note-tag-dept">🏢 Departamento</span>':'<span class="note-tag note-tag-private">🔒 Privada</span>'}
        <span class="note-tag note-tag-group" title="Departamento de origen">🏢 Origen: ${note.group || '—'}</span>
        ${note.reminder ? `<span class="note-reminder">⏰ ${typeof note.reminder === 'string' ? escapeChatHtml(note.reminder) : escapeChatHtml(note.reminderTime || 'Recordatorio activo')}</span>` : ''}
      </div>
      <div class="note-detail-title">${note.title}</div>
      <div class="note-detail-content">${body}</div>
      ${mentionedUsers.length?`<div class="note-detail-divider"></div><div class="note-detail-section-label">Compañeros mencionados</div><div class="note-detail-mentions">${mentionedUsers.map(u=>`<div class="mention-chip"><div class="chip-avatar mention-avatar" style="background:${u.color}">${u.initials}</div>${u.name}</div>`).join('')}</div>`:''}
      <div class="note-detail-divider"></div>
      <div class="note-detail-created">Creado el ${new Date(note.createdAt).toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>
    <div class="note-detail-footer">
      <button type="button" class="btn-primary btn-full-width" onclick="event.preventDefault();event.stopPropagation();openNoteCommentsModal('${note.id}')">💬 Abrir comentarios${comments.filter(c=>c.kind==='note'&&sameId(c.targetId,note.id)).length ? ' ('+comments.filter(c=>c.kind==='note'&&sameId(c.targetId,note.id)).length+')' : ''}</button>
    </div>
  `;
  closeModal('detail-modal');
  openModal('detail-modal');

  // Marcar mención como leída si el usuario actual está mencionado
  if ((note.mentions || []).some(mid => sameId(mid, currentUser.id))) {
    markMentionAsRead(note.id);
  }
}

function renderMentionChips() {
  const area = document.getElementById('mentions-area');
  if (!area) return;

  if (selectedMentionGroup === null) {
    // Mostrar grupos
    area.innerHTML = GROUPS.map(group => {
      const groupUserCount = USERS.filter(u => u.group === group && u.id !== currentUser.id).length;
      const countLine =
        groupUserCount === 0
          ? `<div class="group-count group-count--empty">Sin otros usuarios en este equipo para mencionar</div>`
          : `<div class="group-count">${groupUserCount} usuario${groupUserCount !== 1 ? 's' : ''}</div>`;
      return `
        <div class="mention-group-btn" onclick="selectMentionGroup('${group}')">
          <div class="group-name">${group}</div>
          ${countLine}
        </div>
      `;
    }).join('');
  } else {
    // Mostrar usuarios del grupo seleccionado
    const groupUsers = USERS.filter(u => u.group === selectedMentionGroup && u.id !== currentUser.id);
    const backBtn = `<div class="mention-chip back-chip" onclick="backToMentionGroups()">← Volver</div>`;
    const usersHtml = groupUsers.map(u => `
      <div class="mention-chip ${selectedMentions.includes(u.id)?'selected':''}" onclick="toggleMention('${u.id}',this)">
        <div class="chip-avatar" style="background:${u.color}">${u.initials}</div>${u.name}
      </div>`).join('');
    area.innerHTML = backBtn + usersHtml;
  }
}

function selectMentionGroup(groupName) {
  setSelectedMentionGroup(groupName);
  renderMentionChips();
}

function backToMentionGroups() {
  setSelectedMentionGroup(null);
  renderMentionChips();
}

function toggleMention(uid, el) {
  if (selectedMentions.includes(uid)) { 
    setSelectedMentions(selectedMentions.filter(id => id !== uid)); 
    el.classList.remove('selected'); 
  } else {
    setSelectedMentions([...selectedMentions, uid]);
    el.classList.add('selected');
  }
}

function markCommentMentionRead(key, el) {
  const readSet = loadReadMentions();
  readSet.add(key);
  saveReadMentions(readSet);
  el.classList.remove('unread-mention');
  const dot = el.querySelector('.mention-unread-dot');
  if (dot) dot.remove();
  updateBadges();
}

function goToComment(kind, targetId, extraId, commentId) {
  // Navegar al contexto del comentario
  if (kind === 'note') {
    setCurrentNoteView('all');
    renderNotes();
    setTimeout(() => {
      const card = document.querySelector(`[data-note-id="${targetId}"]`);
      if (card) card.click();
      setTimeout(() => {
        const comment = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (comment) comment.scrollIntoView({behavior:'smooth',block:'center'});
      }, 200);
    }, 300);
  } else if (kind === 'project') {
    setCurrentProjectId(targetId);
    renderProjects();
    selectProject(targetId);
    setTimeout(() => {
      const comment = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (comment) comment.scrollIntoView({behavior:'smooth',block:'center'});
    }, 200);
  } else if (kind === 'task') {
    setCurrentProjectId(targetId);
    renderProjects();
    selectProject(targetId);
    setTimeout(() => {
      openTaskCommentsModal(targetId, extraId);
    }, 200);
  }
}

export {
  sameMaybeId,
  commentTargetKey,
  getCommentReadMap,
  saveCommentReadMap,
  getCommentMeta,
  hasUnreadComments,
  markCommentsAsRead,
  commentIndicators,
  getLatestCommentPreview,
  refreshCommentIndicators,
  insertImageIntoCommentTextarea,
  insertMentionIntoCommentTextarea,
  normalizeForSearch,
  getMentionQueryAtCaret,
  replaceMentionQueryAtCaret,
  toggleCommentMentionMenu,
  toggleMentionPick,
  insertSelectedMentions,
  selectMentionAutocomplete,
  updateCommentMentionAutocomplete,
  handleCommentInput,
  openCommentsThreadModal,
  openNoteCommentsModal,
  openDocCommentsModal,
  openProjectCommentsModal,
  openTaskCommentsModal,
  loadMorePublicNotes,
  openPostitCommentsFromModal,
  renderCommentsPanel,
  submitComment,
  reloadCommentsFromStorage,
  saveComments,
  inlinePlain,
  highlight,
  openDetail,
  renderMentionChips,
  selectMentionGroup,
  backToMentionGroups,
  toggleMention,
  markCommentMentionRead,
  goToComment
};