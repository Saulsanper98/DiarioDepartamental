// ===== NOTES MODULE =====

// Import required dependencies
import { currentUser, notes, currentDate, activeShiftFilters, searchQuery, currentNoteView, SHIFTS, USERS, GROUPS, workGroups, sameId, toDateStr, editingNoteImages, editingPostitImages, editingDocImages, editingProjectImages, editingTaskImages, setNotes, editingNoteId, selectedShift, selectedPriority, selectedMentions, selectedMentionGroup, selectedNoteVisibility, reminderOn, setEditingNoteId, setSelectedShift, setSelectedPriority, setSelectedMentions, setEditingNoteImages, setReminderOn, setSelectedNoteVisibility, makeImageKey, registerTempImage, collectImageMap, setSlashMenuActive, setSlashMenuCurrentTextArea, setSlashMenuCurrentPreview, setSlashMenuCurrentImageMap, slashMenuCurrentTextArea, slashMenuCurrentPreview, slashMenuCurrentImageMap } from './data.js';
import { showToast, openModal, closeModal, showConfirmModal } from './modalControl.js';
import { updateMarkdownPreview } from './docs.js';

// Slash commands configuration
export const SLASH_COMMANDS = [
  {cmd: 'lista', icon: '•', label: 'Lista', desc: 'Insertar lista con viñetas', section: 'General'},
  {cmd: 'check', icon: '✓', label: 'Checklist', desc: 'Insertar checklist', section: 'General'},
  {cmd: 'divisor', icon: '─', label: 'Divisor', desc: 'Insertar línea divisor', section: 'General'},
  {cmd: 'tabla', icon: '▦', label: 'Tabla', desc: 'Insertar tabla (pendiente de portar)', section: 'General'},
  {cmd: 'imagen', icon: '🖼️', label: 'Imagen', desc: 'Insertar imagen (pendiente de portar)', section: 'General'},
  {cmd: 'estilo-parrafo', icon: '¶', label: 'Párrafo (cuerpo)', desc: 'Texto de párrafo normal', section: 'Estilos de texto'},
  {cmd: 'estilo-h1', icon: 'H1', label: 'Encabezado 1', desc: 'Título nivel 1 (#)', section: 'Estilos de texto'},
  {cmd: 'estilo-h2', icon: 'H2', label: 'Encabezado 2', desc: 'Título nivel 2 (##)', section: 'Estilos de texto'},
  {cmd: 'estilo-h3', icon: 'H3', label: 'Encabezado 3', desc: 'Título nivel 3 (###)', section: 'Estilos de texto'},
  {cmd: 'estilo-h4', icon: 'H4', label: 'Título 4', desc: 'Título nivel 4 (####)', section: 'Estilos de texto'},
  {cmd: 'estilo-tc1', icon: '▼H1', label: 'Título contraíble 1', desc: 'Bloque desplegable (estilo H1)', section: 'Estilos de texto'},
  {cmd: 'estilo-tc2', icon: '▼H2', label: 'Título contraíble 2', desc: 'Bloque desplegable (estilo H2)', section: 'Estilos de texto'},
  {cmd: 'estilo-tc3', icon: '▼H3', label: 'Título contraíble 3', desc: 'Bloque desplegable (estilo H3)', section: 'Estilos de texto'},
  {cmd: 'estilo-tc4', icon: '▼H4', label: 'Título contraíble 4', desc: 'Bloque desplegable (estilo H4)', section: 'Estilos de texto'},
  {cmd: 'estilo-cita', icon: '❝', label: 'Cita', desc: 'Bloque de cita (> …)', section: 'Estilos de texto'},
  {cmd: 'estilo-codigo', icon: '⟨/⟩', label: 'Código insertado', desc: 'Bloque de código (``` … ```)', section: 'Estilos de texto'},
];

// ===== NOTES DATA MANAGEMENT =====

/**
 * Save notes data to localStorage
 */
export function saveData() {
  localStorage.setItem('diario_notes', JSON.stringify(notes));
}

function userIsActiveWorkGroupMemberForCollab(wg) {
  if (!wg || !currentUser) return false;
  if (sameId(wg.ownerId, currentUser.id)) return true;
  return (wg.memberUserIds || []).some(mid => sameId(mid, currentUser.id));
}

/** Usado por modal de nota, proyecto y tarea (evita ciclo notes ↔ projects). */
export function fillCollabTargetSelect(selectId) {
  const el = document.getElementById(selectId);
  if (!el || !currentUser) return;
  let opts = '<option value="_none">— Sin destino adicional —</option>';
  opts += '<optgroup label="Departamentos">';
  GROUPS.forEach(g => { opts += `<option value="dept:${g}">${g}</option>`; });
  opts += '</optgroup>';
  const mine = workGroups.filter(wg => userIsActiveWorkGroupMemberForCollab(wg));
  if (mine.length) {
    opts += '<optgroup label="Mis grupos de trabajo">';
    mine.forEach(wg => { opts += `<option value="wg:${wg.id}">${wg.name}</option>`; });
    opts += '</optgroup>';
  }
  el.innerHTML = opts;
}

export function buildSharesFromCollabSelect(targetSelId, permSelId) {
  const ts = document.getElementById(targetSelId);
  const ps = document.getElementById(permSelId);
  if (!ts || !ps) return [];
  const v = ts.value;
  const permission = ps.value || 'read';
  if (!v || v === '_none') return [];
  if (v.startsWith('dept:')) return [{ type: 'dept', deptName: v.slice(5), permission }];
  if (v.startsWith('wg:')) return [{ type: 'workgroup', workGroupId: Number(v.slice(3)), permission }];
  return [];
}

// ===== NOTES VISIBILITY & PERMISSIONS =====

/**
 * Check if user can see a public note
 * @param {Object} note - Note object
 * @returns {boolean} True if user can see the note
 */
export function userSeesPublicNote(note) {
  if (!note || note.visibility !== 'public') return false;
  return userCanSeeNote(note);
}

/**
 * Get note author department
 * @param {Object} n - Note object
 * @returns {string} Department name
 */
export function getNoteAuthorDepartment(n) {
  if (!n || !n.authorId) return '';
  const author = USERS.find(u => sameId(u.id, n.authorId));
  return author ? author.group : '';
}

/**
 * Check if note is from same core department
 * @param {Object} n - Note object
 * @returns {boolean} True if same core department
 */
export function departmentDiarySameCoreDeptNote(n) {
  if (!n || !currentUser) return false;
  const authorDept = getNoteAuthorDepartment(n);
  return authorDept === currentUser.group;
}

/**
 * Check if user can see a note
 * @param {Object} n - Note object
 * @returns {boolean} True if user can see the note
 */
export function userCanSeeNote(n) {
  if (!n || !currentUser) return false;

  // Author can always see their own notes
  if (sameId(n.authorId, currentUser.id)) return true;

  // Public notes: visible to same department or core department notes
  if (n.visibility === 'public') {
    return departmentDiarySameCoreDeptNote(n);
  }

  // Department notes: only same department
  if (n.visibility === 'department') {
    return n.group === currentUser.group;
  }

  // Private notes: only author
  return false;
}

/**
 * Check if user can edit a note
 * @param {Object} n - Note object
 * @returns {boolean} True if user can edit the note
 */
export function userCanEditNote(n) {
  if (!n || !currentUser) return false;
  return sameId(n.authorId, currentUser.id);
}

// ===== NOTES RENDERING =====

/**
 * Render notes for current date and filters
 */
export function renderNotes() {
  // Special view for mentions: separate notes and comments
  if (currentNoteView === 'mentions') {
    renderMentionsView();
    return;
  }

  let filtered = notes.filter(n => {
    if (n.date !== currentDate) return false;
    if (!activeShiftFilters.includes(n.shift)) return false;
    if (n.visibility === 'public' && !sameId(n.authorId, currentUser.id) && !departmentDiarySameCoreDeptNote(n)) return false;
    if (!userCanSeeNote(n)) return false;
    if (currentNoteView === 'mine' && n.authorId !== currentUser.id) return false;
    if (currentNoteView === 'reminders' && !n.reminder) return false;
    if (searchQuery) {
      if (!n.title.toLowerCase().includes(searchQuery) && !n.body.toLowerCase().includes(searchQuery)) return false;
    }
    return true;
  });

  const todayNotes = notes.filter(n =>
    n.date === currentDate &&
    userCanSeeNote(n) &&
    (n.visibility !== 'public' || sameId(n.authorId, currentUser.id) || departmentDiarySameCoreDeptNote(n))
  );

  // Update statistics
  const statTotal = document.getElementById('stat-total');
  if (!statTotal) return;
  statTotal.textContent = todayNotes.length;
  document.getElementById('stat-morning').textContent = todayNotes.filter(n => n.shift === 'morning').length;
  document.getElementById('stat-afternoon').textContent = todayNotes.filter(n => n.shift === 'afternoon').length;
  document.getElementById('stat-night').textContent = todayNotes.filter(n => n.shift === 'night').length;

  const area = document.getElementById('notes-area');
  if (filtered.length === 0) {
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>No hay notas para esta selección</div><div style="font-size:11px;color:var(--text-muted)">Crea una nueva nota para empezar</div></div>`;
    return;
  }

  const byShift = {morning:[],afternoon:[],night:[]};
  filtered.forEach(n => byShift[n.shift].push(n));

  area.innerHTML = Object.keys(SHIFTS).map(shift => {
    const sns = byShift[shift];
    if (!activeShiftFilters.includes(shift) || sns.length === 0) return '';
    const s = SHIFTS[shift];
    return `<div class="shift-section">
      <div class="shift-header" onclick="toggleShiftSection(this)">
        <div class="shift-dot" style="background:${s.dot}"></div>
        <h3 style="color:${s.color}">${s.emoji} Turno ${s.label}</h3>
        <span class="shift-time">${s.hours}</span>
        <span class="shift-count">${sns.length} nota${sns.length!==1?'s':''}</span>
        <span class="shift-toggle open">▶</span>
      </div>
      <div class="shift-notes">${sns.map(n => renderNoteCard(n)).join('')}</div>
    </div>`;
  }).join('');
}

/**
 * Render a note card
 * @param {Object} note - Note object
 * @param {Object} cardOpts - Card options
 * @returns {string} HTML string
 */
export function renderNoteCard(note, cardOpts = {}) {
  const author = USERS.find(u => sameId(u.id, note.authorId));
  const canEdit = userCanEditNote(note);
  const date = new Date(note.createdAt).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'});
  const priorityLabel = {normal:'',media:'Media',alta:'🔴 Alta'}[note.priority || 'normal'];
  const priorityTag = note.priority && note.priority !== 'normal' ? `<span class="note-tag priority-${note.priority}">${priorityLabel}</span>` : '';
  const publicTag = note.visibility === 'public' ? `<span class="note-tag note-tag-public">🌐 Pública</span>` : '';

  let html = `<div class="note-card" data-id="${note.id}" onclick="openDetail(${note.id})">
    <div class="note-card-header">
      <div class="note-author-avatar" style="background:${author?.color || '#888'}">${author?.initials || '?'}</div>
      <div class="note-meta">
        <span class="note-author-name">${author ? author.name : 'Usuario desconocido'}</span>
        <span class="note-timestamp">${date}</span>
      </div>
      <div class="note-tags">${priorityTag}${publicTag}</div>
    </div>
    <div class="note-title">${note.title || 'Sin título'}</div>
    <div class="note-body">${noteBodyPreview(note.body || '', cardOpts.query || '')}</div>
    <div class="note-footer">
      ${note.reminder ? `<span class="note-reminder">⏰ ${note.reminder}</span>` : ''}
      <div class="note-actions">
        ${canEdit ? `<button class="note-action-btn" onclick="editNote(event, ${note.id})">✏️ Editar</button>` : ''}
        ${sameId(note.authorId, currentUser.id) ? `<button class="note-action-btn delete" onclick="deleteNote(event, ${note.id})">🗑 Borrar</button>` : ''}
      </div>
    </div>`;

  if (note.mentions && note.mentions.length > 0) {
    const mentionUsers = note.mentions.map(id => USERS.find(u => u.id === id)).filter(u => u);
    if (mentionUsers.length > 0) {
      html += `<div class="note-mentions">@ ${mentionUsers.map(u => u.name).join(', ')}</div>`;
    }
  }

  if (note.images && note.images.length > 0) {
    html += `<div class="note-images">${note.images.slice(0, 3).map(img =>
      `<img src="${img}" alt="Nota imagen" onclick="openImageModal('${img}')" loading="lazy">`
    ).join('')}${note.images.length > 3 ? `<span class="more-images">+${note.images.length - 3}</span>` : ''}</div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Create a preview of note body with optional highlighting
 * @param {string} body - Note body
 * @param {string} query - Search query for highlighting
 * @returns {string} HTML preview
 */
export function noteBodyPreview(body, query) {
  if (!body) return '<em>Sin contenido</em>';

  let preview = body.length > 200 ? body.substring(0, 200) + '...' : body;
  preview = preview.replace(/\n/g, '<br>');

  if (query) {
    const regex = new RegExp(`(${query})`, 'gi');
    preview = preview.replace(regex, '<mark>$1</mark>');
  }

  return preview;
}

// ===== MENTIONS VIEW =====

/**
 * Render mentions view
 */
export function renderMentionsView() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  area.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><div>Menciones</div><div style="font-size:11px;color:var(--text-muted)">Vista de menciones en desarrollo</div></div>`;
}

/** Handlers del modal de nota (onclick en index.html) */
export function selectShiftOpt(el) {
  document.querySelectorAll('#note-modal .shift-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  setSelectedShift(el.dataset.shift);
}

export function selectPriority(el) {
  document.querySelectorAll('#note-modal .priority-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  setSelectedPriority(el.dataset.priority);
}

export function selectVisibility(el) {
  const p = el.closest('.visibility-pills');
  if (p) p.querySelectorAll('.visibility-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  setSelectedNoteVisibility(el.dataset.vis || 'private');
}

export function toggleReminder() {
  const next = !reminderOn;
  setReminderOn(next);
  document.getElementById('reminder-toggle')?.classList.toggle('on', next);
  document.getElementById('reminder-time')?.classList.toggle('hidden', !next);
}

// ===== PUBLIC NOTES =====

/**
 * Render public notes
 */
export function renderPublicNotes() {
  const area = document.getElementById('public-notes-area');
  if (!area) return;

  // This will be implemented with full public notes functionality
  area.innerHTML = `<div class="empty-state"><div class="empty-icon">🌐</div><div>Notas Públicas</div><div style="font-size:11px;color:var(--text-muted)">Vista de notas públicas en desarrollo</div></div>`;
}

// ===== NOTE EDITING =====

/**
 * Open new note modal
 */
export function openNewNoteModal() {
  setEditingNoteId(null);
  setSelectedShift('morning');
  setSelectedPriority('normal');
  setSelectedMentions([]);
  setSelectedNoteVisibility('private');
  setEditingNoteImages({});
  setReminderOn(false);

  fillCollabTargetSelect('note-collab-target-select');
  const ncts = document.getElementById('note-collab-target-select');
  const ncps = document.getElementById('note-collab-permission-select');
  if (ncts) ncts.value = '_none';
  if (ncps) ncps.value = 'read';

  const mentionsArea = document.getElementById('mentions-area');
  if (mentionsArea) mentionsArea.innerHTML = '';

  openModal('note-modal');
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = 'Nueva Nota';
  const ti = document.getElementById('note-title-input');
  const be = document.getElementById('note-body-editor');
  const bi = document.getElementById('note-body-input');
  if (ti) ti.value = '';
  if (be) be.innerHTML = '';
  if (bi) bi.value = '';
  const preview = document.getElementById('note-content-preview');
  if (preview) preview.innerHTML = '';
  bindNoteEditorInteractions();

  updateNoteModalUI();
}

/**
 * Edit existing note
 * @param {Event} e - Click event
 * @param {number} id - Note ID
 */
export function editNote(e, id) {
  e.stopPropagation();
  const note = notes.find(n => n.id === id);
  if (!note || !userCanEditNote(note)) return;

  // Set editing state
  setEditingNoteId(id);
  setSelectedShift(note.shift);
  setSelectedPriority(note.priority || 'normal');
  setSelectedMentions(note.mentions || []);
  setEditingNoteImages(note.images || []);
  setReminderOn(!!note.reminder);
  setSelectedNoteVisibility(note.visibility === 'public' ? 'public' : 'private');

  fillCollabTargetSelect('note-collab-target-select');
  const tts = document.getElementById('note-collab-target-select');
  const tps = document.getElementById('note-collab-permission-select');
  const firstSh = (note.shares || []).find(s => s.type === 'dept' || s.type === 'workgroup');
  if (tts) {
    tts.value = '_none';
    if (firstSh) {
      if (firstSh.type === 'dept') tts.value = 'dept:' + firstSh.deptName;
      if (firstSh.type === 'workgroup') tts.value = 'wg:' + firstSh.workGroupId;
    }
  }
  if (tps) tps.value = (firstSh && firstSh.permission) ? firstSh.permission : 'read';

  openModal('note-modal');
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = 'Editar Nota';
  const ti = document.getElementById('note-title-input');
  const be = document.getElementById('note-body-editor');
  const bi = document.getElementById('note-body-input');
  if (ti) ti.value = note.title || '';
  if (be) be.innerHTML = note.body && /<[^>]+>/.test(note.body) ? note.body : renderMarkdown(note.body || '', editingNoteImages);
  if (bi) bi.value = note.body || '';
  const preview = document.getElementById('note-content-preview');
  if (preview) preview.innerHTML = renderMarkdown(note.body || '', editingNoteImages);
  const rtime = document.getElementById('reminder-time');
  if (rtime) rtime.value = note.reminderTime || '07:00';
  bindNoteEditorInteractions();

  updateNoteModalUI();
}

/**
 * Save note from modal
 */
export function saveNote() {
  const title = document.getElementById('note-title-input')?.value.trim() || '';
  syncNoteEditorToTextarea('html');
  const body = document.getElementById('note-body-input')?.value.trim() || '';
  if (!title) {
    showToast('El título es requerido', 'error');
    return;
  }
  if (!body) {
    showToast('El contenido es requerido', 'error');
    return;
  }
  if (!selectedShift) {
    showToast('Selecciona un turno destino', 'error');
    return;
  }

  const reminderTime = reminderOn ? (document.getElementById('reminder-time')?.value || null) : null;
  const existingImages = editingNoteId ? notes.find(n => sameId(n.id, editingNoteId))?.images || {} : {};
  const images = collectImageMap(body, { ...existingImages, ...editingNoteImages });
  const vis = selectedNoteVisibility === 'public' ? 'public' : 'private';
  const addSh = buildSharesFromCollabSelect('note-collab-target-select', 'note-collab-permission-select');

  if (editingNoteId) {
    const idx = notes.findIndex(n => sameId(n.id, editingNoteId) && userCanEditNote(n));
    if (idx === -1) {
      showToast('No autorizado para editar esta nota', 'error');
      return;
    }
    const prev = notes[idx];
    const rest = (prev.shares || []).filter(s => s.type !== 'dept' && s.type !== 'workgroup');
    const updated = {
      ...prev,
      title,
      body,
      shift: selectedShift,
      priority: selectedPriority,
      mentions: selectedMentions,
      mentionGroup: selectedMentionGroup,
      reminder: reminderOn,
      reminderTime,
      images,
      visibility: vis,
      shares: [...rest, ...addSh],
    };
    setNotes(notes.map((n, i) => (i === idx ? updated : n)));
    showToast('Nota actualizada', 'success');
  } else {
    setNotes([
      ...notes,
      {
        id: Date.now(),
        authorId: currentUser.id,
        group: currentUser.group,
        date: currentDate,
        shift: selectedShift,
        title,
        body,
        priority: selectedPriority,
        mentions: selectedMentions,
        mentionGroup: selectedMentionGroup,
        reminder: reminderOn,
        reminderTime,
        createdAt: new Date().toISOString(),
        images,
        visibility: vis,
        shares: addSh,
      },
    ]);
    showToast('Nota creada', 'success');
  }

  saveData();
  renderNotes();
  closeModal('note-modal');
  import('./login.js').then(m => m.updateBadges());
}

function syncNoteEditorToTextarea(mode = 'text') {
  const editor = document.getElementById('note-body-editor');
  const textarea = document.getElementById('note-body-input');
  if (!editor || !textarea) return;
  if (mode === 'html') {
    textarea.value = editor.innerHTML;
    const end = textarea.value.length;
    textarea.selectionStart = end;
    textarea.selectionEnd = end;
    return;
  }
  textarea.value = editor.innerText || '';
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    const preCaretRange = document.createRange();
    preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(sel.anchorNode, sel.anchorOffset);
    const pos = preCaretRange.toString().length;
    textarea.selectionStart = pos;
    textarea.selectionEnd = pos;
  } else {
    const end = textarea.value.length;
    textarea.selectionStart = end;
    textarea.selectionEnd = end;
  }
}

function syncNoteTextareaToEditor() {
  const editor = document.getElementById('note-body-editor');
  const textarea = document.getElementById('note-body-input');
  if (!editor || !textarea) return;
  const source = textarea.value || '';
  editor.innerHTML = source && /<[^>]+>/.test(source) ? source : renderMarkdown(source, editingNoteImages);
  cleanupLeadingEmptyNodes(editor);
}

export function handleNoteEditorInput() {
  syncNoteEditorToTextarea();
  updateMarkdownPreview('note-body-input', 'note-content-preview', editingNoteImages);
  handleSlashFromNoteEditor();
  const editor = document.getElementById('note-body-editor');
  scrollNoteEditorCaretIntoView(editor);
}

function bindNoteEditorInteractions() {
  const editor = document.getElementById('note-body-editor');
  if (!editor || editor.dataset.wysiwygBound === '1') return;
  editor.dataset.wysiwygBound = '1';
  editor.addEventListener('mousedown', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (target.closest('input.md-checkbox-input')) ev.preventDefault();
  });
  editor.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    let checkbox = target.closest('input.md-checkbox-input');
    if (!checkbox) {
      const item = target.closest('.md-checklist-item');
      checkbox = item ? item.querySelector('input.md-checkbox-input') : null;
    }
    if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== 'checkbox') return;
    ev.preventDefault();
    ev.stopPropagation();
    checkbox.checked = !checkbox.checked;
    const li = checkbox.closest('.md-checklist-item');
    if (li) li.classList.toggle('checked', checkbox.checked);
    syncNoteEditorToTextarea('html');
    updateMarkdownPreview('note-body-input', 'note-content-preview', editingNoteImages);
  });
}

function cleanupLeadingEmptyNodes(editor) {
  if (!editor) return;
  while (editor.firstChild) {
    const n = editor.firstChild;
    if (n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()) {
      editor.removeChild(n);
      continue;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n;
      const tag = el.tagName;
      const text = (el.textContent || '').trim();
      const isEmptyParagraphLike = (tag === 'P' || tag === 'DIV') && !text && el.querySelectorAll('img,table,input,details,pre,blockquote,ul,ol').length === 0;
      if (tag === 'BR' || isEmptyParagraphLike) {
        editor.removeChild(el);
        continue;
      }
    }
    break;
  }
}

function placeCaretAtEnd(editor) {
  if (!editor) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Mantiene el cursor visible dentro del editor con overflow:auto (escritura al final y bloques altos).
 * Usa la geometría del caret; si no hay rect fiable, hace scroll al fondo del contenido.
 */
function scrollNoteEditorCaretIntoView(editor) {
  if (!editor) return;
  const margin = 20;
  const apply = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) {
      return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    let rect = null;
    const rects = range.getClientRects();
    if (rects.length > 0) {
      rect = rects[rects.length - 1];
    } else {
      const br = range.getBoundingClientRect();
      if (br.width > 0 || br.height > 0) rect = br;
    }
    const er = editor.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      // Sin geometría fiable del caret (p. ej. algunos navegadores): solo si ya estamos escribiendo al final
      const gap = editor.scrollHeight - editor.scrollTop - editor.clientHeight;
      if (gap < 64) editor.scrollTop = editor.scrollHeight;
      return;
    }
    if (rect.bottom > er.bottom - margin) {
      editor.scrollTop += rect.bottom - (er.bottom - margin);
    } else if (rect.top < er.top + margin) {
      editor.scrollTop += rect.top - (er.top + margin);
    }
  };
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

/**
 * Tras insertar bloques (encabezados, details, etc.) el scrollHeight puede crecer un frame después del reflow.
 * Combina scroll al fondo con el ajuste por caret para que siempre se vea el final.
 */
function scrollNoteEditorAfterBlockInsert(editor) {
  if (!editor) return;
  const snap = () => {
    editor.scrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
    scrollNoteEditorCaretIntoView(editor);
  };
  snap();
  requestAnimationFrame(() => {
    snap();
    requestAnimationFrame(() => {
      snap();
      setTimeout(snap, 0);
    });
  });
}

let slashMenuState = {
  query: '',
  lineStart: 0,
  cleanupOnClose: false,
  range: null,
};
let slashOutsideClickHandler = null;
let slashEscHandler = null;

function handleSlashFromNoteEditor() {
  const editor = document.getElementById('note-body-editor');
  const textarea = document.getElementById('note-body-input');
  if (!editor || !textarea) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) {
    closeSlashMenu();
    return;
  }
  // Línea actual solo desde el DOM: tras <h1>, <details>, etc. el índice en textarea.value
  // (innerText vs innerHTML) no coincide siempre con Range#toString() y el menú / dejaba de abrir.
  const preCaretRange = document.createRange();
  preCaretRange.selectNodeContents(editor);
  preCaretRange.setEnd(sel.anchorNode, sel.anchorOffset);
  const textBeforeCaret = preCaretRange.toString();
  const lastNl = textBeforeCaret.lastIndexOf('\n');
  const lineText = textBeforeCaret.slice(lastNl + 1);
  const slashPos = lineText.lastIndexOf('/');
  const prefix = slashPos >= 0 ? lineText.substring(0, slashPos) : '';
  if (slashPos < 0 || prefix.trim().length !== 0) {
    closeSlashMenu();
    return;
  }
  const query = lineText.substring(slashPos + 1).toLowerCase();
  const filtered = query.length === 0
    ? SLASH_COMMANDS
    : SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.cmd.includes(query) ||
      (cmd.desc && cmd.desc.toLowerCase().includes(query)) ||
      (cmd.section && cmd.section.toLowerCase().includes(query))
    );
  if (!filtered.length) {
    closeSlashMenu();
    return;
  }
  const range = sel.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  slashMenuState.query = query;
  slashMenuState.lineStart = lastNl + 1;
  slashMenuState.cleanupOnClose = true;
  slashMenuState.range = range;
  showSlashMenu(textarea, 'note-content-preview', editingNoteImages, filtered, rect);
}

// ===== PLACEHOLDER FUNCTIONS =====
// These will be implemented with more note functionality

export function toggleShiftSection(header) {
  const body = header && header.nextElementSibling;
  if (body) body.classList.toggle('collapsed');
}

export function deleteNote(e, id) {
  e.stopPropagation();
  const note = notes.find(n => n.id === id);
  if (!note || note.authorId !== currentUser.id) {
    showToast('No autorizado para eliminar esta nota','error');
    return;
  }
  showConfirmModal({
    icon: '📋',
    title: '¿Eliminar esta nota?',
    message: `Se eliminará "${note.title}" y todos sus comentarios.`,
    onConfirm: () => {
      setNotes(notes.filter(n => n.id !== id));
      saveData();
      renderNotes();
      import('./login.js').then(m => m.updateBadges());
      showToast('Nota eliminada','info');
    }
  });
}

export function openImageModal(src) {
  if (src) window.open(src, '_blank', 'noopener,noreferrer');
}

function updateNoteModalUI() {
  const shift = selectedShift || 'morning';
  document.querySelectorAll('#note-modal .shift-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.shift === shift);
  });
  const pri = selectedPriority || 'normal';
  document.querySelectorAll('#note-modal .priority-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.priority === pri);
  });
  const vis = selectedNoteVisibility === 'public' ? 'public' : 'private';
  const vp = document.getElementById('note-visibility-pills');
  if (vp) {
    vp.querySelectorAll('.visibility-opt').forEach(o => {
      o.classList.toggle('selected', o.dataset.vis === vis);
    });
  }
  document.getElementById('reminder-toggle')?.classList.toggle('on', reminderOn);
  document.getElementById('reminder-time')?.classList.toggle('hidden', !reminderOn);
}

export function renderMarkdown(md, imageMap = {}) {
  // Procesar línea a línea para manejar bloques correctamente
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── HTML <details> (título contraíble) ─────────────────────────────────
    if (line.trim().toLowerCase().startsWith('<details')) {
      const parts = [];
      while (i < lines.length) {
        parts.push(lines[i]);
        if (lines[i].includes('</details>')) { i++; break; }
        i++;
      }
      out.push(parts.join('\n'));
      continue;
    }

    // ── Bloque de código (``` ... ```) ──────────────────────────────────────
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
        i++;
      }
      out.push(`<pre class="md-codeblock"><code${lang ? ` class="lang-${lang}"` : ''}>${codeLines.join('\n')}</code></pre>`);
      i++; // saltar la línea de cierre ```
      continue;
    }

    // ── Tabla ───────────────────────────────────────────────────────────────
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i+1].trim().match(/^\|[-:\s|]+\|$/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headerCells = tableLines[0].split('|').map(c=>c.trim()).filter(Boolean);
      const rows = tableLines.slice(2).map(l => l.split('|').map(c=>c.trim()).filter(Boolean));
      let table = '<table class="markdown-table"><thead><tr>';
      headerCells.forEach(c => table += `<th>${inlineMarkdown(c, imageMap)}</th>`);
      table += '</tr></thead><tbody>';
      rows.forEach(row => {
        table += '<tr>';
        row.forEach(c => table += `<td>${inlineMarkdown(c, imageMap)}</td>`);
        table += '</tr>';
      });
      table += '</tbody></table>';
      out.push(table);
      continue;
    }

    // ── Bloque cita (> ...) ────────────────────────────────────────────────
    if (line.trim().startsWith('> ') || line.trim() === '>') {
      const quoteLines = [];
      while (i < lines.length && (lines[i].trim().startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote class="md-blockquote">${quoteLines.map(l => inlineMarkdown(l, imageMap)).join('<br>')}</blockquote>`);
      continue;
    }

    // ── Checklist (- [ ] / - [x]) ──────────────────────────────────────────
    if (line.match(/^- \[[ xX]\] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^- \[[ xX]\] /)) {
        const checked = lines[i].match(/^- \[[xX]\] /);
        const text = lines[i].replace(/^- \[[ xX]\] /, '');
        items.push(`<li class="md-checklist-item ${checked ? 'checked' : ''}">
          <input type="checkbox" class="md-checkbox md-checkbox-input" ${checked ? 'checked' : ''}>
          <span class="md-checkbox-label">${inlineMarkdown(text, imageMap)}</span>
        </li>`);
        i++;
      }
      out.push(`<ul class="md-checklist">${items.join('')}</ul>`);
      continue;
    }

    // ── Lista con viñetas (- item) ─────────────────────────────────────────
    if (line.match(/^- .+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^- .+/)) {
        items.push(`<li>${inlineMarkdown(lines[i].slice(2), imageMap)}</li>`);
        i++;
      }
      out.push(`<ul class="md-list">${items.join('')}</ul>`);
      continue;
    }

    // ── Lista numerada ─────────────────────────────────────────────────────
    if (line.match(/^\d+\. .+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. .+/)) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ''), imageMap)}</li>`);
        i++;
      }
      out.push(`<ol class="md-list">${items.join('')}</ol>`);
      continue;
    }

    // ── Encabezados ────────────────────────────────────────────────────────
    if (line.startsWith('#### ')) { out.push(`<h4 class="md-h4">${inlineMarkdown(line.slice(5), imageMap)}</h4>`); i++; continue; }
    if (line.startsWith('### ')) { out.push(`<h3 class="md-h3">${inlineMarkdown(line.slice(4), imageMap)}</h3>`); i++; continue; }
    if (line.startsWith('## '))  { out.push(`<h2 class="md-h2">${inlineMarkdown(line.slice(3), imageMap)}</h2>`); i++; continue; }
    if (line.startsWith('# '))   { out.push(`<h1 class="md-h1">${inlineMarkdown(line.slice(2), imageMap)}</h1>`); i++; continue; }

    // ── Divisor ────────────────────────────────────────────────────────────
    if (line.trim().match(/^---+$/)) { out.push('<hr class="markdown-hr">'); i++; continue; }

    // ── Imagen ─────────────────────────────────────────────────────────────
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const url = imageMap[imgMatch[2]] || imgMatch[2];
      out.push(`<img src="${url}" alt="${imgMatch[1]}" class="md-img">`);
      i++; continue;
    }

    // ── Línea en blanco ────────────────────────────────────────────────────
    if (line.trim() === '') { out.push('<div class="md-spacer"></div>'); i++; continue; }

    // ── Párrafo normal ─────────────────────────────────────────────────────
    // Agrupar líneas consecutivas de párrafo
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !lines[i].startsWith('#') && !lines[i].startsWith('- ') &&
           !lines[i].match(/^\d+\./) && !lines[i].startsWith('>') &&
           !lines[i].startsWith('|') && !lines[i].trim().startsWith('```') &&
           !lines[i].trim().match(/^---+$/)) {
      paraLines.push(inlineMarkdown(lines[i], imageMap));
      i++;
    }
    if (paraLines.length) {
      out.push(`<p class="md-p">${paraLines.join('<br>')}</p>`);
    } else {
      // Línea incompleta (p. ej. "#" o "- " sin texto): sin esto i no avanza y el bucle externo cuelga el navegador
      out.push(`<p class="md-p">${inlineMarkdown(lines[i], imageMap)}</p>`);
      i++;
    }
  }

  return out.join('\n');
}

export function inlineMarkdown(text, imageMap = {}) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const resolved = (imageMap && imageMap[src]) ? imageMap[src] : src;
      return `<img src="${resolved}" alt="${alt}" class="md-img">`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/@([A-Za-záéíóúÁÉÍÓÚñÑ]+ ?[A-Za-záéíóúÁÉÍÓÚñÑ]*)/g, '<span class="mention">@$1</span>');
}

// ===== SLASH COMMAND HANDLING =====
export function handleSlashCommand(textarea, previewId, imageMap) {
  const text = textarea.value;
  const cursorPos = textarea.selectionStart;
  const lastNewline = text.lastIndexOf('\n', cursorPos - 1);
  const lineStart = lastNewline + 1;
  const lineText = text.substring(lineStart, cursorPos);

  if (!lineText.startsWith('/')) {
    closeSlashMenu();
    return;
  }

  const searchText = lineText.substring(1).toLowerCase();
  
  if (searchText.length === 0) {
    showSlashMenu(textarea, previewId, imageMap);
  } else {
    const filtered = SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(searchText) ||
      cmd.cmd.includes(searchText) ||
      (cmd.desc && cmd.desc.toLowerCase().includes(searchText)) ||
      (cmd.section && cmd.section.toLowerCase().includes(searchText))
    );
    if (filtered.length > 0) {
      showSlashMenu(textarea, previewId, imageMap, filtered);
    } else {
      closeSlashMenu();
    }
  }
}

function showSlashMenu(textarea, previewId, imageMap, commands = SLASH_COMMANDS, anchorRect = null) {
  const menu = document.getElementById('slash-menu');
  if (!menu) return;

  setSlashMenuCurrentTextArea(textarea);
  setSlashMenuCurrentPreview(previewId);
  setSlashMenuCurrentImageMap(imageMap);

  const rect = anchorRect || textarea.getBoundingClientRect();
  const baseTop = rect.top + window.scrollY;
  const baseLeft = rect.left + window.scrollX;

  let lastSection = null;
  menu.innerHTML = commands.map((cmd) => {
    const header = cmd.section && cmd.section !== lastSection
      ? `<div class="slash-menu-section">${cmd.section}</div>`
      : '';
    if (cmd.section) lastSection = cmd.section;
    return header + `
    <div class="slash-menu-item" data-slash-cmd="${cmd.cmd}" onclick="executeSlashCommand('${cmd.cmd}')">
      <span class="icon">${cmd.icon}</span>
      <div>
        <span class="label">${cmd.label}</span>
        <span class="desc">${cmd.desc}</span>
      </div>
    </div>`;
  }).join('');
  attachSlashTablePicker(menu);

  menu.style.display = 'block';
  const spacing = 8;
  const viewportTop = window.scrollY;
  const viewportBottom = window.scrollY + window.innerHeight;
  const viewportLeft = window.scrollX;
  const viewportRight = window.scrollX + window.innerWidth;
  const menuHeight = menu.offsetHeight || 260;
  const menuWidth = menu.offsetWidth || 240;
  const preferredTop = anchorRect ? (baseTop + rect.height + 8) : (baseTop + 50);
  const fitsBelow = preferredTop + menuHeight <= viewportBottom - spacing;
  const fallbackTop = baseTop - menuHeight - spacing;
  const top = fitsBelow ? preferredTop : Math.max(viewportTop + spacing, fallbackTop);
  const unclampedLeft = baseLeft;
  const maxLeft = viewportRight - menuWidth - spacing;
  const left = Math.max(viewportLeft + spacing, Math.min(unclampedLeft, maxLeft));
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  setSlashMenuActive(true);
  bindSlashCloseListeners();
}

function attachSlashTablePicker(menu) {
  const tableItem = menu.querySelector('[data-slash-cmd="tabla"]');
  if (!tableItem) return;
  tableItem.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    renderSlashTablePicker(menu);
  });
}

function renderSlashTablePicker(menu) {
  const maxRows = 6;
  const maxCols = 6;
  menu.innerHTML = `
    <div class="slash-menu-section">Tabla</div>
    <div class="slash-menu-item" data-table-back>
      <span class="icon">←</span>
      <div>
        <span class="label">Volver al menú</span>
        <span class="desc">Mantener mismo estilo del slash menu</span>
      </div>
    </div>
    <div style="padding:10px 14px">
      <div id="slash-table-size" style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Selecciona tamaño: 1 x 1</div>
      <div id="slash-table-grid" style="display:grid;grid-template-columns:repeat(${maxCols},18px);gap:4px;justify-content:start"></div>
    </div>
  `;
  const backBtn = menu.querySelector('[data-table-back]');
  if (backBtn) {
    backBtn.addEventListener('click', () => showSlashMenu(slashMenuCurrentTextArea, slashMenuCurrentPreview, slashMenuCurrentImageMap || {}));
  }
  const grid = menu.querySelector('#slash-table-grid');
  const sizeLabel = menu.querySelector('#slash-table-size');
  if (!grid || !sizeLabel) return;
  const cells = [];
  for (let r = 1; r <= maxRows; r++) {
    for (let c = 1; c <= maxCols; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.style.cssText = 'width:18px;height:18px;border:1px solid var(--border);background:var(--surface3);border-radius:4px;cursor:pointer;padding:0;';
      cell.addEventListener('mouseenter', () => {
        sizeLabel.textContent = `Selecciona tamaño: ${r} x ${c}`;
        cells.forEach(el => {
          const er = Number(el.dataset.r);
          const ec = Number(el.dataset.c);
          const on = er <= r && ec <= c;
          el.style.background = on ? 'var(--accent)' : 'var(--surface3)';
          el.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
        });
      });
      cell.addEventListener('click', () => {
        executeSlashCommand(`tabla:${r}x${c}`);
      });
      cells.push(cell);
      grid.appendChild(cell);
    }
  }
}

function closeSlashMenu() {
  const menu = document.getElementById('slash-menu');
  if (menu) menu.style.display = 'none';
  setSlashMenuActive(false);
  setSlashMenuCurrentTextArea(null);
  setSlashMenuCurrentPreview(null);
  setSlashMenuCurrentImageMap(null);
  slashMenuState.query = '';
  slashMenuState.lineStart = 0;
  slashMenuState.cleanupOnClose = false;
  slashMenuState.range = null;
  if (slashOutsideClickHandler) {
    document.removeEventListener('mousedown', slashOutsideClickHandler, true);
    slashOutsideClickHandler = null;
  }
  if (slashEscHandler) {
    document.removeEventListener('keydown', slashEscHandler, true);
    slashEscHandler = null;
  }
}

function bindSlashCloseListeners() {
  if (!slashOutsideClickHandler) {
    slashOutsideClickHandler = (ev) => {
      const menu = document.getElementById('slash-menu');
      if (!menu || menu.style.display === 'none') return;
      if (!menu.contains(ev.target)) {
        cleanupSlashTriggerIfNeeded();
        closeSlashMenu();
      }
    };
    document.addEventListener('mousedown', slashOutsideClickHandler, true);
  }
  if (!slashEscHandler) {
    slashEscHandler = (ev) => {
      if (ev.key !== 'Escape') return;
      cleanupSlashTriggerIfNeeded();
      closeSlashMenu();
    };
    document.addEventListener('keydown', slashEscHandler, true);
  }
}

function cleanupSlashTriggerIfNeeded() {
  const textarea = slashMenuCurrentTextArea;
  if (!textarea) return;
  const text = textarea.value || '';
  const cursorPos = textarea.selectionStart ?? text.length;
  const lastNewline = text.lastIndexOf('\n', Math.max(0, cursorPos - 1));
  const lineStart = lastNewline + 1;
  const lineText = text.substring(lineStart, cursorPos);
  if (!lineText.startsWith('/')) return;
  textarea.value = text.substring(0, lineStart) + text.substring(cursorPos);
  textarea.selectionStart = textarea.selectionEnd = lineStart;
  const previewId = slashMenuCurrentPreview;
  const imageMap = slashMenuCurrentImageMap || {};
  if (previewId) updateMarkdownPreview(textarea.id, previewId, imageMap);
  if (textarea.id === 'note-body-input') syncNoteTextareaToEditor();
}

/**
 * Ejecuta comando / desde menú (onclick en HTML).
 * «tabla» / «imagen» muestran aviso hasta portar el editor visual del monolito.
 */
export function executeSlashCommand(cmd) {
  const textarea = slashMenuCurrentTextArea;
  const previewId = slashMenuCurrentPreview;
  const imageMap = slashMenuCurrentImageMap || {};
  if (!textarea) return;

  if (textarea.id === 'note-body-input') {
    const editor = document.getElementById('note-body-editor');
    if (!editor) return;
    const sel = window.getSelection();
    if (sel && slashMenuState.range) {
      sel.removeAllRanges();
      sel.addRange(slashMenuState.range);
    }
    const liveSel = window.getSelection();
    const activeRange = liveSel && liveSel.rangeCount ? liveSel.getRangeAt(0) : null;
    if (!activeRange) return;

    const triggerLen = (slashMenuState.query || '').length + 1;
    if (activeRange.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = activeRange.startContainer;
      const startOffset = Math.max(0, activeRange.startOffset - triggerLen);
      const removalRange = document.createRange();
      removalRange.setStart(textNode, startOffset);
      removalRange.setEnd(textNode, activeRange.startOffset);
      removalRange.deleteContents();
      activeRange.setStart(textNode, startOffset);
      activeRange.collapse(true);
      liveSel.removeAllRanges();
      liveSel.addRange(activeRange);
    }
    // Fallback: si el rango no cae en un text node (p.ej. después de varios bloques),
    // limpiamos el trigger slash en el textarea espejo y volvemos a sincronizar.
    else {
      syncNoteEditorToTextarea();
      const mirrorText = textarea.value || '';
      const mirrorCursor = textarea.selectionStart ?? mirrorText.length;
      const before = mirrorText.substring(0, mirrorCursor);
      const nl = before.lastIndexOf('\n');
      const segStart = nl + 1;
      const seg = before.substring(segStart);
      const slashAt = seg.lastIndexOf('/');
      if (slashAt >= 0) {
        const start = segStart + slashAt;
        textarea.value = mirrorText.substring(0, start) + mirrorText.substring(mirrorCursor);
        textarea.selectionStart = textarea.selectionEnd = start;
        syncNoteTextareaToEditor();
        const editorAfter = document.getElementById('note-body-editor');
        placeCaretAtEnd(editorAfter);
      }
    }

    if (cmd === 'imagen') {
      syncNoteEditorToTextarea('html');
      updateMarkdownPreview('note-body-input', 'note-content-preview', imageMap);
      insertImageIntoTextarea(textarea.id);
      closeSlashMenu();
      return;
    }

    let insertTextHtml = '';
    if (cmd.startsWith('tabla:')) {
      const raw = cmd.slice('tabla:'.length);
      const [rowsStr, colsStr] = raw.split('x');
      const rows = Math.max(1, Math.min(20, Number.parseInt(rowsStr || '0', 10) || 0));
      const cols = Math.max(1, Math.min(12, Number.parseInt(colsStr || '0', 10) || 0));
      if (!rows || !cols) {
        closeSlashMenu();
        return;
      }
      const header = `| ${Array.from({ length: cols }, (_, i) => `Col ${i + 1}`).join(' | ')} |`;
      const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
      const bodyRows = Array.from({ length: rows }, (_, r) => `| ${Array.from({ length: cols }, (_, c) => `Dato ${r + 1}.${c + 1}`).join(' | ')} |`);
      insertTextHtml = renderMarkdown(`${header}\n${separator}\n${bodyRows.join('\n')}\n`, editingNoteImages);
    } else {
      let insertText = '';
      switch (cmd) {
        case 'lista': insertText = '- Elemento 1\n- Elemento 2\n- Elemento 3\n'; break;
        case 'check': insertText = '- [ ] Tarea 1\n- [ ] Tarea 2\n- [ ] Tarea 3\n'; break;
        case 'divisor': insertText = '---\n'; break;
        case 'estilo-parrafo': insertText = 'Texto de párrafo (cuerpo).\n'; break;
        case 'estilo-h1': insertText = '# Encabezado 1\n\n'; break;
        case 'estilo-h2': insertText = '## Encabezado 2\n\n'; break;
        case 'estilo-h3': insertText = '### Encabezado 3\n\n'; break;
        case 'estilo-h4': insertText = '#### Título 4\n\n'; break;
        case 'estilo-tc1': insertText = '<details class="md-details md-tc1"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
        case 'estilo-tc2': insertText = '<details class="md-details md-tc2"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
        case 'estilo-tc3': insertText = '<details class="md-details md-tc3"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
        case 'estilo-tc4': insertText = '<details class="md-details md-tc4"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
        case 'estilo-cita': insertText = '> Cita de ejemplo\n'; break;
        case 'estilo-codigo': insertText = '```\ncódigo aquí\n```\n'; break;
        default: insertText = '\n';
      }
      insertTextHtml = renderMarkdown(insertText, editingNoteImages);
    }

    const fragment = activeRange.createContextualFragment(insertTextHtml);
    const tail = document.createElement('span');
    tail.textContent = '';
    fragment.appendChild(tail);
    activeRange.insertNode(fragment);
    const caretRange = document.createRange();
    caretRange.setStartAfter(tail);
    caretRange.collapse(true);
    liveSel.removeAllRanges();
    liveSel.addRange(caretRange);
    tail.remove();

    cleanupLeadingEmptyNodes(editor);
    placeCaretAtEnd(editor);
    scrollNoteEditorAfterBlockInsert(editor);
    syncNoteEditorToTextarea('html');
    updateMarkdownPreview('note-body-input', 'note-content-preview', imageMap);
    closeSlashMenu();
    return;
  }

  const text = textarea.value;
  const cursorPos = textarea.selectionStart;
  const beforeCursor = text.substring(0, cursorPos);
  const lastNewline = beforeCursor.lastIndexOf('\n');
  const segmentStart = lastNewline + 1;
  const linePrefix = beforeCursor.substring(segmentStart);
  const slashIdxInLine = linePrefix.lastIndexOf('/');
  const commandStart = slashIdxInLine >= 0 ? segmentStart + slashIdxInLine : segmentStart;

  if (cmd === 'imagen') {
    // Limpiar la línea del comando slash antes de abrir el selector de imagen.
    textarea.value = text.substring(0, commandStart) + text.substring(cursorPos);
    textarea.selectionStart = textarea.selectionEnd = commandStart;
    if (previewId) updateMarkdownPreview(textarea.id, previewId, imageMap);
    if (textarea.id === 'note-body-input') {
      syncNoteTextareaToEditor();
      const editor = document.getElementById('note-body-editor');
      placeCaretAtEnd(editor);
    }
    insertImageIntoTextarea(textarea.id);
    closeSlashMenu();
    return;
  }

  let insertText = '';
  if (cmd.startsWith('tabla:')) {
    const raw = cmd.slice('tabla:'.length);
    const [rowsStr, colsStr] = raw.split('x');
    const rows = Math.max(1, Math.min(20, Number.parseInt(rowsStr || '0', 10) || 0));
    const cols = Math.max(1, Math.min(12, Number.parseInt(colsStr || '0', 10) || 0));
    if (!rows || !cols) {
      closeSlashMenu();
      return;
    }
    const header = `| ${Array.from({ length: cols }, (_, i) => `Col ${i + 1}`).join(' | ')} |`;
    const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
    const bodyRows = Array.from(
      { length: rows },
      (_, r) => `| ${Array.from({ length: cols }, (_, c) => `Dato ${r + 1}.${c + 1}`).join(' | ')} |`
    );
    insertText = `${header}\n${separator}\n${bodyRows.join('\n')}\n`;
  }
  if (!cmd.startsWith('tabla:')) switch (cmd) {
    case 'lista': insertText = '- Elemento 1\n- Elemento 2\n- Elemento 3\n'; break;
    case 'check': insertText = '- [ ] Tarea 1\n- [ ] Tarea 2\n- [ ] Tarea 3\n'; break;
    case 'divisor': insertText = '---\n'; break;
    case 'tabla': return;
    case 'estilo-parrafo': insertText = 'Texto de párrafo (cuerpo).\n'; break;
    case 'estilo-h1': insertText = '# Encabezado 1\n\n'; break;
    case 'estilo-h2': insertText = '## Encabezado 2\n\n'; break;
    case 'estilo-h3': insertText = '### Encabezado 3\n\n'; break;
    case 'estilo-h4': insertText = '#### Título 4\n\n'; break;
    case 'estilo-tc1': insertText = '<details class="md-details md-tc1"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
    case 'estilo-tc2': insertText = '<details class="md-details md-tc2"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
    case 'estilo-tc3': insertText = '<details class="md-details md-tc3"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
    case 'estilo-tc4': insertText = '<details class="md-details md-tc4"><summary>Título contraíble</summary><div class="md-details-body">Contenido del bloque.</div></details>\n'; break;
    case 'estilo-cita': insertText = '> Cita de ejemplo\n'; break;
    case 'estilo-codigo': insertText = '```\ncódigo aquí\n```\n'; break;
    default: insertText = '\n';
  }

  const cleanedPrefix = text.substring(0, commandStart).replace(/\n+$/, '');
  const prefix = cleanedPrefix.length ? `${cleanedPrefix}\n` : '';
  textarea.value = prefix + insertText + text.substring(cursorPos);
  const nextPos = Math.max(0, prefix.length + insertText.length - 1);
  textarea.selectionStart = textarea.selectionEnd = nextPos;
  textarea.focus();
  if (previewId) updateMarkdownPreview(textarea.id, previewId, imageMap);
  if (textarea.id === 'note-body-input') {
    syncNoteTextareaToEditor();
    const editor = document.getElementById('note-body-editor');
    cleanupLeadingEmptyNodes(editor);
    placeCaretAtEnd(editor);
  }
  closeSlashMenu();
}

// ===== IMAGE INSERTION FUNCTIONS =====
// makeImageKey, registerTempImage, collectImageMap: ./data.js

export function insertImageIntoTextarea(textAreaId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      const dataUrl = event.target.result;
      const altText = prompt('Texto alternativo para la imagen', 'Imagen') || 'Imagen';
      const key = makeImageKey();
      registerTempImage(key, dataUrl);

      const textarea = document.getElementById(textAreaId);
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const textAfter = textarea.value.substring(cursorPos);
      textarea.value = textBefore + `![${altText}](${key})` + textAfter;
      textarea.focus();
      textarea.setSelectionRange(cursorPos + 12 + key.length + altText.length, cursorPos + 12 + key.length + altText.length);

      let imageMap = {};
      let previewId = '';
      if (textAreaId === 'note-body-input') {
        editingNoteImages[key] = dataUrl;
        imageMap = editingNoteImages;
        previewId = 'note-content-preview';
      } else if (textAreaId === 'postit-body-input') {
        editingPostitImages[key] = dataUrl;
        imageMap = editingPostitImages;
        previewId = 'postit-content-preview';
      } else if (textAreaId === 'doc-content-input') {
        editingDocImages[key] = dataUrl;
        imageMap = editingDocImages;
        previewId = 'doc-content-preview';
      } else if (textAreaId === 'project-desc-input') {
        editingProjectImages[key] = dataUrl;
        imageMap = editingProjectImages;
        previewId = 'project-desc-preview';
      } else if (textAreaId === 'task-desc-input') {
        editingTaskImages[key] = dataUrl;
        imageMap = editingTaskImages;
        previewId = 'task-desc-preview';
      }
      updateMarkdownPreview(textAreaId, previewId, imageMap);
      if (textAreaId === 'note-body-input') syncNoteTextareaToEditor();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export function insertImage() { insertImageIntoTextarea('note-body-input'); }
export function insertImagePostit() { insertImageIntoTextarea('postit-body-input'); }
export function insertImageDoc() { insertImageIntoTextarea('doc-content-input'); }
export function insertImageProject() { insertImageIntoTextarea('project-desc-input'); }
export function insertImageTask() { insertImageIntoTextarea('task-desc-input'); }