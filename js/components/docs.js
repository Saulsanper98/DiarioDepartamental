// ===== DOCS MODULE =====

import { docs, USERS, currentUser, comments, projects, collectImageMap, setDocs, editingDocImages, setEditingDocImages, currentView, currentProjectId } from './data.js';
import { renderMarkdown, renderNotes, handleSlashCommand } from './notes.js';
import { sameId } from './data.js';
import { showToast, openModal, closeModal, showConfirmModal, closeConfirmModal, escapeChatHtml } from './modalControl.js';
import { createCustomSelect } from './auroraCustomSelect.js';
import {
  apiGetDocs,
  apiCreateDoc,
  apiUpdateDoc,
  apiDeleteDoc,
  apiUploadFile,
  apiDeleteFile,
} from '../api.js';

const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log(...args); };

export let currentDocCat = 'all';
export let currentDocFolderId = null;
export let currentDocFile = null;
export let editingDocId = null;
export let commentDraftImages = {};
let insertFileData = null;

export async function loadDocsFromAPI() {
  _docsLoading = true;
  if (currentView === 'docs') renderDocs();
  try {
    const data = await apiGetDocs();
    const mapped = data.map(d => ({
      ...d,
      id: d._id || d.id,
      group: d.department || d.group,
      parentFolderId: d.parentFolderId || null,
    }));
    setDocs(mapped);
    _docsLoading = false;
    if (currentView === 'docs') renderDocs();
    return mapped;
  } catch (err) {
    console.error('Error cargando docs desde API:', err);
    try {
      const local = localStorage.getItem('diario_docs');
      if (local) setDocs(JSON.parse(local));
    } catch {}
    _docsLoading = false;
    if (currentView === 'docs') renderDocs();
    return [];
  }
}

export const DOC_CATS = [
  {id:'all',label:'Todos',icon:'📁'},
  {id:'manual',label:'Manuales',icon:'📖'},
  {id:'procedimiento',label:'Procedimientos',icon:'📋'},
  {id:'guia',label:'Guías',icon:'🗺'},
  {id:'politica',label:'Políticas',icon:'📜'},
  {id:'otro',label:'Otros',icon:'📄'},
];

export let docsSearchTerm = '';
export let docsTypeFilteru = { notes: true, urls: true, files: true };
export let docsViewMode = 'grid'; // 'grid' | 'list'
export let docsSortOrder = 'recent'; // 'recent' | 'name' | 'type' | 'updated' | 'opened'
export let docsDensityMode = 'cozy'; // 'cozy' | 'compact'
const DOC_URL_REGEX = /(https?:\/\/|www\.)/i;
let _docsShortcutsBound = false;
let _docsPrefsLoaded = false;
let _docsHashSyncing = false;
let _docsHashApplied = false;
let _docsMultiSelect = false;
let _docsLoading = false;
let _docModalSaving = false;
let _docsSidebarCollapsed = false;
let _docsTopbarMenuOpen = false;
let _docsToolsMenuOpen = false;
let _docsMenusBound = false;
const _docsSelectedIds = new Set();

function docContainsUrl(doc) {
  if (!doc) return false;
  return DOC_URL_REGEX.test(String(doc.content || '')) || DOC_URL_REGEX.test(String(doc.description || ''));
}

function getDocSearchMatchKinds(doc, rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return [];
  const kinds = [];
  if (String(doc.title || '').toLowerCase().includes(q)) kinds.push('titulo');
  if (String(doc.content || '').toLowerCase().includes(q)) kinds.push('contenido');
  if (String(doc.description || '').toLowerCase().includes(q)) kinds.push('descripcion');
  return kinds;
}

function isTypingTarget(target) {
  const tag = (target && target.tagName) || '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
}

function setDocModalSaving(isSaving, label = 'Guardando…') {
  _docModalSaving = !!isSaving;
  const modal = document.getElementById('doc-modal');
  if (!modal) return;
  const actions = [...modal.querySelectorAll('.modal-footer button')];
  actions.forEach(btn => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const isCancel = btn.classList.contains('btn-cancel') || btn.classList.contains('btn-secondary');
    if (!isCancel) {
      btn.disabled = _docModalSaving;
      if (_docModalSaving) {
        btn.dataset.prevLabel = btn.textContent || '';
        btn.textContent = label;
      } else if (btn.dataset.prevLabel) {
        btn.textContent = btn.dataset.prevLabel;
      }
    }
  });
}

function setDocsFormFeedback(target, message = '', tone = 'info') {
  const el = document.getElementById(target);
  if (!el) return;
  el.textContent = message;
  if (!message) {
    delete el.dataset.tone;
  } else {
    el.dataset.tone = tone;
  }
}

function normalizeTextKey(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

function updateDocsMoreMenuState() {
  const moreDownloadBtn = document.getElementById('docs-more-download-btn');
  if (!moreDownloadBtn) return;
  const currentFolder = currentDocFolderId ? docs.find(d => sameId(d.id, currentDocFolderId)) : null;
  const showDownload = !!(currentFolder && currentFolder.docType === 'folder');
  moreDownloadBtn.classList.toggle('hidden', !showDownload);
}

function syncDocsMenusUI() {
  const topbarMenu = document.getElementById('docs-topbar-more-menu');
  const topbarBtn = document.getElementById('docs-topbar-more-btn');
  const toolsMenu = document.getElementById('docs-tools-menu');
  const toolsBtn = document.getElementById('docs-tools-btn');
  if (topbarMenu) topbarMenu.classList.toggle('hidden', !_docsTopbarMenuOpen);
  if (toolsMenu) toolsMenu.classList.toggle('hidden', !_docsToolsMenuOpen);
  if (topbarBtn) {
    topbarBtn.setAttribute('aria-expanded', _docsTopbarMenuOpen ? 'true' : 'false');
    topbarBtn.classList.toggle('active', _docsTopbarMenuOpen);
  }
  if (toolsBtn) {
    toolsBtn.setAttribute('aria-expanded', _docsToolsMenuOpen ? 'true' : 'false');
    toolsBtn.classList.toggle('active', _docsToolsMenuOpen);
  }
}

function bindDocsMenusOnce() {
  if (_docsMenusBound) return;
  _docsMenusBound = true;
  document.addEventListener('click', e => {
    if (currentView !== 'docs') return;
    const topWrap = document.querySelector('.docs-overflow-wrap');
    const toolsWrap = document.querySelector('.docs-overflow-wrap--toolbar');
    if (_docsTopbarMenuOpen && topWrap && !topWrap.contains(e.target)) {
      _docsTopbarMenuOpen = false;
    }
    if (_docsToolsMenuOpen && toolsWrap && !toolsWrap.contains(e.target)) {
      _docsToolsMenuOpen = false;
    }
    syncDocsMenusUI();
  });
}

export function closeDocsMenus() {
  _docsTopbarMenuOpen = false;
  _docsToolsMenuOpen = false;
  syncDocsMenusUI();
}

export function toggleDocsTopbarMenu() {
  _docsTopbarMenuOpen = !_docsTopbarMenuOpen;
  if (_docsTopbarMenuOpen) _docsToolsMenuOpen = false;
  syncDocsMenusUI();
}

export function toggleDocsToolsMenu() {
  _docsToolsMenuOpen = !_docsToolsMenuOpen;
  if (_docsToolsMenuOpen) _docsTopbarMenuOpen = false;
  syncDocsMenusUI();
}

export function downloadCurrentDocsFolderFromMenu() {
  const currentFolder = currentDocFolderId ? docs.find(d => sameId(d.id, currentDocFolderId)) : null;
  if (!currentFolder || currentFolder.docType !== 'folder') {
    showToast('Selecciona una carpeta para descargar', 'info');
    closeDocsMenus();
    return;
  }
  downloadItem(String(currentFolder.id));
  closeDocsMenus();
}

function configureDocModalFooter(mode = 'doc') {
  const modal = document.getElementById('doc-modal');
  if (!modal) return;
  const buttons = [...modal.querySelectorAll('.modal-footer button')];
  const templateBtn = buttons[0] instanceof HTMLButtonElement ? buttons[0] : null;
  const saveBtn = buttons[buttons.length - 1] instanceof HTMLButtonElement ? buttons[buttons.length - 1] : null;
  if (templateBtn) {
    templateBtn.style.display = mode === 'folder' ? 'none' : '';
  }
  if (saveBtn) {
    saveBtn.textContent = mode === 'folder' ? 'Guardar carpeta' : 'Guardar';
  }
}

function setDocModalSectionVisibility({ showParent = true, showIconPicker = true, showCategory = true, showContent = true, showFile = false } = {}) {
  const parentGroup = document.getElementById('doc-parent-group');
  const iconPickerGroup = document.getElementById('doc-icon-picker-group');
  const categoryGroup = document.getElementById('doc-category-group');
  const contentGroup = document.getElementById('doc-content-group');
  const fileGroup = document.getElementById('doc-file-group');
  if (parentGroup) parentGroup.style.display = showParent ? '' : 'none';
  if (iconPickerGroup) iconPickerGroup.style.display = showIconPicker ? '' : 'none';
  if (categoryGroup) categoryGroup.style.display = showCategory ? '' : 'none';
  if (contentGroup) contentGroup.style.display = showContent ? '' : 'none';
  if (fileGroup) fileGroup.style.display = showFile ? '' : 'none';
  const contentArea = document.getElementById('doc-content-input')?.parentElement;
  const previewArea = document.getElementById('doc-content-preview')?.parentElement;
  if (contentArea) contentArea.style.display = showContent ? '' : 'none';
  if (previewArea) previewArea.style.display = showContent ? '' : 'none';
}

function setDocsSidebarCollapsed(collapsed) {
  _docsSidebarCollapsed = !!collapsed;
  const root = document.getElementById('view-docs');
  if (root) root.classList.toggle('docs-sidebar-collapsed', _docsSidebarCollapsed);
  const hideBtn = document.getElementById('docs-sidebar-toggle-btn');
  const restoreBtn = document.getElementById('docs-sidebar-restore-btn');
  if (hideBtn) {
    hideBtn.classList.toggle('active', _docsSidebarCollapsed);
    hideBtn.setAttribute('aria-pressed', _docsSidebarCollapsed ? 'true' : 'false');
    hideBtn.title = _docsSidebarCollapsed ? 'Mostrar panel de carpetas' : 'Ocultar panel de carpetas';
    hideBtn.textContent = _docsSidebarCollapsed ? '⇥' : '⇤';
  }
  if (restoreBtn) {
    restoreBtn.classList.toggle('hidden', !_docsSidebarCollapsed);
    restoreBtn.setAttribute('aria-pressed', _docsSidebarCollapsed ? 'true' : 'false');
  }
}

export function toggleDocsSidebarCollapse() {
  setDocsSidebarCollapsed(!_docsSidebarCollapsed);
}

function bindDocsShortcutsOnce() {
  if (_docsShortcutsBound) return;
  _docsShortcutsBound = true;
  document.addEventListener('keydown', e => {
    if (currentView !== 'docs') return;
    if (document.querySelector('.modal-overlay.open')) return;
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      focusDocsSearch();
      return;
    }
    if (e.key === '1') {
      e.preventDefault();
      setDocsViewMode('grid');
      return;
    }
    if (e.key === '2') {
      e.preventDefault();
      setDocsViewMode('list');
      return;
    }
    if (e.key === 'Escape') {
      if (_docsTopbarMenuOpen || _docsToolsMenuOpen) {
        e.preventDefault();
        closeDocsMenus();
        return;
      }
      const docPanel = document.getElementById('doc-full-view');
      if (docPanel?.classList.contains('active')) {
        e.preventDefault();
        closeDocView();
        return;
      }
      if (docsSearchTerm) {
        e.preventDefault();
        resetDocsFiltersAndSearch();
      }
    }
    if (e.key === '?') {
      e.preventDefault();
      showToast('Atajos Docs: / buscar · 1 grid · 2 lista · Esc limpiar/cerrar', 'info');
    }
  });
}

function getDocsPrefsKey() {
  return currentUser ? `diario_docs_prefs_${currentUser.id}` : 'diario_docs_prefs_guest';
}

function getDocsRecentOpenKey() {
  return currentUser ? `diario_docs_recent_open_${currentUser.id}` : 'diario_docs_recent_open_guest';
}

function getDocsRecentOpenMap() {
  try {
    const raw = localStorage.getItem(getDocsRecentOpenKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setDocsRecentOpenMap(map) {
  try {
    localStorage.setItem(getDocsRecentOpenKey(), JSON.stringify(map || {}));
  } catch (_) { /* noop */ }
}

function saveDocsPrefs() {
  try {
    const payload = {
      viewMode: docsViewMode,
      sortOrder: docsSortOrder,
      densityMode: docsDensityMode,
      currentDocCat,
      currentDocFolderId,
      filters: docsTypeFilteru,
    };
    localStorage.setItem(getDocsPrefsKey(), JSON.stringify(payload));
  } catch (_) { /* noop */ }
}

function loadDocsPrefsOnce() {
  if (_docsPrefsLoaded) return;
  _docsPrefsLoaded = true;
  try {
    const raw = localStorage.getItem(getDocsPrefsKey());
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.viewMode === 'grid' || parsed?.viewMode === 'list') docsViewMode = parsed.viewMode;
    if (parsed?.sortOrder === 'recent' || parsed?.sortOrder === 'name' || parsed?.sortOrder === 'type' || parsed?.sortOrder === 'updated' || parsed?.sortOrder === 'opened') docsSortOrder = parsed.sortOrder;
    if (parsed?.densityMode === 'compact' || parsed?.densityMode === 'cozy') docsDensityMode = parsed.densityMode;
    if (parsed?.currentDocCat) currentDocCat = String(parsed.currentDocCat);
    if (parsed?.currentDocFolderId != null) currentDocFolderId = parsed.currentDocFolderId;
    if (parsed?.filters && typeof parsed.filters === 'object') {
      docsTypeFilteru = {
        notes: parsed.filters.notes !== false,
        urls: parsed.filters.urls !== false,
        files: parsed.filters.files !== false,
      };
    }
  } catch (_) { /* noop */ }
}

function makeDocsHash() {
  const params = new URLSearchParams();
  params.set('cat', currentDocCat || 'all');
  if (currentDocFolderId != null) params.set('folder', String(currentDocFolderId));
  params.set('view', docsViewMode);
  params.set('sort', docsSortOrder);
  params.set('density', docsDensityMode);
  if (docsSearchTerm) params.set('q', docsSearchTerm);
  return `#/docs?${params.toString()}`;
}

function syncDocsHash() {
  if (_docsHashSyncing) return;
  if (currentView !== 'docs') return;
  const nextHash = makeDocsHash();
  _docsHashSyncing = true;
  try {
    if (location.hash !== nextHash) history.replaceState(null, '', nextHash);
  } catch (_) { /* noop */ }
  _docsHashSyncing = false;
}

function bindDocsTreeKeyboard(container) {
  if (!container || container._docsTreeKeybound) return;
  container._docsTreeKeybound = true;
  container.addEventListener('keydown', e => {
    const node = e.target?.closest?.('.doc-tree-item[role="button"]');
    if (!node) return;
    const nodes = [...container.querySelectorAll('.doc-tree-item[role="button"]')];
    if (!nodes.length) return;
    const idx = nodes.indexOf(node);
    if (idx < 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (nodes[Math.min(nodes.length - 1, idx + 1)] || node).focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      (nodes[Math.max(0, idx - 1)] || node).focus();
      return;
    }
    if (e.key === 'ArrowRight') {
      const toggle = node.querySelector('.doc-tree-toggle.collapsed');
      if (toggle) {
        e.preventDefault();
        toggle.click();
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      const toggle = node.querySelector('.doc-tree-toggle:not(.collapsed)');
      if (toggle) {
        e.preventDefault();
        toggle.click();
      }
    }
  });
}

export function applyDocsDeepLinkFromHash() {
  if (_docsHashSyncing) return false;
  const hash = String(location.hash || '');
  if (!hash.startsWith('#/docs')) return false;
  const qIdx = hash.indexOf('?');
  const query = qIdx >= 0 ? hash.slice(qIdx + 1) : '';
  const params = new URLSearchParams(query);
  let changed = false;
  const cat = params.get('cat');
  if (cat && cat !== currentDocCat) { currentDocCat = cat; changed = true; }
  const folder = params.get('folder');
  const nextFolder = folder == null || folder === '' ? null : folder;
  if (String(currentDocFolderId ?? '') !== String(nextFolder ?? '')) {
    currentDocFolderId = nextFolder;
    changed = true;
  }
  const view = params.get('view');
  if ((view === 'grid' || view === 'list') && view !== docsViewMode) { docsViewMode = view; changed = true; }
  const sort = params.get('sort');
  if ((sort === 'recent' || sort === 'name' || sort === 'type' || sort === 'updated' || sort === 'opened') && sort !== docsSortOrder) {
    docsSortOrder = sort;
    changed = true;
  }
  const density = params.get('density');
  if ((density === 'compact' || density === 'cozy') && density !== docsDensityMode) {
    docsDensityMode = density;
    changed = true;
  }
  const q = (params.get('q') || '').trim();
  if (q !== docsSearchTerm) {
    docsSearchTerm = q;
    changed = true;
  }
  return changed;
}

function updateDocsToolbarSummary(stats) {
  const totalEl = document.getElementById('docs-summary-total');
  const foldersEl = document.getElementById('docs-summary-folders');
  const docsEl = document.getElementById('docs-summary-docs');
  const filesEl = document.getElementById('docs-summary-files');
  const selEl = document.getElementById('docs-summary-selected');
  if (totalEl) totalEl.textContent = String(stats.total || 0);
  if (foldersEl) foldersEl.textContent = String(stats.folders || 0);
  if (docsEl) docsEl.textContent = String(stats.documents || 0);
  if (filesEl) filesEl.textContent = String(stats.files || 0);
  if (selEl) selEl.textContent = String(_docsSelectedIds.size || 0);
  const bar = document.getElementById('docs-batch-actions');
  if (bar) bar.classList.toggle('hidden', !_docsMultiSelect);
  const modeBtn = document.getElementById('docs-multiselect-btn');
  if (modeBtn) modeBtn.classList.toggle('active', _docsMultiSelect);
  const retryBtn = document.getElementById('docs-batch-retry-btn');
  if (retryBtn && !_docsSelectedIds.size) retryBtn.classList.add('hidden');
  const live = document.getElementById('docs-live-region');
  if (live) {
    live.textContent = `Mostrando ${stats.total || 0} elementos. Carpetas ${stats.folders || 0}, documentos ${stats.documents || 0}, archivos ${stats.files || 0}. Seleccionados ${_docsSelectedIds.size || 0}.`;
  }
}

function bindDocsNetworkStatusOnce() {
  if (window._docsNetworkStatusBound) return;
  window._docsNetworkStatusBound = true;
  const refresh = () => {
    const banner = document.getElementById('docs-network-banner');
    if (!banner) return;
    const online = navigator.onLine !== false;
    banner.classList.toggle('hidden', online);
    banner.textContent = online ? '' : 'Sin conexión. Algunas acciones de guardado pueden fallar temporalmente.';
  };
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
}

export function focusDocsSearch() {
  const input = document.getElementById('docs-search-input');
  if (!input) return;
  input.focus();
  input.select?.();
}

export function toggleDocsMultiSelect() {
  _docsMultiSelect = !_docsMultiSelect;
  if (!_docsMultiSelect) _docsSelectedIds.clear();
  renderDocsGrid();
}

export function clearDocsSelection() {
  _docsSelectedIds.clear();
  const retryBtn = document.getElementById('docs-batch-retry-btn');
  if (retryBtn) retryBtn.classList.add('hidden');
  renderDocsGrid();
}

export async function deleteSelectedDocs() {
  if (!_docsSelectedIds.size) return;
  const ids = [..._docsSelectedIds];
  showConfirmModal({
    icon: '🗑️',
    title: 'Eliminar selección',
    message: `Se eliminarán ${ids.length} elementos de documentación. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    destructive: true,
    onConfirm: async () => {
      let ok = 0;
      let failed = 0;
      const failedIds = [];
      try {
        for (const id of ids) {
          const item = docs.find(d => sameId(d.id, id) || sameId(d._id, id));
          if (!item) continue;
          const mongoId = item._id || item.id;
          try {
            await apiDeleteDoc(mongoId);
            const idx = docs.findIndex(d => sameId(d.id, id) || sameId(d._id, id));
            if (idx !== -1) docs.splice(idx, 1);
            ok += 1;
          } catch (e) {
            console.error('Error eliminando elemento de selección:', id, e);
            failed += 1;
            failedIds.push(id);
          }
        }
        if (failed > 0) {
          showToast(`Eliminados ${ok}. ${failed} no se pudieron eliminar`, 'warning');
          const retryBtn = document.getElementById('docs-batch-retry-btn');
          if (retryBtn) retryBtn.classList.remove('hidden');
          _docsSelectedIds.clear();
          failedIds.forEach(fid => _docsSelectedIds.add(String(fid)));
          _docsMultiSelect = true;
          renderDocsGrid();
          return;
        }
        else showToast(`Eliminados ${ok} elementos`, 'success');
      } catch (err) {
        console.error('Error en borrado masivo docs:', err);
        showToast('No se pudieron eliminar todos los elementos', 'error');
      }
      _docsSelectedIds.clear();
      _docsMultiSelect = false;
      const retryBtn = document.getElementById('docs-batch-retry-btn');
      if (retryBtn) retryBtn.classList.add('hidden');
      renderDocs();
    },
  });
}

export function toggleDocSelection(id) {
  const key = String(id);
  if (_docsSelectedIds.has(key)) _docsSelectedIds.delete(key);
  else _docsSelectedIds.add(key);
  renderDocsGrid();
}

export function resetDocsFiltersAndSearch() {
  docsSearchTerm = '';
  docsTypeFilteru = { notes: true, urls: true, files: true };
  const input = document.getElementById('docs-search-input');
  if (input) input.value = '';
  const notesCb = document.getElementById('docs-filter-notes');
  const urlsCb = document.getElementById('docs-filter-urls');
  const filesCb = document.getElementById('docs-filter-files');
  if (notesCb) notesCb.checked = true;
  if (urlsCb) urlsCb.checked = true;
  if (filesCb) filesCb.checked = true;
  saveDocsPrefs();
  syncDocsHash();
  renderDocs();
}

export function setDocsViewMode(mode) {
  docsViewMode = mode;
  document.querySelectorAll('.docs-view-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  saveDocsPrefs();
  syncDocsHash();
  renderDocsGrid();
}

export function setDocsSortOrder(order) {
  docsSortOrder = order;
  document.querySelectorAll('.docs-sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === order);
  });
  saveDocsPrefs();
  syncDocsHash();
  renderDocsGrid();
}

export function setDocsDensityMode(mode) {
  docsDensityMode = mode === 'compact' ? 'compact' : 'cozy';
  saveDocsPrefs();
  syncDocsHash();
  renderDocs();
}

export function renderDocs() {
  loadDocsPrefsOnce();
  if (!_docsHashApplied || String(location.hash || '').startsWith('#/docs')) {
    _docsHashApplied = true;
    applyDocsDeepLinkFromHash();
  }
  bindDocsShortcutsOnce();
  bindDocsNetworkStatusOnce();
  bindDocsMenusOnce();
  document.querySelectorAll('.docs-view-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === docsViewMode);
  });
  document.querySelectorAll('.docs-sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === docsSortOrder);
  });
  document.querySelectorAll('.docs-density-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.density === docsDensityMode);
  });
  const notesCb = document.getElementById('docs-filter-notes');
  const urlsCb = document.getElementById('docs-filter-urls');
  const filesCb = document.getElementById('docs-filter-files');
  if (notesCb) notesCb.checked = !!docsTypeFilteru.notes;
  if (urlsCb) urlsCb.checked = !!docsTypeFilteru.urls;
  if (filesCb) filesCb.checked = !!docsTypeFilteru.files;
  const input = document.getElementById('docs-search-input');
  if (input && input.value !== docsSearchTerm) input.value = docsSearchTerm;
  const docsViewRoot = document.getElementById('view-docs');
  if (docsViewRoot) docsViewRoot.classList.toggle('docs-density-compact', docsDensityMode === 'compact');
  setDocsSidebarCollapsed(_docsSidebarCollapsed);
  syncDocsMenusUI();
  const netBanner = document.getElementById('docs-network-banner');
  if (netBanner) {
    const online = navigator.onLine !== false;
    netBanner.classList.toggle('hidden', online);
    netBanner.textContent = online ? '' : 'Sin conexión. Algunas acciones de guardado pueden fallar temporalmente.';
  }
  updateDocsMoreMenuState();
  renderDocsFolderTree();
  renderDocsGrid();
  syncDocsHash();
}

let _docsSearchTimer = null;
export function filterDocsBySearch(term) {
  docsSearchTerm = (term || '').toLowerCase();
  if (_docsSearchTimer) clearTimeout(_docsSearchTimer);
  _docsSearchTimer = setTimeout(() => {
    _docsSearchTimer = null;
    applyDocsFilters();
  }, 200);
}

export function applyDocsFilters() {
  const notesCb = document.getElementById('docs-filter-notes');
  const urlsCb = document.getElementById('docs-filter-urls');
  const filesCb = document.getElementById('docs-filter-files');
  docsTypeFilteru.notes = notesCb?.checked ?? true;
  docsTypeFilteru.urls = urlsCb?.checked ?? true;
  docsTypeFilteru.files = filesCb?.checked ?? true;
  if (!docsTypeFilteru.notes && !docsTypeFilteru.urls && !docsTypeFilteru.files) {
    docsTypeFilteru.notes = true;
    if (notesCb) notesCb.checked = true;
    showToast('Debe quedar al menos un tipo activo', 'warning');
  }
  saveDocsPrefs();
  syncDocsHash();
  renderDocs();
}

export function closeDocViewIfOpen() {
  const docPanel = document.getElementById('doc-full-view');
  const docsContent = document.getElementById('docs-content');
  if (docPanel && docPanel.classList.contains('active')) {
    docPanel.classList.remove('active');
    docPanel.innerHTML = '';
    if (docsContent) docsContent.style.display = '';
  }
}

export function setDocCat(cat) {
  closeDocViewIfOpen();
  currentDocCat = cat;
  saveDocsPrefs();
  syncDocsHash();
  renderDocs();
  document.querySelectorAll('.docs-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
}

export function renderDocsGrid() {
  const content = document.getElementById('docs-content');
  if (!content) return;
  if (_docsLoading) {
    content.innerHTML = `
      <div class="docs-grid-modern docs-grid-modern--skeleton">
        ${Array.from({ length: 6 }).map(() => `<div class="docs-grid-item docs-grid-item--skeleton"><div class="docs-skel docs-skel-title"></div><div class="docs-skel docs-skel-line"></div><div class="docs-skel docs-skel-line short"></div></div>`).join('')}
      </div>`;
    updateDocsToolbarSummary({ total: 0, folders: 0, documents: 0, files: 0 });
    return;
  }

  const recentMap = getDocsRecentOpenMap();
  const lastDocId = currentUser ? localStorage.getItem(`diario_last_doc_${currentUser.id}`) : null;
  const lastDoc = lastDocId ? docs.find(d => sameId(d.id, lastDocId)) : null;
  const recentBannerHtml = (lastDoc && currentDocFolderId == null && !docsSearchTerm)
    ? `<div class="docs-recent-banner" role="button" tabindex="0" onclick="viewDoc('${lastDoc.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewDoc('${lastDoc.id}')}" title="Abrir último documento visto">
        <span class="docs-recent-icon">${lastDoc.icon || '📄'}</span>
        <div class="docs-recent-info">
          <span class="docs-recent-label">Último visto</span>
          <span class="docs-recent-title">${escapeChatHtml(lastDoc.title)}</span>
        </div>
        <span class="docs-recent-arrow">→</span>
       </div>`
    : '';

  // If a specific item is selected and it's not a folder, show its details
  if (currentDocFolderId != null) {
    const selectedItem = docs.find(d => sameId(d.id, currentDocFolderId));
    if (selectedItem && selectedItem.docType !== 'folder') {
      // Show document details with modern styling
      if (selectedItem.docType === 'document') {
        const author = USERS.find(u => sameId(u.id, selectedItem.authorId));
        const date = new Date(selectedItem.createdAt).toLocaleDateString('es-ES', {day:'numeric', month:'long', year:'numeric'});
        content.innerHTML = `
          <div class="doc-preview-section">
            <button type="button" class="doc-back" onclick="selectDocFolder(null)">← Volver</button>
            <div class="doc-preview-title">
              <span>${selectedItem.icon || '📄'}</span>
              <span>${selectedItem.title}</span>
            </div>
            <div class="doc-preview-meta">
              <span>${author ? author.name : 'Desconocido'}</span> • <span>${date}</span>
            </div>
            <div class="doc-preview-container">
              ${renderMarkdown(selectedItem.content || '', selectedItem.images || {})}
            </div>
            <div class="doc-preview-actions">
              <button onclick="downloadDocAsMarkdown('${selectedItem.id}')" class="btn-action">⬇️ Descargar como .md</button>
              <button onclick="editDocument('${selectedItem.id}')" class="btn-action">✏️ Editar</button>
              <button onclick="openDocVersionsModal('${selectedItem.id}')" class="btn-secondary">🕐 Historial</button>
            </div>
          </div>
        `;
        return;
      } else if (selectedItem.docType === 'file') {
        const fileType = selectedItem.file?.type || '';
        const fileName = selectedItem.file?.name || selectedItem.title;
        const fileSize = selectedItem.file?.size ? (selectedItem.file.size / 1024).toFixed(2) + ' KB' : 'Desconocido';
        const isPDF = fileType.includes('pdf');
        const isImage = fileType.startsWith('image');
        const sharepointUrl = selectedItem.file?.sharepointUrl || selectedItem.file?.url || '';
        
        let fileHtml = `
          <div class="file-viewer-container">
            <button type="button" class="doc-back" onclick="selectDocFolder(null)">← Volver</button>
            <div class="doc-preview-title">
              <span>${selectedItem.icon || '📎'}</span>
              <span>${selectedItem.title}</span>
            </div>
            <div class="doc-preview-meta">
              <span>${fileSize}</span> • <span>${fileType || 'Archivo'}</span>
            </div>
        `;
        
        if (sharepointUrl && fileType?.startsWith('image/')) {
          fileHtml += `<img src="${sharepointUrl}" class="doc-preview-image" alt="${fileNameEscapeHtml(fileName)}">`;
        } else if (sharepointUrl && fileType === 'application/pdf') {
          fileHtml += `<iframe src="${sharepointUrl}" class="doc-preview-iframe" title="Vista previa PDF"></iframe>`;
        } else if (isPDF && selectedItem.file?.data) {
          fileHtml += `<iframe class="file-preview-iframe" src="data:application/pdf;base64,${selectedItem.file.data.split(',')[1] || ''}" frameborder="0"></iframe>`;
        } else if (isImage && selectedItem.file?.data) {
          fileHtml += `<img class="file-image-preview" src="${selectedItem.file.data}" alt="${fileName}">`;
        } else {
          fileHtml += `
            <div class="file-download-card">
              <div class="file-download-icon">${getFileIcon(fileName)}</div>
              <div class="file-download-name">${fileName}</div>
              <div class="file-download-info">Tamaño: ${fileSize}</div>
              <button class="file-download-btn" onclick="downloadFile('${selectedItem.id}')">
                <span>⬇️</span> Descargar para ver contenido
              </button>
            </div>
          `;
        }
        
        fileHtml += `</div>`;
        content.innerHTML = fileHtml;
        return;
      }
    }
  }
  
  // Otherwise, show grid of documents/files/subfolders in current folder
  const currentFolder = currentDocFolderId ? docs.find(d => sameId(d.id, currentDocFolderId)) : null;
  
  let items = docs.filter(d => d.group === currentUser.group || d.department === currentUser.group);
  
  // If a folder is selected, show its contents AND subfolders
  if (currentDocFolderId != null && currentFolder && currentFolder.docType === 'folder') {
    items = items.filter(d => sameId(d.parentFolderId, currentDocFolderId));
  } else if (currentDocFolderId == null) {
    items = items.filter(d => d.parentFolderId == null); // Root level only
  } else {
    items = []; // No items if selected item is not a folder or doesn't exist
  }
  
  // Aplicar búsqueda
  if (docsSearchTerm) {
    items = items.filter(d =>
      d.title.toLowerCase().includes(docsSearchTerm) ||
      (d.docType === 'document' && (d.content || '').toLowerCase().includes(docsSearchTerm)) ||
      (d.description || '').toLowerCase().includes(docsSearchTerm)
    );
  }
  if (currentDocCat !== 'all') {
    items = items.filter(d => d.category === currentDocCat || d.cat === currentDocCat);
  }

  items = items.filter(d => {
    if (d.docType === 'folder') return true;
    if (d.docType === 'file') return !!docsTypeFilteru.files;
    if (d.docType !== 'document') return true;
    const hasUrl = docContainsUrl(d);
    const allowDoc = docsTypeFilteru.notes && !hasUrl;
    const allowUrlDoc = docsTypeFilteru.urls && hasUrl;
    return allowDoc || allowUrlDoc;
  });

  const statFolders = items.filter(d => d.docType === 'folder').length;
  const statDocuments = items.filter(d => d.docType === 'document').length;
  const statFiles = items.filter(d => d.docType === 'file').length;
  updateDocsToolbarSummary({
    total: items.length,
    folders: statFolders,
    documents: statDocuments,
    files: statFiles,
  });

  if (items.length === 0) {
    const hasAnyFilterOff = !docsTypeFilteru.notes || !docsTypeFilteru.urls || !docsTypeFilteru.files;
    const hasSearch = !!docsSearchTerm;
    const hasForeignDocs = docs.some(d => !sameId(d.group, currentUser.group) && !sameId(d.department, currentUser.group));
    const emptyHint = hasSearch
      ? 'No hay resultados para tu búsqueda en la ubicación actual.'
      : (hasForeignDocs && docs.length > 0 && !hasAnyFilterOff
        ? 'No hay documentos visibles para tu grupo actual en esta ubicación.'
        : (hasAnyFilterOff ? 'No hay elementos con los filtros activos.' : 'No hay elementos en esta ubicación.'));
    const emptyIcon = hasSearch ? '🔎' : (hasForeignDocs && docs.length > 0 && !hasAnyFilterOff ? '🔒' : '📁');
    content.innerHTML = `<div class="empty-state project-view-empty docs-empty-state">
      <div class="empty-icon docs-empty-state__icon">${emptyIcon}</div>
      <div>${emptyHint}</div>
      ${(hasSearch || hasAnyFilterOff) ? `<button type="button" class="btn-secondary docs-empty-reset-btn" onclick="resetDocsFiltersAndSearch()">Limpiar búsqueda y filtros</button>` : ''}
    </div>`;
    return;
  }
  
  // Separate folders, documents, and files
  const folders = items.filter(d => d.docType === 'folder');
  const documents = items.filter(d => d.docType === 'document');
  const files = items.filter(d => d.docType === 'file');

  const sortItems = (arr) => {
    if (docsSortOrder === 'name') return [...arr].sort((a, b) => a.title.localeCompare(b.title, 'es'));
    if (docsSortOrder === 'type') return [...arr].sort((a, b) => (a.docType || '').localeCompare(b.docType || ''));
    if (docsSortOrder === 'updated') return [...arr].sort((a, b) => {
      const ta = Number(new Date(a.updatedAt || a.createdAt || 0));
      const tb = Number(new Date(b.updatedAt || b.createdAt || 0));
      return tb - ta;
    });
    if (docsSortOrder === 'opened') return [...arr].sort((a, b) => {
      const ta = Number(recentMap[String(a.id)] || 0);
      const tb = Number(recentMap[String(b.id)] || 0);
      return tb - ta;
    });
    return [...arr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  const sortedFolders = sortItems(folders);
  const sortedDocuments = sortItems(documents);
  const sortedFiles = sortItems(files);

  const visibleIdSet = new Set(items.map(it => String(it.id)));
  [..._docsSelectedIds].forEach(id => {
    if (!visibleIdSet.has(String(id))) _docsSelectedIds.delete(String(id));
  });

  let html = '';
  
  if (currentDocFolderId != null) {
    html += buildFolderBreadcrumb(currentDocFolderId);
  }

  html += recentBannerHtml;
  html += `<div class="${docsViewMode === 'list' ? 'docs-list-modern' : 'docs-grid-modern'}">`;
  
  // Render folders first
  sortedFolders.forEach(folder => {
    const folderItems = docs.filter(d => sameId(d.parentFolderId, folder.id)).length;
    const date = new Date(folder.createdAt).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
    const author = USERS.find(u => sameId(u.id, folder.authorId));
    const authorName = author?.name || currentUser?.name || '—';
    const matchKinds = getDocSearchMatchKinds(folder, docsSearchTerm);
    const matchBadge = matchKinds.length
      ? `<div class="docs-match-hints">Coincide en: ${matchKinds.map(k => `<span class="docs-match-chip">${escapeChatHtml(k)}</span>`).join('')}</div>`
      : '';
    const isSelected = _docsSelectedIds.has(String(folder.id));
    html += `<div class="docs-grid-item${docsViewMode === 'list' ? ' docs-list-item' : ''}${isSelected ? ' is-selected' : ''}" role="button" tabindex="0" onclick="${_docsMultiSelect ? `toggleDocSelection('${folder.id}')` : `selectDocFolder('${folder.id}')`}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${_docsMultiSelect ? `toggleDocSelection('${folder.id}')` : `selectDocFolder('${folder.id}')`}}">
      ${_docsMultiSelect ? `<label class="docs-select-check"><input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation();toggleDocSelection('${folder.id}')"><span></span></label>` : ''}
      <div class="docs-card-head">
        <span class="docs-card-head__icon">📁</span>
      </div>
      <div class="doc-card-title doc-card-title--docs">${folder.title}</div>
      <div class="doc-card-meta doc-card-meta--docs">
        ${date} • <span>${authorName}</span>
      </div>
      ${matchBadge}
      <div class="docs-card-actions">
        <button class="btn-secondary docs-card-actions__main" type="button" onclick="event.stopPropagation(); selectDocFolder('${folder.id}')">📂 Abrir</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); editDocFolder('${folder.id}')">✏️</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); deleteDocElement('${folder.id}')" title="Eliminar carpeta" aria-label="Eliminar carpeta ${escapeChatHtml(folder.title)}">🗑</button>
      </div>
    </div>`;
  });
  
  // Render documents
  sortedDocuments.forEach(d => {
    const author = USERS.find(u => u.id === d.authorId);
    const date = new Date(d.createdAt).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
    const matchKinds = getDocSearchMatchKinds(d, docsSearchTerm);
    const matchBadge = matchKinds.length
      ? `<div class="docs-match-hints">Coincide en: ${matchKinds.map(k => `<span class="docs-match-chip">${escapeChatHtml(k)}</span>`).join('')}</div>`
      : '';
    const isSelected = _docsSelectedIds.has(String(d.id));
    html += `<div class="docs-grid-item${docsViewMode === 'list' ? ' docs-list-item' : ''}${isSelected ? ' is-selected' : ''}" role="button" tabindex="0" onclick="${_docsMultiSelect ? `toggleDocSelection('${d.id}')` : `selectDocFolder('${d.id}')`}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${_docsMultiSelect ? `toggleDocSelection('${d.id}')` : `selectDocFolder('${d.id}')`}}">
      ${_docsMultiSelect ? `<label class="docs-select-check"><input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation();toggleDocSelection('${d.id}')"><span></span></label>` : ''}
      <div class="docs-card-head">
        <span class="docs-card-head__icon">${d.icon || '📄'}</span>
        <button class="doc-delete-btn" type="button" onclick="event.stopPropagation(); deleteDocElement('${d.id}')" title="Eliminar documento" aria-label="Eliminar documento ${escapeChatHtml(d.title)}">🗑</button>
      </div>
      <div class="doc-card-title doc-card-title--docs">${d.title}</div>
      <div class="doc-card-meta doc-card-meta--docs">
        ${date} • <span>${author ? author.name : '—'}</span>
      </div>
      ${matchBadge}
      ${commentIndicators('doc', d.id)}
      <div class="docs-card-actions">
        <button class="btn-secondary docs-card-actions__main" type="button" onclick="event.stopPropagation(); selectDocFolder('${d.id}')">👁️ Ver</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); openDocCommentsModal('${d.id}')" title="Comentarios">💬</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); editDocument('${d.id}')">✏️</button>
      </div>
    </div>`;
  });

  // Render files
  sortedFiles.forEach(d => {
    const date = new Date(d.createdAt).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
    const fileSize = d.file?.size ? (d.file.size / 1024).toFixed(2) + ' KB' : 'N/A';
    const author = USERS.find(u => u.id === d.authorId);
    const isImage = d.file?.type?.startsWith('image/');
    const thumbUrl = d.file?.sharepointUrl || d.file?.url || '';
    const thumbHtml = isImage && thumbUrl
      ? `<div class="doc-file-thumb"><img src="${escapeHtmlAttr(thumbUrl)}" alt="${escapeHtmlAttr(d.title || 'Archivo')}" loading="lazy"></div>`
      : `<div class="doc-file-thumb doc-file-thumb--icon">${d.icon || '📎'}</div>`;
    const matchKinds = getDocSearchMatchKinds(d, docsSearchTerm);
    const matchBadge = matchKinds.length
      ? `<div class="docs-match-hints">Coincide en: ${matchKinds.map(k => `<span class="docs-match-chip">${escapeChatHtml(k)}</span>`).join('')}</div>`
      : '';
    const isSelected = _docsSelectedIds.has(String(d.id));
    html += `<div class="docs-grid-item${docsViewMode === 'list' ? ' docs-list-item' : ''}${isSelected ? ' is-selected' : ''}" role="button" tabindex="0" onclick="${_docsMultiSelect ? `toggleDocSelection('${d.id}')` : `selectDocFolder('${d.id}')`}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${_docsMultiSelect ? `toggleDocSelection('${d.id}')` : `selectDocFolder('${d.id}')`}}">
      ${_docsMultiSelect ? `<label class="docs-select-check"><input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation();toggleDocSelection('${d.id}')"><span></span></label>` : ''}
      <div class="docs-card-file-head">
        ${thumbHtml}
        <button class="doc-delete-btn doc-delete-btn--overlay" type="button" onclick="event.stopPropagation(); deleteDocElement('${d.id}')" title="Eliminar archivo" aria-label="Eliminar archivo ${escapeChatHtml(d.title)}">🗑</button>
      </div>
      <div class="doc-card-title doc-card-title--docs">${d.title}</div>
      <div class="doc-card-meta doc-card-meta--docs">
        ${date} • <span>${author ? author.name : '—'}</span>
      </div>
      ${matchBadge}
      ${commentIndicators('doc', d.id)}
      <div class="docs-card-actions">
        <button class="btn-secondary docs-card-actions__main" type="button" onclick="event.stopPropagation(); selectDocFolder('${d.id}')">👁️ Ver</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); downloadFile('${d.id}')">⬇️</button>
      </div>
    </div>`;
  });
  
  html += '</div>';
  content.innerHTML = html;
}

export function viewDoc(id) {
  if (currentUser) {
    localStorage.setItem(`diario_last_doc_${currentUser.id}`, String(id));
  }
  const recentMap = getDocsRecentOpenMap();
  recentMap[String(id)] = Date.now();
  setDocsRecentOpenMap(recentMap);
  log('viewDoc called with id:', id);
  const d = docs.find(doc => sameId(doc.id, id));
  log('found doc:', d);
  if (!d) return;

  const author = USERS.find(u => u.id === d.authorId);
  const date = new Date(d.createdAt).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const docPanel = document.getElementById('doc-full-view');
  const docsContent = document.getElementById('docs-content');

  if (!docPanel) {
    console.error('doc-full-view panel not found');
    return;
  }

  docsContent.style.display = 'none';
  
  const rendered = renderMarkdown(d.content, d.images || {});
  docPanel.innerHTML = `
    <div class="doc-viewer-toolbar">
      <button type="button" class="doc-back doc-back--compact" onclick="closeDocView()">← Volver</button>
    </div>
    <div class="doc-viewer">
      <h1>${d.icon} ${d.title}</h1>
      <div class="doc-meta-bar">Por ${author ? author.name : '—'} · ${date}</div>
      <div class="doc-body">${rendered}</div>
      <div class="doc-viewer-comments-cta">
        <button type="button" class="btn-primary btn-full-width" onclick="openDocCommentsModal('${d.id}')">💬 Abrir comentarios</button>
      </div>
      <div class="doc-viewer-actions">
        <button class="btn-secondary" onclick='openEditDocModal(${JSON.stringify(d.id)})'>✏️ Editar</button>
        <button class="btn-secondary" onclick="openDocVersionsModal('${d.id}')">🕐 Historial</button>
        <button class="btn-secondary btn-secondary-danger" onclick='deleteDoc(${JSON.stringify(d.id)})'>🗑 Eliminar</button>
      </div>
    </div>`;

  // Add active class AFTER innerHTML to ensure visibility
  docPanel.classList.add('active');
  
}

export function closeDocView() {
  const docPanel = document.getElementById('doc-full-view');
  const docsContent = document.getElementById('docs-content');
  if (!docPanel || !docsContent) return;
  docPanel.classList.remove('active');
  docsContent.style.display = '';
  docPanel.innerHTML = '';
  renderDocsGrid();
}

export function updateMarkdownPreview(textAreaId, previewId, imageMap = {}) {
  const textarea = document.getElementById(textAreaId);
  if (!textarea) return;
  const value = textarea.value;
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = renderMarkdown(value, imageMap);
  // El modal Nota usa editor contenteditable; handleSlashFromNoteEditor en notes.js ya gestiona el menú /.
  if (textAreaId !== 'note-body-input') {
    handleSlashCommand(textarea, previewId, imageMap);
  }
}

export function sameMaybeId(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

export function commentTargetKey(kind, targetId, extraId = null) {
  return `${kind}:${Number(targetId)}:${extraId == null ? '-' : Number(extraId)}`;
}

export function getCommentReadMap() {
  if (!currentUser) return {};
  const key = `diario_comment_read_${currentUser.id}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCommentReadMap(map) {
  if (!currentUser) return;
  localStorage.setItem(`diario_comment_read_${currentUser.id}`, JSON.stringify(map || {}));
}

export function getCommentMeta(kind, targetId, extraId = null) {
  const arr = comments.filter(c =>
    c.kind === kind &&
    sameId(c.targetId, targetId) &&
    sameMaybeId(c.extraId, extraId)
  );
  const count = arr.length;
  let lastAny = 0;
  let lastOther = 0;
  arr.forEach(c => {
    const t = new Date(c.createdAt).getTime();
    if (!Number.isFinite(t)) return;
    if (t > lastAny) lastAny = t;
    if (!sameId(c.authorId, currentUser?.id) && t > lastOther) lastOther = t;
  });
  return { count, lastAny, lastOther };
}

export function hasUnreadComments(kind, targetId, extraId = null) {
  if (!currentUser) return false;
  const readMap = getCommentReadMap();
  const key = commentTargetKey(kind, targetId, extraId);
  const lastRead = readMap[key] || 0;
  const meta = getCommentMeta(kind, targetId, extraId);
  return meta.lastOther > lastRead;
}

export function markCommentsAsRead(kind, targetId, extraId = null) {
  if (!currentUser) return;
  const readMap = getCommentReadMap();
  const key = commentTargetKey(kind, targetId, extraId);
  const meta = getCommentMeta(kind, targetId, extraId);
  readMap[key] = Math.max(meta.lastAny, Date.now());
  saveCommentReadMap(readMap);
}

export function commentIndicators(kind, targetId, extraId = null) {
  const meta = getCommentMeta(kind, targetId, extraId);
  if (meta.count === 0) return '';
  const hasNew = hasUnreadComments(kind, targetId, extraId);
  return `<span class="comment-indicators">
    <span class="comment-flag">💬 ${meta.count}</span>
    ${hasNew ? '<span class="comment-flag new">🔴 nuevo</span>' : ''}
  </span>`;
}

export function getLatestCommentPreview(kind, targetId, extraId = null) {
  const arr = comments
    .filter(c => c.kind === kind && sameId(c.targetId, targetId) && sameMaybeId(c.extraId, extraId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!arr.length) return '';
  const last = arr[0];
  const plain = (last.body || '').replace(/\n/g, ' ').slice(0, 80);
  return plain + ((last.body || '').length > 80 ? '…' : '');
}

export function refreshCommentIndicators() {
  if (currentView === 'notes') renderNotes();
  if (currentView === 'postit' && typeof window.renderPostitBoard === 'function') window.renderPostitBoard();
  if (currentView === 'projects') {
    if (typeof window.renderProjects === 'function') window.renderProjects();
    if (currentProjectId && typeof window.selectProject === 'function') window.selectProject(currentProjectId);
  }
  if (currentView === 'docs') renderDocsGrid();
}

export function insertImageIntoCommentTextarea(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  if (!commentDraftImages[textareaId]) commentDraftImages[textareaId] = {};
  const imageMap = commentDraftImages[textareaId];

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
      imageMap[key] = dataUrl;

      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const textAfter = textarea.value.substring(cursorPos);
      textarea.value = textBefore + `![${altText}](${key})` + textAfter;
      textarea.focus();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export function insertMentionIntoCommentTextarea(textareaId, userName) {
  const textarea = document.getElementById(textareaId);
  if (!textarea || !userName) return;
  const mention = `@${userName}`;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const textAfter = textarea.value.substring(cursorPos);
  textarea.value = textBefore + mention + textAfter;
  textarea.focus();
}

export function normalizeForSearch(t) {
  return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getMentionQueryAtCaret(textarea) {
  const pos = textarea.selectionStart;
  const upto = textarea.value.slice(0, pos);
  const m = /(?:^|\s)@([A-Za-z0-9ÁÉÍÓÚáéíóúÑñ._-]{1,40})$/.exec(upto);
  if (!m) return null;
  return m[1];
}

export function replaceMentionQueryAtCaret(textarea, fullName) {
  const pos = textarea.selectionStart;
  const upto = textarea.value.slice(0, pos);
  const m = /(?:^|\s)@([A-Za-z0-9ÁÉÍÓÚáéíóúÑñ._-]{1,40})$/.exec(upto);
  if (!m) return false;
  const query = m[1];
  const start = pos - query.length - 1;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(pos);
  const insert = `@${fullName} `;
  textarea.value = before + insert + after;
  const nextPos = before.length + insert.length;
  textarea.setSelectionRange(nextPos, nextPos);
  textarea.focus();
  return true;
}

export function toggleCommentMentionMenu(textareaId) {
  const pop = document.getElementById(textareaId + '-mention-pop');
  if (!pop) return;
  pop.classList.toggle('hidden');
}

export function toggleMentionPick(textareaId, userName, el) {
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

export function insertSelectedMentions(textareaId) {
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

export function selectMentionAutocomplete(textareaId, userName) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  replaceMentionQueryAtCaret(textarea, userName);
  const auto = document.getElementById(textareaId + '-mention-auto');
  if (auto) auto.classList.add('hidden');
}

export function updateCommentMentionAutocomplete(textareaId) {
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

export function handleCommentInput(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  if (!commentDraftImages[textareaId]) commentDraftImages[textareaId] = {};
  handleSlashCommand(textarea, null, commentDraftImages[textareaId]);
  updateCommentMentionAutocomplete(textareaId);
}

export function openCommentsThreadModal(kind, targetId, extraId, title) {
  const el = document.getElementById('comments-thread-title');
  if (el) el.textContent = title || 'Comentarios';
  renderCommentsPanel(kind, targetId, 'comments-thread-body', extraId);
  openModal('comments-thread-modal');
}

export function openNoteCommentsModal(noteId) {
  const note = notes.find(n => sameId(n.id, noteId));
  if (!note) return;
  openCommentsThreadModal('note', note.id, null, 'Comentarios: ' + note.title);
}
export function openDocCommentsModal(docId) {
  const d = docs.find(x => sameId(x.id, docId));
  if (!d) return;
  openCommentsThreadModal('doc', d.id, null, 'Comentarios: ' + d.title);
}

export function renderCommentsPanel(kind, targetId, containerId, extraId = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (typeof window._onCommentsThreadModalClose === 'function') {
    window._onCommentsThreadModalClose();
  }

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

export function submitComment(kind, targetId, extraId, containerId) {
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
  if (kind === 'postit' && currentView === 'postit' && typeof window.renderPostitBoard === 'function') {
    window.renderPostitBoard();
  }
  if ((kind === 'task' || kind === 'project') && currentView === 'projects' && currentProjectId) {
    if (typeof window.selectProject === 'function') window.selectProject(currentProjectId);
  }
}

function saveComments() {
  localStorage.setItem('diario_comments', JSON.stringify(comments));
}

const ICON_GRID = ['📁', '📖', '📝', '📋', '🗂', '💻', '⚙️', '💡', '📌', '🌐', '📊', '🎯', '📎', '🔒', '⭐'];
let currentIconContext = null;

export function ensureDocModalElements() {
  const contentInput = document.getElementById('doc-content-input');
  const parentInput = document.getElementById('doc-parent-input');
  const iconBtn = document.getElementById('doc-icon-btn');
  const categoryInput = document.getElementById('doc-category-input');
  const preview = document.getElementById('doc-content-preview');
  if (contentInput) {
    const group = contentInput.closest('.form-group');
    if (group && !group.id) group.id = 'doc-content-group';
    if (contentInput.classList) contentInput.classList.add('doc-content-input');
  }
  if (parentInput) {
    const group = parentInput.closest('.form-group');
    if (group && !group.id) group.id = 'doc-parent-group';
  }
  if (iconBtn) {
    const group = iconBtn.closest('.form-group');
    if (group && !group.id) group.id = 'doc-icon-picker-group';
    iconBtn.classList.add('doc-icon-picker-btn');
  }
  if (categoryInput) {
    const group = categoryInput.closest('.form-group');
    if (group && !group.id) group.id = 'doc-category-group';
  }
  if (preview) {
    preview.classList.add('doc-content-preview');
  }
  const previewControls = document.getElementById('doc-preview-toggle')?.closest('.preview-controls');
  if (previewControls) previewControls.classList.add('doc-preview-controls');
}

export function closeDocModalWithCleanup() {
  const contentArea = document.getElementById('doc-content-input')?.parentElement;
  const previewArea = document.getElementById('doc-content-preview')?.parentElement;
  if (contentArea) contentArea.style.display = '';
  if (previewArea) previewArea.style.display = '';
  setDocModalSectionVisibility({ showParent: true, showIconPicker: true, showCategory: true, showContent: true, showFile: false });
  setDocsFormFeedback('doc-modal-feedback', '');
  closeModal('doc-modal');
}

export async function saveDocOrFolder() {
  const titleEl = document.getElementById('doc-modal-title');
  const title = titleEl?.textContent || '';
  if (title.includes('Carpeta')) {
    await saveFolder();
  } else {
    await saveDoc();
  }
}

function saveDocVersion(doc) {
  if (!doc || !currentUser) return;
  const key = `diario_doc_versions_${doc.id}`;
  let versions = [];
  try {
    const raw = localStorage.getItem(key);
    versions = raw ? JSON.parse(raw) : [];
  } catch { versions = []; }
  versions.unshift({
    id: Date.now(),
    content: doc.content || '',
    title: doc.title || '',
    savedAt: new Date().toISOString(),
    savedBy: currentUser.id
  });
  versions = versions.slice(0, 10);
  localStorage.setItem(key, JSON.stringify(versions));
}

function loadDocVersions(docId) {
  try {
    const raw = localStorage.getItem(`diario_doc_versions_${docId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveDoc() {
  if (_docModalSaving) return;
  setDocModalSaving(true, 'Guardando…');
  setDocsFormFeedback('doc-modal-feedback', '');
  const title = document.getElementById('doc-title-input')?.value.trim();
  if (!title) {
    showToast('El título es requerido', 'error');
    setDocsFormFeedback('doc-modal-feedback', 'El título es obligatorio para guardar el documento.', 'error');
    setDocModalSaving(false);
    return;
  }
  const content = document.getElementById('doc-content-input')?.value || '';
  const existingImages = editingDocId ? docs.find(d => sameId(d.id, editingDocId))?.images || {} : {};
  const images = collectImageMap(content, { ...existingImages, ...editingDocImages });

  let parentVal = 'null';

  // Leer del custom select Aurora — buscar la opción seleccionada
  const selectedOption = document.querySelector('#doc-modal .custom-select-option.selected');
  if (selectedOption) {
    parentVal = selectedOption.dataset.value || 'null';
  } else {
    // Fallback al select nativo
    const nativeSelect = document.getElementById('doc-parent-input');
    parentVal = nativeSelect?.value || 'null';
  }

  const parentFolderId = parentVal === 'null' || parentVal === '' ? null : parentVal;
  const titleKey = normalizeTextKey(title);
  const duplicated = docs.some(d =>
    d.docType === 'document' &&
    !sameId(d.id, editingDocId) &&
    sameId(d.parentFolderId, parentFolderId) &&
    normalizeTextKey(d.title) === titleKey &&
    (sameId(d.group, currentUser.group) || sameId(d.department, currentUser.group))
  );
  if (duplicated) {
    showToast('Ya existe un documento con ese nombre en esa carpeta', 'warning');
    setDocsFormFeedback('doc-modal-feedback', 'Nombre duplicado en la carpeta seleccionada. Usa otro título.', 'warning');
    setDocModalSaving(false);
    return;
  }

  const catEl = document.getElementById('doc-category-input');
  const category = catEl && catEl.value ? catEl.value : 'manual';

  const docPayload = {
    title,
    docType: 'document',
    parentFolderId,
    category,
    icon: document.getElementById('doc-icon-input')?.value || '📝',
    content,
    images,
  };
  if (currentDocFile) {
    docPayload.file = currentDocFile;
  }

  if (editingDocId) {
    const idx = docs.findIndex(d => sameId(d.id, editingDocId));
    if (idx !== -1) {
      saveDocVersion(docs.find(d => sameId(d.id, editingDocId)));
      const existing = docs[idx];
        const updated = { ...existing, ...docPayload, department: currentUser.group };
      try {
        const mongoId = existing._id || existing.id;
        await apiUpdateDoc(mongoId, updated);
      } catch (err) {
        console.error('Error actualizando doc:', err);
        showToast('Error al guardar en servidor', 'error');
        setDocsFormFeedback('doc-modal-feedback', 'No se pudo actualizar. Revisa tu conexión y vuelve a intentarlo.', 'error');
        setDocModalSaving(false);
        return;
      }
      setDocs(docs.map((d, i) => (i === idx ? updated : d)));
      showToast('Documento actualizado', 'success');
    }
  } else {
    const newDoc = {
      id: Date.now(),
      ...docPayload,
      authorId: currentUser.id,
      group: currentUser.group,
        department: currentUser.group,
      createdAt: new Date().toISOString(),
    };
    try {
      const saved = await apiCreateDoc(newDoc);
      newDoc._id = saved._id;
      newDoc.id = saved._id || newDoc.id;
    } catch (err) {
      console.error('Error creando doc:', err);
      showToast('Error al guardar en servidor', 'error');
      setDocsFormFeedback('doc-modal-feedback', 'No se pudo crear el documento. Reintenta en unos segundos.', 'error');
      setDocModalSaving(false);
      return;
    }
    setDocs([...docs, newDoc]);
    showToast('Documento creado', 'success');
  }

  currentDocFile = null;
  saveDocData();
  closeModal('doc-modal');
  renderDocs();
  setDocModalSaving(false);
}

export function toggleIconPopover(event, context) {
  event.preventDefault();
  event.stopPropagation();
  const popover = document.getElementById('icon-popover');
  if (!popover) return;

  popover.style.cssText =
    'padding:20px !important; box-sizing:border-box !important; display:grid !important; grid-template-columns:repeat(4,1fr) !important; gap:8px !important; width:100% !important; overflow:visible !important;';

  const btn = event.currentTarget;
  const isOpen = popover.classList.contains('open');

  if (isOpen && currentIconContext === context) {
    closeIconPopover();
    return;
  }

  currentIconContext = context;

  popover.innerHTML = ICON_GRID.map(icon => {
    const currentIcon = document.getElementById(`${context}-icon-input`)?.value;
    const isSelected = currentIcon === icon;
    return `<button type="button" class="icon-btn ${isSelected ? 'selected' : ''}" onclick="selectIcon('${icon}', '${context}', event)" title="${icon}">${icon}</button>`;
  }).join('');

  const rect = btn.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${Math.max(8, rect.left)}px`;
  popover.style.maxWidth = '320px';

  popover.classList.add('open');

  document.addEventListener('click', closeIconPopoverOnClick, true);
}

export function selectIcon(icon, context, event) {
  event.preventDefault();
  event.stopPropagation();
  const input = document.getElementById(`${context}-icon-input`) || document.getElementById(`${context}-icon-selected`);
  if (input) input.value = icon;
  const iconBtn = document.getElementById(`${context}-icon-btn`);
  if (iconBtn) iconBtn.textContent = icon;
  closeIconPopover();
}

export function closeIconPopover() {
  const popover = document.getElementById('icon-popover');
  if (!popover) return;
  popover.classList.remove('open');
  popover.style.display = 'none';
  popover.style.top = '-9999px';
  popover.style.left = '-9999px';
  popover.innerHTML = '';
  currentIconContext = null;
  document.removeEventListener('click', closeIconPopoverOnClick, true);
}

function closeIconPopoverOnClick(e) {
  const popover = document.getElementById('icon-popover');
  const btn = document.getElementById(currentIconContext ? `${currentIconContext}-icon-btn` : '');
  if (popover && !popover.contains(e.target) && !btn?.contains(e.target)) {
    closeIconPopover();
  }
}

export function openNewDocModal() {
  editingDocId = null;
  setEditingDocImages({});
  currentDocFile = null;
  ensureDocModalElements();
  document.getElementById('doc-modal-title').textContent = 'Nuevo Documento';
  document.getElementById('doc-title-input').value = '';
  document.getElementById('doc-title-input').placeholder = 'Título del documento...';
  populateDocParentSelect();
  document.getElementById('doc-icon-input').value = '📝';
  document.getElementById('doc-icon-btn').textContent = '📝';
  document.getElementById('doc-content-input').value = '';
  document.getElementById('doc-content-preview').innerHTML = '';
  const catEl = document.getElementById('doc-category-input');
  if (catEl) catEl.value = 'manual';
  setDocsFormFeedback('doc-modal-feedback', '');
  setDocModalSectionVisibility({ showParent: true, showCategory: true, showContent: true, showFile: false });
  configureDocModalFooter('doc');
  setDocModalSaving(false);
  openModal('doc-modal');
}

export function editDocument(id) {
  openEditDocModal(id);
}

export function openEditDocModal(id) {
  const d = docs.find(doc => sameId(doc.id, id));
  if (!d) return;
  editingDocId = id;
  setEditingDocImages(d.images || {});
  currentDocFile = d.file || null;
  ensureDocModalElements();
  document.getElementById('doc-modal-title').textContent = 'Editar Documento';
  document.getElementById('doc-title-input').value = d.title || '';
  document.getElementById('doc-icon-input').value = d.icon || '📝';
  document.getElementById('doc-icon-btn').textContent = d.icon || '📝';
  document.getElementById('doc-content-input').value = d.content || '';
  document.getElementById('doc-content-preview').innerHTML = renderMarkdown(d.content || '', editingDocImages);
  const catEl = document.getElementById('doc-category-input');
  if (catEl) catEl.value = d.category || d.cat || 'manual';
  populateDocParentSelect();
  const parentSel = document.getElementById('doc-parent-input');
  if (parentSel) {
    parentSel.value = d.parentFolderId == null ? 'null' : String(d.parentFolderId);
  }
  setDocModalSectionVisibility({ showParent: true, showCategory: true, showContent: true, showFile: false });
  configureDocModalFooter('doc');
  setDocModalSaving(false);
  setDocsFormFeedback('doc-modal-feedback', '');
  openModal('doc-modal');
}

export function deleteDoc(id) {
  const d = docs.find(doc => sameId(doc.id, id));
  if (!d) return;
  showConfirmModal({
    icon: '📚',
    title: '¿Eliminar este documento?',
    message: `Se eliminará "${d.title}" y todos sus comentarios.`,
    onConfirm: () => {
      setDocs(docs.filter(doc => !sameId(doc.id, id)));
      saveDocData();
      renderDocsGrid();
      showToast('Documento eliminado', 'info');
    }
  });
}

export function renderDocsFolderTree() {
  const container = document.getElementById('docs-categories');
  if (!container) return;

  let filterHtml = `
    <div class="docs-type-filter" id="docs-type-filter">
      <button type="button" class="docs-type-btn active" data-cat="all" onclick="setDocCat('all')">📁 Todos</button>
      <button type="button" class="docs-type-btn" data-cat="manual" onclick="setDocCat('manual')">📖 Manuales</button>
      <button type="button" class="docs-type-btn" data-cat="procedimiento" onclick="setDocCat('procedimiento')">📋 Procedimientos</button>
      <button type="button" class="docs-type-btn" data-cat="guia" onclick="setDocCat('guia')">🗺 Guías</button>
      <button type="button" class="docs-type-btn" data-cat="politica" onclick="setDocCat('politica')">📜 Políticas</button>
      <button type="button" class="docs-type-btn" data-cat="otro" onclick="setDocCat('otro')">📄 Otros</button>
    </div>`;

  const userDocs = docs.filter(d =>
    d.group === currentUser.group || d.department === currentUser.group
  );
  let html = filterHtml + '<div class="docs-tree-root">';
  html += `<div class="doc-tree-item doc-tree-item--root ${currentDocFolderId==null?'active':''}" role="button" tabindex="0" onclick="selectDocFolder(null)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectDocFolder(null)}">
    <span class="doc-tree-icon">📁</span> <span>Todos</span>
  </div>`;
  
  function isRootItem(d) {
    const pid = d.parentFolderId;
    return pid === null || pid === undefined || pid === '' || pid === 'null';
  }

  function renderTreeRecursive(parentId, depth = 0) {
    const folders = (parentId === null
      ? userDocs.filter(d => d.docType === 'folder' && isRootItem(d))
      : userDocs.filter(d => d.docType === 'folder' && sameId(d.parentFolderId, parentId))
    ).sort((a, b) => a.title.localeCompare(b.title));

    const items = (parentId === null
      ? userDocs.filter(d => (d.docType === 'document' || d.docType === 'file') && isRootItem(d))
      : userDocs.filter(d => (d.docType === 'document' || d.docType === 'file') && sameId(d.parentFolderId, parentId))
    ).sort((a, b) => a.title.localeCompare(b.title));
    
    const indent = depth * 20;
    
    // Render folders
    folders.forEach(folder => {
      const collapsedKey = `doc_collapsed_${folder.id}`;
      const isCollapsed = sessionStorage.getItem(collapsedKey) === 'true';
      
      // Check if folder has any children (folders, documents, or files)
      const hasFolderChildren = userDocs.some(d => d.docType === 'folder' && sameId(d.parentFolderId, folder.id));
      const hasDocChildren = userDocs.some(d => 
        (d.docType === 'document' || d.docType === 'file') && 
        sameId(d.parentFolderId, folder.id)
      );
      const hasChildren = hasFolderChildren || hasDocChildren;
      
      const isActive = sameId(currentDocFolderId, folder.id);
      
      html += `<div class="doc-tree-level" style="--doc-tree-indent:${indent}px">\n`;
      html += `<div class="doc-tree-item doc-tree-item--branch ${isActive?'active':''}" role="button" tabindex="0" onclick="selectDocFolder('${folder.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectDocFolder('${folder.id}')}">\n`;
      
      // Toggle button
      if (hasChildren) {
        html += `<span class="doc-tree-toggle ${isCollapsed?'collapsed':''}" onclick="toggleDocFolderCollapse('${folder.id}', event)" title="${isCollapsed ? 'Expandir carpeta' : 'Contraer carpeta'}">▼</span>\n`;
      } else {
        html += `<span class="doc-tree-toggle-placeholder"></span>\n`;
      }
      
      html += `<div class="doc-tree-item-main">\n`;
      html += `<span class="doc-tree-icon">📁</span>\n`;
      html += `<span class="doc-tree-label" title="${folder.title}">${folder.title}</span>\n`;
      html += `</div>\n`;
      html += `<div class="doc-actions-hover">\n`;
      html += `<button type="button" onclick="event.stopPropagation(); editDocFolder('${folder.id}')" title="Editar carpeta" aria-label="Editar carpeta ${escapeChatHtml(folder.title)}">✎</button>\n`;
      html += `<button type="button" onclick="event.stopPropagation(); deleteDocElement('${folder.id}')" title="Eliminar carpeta" aria-label="Eliminar carpeta ${escapeChatHtml(folder.title)}">🗑</button>\n`;
      html += `</div>\n`;
      html += `</div>\n`;
      
      // Render children if not collapsed
      if (!isCollapsed && hasChildren) {
        renderTreeRecursive(folder.id, depth + 1);
      }
      
      html += `</div>\n`;
    });
    
    // Render documents and files
    items.forEach(item => {
      const itemIcon = item.docType === 'file' ? '📎' : (item.icon || '📄');
      const isActive = sameId(currentDocFolderId, item.id);
      
      html += `<div class="doc-tree-level" style="--doc-tree-indent:${indent}px">\n`;
      html += `<div class="doc-tree-item doc-tree-item--leaf ${isActive?'active':''}" role="button" tabindex="0" onclick="selectDocFolder('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectDocFolder('${item.id}')}">\n`;
      html += `<div class="doc-tree-item-main">\n`;
      html += `<span class="doc-tree-icon">${itemIcon}</span>\n`;
      html += `<span class="doc-tree-label" title="${item.title}">${item.title}</span>\n`;
      html += `</div>\n`;
      html += `<div class="doc-actions-hover">\n`;
      if (item.docType === 'file') {
        html += `<button type="button" onclick="event.stopPropagation(); downloadFile('${item.id}')" title="Descargar archivo" aria-label="Descargar archivo ${escapeChatHtml(item.title)}">⬇️</button>\n`;
      }
      html += `<button type="button" onclick="event.stopPropagation(); deleteDocElement('${item.id}')" title="Eliminar" aria-label="Eliminar ${escapeChatHtml(item.title)}">🗑</button>\n`;
      html += `</div>\n`;
      html += `</div>\n`;
      html += `</div>\n`;
    });
  }
  
  // Render from root
  renderTreeRecursive(null, 0);
  
  html += '</div>';
  html += `<div class="docs-tree-footer">`;
  html += `<button class="btn-primary docs-tree-footer__btn" onclick="openCreateFolderModal()">+ Nueva Carpeta</button>`;
  html += `</div>`;
  container.innerHTML = html;
  bindDocsTreeKeyboard(container);
  document.querySelectorAll('.docs-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === currentDocCat);
  });
}

export function selectDocFolder(folderId) {
  currentDocFolderId = folderId === null ? null : folderId;
  if (window.innerWidth <= 1120 && currentDocFolderId != null) {
    setDocsSidebarCollapsed(true);
  }
  saveDocsPrefs();
  syncDocsHash();
  renderDocsFolderTree();
  renderDocsGrid();
  updateDocsMoreMenuState();
}

export function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const icons = {
    'pdf':'📄','doc':'📝','docx':'📝','xls':'📊','xlsx':'📊',
    'ppt':'🎯','pptx':'🎯','txt':'📋','csv':'📊','json':'⚙️',
    'jpg':'🖼️','jpeg':'🖼️','png':'🖼️','gif':'🖼️','svg':'🖼️',
    'mp3':'🎵','wav':'🎵','flac':'🎵','mp4':'🎬','avi':'🎬',
    'zip':'📦','rar':'📦','7z':'📦'
  };
  return icons[ext] || '📎';
}

export function downloadItem(id) {
  const item = docs.find(d => sameId(d.id, id));
  if (!item) return;
  
  if (item.type === 'folder' || item.isFolder || item.docType === 'folder') {
    const zipName = (item.name || item.title) + '.zip';
    log('Descargando carpeta como ZIP:', zipName);
    return downloadFolderAsZip(id);
  }
  downloadFile(id);
}

export function downloadFile(fileId) {
  const doc = docs.find(d => sameId(d.id, fileId));
  if (!doc || !doc.file) return;
  
  const url = doc.file.sharepointUrl || doc.file.url;
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  
  // Fallback para archivos sin SharePoint URL
  if (doc.file.data) {
    const a = document.createElement('a');
    a.href = doc.file.data;
    a.download = doc.file.customName || doc.file.name || 'archivo';
    a.click();
  }
}

export function downloadDocAsMarkdown(docId) {
  const doc = docs.find(d => sameId(d.id, docId));
  if (!doc || doc.docType !== 'document') {
    showToast('Documento no encontrado', 'error');
    return;
  }
  const content = `# ${doc.title}\n\n${doc.content || ''}`;
  const blob = new Blob([content], { type:'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${doc.title.replace(/\s+/g,'_')}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast(`Descargando "${doc.title}.md"...`, 'success');
}

export function saveDocData() {
  // Ya no guarda en localStorage
}

export async function downloadFolderAsZip(folderId) {
  const folder = docs.find(d => sameId(d.id, folderId));
  if (!folder) {
    showToast('Elemento no encontrado', 'error');
    return;
  }
  
  if (!(folder.type === 'folder' || folder.isFolder || folder.docType === 'folder')) {
    showToast('Solo se pueden descargar carpetas', 'error');
    return;
  }
  
  showToast(`📦 Preparando ZIP de "${folder.title}"...`, 'info');
  
  try {
    const zip = new JSZip();
    const descendants = getAllDescendants(folderId);
    
    // Crear contenido del INDEX
    let indexContent = `# ${folder.title}\n\n`;
    indexContent += `**Descargado:** ${new Date().toLocaleString()}\n\n`;
    
    // Clasificar descendientes
    const subfolders = descendants.filter(d => d.docType === 'folder');
    const documents = descendants.filter(d => d.docType === 'document');
    const files = descendants.filter(d => d.docType === 'file');
    
    if (subfolders.length > 0) {
      indexContent += `## 📁 Carpetas (${subfolders.length})\n`;
      subfolders.forEach(f => {
        indexContent += `- ${f.title}\n`;
      });
      indexContent += `\n`;
    }
    
    if (documents.length > 0) {
      indexContent += `## 📄 Documentos (${documents.length})\n`;
      documents.forEach(d => {
        indexContent += `- ${d.title}.md\n`;
      });
      indexContent += `\n`;
    }
    
    if (files.length > 0) {
      indexContent += `## 📎 Archivos (${files.length})\n`;
      files.forEach(f => {
        indexContent += `- ${f.title}\n`;
      });
    }
    
    // Agregar INDEX.md al root
    zip.file('INDEX.md', indexContent);
    
    // Agregar documentos en carpeta "Documentos"
    if (documents.length > 0) {
      const docsFolder = zip.folder('Documentos');
      documents.forEach(doc => {
        const content = `# ${doc.title}\n\n${doc.content || ''}`;
        const filename = `${doc.title.replace(/[\/\\?*:|"<>]/g, '_')}.md`;
        docsFolder.file(filename, content);
      });
    }
    
    // Agregar archivos en carpeta "Archivos"
    if (files.length > 0) {
      const filesFolder = zip.folder('Archivos');
      files.forEach(file => {
        if (file.file && file.file.data) {
          const filename = file.file.name || file.title;
          let fileData = file.file.data;
          if (fileData.startsWith('data:')) {
            fileData = fileData.split(',')[1];
            filesFolder.file(filename, fileData, { base64: true });
          } else {
            filesFolder.file(filename, fileData);
          }
        }
      });
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folder.title.replace(/[\/\\?*:|"<>]/g, '_')}_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`✅ ZIP descargado: ${documents.length + files.length} elementos incluidos`, 'success');
  } catch (err) {
    console.error('Error generando ZIP:', err);
    showToast('Error al generar ZIP: ' + err.message, 'error');
  }
}

export function getAllDescendants(parentId) {
  const descendants = [];
  const userDocs = docs.filter(d => d.group === currentUser.group);
  
  function traverse(id) {
    const children = userDocs.filter(d => sameId(d.parentFolderId, id));
    children.forEach(child => {
      descendants.push(child);
      if (child.docType === 'folder') {
        traverse(child.id);
      }
    });
  }
  
  traverse(parentId);
  return descendants;
}

export function toggleDocFolderCollapse(folderId, event) {
  event.stopPropagation();
  const key = `doc_collapsed_${folderId}`;
  const isCollapsed = sessionStorage.getItem(key) === 'true';
  if (isCollapsed) {
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, 'true');
  }
  renderDocsFolderTree();
}

export function editDocFolder(folderId) {
  const folder = docs.find(d => sameId(d.id, folderId));
  if (!folder) return;
  
  editingDocId = folderId;
  setEditingDocImages({});
  currentDocFile = null;
  
  ensureDocModalElements();
  
  document.getElementById('doc-modal-title').textContent = 'Editar Carpeta';
  document.getElementById('doc-title-input').value = folder.title;
  
  const folderIcon = folder.icon || '📁';
  document.getElementById('doc-icon-input').value = folderIcon;
  document.getElementById('doc-icon-btn').textContent = folderIcon;

  populateDocParentSelect(folderId);
  const parentSel = document.getElementById('doc-parent-input');
  if (parentSel) {
    parentSel.value = folder.parentFolderId == null ? 'null' : String(folder.parentFolderId);
  }

  const parentGroup = document.getElementById('doc-parent-group');
  const categoryGroup = document.getElementById('doc-category-group');
  const contentGroup = document.getElementById('doc-content-group');
  const fileGroup = document.getElementById('doc-file-group');
  
  if (parentGroup) parentGroup.style.display = 'none';
  if (categoryGroup) categoryGroup.style.display = 'none';
  if (contentGroup) contentGroup.style.display = 'none';
  if (fileGroup) fileGroup.style.display = 'none';
  
  const contentArea = document.getElementById('doc-content-input')?.parentElement;
  const previewArea = document.getElementById('doc-content-preview')?.parentElement;
  if (contentArea) contentArea.style.display = 'none';
  if (previewArea) previewArea.style.display = 'none';
  openModal('doc-modal');
}

export function deleteDocFolder(folderId) {
  const folder = docs.find(d => sameId(d.id, folderId));
  if (!folder) return;
  
  const hasChildren = docs.some(d => sameId(d.parentFolderId, folderId));
  
  showConfirmModal({
    icon: '📁',
    title: '¿Eliminar esta carpeta?',
    message: hasChildren 
      ? `Se eliminará "${folder.title}" y todos sus documentos.`
      : `Se eliminará "${folder.title}".`,
    onConfirm: () => {
      function deleteWithChildren(parentId) {
        setDocs(docs.filter(d => !sameId(d.id, parentId)));
        const children = docs.filter(d => sameId(d.parentFolderId, parentId));
        children.forEach(child => deleteWithChildren(child.id));
      }
      deleteWithChildren(folderId);
      saveDocData();
      currentDocFolderId = null;
      renderDocsFolderTree();
      renderDocsGrid();
      showToast('Carpeta eliminada','info');
    }
  });
}

export function selectDocIcon(icon, buttonEl) {
  document.getElementById('doc-icon-input').value = icon;
  document.querySelectorAll('.doc-icon-btn').forEach(btn => {
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--surface)';
    btn.style.color = 'inherit';
    btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  });
  buttonEl.style.borderColor = '#2563eb';
  buttonEl.style.background = '#2563eb';
  buttonEl.style.color = '#ffffff';
  buttonEl.style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.4)';
}

export function buildFolderSelectHtml(excludeFolderId = null) {
  const userFolders = docs.filter(d => 
    (d.group === currentUser.group || d.department === currentUser.group) && 
    d.docType === 'folder' &&
    (!excludeFolderId || !sameId(d.id, excludeFolderId))
  );
  
  let html = '<option value="null">📁 Raíz (Sin carpeta padre)</option>';
  
  function renderOptions(parentId, depth = 0, path = []) {
    const children = userFolders
      .filter(d => sameId(d.parentFolderId, parentId))
      .sort((a, b) => a.title.localeCompare(b.title));
    
    children.forEach(folder => {
      const indent = '&nbsp;'.repeat(depth * 2);
      const displayPath = [...path, folder.title].join(' > ');
      html += `<option value="${folder.id}">${indent}${folder.icon || '📁'} ${displayPath}</option>`;
      renderOptions(folder.id, depth + 1, [...path, folder.title]);
    });
  }
  
  renderOptions(null);
  return html;
}

/**
 * Filas DFS para el dropdown Aurora de carpeta destino (misma idea que getProjectParentSelectAuroraRows).
 */
export function getDocFolderSelectAuroraRows(excludeFolderId = null) {
  const userFolders = docs.filter(d =>
    d.group === currentUser.group &&
    d.docType === 'folder' &&
    (!excludeFolderId || !sameId(d.id, excludeFolderId))
  );
  const candidateIds = new Set(userFolders.map(f => String(f.id)));

  function parentInCandidates(f) {
    if (f.parentFolderId == null || f.parentFolderId === '') return false;
    return candidateIds.has(String(f.parentFolderId));
  }

  const roots = userFolders
    .filter(f => !parentInCandidates(f))
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));

  const rows = [];
  function dfs(node, depth) {
    rows.push({
      value: String(node.id),
      depth,
      label: `${node.icon || '📁'} ${node.title}`,
    });
    const children = userFolders
      .filter(c => sameId(c.parentFolderId, node.id))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
    children.forEach(ch => dfs(ch, depth + 1));
  }
  roots.forEach(r => dfs(r, 0));
  return rows;
}

function scheduleDocFolderTreeCustomSelect(selectId, modalRootSelector, excludeFolderId) {
  if (!document.documentElement.classList.contains('tema-aurora')) return;
  setTimeout(() => {
    const treeRows = getDocFolderSelectAuroraRows(excludeFolderId);
    createCustomSelect(selectId, modalRootSelector, { treeRows });
  }, 0);
}

export function populateInsertFileFolderSelect() {
  const select = document.getElementById('insert-file-folder-select');
  if (!select) return;
  select.innerHTML = buildFolderSelectHtml();
  scheduleDocFolderTreeCustomSelect('insert-file-folder-select', '#insert-file-modal', null);
}

export function populateDocParentSelect(excludeFolderId = null) {
  const select = document.getElementById('doc-parent-input');
  if (!select) return;
  select.innerHTML = buildFolderSelectHtml(excludeFolderId);
  scheduleDocFolderTreeCustomSelect('doc-parent-input', '#doc-modal', excludeFolderId);
}

export function setupInsertFileIconPicker() {
  const iconGrid = document.getElementById('insert-file-icon-grid');
  if (!iconGrid) return;
  
  const buttons = iconGrid.querySelectorAll('.insert-file-icon-btn');
  buttons.forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = function(e) {
      e.preventDefault();
      const icon = this.getAttribute('data-icon');
      document.getElementById('insert-file-icon-selected').value = icon;
      buttons.forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
    };
    
    if (btn.getAttribute('data-icon') === '📎') {
      btn.classList.add('selected');
    }
  });
}

export function handleInsertFileSelect(event) {
  log('handleInsertFileSelect llamado', event?.target?.files?.[0]?.name);
  const file = event.target.files[0];
  if (!file) return;
  
  insertFileData = {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    data: null,
    rawFile: file
  };
  log('insertFileData creado:', {
    name: insertFileData.name,
    size: insertFileData.size,
    hasRawFile: !!insertFileData.rawFile,
    rawFileType: insertFileData.rawFile?.constructor?.name
  });
  
  const reader = new FileReader();
  reader.onload = (e) => {
    insertFileData.data = e.target.result;
    updateInsertFilePreview();
  };
  reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function fileNameEscapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function updateInsertFilePreview() {
  const container = document.getElementById('insert-file-preview');
  if (!container || !insertFileData) return;
  
  const icon = getFileIcon(insertFileData.name);
  const sizeStr = formatFileSize(insertFileData.size);
  
  container.innerHTML = `
    <div class="file-preview file-preview--insert">
      <div class="file-preview--insert__icon">${icon}</div>
      <div class="file-preview--insert__meta">
        <div class="file-preview--insert__name">${fileNameEscapeHtml(insertFileData.name)}</div>
        <div class="file-preview--insert__size">${sizeStr}</div>
      </div>
      <button type="button" class="btn-icon file-preview--insert__clear" onclick="clearInsertFile()">✕</button>
    </div>
  `;
  
  const nameInput = document.getElementById('insert-file-name-input');
  if (!nameInput.value) {
    nameInput.value = insertFileData.name;
  }
}

export function clearInsertFile() {
  insertFileData = null;
  document.getElementById('insert-file-input').value = '';
  document.getElementById('insert-file-preview').innerHTML = '';
  document.getElementById('insert-file-name-input').value = '';
}

export async function confirmInsertFile() {
  if (_docModalSaving) return;
  setDocModalSaving(true, 'Guardando…');
  setDocsFormFeedback('insert-file-modal-feedback', '');
  log('confirmInsertFile llamado, insertFileData:', insertFileData?.name, 'rawFile:', !!insertFileData?.rawFile);
  let folderId = 'null';

  // Leer del custom select Aurora — buscar la opción seleccionada
  const selectedOption = document.querySelector('#insert-file-modal .custom-select-option.selected');
  if (selectedOption) {
    folderId = selectedOption.dataset.value || 'null';
    log('Valor del custom select Aurora:', folderId);
  } else {
    // Fallback al select nativo
    const nativeSelect = document.getElementById('insert-file-folder-select');
    folderId = nativeSelect?.value || 'null';
    log('Valor del select nativo:', folderId);
  }

  const parentFolderId = folderId === 'null' || folderId === '' ? null : folderId;
  const displayName = document.getElementById('insert-file-display-name').value.trim();
  const customName = document.getElementById('insert-file-name-input').value.trim();
  const selectedIcon = document.getElementById('insert-file-icon-input')?.value || document.getElementById('insert-file-icon-selected')?.value || '📎';
  
  if (!displayName) {
    showToast('Ingresa el nombre del archivo', 'error');
    setDocsFormFeedback('insert-file-modal-feedback', 'El nombre visible del archivo es obligatorio.', 'error');
    setDocModalSaving(false);
    return;
  }
  
  if (!insertFileData) {
    showToast('Selecciona un archivo', 'error');
    setDocsFormFeedback('insert-file-modal-feedback', 'Debes seleccionar un archivo antes de guardar.', 'error');
    setDocModalSaving(false);
    return;
  }
  
  const newFile = {
    id: Date.now(),
    title: displayName,
    docType: 'file',
    icon: selectedIcon,
    group: currentUser.group,
    parentFolderId: parentFolderId,
    file: {
      ...insertFileData,
      displayName: displayName,
      customName: customName || insertFileData.name,
      icon: selectedIcon
    },
    createdAt: new Date().toLocaleString(),
    images: {}
  };

  log('Verificando rawFile antes de subir:', !!insertFileData?.rawFile);
  if (insertFileData?.rawFile) {
    try {
      const uploaded = await apiUploadFile(insertFileData.rawFile, currentUser.group);
      newFile.file.sharepointUrl = uploaded.url || uploaded.webUrl || uploaded.sharepointUrl || '';
      newFile.file.sharepointId = uploaded.fileId || uploaded.id || uploaded._id || null;
      newFile.file.url = newFile.file.sharepointUrl || newFile.file.url || '';
      showToast('Archivo subido a SharePoint', 'success');
    } catch (err) {
      console.error('Error al subir archivo:', err);
      showToast('Error al subir archivo', 'error');
    }
  }

  const docToSave = {
    ...newFile,
    department: currentUser.group,
    authorId: currentUser.id,
    createdAt: new Date().toISOString(),
    file: newFile.file ? {
      ...newFile.file,
      data: null, // No guardar base64 en MongoDB — está en SharePoint
    } : null,
  };
  try {
    const saved = await apiCreateDoc(docToSave);
    newFile._id = saved._id;
    newFile.id = saved._id || newFile.id;
  } catch (err) {
    console.error('Error guardando doc en API:', err);
    showToast('Error al guardar en servidor', 'error');
    setDocsFormFeedback('insert-file-modal-feedback', 'No se pudo guardar el archivo. Reintenta con conexión estable.', 'error');
    setDocModalSaving(false);
    return;
  }
  
  docs.push(newFile);
  saveDocData();
  setDocsFormFeedback('insert-file-modal-feedback', '');
  closeModal('insert-file-modal');
  renderDocs();
  showToast(`Archivo "${displayName}" guardado correctamente`, 'success');
  setDocModalSaving(false);
}

export function deleteDocElement(id) {
  const item = docs.find(d => sameId(d.id, id) || sameId(d._id, id));
  if (!item) { showToast('Elemento no encontrado', 'error'); return; }
  
  showConfirmModal({
    icon: item.docType === 'folder' ? '📁' : '📄',
    title: `¿Eliminar "${item.title}"?`,
    message: item.docType === 'folder' 
      ? 'Se eliminará la carpeta y todo su contenido.' 
      : 'Se eliminará este documento permanentemente.',
    destructive: true,
    onConfirm: async () => {
      try {
        const mongoId = item._id || item.id;
        await apiDeleteDoc(mongoId);
        const idx = docs.findIndex(d => sameId(d.id, id) || sameId(d._id, id));
        if (idx !== -1) docs.splice(idx, 1);
        renderDocs();
        showToast('Eliminado correctamente', 'info');
      } catch (err) {
        console.error('Error eliminando:', err);
        showToast('Error al eliminar', 'error');
      }
    }
  });
}

export function openCreateFolderModal() {
  try {
    editingDocId = null;
    setEditingDocImages({});
    currentDocFile = null;
    
    const titleInput = document.getElementById('doc-title-input');
    const iconBtn = document.getElementById('doc-icon-btn');
    const iconInput = document.getElementById('doc-icon-input');
    const contentInput = document.getElementById('doc-content-input');
    const contentPreview = document.getElementById('doc-content-preview');
    const modalTitle = document.getElementById('doc-modal-title');
    
    if (!titleInput || !iconBtn || !iconInput || !contentInput || !contentPreview || !modalTitle) {
      console.error('[openCreateFolderModal] Elementos no encontrados');
      showToast('Error: No se pudo abrir el modal', 'error');
      return;
    }
    
    modalTitle.textContent = 'Nueva Carpeta';
    titleInput.value = '';
    titleInput.placeholder = 'Nombre de la carpeta...';
    iconInput.value = '📁';
    iconBtn.textContent = '📁';
    contentInput.value = '';

    populateDocParentSelect();

    setDocModalSectionVisibility({ showParent: true, showCategory: false, showContent: false, showFile: false });
    configureDocModalFooter('folder');
    setDocModalSaving(false);
    setDocsFormFeedback('doc-modal-feedback', '');
    
    openModal('doc-modal');
  } catch (err) {
    console.error('[openCreateFolderModal] Error:', err.message);
    showToast('Error: ' + err.message, 'error');
  }
}

export function openInsertFileModal() {
  setDocsFormFeedback('insert-file-modal-feedback', '');
  const docSelect = document.getElementById('insert-file-doc-select');
  if (docSelect) {
    const userDocs = docs.filter(d => d.group === currentUser.group && d.docType === 'document');
    if (userDocs.length === 0) {
      showToast('No hay documentos creados aún. Crea uno primero.', 'info');
      return;
    }
    docSelect.innerHTML = '<option value="">-- Selecciona un documento --</option>';
    userDocs.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${doc.icon || '📄'} ${doc.title}`;
      docSelect.appendChild(option);
    });
  }

  populateInsertFileFolderSelect();
  
  document.getElementById('insert-file-input').value = '';
  document.getElementById('insert-file-preview').innerHTML = '';
  document.getElementById('insert-file-name-input').value = '';
  insertFileData = null;
  
  const fileInputElem = document.getElementById('insert-file-input');
  if (fileInputElem && !fileInputElem._hasListener) {
    fileInputElem.addEventListener('change', handleInsertFileSelect);
    fileInputElem._hasListener = true;
  }
  
  openModal('insert-file-modal');
}

export function selectDocForFileAttach(docId) {
  closeConfirmModal();
  
  editingDocId = docId;
  const doc = docs.find(d => sameId(d.id, docId));
  if (!doc) return;
  
  setEditingDocImages(doc.images || {});
  currentDocFile = doc.file || null;
  
  ensureDocModalElements();
  
  const parentGroup = document.getElementById('doc-parent-group');
  const iconPickerGroup = document.getElementById('doc-icon-picker-group');
  const categoryGroup = document.getElementById('doc-category-group');
  const contentGroup = document.getElementById('doc-content-group');
  const fileGroup = document.getElementById('doc-file-group');
  
  if (parentGroup) parentGroup.style.display = 'none';
  if (iconPickerGroup) iconPickerGroup.style.display = 'none';
  if (categoryGroup) categoryGroup.style.display = 'none';
  if (contentGroup) contentGroup.style.display = 'none';
  if (fileGroup) fileGroup.style.display = '';
  configureDocModalFooter('doc');
  setDocModalSaving(false);
  
  document.getElementById('doc-modal-title').textContent = `Adjuntar archivo a: ${doc.title}`;
  document.getElementById('doc-file-preview-container').innerHTML = '';
  
  if (currentDocFile) {
    updateDocFilePreview();
  }
  
  openModal('doc-modal');
}

export async function saveFolder() {
  if (_docModalSaving) return;
  setDocModalSaving(true, 'Guardando carpeta…');
  setDocsFormFeedback('doc-modal-feedback', '');
  try {
    const titleInput = document.getElementById('doc-title-input');
    const title = titleInput?.value?.trim() || '';
    if (!title) {
      showToast('El nombre de la carpeta es requerido','error');
      setDocsFormFeedback('doc-modal-feedback', 'El nombre de la carpeta es obligatorio.', 'error');
      setDocModalSaving(false);
      return;
    }
    
    // Intentar leer del custom select de Aurora primero
    let parentVal = 'null';
    const nativeSelect = document.getElementById('doc-parent-input');
    // El custom select Aurora guarda el valor en data-value del trigger
    const auroraSelect = document.querySelector('#doc-modal .aurora-select-trigger, #doc-modal [data-select-id="doc-parent-input"]');
    if (auroraSelect) {
      parentVal = auroraSelect.dataset.value || auroraSelect.getAttribute('data-value') || 'null';
    } else if (nativeSelect) {
      parentVal = nativeSelect.value || 'null';
    }
    const parentFolderId = parentVal === 'null' || parentVal === '' ? null : parentVal;
    const titleKey = normalizeTextKey(title);
    const duplicated = docs.some(d =>
      d.docType === 'folder' &&
      !sameId(d.id, editingDocId) &&
      sameId(d.parentFolderId, parentFolderId) &&
      normalizeTextKey(d.title) === titleKey &&
      (sameId(d.group, currentUser.group) || sameId(d.department, currentUser.group))
    );
    if (duplicated) {
      showToast('Ya existe una carpeta con ese nombre en esa ruta', 'warning');
      setDocsFormFeedback('doc-modal-feedback', 'Nombre de carpeta duplicado en la misma ubicación.', 'warning');
      setDocModalSaving(false);
      return;
    }
    
    const folder = {
      title,
      icon: document.getElementById('doc-icon-input').value || '📁',
      docType: 'folder',
      parentFolderId: parentFolderId,
      category: 'folder',
      content: '',
    };
    
    if (editingDocId) {
      const idx = docs.findIndex(d => sameId(d.id, editingDocId));
      if (idx !== -1) {
        const updated = {...docs[idx], ...folder};
        try {
          const mongoId = docs[idx]._id || docs[idx].id;
          await apiUpdateDoc(mongoId, updated);
        } catch (err) {
          console.error('Error actualizando carpeta:', err);
        }
        docs[idx] = updated;
        showToast('Carpeta actualizada','success');
      }
    } else {
      const newFolder = {
        id: Date.now(),
        ...folder,
        authorId: currentUser.id,
        group: currentUser.group,
        department: currentUser.group,
        createdAt: new Date().toISOString(),
      };
      try {
        const saved = await apiCreateDoc(newFolder);
        newFolder._id = saved._id;
        newFolder.id = saved._id || newFolder.id;
      } catch (err) {
        console.error('Error guardando carpeta en API:', err);
        showToast('Error al guardar en servidor', 'error');
        setDocsFormFeedback('doc-modal-feedback', 'No se pudo guardar la carpeta. Reintenta con conexión estable.', 'error');
        setDocModalSaving(false);
        return;
      }
      docs.push(newFolder);
      showToast('Carpeta creada','success');
    }
    
    currentDocFile = null;
    
    saveDocData();
    
    const contentArea = document.getElementById('doc-content-input')?.parentElement;
    const previewArea = document.getElementById('doc-content-preview')?.parentElement;
    if (contentArea) contentArea.style.display = '';
    if (previewArea) previewArea.style.display = '';
    
    closeModal('doc-modal');
    renderDocsFolderTree();
    renderDocsGrid();
    setDocModalSaving(false);
  } catch(err) {
    console.error('Error en saveFolder:', err);
    setDocModalSaving(false);
  }
}

function buildFolderBreadcrumb(folderId) {
  const crumbs = [];
  let current = folderId;
  while (current != null) {
    const folder = docs.find(d => sameId(d.id, current));
    if (!folder) break;
    crumbs.unshift({ id: folder.id, title: folder.title, icon: folder.icon || '📁' });
    current = folder.parentFolderId ?? null;
  }
  if (crumbs.length === 0) return '';
  const breadcrumbItems = crumbs.map(c => ({
    id: c.id,
    icon: c.icon || '📁',
    title: escapeChatHtml(c.title),
  }));
  return `<nav class="docs-breadcrumb">
  <span class="docs-breadcrumb-item docs-breadcrumb-root" onclick="selectDocFolder(null)">
    📁 Documentación
  </span>
  ${breadcrumbItems.map((item, i) => `
    <span class="docs-breadcrumb-sep">›</span>
    <span class="docs-breadcrumb-item ${i === breadcrumbItems.length-1 ? 'active' : ''}" 
      onclick="selectDocFolder('${item.id}')">
      ${item.icon || '📁'} ${item.title}
    </span>
  `).join('')}
</nav>`;
}

function getDocTemplatesKey() {
  return currentUser ? `diario_doc_templates_${currentUser.group}` : null;
}

export function loadDocTemplates() {
  const key = getDocTemplatesKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveDocTemplateFromCurrent() {
  const title = document.getElementById('doc-title-input')?.value.trim();
  const content = document.getElementById('doc-content-input')?.value.trim();
  if (!title && !content) {
    showToast('El documento está vacío', 'error');
    return;
  }
  const templates = loadDocTemplates();
  const key = getDocTemplatesKey();
  if (!key) return;
  templates.push({
    id: Date.now(),
    title: title || 'Sin título',
    content: content || '',
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(key, JSON.stringify(templates));
  showToast('Plantilla guardada', 'success');
}

export function deleteDocTemplate(id) {
  const key = getDocTemplatesKey();
  if (!key) return;
  const templates = loadDocTemplates().filter(t => t.id !== id);
  localStorage.setItem(key, JSON.stringify(templates));
  openDocTemplatesModal();
}

export function applyDocTemplate(id) {
  const t = loadDocTemplates().find(t => t.id === id);
  if (!t) return;
  const titleEl = document.getElementById('doc-title-input');
  const contentEl = document.getElementById('doc-content-input');
  if (titleEl) titleEl.value = t.title;
  if (contentEl) {
    contentEl.value = t.content;
    updateMarkdownPreview('doc-content-input', 'doc-content-preview', editingDocImages);
  }
  closeModal('doc-templates-modal');
  showToast('Plantilla aplicada', 'success');
}

export function openDocTemplatesModal() {
  const templates = loadDocTemplates();
  const listEl = document.getElementById('doc-templates-list-body');
  if (!listEl) return;
  if (templates.length === 0) {
    listEl.innerHTML = `<p class="modal-note-templates-empty">No hay plantillas aún. Abre un documento, rellénalo y pulsa <strong>Guardar como plantilla</strong> en el pie del formulario.</p>`;
  } else {
    listEl.innerHTML = templates.map(t => `
      <div class="doc-template-item">
        <div class="doc-template-info">
          <span class="doc-template-title">📄 ${escapeChatHtml(t.title)}</span>
        </div>
        <div class="doc-template-actions">
          <button type="button" class="btn-primary btn-sm" onclick="applyDocTemplate('${t.id}')">Usar</button>
          <button type="button" class="btn-secondary btn-sm" onclick="deleteDocTemplate('${t.id}')">Eliminar</button>
        </div>
      </div>`).join('');
  }
  openModal('doc-templates-modal');
}

export function openDocVersionsModal(docId) {
  const doc = docs.find(d => sameId(d.id, docId));
  if (!doc) return;
  const versions = loadDocVersions(docId);
  const listEl = document.getElementById('doc-versions-list');
  if (!listEl) return;
  const titleEl = document.getElementById('doc-versions-title');
  if (titleEl) titleEl.textContent = `Historial: ${doc.title}`;
  if (versions.length === 0) {
    listEl.innerHTML = `<p class="doc-versions-empty">No hay versiones guardadas aún. Las versiones se crean automáticamente cada vez que editas el documento.</p>`;
  } else {
    listEl.innerHTML = versions.map((v, i) => {
      const date = new Date(v.savedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const author = USERS.find(u => sameId(u.id, v.savedBy));
      return `
        <div class="doc-version-item">
          <div class="doc-version-meta">
            <span class="doc-version-num">v${versions.length - i}</span>
            <span class="doc-version-date">${date}</span>
            <span class="doc-version-author">${author ? escapeChatHtml(author.name) : '—'}</span>
          </div>
          <div class="doc-version-preview">${escapeChatHtml((v.content || '').slice(0, 120))}${(v.content || '').length > 120 ? '…' : ''}</div>
          <button type="button" class="btn-secondary btn-sm" onclick='restoreDocVersion(${JSON.stringify(docId)}, ${v.id})'>↩ Restaurar</button>
        </div>`;
    }).join('');
  }
  openModal('doc-versions-modal');
}

export function restoreDocVersion(docId, versionId) {
  const versions = loadDocVersions(docId);
  const v = versions.find(x => x.id === versionId);
  if (!v) return;
  showConfirmModal({
    title: '¿Restaurar esta versión?',
    message: 'El contenido actual se guardará como nueva versión antes de restaurar.',
    confirmLabel: 'Restaurar',
    onConfirm: () => {
      const idx = docs.findIndex(d => sameId(d.id, docId));
      if (idx === -1) return;
      saveDocVersion(docs[idx]);
      const updated = { ...docs[idx], content: v.content, title: v.title };
      const newDocs = [...docs];
      newDocs[idx] = updated;
      setDocs(newDocs);
      saveDocData();
      closeModal('doc-versions-modal');
      showToast('Versión restaurada', 'success');
      renderDocs();
    }
  });
}

if (typeof window !== 'undefined') {
  window.setDocCat = setDocCat;
}

