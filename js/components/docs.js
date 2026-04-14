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

export let currentDocCat = 'all';
export let currentDocFolderId = null;
export let currentDocFile = null;
export let editingDocId = null;
export let commentDraftImages = {};
let insertFileData = null;

export async function loadDocsFromAPI() {
  try {
    const data = await apiGetDocs();
    const mapped = data.map(d => ({
      ...d,
      id: d._id || d.id,
      group: d.department || d.group,
      parentFolderId: d.parentFolderId || null,
    }));
    setDocs(mapped);
    return mapped;
  } catch (err) {
    console.error('Error cargando docs desde API:', err);
    try {
      const local = localStorage.getItem('diario_docs');
      if (local) setDocs(JSON.parse(local));
    } catch {}
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
export let docsSortOrder = 'recent'; // 'recent' | 'name' | 'type'

export function setDocsViewMode(mode) {
  docsViewMode = mode;
  document.querySelectorAll('.docs-view-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  renderDocsGrid();
}

export function setDocsSortOrder(order) {
  docsSortOrder = order;
  document.querySelectorAll('.docs-sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === order);
  });
  renderDocsGrid();
}

export function renderDocs() {
  renderDocsFolderTree();
  renderDocsGrid();
}

export function filterDocsBySearch(term) {
  docsSearchTerm = (term || '').toLowerCase();
  applyDocsFilters();
}

export function applyDocsFilters() {
  docsTypeFilteru.notes = document.getElementById('docs-filter-notes')?.checked ?? true;
  docsTypeFilteru.urls = document.getElementById('docs-filter-urls')?.checked ?? true;
  docsTypeFilteru.files = document.getElementById('docs-filter-files')?.checked ?? true;
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
  renderDocs();
  document.querySelectorAll('.docs-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
}

export function renderDocsGrid() {
  const content = document.getElementById('docs-content');

  const lastDocId = currentUser ? localStorage.getItem(`diario_last_doc_${currentUser.id}`) : null;
  const lastDoc = lastDocId ? docs.find(d => sameId(d.id, lastDocId)) : null;
  const recentBannerHtml = (lastDoc && currentDocFolderId == null && !docsSearchTerm)
    ? `<div class="docs-recent-banner" onclick="viewDoc('${lastDoc.id}')" title="Abrir último documento visto">
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
            <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap">
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
          fileHtml += `<img src="${sharepointUrl}" style="max-width:100%;border-radius:8px" alt="${fileNameEscapeHtml(fileName)}">`;
        } else if (sharepointUrl && fileType === 'application/pdf') {
          fileHtml += `<iframe src="${sharepointUrl}" style="width:100%;height:600px;border:none;border-radius:8px"></iframe>`;
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
  
  let items = docs.filter(d => d.group === currentUser.group);
  
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

  if (items.length === 0) {
    content.innerHTML = `<div class="empty-state" style="padding:40px;text-align:center"><div class="empty-icon" style="font-size:48px;margin-bottom:16px">📁</div><div>No hay elementos en esta ubicación</div></div>`;
    return;
  }
  
  // Separate folders, documents, and files
  const folders = items.filter(d => d.docType === 'folder');
  const documents = items.filter(d => d.docType === 'document');
  const files = items.filter(d => d.docType === 'file');

  const sortItems = (arr) => {
    if (docsSortOrder === 'name') return [...arr].sort((a, b) => a.title.localeCompare(b.title, 'es'));
    if (docsSortOrder === 'type') return [...arr].sort((a, b) => (a.docType || '').localeCompare(b.docType || ''));
    return [...arr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  const sortedFolders = sortItems(folders);
  const sortedDocuments = sortItems(documents);
  const sortedFiles = sortItems(files);

  let html = '';
  
  // Show folder header with download button if viewing a folder
  if (currentFolder && currentFolder.docType === 'folder') {
    html += `
      <div style="background:rgba(107, 144, 128, 0.1);padding:20px;border-radius:8px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <h2 style="margin:0;font-size:20px;color:var(--text)">${currentFolder.icon || '📁'} ${currentFolder.title}</h2>
          <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted)">Contiene ${items.length} elementos</p>
        </div>
        <button onclick="downloadItem('${currentFolder.id}')" class="btn-action" style="white-space:nowrap">⬇️ Descargar Carpeta</button>
      </div>
    `;
  }
  
  if (currentDocFolderId != null) {
    html += buildFolderBreadcrumb(currentDocFolderId);
  }

  html += recentBannerHtml;
  html += `<div class="${docsViewMode === 'list' ? 'docs-list-modern' : 'docs-grid-modern'}">`;
  
  // Render folders first
  sortedFolders.forEach(folder => {
    const folderItems = docs.filter(d => sameId(d.parentFolderId, folder.id)).length;
    const date = new Date(folder.createdAt).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
    const author = USERS.find(u => u.id === folder.authorId);
    html += `<div class="docs-grid-item${docsViewMode === 'list' ? ' docs-list-item' : ''}" onclick="selectDocFolder('${folder.id}')" style="cursor:pointer">
      <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:24px">📁</span>
        <button class="doc-delete-btn" onclick="event.stopPropagation(); deleteDocElement('${folder.id}')" title="Eliminar">🗑</button>
      </div>
      <div class="doc-card-title" style="font-size:14px;font-weight:600;margin-bottom:4px">${folder.title}</div>
      <div class="doc-card-meta" style="font-size:11px;color:var(--text-muted);margin-bottom:auto">
        ${date} • <span>${author ? author.name : 'Desconocido'}</span>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e0e0e0;display:flex;gap:6px">
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); selectDocFolder('${folder.id}')" style="font-size:11px;padding:6px 12px;flex:1">📂 Abrir</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); editDocFolder('${folder.id}')" style="font-size:11px;padding:6px 12px">✏️</button>
      </div>
    </div>`;
  });
  
  // Render documents
  sortedDocuments.forEach(d => {
    const author = USERS.find(u => u.id === d.authorId);
    const date = new Date(d.createdAt).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
    html += `<div class="docs-grid-item${docsViewMode === 'list' ? ' docs-list-item' : ''}" onclick="selectDocFolder('${d.id}')" style="cursor:pointer">
      <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:24px">${d.icon || '📄'}</span>
        <button class="doc-delete-btn" onclick="event.stopPropagation(); deleteDocElement('${d.id}')" title="Eliminar">🗑</button>
      </div>
      <div class="doc-card-title" style="font-size:14px;font-weight:600;margin-bottom:4px">${d.title}</div>
      <div class="doc-card-meta" style="font-size:11px;color:var(--text-muted);margin-bottom:auto">
        ${date} • <span>${author ? author.name : '—'}</span>
      </div>
      ${commentIndicators('doc', d.id)}
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;gap:6px">
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); selectDocFolder('${d.id}')" style="font-size:11px;padding:6px 12px;flex:1">👁️ Ver</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); openDocCommentsModal('${d.id}')" style="font-size:11px;padding:6px 12px" title="Comentarios">💬</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); editDocument('${d.id}')" style="font-size:11px;padding:6px 12px">✏️</button>
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
    html += `<div class="docs-grid-item${docsViewMode === 'list' ? ' docs-list-item' : ''}" onclick="selectDocFolder('${d.id}')" style="cursor:pointer">
      <div style="position:relative;margin-bottom:8px">
        ${thumbHtml}
        <button class="doc-delete-btn" style="position:absolute;top:6px;right:6px" onclick="event.stopPropagation(); deleteDocElement('${d.id}')" title="Eliminar">🗑</button>
      </div>
      <div class="doc-card-title" style="font-size:14px;font-weight:600;margin-bottom:4px">${d.title}</div>
      <div class="doc-card-meta" style="font-size:11px;color:var(--text-muted);margin-bottom:auto">
        ${date} • <span>${author ? author.name : '—'}</span>
      </div>
      ${commentIndicators('doc', d.id)}
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e0e0e0;display:flex;gap:6px">
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); selectDocFolder('${d.id}')" style="font-size:11px;padding:6px 12px;flex:1">👁️ Ver</button>
        <button class="btn-secondary" type="button" onclick="event.stopPropagation(); downloadFile('${d.id}')" style="font-size:11px;padding:6px 12px">⬇️</button>
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
  console.log('viewDoc called with id:', id);
  const d = docs.find(doc => sameId(doc.id, id));
  console.log('found doc:', d);
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
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">
        <button type="button" class="btn-primary btn-full-width" onclick="openDocCommentsModal('${d.id}')">💬 Abrir comentarios</button>
      </div>
      <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap">
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
export function openProjectCommentsModal(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) return;
  openCommentsThreadModal('project', p.id, null, 'Comentarios: ' + p.name);
}
export function openTaskCommentsModal(projectId, taskId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const t = p && p.tasks ? p.tasks.find(x => sameId(x.id, taskId)) : null;
  openCommentsThreadModal('task', projectId, taskId, t ? 'Comentarios: ' + t.name : 'Comentarios');
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
  if (contentInput) {
    const group = contentInput.closest('.form-group');
    if (group && !group.id) group.id = 'doc-content-group';
  }
}

export function closeDocModalWithCleanup() {
  const contentArea = document.getElementById('doc-content-input')?.parentElement;
  const previewArea = document.getElementById('doc-content-preview')?.parentElement;
  if (contentArea) contentArea.style.display = '';
  if (previewArea) previewArea.style.display = '';
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
  const title = document.getElementById('doc-title-input')?.value.trim();
  if (!title) {
    showToast('El título es requerido', 'error');
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
      return;
    }
    setDocs([...docs, newDoc]);
    showToast('Documento creado', 'success');
  }

  currentDocFile = null;
  saveDocData();
  closeModal('doc-modal');
  renderDocs();
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
  populateDocParentSelect();
  document.getElementById('doc-icon-input').value = '📝';
  document.getElementById('doc-icon-btn').textContent = '📝';
  document.getElementById('doc-content-input').value = '';
  document.getElementById('doc-content-preview').innerHTML = '';
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
  populateDocParentSelect();
  const parentSel = document.getElementById('doc-parent-input');
  if (parentSel) {
    parentSel.value = d.parentFolderId == null ? 'null' : String(d.parentFolderId);
  }
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
  let html = filterHtml + '<div style="padding:4px 0">';
  html += `<div class="doc-tree-item ${currentDocFolderId==null?'active':''}" onclick="selectDocFolder(null)" style="padding:10px 12px;font-weight:500">
    <span style="font-size:14px">📁</span> <span>Todos</span>
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
      
      html += `<div style="margin-left:${indent}px;position:relative">\n`;
      html += `<div class="doc-tree-item ${isActive?'active':''}" style="padding:8px 12px;margin:2px 4px" onclick="selectDocFolder('${folder.id}')">\n`;
      
      // Toggle button
      if (hasChildren) {
        html += `<span class="doc-tree-toggle ${isCollapsed?'collapsed':''}" style="width:16px;flex-shrink:0;cursor:pointer" onclick="toggleDocFolderCollapse('${folder.id}', event)">▼</span>\n`;
      } else {
        html += `<span style="width:16px;flex-shrink:0"></span>\n`;
      }
      
      html += `<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">\n`;
      html += `<span style="font-size:14px;flex-shrink:0">📁</span>\n`;
      html += `<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:70px !important" title="${folder.title}">${folder.title}</span>\n`;
      html += `</div>\n`;
      html += `<div class="doc-actions-hover">\n`;
      html += `<button onclick="event.stopPropagation(); editDocFolder('${folder.id}')" title="Editar">✎</button>\n`;
      html += `<button onclick="event.stopPropagation(); deleteDocElement('${folder.id}')" title="Eliminar">🗑</button>\n`;
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
      
      html += `<div style="margin-left:${indent}px;position:relative">\n`;
      html += `<div class="doc-tree-item ${isActive?'active':''}" style="padding:8px 12px;margin:2px 4px" onclick="selectDocFolder('${item.id}')">\n`;
      html += `<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">\n`;
      html += `<span style="font-size:14px;flex-shrink:0">${itemIcon}</span>\n`;
      html += `<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:70px !important" title="${item.title}">${item.title}</span>\n`;
      html += `</div>\n`;
      html += `<div class="doc-actions-hover">\n`;
      if (item.docType === 'file') {
        html += `<button onclick="event.stopPropagation(); downloadFile('${item.id}')" title="Descargar">⬇️</button>\n`;
      }
      html += `<button onclick="event.stopPropagation(); deleteDocElement('${item.id}')" title="Eliminar">🗑</button>\n`;
      html += `</div>\n`;
      html += `</div>\n`;
      html += `</div>\n`;
    });
  }
  
  // Render from root
  renderTreeRecursive(null, 0);
  
  html += '</div>';
  html += `<div style="padding:8px;border-top:1px solid var(--border);margin-top:8px">`;
  html += `<button class="btn-primary" onclick="openCreateFolderModal()" style="width:100%;padding:8px 12px;font-size:12px;cursor:pointer">+ Nueva Carpeta</button>`;
  html += `</div>`;
  container.innerHTML = html;
  document.querySelectorAll('.docs-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === currentDocCat);
  });
}

export function selectDocFolder(folderId) {
  currentDocFolderId = folderId === null ? null : folderId;
  renderDocsFolderTree();
  renderDocsGrid();
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
    console.log('Descargando carpeta como ZIP:', zipName);
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
  console.log('handleInsertFileSelect llamado', event?.target?.files?.[0]?.name);
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
  console.log('insertFileData creado:', {
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
    <div class="file-preview" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px;margin-top:8px">
      <div style="font-size:32px">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;word-break:break-all">${fileNameEscapeHtml(insertFileData.name)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${sizeStr}</div>
      </div>
      <button type="button" class="btn-icon" onclick="clearInsertFile()" style="padding:6px;font-size:16px">✕</button>
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
  console.log('confirmInsertFile llamado, insertFileData:', insertFileData?.name, 'rawFile:', !!insertFileData?.rawFile);
  let folderId = 'null';

  // Leer del custom select Aurora — buscar la opción seleccionada
  const selectedOption = document.querySelector('#insert-file-modal .custom-select-option.selected');
  if (selectedOption) {
    folderId = selectedOption.dataset.value || 'null';
    console.log('Valor del custom select Aurora:', folderId);
  } else {
    // Fallback al select nativo
    const nativeSelect = document.getElementById('insert-file-folder-select');
    folderId = nativeSelect?.value || 'null';
    console.log('Valor del select nativo:', folderId);
  }

  const parentFolderId = folderId === 'null' || folderId === '' ? null : folderId;
  const displayName = document.getElementById('insert-file-display-name').value.trim();
  const customName = document.getElementById('insert-file-name-input').value.trim();
  const selectedIcon = document.getElementById('insert-file-icon-input')?.value || document.getElementById('insert-file-icon-selected')?.value || '📎';
  
  if (!displayName) {
    showToast('Ingresa el nombre del archivo', 'error');
    return;
  }
  
  if (!insertFileData) {
    showToast('Selecciona un archivo', 'error');
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

  console.log('Verificando rawFile antes de subir:', !!insertFileData?.rawFile);
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
    return;
  }
  
  docs.push(newFile);
  saveDocData();
  closeModal('insert-file-modal');
  renderDocs();
  showToast(`Archivo "${displayName}" guardado correctamente`, 'success');
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
    iconInput.value = '📁';
    iconBtn.textContent = '📁';
    contentInput.value = '';

    populateDocParentSelect();

    const contentArea = contentInput.parentElement;
    const previewArea = contentPreview.parentElement;
    if (contentArea) contentArea.style.display = 'none';
    if (previewArea) previewArea.style.display = 'none';
    
    openModal('doc-modal');
  } catch (err) {
    console.error('[openCreateFolderModal] Error:', err.message);
    showToast('Error: ' + err.message, 'error');
  }
}

export function openInsertFileModal() {
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
  
  document.getElementById('doc-modal-title').textContent = `Adjuntar archivo a: ${doc.title}`;
  document.getElementById('doc-file-preview-container').innerHTML = '';
  
  if (currentDocFile) {
    updateDocFilePreview();
  }
  
  openModal('doc-modal');
}

export async function saveFolder() {
  try {
    const titleInput = document.getElementById('doc-title-input');
    const title = titleInput?.value?.trim() || '';
    if (!title) { showToast('El nombre de la carpeta es requerido','error'); return; }
    
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
  } catch(err) {
    console.error('Error en saveFolder:', err);
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
  const parts = [
    `<span class="breadcrumb-item" onclick="selectDocFolder(null)" style="cursor:pointer">📁 Raíz</span>`
  ];
  crumbs.forEach((c, i) => {
    parts.push(`<span class="breadcrumb-sep">›</span>`);
    if (i === crumbs.length - 1) {
      parts.push(`<span class="breadcrumb-item breadcrumb-item--active">${c.icon} ${escapeChatHtml(c.title)}</span>`);
    } else {
      parts.push(`<span class="breadcrumb-item" onclick="selectDocFolder('${c.id}')" style="cursor:pointer">${c.icon} ${escapeChatHtml(c.title)}</span>`);
    }
  });
  return `<nav class="docs-breadcrumb">${parts.join('')}</nav>`;
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
    listEl.innerHTML = `<p style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center">No hay versiones guardadas aún. Las versiones se crean automáticamente cada vez que editas el documento.</p>`;
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

