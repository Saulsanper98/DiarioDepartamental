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
// Importar funciones compartidas desde docs.js para evitar duplicación
import { sameMaybeId, commentTargetKey, getCommentReadMap, saveCommentReadMap, getCommentMeta, hasUnreadComments, markCommentsAsRead, commentIndicators, getLatestCommentPreview, refreshCommentIndicators, insertImageIntoCommentTextarea, insertMentionIntoCommentTextarea, normalizeForSearch, getMentionQueryAtCaret, replaceMentionQueryAtCaret } from './docs.js';

function toggleCommentMentionMenu(textareaId) {
  const pop = document.getElementById(textareaId + '-mention-pop');
  if (!pop) return;
  pop.classList.toggle('hidden');
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
  if (pop) pop.classList.add('hidden');
}

function selectMentionAutocomplete(textareaId, userName) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  replaceMentionQueryAtCaret(textarea, userName);
  const auto = document.getElementById(textareaId + '-mention-auto');
  if (auto) auto.classList.add('hidden');
}

function updateCommentMentionAutocomplete(textareaId) {
  const textarea = document.getElementById(textareaId);
  const auto = document.getElementById(textareaId + '-mention-auto');
  if (!textarea || !auto || !currentUser) return;
  const q = getMentionQueryAtCaret(textarea);
  if (!q) { auto.classList.add('hidden'); return; }
  const nq = normalizeForSearch(q);
  const users = USERS
    .filter(u => u.group === currentUser.group)
    .filter(u => normalizeForSearch(u.name).includes(nq))
    .slice(0, 8);
  if (!users.length) { auto.classList.add('hidden'); return; }
  auto.innerHTML = users.map(u => `
    <div class="comment-mention-item" data-mention-name="${escapeChatHtml(u.name)}" onclick="selectMentionAutocomplete('${textareaId}', this.getAttribute('data-mention-name'))">
      <div class="comment-mention-avatar" style="background:${u.color}">${u.initials}</div>
      <span>${u.name}</span>
    </div>
  `).join('');
  auto.classList.remove('hidden');
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
      const u = USERS.find(u => sameId(u.id, c.authorId)) || { initials:'?', color:'#888', name:'Desconocido' };
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
          <button class="btn-comment-image" type="button" onclick="toggleCommentMentionMenu('${textareaId}')" title="Mencionar">＠</button>
          <div id="${mentionMenuId}" class="comment-mention-pop hidden">
            ${usersMenuHtml || '<div class="comments-empty" style="padding:8px 10px">Sin usuarios</div>'}
            ${usersMenuHtml ? `<div style="padding:8px 10px;border-top:1px solid var(--border)"><button class="btn-secondary" type="button" onclick="insertSelectedMentions('${textareaId}')">Insertar menciones</button></div>` : ''}
          </div>
          <div id="${mentionAutoId}" class="comment-mention-pop hidden"></div>
        </div>
        <button class="btn-comment-image" type="button" onclick="insertImageIntoCommentTextarea('${textareaId}')">🖼️</button>
        <button class="btn-primary btn-comment-send" type="button" data-comment-submit data-c-kind="${kind}" data-c-tid="${String(targetId)}" data-c-eid="${extraId == null ? '' : String(extraId)}" data-c-cid="${containerId}">Añadir comentario</button>
      </div>
    </div>
  `;
  const sendBtn = container.querySelector('[data-comment-submit]');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const rawExtraId = sendBtn.getAttribute('data-c-eid');
      submitComment(
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

function submitComment(kind, targetId, extraId, containerId) {
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
  comments.push({
    id: Date.now(),
    kind,
    targetId: normalizedTargetId,
    extraId: normalizedExtraId,
    authorId: currentUser.id,
    body,
    images,
    createdAt: new Date().toISOString(),
  });
  saveComments();

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
  localStorage.setItem('diario_comments', JSON.stringify(comments));
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
  const note = notes.find(n => n.id === id);
  if (!note || !userCanSeeNote(note)) return;
  const author = USERS.find(u => u.id === note.authorId) || {color:'#888',initials:'?',name:'Desconocido'};
  const shift = SHIFTS[note.shift];
  const mentionedUsers = note.mentions.map(mid => USERS.find(u => sameId(u.id, mid))).filter(Boolean);
  let body = note.body;
  body = renderMarkdown(body, note.images || {});
  document.getElementById('detail-body').innerHTML = `
    <div class="note-detail-scroll">
      <div class="note-detail-meta">
        <div class="mention-chip"><div class="chip-avatar mention-avatar" style="background:${author.color}">${author.initials}</div>${author.name}</div>
        <span class="note-tag note-tag-shift">${shift.emoji} ${shift.label}</span>
        ${note.priority!=='normal'?`<span class="note-tag priority-${note.priority}">${note.priority==='alta'?'🔴 Alta':'Media'}</span>`:''}
        ${note.visibility==='public'?'<span class="note-tag note-tag-public">🌐 Pública</span>':'<span class="note-tag note-tag-private">🔒 Privada</span>'}
        <span class="note-tag note-tag-group" title="Departamento de origen">🏢 Origen: ${note.group || '—'}</span>
        ${note.reminder?`<span class="note-reminder">⏰ ${note.reminderTime}</span>`:''}
      </div>
      <div class="note-detail-title">${note.title}</div>
      <div class="note-detail-content">${body}</div>
      ${mentionedUsers.length?`<div class="note-detail-divider"></div><div class="note-detail-section-label">Compañeros mencionados</div><div class="note-detail-mentions">${mentionedUsers.map(u=>`<div class="mention-chip"><div class="chip-avatar mention-avatar" style="background:${u.color}">${u.initials}</div>${u.name}</div>`).join('')}</div>`:''}
      <div class="note-detail-divider"></div>
      <div class="note-detail-created">Creado el ${new Date(note.createdAt).toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>
    <div class="note-detail-footer">
      <button type="button" class="btn-primary btn-full-width" onclick="event.preventDefault();event.stopPropagation();openNoteCommentsModal(${note.id})">💬 Abrir comentarios${comments.filter(c=>c.kind==='note'&&sameId(c.targetId,note.id)).length ? ' ('+comments.filter(c=>c.kind==='note'&&sameId(c.targetId,note.id)).length+')' : ''}</button>
    </div>
  `;
  closeModal('detail-modal');
  openModal('detail-modal');

  // Marcar mención como leída si el usuario actual está mencionado
  if (note.mentions && note.mentions.includes(currentUser.id)) {
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
      return `
        <div class="mention-group-btn" onclick="selectMentionGroup('${group}')">
          <div class="group-name">${group}</div>
          <div class="group-count">${groupUserCount} usuario${groupUserCount!==1?'s':''}</div>
        </div>
      `;
    }).join('');
  } else {
    // Mostrar usuarios del grupo seleccionado
    const groupUsers = USERS.filter(u => u.group === selectedMentionGroup && u.id !== currentUser.id);
    const backBtn = `<div class="mention-chip back-chip" onclick="backToMentionGroups()">← Volver</div>`;
    const usersHtml = groupUsers.map(u => `
      <div class="mention-chip ${selectedMentions.includes(u.id)?'selected':''}" onclick="toggleMention(${u.id},this)">
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