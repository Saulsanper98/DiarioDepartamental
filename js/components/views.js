// ===== VIEWS MODULE =====

// Import required dependencies
import { currentUser, currentView, currentNoteView, currentDate, weekOffset, activeShiftFilters, searchQuery, notes, USERS, sameId, toDateStr, setCurrentView, setCurrentNoteView, setCurrentDate, workGroups, wgInvites, setWorkGroups, setWgInvites, CORE_DEPARTMENT_GROUPS, setActiveShiftFilters, setSearchQuery, setSearchNotesAllDates, setProjectUserFilter, setWeekOffset } from './data.js';
import { renderThemeGrid } from './themes.js';
import { showToast, escapeChatHtml, openModal, closeModal, showConfirmModal } from './modalControl.js';
import { renderNotes, renderPublicNotes, userCanSeeNote } from './notes.js';
import { loadReadMentions, saveReadMentions } from './mentionsRead.js';
import { renderProjects, userIsActiveWorkGroupMember } from './projects.js';
import { renderPostitBoard } from './postit.js';
import { renderDocs } from './docs.js';
import { renderChat, updateChatNavBadge } from './chat.js';
import { renderShortcuts, onShortcutIconModeChange } from './shortcuts.js';
import { renderWhiteboard } from './whiteboard.js';
import { renderSettingsEditor, updateWorkGroupInviteNavBadge } from './login.js';

export { loadReadMentions, saveReadMentions };

// ===== VIEW CONSTANTS =====
const VIEWS = ['notes','public-notes','my-groups','postit','projects','docs','chat','shortcuts','settings','whiteboard'];

// ===== VIEW HTML TEMPLATES =====
// Contenido alineado con diario_departamental_v2.html (vistas dentro de <main>, ~líneas 3479–3846).

/**
 * Get HTML template for a specific view
 * @param {string} view - View name
 * @returns {string} HTML string for the view
 */
function getViewHTML(view) {
  switch(view) {
    case 'notes':
      return `
        <div class="topbar">
          <h2 id="view-title">Todas las Notas</h2>
          <div class="notes-search-wrap">
            <div class="search-bar">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Buscar notas…" id="search-input" oninput="handleSearch(this.value)">
            </div>
            <label class="notes-search-history-toggle" title="Con el buscador relleno, incluye todas las fechas">
              <input type="checkbox" id="notes-search-history" class="notes-search-history-input" onchange="onNotesSearchHistoryChange(this)">
              <span class="notes-search-history-track" aria-hidden="true"><span class="notes-search-history-thumb"></span></span>
              <span class="notes-search-history-caption">Historial completo</span>
            </label>
          </div>
          <div class="topbar-notes-actions">
            <div class="export-toolbar-wrap" title="Exportar notas del día, semana o mes como archivo de texto">
              <span class="export-toolbar-label export-toolbar-label--notes-inline">Exportar</span>
              <div class="export-btn-group">
                <button type="button" class="export-btn" onclick="exportNotes('day')" title="Descargar notas del día como archivo de texto">📄 Día</button>
                <button type="button" class="export-btn" onclick="exportNotes('week')" title="Descargar notas de la semana">📅 Semana</button>
                <button type="button" class="export-btn" onclick="exportNotes('month')" title="Descargar notas del mes">🗓 Mes</button>
              </div>
            </div>
            <div style="position:relative">
              <button class="notif-btn" title="Notificaciones">🔔<span class="notif-badge hidden" id="notif-badge"></span></button>
            </div>
            <button type="button" class="btn-topbar-templates" onclick="openNoteTemplatesModal()" title="Plantillas de nota guardadas en este equipo">
              <span class="btn-topbar-templates-icon" aria-hidden="true">📋</span><span class="btn-topbar-templates-text">Plantillas</span>
            </button>
            <button type="button" class="btn-action" onclick="openNewNoteModal()">✏️ Nueva Nota</button>
          </div>
        </div>

        <div class="stats-bar">
          <div class="stat-item"><strong id="stat-total">0</strong> notas hoy</div>
          <div class="stat-item"><strong id="stat-morning" style="color:var(--morning)">0</strong> mañana</div>
          <div class="stat-item"><strong id="stat-afternoon" style="color:var(--afternoon)">0</strong> tarde</div>
          <div class="stat-item"><strong id="stat-night" style="color:var(--night)">0</strong> noche</div>
        </div>

        <div class="date-nav">
          <button class="date-nav-btn" onclick="navigateWeek(-1)">◀</button>
          <div class="date-chips" id="date-chips"></div>
          <button class="date-nav-btn" onclick="navigateWeek(1)">▶</button>
        </div>

        <div class="notes-area" id="notes-area"></div>
      `;
    case 'public-notes':
      return `
        <div class="topbar">
          <h2>🌐 Notas Públicas</h2>
          <p style="font-size:11px;color:var(--text-muted);max-width:520px;line-height:1.5">Solo verás notas marcadas como públicas que estén compartidas contigo, con tu departamento de forma explícita o con un grupo de trabajo del que formes parte. No hay listado global.</p>
        </div>
        <div class="notes-area" id="public-notes-area" style="flex:1"></div>
      `;
    case 'my-groups':
      return `
        <div class="topbar">
          <h2>👥 Mis Grupos de Trabajo</h2>
          <span style="font-size:11px;color:var(--text-muted)">Crea equipos para colaborar entre departamentos.</span>
        </div>
        <div style="padding:0 24px 16px;border-bottom:1px solid var(--border);background:var(--surface)">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;max-width:720px">
            <div class="form-group" style="flex:1;min-width:200px;margin:0">
              <label class="form-label">Nombre del grupo</label>
              <input type="text" class="form-input" id="wg-new-name" placeholder="Ej. Proyecto transversal Q2">
            </div>
            <button type="button" class="btn-primary" onclick="createWorkGroup()">+ Crear grupo</button>
            <button type="button" class="btn-secondary" onclick="openWorkGroupInvitesModal()" title="Invitaciones pendientes a grupos">📩 Invitaciones</button>
          </div>
        </div>
        <div class="my-groups-grid" id="my-groups-root"></div>
      `;
    case 'postit':
      return `
        <div class="postit-toolbar">
          <h2>🗂 Post-it Board</h2>
          <button class="btn-primary" onclick="openNewPostitModal()">+ Nueva Tarjeta</button>
        </div>
        <div class="postit-board" id="postit-board"></div>
      `;
    case 'projects':
      return `
        <div class="topbar">
          <h2>🎯 Proyectos & Tareas</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="button" class="btn-secondary" onclick="openMyWorkTasksView()">📋 Mis tareas</button>
            <button class="btn-action" onclick="openNewProjectModal()">🎯 Nuevo Proyecto</button>
          </div>
        </div>
        <div class="project-user-filter" id="project-user-filter">
          <span class="puf-label">Filtrar por:</span>
          <!-- pills injected by JS -->
        </div>
        <div class="projects-layout">
          <div class="projects-list-panel">
            <div class="projects-panel-header">
              <h3>Proyectos</h3>
              <span id="projects-count" style="font-size:11px;color:var(--text-muted)">0</span>
            </div>
            <div class="projects-items" id="projects-list"></div>
          </div>
          <div class="project-detail-panel" id="project-detail">
            <div class="empty-state"><div class="empty-icon">🎯</div><div>Selecciona un proyecto para ver sus detalles</div></div>
          </div>
        </div>
      `;
    case 'docs':
      return `
        <div class="topbar">
          <h2>📚 Documentación & Manuales</h2>
          <div class="search-bar" style="width:300px">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Buscar en docs..." id="docs-search-input" oninput="filterDocsBySearch(this.value)">
          </div>
          <button class="btn-action" onclick="openCreateFolderModal()">📁 Nueva Carpeta</button>
          <button class="btn-action" onclick="openNewDocModal()">📝 Nuevo Doc</button>
          <button class="btn-action" onclick="openInsertFileModal()" title="Adjuntar archivo a documento">📎 Insertar Archivo</button>
        </div>
        <div class="docs-toolbar">
          <div style="display:flex; gap:8px; align-items:center; padding:0 24px; font-size:11px; color:var(--text-muted)">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
              <input type="checkbox" id="docs-filter-notes" checked onchange="applyDocsFilters()"> 📝 Notas
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
              <input type="checkbox" id="docs-filter-urls" checked onchange="applyDocsFilters()"> 🔗 URLs
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
              <input type="checkbox" id="docs-filter-files" checked onchange="applyDocsFilters()"> 📎 Archivos
            </label>
          </div>
        </div>
        <div class="docs-layout">
          <div class="docs-sidebar">
            <div class="docs-panel-header"><h3>Carpetas</h3></div>
            <div class="docs-categories" id="docs-categories"></div>
          </div>
          <div class="docs-content" id="docs-content"></div>
          <div class="doc-full-view" id="doc-full-view"></div>
        </div>
      `;
    case 'shortcuts':
      return `
        <div class="topbar">
          <h2>🔗 Accesos Directos</h2>
          <div style="display:flex;gap:8px;align-items:center">
            <select class="form-select" id="shortcuts-scope" style="width:auto" onchange="onShortcutsScopeChange()">
              <option value="group">Grupo</option>
              <option value="me">Solo yo</option>
            </select>
            <button class="btn-primary" id="shortcut-toggle-btn" type="button" onclick="toggleShortcutAddPanel()">+ Nuevo acceso</button>
          </div>
        </div>
        <div class="shortcuts-layout">
          <div class="shortcuts-list" id="shortcuts-list"></div>
          <div class="shortcuts-form">
            <div id="shortcut-add-panel" class="hidden">
            <div class="form-group">
              <label class="form-label">Título (opcional)</label>
              <input class="form-input" id="shortcut-label-input" type="text" placeholder="Ej: Inventario, Jira, etc">
            </div>
            <div class="form-group" style="margin-top:10px">
              <label class="form-label">URL</label>
              <input class="form-input" id="shortcut-url-input" type="text" placeholder="https://...">
            </div>
            <div class="form-group" style="margin-top:10px">
              <label class="form-label">Icono (opcional)</label>
              <div class="form-row" style="align-items:center">
                <select class="form-select" id="shortcut-icon-mode" onchange="onShortcutIconModeChange()">
                  <option value="emoji">Selector</option>
                  <option value="url">URL de icono</option>
                  <option value="upload">Subir icono</option>
                </select>
                <input class="form-input hidden" id="shortcut-icon-input" type="text" placeholder="🔗" readonly>
              </div>
              <div class="shortcut-icon-picker-wrap" id="shortcut-icon-picker-wrap">
                <button type="button" class="btn-secondary shortcut-icon-picker-btn" onclick="toggleShortcutIconPicker()">Elegir icono ▾</button>
                <button type="button" class="btn-secondary" onclick="document.getElementById('shortcut-icon-file-input').click()" style="margin-left:8px">Subir icono desde PC</button>
                <div id="shortcut-icon-picker-grid" class="shortcut-icon-grid hidden"></div>
              </div>
              <input class="form-input hidden" id="shortcut-icon-url-input" type="text" placeholder="https://.../icon.png" style="margin-top:8px">
              <input class="form-input hidden" id="shortcut-icon-file-input" type="file" accept="image/*" onchange="handleShortcutIconUpload(event)" style="margin-top:8px">
            </div>
            <div class="form-group" style="margin-top:10px">
              <label class="form-label">Archivo (opcional)</label>
              <div class="shortcut-file-picker">
                <label for="shortcut-file-input" class="shortcut-file-btn">Seleccionar archivo</label>
                <span id="shortcut-file-name" class="shortcut-file-name">Ningún archivo seleccionado</span>
              </div>
              <input class="shortcut-file-hidden" id="shortcut-file-input" type="file" onchange="handleShortcutFileSelected(event)">
            </div>
            <div class="form-group" style="margin-top:10px">
              <label class="form-label">Fondo de tarjeta (RGB)</label>
              <input class="form-input" id="shortcut-bg-input" type="color" value="#ffffff" style="height:42px;cursor:pointer">
            </div>
            <div style="display:flex;gap:10px;margin-top:14px">
              <button class="btn-secondary" type="button" onclick="clearShortcutDraft()" style="flex:1">Limpiar</button>
              <button class="btn-primary" type="button" onclick="addShortcut()" style="flex:1">Añadir</button>
            </div>
            <div style="margin-top:10px;font-size:11px;color:var(--text-muted);line-height:1.4">
              Guardado en este navegador. Se filtra por grupo o solo para ti.
            </div>
            </div>
          </div>
        </div>
      `;
    case 'chat':
      return `
        <div class="topbar">
          <h2>💬 Chat</h2>
      <div style="display:flex;align-items:center;gap:8px; margin-left:auto">
        <button class="btn-secondary" onclick="openNewChatModal()" title="Abrir nuevo chat">➕ Nuevo chat</button>
      </div>
      <span style="font-size:11px;color:var(--text-muted)">Canal privado de tu departamento · MD con cualquier compañero · Datos en este navegador</span>
        </div>
        <div class="chat-layout">
          <div class="chat-thread-list">
            <div class="chat-thread-buttons" id="chat-thread-buttons"></div>
          </div>
          <div class="chat-main">
            <div style="display:flex;justify-content:flex-end;padding:10px 16px 0">
              <button class="btn-secondary hidden" id="chat-close-opened-btn" onclick="closeCurrentChatThread()" title="Cerrar conversación">✕ Cerrar conversación</button>
            </div>
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-compose">
              <div class="chat-pending-links" id="chat-pending-links"></div>
              <div class="chat-input-row">
                <button type="button" class="btn-secondary" onclick="openChatLinkPicker()" title="Enlazar nota, post-it, proyecto…">🔗 Enlazar</button>
                <textarea id="chat-input" placeholder="Escribe un mensaje… (Enter envía, Mayús+Enter nueva línea)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage();}"></textarea>
                <button type="button" class="btn-primary" onclick="sendChatMessage()">Enviar</button>
              </div>
            </div>
          </div>
        </div>
      `;
    case 'settings':
      return `
        <div style="max-width:900px">
          <div class="settings-section">
            <h3>⚙️ Configuración General</h3>
            <div class="settings-grid">
              <div class="setting-item">
                <div class="setting-label">Nombre de la App</div>
                <input class="form-input" id="cfg-app-name" value="Diario Departamental" onchange="saveCfg()">
              </div>
              <div class="setting-item">
                <div class="setting-label">Departamento</div>
                <input class="form-input" id="cfg-dept-name" value="IT" onchange="saveCfg()">
              </div>
              <div class="setting-item">
                <div class="setting-label">Color Acento</div>
                <div class="color-picker-row">
                  <input type="color" value="#e8c547" id="cfg-accent-color" onchange="applyAccentColor(this.value)" style="height:36px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;width:100%">
                </div>
              </div>
              <div class="setting-item">
                <div class="setting-label">Color Acento 2</div>
                <input type="color" value="#c47b3a" id="cfg-accent2-color" onchange="applyAccent2Color(this.value)" style="height:36px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;width:100%">
              </div>
            </div>
          </div>

          <!-- SELECTOR DE TEMA -->
          <div class="settings-section">
            <h3>🎨 Tema de la Interfaz <span style="font-size:11px;font-weight:400;color:var(--text-muted);font-family:'DM Mono',monospace"> — se aplica solo a tu usuario</span></h3>
            <div class="theme-grid" id="theme-grid"></div>
            <div style="display:flex;gap:10px;margin-top:16px;align-items:center">
              <button class="btn-secondary" onclick="resetUserTheme()" style="display:flex;align-items:center;gap:6px">
                ↺ Resetear tema original
              </button>
              <span style="font-size:11px;color:var(--text-muted)">Vuelve al tema oscuro por defecto</span>
            </div>

            <!-- CREADOR DE TEMA PERSONALIZADO -->
            <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer" onclick="toggleCustomThemePanel()">
                <h4 style="font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:var(--text)">🖌️ Crear tema personalizado</h4>
                <span id="custom-theme-toggle-icon" style="font-size:11px;color:var(--text-muted)">▶ Expandir</span>
              </div>
              <div id="custom-theme-panel" style="display:none">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:14px">
                  <div class="setting-item">
                    <div class="setting-label">Nombre del tema</div>
                    <input class="form-input" id="ct-name" value="Mi Tema" placeholder="Nombre...">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Emoji</div>
                    <input class="form-input" id="ct-emoji" value="✨" placeholder="Emoji..." style="max-width:80px">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Fondo principal</div>
                    <input type="color" class="form-input" id="ct-bg" value="#0f0e0c" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Superficie 1</div>
                    <input type="color" class="form-input" id="ct-surface" value="#1a1917" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Superficie 2</div>
                    <input type="color" class="form-input" id="ct-surface2" value="#232220" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Superficie 3</div>
                    <input type="color" class="form-input" id="ct-surface3" value="#2d2b28" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Borde</div>
                    <input type="color" class="form-input" id="ct-border" value="#3a3834" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Texto principal</div>
                    <input type="color" class="form-input" id="ct-text" value="#f0ebe3" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Texto secundario</div>
                    <input type="color" class="form-input" id="ct-text-dim" value="#8a8378" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Texto apagado</div>
                    <input type="color" class="form-input" id="ct-text-muted" value="#5a5650" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Color Acento</div>
                    <input type="color" class="form-input" id="ct-accent" value="#e8c547" style="height:36px;cursor:pointer">
                  </div>
                  <div class="setting-item">
                    <div class="setting-label">Color Acento 2</div>
                    <input type="color" class="form-input" id="ct-accent2" value="#c47b3a" style="height:36px;cursor:pointer">
                  </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  <button class="btn-secondary" onclick="previewCustomTheme()">👁 Vista previa</button>
                  <button class="btn-primary" onclick="saveCustomTheme()">💾 Guardar y aplicar</button>
                  <button class="btn-secondary btn-secondary-danger" onclick="deleteCustomTheme()">🗑 Borrar personalizado</button>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:8px">El tema personalizado se guarda en tu navegador y se aplica solo a ti.</div>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3>👥 Usuarios y Perfiles</h3>
            <div class="users-editor-list" id="users-editor-list"></div>
            <div style="margin-top:16px">
              <button class="btn-secondary" onclick="openAddUserModal()">+ Añadir Usuario</button>
            </div>
          </div>

          <div class="settings-section">
            <h3>🏢 Grupos de Trabajo</h3>
            <div style="display:flex;flex-wrap:wrap;gap:10px" id="groups-editor"></div>
          </div>

          <div class="settings-section">
            <h3>📤 Exportar Datos</h3>
            <div class="export-btn-group">
              <button class="export-btn" onclick="exportNotes('day')">📄 Notas del Día</button>
              <button class="export-btn" onclick="exportNotes('week')">📅 Notas de la Semana</button>
              <button class="export-btn" onclick="exportNotes('month')">🗓 Notas del Mes</button>
              <button class="export-btn" onclick="exportAllData()">💾 Exportar Todo</button>
              <button type="button" class="export-btn" onclick="triggerImportDiarioBackup()">📥 Importar backup</button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin:10px 0 0;line-height:1.45">«Exportar todo» incluye notas, proyectos, documentos, post-it, chat, <strong>comentarios</strong> (notas, post-it, proyectos, tareas, documentos), grupos de trabajo y <strong>plantillas de proyecto personalizadas</strong>. «Importar backup» sustituye esos datos por los del archivo JSON (tras confirmación).</p>
          </div>

          <div class="settings-section">
            <h3>🔴 Zona de Peligro</h3>
            <div style="display:flex;gap:10px">
              <button class="export-btn export-btn-danger" onclick="clearAllData()">🗑 Limpiar todas las notas</button>
            </div>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

// ===== WORK GROUP UTILITY FUNCTIONS =====

/**
 * Check if user is admin of work group
 * @param {Object} wg - Work group object
 * @param {string} userId - User ID
 * @returns {boolean} True if user is admin
 */
function isWorkGroupAdmin(wg, userId) {
  if (!wg || userId == null) return false;
  if (sameId(wg.ownerId, userId)) return true;
  return (wg.adminUserIds || []).some(id => sameId(id, userId));
}

/**
 * Count public notes shared with work group
 * @param {string} wgId - Work group ID
 * @returns {number} Count of shared notes
 */
function countPublicNotesSharedWithWorkGroup(wgId) {
  return notes.filter(n =>
    n.visibility === 'public' &&
    (n.shares || []).some(s => s.type === 'workgroup' && sameId(s.workGroupId, wgId))
  ).length;
}

// ===== VIEW SWITCHING =====

/**
 * Show a specific view
 * @param {string} view - View name
 * @param {HTMLElement} btn - Navigation button element
 */
export function showView(view, btn) {
  // Hide all views
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById('view-' + view);

  // Inject view HTML if not already present
  if (target && !target.innerHTML.trim()) {
    target.innerHTML = getViewHTML(view);
  }

  // Special handling for settings view
  if (view === 'settings') {
    if (!canAccessSettings()) {
      // For non-admin users: show only theme selector
      VIEWS.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) el.style.display = 'none';
      });
      const target = document.getElementById('view-settings');
      if (target) target.style.display = 'flex';
      if (btn) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      setCurrentView('settings');
      // Hide all sections except theme
      document.querySelectorAll('#view-settings .settings-section').forEach((sec, i) => {
        // i===0: Config General, i===1: Tema (visible), i===2: Usuarios, i===3: Grupos, i===4: Exportar, i===5: Peligro
        sec.style.display = (i === 1) ? '' : 'none';
      });
      renderThemeGrid();
      updateChatNavBadge();
      return;
    }
    // Admin: show everything
    document.querySelectorAll('#view-settings .settings-section').forEach(sec => sec.style.display = '');
  }

  if (target) target.style.display = 'flex';
  if (btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  setCurrentView(view);

  // Render specific view content
  if (view === 'notes') renderNotes();
  if (view === 'postit') renderPostitBoard();
  if (view === 'public-notes') renderPublicNotes();
  if (view === 'my-groups') { renderMyGroupsView(); updateWorkGroupInviteNavBadge(); }
  if (view === 'projects') { setProjectUserFilter(null); renderProjects(); }
  if (view === 'docs') renderDocs();
  if (view === 'shortcuts') { renderShortcuts(); onShortcutIconModeChange(); }
  if (view === 'whiteboard') renderWhiteboard();
  if (view === 'chat') renderChat();
  if (view === 'settings') { renderSettingsEditor(); renderThemeGrid(); }
  updateChatNavBadge();
}

/**
 * Check if user can access settings
 * @returns {boolean} True if user can access settings
 */
function canAccessSettings() {
  // Only allow access if user is in CORE_DEPARTMENT_GROUPS or is admin-like
  return CORE_DEPARTMENT_GROUPS.includes(currentUser.group) || currentUser.role.toLowerCase().includes('admin');
}

// ===== DATE NAVIGATION =====

/**
 * Render date navigation chips
 */
export function renderDateNav() {
  const chips = document.getElementById('date-chips');
  if (!chips || !currentUser) return;

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() + weekOffset * 7 - 6);
  const readSet = loadReadMentions();

  chips.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = toDateStr(d);
    const isToday = ds === toDateStr(new Date());
    const isActive = ds === currentDate;
    const hasNotes = notes.some(n => {
      if (n.date !== ds) return false;
      const au = USERS.find(u => sameId(u.id, n.authorId));
      const dept = au ? au.group : n.group;
      return dept === currentUser.group;
    });
    const hasUnreadMention = notes.some(n =>
      n.date === ds &&
      userCanSeeNote(n) &&
      (n.mentions || []).some(mid => sameId(mid, currentUser.id)) &&
      !readSet.has(n.id)
    );
    const label = isToday ? 'Hoy' : d.toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
    const chip = document.createElement('button');
    chip.className = 'date-chip' + (isToday?' today':'') + (isActive?' active':'');
    chip.title = hasUnreadMention ? 'Mención sin leer en este día' : '';

    // Force text color for active day (even with conflicting atomic rules)
    if (isActive) {
      chip.style.color = '#ffffff';
      chip.style.setProperty('color', '#ffffff', 'important');
      chip.style.setProperty('webkitTextFillColor', '#ffffff', 'important');
      chip.style.setProperty('fill', '#ffffff', 'important');
      chip.onmouseenter = () => {
        chip.style.color = '#ffffff';
        chip.style.setProperty('color', '#ffffff', 'important');
        chip.style.setProperty('webkitTextFillColor', '#ffffff', 'important');
        chip.style.setProperty('fill', '#ffffff', 'important');
      };
    } else if (isToday) {
      chip.style.color = 'var(--accent-text-on-bg)';
    } else {
      chip.style.color = '';
      chip.onmouseenter = null;
    }
    chip.innerHTML = label +
      (hasNotes ? '<span class="has-notes-dot"></span>' : '') +
      (hasUnreadMention ? '<span class="mention-notif-dot" aria-label="Mención sin leer"></span>' : '');
    chip.onclick = () => { setCurrentDate(ds); renderDateNav(); renderNotes(); };
    chips.appendChild(chip);
  }
}

/**
 * Navigate to previous/next week
 * @param {number} dir - Direction (-1 for previous, 1 for next)
 */
export function navigateWeek(dir) {
  setWeekOffset(weekOffset + dir);
  renderDateNav();
}

// ===== SHIFT FILTERS =====

/**
 * Toggle shift filter
 * @param {string} shift - Shift name
 * @param {HTMLElement} btn - Filter button element
 */
export function toggleShiftFilter(shift, btn) {
  if (activeShiftFilters.includes(shift)) {
    if (activeShiftFilters.length === 1) return;
    setActiveShiftFilters(activeShiftFilters.filter(s => s !== shift));
    btn.classList.remove('active');
  } else {
    setActiveShiftFilters([...activeShiftFilters, shift]);
    btn.classList.add('active');
  }
  renderNotes();
}

// ===== SEARCH =====

/**
 * Handle search query
 * @param {string} q - Search query
 */
export function handleSearch(q) {
  setSearchQuery(q.toLowerCase().trim());
  renderNotes();
}

export function onNotesSearchHistoryChange(el) {
  setSearchNotesAllDates(!!(el && el.checked));
  renderNotes();
}

// ===== NOTE VIEW SWITCHING =====

/**
 * Set note view type
 * @param {string} view - View type ('all', 'mine', 'mentions', 'reminders')
 * @param {HTMLElement} btn - View button element
 */
export function setNoteView(view, btn) {
  setCurrentNoteView(view);
  showView('notes', btn);
  const titles = {all:'Todas las Notas',mine:'Mis Notas',mentions:'Menciones a mí',reminders:'Recordatorios'};
  document.getElementById('view-title').textContent = titles[view] || 'Notas';
  renderNotes();
}

// ===== UTILITY FUNCTIONS =====

function renderMyGroupsView() {
  const root = document.getElementById('my-groups-root');
  if (!root || !currentUser) return;
  const myGroups = workGroups.filter(wg => userIsActiveWorkGroupMember(wg));
  if (myGroups.length === 0) {
    root.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👥</div><div>Aún no tienes grupos de trabajo</div><div style="font-size:11px;color:var(--text-muted)">Crea uno arriba o acepta una invitación en 📩 Invitaciones. Los grupos no aparecen aquí hasta que aceptes la invitación.</div></div>`;
    updateWorkGroupInviteNavBadge();
    return;
  }
  root.innerHTML = myGroups.map(wg => {
    const isOwner = sameId(wg.ownerId, currentUser.id);
    const isAdmin = isWorkGroupAdmin(wg, currentUser.id);
    const owner = USERS.find(u => sameId(u.id, wg.ownerId));
    const members = (wg.memberUserIds || []).map(id => USERS.find(u => sameId(u.id, id))).filter(Boolean);
    const allPeople = [owner, ...members].filter(Boolean);
    const maxAv = 6;
    const avHtml = allPeople.slice(0, maxAv).map((u, i) =>
      `<div class="wg-avatar-mini" style="background:${u.color};z-index:${20 - i}" title="${escapeChatHtml(u.name)} (${u.group})">${u.initials}</div>`
    ).join('');
    const moreN = allPeople.length > maxAv ? `<div class="wg-avatar-more" title="Más miembros">+${allPeople.length - maxAv}</div>` : '';
    const sharedNotes = countPublicNotesSharedWithWorkGroup(wg.id);
    const memberCount = allPeople.length;
    const descFull = (wg.description || '').trim();
    const objFull = (wg.objectives || '').trim();
    let descBlock = '';
    if (descFull) {
      descBlock = `<div class="wg-card-v2-desc">${escapeChatHtml(descFull)}</div>`;
    } else if (objFull) {
      descBlock = `<div class="wg-card-v2-desc wg-card-v2-desc--empty">Hay objetivos definidos · abre la ficha para leerlos.</div>`;
    } else {
      descBlock = `<div class="wg-card-v2-desc wg-card-v2-desc--empty">Sin descripción u objetivos · clic en la tarjeta para la ficha.</div>`;
    }
    return `<div class="wg-card-v2 wg-card-v2--clickable" role="button" tabindex="0" data-wg-id="${wg.id}" title="Clic para ver ficha del grupo" onclick="onWorkGroupCardClick(event,${wg.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onWorkGroupCardClick(event,${wg.id});}">
      <div class="wg-card-v2-head">
        <h4>${escapeChatHtml(wg.name)}</h4>
        <div class="wg-card-v2-meta">Equipo híbrido${isAdmin ? ' · <span style="color:var(--accent)">Administras este grupo</span>' : ''}</div>
      </div>
      <div class="wg-avatar-row">
        <div class="wg-avatar-stack">${avHtml}${moreN}</div>
        <span style="font-size:11px;color:var(--text-muted);margin-left:8px;line-height:1.4">Invitaciones: 📩 Invitaciones (solo tras aceptar verás el grupo aquí).</span>
      </div>
      <div class="wg-stat-bar">
        <div class="wg-stat"><strong>${sharedNotes}</strong><span>Notas públicas vinculadas</span></div>
        <div class="wg-stat"><strong>${memberCount}</strong><span>Miembros</span></div>
      </div>
      ${descBlock}
      <div class="wg-card-v2-actions-foot">
        ${isAdmin ? `<button type="button" class="btn-primary" onclick="event.stopPropagation();openEditWorkGroupModal(${wg.id})">Editar grupo</button>` : '<span style="font-size:11px;color:var(--text-muted)">Solo administradores pueden editar el grupo.</span>'}
        ${isOwner ? `<button type="button" class="btn-secondary btn-secondary-danger" onclick="event.stopPropagation();deleteWorkGroup(${wg.id})">Eliminar grupo</button>` : ''}
      </div>
    </div>`;
  }).join('');
  updateWorkGroupInviteNavBadge();
}

// ===== MENTION MANAGEMENT =====

export function markMentionAsRead(noteId) {
  if (!currentUser) return;
  const readSet = loadReadMentions();
  if (!readSet.has(noteId)) {
    readSet.add(noteId);
    saveReadMentions(readSet);
    updateBadges();
    // Si estamos en la vista menciones, actualizar sin re-renderizar todo
    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    if (card) {
      card.classList.add('mention-read');
      const dot = card.querySelector('.mention-read-dot');
      const ind = card.querySelector('.mention-read-indicator');
      if (dot) dot.style.background = 'var(--success)';
      if (ind) { ind.classList.remove('unread'); ind.innerHTML = '✓ Leída'; }
    }
  }
}

/** Marca como leídas todas las notas donde el usuario actual está mencionado (y puede ver). */
export function markAllNoteMentionsAsRead() {
  if (!currentUser) return;
  const readSet = loadReadMentions();
  for (const n of notes) {
    if (!userCanSeeNote(n)) continue;
    if (!(n.mentions || []).some(mid => sameId(mid, currentUser.id))) continue;
    readSet.add(n.id);
  }
  saveReadMentions(readSet);
  updateBadges();
  renderNotes();
}

export function updateBadges() {
  if (!currentUser) return;
  const readSet = loadReadMentions();
  const allMentions = notes.filter(n =>
    userCanSeeNote(n) &&
    (n.mentions || []).some(mid => sameId(mid, currentUser.id))
  );
  const unreadMentions = allMentions.filter(n => !readSet.has(n.id));

  const mentionsBadge = document.getElementById('mention-badge');
  if (unreadMentions.length > 0) {
    mentionsBadge.textContent = unreadMentions.length;
    mentionsBadge.classList.remove('hidden');
  } else {
    mentionsBadge.classList.add('hidden');
  }
  const notifBadge = document.getElementById('notif-badge');
  if (unreadMentions.length > 0) {
    notifBadge.textContent = unreadMentions.length;
    notifBadge.classList.remove('hidden');
  } else {
    notifBadge.classList.add('hidden');
  }
  renderDateNav();
  updateChatNavBadge();
}

export function createWorkGroup() {
  openModal('workgroup-new-modal');
  const nameEl = document.getElementById('wg-new-name-input');
  const descEl = document.getElementById('wg-new-desc-input');
  if (nameEl) nameEl.value = '';
  if (descEl) descEl.value = '';
}

export function openWorkGroupInvitesModal() {
  const pending = wgInvites.filter(i =>
    i.status === 'pending' && sameId(i.toUserId, currentUser.id)
  );
  const el = document.getElementById('wg-invites-list-body');
  if (!el) return;
  if (pending.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px">Sin invitaciones pendientes</p>';
  } else {
    el.innerHTML = pending.map(inv => {
      const wg = workGroups.find(w => sameId(w.id, inv.wgId));
      const from = USERS.find(u => sameId(u.id, inv.fromUserId));
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:600;font-size:13px">${wg ? escapeChatHtml(wg.name) : 'Grupo desconocido'}</div>
          <div style="font-size:11px;color:var(--text-muted)">Invitado por ${from ? escapeChatHtml(from.name) : '?'}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-primary" style="font-size:11px;padding:5px 12px"
            onclick="acceptWgInvite(${inv.id})">Aceptar</button>
          <button class="btn-secondary" style="font-size:11px;padding:5px 12px"
            onclick="declineWgInvite(${inv.id})">Rechazar</button>
        </div>
      </div>`;
    }).join('');
  }
  openModal('workgroup-invites-modal');
}

export function onWorkGroupCardClick(ev, wgId) {
  const wg = workGroups.find(w => sameId(w.id, wgId));
  if (!wg) return;
  const el = document.getElementById('wg-info-title');
  if (el) el.textContent = wg.name;
  const descEl = document.getElementById('wg-info-desc-body');
  if (descEl) descEl.innerHTML = wg.description
    ? escapeChatHtml(wg.description).replace(/\n/g, '<br>')
    : '<p style="color:var(--text-muted);font-style:italic">Sin descripción</p>';
  const objEl = document.getElementById('wg-info-objectives-body');
  if (objEl) objEl.innerHTML = wg.objectives
    ? escapeChatHtml(wg.objectives).replace(/\n/g, '<br>')
    : '<p style="color:var(--text-muted);font-style:italic">Sin objetivos definidos</p>';
  openModal('wg-info-modal');
}

export function openEditWorkGroupModal(wgId) {
  const wg = workGroups.find(w => sameId(w.id, wgId));
  if (!wg) return;
  window._editingWgId = wgId;
  const nameEl = document.getElementById('wg-edit-name-display');
  const descEl = document.getElementById('wg-edit-desc');
  const objectivesEl = document.getElementById('wg-edit-objectives');
  if (nameEl) nameEl.textContent = wg.name;
  if (descEl) descEl.value = wg.description || '';
  if (objectivesEl) objectivesEl.value = wg.objectives || '';

  const members = (wg.memberUserIds || []).map(id => USERS.find(u => sameId(u.id, id))).filter(Boolean);
  const owner = USERS.find(u => sameId(u.id, wg.ownerId));
  const allPeople = [owner, ...members].filter(Boolean);
  const membersEl = document.getElementById('wg-edit-members-list');
  if (membersEl) {
    membersEl.innerHTML = allPeople.map(u => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="width:24px;height:24px;border-radius:50%;background:${u.color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#0f0e0c">${u.initials}</div>
        <span style="font-size:12px;flex:1">${escapeChatHtml(u.name)}</span>
        <span style="font-size:10px;color:var(--text-muted)">${sameId(u.id, wg.ownerId) ? 'Propietario' : 'Miembro'}</span>
        ${!sameId(u.id, wg.ownerId) ? `<button type="button" style="font-size:10px;color:var(--danger);background:none;border:none;cursor:pointer" onclick="removeWgMember(${wg.id},${u.id})">✕</button>` : ''}
      </div>
    `).join('');
  }
  openModal('workgroup-modal');
}

export function deleteWorkGroup(wgId) {
  const wg = workGroups.find(w => sameId(w.id, wgId));
  if (!wg) return;
  showConfirmModal({
    icon: '👥',
    title: '¿Eliminar este grupo?',
    message: `Se eliminará "${wg.name}" y todos sus datos. Esta acción no se puede deshacer.`,
    onConfirm: () => {
      const idx = workGroups.findIndex(w => sameId(w.id, wgId));
      if (idx !== -1) workGroups.splice(idx, 1);
      saveWorkGroups();
      renderMyGroupsView();
      showToast('Grupo eliminado', 'info');
    }
  });
}

function saveWorkGroups() {
  localStorage.setItem('diario_workgroups', JSON.stringify(workGroups));
}

function saveWgInvites() {
  localStorage.setItem('diario_wginvites', JSON.stringify(wgInvites));
}

export function saveWorkGroupEdit() {
  const wg = workGroups.find(w => sameId(w.id, window._editingWgId));
  if (!wg) return;
  const descEl = document.getElementById('wg-edit-desc');
  const objectivesEl = document.getElementById('wg-edit-objectives');
  wg.description = descEl ? descEl.value.trim() : '';
  wg.objectives = objectivesEl ? objectivesEl.value.trim() : '';
  saveWorkGroups();
  closeModal('workgroup-modal');
  renderMyGroupsView();
  showToast('Grupo actualizado', 'success');
}

export function acceptWgInvite(inviteId) {
  const inv = wgInvites.find(i => sameId(i.id, inviteId));
  if (!inv) return;
  inv.status = 'accepted';
  const wg = workGroups.find(w => sameId(w.id, inv.wgId));
  if (wg) {
    if (!wg.memberUserIds) wg.memberUserIds = [];
    if (!wg.memberUserIds.some(id => sameId(id, currentUser.id))) {
      wg.memberUserIds.push(currentUser.id);
    }
  }
  saveWgInvites();
  saveWorkGroups();
  closeModal('workgroup-invites-modal');
  renderMyGroupsView();
  updateWorkGroupInviteNavBadge();
  showToast('Invitación aceptada', 'success');
}

export function declineWgInvite(inviteId) {
  const inv = wgInvites.find(i => sameId(i.id, inviteId));
  if (!inv) return;
  inv.status = 'declined';
  saveWgInvites();
  openWorkGroupInvitesModal();
  updateWorkGroupInviteNavBadge();
  showToast('Invitación rechazada', 'info');
}

export function removeWgMember(wgId, userId) {
  const wg = workGroups.find(w => sameId(w.id, wgId));
  if (!wg) return;
  wg.memberUserIds = (wg.memberUserIds || []).filter(id => !sameId(id, userId));
  saveWorkGroups();
  openEditWorkGroupModal(wgId);
  showToast('Miembro eliminado', 'info');
}

export function saveNewWorkGroup() {
  const nameInput = document.getElementById('wg-new-name-input') || document.getElementById('wg-new-name');
  const descInput = document.getElementById('wg-new-desc-input');
  const name = nameInput?.value.trim();
  if (!name) { showToast('El nombre es requerido', 'error'); return; }
  const desc = descInput?.value.trim() || '';
  const newWg = {
    id: Date.now(),
    name,
    description: desc,
    objectives: '',
    ownerId: currentUser.id,
    adminUserIds: [currentUser.id],
    memberUserIds: [],
    createdAt: new Date().toISOString(),
  };
  workGroups.push(newWg);
  saveWorkGroups();
  closeModal('workgroup-new-modal');
  renderMyGroupsView();
  showToast('Grupo creado', 'success');
}

export function onWgEditInviteSearchInput(event) {
  const q = (event.target.value || '').trim().toLowerCase();
  const sugEl = document.getElementById('wg-edit-invite-suggestions');
  if (!sugEl) return;
  if (!q) { sugEl.classList.add('hidden'); return; }
  const wg = workGroups.find(w => sameId(w.id, window._editingWgId));
  const existing = wg ? [...(wg.memberUserIds || []), wg.ownerId] : [];
  const matches = USERS.filter(u =>
    u.name.toLowerCase().includes(q) &&
    !existing.some(id => sameId(id, u.id))
  ).slice(0, 6);
  if (!matches.length) { sugEl.classList.add('hidden'); return; }
  sugEl.innerHTML = matches.map(u => `
    <div class="wg-invite-suggestion-item"
      onclick="selectWgInviteSuggestion(${u.id}, '${escapeChatHtml(u.name)}')">
      <strong>${escapeChatHtml(u.name)}</strong>
      <span style="color:var(--text-muted);font-size:10px;margin-left:6px">${u.group}</span>
    </div>
  `).join('');
  sugEl.classList.remove('hidden');
}

export function selectWgInviteSuggestion(userId, userName) {
  const input = document.getElementById('wg-edit-invite-search');
  if (input) input.value = userName;
  const sugEl = document.getElementById('wg-edit-invite-suggestions');
  if (sugEl) sugEl.classList.add('hidden');
  window._selectedWgInviteUserId = userId;
}

export function sendWgInviteFromEditModal() {
  const userId = window._selectedWgInviteUserId;
  if (!userId) { showToast('Selecciona un usuario de la lista', 'error'); return; }
  const wgId = window._editingWgId;
  if (!wgId) return;
  const already = wgInvites.some(i =>
    sameId(i.wgId, wgId) && sameId(i.toUserId, userId) && i.status === 'pending'
  );
  if (already) { showToast('Ya hay una invitación pendiente para este usuario', 'info'); return; }
  wgInvites.push({
    id: Date.now(),
    wgId,
    fromUserId: currentUser.id,
    toUserId: userId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  saveWgInvites();
  window._selectedWgInviteUserId = null;
  const input = document.getElementById('wg-edit-invite-search');
  if (input) input.value = '';
  showToast('Invitación enviada', 'success');
}