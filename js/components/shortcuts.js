// ===== SHORTCUTS MODULE =====
import { shortcuts, shortcutsScope, currentUser, sameId, makeImageKey, registerTempImage, setShortcutsScope, setShortcuts } from './data.js';
import { showToast, openModal, closeModal } from './modalControl.js';
import { handleSlashCommand } from './notes.js';
import { updateMarkdownPreview } from './docs.js';
import { escapeChatHtml } from './modalControl.js';

function clearShortcutDraft() {
  const urlEl = document.getElementById('shortcut-url-input');
  const labelEl = document.getElementById('shortcut-label-input');
  const iconEl = document.getElementById('shortcut-icon-input');
  const iconUrlEl = document.getElementById('shortcut-icon-url-input');
  const iconFileEl = document.getElementById('shortcut-icon-file-input');
  const fileEl = document.getElementById('shortcut-file-input');
  const fileNameEl = document.getElementById('shortcut-file-name');
  const bgEl = document.getElementById('shortcut-bg-input');
  if (urlEl) urlEl.value = '';
  if (labelEl) labelEl.value = '';
  if (iconEl) iconEl.value = '🔗';
  if (iconUrlEl) iconUrlEl.value = '';
  if (iconFileEl) iconFileEl.value = '';
  if (fileEl) fileEl.value = '';
  if (fileNameEl) fileNameEl.textContent = 'Ningún archivo seleccionado';
  if (bgEl) bgEl.value = '#ffffff';
  toggleShortcutIconPicker(false);
}

function toggleShortcutAddPanel() {
  const panel = document.getElementById('shortcut-add-panel');
  const btn = document.getElementById('shortcut-toggle-btn');
  const layout = document.querySelector('.shortcuts-layout');
  if (!panel) return;
  panel.classList.toggle('hidden');
  const open = !panel.classList.contains('hidden');
  if (btn) {
    btn.textContent = open ? '✕ Cerrar formulario' : '+ Nuevo acceso';
    btn.classList.toggle('btn-success', open);
    btn.classList.toggle('btn-primary', !open);
  }
  if (layout) layout.classList.toggle('collapsed', !open);
}

function onShortcutIconModeChange() {
  const mode = document.getElementById('shortcut-icon-mode')?.value || 'emoji';
  const emojiInput = document.getElementById('shortcut-icon-input');
  const urlInput = document.getElementById('shortcut-icon-url-input');
  const fileInput = document.getElementById('shortcut-icon-file-input');
  const pickerWrap = document.getElementById('shortcut-icon-picker-wrap');
  if (!emojiInput || !urlInput || !fileInput || !pickerWrap) return;
  if (mode === 'url') {
    emojiInput.classList.add('hidden');
    pickerWrap.classList.add('hidden');
    urlInput.classList.remove('hidden');
    fileInput.classList.add('hidden');
  } else if (mode === 'upload') {
    emojiInput.classList.add('hidden');
    pickerWrap.classList.add('hidden');
    urlInput.classList.add('hidden');
    fileInput.classList.remove('hidden');
  } else {
    emojiInput.classList.remove('hidden');
    pickerWrap.classList.remove('hidden');
    urlInput.classList.add('hidden');
    fileInput.classList.add('hidden');
    ensureShortcutIconPickerGrid();
  }
  toggleShortcutIconPicker(false);
}

function pickShortcutEmoji(emoji) {
  const el = document.getElementById('shortcut-icon-input');
  if (el) el.value = emoji;
  toggleShortcutIconPicker(false);
}

function ensureShortcutIconPickerGrid() {
  const grid = document.getElementById('shortcut-icon-picker-grid');
  if (!grid || grid.dataset.ready === '1') return;
  const icons = ['🔗','📌','📎','📁','📂','📄','📝','📊','📅','🧭','⚙️','🛠️','💼','📨','📬','🌐','🖥️','💻','📱','🧪','🛡️','🔒','🧷','📡','🗂️','📚','🗃️','🧾','🧰','🎯','✅','🚀','📈','📉','🗄️','🔔','☎️','📞','📟','🧠','🗓️','🛰️','🧱','🧩','🔍','📍','💡','🧵'];
  grid.innerHTML = icons.map(icon => `<button type="button" class="shortcut-icon-option" onclick="pickShortcutEmoji('${icon.replace(/'/g, "\\'")}')" title="Usar ${icon}">${icon}</button>`).join('');
  grid.dataset.ready = '1';
}

function toggleShortcutIconPicker(forceOpen = null) {
  const grid = document.getElementById('shortcut-icon-picker-grid');
  const btn = document.querySelector('.shortcut-icon-picker-btn');
  if (!grid || !btn) return;
  const open = forceOpen == null ? grid.classList.contains('hidden') : !!forceOpen;
  grid.classList.toggle('hidden', !open);
  btn.textContent = open ? 'Elegir icono ▴' : 'Elegir icono ▾';
}

function onShortcutsScopeChange() {
  const sel = document.getElementById('shortcuts-scope');
  setShortcutsScope(sel ? sel.value : 'group');
  renderShortcuts();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleShortcutFileSelected(event) {
  const file = event?.target?.files?.[0];
  const fileNameEl = document.getElementById('shortcut-file-name');
  if (fileNameEl) fileNameEl.textContent = file ? file.name : 'Ningún archivo seleccionado';
  if (!file || !currentUser) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const scopeEl = document.getElementById('shortcuts-scope');
    const scope = scopeEl ? scopeEl.value : 'group';
    const icon = file.type.includes('pdf') ? '📄' : (file.type.includes('word') ? '📝' : (file.type.includes('excel') ? '📊' : '📎'));
    shortcuts.push({
      id: Date.now(),
      url: dataUrl,
      label: file.name,
      icon,
      iconUrl: '',
      isFile: true,
      fileName: file.name,
      fileType: file.type || '',
      bgColor: '#ffffff',
      group: currentUser.group,
      userId: scope === 'me' ? currentUser.id : null,
      createdAt: new Date().toISOString(),
    });
    saveShortcuts();
    renderShortcuts();
    showToast('Archivo añadido como acceso directo', 'success');
  } catch {
    showToast('No se pudo cargar el archivo', 'error');
  }
}

async function handleShortcutIconUpload(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('El icono debe ser una imagen', 'error');
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const iconUrlEl = document.getElementById('shortcut-icon-url-input');
    const modeEl = document.getElementById('shortcut-icon-mode');
    if (iconUrlEl) iconUrlEl.value = dataUrl;
    if (modeEl) modeEl.value = 'url';
    onShortcutIconModeChange();
    showToast('Icono cargado', 'success');
  } catch {
    showToast('No se pudo cargar el icono', 'error');
  }
}

function addShortcut() {
  if (!currentUser) return;
  const url = document.getElementById('shortcut-url-input')?.value?.trim();
  const label = document.getElementById('shortcut-label-input')?.value?.trim();
  const iconMode = document.getElementById('shortcut-icon-mode')?.value || 'emoji';
  const icon = document.getElementById('shortcut-icon-input')?.value?.trim() || '🔗';
  const iconUrl = document.getElementById('shortcut-icon-url-input')?.value?.trim() || '';
  const bgColor = document.getElementById('shortcut-bg-input')?.value || '#ffffff';
  if (!url) { showToast('URL requerida','error'); return; }

  // Muy simple validación
  if (!/^https?:\/\//i.test(url)) {
    showToast('La URL debe empezar por http:// o https://','error');
    return;
  }

  const scopeEl = document.getElementById('shortcuts-scope');
  const scope = scopeEl ? scopeEl.value : 'group';

  shortcuts.push({
    id: Date.now(),
    url,
    label: label || url,
    icon,
    iconMode,
    iconUrl: (iconMode === 'url' || iconMode === 'upload') ? iconUrl : '',
    isFile: false,
    fileName: '',
    fileType: '',
    bgColor,
    group: currentUser.group,
    userId: scope === 'me' ? currentUser.id : null,
    createdAt: new Date().toISOString(),
  });
  saveShortcuts();
  clearShortcutDraft();
  renderShortcuts();
  showToast('Acceso directo añadido','success');
}

function deleteShortcut(id) {
  if (!confirm('¿Eliminar este acceso directo?')) return;
  setShortcuts(shortcuts.filter(s => !sameId(s.id, id)));
  saveShortcuts();
  renderShortcuts();
  showToast('Acceso directo eliminado','info');
}

let _editingShortcutId = null;
function openEditShortcutModal(id) {
  const s = shortcuts.find(x => sameId(x.id, id));
  if (!s) return;
  _editingShortcutId = id;
  document.getElementById('edit-shortcut-label').value = s.label || '';
  document.getElementById('edit-shortcut-url').value = s.url || '';
  document.getElementById('edit-shortcut-icon').value = s.icon || '🔗';
  document.getElementById('edit-shortcut-bg').value = s.bgColor || '#ffffff';
  openModal('edit-shortcut-modal');
}

function saveEditShortcut() {
  const s = shortcuts.find(x => sameId(x.id, _editingShortcutId));
  if (!s) return;
  const label = document.getElementById('edit-shortcut-label').value.trim();
  const url = document.getElementById('edit-shortcut-url').value.trim();
  if (!url) { showToast('La URL es requerida','error'); return; }
  s.label = label || url;
  s.url = url;
  s.icon = document.getElementById('edit-shortcut-icon').value.trim() || '🔗';
  s.bgColor = document.getElementById('edit-shortcut-bg').value;
  saveShortcuts();
  closeModal('edit-shortcut-modal');
  renderShortcuts();
  showToast('Acceso directo actualizado','success');
}

function renderShortcuts() {
  const listEl = document.getElementById('shortcuts-list');
  if (!listEl || !currentUser) return;

  const sel = document.getElementById('shortcuts-scope');
  const scope = sel ? sel.value : shortcutsScope;

  const visible = shortcuts
    .filter(s => s.group === currentUser.group)
    .filter(s => scope === 'me' ? sameId(s.userId, currentUser.id) : s.userId == null)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listEl.innerHTML = visible.length === 0
    ? '<div class="comments-empty">Sin accesos directos para este filtro.</div>'
    : visible.map(s => `
        <div class="shortcut-item" style="--shortcut-bg:${s.bgColor || '#ffffff'}">
          <div class="shortcut-thumb">${s.iconUrl ? `<img src="${s.iconUrl}" alt="icon">` : `<span class="shortcut-icon">${s.icon || '🔗'}</span>`}</div>
          <a href="${s.url}" target="_blank" rel="noopener" ${s.isFile ? `download="${escapeChatHtml(s.fileName || s.label || 'archivo')}"` : ''} style="display:block;text-decoration:none;color:inherit">
            <div class="shortcut-main">
              <span class="shortcut-title">${escapeChatHtml(s.label || s.url)}</span>
              <span class="shortcut-url">${escapeChatHtml(s.isFile ? (s.fileName || 'archivo local') : s.url)}</span>
            </div>
          </a>
          <div class="shortcut-card-footer">
            <span class="shortcut-scope-badge">${s.userId == null ? 'Grupo' : 'Solo yo'}</span>
            <div class="shortcut-card-actions">
              ${s.isFile ? `<button type="button" class="shortcut-action-btn" onclick="openShortcutPreview(${s.id})">Vista</button>` : ''}
              <button type="button" class="shortcut-action-btn" onclick="openEditShortcutModal(${s.id})">✏️</button>
              <a class="shortcut-action-btn" href="${s.url}" target="_blank" rel="noopener" ${s.isFile ? `download="${escapeChatHtml(s.fileName || s.label || 'archivo')}"` : ''} style="text-decoration:none">Abrir</a>
              <button type="button" class="shortcut-action-btn" onclick="deleteShortcut(${s.id})">✕</button>
            </div>
          </div>
        </div>
      `).join('');
}

function openShortcutPreview(id) {
  const s = shortcuts.find(x => sameId(x.id, id));
  if (!s || !s.isFile) return;
  const titleEl = document.getElementById('shortcut-preview-title');
  const bodyEl = document.getElementById('shortcut-preview-body');
  if (!bodyEl) return;
  if (titleEl) titleEl.textContent = `Vista previa: ${s.fileName || s.label || 'archivo'}`;

  const type = s.fileType || '';
  if (type.startsWith('image/')) {
    bodyEl.innerHTML = `<img src="${s.url}" alt="${escapeChatHtml(s.fileName || 'imagen')}" style="max-width:100%;border-radius:8px">`;
  } else if (type === 'application/pdf') {
    bodyEl.innerHTML = `<iframe src="${s.url}" style="width:100%;height:65vh;border:1px solid var(--border);border-radius:8px"></iframe>`;
  } else if (type.startsWith('text/')) {
    bodyEl.innerHTML = `<iframe src="${s.url}" style="width:100%;height:55vh;border:1px solid var(--border);border-radius:8px"></iframe>`;
  } else {
    bodyEl.innerHTML = `
      <div class="empty-state" style="padding:24px">
        <div class="empty-icon">📎</div>
        <div>No hay vista previa para este tipo de archivo.</div>
        <a class="btn-primary" href="${s.url}" download="${escapeChatHtml(s.fileName || s.label || 'archivo')}" style="margin-top:10px;text-decoration:none">Descargar</a>
      </div>
    `;
  }
  openModal('shortcut-preview-modal');
}

function togglePreview(previewId, toggleBtnId) {
  const preview = document.getElementById(previewId);
  const btn = document.getElementById(toggleBtnId);
  if (!preview || !btn) return;
  if (preview.style.display === 'none') {
    preview.style.display = 'block';
    btn.textContent = 'Ocultar preview';
  } else {
    preview.style.display = 'none';
    btn.textContent = 'Mostrar preview';
  }
}

function handleDroppedImages(files, textAreaId, previewId, imageMap) {
  const textarea = document.getElementById(textAreaId);
  if (!textarea) return;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const textAfter = textarea.value.substring(cursorPos);

  Array.from(files).forEach((file, index) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(event) {
      const dataUrl = event.target.result;
      const altText = prompt('Texto alternativo para la imagen', 'Imagen') || 'Imagen';
      const key = makeImageKey();
      registerTempImage(key, dataUrl);
      imageMap[key] = dataUrl;
      const insertText = `![${altText}](${key})`;
      if (index === 0) {
        textarea.value = textBefore + insertText + textAfter;
      } else {
        textarea.value += '\n' + insertText;
      }
      updateMarkdownPreview(textAreaId, previewId, imageMap);
    };
    reader.readAsDataURL(file);
  });
}

function attachDragDropHandler(textAreaId, previewId, imageMap) {
  const textarea = document.getElementById(textAreaId);
  if (!textarea) return;

  textarea.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  textarea.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      handleDroppedImages(e.dataTransfer.files, textAreaId, previewId, imageMap);
    }
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSlashMenu();
  });

  textarea.addEventListener('keyup', (e) => {
    if (e.key === '/' || e.key === 'Backspace' || e.key.match(/[a-z]/i)) {
      handleSlashCommand(textarea, previewId, imageMap);
    }
  });
}

// ===== SCATTERED FUNCTIONS =====

// From lines 4688-4699
function reloadShortcutsFromStorage() {
  try {
    const raw = localStorage.getItem('diario_shortcuts');
    let next = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(next)) next = [];
    setShortcuts(next);
  } catch {
    setShortcuts([]);
  }
}

function saveShortcuts() {
  localStorage.setItem('diario_shortcuts', JSON.stringify(shortcuts));
}

export {
  clearShortcutDraft,
  toggleShortcutAddPanel,
  onShortcutIconModeChange,
  pickShortcutEmoji,
  ensureShortcutIconPickerGrid,
  toggleShortcutIconPicker,
  onShortcutsScopeChange,
  readFileAsDataUrl,
  handleShortcutFileSelected,
  handleShortcutIconUpload,
  addShortcut,
  deleteShortcut,
  openEditShortcutModal,
  saveEditShortcut,
  renderShortcuts,
  openShortcutPreview,
  togglePreview,
  handleDroppedImages,
  attachDragDropHandler,
  reloadShortcutsFromStorage,
  saveShortcuts
};