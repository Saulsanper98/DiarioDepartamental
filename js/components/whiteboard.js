// ===== WHITEBOARD MODULE =====
import { currentUser } from './data.js';
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

let isSelecting = false;
let selectionRect = null;

let scale = 1;
let panX = 0, panY = 0;
let isPanning = false;
let lastPan = { x: 0, y: 0 };
let isSpacePressed = false;

let shapeStart = null;
let currentShape = 'rect';

let editingText = null; // elemento texto en edición inline

let clipboard = [];
let history = [];

let pages = [{ id: 1, name: 'Página 1', paths: [], elements: [], stickies: [] }];
let currentPageId = 1;

const STORAGE_KEY = 'diario_whiteboard';

// ── Render principal ──
export function renderWhiteboard() {
  const view = document.getElementById('view-whiteboard');
  if (!view) return;
  view.innerHTML = `
    <div class="wb-container">
      <div class="wb-toolbar">
        <div class="wb-tool-group">
          <button class="wb-tool-btn active" data-tool="select" onclick="wbSetTool('select')" title="Seleccionar (S)">↖️</button>
          <button class="wb-tool-btn" data-tool="pen" onclick="wbSetTool('pen')" title="Lápiz (P)">✏️</button>
          <button class="wb-tool-btn" data-tool="highlight" onclick="wbSetTool('highlight')" title="Resaltador (H)">🖌️</button>
          <button class="wb-tool-btn" data-tool="eraser" onclick="wbSetTool('eraser')" title="Borrador (E)">🧹</button>
          <button class="wb-tool-btn" data-tool="text" onclick="wbSetTool('text')" title="Texto (T)">T</button>
          <button class="wb-tool-btn" data-tool="sticky" onclick="wbSetTool('sticky')" title="Post-it (N)">🗒️</button>
          <button class="wb-tool-btn" data-tool="shape" onclick="wbSetTool('shape')" title="Formas (F)">⬜</button>
        </div>
        <div class="wb-tool-group wb-shapes-group hidden" id="wb-shapes-group">
          <button class="wb-shape-btn active" data-shape="rect" onclick="wbSetShape('rect')" title="Rectángulo">⬜</button>
          <button class="wb-shape-btn" data-shape="circle" onclick="wbSetShape('circle')" title="Círculo">⭕</button>
          <button class="wb-shape-btn" data-shape="arrow" onclick="wbSetShape('arrow')" title="Flecha">➡️</button>
          <button class="wb-shape-btn" data-shape="line" onclick="wbSetShape('line')" title="Línea">╱</button>
        </div>
        <div class="wb-tool-group">
          <input type="color" id="wb-color" value="#7864ff" onchange="wbSetColor(this.value)" class="wb-color-input" title="Color">
          <input type="range" id="wb-size" min="1" max="30" value="2" oninput="wbSetSize(this.value)" class="wb-size-input" title="Grosor">
          <button class="wb-tool-btn" id="wb-fill-btn" onclick="wbToggleFill()" title="Relleno de formas">◻️</button>
        </div>
        <div class="wb-tool-group">
          <button class="wb-tool-btn" onclick="wbUndo()" title="Deshacer (Ctrl+Z)">↩️</button>
          <button class="wb-tool-btn" onclick="wbClear()" title="Limpiar todo">🗑️</button>
          <button class="wb-tool-btn" onclick="wbExport()" title="Exportar PNG">💾</button>
        </div>
        <div class="wb-tool-group" style="margin-left:auto">
          <button class="wb-tool-btn" onclick="wbZoomIn()" title="Zoom + (Ctrl++)">+</button>
          <span class="wb-zoom-label" id="wb-zoom-label">100%</span>
          <button class="wb-tool-btn" onclick="wbZoomOut()" title="Zoom - (Ctrl+-)">−</button>
          <button class="wb-tool-btn" onclick="wbResetView()" title="Restablecer vista">⊡</button>
        </div>
      </div>
      <div class="wb-pages-bar">
        <div class="wb-page-tabs" id="wb-page-tabs"></div>
      </div>
      <div class="wb-canvas-wrapper" id="wb-canvas-wrapper">
        <canvas id="wb-canvas"></canvas>
        <div id="wb-stickies-layer" class="wb-stickies-layer"></div>
        <div id="wb-text-editor-layer" class="wb-text-editor-layer"></div>
        <canvas id="wb-minimap" class="wb-minimap"></canvas>
      </div>
    </div>
  `;
  initWhiteboard();
}

function initWhiteboard() {
  canvas = document.getElementById('wb-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  loadWhiteboardData();
  attachWhiteboardEvents();
  renderPageTabs();
  redraw();
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
  } else if (tool === 'text') {
    startInlineText(pos);
  } else if (tool === 'select') {
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
        dragOriginals = selectedElements.map(el => ({ x: el.x, y: el.y }));
      }
    } else {
      selectedElements = [];
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

  if (isDrawing && currentPath) {
    currentPath.points.push(pos);
    redraw();
  } else if (isDrawing && tool === 'shape' && shapeStart) {
    redraw();
    drawShapePreview(shapeStart, pos);
  } else if (isDragging && dragStart && selectedElements.length > 0) {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    selectedElements.forEach((el, i) => {
      el.x = dragOriginals[i].x + dx;
      el.y = dragOriginals[i].y + dy;
    });
    redraw();
  } else if (isSelecting && selectionRect) {
    selectionRect.w = pos.x - selectionRect.x;
    selectionRect.h = pos.y - selectionRect.y;
    redraw();
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
    if (currentPath.color === '#ERASER') {
      eraseAtPath(currentPath);
    } else {
      paths.push(currentPath);
    }
    saveHistory();
    currentPath = null;
    isDrawing = false;
    saveWhiteboardData();
    redraw();
    return;
  }

  if (isDrawing && tool === 'shape' && shapeStart) {
    const w = pos.x - shapeStart.x;
    const h = pos.y - shapeStart.y;
    if (Math.abs(w) > 3 || Math.abs(h) > 3) {
      elements.push({
        id: Date.now(),
        type: 'shape', shape: currentShape,
        x: shapeStart.x, y: shapeStart.y,
        w, h, color, lineWidth,
        fill: fillShapes,
        text: ''
      });
      saveHistory();
      saveWhiteboardData();
    }
    shapeStart = null;
    isDrawing = false;
    redraw();
    return;
  }

  if (isDragging) {
    isDragging = false;
    dragStart = null;
    dragOriginals = [];
    saveWhiteboardData();
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
  }
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
    if (selectedElements.length > 0) {
      saveHistory();
      elements = elements.filter(el => !selectedElements.includes(el));
      selectedElements = [];
      saveWhiteboardData(); redraw();
    }
    return;
  }
  if (e.key === 'p') wbSetTool('pen');
  if (e.key === 'e') wbSetTool('eraser');
  if (e.key === 's') wbSetTool('select');
  if (e.key === 't') wbSetTool('text');
  if (e.key === 'f') wbSetTool('shape');
  if (e.key === 'h') wbSetTool('highlight');
  if (e.key === 'n') wbSetTool('sticky');
  if (e.key === 'Escape') { selectedElements = []; editingText = null; redraw(); }
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
  const layer = document.getElementById('wb-text-editor-layer');
  if (!layer) return;
  const screenX = pos.x * scale + panX;
  const screenY = pos.y * scale + panY;
  const div = document.createElement('div');
  div.className = 'wb-inline-text';
  div.contentEditable = 'true';
  div.style.left = screenX + 'px';
  div.style.top = screenY + 'px';
  div.style.color = color;
  div.style.fontSize = '18px';
  div.textContent = '';
  layer.innerHTML = '';
  layer.appendChild(div);
  div.focus();
  div.addEventListener('blur', () => {
    const text = div.textContent.trim();
    if (text) {
      elements.push({ id: Date.now(), type: 'text', x: pos.x, y: pos.y, text, color, size: 18 });
      saveHistory(); saveWhiteboardData(); redraw();
    }
    layer.innerHTML = '';
  });
  div.addEventListener('keydown', e => {
    if (e.key === 'Escape') { layer.innerHTML = ''; }
  });
}

function startInlineTextOnShape(shape) {
  const layer = document.getElementById('wb-text-editor-layer');
  if (!layer) return;
  const screenX = (shape.x + shape.w/2) * scale + panX;
  const screenY = (shape.y + shape.h/2) * scale + panY;
  const div = document.createElement('div');
  div.className = 'wb-inline-text wb-inline-text--shape';
  div.contentEditable = 'true';
  div.style.left = screenX + 'px';
  div.style.top = screenY + 'px';
  div.style.width = Math.abs(shape.w * scale) + 'px';
  div.style.color = 'white';
  div.style.fontSize = Math.max(12, 14 * scale) + 'px';
  div.textContent = shape.text || '';
  layer.innerHTML = '';
  layer.appendChild(div);
  div.focus();
  // Seleccionar todo el texto existente
  const range = document.createRange();
  range.selectNodeContents(div);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  div.addEventListener('blur', () => {
    shape.text = div.textContent.trim();
    saveWhiteboardData(); redraw();
    layer.innerHTML = '';
  });
  div.addEventListener('keydown', e => {
    if (e.key === 'Escape') { layer.innerHTML = ''; }
  });
}

function startInlineTextEdit(el) {
  const layer = document.getElementById('wb-text-editor-layer');
  if (!layer) return;
  const screenX = el.x * scale + panX;
  const screenY = el.y * scale + panY;
  const div = document.createElement('div');
  div.className = 'wb-inline-text';
  div.contentEditable = 'true';
  div.style.left = screenX + 'px';
  div.style.top = screenY + 'px';
  div.style.color = el.color || color;
  div.style.fontSize = (el.size || 18) + 'px';
  div.textContent = el.text;
  layer.innerHTML = '';
  layer.appendChild(div);
  div.focus();
  const range = document.createRange();
  range.selectNodeContents(div);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  div.addEventListener('blur', () => {
    el.text = div.textContent.trim();
    if (!el.text) elements = elements.filter(e => e !== el);
    saveWhiteboardData(); redraw();
    layer.innerHTML = '';
  });
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
  // Buscar en orden inverso (último dibujado = primero en hit)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (hitTestElement(el, pos)) return el;
  }
  return null;
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
  return false;
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx*dx + dy*dy)));
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
}

// ── Dibujo ──
function redraw() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);
  drawGrid();
  paths.forEach(p => drawPath(p));
  if (currentPath) drawPath(currentPath);
  elements.forEach(el => {
    if (el.type === 'shape') drawShape(el);
    else if (el.type === 'text') drawTextEl(el);
    else if (el.type === 'image') drawImageEl(el);
  });
  // Selección
  selectedElements.forEach(el => drawSelectionBox(el));
  if (isSelecting && selectionRect) drawSelectionArea();
  ctx.restore();
  drawMinimap();
}

function drawGrid() {
  const gridSize = 40;
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1 / scale;
  const ox = (-panX / scale) % gridSize;
  const oy = (-panY / scale) % gridSize;
  const startX = -panX/scale - ox;
  const startY = -panY/scale - oy;
  const endX = startX + canvas.width/scale + gridSize*2;
  const endY = startY + canvas.height/scale + gridSize*2;
  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
  }
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
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.lineWidth || 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(el.x, el.y);
    ctx.lineTo(el.x + el.w, el.y + el.h);
    ctx.stroke();
    if (el.shape === 'arrow') {
      // Punta de flecha siempre con tamaño fijo independiente del grosor
      const angle = Math.atan2(el.h, el.w);
      const headLen = 14;
      const headAngle = Math.PI / 6;
      ctx.lineWidth = Math.min(el.lineWidth || 2, 2); // punta siempre delgada
      ctx.beginPath();
      ctx.moveTo(el.x + el.w, el.y + el.h);
      ctx.lineTo(
        el.x + el.w - headLen * Math.cos(angle - headAngle),
        el.y + el.h - headLen * Math.sin(angle - headAngle)
      );
      ctx.moveTo(el.x + el.w, el.y + el.h);
      ctx.lineTo(
        el.x + el.w - headLen * Math.cos(angle + headAngle),
        el.y + el.h - headLen * Math.sin(angle + headAngle)
      );
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
  ctx.font = `${el.size || 18}px 'Syne', sans-serif`;
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

function drawSelectionBox(el) {
  ctx.save();
  ctx.strokeStyle = 'rgba(120,100,255,0.9)';
  ctx.lineWidth = 1.5 / scale;
  ctx.setLineDash([5/scale, 3/scale]);
  const pad = 6 / scale;
  if (el.type === 'shape') {
    if (el.shape === 'arrow' || el.shape === 'line') {
      // Para flechas/líneas: resaltar el punto de inicio y fin
      ctx.fillStyle = 'rgba(120,100,255,0.8)';
      ctx.beginPath(); ctx.arc(el.x, el.y, 5/scale, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(el.x+el.w, el.y+el.h, 5/scale, 0, Math.PI*2); ctx.fill();
    } else {
      const x = Math.min(el.x, el.x+el.w) - pad;
      const y = Math.min(el.y, el.y+el.h) - pad;
      ctx.strokeRect(x, y, Math.abs(el.w)+pad*2, Math.abs(el.h)+pad*2);
    }
  } else if (el.type === 'text') {
    ctx.font = `${el.size||18}px 'Syne', sans-serif`;
    const w = ctx.measureText(el.text).width;
    ctx.strokeRect(el.x-pad, el.y-pad, w+pad*2, (el.size||18)+pad*2);
  } else if (el.type === 'image') {
    ctx.strokeRect(el.x-pad, el.y-pad, el.w+pad*2, el.h+pad*2);
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
  ctx.save();
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
  }
  ctx.restore();
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
  if (!minimap || !minimap._mapData || !canvas) return;
  const rect = minimap.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { offX, offY, mScale } = minimap._mapData;
  // Convertir click en minimap a coordenadas del canvas
  const worldX = (mx - offX) / mScale;
  const worldY = (my - offY) / mScale;
  // Centrar la vista en ese punto
  panX = canvas.width/2 - worldX * scale;
  panY = canvas.height/2 - worldY * scale;
  redraw();
}

// ── Herramientas ──
export function wbSetTool(t) {
  tool = t;
  document.querySelectorAll('.wb-tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  const shapesGroup = document.getElementById('wb-shapes-group');
  if (shapesGroup) shapesGroup.classList.toggle('hidden', t !== 'shape');
  if (canvas) canvas.style.cursor = isSpacePressed ? 'grab' : getCursorForTool();
}

export function wbSetShape(s) {
  currentShape = s;
  document.querySelectorAll('.wb-shape-btn').forEach(b => b.classList.toggle('active', b.dataset.shape === s));
}

export function wbSetColor(c) { color = c; }
export function wbSetSize(s) { lineWidth = parseInt(s); }

export function wbToggleFill() {
  fillShapes = !fillShapes;
  const btn = document.getElementById('wb-fill-btn');
  if (btn) {
    btn.textContent = fillShapes ? '◼️' : '◻️';
    btn.classList.toggle('active', fillShapes);
  }
  showToast(fillShapes ? 'Relleno activado' : 'Relleno desactivado', 'info');
}

export function wbUndo() {
  if (!history.length) return;
  const prev = history.pop();
  paths = prev.paths; elements = prev.elements;
  saveWhiteboardData(); redraw();
  showToast('Acción deshecha', 'info');
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
  const colors = ['#2a1f5e','#1a3a4a','#1a3a2a','#3a2510'];
  const sticky = { id: Date.now(), x: pos.x*scale+panX, y: pos.y*scale+panY, text: 'Nota...', color: colors[Math.floor(Math.random()*colors.length)], authorId: currentUser?.id };
  stickies.push(sticky);
  renderStickies(); saveWhiteboardData();
}

function renderStickies() {
  const layer = document.getElementById('wb-stickies-layer');
  if (!layer) return;
  layer.innerHTML = stickies.map(s => `
    <div class="wb-sticky" id="wb-sticky-${s.id}" style="left:${s.x}px;top:${s.y}px;background:${s.color}" onmousedown="wbStickyDragStart(event,${s.id})">
      <button class="wb-sticky-close" onclick="event.stopPropagation();wbDeleteSticky(${s.id})">✕</button>
      <div class="wb-sticky-text" contenteditable="true" onblur="wbStickyTextChange(${s.id},this.innerText)">${s.text}</div>
    </div>
  `).join('');
}

export function wbStickyDragStart(e, id) {
  if (e.target.classList.contains('wb-sticky-text') || e.target.classList.contains('wb-sticky-close')) return;
  const sticky = stickies.find(s => s.id === id);
  if (!sticky) return;
  const startX = e.clientX - sticky.x, startY = e.clientY - sticky.y;
  function onMove(ev) {
    sticky.x = ev.clientX - startX; sticky.y = ev.clientY - startY;
    const el = document.getElementById('wb-sticky-'+id);
    if (el) { el.style.left = sticky.x+'px'; el.style.top = sticky.y+'px'; }
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
  history = []; selectedElements = [];
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
  if (pages.length === 1) { showToast('No puedes eliminar la única página', 'error'); return; }
  pages = pages.filter(p => p.id !== id);
  if (currentPageId === id) loadPageState(pages[0].id);
  else { saveAllPages(); renderPageTabs(); }
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
  history.push({ paths: JSON.parse(JSON.stringify(paths)), elements: elements.map(el => { const {_img,...r}=el; return r; }) });
  if (history.length > 30) history.shift();
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
      paths = page.paths || []; elements = page.elements || []; stickies = page.stickies || [];
    } else {
      paths = data.paths || []; elements = data.elements || []; stickies = data.stickies || [];
      pages[0].paths = paths; pages[0].elements = elements; pages[0].stickies = stickies;
    }
    renderStickies(); renderPageTabs();
  } catch(e) { renderPageTabs(); }
}
