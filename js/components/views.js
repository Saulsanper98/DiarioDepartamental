// ===== VIEWS MODULE =====

// Import required dependencies
import { currentUser, currentView, currentNoteView, currentDate, weekOffset, activeShiftFilters, searchQuery, notesListSort, notes, USERS, sameId, toDateStr, setCurrentView, setCurrentNoteView, setCurrentDate, workGroups, wgInvites, setWorkGroups, setWgInvites, CORE_DEPARTMENT_GROUPS, setActiveShiftFilters, setSearchQuery, setSearchNotesAllDates, setActiveNoteTagFilter, setNotesAuthorFilterId, setProjectUserFilter, setWeekOffset } from './data.js';
import { renderThemeGrid } from './themes.js';
import { showToast, escapeChatHtml, openModal, closeModal, showConfirmModal } from './modalControl.js';
import { renderNotes, renderPublicNotes, userCanSeeNote, syncNotesSaveSoundCheckbox, announceNotes } from './notes.js';
import { loadReadMentions, saveReadMentions } from './mentionsRead.js';
import { renderProjects, userIsActiveWorkGroupMember, exitProjectPresentationMode } from './projects.js';
import { renderPostitBoard } from './postit.js';
import { renderDocs } from './docs.js';
import { renderChat, updateChatNavBadge } from './chat.js';
import { renderShortcuts, onShortcutIconModeChange } from './shortcuts.js';
import { renderWhiteboard } from './whiteboard.js';
import { renderSettingsEditor, updateWorkGroupInviteNavBadge } from './login.js';
import { bumpNotesMetric } from './notesTelemetry.js';
import {
  apiGetMyWorkGroups,
  apiCreateWorkGroup,
  apiUpdateWorkGroup,
  apiDeleteWorkGroup,
  apiCreateWorkGroupInvite,
  apiGetPendingWorkGroupInvites,
  apiAcceptWorkGroupInvite,
  apiDeclineWorkGroupInvite,
} from '../api.js';

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
        <div class="topbar notes-topbar">
          <h2 id="view-title">Todas las Notas</h2>
          <div class="notes-search-wrap">
            <div class="search-bar">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Buscar notas…" id="search-input" oninput="handleSearch(this.value)" title="Buscar notas (/) — pulsa / cuando no estés en un campo de texto">
            </div>
            <label class="notes-search-history-toggle" title="Con el buscador relleno, incluye todas las fechas">
              <input type="checkbox" id="notes-search-history" class="notes-search-history-input" onchange="onNotesSearchHistoryChange(this)">
              <span class="notes-search-history-track" aria-hidden="true"><span class="notes-search-history-thumb"></span></span>
              <span class="notes-search-history-caption">Historial completo</span>
            </label>
          </div>
          <p id="notes-search-scope-hint" class="notes-search-scope-hint" aria-live="polite"></p>
          <span id="notes-search-busy" class="notes-search-busy hidden" aria-live="polite"></span>
          <div class="topbar-notes-actions">
            <div class="notes-topbar-overflow-wrap">
              <button type="button" class="notes-toolbar-more-btn" id="notes-topbar-overflow-trigger" onclick="toggleNotesTopbarOverflowMenu()" aria-expanded="false" aria-haspopup="true" title="Exportar, plantillas y más">Más ▾</button>
              <div id="notes-topbar-overflow-menu" class="notes-export-menu notes-topbar-overflow-menu hidden" role="menu">
                <div class="notes-overflow-menu-label" role="presentation">Exportar</div>
                <button type="button" class="notes-export-menu-item" role="menuitem" onclick="exportNotes('day');toggleNotesTopbarOverflowMenu(true)">Día (texto)</button>
                <button type="button" class="notes-export-menu-item" role="menuitem" onclick="exportNotes('week');toggleNotesTopbarOverflowMenu(true)">Semana</button>
                <button type="button" class="notes-export-menu-item" role="menuitem" onclick="exportNotes('month');toggleNotesTopbarOverflowMenu(true)">Mes</button>
                <div class="notes-overflow-menu-divider" role="presentation"></div>
                <button type="button" class="notes-export-menu-item" role="menuitem" onclick="openNoteTemplatesModal();toggleNotesTopbarOverflowMenu(true)">Plantillas</button>
                <button type="button" class="notes-export-menu-item" role="menuitem" onclick="openNotesShortcutsHelpModal();toggleNotesTopbarOverflowMenu(true)">Atajos de teclado</button>
                <button type="button" class="notes-export-menu-item" role="menuitem" onclick="window.print();toggleNotesTopbarOverflowMenu(true)">Imprimir vista</button>
              </div>
            </div>
            <div style="position:relative">
              <button class="notif-btn" title="Notificaciones">🔔<span class="notif-badge hidden" id="notif-badge"></span></button>
            </div>
            <button type="button" class="btn-action" onclick="openNewNoteModal()">✏️ Nueva Nota</button>
          </div>
        </div>

        <div class="stats-bar notes-stats-bar" id="notes-stats-bar">
          <div id="notes-stats-list-group" class="notes-stats-list-group">
          <div class="stat-item" id="stat-total-item"><strong id="stat-total">0</strong> <span id="stat-total-caption" class="stat-item-caption">notas hoy</span></div>
          <div class="stat-item" id="stat-morning-item"><strong id="stat-morning" style="color:var(--morning)">0</strong> <span id="stat-morning-caption" class="stat-item-caption">en mañana</span></div>
          <div class="stat-item" id="stat-afternoon-item"><strong id="stat-afternoon" style="color:var(--afternoon)">0</strong> <span id="stat-afternoon-caption" class="stat-item-caption">en tarde</span></div>
          <div class="stat-item" id="stat-night-item"><strong id="stat-night" style="color:var(--night)">0</strong> <span id="stat-night-caption" class="stat-item-caption">en noche</span></div>
          </div>
          <div id="notes-stats-calendar-group" class="notes-stats-calendar-group hidden" aria-live="polite">
            <span class="notes-stats-cal-main" id="notes-stats-cal-main"></span>
            <span class="notes-stats-cal-day hidden" id="notes-stats-cal-day"></span>
          </div>
          <span class="stats-bar-divider stats-bar-divider--before-filters" aria-hidden="true">|</span>
          <div class="notes-stats-filters-cluster">
            <div class="notes-stats-filters-cluster__tags">
              <div style="position:relative">
                <button type="button" class="notes-tag-filter-trigger" id="note-tag-filter-btn" onclick="toggleNoteTagDropdown()" title="Filtrar notas por etiqueta">🏷️ Etiquetas</button>
                <div id="note-tag-dropdown" class="note-tag-dropdown hidden"></div>
              </div>
              <div id="note-tag-active-filter" class="note-tag-active-filter hidden"></div>
              <div id="notes-author-filter-bar" class="notes-author-filter-bar hidden" aria-live="polite"></div>
            </div>
            <div class="notes-stats-filters-cluster__tools">
              <div class="notes-sort-wrap" title="Orden dentro de cada turno">
                <span class="sr-only" id="notes-sort-label">Orden dentro de cada turno</span>
                <div id="notes-sort-seg" class="notes-sort-seg" role="group" aria-labelledby="notes-sort-label">
                  <button type="button" class="notes-sort-seg-btn${notesListSort !== 'oldest' ? ' active' : ''}" data-sort="recent" aria-pressed="${notesListSort !== 'oldest' ? 'true' : 'false'}" title="Más recientes primero dentro de cada turno" onclick="applyNotesListSort('recent')">Recientes</button>
                  <button type="button" class="notes-sort-seg-btn${notesListSort === 'oldest' ? ' active' : ''}" data-sort="oldest" aria-pressed="${notesListSort === 'oldest' ? 'true' : 'false'}" title="Más antiguas primero dentro de cada turno" onclick="applyNotesListSort('oldest')">Antiguas</button>
                </div>
              </div>
              <button type="button" class="notes-clear-filters-btn" onclick="clearAllNotesFilters()" title="Quitar búsqueda, etiqueta, autor e historial completo">Limpiar</button>
            </div>
          </div>
          <div class="notes-view-switcher" style="margin-left:auto;display:flex;align-items:center;gap:4px">
            <button class="notes-view-btn ${currentNoteView !== 'calendar' ? 'active' : ''}" 
              onclick="exitNotesCalendarToList()"
              title="Vista lista (restaura la subvista de notas que tenías antes del calendario)">
              ☰ Lista
            </button>
            <button class="notes-view-btn ${currentNoteView === 'calendar' ? 'active' : ''}"
              onclick="setNoteViewCalendar()"
              title="Vista Calendario">
              📅 Calendario
            </button>
          </div>
        </div>

        <div class="date-nav">
          <button class="date-nav-btn" onclick="navigateWeek(-1)">◀</button>
          <div class="date-chips" id="date-chips"></div>
          <button class="date-nav-btn" onclick="navigateWeek(1)">▶</button>
        </div>

        <div id="notes-live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>
        <div id="notes-onboarding-banner" class="notes-onboarding-banner hidden" role="region" aria-label="Consejos rápidos de notas">
          <div class="notes-onboarding-inner">
            <p class="notes-onboarding-text"><strong>Consejo:</strong> Usa el carrusel de fechas para cambiar de día, <strong>Historial completo</strong> en el buscador para encontrar notas antiguas, y <strong>Exportar</strong> para descargar el día, la semana o el mes.</p>
            <button type="button" class="btn-secondary notes-onboarding-dismiss" onclick="dismissNotesOnboarding()">Entendido</button>
          </div>
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
      const pendingCount = wgInvites.filter(i =>
        i.status === 'pending' && sameId(i.toUserId, currentUser?.id)
      ).length;
      return `
        <div class="topbar">
          <h2>👥 Mis Grupos de Trabajo</h2>
          <span style="font-size:11px;color:var(--text-muted)">Crea equipos para colaborar entre departamentos.</span>
        </div>
        <div style="padding:0 24px 16px;border-bottom:1px solid var(--border);background:var(--surface)">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;max-width:720px">
            <div class="form-group" style="flex:1;min-width:200px;margin:0">
              <label class="form-label" style="margin-top:20px">Nombre del grupo</label>
              <input type="text" class="form-input" id="wg-new-name" placeholder="Ej. Proyecto transversal Q2">
            </div>
            <button type="button" class="btn-primary" onclick="createWorkGroup()">+ Crear grupo</button>
            <button type="button" class="btn-secondary" id="wg-invites-btn" onclick="openWorkGroupInvitesModal()">
              📩 Invitaciones
              ${pendingCount > 0 ? `<span class="nav-badge" style="margin-left:6px">${pendingCount}</span>` : ''}
            </button>
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
        <div class="postit-user-filter-wrap">
          <div id="postit-user-filter-bar" class="postit-user-filter-bar"></div>
        </div>
        <div class="postit-board" id="postit-board"></div>
      `;
    case 'projects':
      return `
        <div class="topbar projects-topbar">
          <h2 class="projects-topbar-title"><span class="projects-topbar-title__ic" aria-hidden="true"></span> Proyectos &amp; Tareas</h2>
          <div class="projects-topbar-actions">
            <button type="button" class="btn-secondary projects-mobile-tree-btn" onclick="toggleProjectsListDrawer(true)" aria-controls="projects-list-panel" aria-expanded="false"><span class="projects-topbar-btn-ic projects-topbar-btn-ic--menu" aria-hidden="true"></span> Proyectos</button>
            <button type="button" class="btn-secondary" onclick="openMyWorkTasksView()"><span class="projects-topbar-btn-ic projects-topbar-btn-ic--tasks" aria-hidden="true"></span> Mis tareas</button>
            <button class="btn-action" onclick="openNewProjectModal()"><span class="projects-topbar-btn-ic projects-topbar-btn-ic--new" aria-hidden="true"></span> Nuevo proyecto</button>
          </div>
        </div>
        <div id="projects-onboarding-banner" class="projects-onboarding-banner hidden" role="region" aria-label="Consejos de proyectos">
          <span class="projects-onboarding-banner__text" title="Buscar en el árbol; atajos; nueva tarea con proyecto abierto"><strong>Consejo:</strong> <kbd>/</kbd> buscar proyecto · <kbd>?</kbd> atajos · <kbd>N</kbd> nueva tarea</span>
          <div class="projects-onboarding-banner__actions">
            <button type="button" class="btn-secondary projects-onboarding-banner__btn" onclick="openProjectsShortcutsModal()">Atajos…</button>
            <button type="button" class="btn-secondary projects-onboarding-banner__btn" onclick="dismissProjectsOnboarding()">Entendido</button>
          </div>
        </div>
        <div class="projects-layout" id="projects-layout-root">
          <div class="projects-list-panel" id="projects-list-panel">
            <button type="button" class="projects-edge-toggle projects-edge-toggle--collapse" onclick="toggleProjectsTreeCollapsed()" aria-controls="projects-list-panel" aria-expanded="true" title="Ocultar panel de proyectos (más espacio para el detalle)">
              <span class="projects-edge-toggle__grip" aria-hidden="true"></span>
              <span class="projects-edge-toggle__chev" aria-hidden="true"></span>
            </button>
            <div class="projects-panel-header">
              <h3>Proyectos</h3>
              <span id="projects-count" style="font-size:11px;color:var(--text-muted)">0</span>
            </div>
            <div class="projects-tree-search-wrap">
              <label class="sr-only" for="projects-tree-search">Buscar en el árbol de proyectos</label>
              <input type="search" id="projects-tree-search" class="form-input projects-tree-search-input" placeholder="Buscar proyecto…" autocomplete="off" oninput="filterProjectsTreeSearch(this.value)" />
            </div>
            <button type="button" class="projects-drawer-close btn-secondary" onclick="toggleProjectsListDrawer(false)" aria-label="Cerrar lista de proyectos">✕</button>
            <div class="projects-items" id="projects-list"></div>
          </div>
          <button type="button" class="projects-edge-toggle projects-edge-toggle--expand" onclick="toggleProjectsTreeCollapsed()" aria-controls="projects-list-panel" aria-expanded="false" title="Mostrar panel de proyectos">
            <span class="projects-edge-toggle__grip" aria-hidden="true"></span>
            <span class="projects-edge-toggle__chev" aria-hidden="true"></span>
          </button>
          <div class="project-detail-panel" id="project-detail">
            <div class="empty-state"><div class="empty-icon">🎯</div><div>Selecciona un proyecto para ver sus detalles</div></div>
          </div>
        </div>
      `;
    case 'docs':
      return `
        <div class="topbar docs-topbar">
          <div class="docs-topbar-main">
            <div class="docs-topbar-heading">
              <h2 class="docs-topbar-title">📚 Documentación & Manuales</h2>
            </div>
            <div class="docs-topbar-actions">
              <div class="search-bar docs-search-bar">
                <span class="search-icon">🔍</span>
                <input type="text" placeholder="Buscar en docs..." id="docs-search-input" oninput="filterDocsBySearch(this.value)" aria-label="Buscar documentos">
                <button type="button" class="docs-search-clear-btn" onclick="resetDocsFiltersAndSearch()" title="Limpiar búsqueda y filtros" aria-label="Limpiar búsqueda y filtros">✕</button>
              </div>
              <button class="btn-action" onclick="openNewDocModal()"><span aria-hidden="true">📝</span><span class="docs-action-label">Nuevo Doc</span></button>
              <button class="btn-action" onclick="openCreateFolderModal()"><span aria-hidden="true">📁</span><span class="docs-action-label">Nueva Carpeta</span></button>
              <div class="docs-overflow-wrap">
                <button type="button" class="btn-secondary docs-overflow-btn" id="docs-topbar-more-btn" onclick="toggleDocsTopbarMenu()" aria-expanded="false" aria-controls="docs-topbar-more-menu">⋯ Más</button>
                <div class="docs-overflow-menu hidden" id="docs-topbar-more-menu" role="menu" aria-label="Acciones adicionales de documentación">
                  <div class="docs-overflow-menu__title">Acciones</div>
                  <button type="button" role="menuitem" class="docs-overflow-item" onclick="openInsertFileModal();closeDocsMenus()">📎 Insertar archivo</button>
                  <button type="button" role="menuitem" class="docs-overflow-item" onclick="openDocTemplatesModal();closeDocsMenus()">📋 Plantillas</button>
                  <button type="button" role="menuitem" class="docs-overflow-item hidden" id="docs-more-download-btn" onclick="downloadCurrentDocsFolderFromMenu()">⬇️ Descargar carpeta</button>
                  <div class="docs-overflow-menu__divider"></div>
                  <button type="button" role="menuitem" class="docs-overflow-item" onclick="toggleDocsMultiSelect();closeDocsMenus()">☑ Selección múltiple</button>
                </div>
              </div>
            </div>
          </div>
          <span id="docs-live-region" class="sr-only" aria-live="polite"></span>
          <span class="sr-only"><span id="docs-summary-folders">0</span><span id="docs-summary-docs">0</span><span id="docs-summary-files">0</span></span>
        </div>
        <div class="docs-toolbar">
          <div class="docs-toolbar-left docs-toolbar-left--minimal"></div>
          <div class="docs-toolbar-right">
            <div class="docs-view-group">
            <button type="button" class="docs-view-toggle-btn active" data-mode="grid" onclick="setDocsViewMode('grid')" title="Vista grid" aria-label="Cambiar a vista cuadrícula">⊞</button>
            <button type="button" class="docs-view-toggle-btn" data-mode="list" onclick="setDocsViewMode('list')" title="Vista lista" aria-label="Cambiar a vista lista">☰</button>
            </div>
            <div class="docs-overflow-wrap docs-overflow-wrap--toolbar">
              <button type="button" class="docs-toolbar-tools-btn" id="docs-tools-btn" onclick="toggleDocsToolsMenu()" aria-expanded="false" aria-controls="docs-tools-menu">⚙ Ajustes</button>
              <div class="docs-overflow-menu docs-overflow-menu--tools hidden" id="docs-tools-menu" role="menu" aria-label="Ajustes de vista de documentación">
                <div class="docs-overflow-menu__title">Vista y orden</div>
                <div class="docs-tools-section">
                  <span class="docs-sort-label">Filtros</span>
                  <label class="docs-overflow-check">
                    <input type="checkbox" id="docs-filter-notes" checked onchange="applyDocsFilters()"> 📝 Notas
                  </label>
                  <label class="docs-overflow-check">
                    <input type="checkbox" id="docs-filter-urls" checked onchange="applyDocsFilters()"> 🔗 URLs
                  </label>
                  <label class="docs-overflow-check">
                    <input type="checkbox" id="docs-filter-files" checked onchange="applyDocsFilters()"> 📎 Archivos
                  </label>
                </div>
                <div class="docs-tools-section">
                  <span class="docs-sort-label">Orden</span>
                  <div class="docs-sort-group">
                    <button type="button" class="docs-sort-btn active" data-sort="recent" onclick="setDocsSortOrder('recent');closeDocsMenus()" title="Más recientes" aria-label="Ordenar por recientes">🕐</button>
                    <button type="button" class="docs-sort-btn" data-sort="name" onclick="setDocsSortOrder('name');closeDocsMenus()" title="Nombre A-Z" aria-label="Ordenar por nombre">🔤</button>
                    <button type="button" class="docs-sort-btn" data-sort="type" onclick="setDocsSortOrder('type');closeDocsMenus()" title="Por tipo" aria-label="Ordenar por tipo">🗂</button>
                    <button type="button" class="docs-sort-btn" data-sort="updated" onclick="setDocsSortOrder('updated');closeDocsMenus()" title="Última edición" aria-label="Ordenar por última edición">⟳</button>
                    <button type="button" class="docs-sort-btn" data-sort="opened" onclick="setDocsSortOrder('opened');closeDocsMenus()" title="Abiertos recientemente" aria-label="Ordenar por abiertos recientemente">★</button>
                  </div>
                </div>
                <div class="docs-tools-section">
                  <span class="docs-sort-label">Densidad</span>
                  <div class="docs-density-group">
                    <button type="button" class="docs-density-btn active" data-density="cozy" onclick="setDocsDensityMode('cozy');closeDocsMenus()" title="Densidad cómoda" aria-label="Usar densidad cómoda">▤</button>
                    <button type="button" class="docs-density-btn" data-density="compact" onclick="setDocsDensityMode('compact');closeDocsMenus()" title="Densidad compacta" aria-label="Usar densidad compacta">≣</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="docs-toolbar-summary"></div>
          <div class="docs-network-banner hidden" id="docs-network-banner" aria-live="polite"></div>
          <div class="docs-batch-actions hidden" id="docs-batch-actions">
            <button type="button" class="btn-secondary" onclick="clearDocsSelection()" aria-label="Limpiar elementos seleccionados">Limpiar selección</button>
            <button type="button" class="btn-secondary hidden" id="docs-batch-retry-btn" onclick="deleteSelectedDocs()" aria-label="Reintentar eliminación">Reintentar fallidos</button>
            <button type="button" class="btn-secondary btn-secondary-danger" onclick="deleteSelectedDocs()" aria-label="Eliminar elementos seleccionados">Eliminar seleccionados</button>
          </div>
        </div>
        <div class="docs-layout" role="region" aria-label="Zona principal de documentación">
          <div class="docs-sidebar" role="navigation" aria-label="Árbol de carpetas">
            <div class="docs-panel-header"><h3>Carpetas</h3><button type="button" class="docs-sidebar-toggle-btn" id="docs-sidebar-toggle-btn" onclick="toggleDocsSidebarCollapse()" aria-label="Ocultar panel de carpetas" aria-pressed="false" title="Ocultar panel de carpetas">⇤</button></div>
            <div class="docs-categories" id="docs-categories"></div>
          </div>
          <button type="button" class="docs-sidebar-restore-btn hidden" id="docs-sidebar-restore-btn" onclick="toggleDocsSidebarCollapse()" aria-label="Mostrar panel de carpetas" title="Mostrar panel de carpetas">⇥</button>
          <div class="docs-content" id="docs-content" role="region" aria-label="Resultados de documentos"></div>
          <div class="doc-full-view" id="doc-full-view" role="region" aria-label="Detalle del documento"></div>
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
            <div class="settings-notes-feedback-pref" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
              <label class="setting-label" style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600">
                <input type="checkbox" id="pref-notes-save-sound" onchange="onNotesSaveSoundPrefChange(this)">
                Sonido breve al guardar una nota
              </label>
              <div style="font-size:11px;color:var(--text-muted);margin-top:6px;line-height:1.45">Solo en este navegador. Desactivado por defecto. Si lo activas, al guardar una nota se reproduce un tono breve y, en móviles compatibles, una vibración suave.</div>
            </div>
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

          <div class="settings-block security-block">
            <div class="settings-block-header">
              <span class="settings-block-icon">🔒</span>
              <div>
                <div class="settings-block-title">Seguridad</div>
                <div class="settings-block-desc">Gestiona el acceso a tu perfil</div>
              </div>
            </div>
            <div class="security-row">
              <div class="security-row-info">
                <div class="security-row-label">PIN de acceso</div>
                <div class="security-row-hint">Protege tu perfil con un PIN de 4 dígitos</div>
              </div>
              <button class="btn-secondary security-btn" onclick="openChangePinModal()">
                🔑 Cambiar PIN
              </button>
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
const _viewScrollPositions = {};

export function showView(view, btn) {
  if (view !== 'projects') {
    exitProjectPresentationMode();
  }

  // Save scroll position of the current visible view before hiding it
  const main = document.getElementById('main-content');
  if (main && currentView && currentView !== view) {
    _viewScrollPositions[currentView] = main.scrollTop;
  }

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
      syncNotesSaveSoundCheckbox();
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
  if (view === 'notes') {
    renderNotes();
    syncNotesSearchScopeHint();
    // Carrusel de fechas: debe pintarse siempre que la vista notas esté en el DOM (evita hueco vacío hasta pulsar ◀/▶).
    renderDateNav();
  }
  if (view === 'postit') renderPostitBoard();
  if (view === 'public-notes') renderPublicNotes();
  if (view === 'my-groups') {
    renderMyGroupsView();
    refreshPendingInvitesFromAPI().then(() => updateWorkGroupInviteNavBadge());
  }
  if (view === 'projects') {
    if (!window.__fromProjectsDeepLink) {
      setProjectUserFilter(null);
    }
    renderProjects();
    if (typeof window.initProjectsDeepLinkFromHash === 'function') {
      window.initProjectsDeepLinkFromHash();
    }
  }
  if (view === 'docs') renderDocs();
  if (view === 'shortcuts') { renderShortcuts(); onShortcutIconModeChange(); }
  if (view === 'whiteboard') renderWhiteboard();
  if (view === 'chat') renderChat();
  if (view === 'settings') {
    renderSettingsEditor();
    renderThemeGrid();
    syncNotesSaveSoundCheckbox();
  }
  updateChatNavBadge();

  // Restore scroll position for this view (after render so layout is ready)
  if (main && _viewScrollPositions[view] != null) {
    requestAnimationFrame(() => { main.scrollTop = _viewScrollPositions[view]; });
  } else if (main) {
    requestAnimationFrame(() => { main.scrollTop = 0; });
  }
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
    const tipParts = [];
    if (isToday && !isActive) tipParts.push('Hoy (no seleccionado): pulsa para ver las notas de este día');
    if (hasUnreadMention) tipParts.push('Mención sin leer en este día');
    chip.title = tipParts.length ? tipParts.join(' · ') : `Notas del ${ds}`;

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
    chip.onclick = () => {
      setCurrentDate(ds);
      renderDateNav();
      const area = document.getElementById('notes-area');
      if (area && currentView === 'notes' && currentNoteView !== 'calendar' && currentNoteView !== 'weekly' && currentNoteView !== 'mentions') {
        area.innerHTML = `<div class="notes-day-skeleton" aria-busy="true"><div class="notes-day-skeleton-bar"></div><div class="notes-day-skeleton-bar notes-day-skeleton-bar--short"></div><div class="notes-day-skeleton-bar"></div></div>`;
        requestAnimationFrame(() => renderNotes());
      } else {
        renderNotes();
      }
      if (currentView === 'notes') {
        announceNotes(isToday ? 'Mostrando notas de hoy' : `Mostrando notas de ${label}`);
      }
    };
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
  const area = document.getElementById('notes-area');
  if (area && currentView === 'notes' && currentNoteView !== 'calendar' && currentNoteView !== 'weekly' && currentNoteView !== 'mentions') {
    area.innerHTML = `<div class="notes-day-skeleton" aria-busy="true"><div class="notes-day-skeleton-bar"></div><div class="notes-day-skeleton-bar notes-day-skeleton-bar--short"></div><div class="notes-day-skeleton-bar"></div></div>`;
    requestAnimationFrame(() => renderNotes());
  } else {
    renderNotes();
  }
  if (currentView === 'notes') {
    announceNotes(dir < 0 ? 'Carrusel: semana anterior' : 'Carrusel: semana siguiente');
  }
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

let _notesSearchDebounceTimer = null;
const NOTES_SEARCH_DEBOUNCE_MS = 220;

/**
 * Handle search query
 * @param {string} q - Search query
 */
export function handleSearch(q) {
  const norm = String(q || '').toLowerCase().trim();
  setSearchQuery(norm);
  syncNotesSearchScopeHint();
  const busy = document.getElementById('notes-search-busy');
  if (busy) {
    if (norm.length > 0) {
      busy.textContent = 'Buscando…';
      busy.classList.remove('hidden');
    } else {
      busy.textContent = '';
      busy.classList.add('hidden');
    }
  }
  if (_notesSearchDebounceTimer) clearTimeout(_notesSearchDebounceTimer);
  _notesSearchDebounceTimer = setTimeout(() => {
    _notesSearchDebounceTimer = null;
    if (busy) {
      busy.textContent = '';
      busy.classList.add('hidden');
    }
    renderNotes();
  }, NOTES_SEARCH_DEBOUNCE_MS);
}

/** Vacía el buscador de notas y vuelve a pintar la lista. */
export function clearNotesSearch() {
  if (_notesSearchDebounceTimer) {
    clearTimeout(_notesSearchDebounceTimer);
    _notesSearchDebounceTimer = null;
  }
  setSearchQuery('');
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  const busy = document.getElementById('notes-search-busy');
  if (busy) {
    busy.textContent = '';
    busy.classList.add('hidden');
  }
  syncNotesSearchScopeHint();
  renderNotes();
}

/** Quita búsqueda, etiqueta activa, filtro por autor e historial completo; no cambia turnos del sidebar. */
export function clearAllNotesFilters() {
  if (_notesSearchDebounceTimer) {
    clearTimeout(_notesSearchDebounceTimer);
    _notesSearchDebounceTimer = null;
  }
  setSearchQuery('');
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  const busy = document.getElementById('notes-search-busy');
  if (busy) {
    busy.textContent = '';
    busy.classList.add('hidden');
  }
  setActiveNoteTagFilter(null);
  setNotesAuthorFilterId(null);
  setSearchNotesAllDates(false);
  const hist = document.getElementById('notes-search-history');
  if (hist) hist.checked = false;
  syncNotesSearchScopeHint();
  renderNotes();
}

/** Vuelve a la vista lista restaurando all/mine/mentions/reminders/weekly previa al calendario. */
export function exitNotesCalendarToList() {
  let v = 'all';
  try {
    const s = sessionStorage.getItem('diario_notes_view_before_cal');
    if (s && ['all', 'mine', 'mentions', 'reminders', 'weekly'].includes(s)) v = s;
  } catch {
    /* ignore */
  }
  const btn =
    v === 'mine'
      ? document.getElementById('nav-mine')
      : v === 'mentions'
        ? document.getElementById('nav-mentions')
        : v === 'reminders'
          ? document.getElementById('nav-reminders')
          : v === 'weekly'
            ? document.getElementById('nav-weekly')
            : document.getElementById('nav-all');
  setNoteView(v, btn || document.getElementById('nav-all'));
}

/** Oculta de forma persistente el banner de onboarding de la vista notas. */
export function dismissNotesOnboarding() {
  try {
    localStorage.setItem('diario_notes_onboarding_dismissed_v1', '1');
  } catch {
    /* ignore */
  }
  document.getElementById('notes-onboarding-banner')?.classList.add('hidden');
  bumpNotesMetric('notes_onboarding_dismiss');
}

export function onNotesSearchHistoryChange(el) {
  setSearchNotesAllDates(!!(el && el.checked));
  syncNotesSearchScopeHint();
  renderNotes();
}

/** Texto de ayuda bajo el buscador: qué rango de fechas cubre la búsqueda. */
export function syncNotesSearchScopeHint() {
  const hint = document.getElementById('notes-search-scope-hint');
  if (!hint) return;
  const q = (searchQuery || '').trim();
  let t = '';
  if (searchNotesAllDates) {
    t = q
      ? 'ℹ️ Historial completo: se busca en título y cuerpo de las notas en todas las fechas visibles.'
      : 'ℹ️ Historial completo activo: al escribir se buscará en título y cuerpo en todas las fechas.';
  } else {
    t = q
      ? 'ℹ️ Solo día del carrusel (título y cuerpo). Activa historial completo para ampliar.'
      : 'ℹ️ Búsqueda en título y cuerpo solo en el día del carrusel (o activa historial completo).';
  }
  hint.textContent = t;
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
  renderNotes();
}

export function setNoteViewCalendar() {
  try {
    if (currentNoteView !== 'calendar') {
      sessionStorage.setItem('diario_notes_view_before_cal', currentNoteView);
    }
  } catch {
    /* ignore */
  }
  setCurrentNoteView('calendar');
  const container = document.getElementById('notes-area');
  if (container) {
    import('./notes.js').then(m => {
      m.renderNotesCalendarView();
    }).catch(err => console.error('Error:', err));
  }
}

// ===== UTILITY FUNCTIONS =====

async function refreshMyWorkGroupsFromAPI() {
  try {
    const groups = await apiGetMyWorkGroups();
    setWorkGroups(Array.isArray(groups) ? groups.map(wg => ({
      ...wg,
      id: wg._id || wg.id,
    })) : []);
    return true;
  } catch (err) {
    console.error('Error cargando mis grupos desde API:', err);
    setWorkGroups([]);
    return false;
  }
}

export async function refreshPendingInvitesFromAPI() {
  try {
    const invites = await apiGetPendingWorkGroupInvites();
    setWgInvites(Array.isArray(invites) ? invites.map(inv => ({
      ...inv,
      id: inv._id || inv.id,
      wgId: inv.wgId?._id || inv.wgId,
      fromUserId: inv.fromUserId?._id || inv.fromUserId,
      toUserId: inv.toUserId?._id || inv.toUserId,
    })) : []);
    return true;
  } catch (err) {
    console.error('Error cargando invitaciones pendientes desde API:', err);
    setWgInvites([]);
    return false;
  }
}

function syncWorkGroupInviteBadge() {
  refreshPendingInvitesFromAPI().then(() => updateWorkGroupInviteNavBadge());
}

async function renderMyGroupsView() {
  const root = document.getElementById('my-groups-root');
  if (!root || !currentUser) return;
  await refreshMyWorkGroupsFromAPI();
  const pendingCount = wgInvites.filter(i =>
    i.status === 'pending' && sameId(i.toUserId, currentUser?.id)
  ).length;
  const invitesBtn = document.getElementById('wg-invites-btn');
  if (invitesBtn) {
    invitesBtn.innerHTML = `📩 Invitaciones${pendingCount > 0 ? ` <span class="nav-badge" style="margin-left:6px">${pendingCount}</span>` : ''}`;
  }
  const myGroups = workGroups.filter(wg => userIsActiveWorkGroupMember(wg));
  if (myGroups.length === 0) {
    root.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👥</div><div>Aún no tienes grupos de trabajo</div><div style="font-size:11px;color:var(--text-muted)">Crea uno arriba o acepta una invitación en 📩 Invitaciones. Los grupos no aparecen aquí hasta que aceptes la invitación.</div></div>`;
    syncWorkGroupInviteBadge();
    return;
  }
  root.innerHTML = myGroups.map(wg => {
    const wgIdArg = String(wg.id).replace(/'/g, "\\'");
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
    return `<div class="wg-card-v2 wg-card-v2--clickable" role="button" tabindex="0" data-wg-id="${wg.id}" title="Clic para ver ficha del grupo" onclick="onWorkGroupCardClick(event,'${wgIdArg}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onWorkGroupCardClick(event,'${wgIdArg}');}">
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
        ${isAdmin ? `<button type="button" class="btn-primary" onclick="event.stopPropagation();openEditWorkGroupModal('${wgIdArg}')">Editar grupo</button>` : '<span style="font-size:11px;color:var(--text-muted)">Solo administradores pueden editar el grupo.</span>'}
        ${isOwner ? `<button type="button" class="btn-secondary btn-secondary-danger" onclick="event.stopPropagation();deleteWorkGroup('${wgIdArg}')">Eliminar grupo</button>` : ''}
      </div>
    </div>`;
  }).join('');
  syncWorkGroupInviteBadge();
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
  updateWorkGroupInviteNavBadge();
}

export function createWorkGroup() {
  openModal('workgroup-new-modal');
  const nameEl = document.getElementById('wg-new-name-input');
  const descEl = document.getElementById('wg-new-desc-input');
  if (nameEl) nameEl.value = '';
  if (descEl) descEl.value = '';
}

export async function openWorkGroupInvitesModal() {
  await refreshPendingInvitesFromAPI();
  updateWorkGroupInviteNavBadge();
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
      const wgName = wg ? escapeChatHtml(wg.name) : (inv.wgName ? escapeChatHtml(inv.wgName) : 'Grupo desconocido');
      const fromName = from ? escapeChatHtml(from.name) : '?';
      const initials = fromName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
      const color = from?.color || '#7858f6';
      return `
    <div class="wg-invite-card">
      <div class="wg-invite-card-left">
        <div class="wg-invite-avatar" style="background:${color}">${initials}</div>
        <div class="wg-invite-info">
          <div class="wg-invite-wgname">👥 ${wgName}</div>
          <div class="wg-invite-from">Invitado por <strong>${fromName}</strong></div>
        </div>
      </div>
      <div class="wg-invite-actions">
        <button class="btn-primary wg-invite-accept"
          onclick="acceptWgInvite('${String(inv.id).replace(/'/g, "\\'")}')">
          ✓ Aceptar
        </button>
        <button class="btn-secondary wg-invite-decline"
          onclick="declineWgInvite('${String(inv.id).replace(/'/g, "\\'")}')">
          ✕ Rechazar
        </button>
      </div>
    </div>
  `;
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
  window._editingWgId = wg.id;
  window._editingWgMongoId = wg._id || wg.id;
  const nameEl = document.getElementById('wg-edit-name-display');
  const descEl = document.getElementById('wg-edit-desc');
  const objectivesEl = document.getElementById('wg-edit-objectives');
  if (nameEl) {
    nameEl.textContent = wg.name;
    nameEl.setAttribute('contenteditable', 'true');
  }
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
        ${!sameId(u.id, wg.ownerId) ? `<button type="button" style="font-size:10px;color:var(--danger);background:none;border:none;cursor:pointer" onclick="removeWgMember('${String(wg.id).replace(/'/g, "\\'")}','${String(u.id).replace(/'/g, "\\'")}')">✕</button>` : ''}
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
    onConfirm: async () => {
      try {
        const mongoId = wg._id || wg.id;
        await apiDeleteWorkGroup(mongoId);
        await renderMyGroupsView();
        showToast('Grupo eliminado', 'info');
      } catch (err) {
        console.error('Error eliminando grupo:', err);
        showToast('No se pudo eliminar el grupo', 'error');
      }
    }
  });
}

export function saveWorkGroupEdit() {
  const wg = workGroups.find(w => sameId(w.id, window._editingWgId));
  if (!wg) return;
  const nameEl = document.getElementById('wg-edit-name-display');
  const descEl = document.getElementById('wg-edit-desc');
  const objectivesEl = document.getElementById('wg-edit-objectives');
  const newName = nameEl ? nameEl.textContent.trim() : '';
  if (!newName) {
    showToast('El nombre del grupo es obligatorio', 'error');
    return;
  }
  wg.name = newName;
  wg.description = descEl ? descEl.value.trim() : '';
  wg.objectives = objectivesEl ? objectivesEl.value.trim() : '';
  const mongoId = wg._id || wg.id;
  apiUpdateWorkGroup(mongoId, {
    name: wg.name,
    description: wg.description,
    objectives: wg.objectives,
    memberUserIds: wg.memberUserIds || [],
    adminUserIds: wg.adminUserIds || [],
  }).then(async () => {
    closeModal('workgroup-modal');
    await renderMyGroupsView();
    showToast('Grupo actualizado', 'success');
  }).catch((err) => {
    console.error('Error actualizando grupo:', err);
    showToast('No se pudo actualizar el grupo', 'error');
  });
}

export function acceptWgInvite(inviteId) {
  apiAcceptWorkGroupInvite(inviteId).then(async () => {
    await refreshPendingInvitesFromAPI();
    closeModal('workgroup-invites-modal');
    await renderMyGroupsView();
    updateWorkGroupInviteNavBadge();
    showToast('Invitación aceptada', 'success');
  }).catch((err) => {
    console.error('Error aceptando invitación:', err);
    showToast('No se pudo aceptar la invitación', 'error');
  });
}

export function declineWgInvite(inviteId) {
  apiDeclineWorkGroupInvite(inviteId).then(async () => {
    await refreshPendingInvitesFromAPI();
    await openWorkGroupInvitesModal();
    updateWorkGroupInviteNavBadge();
    showToast('Invitación rechazada', 'info');
  }).catch((err) => {
    console.error('Error rechazando invitación:', err);
    showToast('No se pudo rechazar la invitación', 'error');
  });
}

export function removeWgMember(wgId, userId) {
  const wg = workGroups.find(w => sameId(w.id, wgId));
  if (!wg) return;
  wg.memberUserIds = (wg.memberUserIds || []).filter(id => !sameId(id, userId));
  const mongoId = wg._id || wg.id;
  apiUpdateWorkGroup(mongoId, {
    memberUserIds: wg.memberUserIds || [],
  }).then(() => {
    openEditWorkGroupModal(wgId);
    showToast('Miembro eliminado', 'info');
  }).catch((err) => {
    console.error('Error eliminando miembro:', err);
    showToast('No se pudo eliminar el miembro', 'error');
  });
}

export function saveNewWorkGroup() {
  const nameInput = document.getElementById('wg-new-name-input') || document.getElementById('wg-new-name');
  const descInput = document.getElementById('wg-new-desc-input');
  const name = nameInput?.value.trim();
  if (!name) { showToast('El nombre es requerido', 'error'); return; }
  const desc = descInput?.value.trim() || '';
  const newWg = {
    name,
    description: desc,
    objectives: '',
    ownerId: currentUser.id,
    adminUserIds: [currentUser.id],
    memberUserIds: [],
    createdAt: new Date().toISOString(),
  };
  apiCreateWorkGroup(newWg).then(async () => {
    closeModal('workgroup-new-modal');
    await renderMyGroupsView();
    showToast('Grupo creado', 'success');
  }).catch((err) => {
    console.error('Error creando grupo:', err);
    showToast('No se pudo crear el grupo', 'error');
  });
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
      onclick="selectWgInviteSuggestion('${String(u.id).replace(/'/g, "\\'")}', '${String(u.name).replace(/'/g, "\\'")}')">
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
  const wg = workGroups.find(w =>
    sameId(w.id, window._editingWgId) || sameId(w._id, window._editingWgId)
  );
  const wgMongoId = window._editingWgMongoId || wg?._id || wg?.id;
  if (!wgMongoId) {
    showToast('No se puede invitar en este grupo aún. Recarga la vista de grupos.', 'error');
    return;
  }
  if (/^\d+$/.test(String(wgMongoId))) {
    showToast('Este grupo tiene un ID legado y no admite invitaciones API. Recarga "Mis grupos" para sincronizar con BD.', 'error');
    return;
  }
  apiCreateWorkGroupInvite(wgMongoId, userId).then(async () => {
    await refreshPendingInvitesFromAPI();
    updateWorkGroupInviteNavBadge();
    window._selectedWgInviteUserId = null;
    const input = document.getElementById('wg-edit-invite-search');
    if (input) input.value = '';
    showToast('Invitación enviada', 'success');
  }).catch((err) => {
    console.error('Error enviando invitación:', err);
    if (err?.status === 409) {
      showToast('Ya hay una invitación pendiente para este usuario', 'info');
      return;
    }
    if (err?.status === 400) {
      showToast(err.message || 'Invitación no válida', 'error');
      return;
    }
    showToast('No se pudo enviar la invitación', 'error');
  });
}