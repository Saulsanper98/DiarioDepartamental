// ===== WHITEBOARD MODULE =====
import { currentUser, notes, projects, postitCards, USERS, sameId } from './data.js';
import { showToast, showConfirmModal } from './modalControl.js';

// ── Estado ──
let canvas, ctx;
let tool = 'select';
let color = '#7864ff';
let lineWidth = 2;
let fillShapes = false; // toggle relleno

let paths = [];
let elements = [];
let stickies = [];
let currentPath = null;
let isDrawing = false;

let selectedElements = [];
let isDragging = false;
let dragStart = null;    // posición canvas al inicio del drag
let dragOriginals = [];  // posiciones originales de los elementos
let isResizing = false;
let resizeHandle = null;   // 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'
let resizeElement = null;
let resizeOriginal = null; // { x, y, w, h } al inicio del resize

let isSelecting = false;
let selectionRect = null;

let scale = 1;
let panX = 0, panY = 0;
let isPanning = false;
let lastPan = { x: 0, y: 0 };
let isSpacePressed = false;
let connectingFrom = null; // { elementId, anchorSide }
let hoveredAnchor = null;  // { elementId, anchorSide, x, y }

let shapeStart = null;
let currentShape = 'rect';

let editingText = null; // elemento texto en edición inline

let clipboard = [];
let history = [];
let redoStack = [];

let pages = [{ id: 1, name: 'Página 1', paths: [], elements: [], stickies: [] }];
let currentPageId = 1;
let layersPanelOpen = false;

const STORAGE_KEY = 'diario_whiteboard';

// ── Render principal ──
export function renderWhiteboard() {
  const view = document.getElementById('view-whiteboard');
  if (!view) return;
  view.innerHTML = `
  <div class="wb-container">

    <!-- Toolbar vertical derecha -->
    <div class="wb-toolbar-right">
      <div class="wb-tool-section">
        <button class="wb-icon-btn active" data-tool="select" onclick="wbSetTool('select')" title="Seleccionar (S)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 3l14 9-7 1-4 7z"/>
          </svg>
        </button>
        <button class="wb-icon-btn" data-tool="pen" onclick="wbSetTool('pen')" title="Lápiz (P)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          </svg>
        </button>
        <button class="wb-icon-btn" data-tool="highlight" onclick="wbSetTool('highlight')" title="Resaltador (H)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
          </svg>
        </button>
        <button class="wb-icon-btn" data-tool="eraser" onclick="wbSetTool('eraser')" title="Borrador (E)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 20H7L3 16l10-10 7 7z"/><path d="m6.5 17.5 7-7"/>
          </svg>
        </button>
      </div>

      <div class="wb-tool-divider"></div>

      <div class="wb-tool-section">
        <button class="wb-icon-btn" data-tool="text" onclick="wbSetTool('text')" title="Texto (T)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>
          </svg>
        </button>
        <button class="wb-icon-btn" data-tool="sticky" onclick="wbSetTool('sticky')" title="Post-it (N)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><polyline points="15 3 15 9 21 9"/>
          </svg>
        </button>
        <button class="wb-icon-btn" data-tool="card" onclick="wbSetTool('card')" title="Añadir tarjeta (C)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </button>
      </div>

      <div class="wb-tool-divider"></div>

      <div class="wb-tool-section" style="position:relative">
        <button class="wb-icon-btn" id="wb-shapes-trigger"
          data-tool="shape"
          onclick="wbToggleShapesMenu()"
          title="Formas (F)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="wb-shapes-trigger-icon">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <div id="wb-shapes-submenu" class="wb-shapes-submenu hidden">
          <button class="wb-shape-opt active" data-shape="rect"
            onclick="wbPickShape('rect')" title="Rectángulo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
          <button class="wb-shape-opt" data-shape="circle"
            onclick="wbPickShape('circle')" title="Círculo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
          </button>
          <button class="wb-shape-opt" data-shape="arrow"
            onclick="wbPickShape('arrow')" title="Flecha">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
          <button class="wb-shape-opt" data-shape="line"
            onclick="wbPickShape('line')" title="Línea">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>
          </button>
        </div>
        <button class="wb-icon-btn" data-tool="connector" onclick="wbSetTool('connector')" title="Conector (K)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14"/><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>
          </svg>
        </button>
      </div>

      <div class="wb-tool-divider"></div>

      <div class="wb-tool-section">
        <div class="wb-color-wrapper" title="Color">
          <input type="color" id="wb-color" value="#7864ff" onchange="wbSetColor(this.value)" class="wb-color-input-hidden">
          <div class="wb-color-swatch" id="wb-color-swatch" onclick="document.getElementById('wb-color').click()" style="background:#7864ff"></div>
        </div>
        <button class="wb-icon-btn" id="wb-fill-btn" onclick="wbToggleFill()" title="Toggle relleno">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="wb-tool-divider"></div>

      <div class="wb-tool-section">
        <button class="wb-icon-btn" onclick="wbUndo()" title="Deshacer (Ctrl+Z)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
          </svg>
        </button>
        <button class="wb-icon-btn" onclick="wbRedo()" title="Rehacer (Ctrl+Y)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H11"/>
          </svg>
        </button>
        <button class="wb-icon-btn" onclick="wbClear()" title="Limpiar todo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
        <button class="wb-icon-btn" onclick="wbExport()" title="Exportar PNG">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
          </svg>
        </button>
        <button class="wb-icon-btn" onclick="wbToggleLayers()" title="Capas (L)" id="wb-layers-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
        </button>
      </div>

      <!-- Grosor -->
      <div class="wb-tool-divider"></div>
      <div class="wb-tool-section wb-size-section">
        <input type="range" id="wb-size" min="1" max="20" value="2"
          oninput="wbSetSize(this.value)" class="wb-size-vertical" title="Grosor">
      </div>
    </div>

    <!-- Canvas area -->
    <div class="wb-main">
      <!-- Pages tabs -->
      <div class="wb-pages-bar">
        <div class="wb-page-tabs" id="wb-page-tabs"></div>
      </div>

      <!-- Canvas -->
      <div class="wb-canvas-wrapper" id="wb-canvas-wrapper">
        <canvas id="wb-canvas"></canvas>
        <div id="wb-stickies-layer" class="wb-stickies-layer"></div>
        <div id="wb-text-editor-layer" class="wb-text-editor-layer"></div>
        <!-- Toolbar flotante contextual -->
        <div id="wb-context-toolbar" class="wb-context-toolbar hidden">
          <!-- Selector de tamaño -->
          <div class="wb-ctx-dropdown" id="wb-ctx-size-dropdown">
            <button class="wb-ctx-dropdown-btn" onclick="wbCtxToggleSizeMenu()" id="wb-ctx-size-label">
              Mediano
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="wb-ctx-dropdown-menu hidden" id="wb-ctx-size-menu">
              <div class="wb-ctx-menu-item" onclick="wbCtxFontSize(12, 'Extra pequeño')">
                <span style="font-size:10px">Extra pequeño</span>
              </div>
              <div class="wb-ctx-menu-item" onclick="wbCtxFontSize(18, 'Pequeño')">
                <span style="font-size:12px">Pequeño</span>
              </div>
              <div class="wb-ctx-menu-item active" onclick="wbCtxFontSize(24, 'Mediano')">
                <span style="font-size:14px">Mediano</span>
              </div>
              <div class="wb-ctx-menu-item" onclick="wbCtxFontSize(36, 'Grande')">
                <span style="font-size:16px">Grande</span>
              </div>
              <div class="wb-ctx-menu-item" onclick="wbCtxFontSize(52, 'Extra grande')">
                <span style="font-size:18px">Extra grande</span>
              </div>
              <div class="wb-ctx-menu-item" onclick="wbCtxFontSize(72, 'Enorme')">
                <span style="font-size:20px">Enorme</span>
              </div>
            </div>
          </div>

          <div class="wb-ctx-divider"></div>

          <!-- Negrita e Itálica -->
          <button class="wb-ctx-btn" id="wb-ctx-bold" onclick="wbCtxToggleBold()" title="Negrita">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
          </button>
          <button class="wb-ctx-btn wb-ctx-italic" id="wb-ctx-italic" onclick="wbCtxToggleItalic()" title="Cursiva">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>

          <div class="wb-ctx-divider"></div>

          <!-- Selector de color -->
          <div class="wb-ctx-dropdown" id="wb-ctx-color-dropdown">
            <button class="wb-ctx-color-trigger" onclick="wbCtxToggleColorMenu()" title="Color del texto">
              <div id="wb-ctx-color-preview" style="background:#ffffff;width:14px;height:14px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.3)"></div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="wb-ctx-dropdown-menu wb-ctx-color-menu hidden" id="wb-ctx-color-menu">
              <div class="wb-ctx-color-grid">
                <div class="wb-ctx-color-opt" style="background:#ffffff" onclick="wbCtxSetColor('#ffffff')" title="Blanco"></div>
                <div class="wb-ctx-color-opt" style="background:#e5e7eb" onclick="wbCtxSetColor('#e5e7eb')" title="Gris claro"></div>
                <div class="wb-ctx-color-opt" style="background:#c4b5fd" onclick="wbCtxSetColor('#c4b5fd')" title="Lavanda"></div>
                <div class="wb-ctx-color-opt" style="background:#818cf8" onclick="wbCtxSetColor('#818cf8')" title="Índigo"></div>
                <div class="wb-ctx-color-opt" style="background:#86efac" onclick="wbCtxSetColor('#86efac')" title="Verde"></div>
                <div class="wb-ctx-color-opt" style="background:#34d399" onclick="wbCtxSetColor('#34d399')" title="Esmeralda"></div>
                <div class="wb-ctx-color-opt" style="background:#fde68a" onclick="wbCtxSetColor('#fde68a')" title="Amarillo"></div>
                <div class="wb-ctx-color-opt" style="background:#f97316" onclick="wbCtxSetColor('#f97316')" title="Naranja"></div>
                <div class="wb-ctx-color-opt" style="background:#fca5a5" onclick="wbCtxSetColor('#fca5a5')" title="Rojo claro"></div>
                <div class="wb-ctx-color-opt" style="background:#ef4444" onclick="wbCtxSetColor('#ef4444')" title="Rojo"></div>
                <div class="wb-ctx-color-opt" style="background:#7dd3fc" onclick="wbCtxSetColor('#7dd3fc')" title="Azul claro"></div>
                <div class="wb-ctx-color-opt" style="background:#3b82f6" onclick="wbCtxSetColor('#3b82f6')" title="Azul"></div>
              </div>
              <div class="wb-ctx-color-custom">
                <input type="color" id="wb-ctx-custom-color" 
                  onchange="wbCtxSetColor(this.value)"
                  title="Color personalizado">
                <span>Personalizado</span>
              </div>
            </div>
          </div>
        </div>
        <canvas id="wb-minimap" class="wb-minimap"></canvas>
        <!-- Modal selector de tarjeta -->
        <div id="wb-card-picker" class="wb-card-picker hidden">
          <div class="wb-card-picker-header">
            <span>Añadir tarjeta</span>
            <button onclick="document.getElementById('wb-card-picker').classList.add('hidden')">✕</button>
          </div>
          <div class="wb-card-picker-tabs">
            <button class="wb-card-tab active" onclick="wbCardPickerTab('notes', this)">📋 Notas</button>
            <button class="wb-card-tab" onclick="wbCardPickerTab('projects', this)">🎯 Proyectos</button>
            <button class="wb-card-tab" onclick="wbCardPickerTab('postits', this)">🗂 Post-its</button>
          </div>
          <div class="wb-card-picker-search">
            <input type="text" id="wb-card-search" placeholder="Buscar..." oninput="wbCardPickerSearch(this.value)">
          </div>
          <div class="wb-card-picker-list" id="wb-card-picker-list"></div>
        </div>
        <!-- Panel de capas -->
        <div id="wb-layers-panel" class="wb-layers-panel hidden">
          <div class="wb-layers-header">
            <span>Capas</span>
            <button onclick="wbToggleLayers()">✕</button>
          </div>
          <div class="wb-layers-list" id="wb-layers-list"></div>
        </div>

        <!-- Zoom controls abajo centrado -->
        <div class="wb-zoom-controls">
          <button class="wb-zoom-btn" onclick="wbZoomOut()" title="Alejar">−</button>
          <span class="wb-zoom-label" id="wb-zoom-label">100%</span>
          <button class="wb-zoom-btn" onclick="wbZoomIn()" title="Acercar">+</button>
          <button class="wb-zoom-btn" onclick="wbResetView()" title="Restablecer">⊡</button>
        </div>
      </div>
    </div>

  </div>
`;
  initWhiteboard();
}

function initWhiteboard() {
  canvas = document.getElementById('wb-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  scale = 1; panX = 0; panY = 0;
  resizeCanvas();
  loadWhiteboardData();
  attachWhiteboardEvents();
  renderPageTabs();
  redraw();
  updateZoomLabel();
}

function resizeCanvas() {
  const wrapper = document.getElementById('wb-canvas-wrapper');
  if (!wrapper || !canvas) return;
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  redraw();
}

function attachWhiteboardEvents() {
  canvas.addEventListener('mousedown', wbMouseDown);
  canvas.addEventListener('mousemove', wbMouseMove);
  canvas.addEventListener('mouseup', wbMouseUp);
  canvas.addEventListener('wheel', wbWheel, { passive: false });
  canvas.addEventListener('dblclick', wbDblClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', wbKeyDown);
  document.addEventListener('keyup', wbKeyUp);
  document.addEventListener('paste', wbPaste);
  window.addEventListener('resize', resizeCanvas);

  // Click en minimap navega al punto
  const minimap = document.getElementById('wb-minimap');
  if (minimap) {
    minimap.style.pointerEvents = 'all';
    minimap.addEventListener('click', wbMinimapClick);
  }
}

// ── Coordenadas ──
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - panX) / scale,
    y: (e.clientY - rect.top - panY) / scale
  };
}

// Obtener los 4 puntos de anclaje de un elemento (top, right, bottom, left)
function getElementAnchors(el) {
  if (!el) return [];
  let cx, cy, w, h;
  if (el.type === 'shape' && el.shape !== 'arrow' && el.shape !== 'line') {
    cx = el.x + el.w / 2; cy = el.y + el.h / 2;
    w = Math.abs(el.w); h = Math.abs(el.h);
  } else if (el.type === 'card') {
    cx = el.x + (el.w||220) / 2; cy = el.y + (el.h||120) / 2;
    w = el.w||220; h = el.h||120;
  } else if (el.type === 'text') {
    cx = el.x + 50; cy = el.y + (el.size||18) / 2;
    w = 100; h = el.size || 18;
  } else {
    return [];
  }
  return [
    { side: 'top',    x: cx,       y: cy - h/2 },
    { side: 'right',  x: cx + w/2, y: cy       },
    { side: 'bottom', x: cx,       y: cy + h/2 },
    { side: 'left',   x: cx - w/2, y: cy       },
  ];
}

// Obtener el punto de un anclaje específico
function getAnchorPoint(el, side) {
  const anchors = getElementAnchors(el);
  return anchors.find(a => a.side === side) || null;
}

// Obtener el anclaje más cercano a un punto
function getNearestAnchor(pos, excludeId = null) {
  let nearest = null;
  let minDist = 30 / scale; // radio de detección
  for (const el of elements) {
    if (el.id === excludeId) continue;
    for (const anchor of getElementAnchors(el)) {
      const dist = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = { elementId: el.id, side: anchor.side, x: anchor.x, y: anchor.y };
      }
    }
  }
  return nearest;
}

// Recalcular posición de todos los conectores que apuntan a un elemento
function updateConnectorsForElement(elId) {
  elements.forEach(el => {
    if (el.type !== 'connector') return;
    if (el.fromId === elId || el.toId === elId) {
      recalcConnectorEndpoints(el);
    }
  });
}

function recalcConnectorEndpoints(conn) {
  const fromEl = elements.find(e => e.id === conn.fromId);
  const toEl = elements.find(e => e.id === conn.toId);
  if (fromEl && conn.fromSide) {
    const pt = getAnchorPoint(fromEl, conn.fromSide);
    if (pt) { conn.x = pt.x; conn.y = pt.y; }
  }
  if (toEl && conn.toSide) {
    const pt = getAnchorPoint(toEl, conn.toSide);
    if (pt) { conn.x2 = pt.x; conn.y2 = pt.y; }
  }
}

// Obtener los 8 handles de un elemento
function getResizeHandles(el) {
  if (!el) return [];
  let x, y, w, h;
  if (el.type === 'shape' && el.shape !== 'arrow' && el.shape !== 'line') {
    x = Math.min(el.x, el.x + el.w);
    y = Math.min(el.y, el.y + el.h);
    w = Math.abs(el.w);
    h = Math.abs(el.h);
  } else if (el.type === 'card' || el.type === 'image') {
    x = el.x; y = el.y; w = el.w || 220; h = el.h || 120;
  } else {
    return [];
  }
  return [
    { id: 'nw', x: x,       y: y       },
    { id: 'n',  x: x + w/2, y: y       },
    { id: 'ne', x: x + w,   y: y       },
    { id: 'e',  x: x + w,   y: y + h/2 },
    { id: 'se', x: x + w,   y: y + h   },
    { id: 's',  x: x + w/2, y: y + h   },
    { id: 'sw', x: x,       y: y + h   },
    { id: 'w',  x: x,       y: y + h/2 },
  ];
}

// Detectar si el ratón está sobre un handle
function getHandleAtPos(el, pos) {
  const handles = getResizeHandles(el);
  const hitRadius = 8 / scale;
  return handles.find(h => Math.hypot(pos.x - h.x, pos.y - h.y) < hitRadius) || null;
}

// Cursor según el handle
function getCursorForHandle(handleId) {
  const cursors = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    e: 'e-resize', se: 'se-resize', s: 's-resize',
    sw: 'sw-resize', w: 'w-resize'
  };
  return cursors[handleId] || 'default';
}

// ── Eventos de ratón ──
function wbMouseDown(e) {
  // Asegurarse de que el foco está en la pizarra
  canvas.focus && canvas.focus();

  const pos = getCanvasPos(e);

  if (e.button === 2 || e.button === 1 || isSpacePressed) {
    e.preventDefault();
    isPanning = true;
    lastPan = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (tool === 'pen' || tool === 'highlight') {
    isDrawing = true;
    currentPath = {
      type: 'path',
      color: tool === 'highlight' ? color + '55' : color,
      width: tool === 'highlight' ? lineWidth * 6 : lineWidth,
      points: [pos],
      highlight: tool === 'highlight'
    };
  } else if (tool === 'eraser') {
    isDrawing = true;
    currentPath = { type: 'path', color: '#ERASER', width: lineWidth * 4, points: [pos] };
  } else if (tool === 'shape') {
    isDrawing = true;
    shapeStart = pos;
  } else if (tool === 'sticky') {
    addSticky(pos);
  } else if (tool === 'card') {
    wbOpenCardPicker(pos);
  } else if (tool === 'connector') {
    const anchor = getNearestAnchor(pos);
    if (anchor) {
      connectingFrom = anchor;
      isDrawing = true;
      shapeStart = { x: anchor.x, y: anchor.y };
    } else {
      // Empezar desde punto libre
      connectingFrom = null;
      isDrawing = true;
      shapeStart = pos;
    }
  } else if (tool === 'text') {
    startInlineText(pos);
  } else if (tool === 'select') {
    // Primero comprobar si hay un handle de resize seleccionado
    if (selectedElements.length === 1) {
      const handle = getHandleAtPos(selectedElements[0], pos);
      if (handle) {
        isResizing = true;
        resizeHandle = handle.id;
        resizeElement = selectedElements[0];
        resizeOriginal = {
          x: resizeElement.x,
          y: resizeElement.y,
          w: resizeElement.w || 220,
          h: resizeElement.h || 120
        };
        dragStart = pos;
        return;
      }
    }
    // Luego hit test normal
    const hit = hitTestAll(pos);
    if (hit) {
      if (!selectedElements.includes(hit)) {
        selectedElements = e.shiftKey ? [...selectedElements, hit] : [hit];
      } else if (e.shiftKey) {
        selectedElements = selectedElements.filter(el => el !== hit);
      }
      if (selectedElements.length > 0) {
        isDragging = true;
        dragStart = pos;
        dragOriginals = selectedElements.map(el => {
          if (el.points) {
            return { points: el.points.map(p => ({...p})) };
          }
          return { x: el.x, y: el.y };
        });
      }
    } else {
      selectedElements = [];
      hideContextToolbar();
      isSelecting = true;
      selectionRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
    }
    redraw();
  }
}

function wbMouseMove(e) {
  const pos = getCanvasPos(e);

  if (isPanning) {
    panX += e.clientX - lastPan.x;
    panY += e.clientY - lastPan.y;
    lastPan = { x: e.clientX, y: e.clientY };
    redraw();
    return;
  }

  // Detectar ancla cercana cuando tool es connector
  if (tool === 'connector' && !isDrawing) {
    const newHover = getNearestAnchor(pos);
    if (JSON.stringify(newHover) !== JSON.stringify(hoveredAnchor)) {
      hoveredAnchor = newHover;
      redraw();
    }
  }

  if (isDrawing && currentPath) {
    currentPath.points.push(pos);
    // Borrar elementos que toca la goma en tiempo real
    if (tool === 'eraser') {
      const r = currentPath.width / 2;
      elements = elements.filter(el => {
        if (el.type === 'shape') {
          if (el.shape === 'arrow' || el.shape === 'line') {
            return distToSegment(pos, {x:el.x,y:el.y}, {x:el.x+el.w,y:el.y+el.h}) > r + 8;
          }
          return !(pos.x >= el.x && pos.x <= el.x+el.w && pos.y >= el.y && pos.y <= el.y+el.h);
        }
        if (el.type === 'text') {
          return Math.hypot(pos.x - el.x, pos.y - el.y) > r + 20;
        }
        if (el.type === 'image') {
          return !(pos.x >= el.x && pos.x <= el.x+el.w && pos.y >= el.y && pos.y <= el.y+el.h);
        }
        return true;
      });
    }
    redraw();
  } else if (isDrawing && (tool === 'shape' || tool === 'connector') && shapeStart) {
    redraw(shapeStart, pos); // pasar preview al redraw
  } else if (isResizing && resizeElement && dragStart) {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const orig = resizeOriginal;
    const minSize = 20;

    switch (resizeHandle) {
      case 'se':
        resizeElement.w = Math.max(minSize, orig.w + dx);
        resizeElement.h = Math.max(minSize, orig.h + dy);
        break;
      case 'sw':
        resizeElement.x = orig.x + dx;
        resizeElement.w = Math.max(minSize, orig.w - dx);
        resizeElement.h = Math.max(minSize, orig.h + dy);
        break;
      case 'ne':
        resizeElement.w = Math.max(minSize, orig.w + dx);
        resizeElement.y = orig.y + dy;
        resizeElement.h = Math.max(minSize, orig.h - dy);
        break;
      case 'nw':
        resizeElement.x = orig.x + dx;
        resizeElement.y = orig.y + dy;
        resizeElement.w = Math.max(minSize, orig.w - dx);
        resizeElement.h = Math.max(minSize, orig.h - dy);
        break;
      case 'e':
        resizeElement.w = Math.max(minSize, orig.w + dx);
        break;
      case 'w':
        resizeElement.x = orig.x + dx;
        resizeElement.w = Math.max(minSize, orig.w - dx);
        break;
      case 's':
        resizeElement.h = Math.max(minSize, orig.h + dy);
        break;
      case 'n':
        resizeElement.y = orig.y + dy;
        resizeElement.h = Math.max(minSize, orig.h - dy);
        break;
    }
    // Actualizar conectores enlazados
    if (resizeElement.id) updateConnectorsForElement(resizeElement.id);
    redraw();
    return;
  } else if (isDragging && dragStart && selectedElements.length > 0) {
    selectedElements.forEach((el, i) => {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      if (el.points) {
        // Es un path — mover todos sus puntos
        el.points = dragOriginals[i].points.map(pt => ({
          x: pt.x + dx,
          y: pt.y + dy
        }));
      } else {
        el.x = dragOriginals[i].x + dx;
        el.y = dragOriginals[i].y + dy;
      }
    });
    // Actualizar conectores en tiempo real
    selectedElements.forEach(el => {
      if (el.id) updateConnectorsForElement(el.id);
    });
    redraw();
  } else if (isSelecting && selectionRect) {
    selectionRect.w = pos.x - selectionRect.x;
    selectionRect.h = pos.y - selectionRect.y;
    redraw();
  }

  // Cambiar cursor al pasar sobre handles
  if (tool === 'select' && selectedElements.length === 1 && !isDragging && !isResizing) {
    const handle = getHandleAtPos(selectedElements[0], pos);
    if (handle) {
      canvas.style.cursor = getCursorForHandle(handle.id);
    } else {
      canvas.style.cursor = getCursorForTool();
    }
  }
}

function wbMouseUp(e) {
  const pos = getCanvasPos(e);

  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = isSpacePressed ? 'grab' : getCursorForTool();
    return;
  }

  if (isDrawing && currentPath) {
    saveHistory();   // guardar ANTES de modificar
    if (currentPath.color === '#ERASER') {
      eraseAtPath(currentPath);
    } else {
      paths.push(currentPath);
    }
    currentPath = null;
    isDrawing = false;
    saveWhiteboardData();
    redraw();
    return;
  }

  if (isDrawing && tool === 'connector' && shapeStart) {
    const endAnchor = getNearestAnchor(pos, connectingFrom?.elementId);
    const conn = {
      id: Date.now(),
      type: 'connector',
      x: shapeStart.x,
      y: shapeStart.y,
      x2: endAnchor ? endAnchor.x : pos.x,
      y2: endAnchor ? endAnchor.y : pos.y,
      color,
      lineWidth,
      fromId: connectingFrom?.elementId || null,
      fromSide: connectingFrom?.side || null,
      toId: endAnchor?.elementId || null,
      toSide: endAnchor?.side || null,
      curved: true,
    };
    if (Math.hypot(conn.x2 - conn.x, conn.y2 - conn.y) > 5) {
      saveHistory();
      elements.push(conn);
      saveWhiteboardData();
    }
    shapeStart = null;
    connectingFrom = null;
    isDrawing = false;
    redraw();
    return;
  }

  if (isDrawing && tool === 'shape' && shapeStart) {
    const w = pos.x - shapeStart.x;
    const h = pos.y - shapeStart.y;
    if (Math.abs(w) > 3 || Math.abs(h) > 3) {
      saveHistory();   // guardar ANTES de push
      elements.push({
        id: Date.now(),
        type: 'shape', shape: currentShape,
        x: shapeStart.x, y: shapeStart.y,
        w, h, color, lineWidth,
        fill: fillShapes,
        text: ''
      });
      saveWhiteboardData();
    }
    shapeStart = null;
    isDrawing = false;
    redraw();
    return;
  }

  if (isResizing) {
    isResizing = false;
    resizeHandle = null;
    resizeOriginal = null;
    resizeElement = null;
    dragStart = null;
    saveHistory();
    saveWhiteboardData();
    canvas.style.cursor = getCursorForTool();
    return;
  }

  if (isDragging) {
    isDragging = false;
    dragStart = null;
    dragOriginals = [];
    // Recalcular conectores de los elementos movidos
    selectedElements.forEach(el => {
      if (el.id) updateConnectorsForElement(el.id);
    });
    saveWhiteboardData();
    if (selectedElements.length === 1) {
      const el = selectedElements[0];
      if (el.type === 'text' || el.type === 'shape') {
        showContextToolbar(el);
      } else {
        hideContextToolbar();
      }
    } else {
      hideContextToolbar();
    }
    return;
  }

  if (isSelecting && selectionRect) {
    isSelecting = false;
    const r = normalizeRect(selectionRect);
    selectedElements = elements.filter(el => {
      const ex = el.x, ey = el.y;
      const ew = el.w || 0, eh = el.h || 0;
      return ex >= r.x && ey >= r.y && ex + ew <= r.x + r.w && ey + eh <= r.y + r.h;
    });
    selectionRect = null;
    redraw();
    if (selectedElements.length === 1) {
      const el = selectedElements[0];
      if (el.type === 'text' || el.type === 'shape') {
        showContextToolbar(el);
      } else {
        hideContextToolbar();
      }
    } else {
      hideContextToolbar();
    }
  }

  // Si el click fue mínimo (sin drag real), deseleccionar
  if (isSelecting) {
    isSelecting = false;
    selectionRect = null;
    selectedElements = [];
    hideContextToolbar();
    redraw();
  }
  if (layersPanelOpen) renderLayersPanel();
}

// ── Zoom centrado en cursor ──
function wbWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.1, Math.min(10, scale * delta));
  // Ajustar pan para que el zoom sea centrado en el cursor
  panX = mouseX - (mouseX - panX) * (newScale / scale);
  panY = mouseY - (mouseY - panY) * (newScale / scale);
  scale = newScale;
  updateZoomLabel();
  redraw();
}

// ── Double click: editar texto en forma ──
function wbDblClick(e) {
  const pos = getCanvasPos(e);
  const hit = hitTestAll(pos);
  if (hit && hit.type === 'card') {
    wbOpenCardRef(hit);
    return;
  }
  if (hit && hit.type === 'shape') {
    startInlineTextOnShape(hit);
  } else if (hit && hit.type === 'text') {
    startInlineTextEdit(hit);
  }
}

// ── Teclado ──
function wbKeyDown(e) {
  // Solo procesar si el foco está en la pizarra (no en inputs/textareas)
  const tag = document.activeElement?.tagName;
  const isEditable = document.activeElement?.isContentEditable ||
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.code === 'Space' && !isEditable) {
    e.preventDefault();
    isSpacePressed = true;
    if (canvas) canvas.style.cursor = 'grab';
    return;
  }

  if (isEditable) return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); wbUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault(); wbRedo(); return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectedElements = [...elements]; redraw(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    clipboard = selectedElements.map(el => JSON.parse(JSON.stringify(el)));
    if (clipboard.length) showToast(`${clipboard.length} elemento(s) copiado(s)`, 'info');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    if (!selectedElements.length) return;
    saveHistory();
    const duped = selectedElements.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: Date.now() + Math.random(), x: el.x + 20, y: el.y + 20 }));
    elements.push(...duped);
    selectedElements = duped;
    saveWhiteboardData(); redraw();
    showToast('Duplicado', 'success');
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement === document.body ||
        document.activeElement === canvas ||
        !isEditable) {
      if (selectedElements.length > 0) {
        saveHistory();
        const selectedIds = new Set(selectedElements.map(el => el.id));
        elements = elements.filter(el => !selectedIds.has(el.id) && !selectedElements.includes(el));
        paths = paths.filter(p => !selectedElements.includes(p));
        selectedElements = [];
        saveWhiteboardData(); redraw();
        if (layersPanelOpen) renderLayersPanel();
      }
      return;
    }
  }
  if (e.key === 'p') wbSetTool('pen');
  if (e.key === 'e') wbSetTool('eraser');
  if (e.key === 's') wbSetTool('select');
  if (e.key === 't') wbSetTool('text');
  if (e.key === 'f') wbSetTool('shape');
  if (e.key === 'h') wbSetTool('highlight');
  if (e.key === 'n') wbSetTool('sticky');
  if (e.key === 'k') wbSetTool('connector');
  if (e.key === 'Escape') { selectedElements = []; editingText = null; hideContextToolbar(); redraw(); }
}

function wbKeyUp(e) {
  if (e.code === 'Space') {
    isSpacePressed = false;
    if (canvas) canvas.style.cursor = getCursorForTool();
  }
}

// ── Pegar imagen del portapapeles ──
function wbPaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const cx = (canvas.width / 2 - panX) / scale;
        const cy = (canvas.height / 2 - panY) / scale;
        const maxW = 400;
        const ratio = Math.min(maxW / img.width, 1);
        saveHistory();
        elements.push({ id: Date.now(), type: 'image', x: cx - img.width*ratio/2, y: cy - img.height*ratio/2, w: img.width*ratio, h: img.height*ratio, src: url, _img: img });
        saveWhiteboardData(); redraw();
        showToast('Imagen pegada', 'success');
      };
      img.src = url;
      return;
    }
  }
  // Pegar elementos internos
  if (clipboard.length) {
    saveHistory();
    const pasted = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: Date.now() + Math.random(), x: el.x + 20, y: el.y + 20 }));
    elements.push(...pasted);
    selectedElements = pasted;
    saveWhiteboardData(); redraw();
  }
}

// ── Texto inline ──
function startInlineText(pos) {
  const wrapper = document.getElementById('wb-canvas-wrapper');
  if (!wrapper) return;
  // Eliminar cualquier editor previo
  wrapper.querySelectorAll('.wb-inline-text').forEach(el => el.remove());

  const screenX = pos.x * scale + panX;
  const screenY = pos.y * scale + panY;

  const div = document.createElement('div');
  div.className = 'wb-inline-text';
  div.contentEditable = 'true';
  div.style.cssText = `
    position: absolute;
    left: ${screenX}px;
    top: ${screenY - 20}px;
    color: ${color};
    font-size: ${24 * scale}px;
    font-family: 'Syne', sans-serif;
    min-width: 80px;
    outline: none;
    border-bottom: 1.5px solid rgba(120,100,255,0.6);
    background: transparent;
    padding: 2px 6px;
    z-index: 100;
    pointer-events: all;
    white-space: pre;
    caret-color: rgba(120,100,255,0.9);
  `;
  div.textContent = '';
  wrapper.appendChild(div);

  // Esperar al mouseup antes de enfocar para evitar blur inmediato
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const text = div.textContent.trim();
    if (text) {
      saveHistory();
      elements.push({ id: Date.now(), type: 'text', x: pos.x, y: pos.y - 24/scale, text, color, size: 24 });
      saveWhiteboardData(); redraw();
    }
    div.remove();
  };

  // Enfocar después del mouseup
  setTimeout(() => {
    div.focus();
    div.addEventListener('blur', commit);
    div.addEventListener('keydown', e => {
      if (e.key === 'Escape') { committed = true; div.remove(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    });
  }, 100);
}

function startInlineTextOnShape(shape) {
  const wrapper = document.getElementById('wb-canvas-wrapper');
  if (!wrapper) return;
  wrapper.querySelectorAll('.wb-inline-text').forEach(el => el.remove());

  const div = document.createElement('div');
  div.className = 'wb-inline-text wb-inline-text--shape';
  div.contentEditable = 'true';
  div.style.cssText = `
    position: absolute;
    left: ${(shape.x + shape.w/2) * scale + panX - Math.abs(shape.w * scale)/2}px;
    top: ${(shape.y + shape.h/2) * scale + panY - 15}px;
    width: ${Math.abs(shape.w * scale)}px;
    text-align: center;
    color: white;
    font-size: ${Math.max(12, 14 * scale)}px;
    font-family: 'Syne', sans-serif;
    outline: none;
    border: 1px solid rgba(120,100,255,0.4);
    border-radius: 4px;
    background: rgba(10,8,30,0.8);
    padding: 4px 10px;
    z-index: 100;
    pointer-events: all;
  `;
  div.textContent = shape.text || '';
  wrapper.appendChild(div);

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    shape.text = div.textContent.trim();
    saveWhiteboardData(); redraw();
    div.remove();
  };

  setTimeout(() => {
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    div.addEventListener('blur', commit);
    div.addEventListener('keydown', e => {
      if (e.key === 'Escape') { committed = true; div.remove(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    });
  }, 100);
}

function startInlineTextEdit(el) {
  const wrapper = document.getElementById('wb-canvas-wrapper');
  if (!wrapper) return;
  wrapper.querySelectorAll('.wb-inline-text').forEach(node => node.remove());

  const screenX = el.x * scale + panX;
  const screenY = el.y * scale + panY;
  const div = document.createElement('div');
  div.className = 'wb-inline-text';
  div.contentEditable = 'true';
  div.style.cssText = `
    position: absolute;
    left: ${screenX}px;
    top: ${screenY - 20}px;
    color: ${el.color || color};
    font-size: ${(el.size || 18) * scale}px;
    font-family: 'Syne', sans-serif;
    min-width: 80px;
    outline: none;
    border-bottom: 1.5px solid rgba(120,100,255,0.6);
    background: transparent;
    padding: 2px 6px;
    z-index: 100;
    pointer-events: all;
    white-space: pre;
    caret-color: rgba(120,100,255,0.9);
  `;
  div.textContent = el.text || '';
  wrapper.appendChild(div);

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    el.text = div.textContent.trim();
    if (!el.text) elements = elements.filter(e => e !== el);
    saveWhiteboardData(); redraw();
    div.remove();
  };

  setTimeout(() => {
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    div.addEventListener('blur', commit);
    div.addEventListener('keydown', e => {
      if (e.key === 'Escape') { committed = true; div.remove(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    });
  }, 100);
}

// ── Goma de borrar ──
function eraseAtPath(eraserPath) {
  const eraserRadius = eraserPath.width / 2;
  // Eliminar trazos que tengan puntos cercanos al recorrido de la goma
  paths = paths.filter(p => {
    if (p.color === '#ERASER') return false;
    return !p.points.some(pt =>
      eraserPath.points.some(ep =>
        Math.hypot(pt.x - ep.x, pt.y - ep.y) < eraserRadius
      )
    );
  });
}

// ── Hit testing ──
function hitTestAll(pos) {
  // Primero buscar en elements
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (hitTestElement(el, pos)) return el;
  }
  // Luego buscar en paths
  for (let i = paths.length - 1; i >= 0; i--) {
    const p = paths[i];
    if (p.color === '#ERASER') continue;
    if (hitTestPath(p, pos)) return p;
  }
  return null;
}

function hitTestPath(path, pos) {
  const hitRadius = (path.width + 8) / scale;
  for (let i = 0; i < path.points.length - 1; i++) {
    if (distToSegment(pos, path.points[i], path.points[i+1]) < hitRadius) {
      return true;
    }
  }
  return false;
}

function hitTestElement(el, pos) {
  const pad = 8 / scale;
  if (el.type === 'shape') {
    if (el.shape === 'arrow' || el.shape === 'line') {
      // Hit test para líneas: distancia al segmento
      return distToSegment(pos, { x: el.x, y: el.y }, { x: el.x + el.w, y: el.y + el.h }) < (el.lineWidth + 8) / scale;
    }
    const x = Math.min(el.x, el.x + el.w) - pad;
    const y = Math.min(el.y, el.y + el.h) - pad;
    const w = Math.abs(el.w) + pad * 2;
    const h = Math.abs(el.h) + pad * 2;
    return pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h;
  }
  if (el.type === 'text') {
    ctx.font = `${el.size || 18}px 'Syne', sans-serif`;
    const w = ctx.measureText(el.text).width;
    return pos.x >= el.x - pad && pos.x <= el.x + w + pad &&
           pos.y >= el.y - (el.size || 18) - pad && pos.y <= el.y + pad;
  }
  if (el.type === 'image') {
    return pos.x >= el.x && pos.x <= el.x + el.w && pos.y >= el.y && pos.y <= el.y + el.h;
  }
  if (el.type === 'card') {
    return pos.x >= el.x && pos.x <= el.x + (el.w||220) &&
           pos.y >= el.y && pos.y <= el.y + (el.h||120);
  }
  if (el.type === 'connector') {
    return distToSegment(pos, { x: el.x, y: el.y }, { x: el.x2, y: el.y2 }) < (el.lineWidth + 8) / scale;
  }
  return false;
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx*dx + dy*dy)));
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
}

// ── Dibujo ──
function redraw(previewStart, previewEnd) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);
  paths.forEach(p => drawPath(p));
  if (currentPath) drawPath(currentPath);
  elements.forEach(el => {
    if (el.hidden) return; // saltar elementos ocultos
    if (el.type === 'shape') drawShape(el);
    else if (el.type === 'text') drawTextEl(el);
    else if (el.type === 'image') drawImageEl(el);
    else if (el.type === 'card') drawCard(el);
    else if (el.type === 'connector') drawConnector(el);
  });
  // Selección
  selectedElements.forEach(el => drawSelectionBox(el));
  if (isSelecting && selectionRect) drawSelectionArea();
  // Mostrar anclas cuando tool es connector
  if (tool === 'connector') {
    drawAllAnchors();
  }
  // Preview de forma dentro del transform correcto
  if (previewStart && previewEnd) drawShapePreview(previewStart, previewEnd);
  ctx.restore();
  drawMinimap();
  updateGridBackground();
  renderStickies(); // re-renderizar stickies con nuevo pan/zoom
  if (layersPanelOpen) renderLayersPanel();
}

function updateGridBackground() {
  const wrapper = document.getElementById('wb-canvas-wrapper');
  if (!wrapper) return;
  const dotSpacing = 28 * scale;
  const offsetX = panX % dotSpacing;
  const offsetY = panY % dotSpacing;
  wrapper.style.backgroundSize = `${dotSpacing}px ${dotSpacing}px`;
  wrapper.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
}

function drawPath(path) {
  if (!path.points.length) return;
  ctx.save();
  if (path.color === '#ERASER') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.strokeStyle = path.color;
  }
  ctx.lineWidth = path.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (path.highlight) ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(path.points[0].x, path.points[0].y);
  if (path.points.length > 2) {
    for (let i = 1; i < path.points.length - 1; i++) {
      const mx = (path.points[i].x + path.points[i+1].x) / 2;
      const my = (path.points[i].y + path.points[i+1].y) / 2;
      ctx.quadraticCurveTo(path.points[i].x, path.points[i].y, mx, my);
    }
  }
  ctx.lineTo(path.points[path.points.length-1].x, path.points[path.points.length-1].y);
  ctx.stroke();
  ctx.restore();
}

function drawShape(el) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.lineWidth || 2;
  if (el.shape === 'arrow' || el.shape === 'line') {
    ctx.lineCap = 'round';

    if (el.shape === 'arrow') {
      const angle = Math.atan2(el.h, el.w);
      const headLen = Math.max(16, Math.min(el.lineWidth * 5, 32));
      // Acortar la línea para que no tape la punta
      const shorten = headLen * 0.85;
      const endX = el.x + el.w - shorten * Math.cos(angle);
      const endY = el.y + el.h - shorten * Math.sin(angle);

      // Dibujar línea acortada
      ctx.lineWidth = el.lineWidth || 2;
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Dibujar punta rellena (triángulo sólido)
      const headAngle = Math.PI / 6;
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.moveTo(el.x + el.w, el.y + el.h);
      ctx.lineTo(
        el.x + el.w - headLen * Math.cos(angle - headAngle),
        el.y + el.h - headLen * Math.sin(angle - headAngle)
      );
      ctx.lineTo(
        el.x + el.w - headLen * Math.cos(angle + headAngle),
        el.y + el.h - headLen * Math.sin(angle + headAngle)
      );
      ctx.closePath();
      ctx.fill();
    } else {
      // Línea simple
      ctx.lineWidth = el.lineWidth || 2;
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x + el.w, el.y + el.h);
      ctx.stroke();
    }
  } else if (el.shape === 'rect') {
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.w, el.h, 6);
    if (el.fill) { ctx.fillStyle = el.color + '33'; ctx.fill(); }
    ctx.stroke();
    // Texto dentro de la forma
    if (el.text) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${Math.max(12, Math.min(16, Math.abs(el.h) * 0.3))}px 'Syne', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, el.x + el.w/2, el.y + el.h/2);
    }
  } else if (el.shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(el.x + el.w/2, el.y + el.h/2, Math.abs(el.w/2), Math.abs(el.h/2), 0, 0, Math.PI*2);
    if (el.fill) { ctx.fillStyle = el.color + '33'; ctx.fill(); }
    ctx.stroke();
    if (el.text) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${Math.max(12, Math.min(16, Math.abs(el.h) * 0.3))}px 'Syne', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, el.x + el.w/2, el.y + el.h/2);
    }
  }
  ctx.restore();
}

function drawTextEl(el) {
  ctx.save();
  ctx.fillStyle = el.color || color;
  const style = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}`;
  ctx.font = `${style}${el.size || 18}px 'Syne', sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(el.text, el.x, el.y);
  ctx.restore();
}

function drawImageEl(el) {
  if (!el._img) {
    const img = new Image();
    img.onload = () => { el._img = img; redraw(); };
    img.src = el.src;
    return;
  }
  ctx.drawImage(el._img, el.x, el.y, el.w, el.h);
}

function drawCard(el) {
  ctx.save();
  const w = el.w || 220;
  const h = el.h || 120;
  const r = 10;

  // Fondo glass
  ctx.fillStyle = 'rgba(18,16,48,0.92)';
  ctx.beginPath();
  ctx.roundRect(el.x, el.y, w, h, r);
  ctx.fill();

  // Borde con color del tipo
  ctx.strokeStyle = el.color + 'aa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(el.x, el.y, w, h, r);
  ctx.stroke();

  // Barra de color arriba
  ctx.fillStyle = el.color;
  ctx.beginPath();
  ctx.roundRect(el.x, el.y, w, 4, [r, r, 0, 0]);
  ctx.fill();

  // Icono + título
  const icon = el.kind === 'note' ? '📋' : el.kind === 'project' ? '🎯' : '🗂';
  ctx.font = '12px Arial';
  ctx.fillText(icon, el.x + 10, el.y + 22);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `600 13px 'Syne', sans-serif`;
  ctx.textBaseline = 'top';
  // Truncar título si es muy largo
  let title = el.title || '';
  const maxW = w - 40;
  while (ctx.measureText(title).width > maxW && title.length > 0) {
    title = title.slice(0, -1);
  }
  if (title !== el.title) title += '…';
  ctx.fillText(title, el.x + 28, el.y + 12);

  // Subtítulo
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `11px 'DM Mono', monospace`;
  let sub = el.subtitle || '';
  const lines = [];
  const words = sub.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > w - 20) {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= 2) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < 3) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => {
    ctx.fillText(l, el.x + 10, el.y + 34 + i * 16);
  });

  // Footer: avatar + status + priority
  const footerY = el.y + h - 24;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(el.x, footerY, w, 24);

  // Avatar autor
  ctx.fillStyle = el.authorColor || '#888';
  ctx.beginPath();
  ctx.arc(el.x + 14, footerY + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f0e0c';
  ctx.font = '600 7px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(el.authorInitials || '?', el.x + 14, footerY + 12);
  ctx.textAlign = 'left';

  // Status badge
  if (el.status) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const statusX = el.x + 28;
    const sw = ctx.measureText(el.status).width + 10;
    ctx.beginPath();
    ctx.roundRect(statusX, footerY + 5, sw, 14, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px DM Mono, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.status, statusX + 5, footerY + 12);
  }

  // Priority dot
  const priorityColors = { alta: '#ef4444', media: '#f59e0b', normal: 'transparent' };
  if (el.priority && el.priority !== 'normal') {
    ctx.fillStyle = priorityColors[el.priority] || 'transparent';
    ctx.beginPath();
    ctx.arc(el.x + w - 10, footerY + 12, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawConnector(el) {
  ctx.save();
  ctx.strokeStyle = el.color || '#7864ff';
  ctx.lineWidth = el.lineWidth || 2;
  ctx.lineCap = 'round';

  const x1 = el.x, y1 = el.y;
  const x2 = el.x2, y2 = el.y2;

  if (el.curved) {
    const dx = x2 - x1, dy = y2 - y1;
    const cx1 = x1 + dx * 0.5;
    const cy1 = y1;
    const cx2 = x2 - dx * 0.5;
    const cy2 = y2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - cy2, x2 - cx2);
    const headLen = Math.max(12, Math.min(el.lineWidth * 4, 20));
    const headAngle = Math.PI / 6;
    ctx.fillStyle = el.color || '#7864ff';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - headAngle), y2 - headLen * Math.sin(angle - headAngle));
    ctx.lineTo(x2 - headLen * Math.cos(angle + headAngle), y2 - headLen * Math.sin(angle + headAngle));
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.fillStyle = el.color || '#7864ff';
  ctx.beginPath();
  ctx.arc(x1, y1, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAllAnchors() {
  elements.forEach(el => {
    const anchors = getElementAnchors(el);
    anchors.forEach(anchor => {
      const isHovered = hoveredAnchor &&
        hoveredAnchor.elementId === el.id &&
        hoveredAnchor.side === anchor.side;
      ctx.save();
      ctx.fillStyle = isHovered ? 'rgba(120,100,255,1)' : 'rgba(120,100,255,0.5)';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, isHovered ? 6/scale : 4/scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  });
}

function drawSelectionBox(el) {
  // Función helper para dibujar handles
  function drawHandles(bx, by, bw, bh) {
    const s = 5 / scale;
    ctx.setLineDash([]);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'rgba(120,100,255,0.9)';
    ctx.lineWidth = 1.5 / scale;
    const handles = [
      { x: bx,        y: by        },
      { x: bx + bw/2, y: by        },
      { x: bx + bw,   y: by        },
      { x: bx + bw,   y: by + bh/2 },
      { x: bx + bw,   y: by + bh   },
      { x: bx + bw/2, y: by + bh   },
      { x: bx,        y: by + bh   },
      { x: bx,        y: by + bh/2 },
    ];
    handles.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(120,100,255,0.9)';
  ctx.lineWidth = 1.5 / scale;
  ctx.setLineDash([5/scale, 3/scale]);
  const pad = 6 / scale;

  if (el.type === 'shape') {
    if (el.shape === 'arrow' || el.shape === 'line') {
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(120,100,255,0.8)';
      ctx.beginPath(); ctx.arc(el.x, el.y, 5/scale, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(el.x+el.w, el.y+el.h, 5/scale, 0, Math.PI*2); ctx.fill();
    } else {
      const bx = Math.min(el.x, el.x+el.w) - pad;
      const by = Math.min(el.y, el.y+el.h) - pad;
      const bw = Math.abs(el.w) + pad*2;
      const bh = Math.abs(el.h) + pad*2;
      ctx.strokeRect(bx, by, bw, bh);
      drawHandles(bx, by, bw, bh);
    }
  } else if (el.type === 'card' || el.type === 'image') {
    const bx = el.x - pad;
    const by = el.y - pad;
    const bw = (el.w || 220) + pad*2;
    const bh = (el.h || 120) + pad*2;
    ctx.strokeRect(bx, by, bw, bh);
    drawHandles(bx, by, bw, bh);
  } else if (el.type === 'text') {
    ctx.font = `${el.size||18}px 'Syne', sans-serif`;
    const w = ctx.measureText(el.text).width;
    ctx.strokeRect(el.x-pad, el.y-pad, w+pad*2, (el.size||18)+pad*2);
  } else if (el.points) {
    // Path: dibujar bounding box
    const xs = el.points.map(p => p.x);
    const ys = el.points.map(p => p.y);
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
  } else if (el.type === 'connector') {
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,100,255,0.8)';
    ctx.beginPath(); ctx.arc(el.x, el.y, 5/scale, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(el.x2, el.y2, 5/scale, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawSelectionArea() {
  ctx.save();
  ctx.strokeStyle = 'rgba(120,100,255,0.7)';
  ctx.fillStyle = 'rgba(120,100,255,0.07)';
  ctx.lineWidth = 1/scale;
  ctx.setLineDash([4/scale, 3/scale]);
  ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
  ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
  ctx.restore();
}

function drawShapePreview(start, end) {
  // Si es connector, dibujar curva bezier de preview
  if (tool === 'connector') {
    const dx = end.x - start.x;
    const cx1 = start.x + dx * 0.5;
    const cx2 = end.x - dx * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5/scale, 3/scale]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cx1, start.y, cx2, end.y, end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([5/scale, 3/scale]);
  ctx.globalAlpha = 0.7;
  const w = end.x - start.x, h = end.y - start.y;
  if (currentShape === 'rect') {
    ctx.beginPath(); ctx.roundRect(start.x, start.y, w, h, 6); ctx.stroke();
  } else if (currentShape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(start.x+w/2, start.y+h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
    ctx.stroke();
  } else if (currentShape === 'arrow' || currentShape === 'line') {
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    if (currentShape === 'arrow') {
      const angle = Math.atan2(h, w);
      const headLen = 14;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen*Math.cos(angle-Math.PI/6), end.y - headLen*Math.sin(angle-Math.PI/6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen*Math.cos(angle+Math.PI/6), end.y - headLen*Math.sin(angle+Math.PI/6));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// ── Minimap ──
function drawMinimap() {
  const minimap = document.getElementById('wb-minimap');
  if (!minimap || !canvas) return;
  const mW = 160, mH = 100;
  minimap.width = mW; minimap.height = mH;
  const mCtx = minimap.getContext('2d');
  mCtx.clearRect(0, 0, mW, mH);
  mCtx.fillStyle = 'rgba(10,8,30,0.88)';
  mCtx.fillRect(0, 0, mW, mH);

  // Calcular bounds
  let minX = 0, minY = 0, maxX = 800, maxY = 500;
  const allPts = paths.flatMap(p => p.points);
  allPts.forEach(pt => { minX=Math.min(minX,pt.x); minY=Math.min(minY,pt.y); maxX=Math.max(maxX,pt.x); maxY=Math.max(maxY,pt.y); });
  elements.forEach(el => { minX=Math.min(minX,el.x); minY=Math.min(minY,el.y); maxX=Math.max(maxX,el.x+(el.w||100)); maxY=Math.max(maxY,el.y+(el.h||50)); });

  const cW = maxX - minX || 800;
  const cH = maxY - minY || 500;
  const mScale = Math.min((mW-8)/cW, (mH-8)/cH) * 0.9;
  const offX = (mW - cW*mScale)/2 - minX*mScale;
  const offY = (mH - cH*mScale)/2 - minY*mScale;

  mCtx.save();
  mCtx.translate(offX, offY);
  mCtx.scale(mScale, mScale);

  paths.forEach(p => {
    if (p.color === '#ERASER' || !p.points.length) return;
    mCtx.strokeStyle = p.color; mCtx.lineWidth = 1.5/mScale;
    mCtx.beginPath(); mCtx.moveTo(p.points[0].x, p.points[0].y);
    p.points.forEach(pt => mCtx.lineTo(pt.x, pt.y)); mCtx.stroke();
  });
  elements.forEach(el => {
    if (el.type === 'shape') {
      mCtx.strokeStyle = el.color; mCtx.lineWidth = 1/mScale;
      if (el.shape === 'arrow' || el.shape === 'line') {
        mCtx.beginPath(); mCtx.moveTo(el.x,el.y); mCtx.lineTo(el.x+el.w,el.y+el.h); mCtx.stroke();
      } else {
        mCtx.strokeRect(el.x, el.y, el.w, el.h);
      }
    }
  });

  // Viewport
  const vpX = -panX/scale, vpY = -panY/scale;
  const vpW = canvas.width/scale, vpH = canvas.height/scale;
  mCtx.strokeStyle = 'rgba(120,100,255,0.85)';
  mCtx.fillStyle = 'rgba(120,100,255,0.08)';
  mCtx.lineWidth = 2/mScale;
  mCtx.setLineDash([]);
  mCtx.fillRect(vpX, vpY, vpW, vpH);
  mCtx.strokeRect(vpX, vpY, vpW, vpH);
  mCtx.restore();

  // Borde del minimap
  mCtx.strokeStyle = 'rgba(255,255,255,0.1)';
  mCtx.lineWidth = 1; mCtx.setLineDash([]);
  mCtx.strokeRect(0.5, 0.5, mW-1, mH-1);

  // Guardar datos del minimap para navegación
  minimap._mapData = { minX, minY, cW, cH, mScale, offX, offY };
}

export function wbMinimapClick(e) {
  const minimap = document.getElementById('wb-minimap');
  if (!minimap || !canvas) return;
  const rect = minimap.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (!minimap._mapData) return;
  const { offX, offY, mScale } = minimap._mapData;
  const worldX = (mx - offX) / mScale;
  const worldY = (my - offY) / mScale;
  panX = canvas.width/2 - worldX * scale;
  panY = canvas.height/2 - worldY * scale;
  redraw();
  showToast('Navegando al punto', 'info');
}

// ── Herramientas ──
export function wbSetTool(t) {
  tool = t;
  document.querySelectorAll('.wb-icon-btn[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === t && (!b.dataset.shape || b.dataset.shape === currentShape));
  });
  if (canvas) canvas.style.cursor = isSpacePressed ? 'grab' : getCursorForTool();
}

export function wbSetShape(s) {
  currentShape = s;
  wbSetTool(tool);
}

export function wbToggleShapesMenu() {
  const menu = document.getElementById('wb-shapes-submenu');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  
  if (isHidden) {
    menu.classList.remove('hidden');
    // Usar mousedown para cerrar, asi no interfiere con el click actual
    function closeMenu(e) {
      const trigger = document.getElementById('wb-shapes-trigger');
      if (!menu.contains(e.target) && e.target !== trigger && !trigger?.contains(e.target)) {
        menu.classList.add('hidden');
        document.removeEventListener('mousedown', closeMenu);
      }
    }
    // Registrar en el proximo frame para evitar que se cierre inmediatamente
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', closeMenu);
    });
  } else {
    menu.classList.add('hidden');
  }
}

export function wbPickShape(shape) {
  currentShape = shape;
  tool = 'shape';
  // Actualizar icono del trigger con el shape seleccionado
  const icons = {
    rect: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    line: '<line x1="5" y1="19" x2="19" y2="5"/>'
  };
  const triggerIcon = document.getElementById('wb-shapes-trigger-icon');
  if (triggerIcon) triggerIcon.innerHTML = icons[shape] || icons.rect;
  // Marcar activo
  document.querySelectorAll('.wb-icon-btn[data-tool]').forEach(b => b.classList.remove('active'));
  document.getElementById('wb-shapes-trigger')?.classList.add('active');
  document.querySelectorAll('.wb-shape-opt').forEach(b => b.classList.toggle('active', b.dataset.shape === shape));
  // Cerrar menú
  document.getElementById('wb-shapes-submenu')?.classList.add('hidden');
  if (canvas) canvas.style.cursor = 'crosshair';
}

export function wbSetColor(c) {
  color = c;
  const swatch = document.getElementById('wb-color-swatch');
  if (swatch) swatch.style.background = c;
}
export function wbSetSize(s) { lineWidth = parseInt(s); }

export function wbToggleFill() {
  fillShapes = !fillShapes;
  const btn = document.getElementById('wb-fill-btn');
  if (btn) {
    btn.innerHTML = fillShapes
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" fill="none"/></svg>';
    btn.classList.toggle('active', fillShapes);
  }
}

export function wbUndo() {
  if (!history.length) return;
  // Guardar estado actual en redoStack antes de deshacer
  redoStack.push({
    paths: JSON.parse(JSON.stringify(paths)),
    elements: elements.map(el => { const {_img,...r} = el; return r; }),
    stickies: JSON.parse(JSON.stringify(stickies))
  });
  const prev = history.pop();
  paths = prev.paths;
  elements = prev.elements;
  stickies = prev.stickies || stickies;
  selectedElements = [];
  saveWhiteboardData();
  renderStickies();
  redraw();
  if (layersPanelOpen) renderLayersPanel();
  showToast('Deshacer', 'info');
}

export function wbRedo() {
  if (!redoStack.length) return;
  // Guardar estado actual en history
  history.push({
    paths: JSON.parse(JSON.stringify(paths)),
    elements: elements.map(el => { const {_img,...r} = el; return r; }),
    stickies: JSON.parse(JSON.stringify(stickies))
  });
  const next = redoStack.pop();
  paths = next.paths;
  elements = next.elements;
  stickies = next.stickies || stickies;
  selectedElements = [];
  saveWhiteboardData();
  renderStickies();
  redraw();
  if (layersPanelOpen) renderLayersPanel();
  showToast('Rehacer', 'info');
}

export function wbClear() {
  showConfirmModal({
    icon: '🗑️',
    title: '¿Limpiar la pizarra?',
    message: 'Se eliminará todo el contenido de esta página.',
    onConfirm: () => {
      saveHistory();
      paths = []; elements = []; stickies = [];
      saveWhiteboardData(); renderStickies(); redraw();
    }
  });
}

export function wbExport() {
  // Crear canvas temporal con fondo
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.fillStyle = '#0a081e';
  tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tCtx.drawImage(canvas, 0, 0);
  const link = document.createElement('a');
  link.download = `pizarra-${getCurrentPage().name}.png`;
  link.href = tempCanvas.toDataURL();
  link.click();
  showToast('Pizarra exportada', 'success');
}

export function wbZoomIn() {
  const cx = canvas.width/2, cy = canvas.height/2;
  const newScale = Math.min(10, scale * 1.2);
  panX = cx - (cx - panX) * (newScale/scale);
  panY = cy - (cy - panY) * (newScale/scale);
  scale = newScale; updateZoomLabel(); redraw();
}
export function wbZoomOut() {
  const cx = canvas.width/2, cy = canvas.height/2;
  const newScale = Math.max(0.1, scale * 0.8);
  panX = cx - (cx - panX) * (newScale/scale);
  panY = cy - (cy - panY) * (newScale/scale);
  scale = newScale; updateZoomLabel(); redraw();
}
export function wbResetView() { scale=1; panX=0; panY=0; updateZoomLabel(); redraw(); }

function updateZoomLabel() {
  const el = document.getElementById('wb-zoom-label');
  if (el) el.textContent = Math.round(scale*100) + '%';
}

function getCursorForTool() {
  switch(tool) {
    case 'eraser': return 'cell';
    case 'select': return 'default';
    case 'text': return 'text';
    default: return 'crosshair';
  }
}

function normalizeRect(r) {
  return { x: r.w<0?r.x+r.w:r.x, y: r.h<0?r.y+r.h:r.y, w: Math.abs(r.w), h: Math.abs(r.h) };
}

// ── Stickies ──
function addSticky(pos) {
  saveHistory();  // <- añadir esta línea antes del push
  const sticky = { id: Date.now(), x: pos.x, y: pos.y,
    text: 'Nota...', color: color,
    authorId: currentUser?.id };
  stickies.push(sticky);
  renderStickies(); saveWhiteboardData();
}

function renderStickies() {
  const layer = document.getElementById('wb-stickies-layer');
  if (!layer) return;
  layer.innerHTML = stickies.map(s => {
    // Generar color de fondo con gradiente sutil
    const bg = s.color || '#7864ff';
    return `
    <div class="wb-sticky" id="wb-sticky-${s.id}"
      style="left:${s.x * scale + panX}px;
         top:${s.y * scale + panY}px;
         width:${(s.w || 180) * scale}px;
         min-height:${(s.h || 140) * scale}px;
         transform-origin:top left"
      onmousedown="wbStickyDragStart(event,${s.id})">
      
      <!-- Header de la sticky -->
      <div class="wb-sticky-header" style="background:${bg}">
        <div class="wb-sticky-header-left">
          <!-- Color de fondo -->
          <div class="wb-sticky-color-btn" 
            style="background:${bg}"
            onclick="event.stopPropagation();document.getElementById('wb-sticky-color-${s.id}').click()"
            title="Color de fondo">
          </div>
          <input type="color" id="wb-sticky-color-${s.id}" 
            value="${bg}"
            style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
            onchange="wbStickySetColor(${s.id}, this.value)">
          <!-- Color de texto -->
          <div class="wb-sticky-textcolor-btn"
            style="background:${s.textColor || '#ffffff'};border:1.5px solid rgba(0,0,0,0.2)"
            onclick="event.stopPropagation();document.getElementById('wb-sticky-textcolor-${s.id}').click()"
            title="Color del texto">
            <span style="font-size:8px;color:${s.textColor || '#ffffff'};filter:invert(1) grayscale(1) contrast(9)">A</span>
          </div>
          <input type="color" id="wb-sticky-textcolor-${s.id}"
            value="${s.textColor || '#ffffff'}"
            style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
            onchange="wbStickySetTextColor(${s.id}, this.value)">
        </div>
        <button class="wb-sticky-close" 
          onclick="event.stopPropagation();wbDeleteSticky(${s.id})">✕</button>
      </div>

      <!-- Cuerpo de la sticky -->
      <div class="wb-sticky-body" style="background:${bg}">
        <div class="wb-sticky-text" 
          contenteditable="true"
          style="color:${s.textColor || 'rgba(0,0,0,0.75)'};font-size:${s.fontSize || 13}px"
          onblur="wbStickyTextChange(${s.id},this.innerText)"
          onmousedown="event.stopPropagation()">${s.text}</div>
      </div>

      <div class="wb-sticky-resize-handle"
        onmousedown="event.stopPropagation();wbStickyResizeStart(event,${s.id})">
      </div>

    </div>
  `}).join('');
}

export function wbStickyDragStart(e, id) {
  if (e.target.classList.contains('wb-sticky-text') || e.target.classList.contains('wb-sticky-close')) return;
  const sticky = stickies.find(s => s.id === id);
  if (!sticky) return;
  const startX = e.clientX - (sticky.x * scale + panX);
  const startY = e.clientY - (sticky.y * scale + panY);
  function onMove(ev) {
    sticky.x = (ev.clientX - startX - panX) / scale;
    sticky.y = (ev.clientY - startY - panY) / scale;
    const el = document.getElementById('wb-sticky-'+id);
    if (el) {
      el.style.left = sticky.x * scale + panX + 'px';
      el.style.top = sticky.y * scale + panY + 'px';
    }
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveWhiteboardData();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

export function wbDeleteSticky(id) {
  stickies = stickies.filter(s => s.id !== id);
  renderStickies(); saveWhiteboardData();
}

export function wbStickyTextChange(id, text) {
  const s = stickies.find(s => s.id === id);
  if (s) { s.text = text; saveWhiteboardData(); }
}

export function wbStickySetColor(id, newColor) {
  const s = stickies.find(s => s.id === id);
  if (!s) return;
  saveHistory();
  s.color = newColor;
  saveWhiteboardData();
  renderStickies();
}

function showContextToolbar(el) {
  const toolbar = document.getElementById('wb-context-toolbar');
  if (!toolbar || !canvas) return;

  // Solo para texto y post-it (stickies se manejan diferente)
  if (el.type !== 'text' && el.type !== 'shape') return;

  toolbar.classList.remove('hidden');
  toolbar._targetEl = el;

  // Posición: encima del elemento
  let screenX, screenY;
  if (el.type === 'text') {
    screenX = el.x * scale + panX;
    screenY = el.y * scale + panY - 50;
  } else {
    screenX = (el.x + el.w/2) * scale + panX;
    screenY = Math.min(el.y, el.y + el.h) * scale + panY - 50;
  }

  // Evitar que se salga del canvas
  const wrapper = document.getElementById('wb-canvas-wrapper');
  const maxX = wrapper ? wrapper.clientWidth - 280 : screenX;
  screenX = Math.max(8, Math.min(screenX - 140, maxX));
  screenY = Math.max(8, screenY);

  toolbar.style.left = screenX + 'px';
  toolbar.style.top = screenY + 'px';

  // Actualizar estado de botones según el elemento
  document.getElementById('wb-ctx-bold')?.classList.toggle('active', !!el.bold);
  document.getElementById('wb-ctx-italic')?.classList.toggle('active', !!el.italic);
}

function hideContextToolbar() {
  const toolbar = document.getElementById('wb-context-toolbar');
  if (toolbar) {
    toolbar.classList.add('hidden');
    toolbar._targetEl = null;
  }
}

export function wbCtxFontSize(size, label) {
  const toolbar = document.getElementById('wb-context-toolbar');
  const el = toolbar?._targetEl;
  if (!el) return;
  saveHistory();
  el.size = size;
  // Actualizar label
  const lbl = document.getElementById('wb-ctx-size-label');
  if (lbl) lbl.childNodes[0].textContent = label || 'Mediano';
  // Marcar activo
  document.querySelectorAll('.wb-ctx-menu-item').forEach(item => {
    item.classList.toggle('active', item.textContent.trim() === (label || ''));
  });
  document.getElementById('wb-ctx-size-menu')?.classList.add('hidden');
  saveWhiteboardData(); redraw();
}

export function wbCtxToggleBold() {
  const toolbar = document.getElementById('wb-context-toolbar');
  const el = toolbar?._targetEl;
  if (!el) return;
  saveHistory();
  el.bold = !el.bold;
  document.getElementById('wb-ctx-bold')?.classList.toggle('active', el.bold);
  saveWhiteboardData(); redraw();
}

export function wbCtxToggleItalic() {
  const toolbar = document.getElementById('wb-context-toolbar');
  const el = toolbar?._targetEl;
  if (!el) return;
  saveHistory();
  el.italic = !el.italic;
  document.getElementById('wb-ctx-italic')?.classList.toggle('active', el.italic);
  saveWhiteboardData(); redraw();
}

export function wbCtxSetColor(c) {
  const toolbar = document.getElementById('wb-context-toolbar');
  const el = toolbar?._targetEl;
  if (!el) return;
  saveHistory();
  el.color = c;
  if (el.type === 'shape') el.textColor = c;
  // Actualizar preview
  const preview = document.getElementById('wb-ctx-color-preview');
  if (preview) preview.style.background = c;
  document.getElementById('wb-ctx-color-menu')?.classList.add('hidden');
  saveWhiteboardData(); redraw();
}

export function wbCtxToggleSizeMenu() {
  const menu = document.getElementById('wb-ctx-size-menu');
  const colorMenu = document.getElementById('wb-ctx-color-menu');
  colorMenu?.classList.add('hidden');
  menu?.classList.toggle('hidden');
}

export function wbCtxToggleColorMenu() {
  const menu = document.getElementById('wb-ctx-color-menu');
  const sizeMenu = document.getElementById('wb-ctx-size-menu');
  sizeMenu?.classList.add('hidden');
  menu?.classList.toggle('hidden');
}

export function wbStickySetTextColor(id, color) {
  const s = stickies.find(s => s.id === id);
  if (!s) return;
  saveHistory();
  s.textColor = color;
  saveWhiteboardData(); renderStickies();
}

export function wbStickySetFontSize(id, size) {
  const s = stickies.find(s => s.id === id);
  if (!s) return;
  saveHistory();
  s.fontSize = parseInt(size);
  saveWhiteboardData(); renderStickies();
}

export function wbStickyResizeStart(e, id) {
  e.preventDefault();
  const sticky = stickies.find(s => s.id === id);
  if (!sticky) return;
  
  const el = document.getElementById('wb-sticky-' + id);
  if (!el) return;
  
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = sticky.w || 180;
  const startH = sticky.h || 140;
  
  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    sticky.w = Math.max(120, startW + dx / scale);
    sticky.h = Math.max(100, startH + dy / scale);
    el.style.width = sticky.w * scale + 'px';
    el.style.minHeight = sticky.h * scale + 'px';
  }
  
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveWhiteboardData();
  }
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── Páginas ──
function getCurrentPage() {
  return pages.find(p => p.id === currentPageId) || pages[0];
}

function saveCurrentPageState() {
  const page = getCurrentPage();
  if (page) { page.paths = paths; page.elements = elements; page.stickies = stickies; }
}

function loadPageState(id) {
  saveCurrentPageState();
  currentPageId = id;
  const page = getCurrentPage();
  paths = page.paths || []; elements = page.elements || []; stickies = page.stickies || [];
  history = []; redoStack = []; selectedElements = [];
  renderStickies(); redraw(); renderPageTabs();
}

export function wbAddPage() {
  saveCurrentPageState();
  const id = Date.now();
  pages.push({ id, name: `Página ${pages.length+1}`, paths: [], elements: [], stickies: [] });
  saveAllPages(); loadPageState(id);
}

export function wbSwitchPage(id) { if (id !== currentPageId) loadPageState(id); }

export function wbRenamePage(id) {
  const page = pages.find(p => p.id === id);
  if (!page) return;
  const name = prompt('Nombre:', page.name);
  if (name?.trim()) { page.name = name.trim(); saveAllPages(); renderPageTabs(); }
}

export function wbDeletePage(id) {
  if (pages.length === 1) { 
    showToast('No puedes eliminar la única página', 'error'); 
    return; 
  }
  
  // Guardar estado actual ANTES de cualquier cambio
  saveCurrentPageState();
  
  // Determinar qué página cargar después
  const deletingCurrent = currentPageId === id;
  const remainingPages = pages.filter(p => p.id !== id);
  
  // Si eliminamos la actual, decidir cuál cargar
  let nextPageId = currentPageId;
  if (deletingCurrent) {
    const deletedIndex = pages.findIndex(p => p.id === id);
    // Ir a la página anterior, o la primera si no hay anterior
    nextPageId = deletedIndex > 0 
      ? pages[deletedIndex - 1].id 
      : remainingPages[0].id;
  }
  
  // Ahora sí eliminar
  pages = remainingPages;
  
  if (deletingCurrent) {
    // Cargar la nueva página sin saveCurrentPageState (ya la guardamos antes)
    currentPageId = nextPageId;
    const page = getCurrentPage();
    if (page) {
      paths = page.paths || [];
      elements = page.elements || [];
      stickies = page.stickies || [];
    }
    history = []; redoStack = []; selectedElements = [];
    renderStickies(); redraw();
  }
  
  saveAllPages();
  renderPageTabs();
}

function renderPageTabs() {
  const el = document.getElementById('wb-page-tabs');
  if (!el) return;
  el.innerHTML = pages.map(p => `
    <div class="wb-page-tab ${p.id===currentPageId?'active':''}" onclick="wbSwitchPage(${p.id})" ondblclick="wbRenamePage(${p.id})" title="Doble clic para renombrar">
      ${p.name}
      ${pages.length>1 ? `<button class="wb-page-tab-close" onclick="event.stopPropagation();wbDeletePage(${p.id})">✕</button>` : ''}
    </div>
  `).join('') + `<button class="wb-page-add" onclick="wbAddPage()">＋</button>`;
}

// ── Persistencia ──
function saveHistory() {
  history.push({
    paths: JSON.parse(JSON.stringify(paths)),
    elements: elements.map(el => { const {_img,...r} = el; return r; }),
    stickies: JSON.parse(JSON.stringify(stickies))
  });
  if (history.length > 50) history.shift();
  // Limpiar redo al hacer una acción nueva
  redoStack = [];
}

function saveAllPages() {
  saveCurrentPageState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: pages.map(p => ({
        ...p,
        elements: p.elements.map(el => { const {_img,...r}=el; return r; })
      })),
      currentPageId
    }));
  } catch(e) {}
}

function saveWhiteboardData() {
  saveCurrentPageState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: pages.map(p => ({
        ...p,
        elements: p.elements.map(el => { const {_img,...r}=el; return r; })
      })),
      currentPageId
    }));
  } catch(e) {}
}

function loadWhiteboardData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { renderPageTabs(); return; }
    const data = JSON.parse(raw);
    if (data.pages) {
      pages = data.pages;
      currentPageId = data.currentPageId || pages[0].id;
      const page = getCurrentPage();
      paths = (page.paths || []).map(p => ({ ...p }));
      elements = (page.elements || []).map(el => ({ ...el, id: el.id || (Date.now() + Math.random()) }));
      stickies = (page.stickies || []).map(s => ({ ...s }));
    } else {
      paths = (data.paths || []).map(p => ({ ...p }));
      elements = (data.elements || []).map(el => ({ ...el, id: el.id || (Date.now() + Math.random()) }));
      stickies = (data.stickies || []).map(s => ({ ...s }));
      pages[0].paths = paths; pages[0].elements = elements; pages[0].stickies = stickies;
    }
    renderStickies(); renderPageTabs();
  } catch(e) { renderPageTabs(); }
}

// ── Sistema de tarjetas embebidas ──
let wbCardPickerPos = null;
let wbCardPickerCurrentTab = 'notes';

export function wbOpenCardPicker(pos) {
  wbCardPickerPos = pos;
  const picker = document.getElementById('wb-card-picker');
  if (!picker) return;
  picker.classList.remove('hidden');

  const pickerW = 300;
  const pickerH = 380;
  const wrapper = document.getElementById('wb-canvas-wrapper');
  const wRect = wrapper ? wrapper.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };

  // Posición inicial basada en el click
  let screenX = pos.x * scale + panX;
  let screenY = pos.y * scale + panY;

  // Ajustar para que no se salga por la derecha
  if (screenX + pickerW > wRect.width - 10) {
    screenX = wRect.width - pickerW - 10;
  }

  // Ajustar para que no se salga por abajo
  if (screenY + pickerH > wRect.height - 10) {
    screenY = wRect.height - pickerH - 10;
  }

  // Mínimos
  screenX = Math.max(10, screenX);
  screenY = Math.max(10, screenY);

  picker.style.left = screenX + 'px';
  picker.style.top = screenY + 'px';

  wbCardPickerTab(wbCardPickerCurrentTab);
  document.getElementById('wb-card-search').value = '';
  setTimeout(() => document.getElementById('wb-card-search')?.focus(), 50);
}

export function wbCardPickerTab(tab, btnEl) {
  wbCardPickerCurrentTab = tab;
  document.querySelectorAll('.wb-card-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  else document.querySelector(`.wb-card-tab[onclick*="${tab}"]`)?.classList.add('active');
  wbCardPickerSearch('');
}

export function wbCardPickerSearch(query) {
  const list = document.getElementById('wb-card-picker-list');
  if (!list) return;
  const q = query.toLowerCase();
  let items = [];

  if (wbCardPickerCurrentTab === 'notes') {
    items = notes
      .filter(n => n.group === currentUser?.group)
      .filter(n => !q || n.title.toLowerCase().includes(q))
      .slice(0, 20)
      .map(n => ({
        id: n.id, kind: 'note',
        title: n.title,
        subtitle: n.body ? n.body.slice(0, 60).replace(/[#*_]/g, '') + '...' : 'Sin contenido',
        icon: '📋',
        color: '#7864ff',
        meta: n.shift || '',
        priority: n.priority || 'normal'
      }));
  } else if (wbCardPickerCurrentTab === 'projects') {
    items = projects
      .filter(p => p.group === currentUser?.group)
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .slice(0, 20)
      .map(p => ({
        id: p.id, kind: 'project',
        title: p.name,
        subtitle: p.description ? p.description.slice(0, 60).replace(/[#*_]/g, '') + '...' : 'Sin descripción',
        icon: '🎯',
        color: p.color || '#e8c547',
        meta: p.status || 'activo',
        priority: 'normal'
      }));
  } else if (wbCardPickerCurrentTab === 'postits') {
    items = postitCards
      .filter(c => c.group === currentUser?.group)
      .filter(c => !q || c.title.toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => ({
        id: c.id, kind: 'postit',
        title: c.title,
        subtitle: c.body ? c.body.slice(0, 60).replace(/[#*_]/g, '') + '...' : 'Sin descripción',
        icon: '🗂',
        color: '#5ba3e8',
        meta: c.column || 'pendiente',
        priority: c.priority || 'normal'
      }));
  }

  if (items.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px">Sin resultados</div>';
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="wb-card-picker-item" onclick="wbAddCardToCanvas(${item.id},'${item.kind}')">
      <span class="wb-card-picker-icon">${item.icon}</span>
      <div class="wb-card-picker-info">
        <div class="wb-card-picker-title">${item.title}</div>
        <div class="wb-card-picker-subtitle">${item.subtitle}</div>
      </div>
      <span class="wb-card-picker-meta">${item.meta}</span>
    </div>
  `).join('');
}

export function wbAddCardToCanvas(id, kind) {
  const picker = document.getElementById('wb-card-picker');
  picker?.classList.add('hidden');
  if (!wbCardPickerPos) return;

  let data = null;
  if (kind === 'note') data = notes.find(n => sameId(n.id, id));
  else if (kind === 'project') data = projects.find(p => sameId(p.id, id));
  else if (kind === 'postit') data = postitCards.find(c => sameId(c.id, id));
  if (!data) return;

  const author = USERS.find(u => sameId(u.id, data.authorId));
  const cardEl = {
    id: Date.now(),
    type: 'card',
    kind,
    refId: id,
    x: wbCardPickerPos.x,
    y: wbCardPickerPos.y,
    w: 220,
    h: 120,
    title: data.title || data.name || 'Sin título',
    subtitle: (data.body || data.description || '').slice(0, 80).replace(/[#*_]/g, ''),
    color: kind === 'note' ? '#7864ff' : kind === 'project' ? (data.color || '#e8c547') : '#5ba3e8',
    status: data.status || data.column || data.shift || '',
    priority: data.priority || 'normal',
    authorInitials: author?.initials || '?',
    authorColor: author?.color || '#888',
  };

  saveHistory();
  elements.push(cardEl);
  saveWhiteboardData();
  redraw();
  showToast('Tarjeta añadida', 'success');
}

export function wbOpenCardRef(card) {
  if (card.kind === 'note') {
    if (typeof window.openDetail === 'function') window.openDetail(card.refId);
  } else if (card.kind === 'project') {
    if (typeof window.showView === 'function') {
      window.showView('projects');
      setTimeout(() => window.selectProject && window.selectProject(card.refId), 300);
    }
  } else if (card.kind === 'postit') {
    if (typeof window.editPostitCard === 'function') window.editPostitCard(card.refId);
  }
  showToast('Abriendo ' + card.title, 'info');
}

// ── Panel de capas ──
export function wbToggleLayers() {
  layersPanelOpen = !layersPanelOpen;
  const panel = document.getElementById('wb-layers-panel');
  const btn = document.getElementById('wb-layers-btn');
  if (!panel) return;
  panel.classList.toggle('hidden', !layersPanelOpen);
  btn?.classList.toggle('active', layersPanelOpen);
  if (layersPanelOpen) renderLayersPanel();
}

export function renderLayersPanel() {
  const list = document.getElementById('wb-layers-list');
  if (!list) return;

  const reversed = [...elements].reverse();

  if (reversed.length === 0) {
    list.innerHTML = '<div class="wb-layers-empty">Sin elementos</div>';
    return;
  }

  list.innerHTML = reversed.map((el, i) => {
    const realIndex = elements.length - 1 - i;
    const icon = getLayerIcon(el);
    const label = getLayerLabel(el);
    const isSelected = selectedElements.includes(el);
    const isHidden = el.hidden || false;

    return `<div class="wb-layer-item ${isSelected ? 'selected' : ''} ${isHidden ? 'hidden-layer' : ''}"
      onclick="wbLayerSelect(${el.id})"
      draggable="true"
      ondragstart="wbLayerDragStart(event, ${realIndex})"
      ondragover="event.preventDefault()"
      ondrop="wbLayerDrop(event, ${realIndex})">
      <span class="wb-layer-icon">${icon}</span>
      <span class="wb-layer-label">${label}</span>
      <div class="wb-layer-actions">
        <button class="wb-layer-btn" onclick="event.stopPropagation();wbLayerToggleVisibility(${el.id})"
          title="${isHidden ? 'Mostrar' : 'Ocultar'}">
          ${isHidden
            ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          }
        </button>
        <button class="wb-layer-btn" onclick="event.stopPropagation();wbLayerMoveUp(${realIndex})"
          title="Subir capa" ${realIndex === elements.length-1 ? 'disabled' : ''}>↑</button>
        <button class="wb-layer-btn" onclick="event.stopPropagation();wbLayerMoveDown(${realIndex})"
          title="Bajar capa" ${realIndex === 0 ? 'disabled' : ''}>↓</button>
        <button class="wb-layer-btn danger" onclick="event.stopPropagation();wbLayerDelete(${el.id})"
          title="Eliminar">✕</button>
      </div>
    </div>`;
  }).join('');
}

function getLayerIcon(el) {
  if (el.type === 'shape') {
    if (el.shape === 'rect') return '⬜';
    if (el.shape === 'circle') return '⭕';
    if (el.shape === 'arrow') return '→';
    if (el.shape === 'line') return '╱';
  }
  if (el.type === 'text') return 'T';
  if (el.type === 'image') return '🖼️';
  if (el.type === 'card') {
    if (el.kind === 'note') return '📋';
    if (el.kind === 'project') return '🎯';
    if (el.kind === 'postit') return '🗂';
  }
  if (el.type === 'connector') return '↔';
  return '◻';
}

function getLayerLabel(el) {
  if (el.type === 'card') return el.title || 'Tarjeta';
  if (el.type === 'text') return (el.text || 'Texto').slice(0, 24);
  if (el.type === 'shape') return el.shape || 'Forma';
  if (el.type === 'connector') return 'Conector';
  if (el.type === 'image') return 'Imagen';
  return 'Elemento';
}

export function wbLayerSelect(id) {
  const el = elements.find(e => e.id === id);
  if (!el) return;
  selectedElements = [el];
  redraw();
  renderLayersPanel();
}

export function wbLayerToggleVisibility(id) {
  const el = elements.find(e => e.id === id);
  if (!el) return;
  el.hidden = !el.hidden;
  saveWhiteboardData();
  redraw();
  renderLayersPanel();
}

export function wbLayerMoveUp(index) {
  if (index >= elements.length - 1) return;
  [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]];
  saveWhiteboardData();
  redraw();
  renderLayersPanel();
}

export function wbLayerMoveDown(index) {
  if (index <= 0) return;
  [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]];
  saveWhiteboardData();
  redraw();
  renderLayersPanel();
}

export function wbLayerDelete(id) {
  saveHistory();
  elements = elements.filter(e => e.id !== id);
  selectedElements = selectedElements.filter(e => e.id !== id);
  saveWhiteboardData();
  redraw();
  renderLayersPanel();
}

let dragFromIndex = null;

export function wbLayerDragStart(event, index) {
  dragFromIndex = index;
  event.dataTransfer.effectAllowed = 'move';
}

export function wbLayerDrop(event, toIndex) {
  if (dragFromIndex === null || dragFromIndex === toIndex) return;
  const el = elements.splice(dragFromIndex, 1)[0];
  elements.splice(toIndex, 0, el);
  dragFromIndex = null;
  saveWhiteboardData();
  redraw();
  renderLayersPanel();
}
