// ===== NOTES MODULE =====

// Import required dependencies
import { currentUser, notes, projects, postitCards, currentDate, activeShiftFilters, searchQuery, searchNotesAllDates, activeNoteTagFilter, notesAuthorFilterId, notesListSort, currentView, currentNoteView, weekOffset, SHIFTS, USERS, GROUPS, workGroups, sameId, toDateStr, editingNoteImages, editingPostitImages, editingDocImages, editingProjectImages, editingTaskImages, setNotes, editingNoteId, selectedShift, selectedPriority, selectedMentions, selectedMentionGroup, selectedNoteVisibility, reminderOn, setEditingNoteId, setSelectedShift, setSelectedPriority, setSelectedMentions, setEditingNoteImages, setReminderOn, setSelectedNoteVisibility, setSelectedMentionGroup, setActiveNoteTagFilter, setNotesAuthorFilterId, setNotesListSort, makeImageKey, registerTempImage, collectImageMap, setSlashMenuActive, setSlashMenuCurrentTextArea, setSlashMenuCurrentPreview, setSlashMenuCurrentImageMap, slashMenuCurrentTextArea, slashMenuCurrentPreview, slashMenuCurrentImageMap, setCurrentDate, setCurrentNoteView, PUBLIC_NOTES_PER_GROUP_INITIAL } from './data.js';
import { loadReadMentions } from './mentionsRead.js';
import { renderMentionChips } from './comments.js';
import { showToast, openModal, closeModal, showConfirmModal } from './modalControl.js';
import { updateMarkdownPreview } from './docs.js';
import { createCustomSelect } from './auroraCustomSelect.js';
import { apiGetAllNotes, apiCreateNote, apiUpdateNote, apiDeleteNote } from '../api.js';
import { bumpNotesMetric } from './notesTelemetry.js';

export { createCustomSelect };

// —— Calendario mensual (navegación persistente hasta cambiar de vista) ——
let ncalDisplayedYear = null;
let ncalDisplayedMonth = null;

function getCalendarYM() {
  const now = new Date();
  if (ncalDisplayedYear == null || ncalDisplayedMonth == null) {
    return { y: now.getFullYear(), m: now.getMonth() };
  }
  return { y: ncalDisplayedYear, m: ncalDisplayedMonth };
}

export function ncalNavigateMonth(delta) {
  const { y, m } = getCalendarYM();
  const d = new Date(y, m + delta, 1);
  ncalDisplayedYear = d.getFullYear();
  ncalDisplayedMonth = d.getMonth();
  renderNotesCalendarView();
}

export function ncalGoToday() {
  const t = new Date();
  ncalDisplayedYear = t.getFullYear();
  ncalDisplayedMonth = t.getMonth();
  renderNotesCalendarView();
  requestAnimationFrame(() => {
    if (typeof window._ncalSelectDay === 'function') window._ncalSelectDay(toDateStr(t));
  });
}

/** Abre el modal de nueva nota usando la fecha del día (lista y guardado usan `currentDate`). */
export function ncalOpenNewNoteForDay(dateStr) {
  const raw = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
  setCurrentDate(raw);
  openNewNoteModal();
}

let _ncalGoToKeyListenerBound = false;

function bindNcalGoToDateShortcutOnce() {
  if (_ncalGoToKeyListenerBound) return;
  _ncalGoToKeyListenerBound = true;
  document.addEventListener(
    'keydown',
    ev => {
      if (currentNoteView !== 'calendar') return;
      if (!ev.ctrlKey && !ev.metaKey) return;
      if (ev.key !== 'g' && ev.key !== 'G') return;
      const t = ev.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      ev.preventDefault();
      ncalOpenGoToDate();
    },
    true
  );
}

/** Salto a un mes/día concretos (confirmación con input type=date). */
export function ncalOpenGoToDate() {
  const todayStr = toDateStr(new Date());
  showConfirmModal({
    icon: '📅',
    title: 'Ir a la fecha…',
    confirmLabel: 'Ir',
    messageHtml: `<p class="ncal-goto-intro" style="margin:0 0 12px;font-size:13px;color:var(--text-muted)">Elige un día; se mostrará ese mes y quedará seleccionado.</p>
      <label class="ncal-goto-label" style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--text)">Fecha
        <input type="date" id="ncal-goto-date-input" class="form-input" value="${escapeHtmlAttr(todayStr)}" style="max-width:100%">
      </label>
      <p style="margin:10px 0 0;font-size:11px;color:var(--text-muted)">Atajo: <kbd>Ctrl</kbd>+<kbd>G</kbd></p>`,
    onConfirm: () => {
      const inp = document.getElementById('ncal-goto-date-input');
      const raw = inp && inp.value ? String(inp.value).trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        showToast('Fecha no válida', 'error');
        return;
      }
      const d = new Date(raw + 'T12:00:00');
      if (Number.isNaN(d.getTime())) {
        showToast('Fecha no válida', 'error');
        return;
      }
      ncalDisplayedYear = d.getFullYear();
      ncalDisplayedMonth = d.getMonth();
      renderNotesCalendarView();
      requestAnimationFrame(() => {
        if (typeof window._ncalSelectDay === 'function') window._ncalSelectDay(raw);
      });
      announceNotes(`Calendario: ${raw}`);
    },
  });
  setTimeout(() => document.getElementById('ncal-goto-date-input')?.focus?.(), 80);
}

let _prevNotesLayoutMode = 'list';

function syncNotesViewLayoutMode(mode) {
  const root = document.getElementById('view-notes');
  if (!root) return;
  const prev = _prevNotesLayoutMode;
  _prevNotesLayoutMode = mode;
  root.classList.remove('notes-layout-list', 'notes-layout-calendar', 'notes-layout-mentions', 'notes-layout-weekly');
  root.classList.add('notes-layout-' + mode);
  if (prev !== mode) {
    root.classList.add('notes-layout-switching');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('notes-layout-switching'));
    });
  }
}

export function syncNotesViewSwitcherUI() {
  const switcher = document.querySelector('.notes-view-switcher');
  if (!switcher) return;
  const btns = switcher.querySelectorAll('.notes-view-btn');
  if (btns.length >= 2) {
    btns[0].classList.toggle('active', currentNoteView !== 'calendar');
    btns[1].classList.toggle('active', currentNoteView === 'calendar');
  }
  const titleEl = document.getElementById('view-title');
  if (titleEl) {
    if (currentNoteView === 'calendar') {
      titleEl.textContent = 'Calendario';
    } else {
      const titles = {
        all: 'Todas las Notas',
        mine: 'Mis Notas',
        mentions: 'Menciones a mí',
        reminders: 'Recordatorios',
        weekly: 'Resumen Semanal',
      };
      titleEl.textContent = titles[currentNoteView] || 'Notas';
    }
  }
}

export function announceNotes(msg) {
  const el = document.getElementById('notes-live-region');
  if (!el || msg == null || msg === '') return;
  el.textContent = '';
  requestAnimationFrame(() => {
    el.textContent = String(msg);
  });
}

const NOTES_SAVE_SOUND_KEY = 'diario_notes_save_sound';

export function isNotesSaveSoundEnabled() {
  try {
    return localStorage.getItem(NOTES_SAVE_SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function setNotesSaveSoundEnabled(on) {
  try {
    localStorage.setItem(NOTES_SAVE_SOUND_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function syncNotesSaveSoundCheckbox() {
  const el = document.getElementById('pref-notes-save-sound');
  if (el) el.checked = isNotesSaveSoundEnabled();
}

export function onNotesSaveSoundPrefChange(input) {
  setNotesSaveSoundEnabled(!!(input && input.checked));
}

export function playNotesSaveChime() {
  if (!isNotesSaveSoundEnabled()) return;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(8);
      } catch {
        /* ignore */
      }
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(720, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.022, ctx.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.13);
    o.onended = () => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    };
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (coarse && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(6);
      }
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

export function toggleNotesTopbarOverflowMenu(forceClose) {
  const m = document.getElementById('notes-topbar-overflow-menu');
  const t = document.getElementById('notes-topbar-overflow-trigger');
  if (!m) return;
  if (forceClose === true) {
    m.classList.add('hidden');
    if (t) t.setAttribute('aria-expanded', 'false');
    t?.focus?.();
    return;
  }
  const wasHidden = m.classList.contains('hidden');
  if (!wasHidden) {
    m.classList.add('hidden');
    if (t) t.setAttribute('aria-expanded', 'false');
    return;
  }
  toggleNotesExportMenu(true);
  m.classList.remove('hidden');
  if (t) t.setAttribute('aria-expanded', 'true');
  bumpNotesMetric('notes_topbar_overflow_open');
  const first = m.querySelector('[role="menuitem"]');
  requestAnimationFrame(() => first?.focus?.());
}

export function toggleNotesExportMenu(forceClose) {
  const m = document.getElementById('notes-export-menu');
  const t = document.getElementById('notes-export-menu-trigger');
  if (!m) return;
  if (forceClose === true) {
    m.classList.add('hidden');
    if (t) t.setAttribute('aria-expanded', 'false');
    t?.focus?.();
    return;
  }
  const wasHidden = m.classList.contains('hidden');
  m.classList.toggle('hidden');
  const nowOpen = wasHidden && !m.classList.contains('hidden');
  if (t) t.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
  if (nowOpen) {
    bumpNotesMetric('notes_export_menu_open');
    const first = m.querySelector('[role="menuitem"]');
    requestAnimationFrame(() => first?.focus?.());
  }
  if (!window._notesExportEscHandler) {
    window._notesExportEscHandler = ev => {
      if (ev.key !== 'Escape') return;
      const exportMenu = document.getElementById('notes-export-menu');
      const overflowMenu = document.getElementById('notes-topbar-overflow-menu');
      const exportOpen = exportMenu && !exportMenu.classList.contains('hidden');
      const overflowOpen = overflowMenu && !overflowMenu.classList.contains('hidden');
      if (!exportOpen && !overflowOpen) return;
      ev.preventDefault();
      if (exportOpen) toggleNotesExportMenu(true);
      if (overflowOpen) toggleNotesTopbarOverflowMenu(true);
      document.getElementById('notes-export-menu-trigger')?.focus?.();
      document.getElementById('notes-topbar-overflow-trigger')?.focus?.();
    };
    document.addEventListener('keydown', window._notesExportEscHandler, true);
  }
}

function buildNoteModalFingerprint() {
  const editor = document.getElementById('note-body-editor');
  if (editor) syncNoteEditorToTextarea('html');
  const t = (document.getElementById('note-title-input')?.value || '').trim();
  const b = (document.getElementById('note-body-input')?.value || '').trim();
  const tags = (document.getElementById('note-tags-input')?.value || '').trim();
  return JSON.stringify({
    t,
    b,
    tags,
    shift: selectedShift,
    pri: selectedPriority,
    vis: selectedNoteVisibility,
    rem: reminderOn,
    pin: !!document.getElementById('note-pinned-toggle')?.classList.contains('on'),
  });
}

function isNoteModalDirty() {
  if (!window._noteModalBaseline) return false;
  try {
    return buildNoteModalFingerprint() !== window._noteModalBaseline;
  } catch {
    return false;
  }
}

export function snapshotNoteModalBaseline() {
  window._noteModalBaseline = buildNoteModalFingerprint();
  syncNoteModalSaveButtonState();
}

export function syncNoteModalSaveButtonState() {
  const btn = document.getElementById('note-modal-save-btn');
  if (!btn) return;
  const title = document.getElementById('note-title-input')?.value.trim() || '';
  const editor = document.getElementById('note-body-editor');
  if (editor) syncNoteEditorToTextarea('html');
  const body = document.getElementById('note-body-input')?.value.trim() || '';
  const ok = !!title && !!body && !!selectedShift;
  const loading = btn.classList.contains('is-loading');
  btn.disabled = loading || !ok;
  const dot = document.getElementById('note-modal-dirty-dot');
  if (dot) {
    dot.classList.toggle('hidden', !isNoteModalDirty());
  }
}

export function requestCloseNoteModal() {
  if (!document.getElementById('note-modal')?.classList.contains('open')) return;
  if (!isNoteModalDirty()) {
    closeModal('note-modal');
    return;
  }
  showConfirmModal({
    title: 'Cerrar sin guardar',
    message: 'Hay cambios sin guardar. ¿Descartarlos y cerrar el formulario?',
    icon: '✏️',
    confirmLabel: 'Descartar y cerrar',
    destructive: true,
    onConfirm: () => {
      clearNoteDraft();
      window._noteModalBaseline = null;
      closeModal('note-modal');
    },
  });
}

export function openNotesShortcutsHelpModal() {
  openModal('notes-shortcuts-modal');
}

export function filterNotesByAuthorFromCard(ev, authorId) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  setNotesAuthorFilterId(authorId);
  renderNotes();
}

export function clearNotesAuthorFilter() {
  setNotesAuthorFilterId(null);
  renderNotes();
}

export function applyNotesListSort(val) {
  setNotesListSort(val);
  renderNotes();
}

// —— Borrador local (solo nueva nota) ——
let _noteDraftTimer = null;
let _noteModalKeyHandler = null;

function noteDraftStorageKey() {
  try {
    return `diarioNoteDraft:${currentUser?.id || 'anon'}`;
  } catch {
    return 'diarioNoteDraft:anon';
  }
}

function readNoteDraftPayload() {
  const title = document.getElementById('note-title-input')?.value || '';
  const body = document.getElementById('note-body-input')?.value || '';
  return { title, body, savedAt: new Date().toISOString() };
}

function flushNoteDraftSave() {
  if (editingNoteId != null) return;
  try {
    const p = readNoteDraftPayload();
    if (!(p.title || '').trim() && !(p.body || '').trim()) {
      localStorage.removeItem(noteDraftStorageKey());
      return;
    }
    localStorage.setItem(noteDraftStorageKey(), JSON.stringify(p));
  } catch {
    /* quota u otro */
  }
}

function scheduleNoteDraftSave() {
  if (editingNoteId != null) return;
  clearTimeout(_noteDraftTimer);
  _noteDraftTimer = setTimeout(() => {
    _noteDraftTimer = null;
    flushNoteDraftSave();
  }, 750);
}

function clearNoteDraft() {
  try {
    localStorage.removeItem(noteDraftStorageKey());
  } catch {
    /* noop */
  }
}

function tryRestoreNoteDraft() {
  if (editingNoteId != null) return;
  let raw;
  try {
    raw = localStorage.getItem(noteDraftStorageKey());
  } catch {
    return;
  }
  if (!raw) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  const ti = document.getElementById('note-title-input');
  const be = document.getElementById('note-body-editor');
  const bi = document.getElementById('note-body-input');
  if (ti && data.title) ti.value = data.title;
  if (be && bi) {
    const bodyStr = data.body || '';
    bi.value = bodyStr;
    be.innerHTML =
      bodyStr && /<[^>]+>/.test(bodyStr) ? syncMdChecklistHtml(bodyStr) : renderMarkdown(bodyStr, editingNoteImages);
    updateMarkdownPreview('note-body-input', 'note-content-preview', editingNoteImages);
  }
  bindNoteEditorInteractions();
  refreshNoteTagsChipsFromInput();
  showToast('Se restauró tu borrador local', 'info', 2200);
}

function detachNoteModalHotkeys() {
  if (_noteModalKeyHandler) {
    document.removeEventListener('keydown', _noteModalKeyHandler, true);
    _noteModalKeyHandler = null;
  }
}

function attachNoteModalHotkeys() {
  detachNoteModalHotkeys();
  _noteModalKeyHandler = e => {
    const modal = document.getElementById('note-modal');
    if (!modal?.classList.contains('open')) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveNote();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      requestCloseNoteModal();
    }
  };
  document.addEventListener('keydown', _noteModalKeyHandler, true);
}

export function onNoteModalClosed() {
  detachNoteModalHotkeys();
}

if (typeof window !== 'undefined') {
  window._notesLoadMoreShift = function (shift) {
    if (!window._notesShiftLimits) window._notesShiftLimits = { morning: 45, afternoon: 45, night: 45 };
    window._notesShiftLimits[shift] = (window._notesShiftLimits[shift] || 45) + 45;
    bumpNotesMetric('notes_load_more_shift');
    renderNotes();
  };
  window._onNoteModalClosing = () => {
    flushNoteDraftSave();
  };
  window._onNoteModalClose = onNoteModalClosed;
  if (!window._notesExportMenuGlobalBound) {
    window._notesExportMenuGlobalBound = true;
    document.addEventListener('click', e => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      const m = document.getElementById('notes-export-menu');
      const tr = document.getElementById('notes-export-menu-trigger');
      if (m && !m.classList.contains('hidden') && tr && !tr.contains(t) && !m.contains(t)) {
        toggleNotesExportMenu(true);
      }
      const om = document.getElementById('notes-topbar-overflow-menu');
      const otr = document.getElementById('notes-topbar-overflow-trigger');
      if (om && !om.classList.contains('hidden') && otr && !otr.contains(t) && !om.contains(t)) {
        toggleNotesTopbarOverflowMenu(true);
      }
    });
  }
}

export function switchNoteModalTab(tab) {
  const showOpts = tab === 'options';
  const pContent = document.getElementById('note-modal-panel-content');
  const pOptions = document.getElementById('note-modal-panel-options');
  const bContent = document.getElementById('note-modal-tab-btn-content');
  const bOptions = document.getElementById('note-modal-tab-btn-options');
  if (pContent) {
    pContent.classList.toggle('hidden', showOpts);
    if (showOpts) pContent.setAttribute('hidden', '');
    else pContent.removeAttribute('hidden');
  }
  if (pOptions) {
    pOptions.classList.toggle('hidden', !showOpts);
    if (showOpts) pOptions.removeAttribute('hidden');
    else pOptions.setAttribute('hidden', '');
  }
  if (bContent) {
    bContent.classList.toggle('is-active', !showOpts);
    bContent.setAttribute('aria-selected', !showOpts ? 'true' : 'false');
  }
  if (bOptions) {
    bOptions.classList.toggle('is-active', showOpts);
    bOptions.setAttribute('aria-selected', showOpts ? 'true' : 'false');
  }
  syncNoteModalSaveButtonState();
}

export function handleNoteTitleInput() {
  scheduleNoteDraftSave();
  syncNoteModalSaveButtonState();
}

export function refreshNoteTagsChipsFromInput() {
  const input = document.getElementById('note-tags-input');
  const wrap = document.getElementById('note-tags-chips');
  if (!input || !wrap) return;
  const tags = (input.value || '').match(/#[\w\u00C0-\u017F]+/gi) || [];
  wrap.innerHTML = tags
    .slice(0, 16)
    .map(t => `<span class="note-tag-chip">${escapeHtml(t)}</span>`)
    .join('');
  syncNoteModalSaveButtonState();
}

/** Rellena el &lt;datalist&gt; de etiquetas con las ya usadas en notas visibles (autocompletar equipo). */
export function syncNoteTagsDatalist() {
  const dl = document.getElementById('note-tags-suggestions');
  if (!dl) return;
  const input = document.getElementById('note-tags-input');
  const inTags = new Set(
    ((input && input.value) || '').match(/#[\w\u00C0-\u017F]+/gi)?.map(t => t.toLowerCase()) || []
  );
  const pool = getAllVisibleNoteTags().filter(t => t && !inTags.has(String(t).toLowerCase()));
  dl.innerHTML = pool.slice(0, 80).map(t => `<option value="${escapeHtmlAttr(t)}"></option>`).join('');
}

// Slash commands configuration
export const SLASH_COMMANDS = [
  {cmd: 'lista', icon: '•', label: 'Lista', desc: 'Insertar lista con viñetas', section: 'General'},
  {cmd: 'check', icon: '✓', label: 'Checklist', desc: 'Insertar checklist', section: 'General'},
  {cmd: 'divisor', icon: '─', label: 'Divisor', desc: 'Insertar línea divisor', section: 'General'},
  {cmd: 'tabla', icon: '▦', label: 'Tabla', desc: 'Insertar tabla (elige filas y columnas)', section: 'General'},
  {cmd: 'imagen', icon: '🖼️', label: 'Imagen', desc: 'Insertar imagen desde archivo', section: 'General'},
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
  // Ya no guarda en localStorage — las notas se guardan via API
}

export async function loadNotesFromAPI() {
  try {
    const data = await apiGetAllNotes();
    const mapped = data.map(n => ({
      ...n,
      id: n._id || n.id,
      authorId: n.authorId,
      group: n.department || n.group,
    }));
    setNotes(mapped);
    return mapped;
  } catch (err) {
    console.error('Error cargando notas desde API:', err);
    try {
      const local = localStorage.getItem('diario_notes');
      if (local) setNotes(JSON.parse(local));
    } catch {}
    return [];
  }
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

  let vis = n.visibility;
  if (vis !== 'public' && vis !== 'department' && vis !== 'private') {
    vis = 'private';
  }

  // Public notes: visible to same department or core department notes
  if (vis === 'public') {
    return departmentDiarySameCoreDeptNote(n);
  }

  // Department: todo el departamento de la nota (campo group al guardar)
  if (vis === 'department') {
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
function formatHistoryDateLabel(isoDateStr) {
  const today = toDateStr(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = toDateStr(y);
  if (isoDateStr === today) return 'Hoy';
  if (isoDateStr === yesterday) return 'Ayer';
  const d = new Date(`${isoDateStr}T12:00:00`);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function shiftOrder(shift) {
  return { morning: 0, afternoon: 1, night: 2 }[shift] ?? 9;
}

function syncNoteTagFilterUI() {
  const next = activeNoteTagFilter;
  const btn = document.getElementById('note-tag-filter-btn');
  if (btn) {
    btn.textContent = next ? `🏷️ ${next}` : '🏷️ Etiquetas';
    btn.classList.toggle('active', !!next);
  }
  const activePill = document.getElementById('note-tag-active-filter');
  if (activePill) {
    if (next) {
      activePill.innerHTML = `<span class="note-tag-active-pill">${escapeHtml(next)} <button type="button" onclick="filterNotesByTag(null)" title="Quitar filtro">✕</button></span>`;
      activePill.classList.remove('hidden');
    } else {
      activePill.innerHTML = '';
      activePill.classList.add('hidden');
    }
  }
}

function syncNotesOnboardingBanner() {
  const el = document.getElementById('notes-onboarding-banner');
  if (!el) return;
  const root = document.getElementById('view-notes');
  const cal = root?.classList.contains('notes-layout-calendar');
  if (currentNoteView === 'calendar' || cal || currentNoteView === 'weekly' || currentNoteView === 'mentions') {
    el.classList.add('hidden');
    return;
  }
  try {
    if (localStorage.getItem('diario_notes_onboarding_dismissed_v1')) el.classList.add('hidden');
    else el.classList.remove('hidden');
  } catch {
    el.classList.add('hidden');
  }
}

function syncNotesAuthorFilterBar() {
  const bar = document.getElementById('notes-author-filter-bar');
  if (!bar) return;
  if (!notesAuthorFilterId) {
    bar.innerHTML = '';
    bar.classList.add('hidden');
    return;
  }
  const u = USERS.find(x => sameId(x.id, notesAuthorFilterId));
  const label = escapeHtml(u ? u.name : 'Autor');
  bar.classList.remove('hidden');
  bar.innerHTML = `<span class="note-author-active-pill">👤 ${label} <button type="button" class="note-author-active-clear" onclick="clearNotesAuthorFilter()" title="Quitar filtro de autor">✕</button></span>`;
}

function syncNotesListSortControl() {
  const wrap = document.getElementById('notes-sort-seg');
  if (!wrap) return;
  wrap.querySelectorAll('.notes-sort-seg-btn').forEach(btn => {
    const v = btn.getAttribute('data-sort') || 'recent';
    btn.classList.toggle('active', v === (notesListSort === 'oldest' ? 'oldest' : 'recent'));
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}

function syncNoteTagFilterTopbar() {
  syncNoteTagFilterUI();
  syncNotesAuthorFilterBar();
  syncNotesListSortControl();
  syncNotesOnboardingBanner();
  syncNotesViewSwitcherUI();
}

export function renderNotes() {
  // Special view for mentions: separate notes and comments
  if (currentNoteView === 'mentions') {
    renderMentionsView();
    syncNoteTagFilterTopbar();
    return;
  }
  if (currentNoteView === 'weekly') {
    renderWeeklyView();
    return;
  }
  if (currentNoteView === 'calendar') {
    renderNotesCalendarView();
    return;
  }

  syncNotesViewLayoutMode('list');

  const viewNotesRoot = document.getElementById('view-notes');
  if (viewNotesRoot) {
    try {
      const d = new Date(`${currentDate}T12:00:00`);
      viewNotesRoot.dataset.printDate = d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      viewNotesRoot.dataset.printDate = currentDate || '';
    }
    try {
      const deptEl = document.getElementById('cfg-dept-name');
      const appEl = document.getElementById('cfg-app-name');
      viewNotesRoot.dataset.printDept = (deptEl && deptEl.value) || currentUser?.group || '';
      viewNotesRoot.dataset.printApp = (appEl && appEl.value) || 'Diario Departamental';
    } catch {
      viewNotesRoot.dataset.printDept = currentUser?.group || '';
    }
  }

  const histCb = document.getElementById('notes-search-history');
  if (histCb) histCb.checked = searchNotesAllDates;

  const q = (searchQuery || '').trim();
  const useHistorySearch = searchNotesAllDates && q.length > 0;

  let filtered = notes.filter(n => {
    if (!useHistorySearch && n.date !== currentDate) return false;
    if (!useHistorySearch && !activeShiftFilters.includes(n.shift)) return false;
    if (n.visibility === 'public' && !sameId(n.authorId, currentUser.id) && !departmentDiarySameCoreDeptNote(n)) return false;
    if (!userCanSeeNote(n)) return false;
    if (currentNoteView === 'mine' && !sameId(n.authorId, currentUser.id)) return false;
    if (currentNoteView === 'reminders' && !n.reminder) return false;
    if (q) {
      const t = noteTextForDisplay(n.title).toLowerCase();
      const b = noteTextForDisplay(n.body).toLowerCase();
      if (!t.includes(q) && !b.includes(q)) return false;
    }
    if (activeNoteTagFilter) {
      if (!(n.tags || []).includes(activeNoteTagFilter)) return false;
    }
    if (notesAuthorFilterId != null && !sameId(n.authorId, notesAuthorFilterId)) return false;
    return true;
  });

  const todayNotes = notes.filter(n =>
    n.date === currentDate &&
    userCanSeeNote(n) &&
    (n.visibility !== 'public' || sameId(n.authorId, currentUser.id) || departmentDiarySameCoreDeptNote(n))
  );

  // Update statistics
  const statTotal = document.getElementById('stat-total');
  if (!statTotal) {
    syncNoteTagFilterTopbar();
    return;
  }
  const nTot = todayNotes.length;
  const nM = todayNotes.filter(n => n.shift === 'morning').length;
  const nA = todayNotes.filter(n => n.shift === 'afternoon').length;
  const nN = todayNotes.filter(n => n.shift === 'night').length;
  statTotal.textContent = String(nTot);
  const capTot = document.getElementById('stat-total-caption');
  if (capTot) capTot.textContent = nTot === 1 ? 'nota hoy' : 'notas hoy';
  const sm = document.getElementById('stat-morning');
  const sa = document.getElementById('stat-afternoon');
  const sn = document.getElementById('stat-night');
  if (sm) sm.textContent = String(nM);
  if (sa) sa.textContent = String(nA);
  if (sn) sn.textContent = String(nN);
  const cm = document.getElementById('stat-morning-caption');
  const ca = document.getElementById('stat-afternoon-caption');
  const cn = document.getElementById('stat-night-caption');
  if (cm) cm.textContent = nM === 1 ? 'nota · mañana' : 'notas · mañana';
  if (ca) ca.textContent = nA === 1 ? 'nota · tarde' : 'notas · tarde';
  if (cn) cn.textContent = nN === 1 ? 'nota · noche' : 'notas · noche';

  const area = document.getElementById('notes-area');
  if (!area) {
    syncNoteTagFilterTopbar();
    return;
  }

  if (filtered.length === 0) {
    if (q && !useHistorySearch) {
      area.classList.add('notes-area-enter');
      setTimeout(() => area.classList.remove('notes-area-enter'), 320);
      area.innerHTML = `
      <div class="notes-empty-state">
        <div class="notes-empty-icon">🔎</div>
        <div class="notes-empty-title">Sin resultados en este día</div>
        <p class="notes-empty-hint">No hay notas que coincidan con «${escapeHtml(q)}» en la fecha del carrusel y los filtros actuales. Activa <strong>Historial completo</strong> para buscar en otras fechas.</p>
        <div class="notes-empty-actions">
          <button type="button" class="btn-secondary" onclick="clearNotesSearch()">Limpiar búsqueda</button>
          <button type="button" class="btn-action" onclick="openNewNoteModal()">✏️ Nueva nota</button>
        </div>
      </div>`;
      syncNoteTagFilterTopbar();
      return;
    }
    if (useHistorySearch) {
      area.classList.add('notes-area-enter');
      setTimeout(() => area.classList.remove('notes-area-enter'), 320);
      area.innerHTML = `
      <div class="notes-empty-state">
        <div class="notes-empty-icon">🔎</div>
        <div class="notes-empty-title">Sin resultados en el historial</div>
        <p class="notes-empty-hint">Prueba otras palabras o desactiva «Historial completo» para limitar la búsqueda al día del calendario.</p>
        ${q ? `<div class="notes-empty-actions"><button type="button" class="btn-secondary" onclick="clearNotesSearch()">Limpiar búsqueda</button></div>` : ''}
      </div>`;
      syncNoteTagFilterTopbar();
      return;
    }
    const emptyByView = {
      all: {
        icon: '📭',
        title: 'No hay notas para esta selección',
        hint: 'Prueba otro día con las flechas del calendario, activa los tres turnos arriba o limpia la búsqueda. Para empezar, usa ✏️ Nueva Nota.',
      },
      mine: {
        icon: '👤',
        title: 'No tienes notas propias en esta fecha',
        hint: 'Aquí solo ves lo que escribiste tú. Cambia a «Todas las notas» o elige otra fecha para ver al equipo.',
      },
      reminders: {
        icon: '🔔',
        title: 'Sin recordatorios en esta fecha',
        hint: 'Al crear o editar una nota, activa el recordatorio y opcionalmente la hora. Solo aparecen notas del día que tienes seleccionado en el calendario.',
      },
    };
    const key = emptyByView[currentNoteView] ? currentNoteView : 'all';
    const e = emptyByView[key];
    const histHint =
      searchNotesAllDates && !q.length
        ? '<p class="notes-empty-hint" style="margin-top:12px">💡 Activa «Historial completo» y escribe en el buscador para encontrar notas de otros días.</p>'
        : '';
    const shiftFilterHint =
      activeShiftFilters.length < 3
        ? `<p class="notes-empty-hint notes-empty-hint--filters">Filtro de turno activo: solo ves ${activeShiftFilters.length} de 3 turnos. Amplía la selección en la barra lateral para ver más notas.</p>`
        : '';
    area.classList.add('notes-area-enter');
    setTimeout(() => area.classList.remove('notes-area-enter'), 320);
    area.innerHTML = `
      <div class="notes-empty-state">
        <div class="notes-empty-icon">${e.icon}</div>
        <div class="notes-empty-title">${escapeHtml(e.title)}</div>
        <p class="notes-empty-hint">${escapeHtml(e.hint)}</p>
        ${shiftFilterHint}
        ${histHint}
        <ol class="notes-empty-steps" aria-label="Pasos sugeridos">
          <li>Elige el día en el carrusel de fechas arriba.</li>
          <li>Pulsa <strong>Nueva nota</strong> y escribe título y contenido.</li>
          <li>Comprueba turno y visibilidad en la pestaña <strong>Opciones</strong>.</li>
        </ol>
        <div class="notes-empty-actions">
          <button type="button" class="btn-action" onclick="openNewNoteModal()">✏️ Nueva nota</button>
          ${currentNoteView !== 'all' ? `<button type="button" class="btn-secondary" onclick="setNoteView('all', document.getElementById('nav-all'))">📋 Ver todas las notas</button>` : ''}
        </div>
      </div>`;
    syncNoteTagFilterTopbar();
    return;
  }

  if (useHistorySearch) {
    filtered.sort((a, b) => {
      const d = (b.date || '').localeCompare(a.date || '');
      if (d !== 0) return d;
      const sa = shiftOrder(a.shift);
      const sb = shiftOrder(b.shift);
      if (sa !== sb) return sa - sb;
      if (!!a.pinned !== !!b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    const dates = [...new Set(filtered.map(n => n.date))].sort((a, b) => b.localeCompare(a));
    area.classList.add('notes-area-enter');
    setTimeout(() => area.classList.remove('notes-area-enter'), 320);
    area.innerHTML = `<div class="notes-history-wrap">${dates
      .map(ds => {
        const chunk = filtered.filter(n => n.date === ds);
        chunk.sort((a, b) => {
          const sa = shiftOrder(a.shift);
          const sb = shiftOrder(b.shift);
          if (sa !== sb) return sa - sb;
          if (!!a.pinned !== !!b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          if (notesListSort === 'oldest') {
            return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
          }
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
        const label = formatHistoryDateLabel(ds);
        return `<section class="notes-history-block"><h3 class="notes-history-heading">${escapeHtml(label)} <span class="notes-history-iso">${escapeHtml(ds)}</span></h3><div class="notes-history-cards">${chunk.map(n => renderNoteCard(n, { query: searchQuery })).join('')}</div></section>`;
      })
      .join('')}</div>`;
    syncNoteTagFilterTopbar();
    return;
  }

  const byShift = { morning: [], afternoon: [], night: [] };
  filtered.forEach(n => byShift[n.shift].push(n));
  Object.keys(byShift).forEach(k => {
    byShift[k].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (notesListSort === 'oldest') {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      }
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  });

  if (window._notesShiftLimitsDate !== currentDate) {
    window._notesShiftLimits = { morning: 45, afternoon: 45, night: 45 };
    window._notesShiftLimitsDate = currentDate;
  }
  const lims = window._notesShiftLimits || { morning: 45, afternoon: 45, night: 45 };

  area.classList.add('notes-area-enter');
  setTimeout(() => area.classList.remove('notes-area-enter'), 320);
  area.innerHTML = Object.keys(SHIFTS).map(shift => {
    const sns = byShift[shift];
    if (!activeShiftFilters.includes(shift) || sns.length === 0) return '';
    const s = SHIFTS[shift];
    const cap = lims[shift] != null ? lims[shift] : 45;
    const visible = sns.slice(0, cap);
    const more = sns.length - visible.length;
    const loadMore =
      more > 0
        ? `<div class="shift-load-more-wrap"><span class="shift-load-more-meta" aria-live="polite">Mostrando ${visible.length} de ${sns.length}</span><button type="button" class="btn-secondary shift-load-more-btn" onclick="window._notesLoadMoreShift('${shift}')">Cargar más (${more} nota${more !== 1 ? 's' : ''})</button></div>`
        : '';
    let shiftCollapsed = false;
    try {
      shiftCollapsed = localStorage.getItem(`diario_notes_shift_collapsed:${currentDate}:${shift}`) === '1';
    } catch {
      shiftCollapsed = false;
    }
    const notesBodyClass = shiftCollapsed ? 'shift-notes collapsed' : 'shift-notes';
    const arrowClass = shiftCollapsed ? 'shift-toggle' : 'shift-toggle open';
    const secCollapsedClass = shiftCollapsed ? ' shift-section--collapsed' : '';
    return `<div class="shift-section${secCollapsedClass}" data-shift="${shift}">
      <div class="shift-header" onclick="toggleShiftSection(this)">
        <div class="shift-dot" style="background:${s.dot}"></div>
        <h3 style="color:${s.color}">${s.emoji} Turno ${s.label}</h3>
        <span class="shift-time">${s.hours}</span>
        <span class="shift-count">${sns.length} nota${sns.length !== 1 ? 's' : ''}</span>
        <span class="${arrowClass}">▶</span>
      </div>
      <div class="${notesBodyClass}">${visible.map(n => renderNoteCard(n, { query: searchQuery })).join('')}${loadMore}</div>
    </div>`;
  }).join('');
  syncNoteTagFilterTopbar();
}

/**
 * Render a note card
 * @param {Object} note - Note object
 * @param {Object} cardOpts - Card options
 * @returns {string} HTML string
 */
/** Título/cuerpo de nota como texto: evita que booleanos u otros tipos se muestren como "true"/"false". */
function noteTextForDisplay(value) {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string') return value;
  return String(value);
}

/** Texto seguro dentro de nodos HTML (evita que &lt;div&gt; en título/cuerpo rompa el árbol y anide tarjetas). */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Alinea la clase `checked` del li con el estado del input; opcionalmente persiste el atributo checked en el HTML. */
function syncMdChecklistDom(root, persistCheckboxAttribute = false) {
  if (!root) return;
  root.querySelectorAll('li.md-checklist-item').forEach((li) => {
    const cb = li.querySelector('input.md-checkbox-input, input[type="checkbox"]');
    if (!(cb instanceof HTMLInputElement) || cb.type !== 'checkbox') return;
    li.classList.toggle('checked', cb.checked);
    if (persistCheckboxAttribute) {
      if (cb.checked) cb.setAttribute('checked', '');
      else cb.removeAttribute('checked');
    }
  });
}

/** HTML guardado: restaura `checked` en el li según el input (p. ej. tras cargar desde disco). */
function syncMdChecklistHtml(html) {
  if (!html || typeof html !== 'string' || !html.includes('md-checklist-item')) return html;
  try {
    const doc = new DOMParser().parseFromString(`<div class="md-sync-checklist-root">${html}</div>`, 'text/html');
    const wrap = doc.body.querySelector('.md-sync-checklist-root');
    if (!wrap) return html;
    syncMdChecklistDom(wrap, false);
    return wrap.innerHTML;
  } catch {
    return html;
  }
}

export function renderNoteCard(note, cardOpts = {}) {
  const author = USERS.find(u => sameId(u.id, note.authorId)) ||
               USERS.find(u => u.msId === note.authorId) ||
               (note.authorName ? { name: note.authorName, initials: (note.authorName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()), color: '#888' } : null);
  const canEdit = userCanEditNote(note);
  const pinned = !!note.pinned;
  const date = new Date(note.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const prRaw = note.priority || 'normal';
  const prSafe = ['normal', 'media', 'alta'].includes(prRaw) ? prRaw : 'normal';
  const priorityLabel = { normal: '', media: 'Media', alta: '🔴 Alta' }[prSafe];
  const priorityTag =
    note.priority && prSafe !== 'normal'
      ? `<span class="note-tag priority-${prSafe}">${priorityLabel}</span>`
      : '';
  const pinTag = pinned ? `<span class="note-tag note-tag-pinned" title="Fijada">📌 Fijada</span>` : '';
  const tagsHtml = (note.tags || [])
    .map(
      t =>
        `<span class="note-tag note-tag-custom" onclick="event.stopPropagation();filterNotesByTag(${JSON.stringify(
          t
        )})" title="Filtrar por ${escapeHtmlAttr(t)}" style="cursor:pointer">${escapeHtml(t)}</span>`
    )
    .join('');
  const publicTag = note.visibility === 'public' ? `<span class="note-tag note-tag-public">🌐 Pública</span>` : '';
  const deptTag =
    note.visibility === 'department'
      ? `<span class="note-tag note-tag-dept note-tag--dept-scope" title="Visibilidad: todo el departamento (no es una etiqueta #)"><span class="note-tag-scope-mark" aria-hidden="true">🏢</span><span class="note-tag-dept-text">${escapeHtml(note.group || 'Departamento')}</span></span>`
      : '';
  const isNew = (() => {
    if (sameId(note.authorId, currentUser?.id)) return false;
    const created = new Date(note.createdAt);
    const now = new Date();
    const diffHours = (now - created) / (1000 * 60 * 60);
    return diffHours < 2;
  })();
  const newBadge = isNew
    ? `<span class="note-new-badge">Nuevo</span>`
    : '';

  const bg = escapeHtmlAttr(author?.color || '#888');
  const initials = escapeHtml(author?.initials || '?');
  const authorName = escapeHtml(author ? author.name : 'Usuario desconocido');
  const safeDate = escapeHtml(date);
  const whenIso = note.updatedAt || note.createdAt;
  let metaAux = '';
  if (whenIso) {
    const whenStr = escapeHtml(
      new Date(whenIso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    );
    const lab = note.updatedAt ? 'Editada' : 'Creada';
    metaAux = `<span class="note-meta-aux">${lab} · ${whenStr}</span>`;
  }

  const imgCount = Array.isArray(note.images)
    ? note.images.length
    : note.images && typeof note.images === 'object'
      ? Object.keys(note.images).length
      : 0;
  const attachBadge =
    imgCount > 0 ? `<span class="note-attach-badge" title="Nota con adjuntos">Adj. ${imgCount}</span>` : '';

  const idLit = JSON.stringify(String(note.id || note._id || ''));
  const kebabMenu = `<details class="note-card-kebab" onclick="event.stopPropagation()"><summary class="note-card-kebab-sum" aria-label="Más acciones para esta nota" onclick="event.stopPropagation()"><span aria-hidden="true">⋮</span></summary><div class="note-card-kebab-menu" role="menu"><button type="button" class="note-kebab-item" role="menuitem" onclick='duplicateNote(event, ${idLit}, "diary")'>Copiar al día del carrusel</button><button type="button" class="note-kebab-item" role="menuitem" onclick='duplicateNote(event, ${idLit}, "original")'>Copiar en la fecha original de la nota</button></div></details>`;

  const headerHtml = [
    '<div class="note-card-header">',
    `<div class="note-author-avatar" style="background:${bg}">${initials}</div>`,
    '<div class="note-meta-block">',
    '<div class="note-meta">',
    `<button type="button" class="note-author-name note-author-hit" title="Ver solo notas de ${authorName}" aria-label="Filtrar por autor ${authorName}" onclick='filterNotesByAuthorFromCard(event, ${JSON.stringify(String(note.authorId || ''))})'>${authorName}</button>`,
    `<span class="note-timestamp">${safeDate}</span>`,
    metaAux,
    '</div>',
    '</div>',
    `<div class="note-tags">${newBadge}${attachBadge}${pinTag}${priorityTag}${deptTag}${publicTag}${tagsHtml}${kebabMenu}</div>`,
    '</div>',
  ].join('');

  const rawBody = noteTextForDisplay(note.body);
  const plainBodyLen = rawBody
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
  const compact =
    plainBodyLen > 0 &&
    plainBodyLen < 88 &&
    imgCount === 0 &&
    !(note.mentions && note.mentions.length);
  const bodyInner =
    rawBody && /<[^>]+>/.test(rawBody) ? syncMdChecklistHtml(rawBody) : noteBodyPreview(rawBody, cardOpts.query || '');
  const bodyHtml = `<div class="note-body">${bodyInner}</div>`;

  let mentionsHtml = '';
  if (note.mentions && note.mentions.length > 0) {
    const mentionUsers = note.mentions.map(id => USERS.find(u => sameId(u.id, id))).filter(Boolean);
    if (mentionUsers.length > 0) {
      mentionsHtml = `<div class="note-mentions" title="Compañeros mencionados en esta nota">${mentionUsers.map(u => 
        `<span class="mention">@${escapeHtml(u.name)}</span>`
      ).join(' ')}</div>`;
    }
  }

  let imagesHtml = '';
  if (note.images && note.images.length > 0) {
    const imgs = note.images
      .slice(0, 3)
      .map(
        img =>
          `<img src="${escapeHtmlAttr(img)}" alt="Nota imagen" onclick="openImageModal(${JSON.stringify(img)})" loading="lazy">`
      )
      .join('');
    const more =
      note.images.length > 3 ? `<span class="more-images">+${note.images.length - 3}</span>` : '';
    imagesHtml = `<div class="note-images">${imgs}${more}</div>`;
  }

  const reminderHtml = note.reminder
    ? `<div class="note-reminder">🔔 ${typeof note.reminder === 'string' ? escapeHtml(note.reminder) : 'Recordatorio activo'}</div>`
    : '';
  let _comments = [];
  try {
    // Acceder via window para evitar problemas de módulo
    _comments = window._appComments || [];
  } catch {}
  const noteComments = _comments.filter(c =>
    c.kind === 'note' && sameId(c.targetId, note.id || note._id)
  );
  const commentCount = noteComments.length;
  const commentBadge = commentCount > 0
    ? `<span class="note-comment-badge">💬 ${commentCount}</span>`
    : '';

  let footerHtml = '<div class="note-footer">';
  footerHtml += reminderHtml;
  footerHtml += commentBadge;
  footerHtml += '<div class="note-actions">';
  if (canEdit) {
    footerHtml += `<button type="button" class="note-action-btn note-action-btn--icon" onclick='toggleNotePinnedQuick(event, ${idLit})' title="${pinned ? 'Quitar fijación' : 'Fijar al inicio del turno'}" aria-label="${pinned ? 'Quitar fijación' : 'Fijar nota'}"><span aria-hidden="true">${pinned ? '📌' : '📍'}</span></button>`;
    footerHtml += `<button type="button" class="note-action-btn note-action-btn--icon" onclick='editNote(event, ${idLit})' title="Editar nota" aria-label="Editar nota"><span aria-hidden="true">✏️</span></button>`;
  }
  if (sameId(note.authorId, currentUser.id)) {
    footerHtml += `<button type="button" class="note-action-btn note-action-btn--icon delete" onclick='deleteNote(event, ${idLit})' title="Borrar nota" aria-label="Borrar nota"><span aria-hidden="true">🗑️</span></button>`;
  }
  footerHtml += '</div></div>';

  const innerHtml = [
    headerHtml,
    `<div class="note-title" data-note-heading="true">${escapeHtml(noteTextForDisplay(note.title) || 'Sin título')}</div>`,
    bodyHtml,
    mentionsHtml,
    imagesHtml,
    footerHtml,
  ].join('');

  const cardClass = [pinned ? 'note-card note-card--pinned' : 'note-card', compact ? 'note-card--compact' : '']
    .filter(Boolean)
    .join(' ');
  return `<div class="${cardClass}" data-id="${note.id}" data-note-id="${note.id}" onclick="openDetail('${note.id}')">${innerHtml}</div>`;
}

/**
 * Create a preview of note body with optional highlighting
 * @param {string} body - Note body
 * @param {string} query - Search query for highlighting
 * @returns {string} HTML preview
 */
export function noteBodyPreview(body, query) {
  if (body == null || body === '' || typeof body === 'boolean') return '<em>Sin contenido</em>';
  const text = typeof body === 'string' ? body : String(body);

  let preview = text.length > 200 ? text.substring(0, 200) + '...' : text;
  preview = escapeHtml(preview);
  preview = preview.replace(/\n/g, '<br>');

  const q = query != null ? String(query).trim() : '';
  if (q) {
    const escapedQ = escapeHtml(q);
    if (escapedQ) {
      try {
        const re = new RegExp(`(${escapeRegExp(escapedQ)})`, 'gi');
        preview = preview.replace(re, '<mark>$1</mark>');
      } catch {
        /* query inválida para RegExp */
      }
    }
  }

  return preview;
}

// ===== MENTIONS VIEW =====

/**
 * Salta al día de la nota en «Todas las notas» y desplaza hasta la tarjeta.
 */
export function goToNoteInDiary(noteId) {
  const note = notes.find(n => sameId(n.id, noteId));
  if (!note || !userCanSeeNote(note)) {
    showToast('No se encontró la nota o no tienes acceso', 'error');
    return;
  }
  setCurrentDate(note.date);
  setCurrentNoteView('all');
  if (typeof window.showView === 'function') window.showView('notes', null);
  const navAll = document.getElementById('nav-all');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (navAll) navAll.classList.add('active');
  const titleEl = document.getElementById('view-title');
  if (titleEl) titleEl.textContent = 'Todas las Notas';
  if (typeof window.renderDateNav === 'function') window.renderDateNav();
  renderNotes();
  const id = note.id;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-note-id="${id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

function formatMentionDateHeading(isoDateStr) {
  const today = toDateStr(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = toDateStr(y);
  if (isoDateStr === today) return 'Hoy';
  if (isoDateStr === yesterday) return 'Ayer';
  const d = new Date(`${isoDateStr}T12:00:00`);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Lista todas las notas (cualquier día) donde el usuario actual está mencionado.
 */
export function renderMentionsView() {
  const area = document.getElementById('notes-area');
  if (!area || !currentUser) return;

  syncNotesViewLayoutMode('mentions');

  const readSet = loadReadMentions();
  const list = notes.filter(
    n =>
      userCanSeeNote(n) &&
      (n.mentions || []).some(mid => sameId(mid, currentUser.id))
  );
  list.sort((a, b) => {
    const dc = (b.date || '').localeCompare(a.date || '');
    if (dc !== 0) return dc;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  const unreadCount = list.filter(n => !readSet.has(n.id)).length;

  if (list.length === 0) {
    area.innerHTML = `
      <div class="notes-empty-state notes-empty-state--mentions">
        <div class="notes-empty-icon">👋</div>
        <div class="notes-empty-title">Aún no te han mencionado</div>
        <p class="notes-empty-hint">Cuando alguien te incluya con @ en una nota de tu departamento o en una nota pública que puedas ver, aparecerá aquí. El punto en el calendario marcará días con menciones sin leer.</p>
        <div class="notes-empty-actions">
          <button type="button" class="btn-action" onclick="setNoteView('all', document.getElementById('nav-all'))">📋 Ir a todas las notas</button>
        </div>
      </div>`;
    syncNoteTagFilterTopbar();
    return;
  }

  const dates = [...new Set(list.map(n => n.date))];
  const groupsHtml = dates
    .map(dateStr => {
      const groupNotes = list.filter(n => n.date === dateStr);
      const rows = groupNotes
        .map(n => {
          const unread = !readSet.has(n.id);
          const author = USERS.find(u => sameId(u.id, n.authorId));
          const shift = SHIFTS[n.shift] || SHIFTS.morning;
          const bg = escapeHtmlAttr(author?.color || '#888');
          const initials = escapeHtml(author?.initials || '?');
          const authorName = escapeHtml(author ? author.name : 'Usuario');
          const title = escapeHtml(noteTextForDisplay(n.title) || 'Sin título');
          const plainBody = noteTextForDisplay(n.body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const sn = plainBody.length > 140 ? `${plainBody.slice(0, 140)}…` : plainBody;
          const snippetHtml = sn ? escapeHtml(sn) : '';
          const unreadClass = unread ? 'mention-inbox-row--unread' : 'mention-read';
          const indClass = unread ? 'unread' : '';
          const indText = unread ? 'Sin leer' : '✓ Leída';
          return `
        <article class="mention-inbox-row ${unreadClass}" data-note-id="${n.id}" role="button" tabindex="0"
          onclick="openDetail('${n.id}')"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail('${n.id}');}">
          <span class="mention-read-dot" style="background:${unread ? 'var(--accent)' : 'var(--success)'}"></span>
          <div class="mention-inbox-main">
            <div class="mention-inbox-top">
              <span class="mention-inbox-author"><span class="mention-inbox-av" style="background:${bg}">${initials}</span>${authorName}</span>
              <span class="note-tag note-tag-shift">${shift.emoji} ${shift.label}</span>
              <span class="mention-read-indicator ${indClass}">${indText}</span>
            </div>
            <div class="mention-inbox-title">${title}</div>
            <div class="mention-inbox-snippet">${snippetHtml || '<em class="mention-inbox-muted">Sin vista previa</em>'}</div>
          </div>
          <div class="mention-inbox-actions">
            <button type="button" class="btn-secondary btn-sm" onclick="event.stopPropagation();goToNoteInDiary('${n.id}')">📅 Ver en diario</button>
          </div>
        </article>`;
        })
        .join('');
      return `
      <section class="mention-date-group">
        <h3 class="mention-date-heading">${escapeHtml(formatMentionDateHeading(dateStr))}</h3>
        <p class="mention-date-sub">${escapeHtml(dateStr)}</p>
        <div class="mention-inbox-list">${rows}</div>
      </section>`;
    })
    .join('');

  area.innerHTML = `
    <div class="mentions-view-wrap">
      <header class="mentions-view-header">
        <div>
          <h2 class="mentions-view-title">Menciones a ti</h2>
          <p class="mentions-view-lead">${list.length} nota${list.length !== 1 ? 's' : ''}${unreadCount ? ` · <strong>${unreadCount}</strong> sin leer` : ' · todas leídas'}. Clic en una fila abre el detalle y marca como leída.</p>
        </div>
        <button type="button" class="btn-secondary" onclick="markAllNoteMentionsAsRead()">Marcar todas leídas</button>
      </header>
      ${groupsHtml}
    </div>`;
  syncNoteTagFilterTopbar();
}

/** Handlers del modal de nota (onclick en index.html) */
export function selectShiftOpt(el) {
  document.querySelectorAll('#note-modal .shift-option').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  setSelectedShift(el.dataset.shift);
  syncNoteModalSaveButtonState();
}

export function selectPriority(el) {
  document.querySelectorAll('#note-modal .priority-opt').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  setSelectedPriority(el.dataset.priority);
  syncNoteModalSaveButtonState();
}

export function selectVisibility(el) {
  const p = el.closest('.visibility-pills');
  if (p) {
    p.querySelectorAll('.visibility-opt').forEach(o => {
      o.classList.remove('selected');
      o.setAttribute('aria-pressed', 'false');
    });
  }
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  setSelectedNoteVisibility(el.dataset.vis || 'department');
  syncNoteModalSaveButtonState();
}

export function toggleReminder() {
  const next = !reminderOn;
  setReminderOn(next);
  const el = document.getElementById('reminder-toggle');
  if (el) {
    el.classList.toggle('on', next);
    el.setAttribute('aria-checked', next ? 'true' : 'false');
  }
  const rt = document.getElementById('reminder-time');
  rt?.classList.toggle('hidden', !next);
  if (!next) rt?.classList.remove('reminder-time-input--error');
  syncReminderSummaryLine();
  if (next) {
    setTimeout(() => rt?.focus?.(), 60);
  }
  syncNoteModalSaveButtonState();
}

/** Sincroniza el texto de estado bajo el interruptor de recordatorio (modal nota). */
export function syncReminderSummaryFromInput() {
  syncReminderSummaryLine();
}

function syncReminderSummaryLine() {
  const el = document.getElementById('note-reminder-summary');
  if (!el) return;
  const rt = document.getElementById('reminder-toggle');
  const on = rt ? rt.classList.contains('on') : reminderOn;
  const time = document.getElementById('reminder-time')?.value?.trim() || '';
  if (!on) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  let dlab = currentDate || '';
  try {
    dlab = new Date(`${currentDate}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    /* ignore */
  }
  el.textContent = time
    ? `Recordatorio el ${dlab} a las ${time}.`
    : `Recordatorio activo: elige una hora para que quede programado.`;
  const rtInput = document.getElementById('reminder-time');
  if (on && time) rtInput?.classList.remove('reminder-time-input--error');
}

export function toggleNotePinnedModal() {
  const el = document.getElementById('note-pinned-toggle');
  if (!el) return;
  el.classList.toggle('on');
  el.setAttribute('aria-checked', el.classList.contains('on') ? 'true' : 'false');
  syncNoteModalSaveButtonState();
}

// ===== PUBLIC NOTES =====

/**
 * Render public notes
 */
export function renderPublicNotes() {
  const area = document.getElementById('public-notes-area');
  if (!area) return;

  const publicNotes = notes.filter(n => n.visibility === 'public' && userCanSeeNote(n));

  if (publicNotes.length === 0) {
    area.innerHTML = `
      <div class="notes-empty-state">
        <div class="notes-empty-icon">🌐</div>
        <div class="notes-empty-title">Sin notas públicas</div>
        <p class="notes-empty-hint">Las notas marcadas como públicas por tu departamento aparecerán aquí.</p>
      </div>`;
    return;
  }

  publicNotes.sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '');
    if (d !== 0) return d;
    const order = { morning: 0, afternoon: 1, night: 2 };
    const sa = order[a.shift] ?? 9;
    const sb = order[b.shift] ?? 9;
    if (sa !== sb) return sa - sb;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  if (!window._publicNotesLimits) window._publicNotesLimits = {};

  const dates = [...new Set(publicNotes.map(n => n.date))];

  area.innerHTML = `<div class="notes-history-wrap">${dates.map(ds => {
    const chunk = publicNotes.filter(n => n.date === ds);
    const sectionKey = ds;
    const limit = window._publicNotesLimits[sectionKey] != null
      ? window._publicNotesLimits[sectionKey]
      : PUBLIC_NOTES_PER_GROUP_INITIAL;
    const visible = chunk.slice(0, limit);
    const hasMore = chunk.length > limit;

    const today = toDateStr(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = toDateStr(y);
    const label = ds === today ? 'Hoy'
      : ds === yesterday ? 'Ayer'
      : new Date(`${ds}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const cardsHtml = visible.map(n => renderNoteCard(n, {})).join('');
    const moreBtn = hasMore
      ? `<div style="text-align:center;padding:12px 0">
           <button type="button" class="btn-secondary" onclick="loadMorePublicNotes('${sectionKey}')">
             Cargar más (${chunk.length - limit} restantes)
           </button>
         </div>`
      : '';

    return `<section class="notes-history-block">
      <h3 class="notes-history-heading">${label} <span class="notes-history-iso">${ds}</span></h3>
      <div class="notes-history-cards">${cardsHtml}</div>
      ${moreBtn}
    </section>`;
  }).join('')}</div>`;
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
  setSelectedNoteVisibility('department');
  setEditingNoteImages({});
  setReminderOn(false);
  const tagsInput = document.getElementById('note-tags-input');
  if (tagsInput) tagsInput.value = '';

  fillCollabTargetSelect('note-collab-target-select');
  const ncts = document.getElementById('note-collab-target-select');
  const ncps = document.getElementById('note-collab-permission-select');
  if (ncts) ncts.value = '_none';
  if (ncps) ncps.value = 'read';

  const mentionsArea = document.getElementById('mentions-area');
  if (mentionsArea) mentionsArea.innerHTML = '';

  setTimeout(() => {
    if (typeof setSelectedMentionGroup === 'function') setSelectedMentionGroup(null);
    if (typeof renderMentionChips === 'function') renderMentionChips();
  }, 50);

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

  tryRestoreNoteDraft();
  updateNoteModalUI();
  refreshNoteTagsChipsFromInput();
  syncNoteTagsDatalist();
  switchNoteModalTab('content');
  createCustomSelect('note-collab-target-select');
  createCustomSelect('note-collab-permission-select');
  attachNoteModalHotkeys();
  snapshotNoteModalBaseline();
}

/**
 * Edit existing note
 * @param {Event} e - Click event
 * @param {number} id - Note ID
 */
export function editNote(e, id) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  const note = notes.find(n => sameId(n.id, id));
  if (!note || !userCanEditNote(note)) return;

  clearNoteDraft();

  // Set editing state
  setEditingNoteId(id);
  setSelectedShift(note.shift);
  setSelectedPriority(note.priority || 'normal');
  setSelectedMentions(note.mentions || []);
  setEditingNoteImages(note.images || []);
  const hasReminder =
    (typeof note.reminder === 'string' && note.reminder.length > 0) ||
    note.reminder === true ||
    (note.reminderTime != null && String(note.reminderTime).length > 0);
  setReminderOn(hasReminder);
  setSelectedNoteVisibility(
    note.visibility === 'public' ? 'public' : note.visibility === 'department' ? 'department' : 'private'
  );

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

  setTimeout(() => {
    if (typeof setSelectedMentionGroup === 'function') setSelectedMentionGroup(null);
    if (typeof renderMentionChips === 'function') renderMentionChips();
  }, 50);

  openModal('note-modal');
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = 'Editar Nota';
  const ti = document.getElementById('note-title-input');
  const be = document.getElementById('note-body-editor');
  const bi = document.getElementById('note-body-input');
  if (ti) ti.value = note.title || '';
  if (be) {
    be.innerHTML =
      note.body && /<[^>]+>/.test(note.body)
        ? syncMdChecklistHtml(note.body)
        : renderMarkdown(note.body || '', editingNoteImages);
  }
  if (bi) bi.value = note.body || '';
  const preview = document.getElementById('note-content-preview');
  if (preview) preview.innerHTML = renderMarkdown(note.body || '', editingNoteImages);
  const rtime = document.getElementById('reminder-time');
  if (rtime) {
    if (typeof note.reminder === 'string' && note.reminder) rtime.value = note.reminder;
    else rtime.value = (note.reminderTime && String(note.reminderTime)) || '07:00';
  }
  bindNoteEditorInteractions();

  updateNoteModalUI();
  const tagsInputEl = document.getElementById('note-tags-input');
  if (tagsInputEl) tagsInputEl.value = (note.tags || []).join(' ');
  createCustomSelect('note-collab-target-select');
  createCustomSelect('note-collab-permission-select');
  refreshNoteTagsChipsFromInput();
  syncNoteTagsDatalist();
  switchNoteModalTab('content');
  attachNoteModalHotkeys();
  snapshotNoteModalBaseline();
}

/**
 * Save note from modal
 */
export async function saveNote() {
  const saveBtn = document.getElementById('note-modal-save-btn');
  if (saveBtn?.disabled) return;

  const title = document.getElementById('note-title-input')?.value.trim() || '';
  const noteEditor = document.getElementById('note-body-editor');
  if (noteEditor) syncMdChecklistDom(noteEditor, true);
  syncNoteEditorToTextarea('html');
  const body = document.getElementById('note-body-input')?.value.trim() || '';
  if (!title) {
    showToast('Falta el título: escribe un título breve arriba.', 'error');
    switchNoteModalTab('content');
    const tiEl = document.getElementById('note-title-input');
    tiEl?.classList.add('note-input--error');
    setTimeout(() => tiEl?.classList.remove('note-input--error'), 2400);
    tiEl?.focus?.();
    return;
  }
  document.getElementById('note-title-input')?.classList.remove('note-input--error');
  if (!body) {
    showToast('Falta el contenido: escribe el cuerpo de la nota en el editor.', 'error');
    switchNoteModalTab('content');
    document.getElementById('note-body-editor')?.focus?.();
    return;
  }
  if (!selectedShift) {
    showToast('Selecciona un turno destino', 'error');
    switchNoteModalTab('options');
    return;
  }

  const reminderTimeValPre = document.getElementById('reminder-time')?.value?.trim() || '';
  const rtInput = document.getElementById('reminder-time');
  if (reminderOn && !reminderTimeValPre) {
    showToast('Selecciona una hora para el recordatorio o desactívalo', 'error');
    switchNoteModalTab('options');
    rtInput?.classList.add('reminder-time-input--error');
    syncReminderSummaryLine();
    rtInput?.classList.remove('hidden');
    rtInput?.focus?.();
    return;
  }
  rtInput?.classList.remove('reminder-time-input--error');

  if (saveBtn) {
    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;
  }

  const reminderTimeVal = document.getElementById('reminder-time')?.value?.trim() || '';
  const reminder = reminderOn ? (reminderTimeVal || null) : null;
  const existingImages = editingNoteId ? notes.find(n => sameId(n.id, editingNoteId))?.images || {} : {};
  const images = collectImageMap(body, { ...existingImages, ...editingNoteImages });
  const vis =
    selectedNoteVisibility === 'public'
      ? 'public'
      : selectedNoteVisibility === 'department'
        ? 'department'
        : 'private';
  const addSh = buildSharesFromCollabSelect('note-collab-target-select', 'note-collab-permission-select');
  const tagsRaw = document.getElementById('note-tags-input')?.value || '';
  const tags = tagsRaw.match(/#[\w\u00C0-\u017F]+/gi)?.map(t => t.toLowerCase()) || [];
  const pinned = document.getElementById('note-pinned-toggle')?.classList.contains('on') || false;
  const wasEditing = editingNoteId != null;

  if (editingNoteId) {
    const idx = notes.findIndex(n => sameId(n.id, editingNoteId) && userCanEditNote(n));
    if (idx === -1) {
      showToast('No autorizado para editar esta nota', 'error');
      if (saveBtn) {
        saveBtn.classList.remove('is-loading');
        saveBtn.disabled = false;
      }
      syncNoteModalSaveButtonState();
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
      reminder,
      images,
      visibility: vis,
      pinned,
      tags,
      shares: [...rest, ...addSh],
    };
    delete updated.reminderTime;
    try {
      const mongoId = prev._id || prev.id;
      const saved = await apiUpdateNote(mongoId, updated);
    } catch (err) {
      console.error('Error actualizando nota en API:', err);
      showToast('Error al guardar en servidor', 'error');
      if (saveBtn) {
        saveBtn.classList.remove('is-loading');
        saveBtn.disabled = false;
      }
      syncNoteModalSaveButtonState();
      return;
    }
    setNotes(notes.map((n, i) => (i === idx ? updated : n)));
    showToast('Nota actualizada', 'success');
    playNotesSaveChime();
    bumpNotesMetric('note_save_update');
  } else {
    const newNote = {
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
      reminder,
      createdAt: new Date().toISOString(),
      images,
      visibility: vis,
      pinned,
      tags,
      shares: addSh,
    };
    try {
      const saved = await apiCreateNote({
        authorId: currentUser.id,
        authorName: currentUser.name,
        title,
        body,
        shift: selectedShift,
        priority: selectedPriority,
        mentions: selectedMentions,
        mentionGroup: selectedMentionGroup,
        reminder,
        images,
        visibility: vis,
        pinned,
        tags,
        shares: addSh,
        date: currentDate,
        group: currentUser.group,
        department: currentUser.group,
      });
      newNote.authorId = saved.authorId || newNote.authorId;
      newNote._id = saved._id;
      newNote.id = saved._id || newNote.id;
    } catch (err) {
      console.error('Error creando nota en API:', err);
      showToast('Error al guardar en servidor', 'error');
      if (saveBtn) {
        saveBtn.classList.remove('is-loading');
        saveBtn.disabled = false;
      }
      syncNoteModalSaveButtonState();
      return;
    }
    setNotes([
      ...notes,
      newNote,
    ]);
    showToast('Nota creada', 'success');
    playNotesSaveChime();
    bumpNotesMetric('note_save_create');
  }

  try {
    saveData();
    renderNotes();
    announceNotes(wasEditing ? 'Nota actualizada en la lista' : 'Nota guardada en la lista');
    clearNoteDraft();
    window._noteModalBaseline = null;
    const _nti = document.getElementById('note-title-input');
    const _nbi = document.getElementById('note-body-input');
    const _nbe = document.getElementById('note-body-editor');
    const _npr = document.getElementById('note-content-preview');
    if (_nti) _nti.value = '';
    if (_nbi) _nbi.value = '';
    if (_nbe) _nbe.innerHTML = '';
    if (_npr) _npr.innerHTML = '';
    closeModal('note-modal');
    import('./login.js').then(m => m.updateBadges());
  } finally {
    if (saveBtn) {
      saveBtn.classList.remove('is-loading');
    }
    syncNoteModalSaveButtonState();
  }
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
  if (source && /<[^>]+>/.test(source)) syncMdChecklistDom(editor, false);
  cleanupLeadingEmptyNodes(editor);
}

const NOTE_PASTE_IMAGE_MAX_DIM = 1920;
const NOTE_PASTE_JPEG_QUALITY = 0.82;

function compressImageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const maxD = NOTE_PASTE_IMAGE_MAX_DIM;
        if (w > maxD || h > maxD) {
          const r = Math.min(maxD / w, maxD / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('ctx'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', NOTE_PASTE_JPEG_QUALITY);
        URL.revokeObjectURL(url);
        resolve(out);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load'));
    };
    img.src = url;
  });
}

export function handleNoteEditorInput() {
  syncNoteEditorToTextarea();
  updateMarkdownPreview('note-body-input', 'note-content-preview', editingNoteImages);
  handleSlashFromNoteEditor();
  const editor = document.getElementById('note-body-editor');
  scrollNoteEditorCaretIntoView(editor);
  scheduleNoteDraftSave();
  syncNoteModalSaveButtonState();
}

function bindNoteEditorInteractions() {
  const editor = document.getElementById('note-body-editor');
  if (!editor || editor.dataset.wysiwygBound === '1') return;
  editor.dataset.wysiwygBound = '1';
  editor.addEventListener('paste', function(e) {
    const cd = e.clipboardData || window.clipboardData;
    if (cd && cd.items && cd.items.length) {
      for (let i = 0; i < cd.items.length; i++) {
        const it = cd.items[i];
        if (it.kind === 'file' && it.type && it.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = it.getAsFile();
          const MAX_BYTES = 5 * 1024 * 1024;
          if (!file || file.size > MAX_BYTES) {
            showToast('Imagen demasiado grande (máx. 5 MB al pegar)', 'error');
            return;
          }
          const finishPaste = dataUrl => {
            if (typeof dataUrl !== 'string') return;
            if (dataUrl.length > 4 * 1024 * 1024) {
              showToast('La imagen sigue siendo muy grande tras comprimir; prueba otra más pequeña.', 'error');
              return;
            }
            const key = makeImageKey();
            registerTempImage(key, dataUrl);
            editingNoteImages[key] = dataUrl;
            const textarea = document.getElementById('note-body-input');
            if (!textarea) return;
            const cursorPos = textarea.selectionStart;
            const altText = 'Imagen';
            const insert = `![${altText}](${key})`;
            textarea.value =
              textarea.value.substring(0, cursorPos) + insert + textarea.value.substring(cursorPos);
            textarea.focus();
            const np = cursorPos + insert.length;
            textarea.setSelectionRange(np, np);
            syncNoteTextareaToEditor();
            updateMarkdownPreview('note-body-input', 'note-content-preview', editingNoteImages);
            handleNoteEditorInput();
            showToast('Imagen pegada (comprimida al insertar)', 'success');
          };
          compressImageFileToDataUrl(file)
            .then(finishPaste)
            .catch(() => {
              const reader = new FileReader();
              reader.onload = function(ev) {
                const r = ev.target && ev.target.result;
                if (typeof r === 'string') finishPaste(r);
                else showToast('No se pudo procesar la imagen pegada', 'error');
              };
              reader.readAsDataURL(file);
            });
          return;
        }
      }
    }
    e.preventDefault();
    const text = cd ? cd.getData('text/plain') : '';
    document.execCommand('insertText', false, text);
  });
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

/** Caret al final del último hijo directo del editor (p. ej. tras insertar bloques vía slash). */
function placeCaretAtEndOfLastChild(editor) {
  if (!editor) return;
  const sel = window.getSelection();
  if (!sel) return;
  let last = editor.lastChild;
  while (
    last &&
    last.nodeType !== Node.ELEMENT_NODE &&
    last.nodeType !== Node.TEXT_NODE
  ) {
    last = last.previousSibling;
  }
  const range = document.createRange();
  if (!last) {
    range.setStart(editor, 0);
    range.collapse(true);
  } else if (last.nodeType === Node.TEXT_NODE) {
    range.setStart(last, (last.nodeValue || '').length);
    range.collapse(true);
  } else if (last.nodeName === 'BR') {
    range.setStartAfter(last);
    range.collapse(true);
  } else {
    range.selectNodeContents(last);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
  if (typeof editor.focus === 'function') {
    try {
      editor.focus({ preventScroll: true });
    } catch {
      editor.focus();
    }
  }
}

/** Caret justo después del subárbol `root` (último bloque insertado), no al final del editor. */
function placeCaretAtEndOfSubtree(root) {
  if (!root) return;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const voidTags = new Set(['HR', 'IMG', 'BR', 'INPUT']);
  if (root.nodeType === Node.TEXT_NODE) {
    range.setStart(root, (root.nodeValue || '').length);
    range.collapse(true);
  } else if (root.nodeType === Node.ELEMENT_NODE) {
    if (voidTags.has(root.nodeName) || root.childNodes.length === 0) {
      range.setStartAfter(root);
      range.collapse(true);
    } else {
      range.selectNodeContents(root);
      range.collapse(false);
    }
  } else {
    range.setStartAfter(root);
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Primer rango colapsado en texto editable dentro de los nodos insertados (p. ej. "Tarea 1", título de heading).
 */
function findFirstEditableTextRangeInRoots(rootNodes) {
  if (!rootNodes || !rootNodes.length) return null;
  for (const root of rootNodes) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const parentEl =
        textNode.parentElement && textNode.parentElement.closest
          ? textNode.parentElement
          : null;
      if (!parentEl) continue;
      const tag = parentEl.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      if (parentEl.closest && parentEl.closest('input, textarea, select')) continue;
      const val = textNode.nodeValue || '';
      let off = 0;
      while (off < val.length && /[\s\u00a0]/.test(val[off])) off++;
      if (off < val.length) {
        const range = document.createRange();
        range.setStart(textNode, off);
        range.collapse(true);
        return range;
      }
    }
  }
  const first = rootNodes[0];
  if (!first) return null;
  const range = document.createRange();
  if (first.nodeType === Node.TEXT_NODE) {
    range.setStart(first, 0);
    range.collapse(true);
    return range;
  }
  if (first.nodeType === Node.ELEMENT_NODE) {
    range.setStart(first, 0);
    range.collapse(true);
    return range;
  }
  return null;
}

function placeCaretAtFirstEditableTextInInsertedBlocks(editor, insertedRoots) {
  const sel = window.getSelection();
  if (!sel || !editor) return;
  const stillThere = (insertedRoots || []).filter(n => n && editor.contains(n));
  if (!stillThere.length) {
    placeCaretAtEndOfLastChild(editor);
  } else {
    const r = findFirstEditableTextRangeInRoots(stillThere);
    if (r) {
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      placeCaretAtEndOfSubtree(stillThere[stillThere.length - 1]);
    }
  }
  if (typeof editor.focus === 'function') {
    try {
      editor.focus({ preventScroll: true });
    } catch {
      editor.focus();
    }
  }
}

/**
 * Tras insertar HTML desde el menú /: coloca el caret al inicio del texto del bloque nuevo y ajusta scroll.
 * Si `insertedRoots` es null (p. ej. imagen), conserva scroll al fondo y caret al final.
 */
function scrollNoteEditorAfterSlashInsertLayout(editor, insertedRoots) {
  if (!editor) return;
  setTimeout(() => {
    const ed = document.getElementById('note-body-editor');
    if (!ed) return;
    if (insertedRoots && insertedRoots.length) {
      placeCaretAtFirstEditableTextInInsertedBlocks(ed, insertedRoots);
    } else {
      ed.scrollTop = ed.scrollHeight;
      placeCaretAtEndOfLastChild(ed);
    }
    scrollNoteEditorCaretIntoView(ed);
  }, 0);
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
  const section = header && header.closest('.shift-section');
  const body = header && header.nextElementSibling;
  const shiftKey = section?.dataset?.shift;
  if (body) body.classList.toggle('collapsed');
  if (section) section.classList.toggle('shift-section--collapsed', body?.classList.contains('collapsed'));
  const arrow = header && header.querySelector('.shift-toggle');
  if (arrow) arrow.classList.toggle('open', body && !body.classList.contains('collapsed'));
  if (shiftKey && currentDate) {
    try {
      const k = `diario_notes_shift_collapsed:${currentDate}:${shiftKey}`;
      if (body?.classList.contains('collapsed')) localStorage.setItem(k, '1');
      else localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export function deleteNote(e, id) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  const note = notes.find(n => sameId(n.id, id));
  if (!note || !sameId(note.authorId, currentUser.id)) {
    showToast('No autorizado para eliminar esta nota','error');
    return;
  }
  showConfirmModal({
    icon: '📋',
    title: '¿Eliminar esta nota?',
    message: `Se eliminará "${note.title}" y todos sus comentarios.`,
    onConfirm: async () => {
      try {
        await apiDeleteNote(id);
        setNotes(notes.filter(n => !sameId(n.id, id)));
        saveData();
        renderNotes();
        import('./login.js').then(m => m.updateBadges());
        showToast('Nota eliminada','info');
      } catch (err) {
        console.error('Error eliminando nota:', err);
        showToast('No se pudo eliminar la nota','error');
      }
    }
  });
}

function performDuplicateNote(note, dateMode, closeEvent) {
  const titleBase = (noteTextForDisplay(note.title) || 'Nota').trim();
  const vis =
    note.visibility === 'public' ? 'public' : note.visibility === 'private' ? 'private' : 'department';
  let sharesCopy = [];
  try {
    sharesCopy = JSON.parse(JSON.stringify(note.shares || []));
  } catch {
    sharesCopy = [...(note.shares || [])];
  }
  const dateDest =
    dateMode === 'original' && note.date ? note.date : currentDate;
  const newNote = {
    id: Date.now(),
    authorId: currentUser.id,
    group: currentUser.group,
    date: dateDest,
    shift: note.shift || 'morning',
    title: `${titleBase} (copia)`,
    body: noteTextForDisplay(note.body),
    priority: note.priority || 'normal',
    mentions: [...(note.mentions || [])],
    mentionGroup: note.mentionGroup,
    reminder: null,
    createdAt: new Date().toISOString(),
    images: { ...(note.images || {}) },
    visibility: vis,
    shares: sharesCopy,
    pinned: false,
  };
  setNotes([...notes, newNote]);
  saveData();
  renderNotes();
  const where =
    dateDest === note.date ? 'misma fecha que el original' : 'fecha del diario seleccionada';
  showToast(`Copia creada (${where}). Es tu nota; revisa visibilidad si hace falta.`, 'success');
  bumpNotesMetric('note_duplicate');
  try {
    if (closeEvent && closeEvent.target && typeof closeEvent.target.closest === 'function') {
      const det = closeEvent.target.closest('details.note-card-kebab');
      if (det) det.open = false;
    }
  } catch {
    /* ignore */
  }
}

export function duplicateNote(e, id, dateMode = 'diary') {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  const note = notes.find(n => sameId(n.id, id));
  if (!note || !userCanSeeNote(note)) {
    showToast('No se puede duplicar esta nota', 'error');
    return;
  }
  const bodyStr = noteTextForDisplay(note.body) || '';
  const imgCount = Array.isArray(note.images)
    ? note.images.length
    : note.images && typeof note.images === 'object'
      ? Object.keys(note.images).length
      : 0;
  const heavy = bodyStr.length > 12000 || imgCount > 4;
  if (heavy) {
    showConfirmModal({
      icon: '📋',
      title: '¿Duplicar esta nota?',
      message:
        'La nota es grande o tiene varias imágenes. Duplicar puede tardar un momento y ocupará más espacio. ¿Continuar?',
      onConfirm: () => performDuplicateNote(note, dateMode, e),
    });
    return;
  }
  performDuplicateNote(note, dateMode, e);
}

export function toggleNotePinnedQuick(e, id) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  const note = notes.find(n => sameId(n.id, id));
  if (!note || !userCanEditNote(note)) return;
  const next = !note.pinned;
  setNotes(notes.map(n => (sameId(n.id, id) ? { ...n, pinned: next } : n)));
  saveData();
  renderNotes();
  showToast(next ? 'Nota fijada al inicio del turno' : 'Fijación quitada', 'info');
}

export function openImageModal(src) {
  if (src) window.open(src, '_blank', 'noopener,noreferrer');
}

function noteTemplatesStorageKey() {
  return currentUser ? `diario_note_templates_${currentUser.id}` : 'diario_note_templates';
}

function loadNoteTemplatesList() {
  try {
    const raw = localStorage.getItem(noteTemplatesStorageKey());
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Vista previa de plantilla: texto plano truncado (HTML del cuerpo). */
function noteTemplateBodyPreview(html, maxLen = 140) {
  if (!html) return '';
  const t = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t.length) return '';
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function persistNoteTemplatesList(list) {
  localStorage.setItem(noteTemplatesStorageKey(), JSON.stringify(list));
}

function renderNoteTemplatesListBody() {
  const el = document.getElementById('note-templates-list-body');
  if (!el) return;
  const list = loadNoteTemplatesList();
  if (!list.length) {
    el.innerHTML =
      '<p class="modal-note-templates-empty">No hay plantillas aún. Abre una nota y pulsa <strong>Guardar como plantilla</strong> en el pie del formulario.</p>';
    return;
  }
  el.innerHTML = list
    .map(
      t => `
    <div class="note-template-row">
      <div class="note-template-row-info">
        <strong>${escapeHtml(t.name || 'Sin nombre')}</strong>
        <span class="note-template-row-title">${escapeHtml((t.title || '').slice(0, 80))}${(t.title || '').length > 80 ? '…' : ''}</span>
        <span class="note-template-row-preview">${escapeHtml(noteTemplateBodyPreview(t.body))}</span>
      </div>
      <div class="note-template-row-actions">
        <button type="button" class="btn-primary btn-sm" onclick="applyNoteTemplate('${t.id}')">Usar</button>
        <button type="button" class="btn-secondary btn-sm" onclick="deleteNoteTemplate('${t.id}')">Eliminar</button>
      </div>
    </div>`
    )
    .join('');
}

export function openNoteTemplatesModal() {
  bumpNotesMetric('note_templates_modal_open');
  renderNoteTemplatesListBody();
  openModal('note-templates-modal');
}

export function saveNoteAsTemplate() {
  const title = document.getElementById('note-title-input')?.value.trim() || '';
  const noteEditor = document.getElementById('note-body-editor');
  if (noteEditor) syncMdChecklistDom(noteEditor, true);
  syncNoteEditorToTextarea('html');
  const body = document.getElementById('note-body-input')?.value.trim() || '';
  if (!title || !body) {
    showToast('Necesitas título y contenido para guardar una plantilla', 'error');
    return;
  }
  const name = prompt('Nombre de la plantilla', title.slice(0, 48));
  if (!name || !String(name).trim()) return;
  const list = loadNoteTemplatesList();
  list.push({
    id: Date.now(),
    name: String(name).trim(),
    title,
    body,
    shift: selectedShift || 'morning',
    priority: selectedPriority || 'normal',
    visibility: selectedNoteVisibility || 'department',
    savedAt: new Date().toISOString(),
  });
  persistNoteTemplatesList(list);
  showToast('Plantilla guardada', 'success');
  bumpNotesMetric('note_template_save');
  renderNoteTemplatesListBody();
}

export function applyNoteTemplate(templateId) {
  const list = loadNoteTemplatesList();
  const t = list.find(x => sameId(x.id, templateId));
  if (!t) {
    showToast('Plantilla no encontrada', 'error');
    return;
  }
  bumpNotesMetric('note_template_apply');
  closeModal('note-templates-modal');
  openNewNoteModal();
  setTimeout(() => {
    setSelectedShift(t.shift || 'morning');
    setSelectedPriority(t.priority || 'normal');
    setSelectedNoteVisibility(
      t.visibility === 'public' ? 'public' : t.visibility === 'private' ? 'private' : 'department'
    );
    setEditingNoteImages({});
    const ti = document.getElementById('note-title-input');
    if (ti) ti.value = t.title || '';
    const bodyStr = t.body || '';
    const be = document.getElementById('note-body-editor');
    const bi = document.getElementById('note-body-input');
    if (be) {
      be.innerHTML =
        bodyStr && /<[^>]+>/.test(bodyStr) ? syncMdChecklistHtml(bodyStr) : renderMarkdown(bodyStr, {});
    }
    if (bi) bi.value = bodyStr;
    const preview = document.getElementById('note-content-preview');
    if (preview) preview.innerHTML = renderMarkdown(bodyStr, {});
    bindNoteEditorInteractions();
    updateNoteModalUI();
    refreshNoteTagsChipsFromInput();
    snapshotNoteModalBaseline();
  }, 80);
}

export function deleteNoteTemplate(templateId) {
  const list = loadNoteTemplatesList().filter(x => !sameId(x.id, templateId));
  persistNoteTemplatesList(list);
  renderNoteTemplatesListBody();
  showToast('Plantilla eliminada', 'info');
}

function updateNoteModalUI() {
  const shift = selectedShift || 'morning';
  document.querySelectorAll('#note-modal .shift-option').forEach(o => {
    const sel = o.dataset.shift === shift;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-pressed', sel ? 'true' : 'false');
  });
  const pri = selectedPriority || 'normal';
  document.querySelectorAll('#note-modal .priority-opt').forEach(o => {
    const sel = o.dataset.priority === pri;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-pressed', sel ? 'true' : 'false');
  });
  const vis =
    selectedNoteVisibility === 'public'
      ? 'public'
      : selectedNoteVisibility === 'department'
        ? 'department'
        : 'private';
  const vp = document.getElementById('note-visibility-pills');
  if (vp) {
    vp.querySelectorAll('.visibility-opt').forEach(o => {
      const sel = o.dataset.vis === vis;
      o.classList.toggle('selected', sel);
      o.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
  }
  const rt = document.getElementById('reminder-toggle');
  if (rt) {
    rt.classList.toggle('on', reminderOn);
    rt.setAttribute('aria-checked', reminderOn ? 'true' : 'false');
  }
  document.getElementById('reminder-time')?.classList.toggle('hidden', !reminderOn);
  const editing = editingNoteId != null ? notes.find(n => sameId(n.id, editingNoteId)) : null;
  const pt = document.getElementById('note-pinned-toggle');
  if (pt) {
    const pinOn = !!(editing && editing.pinned);
    pt.classList.toggle('on', pinOn);
    pt.setAttribute('aria-checked', pinOn ? 'true' : 'false');
  }
  syncReminderSummaryLine();
  syncNoteModalSaveButtonState();
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
      out.push(`<img src="${url}" alt="${imgMatch[1]}" class="md-img" loading="lazy" decoding="async">`);
      i++; continue;
    }

    // ── Línea en blanco (sin marcador HTML; el espaciado va por CSS en .note-body > *) ──
    if (line.trim() === '') { i++; continue; }

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
      return `<img src="${resolved}" alt="${alt}" class="md-img" loading="lazy" decoding="async">`;
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
 * En el editor de notas (contenteditable) inserta HTML renderizado; en textareas planas, markdown.
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
      scrollNoteEditorAfterSlashInsertLayout(editor, null);
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
      const z = '\u200b';
      const header = `| ${Array.from({ length: cols }, () => z).join(' | ')} |`;
      const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
      const bodyRows = Array.from(
        { length: rows },
        () => `| ${Array.from({ length: cols }, () => z).join(' | ')} |`
      );
      insertTextHtml = renderMarkdown(`${header}\n${separator}\n${bodyRows.join('\n')}\n`, editingNoteImages);
    } else {
      let insertText = '';
      switch (cmd) {
        case 'lista': insertText = '- \u200b\n'; break;
        case 'check': insertText = '- [ ] \u200b\n'; break;
        case 'divisor': insertText = '---\n'; break;
        case 'estilo-parrafo': insertText = '\u200b\n'; break;
        case 'estilo-h1': insertText = '# \u200b\n\n'; break;
        case 'estilo-h2': insertText = '## \u200b\n\n'; break;
        case 'estilo-h3': insertText = '### \u200b\n\n'; break;
        case 'estilo-h4': insertText = '#### \u200b\n\n'; break;
        case 'estilo-tc1': insertText = '<details class="md-details md-tc1"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
        case 'estilo-tc2': insertText = '<details class="md-details md-tc2"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
        case 'estilo-tc3': insertText = '<details class="md-details md-tc3"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
        case 'estilo-tc4': insertText = '<details class="md-details md-tc4"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
        case 'estilo-cita': insertText = '> \u200b\n'; break;
        case 'estilo-codigo': insertText = '```\n\u200b\n```\n'; break;
        default: insertText = '\n';
      }
      insertTextHtml = renderMarkdown(insertText, editingNoteImages);
    }

    const fragment = activeRange.createContextualFragment(insertTextHtml);
    const insertedRoots = Array.from(fragment.childNodes);
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
    scrollNoteEditorAfterSlashInsertLayout(editor, insertedRoots);
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
    openSlashImageModalAt(textarea.id, previewId, imageMap, commandStart);
    closeSlashMenu();
    return;
  }

  if (cmd === 'tabla' && !cmd.startsWith('tabla:')) {
    textarea.value = text.substring(0, commandStart) + text.substring(cursorPos);
    textarea.selectionStart = textarea.selectionEnd = commandStart;
    textarea.focus();
    closeSlashMenu();
    openTableEditor(textarea.id, previewId, imageMap);
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
    const z = '\u200b';
    const header = `| ${Array.from({ length: cols }, () => z).join(' | ')} |`;
    const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
    const bodyRows = Array.from(
      { length: rows },
      () => `| ${Array.from({ length: cols }, () => z).join(' | ')} |`
    );
    insertText = `${header}\n${separator}\n${bodyRows.join('\n')}\n`;
  }
  if (!cmd.startsWith('tabla:')) switch (cmd) {
    case 'lista': insertText = '- \u200b\n'; break;
    case 'check': insertText = '- [ ] \u200b\n'; break;
    case 'divisor': insertText = '---\n'; break;
    case 'tabla': return;
    case 'estilo-parrafo': insertText = '\u200b\n'; break;
    case 'estilo-h1': insertText = '# \u200b\n\n'; break;
    case 'estilo-h2': insertText = '## \u200b\n\n'; break;
    case 'estilo-h3': insertText = '### \u200b\n\n'; break;
    case 'estilo-h4': insertText = '#### \u200b\n\n'; break;
    case 'estilo-tc1': insertText = '<details class="md-details md-tc1"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
    case 'estilo-tc2': insertText = '<details class="md-details md-tc2"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
    case 'estilo-tc3': insertText = '<details class="md-details md-tc3"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
    case 'estilo-tc4': insertText = '<details class="md-details md-tc4"><summary>\u200b</summary><div class="md-details-body">\u200b</div></details>\n'; break;
    case 'estilo-cita': insertText = '> \u200b\n'; break;
    case 'estilo-codigo': insertText = '```\n\u200b\n```\n'; break;
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
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      showToast('Imagen demasiado grande (máx. 5 MB)', 'error');
      return;
    }

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
      } else if (textAreaId === 'wg-edit-desc' || textAreaId === 'wg-edit-objectives') {
        window._editingWorkGroupImages = window._editingWorkGroupImages || {};
        window._editingWorkGroupImages[key] = dataUrl;
        imageMap = window._editingWorkGroupImages;
        previewId = textAreaId === 'wg-edit-desc' ? 'wg-edit-desc-preview' : 'wg-edit-objectives-preview';
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
export function insertImageWgDesc() { insertImageIntoTextarea('wg-edit-desc'); }
export function insertImageWgObjectives() { insertImageIntoTextarea('wg-edit-objectives'); }

// ===== SLASH IMAGE MODAL =====
let _slashImageTarget = null;

function insertMarkdownSnippetAt(textAreaId, previewId, imageMap, insertAt, snippet) {
  const textarea = document.getElementById(textAreaId);
  if (!textarea) return;
  const pos = insertAt != null ? insertAt : textarea.selectionStart;
  const before = textarea.value.substring(0, pos);
  const after = textarea.value.substring(pos);
  textarea.value = before + snippet + after;
  textarea.selectionStart = textarea.selectionEnd = pos + snippet.length;
  textarea.focus();
  updateMarkdownPreview(textAreaId, previewId, imageMap || {});
}

export function closeSlashImageModal() {
  closeModal('slash-image-modal');
  _slashImageTarget = null;
}

export function openSlashImageModalAt(textAreaId, previewId, imageMap, insertAt) {
  _slashImageTarget = { textAreaId, previewId, imageMap, insertAt };
  const urlInp = document.getElementById('slash-image-url-input');
  const altInp = document.getElementById('slash-image-alt-input');
  if (urlInp) urlInp.value = '';
  if (altInp) altInp.value = 'Imagen';
  openModal('slash-image-modal');
}

export function slashImageApplyUrl() {
  if (!_slashImageTarget) return;
  const url = document.getElementById('slash-image-url-input')?.value?.trim();
  const alt = document.getElementById('slash-image-alt-input')?.value?.trim() || 'Imagen';
  if (!url) { showToast('Indica una URL de imagen', 'error'); return; }
  const { textAreaId, previewId, imageMap, insertAt } = _slashImageTarget;
  insertMarkdownSnippetAt(textAreaId, previewId, imageMap, insertAt, `![${alt}](${url})`);
  closeSlashImageModal();
}

export function slashImagePickFile() {
  if (!_slashImageTarget) return;
  const { textAreaId, previewId, imageMap, insertAt } = _slashImageTarget;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const dataUrl = ev.target.result;
      const altText = document.getElementById('slash-image-alt-input')?.value?.trim() || 'Imagen';
      const key = makeImageKey();
      registerTempImage(key, dataUrl);
      if (textAreaId === 'note-body-input') editingNoteImages[key] = dataUrl;
      else if (textAreaId === 'postit-body-input') editingPostitImages[key] = dataUrl;
      else if (textAreaId === 'doc-content-input') editingDocImages[key] = dataUrl;
      else if (textAreaId === 'project-desc-input') editingProjectImages[key] = dataUrl;
      else if (textAreaId === 'task-desc-input') editingTaskImages[key] = dataUrl;
      else if (textAreaId === 'wg-edit-desc' || textAreaId === 'wg-edit-objectives') {
        window._editingWorkGroupImages = window._editingWorkGroupImages || {};
        window._editingWorkGroupImages[key] = dataUrl;
      }
      insertMarkdownSnippetAt(textAreaId, previewId, imageMap, insertAt, `![${altText}](${key})`);
      closeSlashImageModal();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ===== TABLE EDITOR =====
let _teData = [];
let _teTarget = null;

function openTableEditor(textAreaId, previewId, imageMap) {
  _teTarget = { textAreaId, previewId, imageMap };
  _teData = [
    ['Col 1', 'Col 2', 'Col 3'],
    ['', '', ''],
    ['', '', ''],
  ];
  teRender();
  const tableModal = document.getElementById('table-editor-modal');
  if (tableModal) tableModal.classList.add('raise');
  openModal('table-editor-modal');
}

export function closeTableEditor() {
  const tableModal = document.getElementById('table-editor-modal');
  if (tableModal) tableModal.classList.remove('raise');
  closeModal('table-editor-modal');
}

function teSyncFromDOM() {
  const table = document.getElementById('te-table');
  if (!table) return;
  const rows = table.querySelectorAll('tr');
  _teData = Array.from(rows).map(tr =>
    Array.from(tr.querySelectorAll('.te-cell')).map(inp => inp.value)
  );
}

function teRender() {
  const table = document.getElementById('te-table');
  if (!table) return;
  const rows = _teData.length;
  const cols = _teData[0]?.length || 0;
  const sizeLabel = document.getElementById('te-size-label');
  if (sizeLabel) sizeLabel.textContent = `${cols} col × ${rows} fil`;
  let html = '<thead><tr>';
  for (let c = 0; c < cols; c++) {
    html += `<th>
      <div class="te-col-actions">
        <button class="te-icon-btn" onclick="teInsertCol(${c})" title="Insertar col antes">◀+</button>
        <button class="te-icon-btn del" onclick="teDeleteCol(${c})" title="Eliminar col">✕</button>
        <button class="te-icon-btn" onclick="teInsertCol(${c + 1})" title="Insertar col después">+▶</button>
      </div>
      <input class="te-cell" placeholder="Encabezado ${c + 1}" value="${escapeHtml(_teData[0][c])}" data-r="0" data-c="${c}">
    </th>`;
  }
  html += '</tr></thead><tbody>';
  for (let r = 1; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      html += `<td><input class="te-cell" placeholder="" value="${escapeHtml(_teData[r][c])}" data-r="${r}" data-c="${c}"></td>`;
    }
    html += `<td style="background:var(--surface3);border-color:var(--border);width:26px;padding:2px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <button class="te-icon-btn" onclick="teInsertRow(${r})" title="Insertar fila antes" style="font-size:10px">▲+</button>
        <button class="te-icon-btn del" onclick="teDeleteRow(${r})" title="Eliminar fila" style="font-size:10px">✕</button>
        <button class="te-icon-btn" onclick="teInsertRow(${r + 1})" title="Insertar fila después" style="font-size:10px">+▼</button>
      </div>
    </td>`;
    html += '</tr>';
  }
  html += '</tbody>';
  table.innerHTML = html;
}

export function teAddCol() { teSyncFromDOM(); _teData = _teData.map(row => [...row, '']); teRender(); }
export function teAddRow() { teSyncFromDOM(); _teData.push(new Array(_teData[0].length).fill('')); teRender(); }
export function teRemoveCol() { teSyncFromDOM(); if (_teData[0].length <= 1) return; _teData = _teData.map(row => row.slice(0, -1)); teRender(); }
export function teRemoveRow() { teSyncFromDOM(); if (_teData.length <= 2) return; _teData.pop(); teRender(); }
export function teInsertCol(atIndex) { teSyncFromDOM(); _teData = _teData.map(row => { const r = [...row]; r.splice(atIndex, 0, ''); return r; }); teRender(); }
export function teDeleteCol(atIndex) { teSyncFromDOM(); if (_teData[0].length <= 1) return; _teData = _teData.map(row => { const r = [...row]; r.splice(atIndex, 1); return r; }); teRender(); }
export function teInsertRow(atIndex) { teSyncFromDOM(); const newRow = new Array(_teData[0].length).fill(''); _teData.splice(atIndex, 0, newRow); teRender(); }
export function teDeleteRow(atIndex) { teSyncFromDOM(); if (_teData.length <= 2) return; _teData.splice(atIndex, 1); teRender(); }

export function confirmTableEditor() {
  teSyncFromDOM();
  const headers = _teData[0];
  const separator = headers.map(() => '------');
  const dataRows = _teData.slice(1);
  const mdLines = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + separator.join(' | ') + ' |',
    ...dataRows.map(row => '| ' + row.join(' | ') + ' |'),
  ];
  const mdTable = '\n' + mdLines.join('\n') + '\n';
  if (!_teTarget) return;
  const { textAreaId, previewId, imageMap } = _teTarget;
  const textarea = document.getElementById(textAreaId);
  if (!textarea) return;
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, pos);
  const after = textarea.value.substring(pos);
  const lastNL = before.lastIndexOf('\n');
  const lineStart = lastNL + 1;
  const currentLine = before.substring(lineStart);
  const cleanBefore = currentLine.startsWith('/') ? before.substring(0, lineStart) : before;
  textarea.value = cleanBefore + mdTable + after;
  textarea.focus();
  updateMarkdownPreview(textAreaId, previewId, imageMap);
  closeTableEditor();
  closeSlashMenu();
  showToast('Tabla insertada', 'success');
}

export function getAllVisibleNoteTags() {
  if (!currentUser) return [];
  const tagSet = new Set();
  notes.forEach(n => {
    if (userCanSeeNote(n)) (n.tags || []).forEach(t => tagSet.add(t));
  });
  return [...tagSet].sort();
}

export function filterNotesByTag(tag) {
  const next = activeNoteTagFilter === tag ? null : tag;
  setActiveNoteTagFilter(next);
  syncNoteTagFilterUI();
  const menu = document.getElementById('note-tag-dropdown');
  if (menu) menu.classList.add('hidden');
  renderNotes();
}

export function toggleNoteTagDropdown() {
  const menu = document.getElementById('note-tag-dropdown');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    const tags = getAllVisibleNoteTags();
    if (tags.length === 0) {
      menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--text-muted)">No hay etiquetas todavía</div>';
    } else {
      menu.innerHTML = [
        activeNoteTagFilter
          ? `<button type="button" class="tag-dropdown-item tag-dropdown-clear" onclick="filterNotesByTag(null)">✕ Quitar filtro</button>`
          : '',
        ...tags.map(
          t =>
            `<button type="button" class="tag-dropdown-item${activeNoteTagFilter === t ? ' active' : ''}" onclick="filterNotesByTag(${JSON.stringify(
              t
            )})">${t}</button>`
        ),
      ].join('');
    }
    menu.classList.remove('hidden');
    setTimeout(() => {
      const close = e => {
        if (!menu.contains(e.target) && e.target.id !== 'note-tag-filter-btn') {
          menu.classList.add('hidden');
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 0);
  } else {
    menu.classList.add('hidden');
  }
}

export function renderWeeklyView() {
  const area = document.getElementById('notes-area');
  if (!area || !currentUser) return;

  syncNotesViewLayoutMode('weekly');

  const today = new Date();
  today.setDate(today.getDate() + weekOffset * 7);
  const dow = today.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });

  const todayStr = toDateStr(new Date());
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 6);
  const weekStartStr = toDateStr(monday);
  const weekEndStr = toDateStr(weekEnd);
  const weekStartLabel = monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const weekEndLabel = weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Modo: 'team' o 'me'
  const weekMode = window._weekMode || 'team';

  // ── Estadísticas de la semana ──
  const weekNotes = notes.filter(n =>
    n.date >= weekStartStr && n.date <= weekEndStr &&
    userCanSeeNote(n)
  );
  const myWeekNotes = weekNotes.filter(n => sameId(n.authorId, currentUser.id));
  const mentionsToMe = weekNotes.filter(n => (n.mentions || []).some(id => sameId(id, currentUser.id)));
  const highPriority = weekNotes.filter(n => n.priority === 'alta');

  // ── Mis tareas con vencimiento esta semana ──
  const myTasks = [];
  projects.filter(p => p.group === currentUser.group).forEach(p => {
    (p.tasks || [])
      .filter(t => !t.done && t.assigneeId != null && sameId(t.assigneeId, currentUser.id) && t.dueDate && t.dueDate >= weekStartStr && t.dueDate <= weekEndStr)
      .forEach(t => myTasks.push({ projectName: p.name, task: t }));
  });

  // ── Mis post-its pendientes ──
  const myPostits = postitCards.filter(c =>
    c.assignedTo != null && sameId(c.assignedTo, currentUser.id) &&
    (c.column === 'pendiente' || c.column === 'progreso') &&
    c.group === currentUser.group
  );

  // ── HTML estadísticas ──
  const statsHtml = `
    <div class="weekly-stats-bar">
      <div class="weekly-stat">
        <span class="weekly-stat-num">${weekNotes.length}</span>
        <span class="weekly-stat-label">Notas del equipo</span>
      </div>
      <div class="weekly-stat">
        <span class="weekly-stat-num">${myWeekNotes.length}</span>
        <span class="weekly-stat-label">Mis notas</span>
      </div>
      <div class="weekly-stat${mentionsToMe.length > 0 ? ' weekly-stat--accent' : ''}">
        <span class="weekly-stat-num">${mentionsToMe.length}</span>
        <span class="weekly-stat-label">Me mencionan</span>
      </div>
      <div class="weekly-stat${highPriority.length > 0 ? ' weekly-stat--danger' : ''}">
        <span class="weekly-stat-num">${highPriority.length}</span>
        <span class="weekly-stat-label">Alta prioridad</span>
      </div>
    </div>`;

  // ── HTML mis tareas y post-its ──
  const myTasksHtml = myTasks.length > 0 ? `
    <div class="weekly-my-section">
      <h4 class="weekly-my-title">🎯 Mis tareas con vencimiento esta semana</h4>
      <div class="weekly-my-list">
        ${myTasks.map(({ projectName, task }) => {
          const isOverdue = task.dueDate < todayStr;
          return `<div class="weekly-my-item${isOverdue ? ' weekly-my-item--overdue' : ''}">
            <span class="weekly-my-item-project">${escapeHtml(projectName)}</span>
            <span class="weekly-my-item-name">${escapeHtml(task.name)}</span>
            <span class="weekly-my-item-due${isOverdue ? ' overdue' : ''}">${task.dueDate}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const myPostitHtml = myPostits.length > 0 ? `
    <div class="weekly-my-section">
      <h4 class="weekly-my-title">🗂 Mis post-its pendientes</h4>
      <div class="weekly-my-list">
        ${myPostits.map(c => `
          <div class="weekly-my-item">
            <span class="weekly-my-item-name">${escapeHtml(c.title || 'Sin título')}</span>
            <span class="weekly-my-item-col">${c.column === 'progreso' ? '⚡ En progreso' : '📋 Pendiente'}</span>
            ${c.dueDate ? `<span class="weekly-my-item-due${c.dueDate < todayStr ? ' overdue' : ''}">${c.dueDate}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>` : '';

  // ── HTML días ──
  const sectionsHtml = days.map((ds, idx) => {
    const allDayNotes = notes.filter(n =>
      n.date === ds &&
      userCanSeeNote(n) &&
      (n.visibility !== 'public' || sameId(n.authorId, currentUser.id) || departmentDiarySameCoreDeptNote(n))
    );
    const dayNotes = weekMode === 'me'
      ? allDayNotes.filter(n => sameId(n.authorId, currentUser.id))
      : allDayNotes;

    dayNotes.sort((a, b) => {
      const order = { morning: 0, afternoon: 1, night: 2 };
      const sa = order[a.shift] ?? 9;
      const sb = order[b.shift] ?? 9;
      if (sa !== sb) return sa - sb;
      if (!!a.pinned !== !!b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    const isToday = ds === todayStr;
    const dateObj = new Date(`${ds}T12:00:00`);
    const dateFormatted = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const label = `${dayLabels[idx]} ${dateFormatted}${isToday ? ' · Hoy' : ''}`;
    const countLabel = dayNotes.length === 0 ? 'Sin notas' : `${dayNotes.length} nota${dayNotes.length !== 1 ? 's' : ''}`;

    const cardsHtml = dayNotes.length > 0
      ? `<div class="notes-history-cards">${dayNotes.map(n => renderNoteCard(n, {})).join('')}</div>`
      : `<p style="color:var(--text-muted);font-size:12px;padding:12px 0 4px">Sin notas este día.</p>`;

    const openAttr = isToday ? 'open' : '';

    return `
      <details class="weekly-day-block" ${openAttr}>
        <summary class="weekly-day-summary${isToday ? ' weekly-day-today' : ''}">
          <span class="weekly-day-label">${label}</span>
          <span class="weekly-day-count">${countLabel}</span>
        </summary>
        <div class="weekly-day-body">${cardsHtml}</div>
      </details>`;
  }).join('');

  const weeklyHeaderHtml = `
        <div class="weekly-view-header">
          <button type="button" class="btn-secondary" onclick="navigateWeek(-1)">◀ Anterior</button>
          <span class="weekly-view-range">${weekStartLabel} – ${weekEndLabel}</span>
          <button type="button" class="btn-secondary" onclick="navigateWeek(1)">Siguiente ▶</button>
        </div>
        <div class="weekly-mode-toggle">
          <button type="button" class="weekly-mode-btn${weekMode === 'team' ? ' active' : ''}" onclick="setWeekMode('team')">👥 Equipo</button>
          <button type="button" class="weekly-mode-btn${weekMode === 'me' ? ' active' : ''}" onclick="setWeekMode('me')">👤 Mis notas</button>
        </div>`;

  if (weekMode === 'team') {
    area.innerHTML = `
    <div class="weekly-view-wrap weekly-view-wrap--split">
      <div class="weekly-main-col">
        ${weeklyHeaderHtml}
        ${sectionsHtml}
      </div>
      <div class="weekly-side-col">
        ${statsHtml}
        <div class="weekly-side-section">
          <h4 class="weekly-side-title">📅 Esta semana</h4>
          <div class="weekly-side-info">
            <span>${weekStartLabel}</span>
            <span style="color:var(--text-muted)">→</span>
            <span>${weekEndLabel}</span>
          </div>
        </div>
        ${myTasks.length > 0 ? myTasksHtml : ''}
        ${myPostits.length > 0 ? myPostitHtml : ''}
      </div>
    </div>`;
  } else {
    area.innerHTML = `
    <div class="weekly-view-wrap weekly-view-wrap--me">
      <div class="weekly-main-col">
        ${weeklyHeaderHtml}
        ${statsHtml}
        ${myTasksHtml}${myPostitHtml}
        ${sectionsHtml}
      </div>
    </div>`;
  }
  syncNoteTagFilterTopbar();
}

export function setWeekMode(mode) {
  window._weekMode = mode;
  renderWeeklyView();
}

function ncalUpdateTodayLegend(selectedDateStr) {
  document.querySelectorAll('.ncal-wrap button.ncal-cell.ncal-today').forEach(btn => {
    const ds = btn.getAttribute('data-ncal-date');
    const sp = btn.querySelector('.ncal-sr-today');
    const sel = !!selectedDateStr && ds === selectedDateStr;
    if (sp) sp.textContent = sel ? 'Hoy, día seleccionado.' : 'Hoy, no seleccionado.';
    btn.setAttribute(
      'title',
      sel ? 'Hoy — día seleccionado' : 'Hoy — no seleccionado; pulsa para ver este día'
    );
  });
}

export function renderNotesCalendarView() {
  const container = document.getElementById('notes-area');
  if (!container) return;

  syncNotesViewLayoutMode('calendar');
  syncNotesViewSwitcherUI();

  const viewNotesRoot = document.getElementById('view-notes');
  if (viewNotesRoot) {
    try {
      const d = new Date(`${currentDate}T12:00:00`);
      viewNotesRoot.dataset.printDate = d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      viewNotesRoot.dataset.printDate = currentDate || '';
    }
    try {
      const deptEl = document.getElementById('cfg-dept-name');
      const appEl = document.getElementById('cfg-app-name');
      viewNotesRoot.dataset.printDept = (deptEl && deptEl.value) || currentUser?.group || '';
      viewNotesRoot.dataset.printApp = (appEl && appEl.value) || 'Diario Departamental';
    } catch {
      viewNotesRoot.dataset.printDept = currentUser?.group || '';
    }
  }

  bindNcalGoToDateShortcutOnce();

  const { y: year, m: month } = getCalendarYM();
  const calToday = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = (firstDay.getDay() + 6) % 7;

  const visibleNotes = notes.filter(n => userCanSeeNote(n));
  const notesByDate = {};
  visibleNotes.forEach(n => {
    if (!n.date) return;
    if (!notesByDate[n.date]) notesByDate[n.date] = [];
    notesByDate[n.date].push(n);
  });

  const monthLabelBase = new Date(year, month, 1);
  const monthName = monthLabelBase.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    .map(d => `<div class="ncal-dow" aria-hidden="true">${d}</div>`)
    .join('');

  const SHIFT_COLORS = { morning: '#f4a042', afternoon: '#5ba3e8', night: '#7858f6' };
  const qcal = (searchQuery || '').trim().toLowerCase();

  let monthCount = 0;
  let cells = '';
  for (let i = 0; i < startDow; i++) {
    cells += `<div class="ncal-cell ncal-empty" aria-hidden="true"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayNotes = notesByDate[dateStr] || [];
    monthCount += dayNotes.length;
    const isToday = dateStr === toDateStr(calToday);
    const hasSearch =
      !!qcal &&
      dayNotes.some(n => {
        const t = noteTextForDisplay(n.title).toLowerCase();
        const b = noteTextForDisplay(n.body).toLowerCase();
        return t.includes(qcal) || b.includes(qcal);
      });
    const dots = dayNotes.slice(0, 4).map(n => {
      const sh = n.shift || 'morning';
      const rawColor = SHIFT_COLORS[sh] || '#888';
      const colorSafe = escapeHtmlAttr(rawColor);
      const t = escapeHtmlAttr(noteTextForDisplay(n.title) || 'Sin título');
      return `<div class="ncal-dot ncal-dot--shift-${sh}" style="background:${colorSafe}" title="${t}"></div>`;
    }).join('');
    const extraCount = dayNotes.length > 4 ? dayNotes.length - 4 : 0;
    const extra =
      extraCount > 0
        ? `<span class="ncal-extra" title="${extraCount} nota${extraCount !== 1 ? 's' : ''} más este día" aria-label="${extraCount} notas adicionales">+${extraCount}</span>`
        : '';
    const nCount = dayNotes.length;
    const ariaDay = `Día ${d} de ${monthName}, ${nCount} nota${nCount !== 1 ? 's' : ''}.${isToday ? ' Es hoy.' : ''}`;
    const ariaCurrent = isToday ? ' aria-current="date"' : '';
    const searchCls = hasSearch ? ' ncal-has-search-match' : '';
    const srToday = isToday
      ? `<span class="sr-only ncal-sr-today" id="ncal-today-legend-${dateStr}">Hoy, no seleccionado.</span>`
      : '';
    const describedBy = isToday ? ` aria-describedby="ncal-today-legend-${dateStr}"` : '';
    cells += `
      <button type="button" class="ncal-cell ${isToday ? 'ncal-today' : ''} ${dayNotes.length ? 'ncal-has-notes' : ''}${searchCls}"
        data-ncal-date="${dateStr}"
        onclick="window._ncalSelectDay('${dateStr}')" aria-label="${escapeHtmlAttr(ariaDay)}"${describedBy}${ariaCurrent}>
        <span class="ncal-cell-inner">
          <span class="ncal-day-num">${d}</span>
          ${srToday}
          <span class="ncal-dots-wrap"><span class="ncal-dots">${dots}${extra}</span></span>
        </span>
      </button>`;
  }

  container.classList.add('notes-area-enter');
  setTimeout(() => container.classList.remove('notes-area-enter'), 320);
  container.innerHTML = `
    <div class="ncal-wrap ncal-wrap--split">
      <div class="ncal-calendar-col">
      <div class="ncal-header">
        <button type="button" class="ncal-nav-btn" onclick="ncalNavigateMonth(-1)" aria-label="Mes anterior">◀</button>
        <span class="ncal-month-label" id="ncal-month-label">${monthName}</span>
        <button type="button" class="ncal-nav-btn" onclick="ncalNavigateMonth(1)" aria-label="Mes siguiente">▶</button>
        <div class="ncal-header-tools">
          <button type="button" class="ncal-goto-btn" onclick="ncalOpenGoToDate()" title="Ir a una fecha concreta (Ctrl+G o Cmd+G)">Ir a fecha…</button>
          <button type="button" class="ncal-goto-btn ncal-today-btn" onclick="ncalGoToday()" title="Ir al mes actual y seleccionar hoy">Hoy</button>
        </div>
      </div>
      <div class="ncal-grid" role="grid" aria-labelledby="ncal-month-label">
        ${dayLabels}
        ${cells}
      </div>
      <p class="ncal-legend" id="ncal-legend">
        <span class="ncal-legend-title">Leyenda:</span>
        <span class="ncal-legend-item"><span class="ncal-legend-swatch" style="background:#f4a042"></span> Mañana</span>
        <span class="ncal-legend-item"><span class="ncal-legend-swatch" style="background:#5ba3e8"></span> Tarde</span>
        <span class="ncal-legend-item"><span class="ncal-legend-swatch" style="background:#7858f6"></span> Noche</span>
        <span class="ncal-legend-item ncal-legend-item--search">Barra inferior naranja: día con coincidencias de búsqueda</span>
      </p>
      </div>
      <div class="ncal-detail" id="ncal-detail" role="region" aria-live="polite" aria-label="Notas del día seleccionado">
        <div class="ncal-detail-placeholder">Selecciona un día para ver sus notas</div>
      </div>
    </div>
  `;

  const mainEl = document.getElementById('notes-stats-cal-main');
  const dayEl = document.getElementById('notes-stats-cal-day');
  if (mainEl) mainEl.textContent = `${monthCount} notas en ${monthName}`;
  if (dayEl) {
    dayEl.textContent = '';
    dayEl.classList.add('hidden');
  }

  window._ncalSelectDay = function(dateStr) {
    const dayNotes = notesByDate[dateStr] || [];
    const detail = document.getElementById('ncal-detail');
    if (!detail) return;
    document.querySelectorAll('.ncal-wrap button.ncal-cell').forEach(btn => {
      btn.classList.remove('ncal-selected');
      btn.removeAttribute('aria-selected');
    });
    const selectedBtn = document.querySelector(`.ncal-wrap button.ncal-cell[data-ncal-date="${dateStr}"]`);
    if (selectedBtn) {
      selectedBtn.classList.add('ncal-selected');
      selectedBtn.setAttribute('aria-selected', 'true');
    }
    ncalUpdateTodayLegend(dateStr);
    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const daySummary = document.getElementById('notes-stats-cal-day');
    if (daySummary) {
      daySummary.classList.remove('hidden');
      daySummary.textContent = dayNotes.length
        ? `${dayNotes.length} nota${dayNotes.length !== 1 ? 's' : ''} · ${label}`
        : `Seleccionado: ${label} · sin notas`;
    }
    announceNotes(
      dayNotes.length
        ? `${dayNotes.length} nota${dayNotes.length !== 1 ? 's' : ''} en ${label}`
        : `Sin notas el ${label}`
    );
    if (!dayNotes.length) {
      detail.classList.remove('ncal-detail--dense');
      const safeDate = escapeHtmlAttr(dateStr);
      detail.innerHTML = `
        <div class="ncal-detail-empty-wrap">
          <div class="ncal-detail-placeholder">Sin notas este día</div>
          <button type="button" class="btn-action ncal-empty-day-cta" onclick="ncalOpenNewNoteForDay('${safeDate}')" title="La nota nueva quedará asignada a esta fecha">✏️ Crear nota para este día</button>
        </div>`;
      return;
    }
    detail.classList.toggle('ncal-detail--dense', dayNotes.length > 6);
    detail.innerHTML = `
      <div class="ncal-detail-header">${escapeHtml(label)}</div>
      ${dayNotes
        .map((n, idx) => {
          const author = USERS.find(u => sameId(u.id, n.authorId));
          const nid = String(n.id || n._id || '');
          const bg = escapeHtmlAttr(author?.color || '#888');
          const initials = escapeHtml(author?.initials || '?');
          const title = escapeHtml(noteTextForDisplay(n.title) || 'Sin título');
          const sh = n.shift || 'morning';
          const pillClass = sh === 'afternoon' ? 'afternoon' : sh === 'night' ? 'night' : 'morning';
          const shiftDef = SHIFTS[sh] || SHIFTS.morning;
          const shiftLabel = escapeHtml(`${shiftDef.emoji} ${shiftDef.label}`);
          const alt = idx % 2 === 1 ? ' ncal-note-row--alt' : '';
          const plain = noteTextForDisplay(n.body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const snRaw = plain.length > 80 ? `${plain.slice(0, 80)}…` : plain;
          const snHtml = snRaw
            ? `<div class="ncal-note-snippet">${escapeHtml(snRaw)}</div>`
            : '';
          return `
          <div class="ncal-note-row${alt}" role="button" tabindex="0"
            onclick='editNote(event, ${JSON.stringify(nid)})'
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editNote(event, ${JSON.stringify(nid)});}">
            <div class="ncal-note-shift-pill ${pillClass}">${shiftLabel}</div>
            <div class="ncal-note-maincol">
              <div class="ncal-note-title">${title}</div>
              ${snHtml}
            </div>
            <div class="ncal-note-author" style="background:${bg}">${initials}</div>
          </div>`;
        })
        .join('')}
    `;
  };

  ncalUpdateTodayLegend('');

  syncNoteTagFilterTopbar();
}

function bindNotesViewGlobalShortcutsOnce() {
  if (typeof window === 'undefined' || window._notesViewShortcutsBound) return;
  window._notesViewShortcutsBound = true;
  document.addEventListener(
    'keydown',
    e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('details.note-card-kebab[open]').forEach(d => {
          d.open = false;
        });
      }
      if (currentView !== 'notes') return;
      const noteModal = document.getElementById('note-modal');
      if (noteModal?.classList.contains('open')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.target && e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'n' || e.key === 'N') && !e.shiftKey) {
        e.preventDefault();
        openNewNoteModal();
      } else if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    },
    true
  );
}

bindNotesViewGlobalShortcutsOnce();