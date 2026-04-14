// ===== HANDOVER MODULE — Traspaso de Turno =====

import { currentUser, notes, postitCards, projects, SHIFTS, toDateStr, sameId } from './components/data.js';
import { showToast, openModal, closeModal, showConfirmModal } from './components/modalControl.js';
import {
  apiGetHandovers,
  apiCreateHandover,
  apiReceiveHandover,
} from './api.js';

const STORAGE_KEY = 'diario_handovers';

export async function loadHandoversFromAPI() {
  try {
    const data = await apiGetHandovers();
    const mapped = data.map(h => ({
      ...h,
      id: h._id || h.id,
      group: h.department || h.group,
    }));
    window._handoversCache = mapped;
    return mapped;
  } catch (err) {
    console.error('Error cargando traspasos desde API:', err);
    try {
      const local = localStorage.getItem('diario_handovers');
      window._handoversCache = local ? JSON.parse(local) : [];
    } catch {}
    return window._handoversCache || [];
  }
}

// ── Utilidades ──────────────────────────────────────────

function getNextShift(shift) {
  const order = ['morning', 'afternoon', 'night'];
  const idx = order.indexOf(shift);
  return order[(idx + 1) % 3];
}

function getCurrentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 22) return 'afternoon';
  return 'night';
}

function loadHandovers() {
  return window._handoversCache || [];
}

function saveHandovers(list) {
  window._handoversCache = list;
  // Ya no guarda en localStorage
}

// ── Auto-recopilación ────────────────────────────────────

function autoCollectIncidencias() {
  if (!currentUser) return [];
  const today = toDateStr(new Date());
  const shift = getCurrentShift();
  return notes
    .filter(n =>
      n.date === today &&
      n.shift === shift &&
      n.group === currentUser.group &&
      (n.priority === 'alta' || (n.tags || []).some(t => t.includes('incidencia') || t.includes('incidente')))
    )
    .map(n => ({ id: n.id, text: n.title || 'Sin título', ref: 'note' }));
}

function autoCollectPendientes() {
  if (!currentUser) return [];
  return postitCards
    .filter(c =>
      (c.col === 'pendiente' || c.col === 'progreso') &&
      c.group === currentUser.group
    )
    .map(c => ({ id: c.id, text: c.title || 'Sin título', ref: 'postit', assignedTo: c.assignedTo, dueDate: c.dueDate }));
}

function autoCollectProyectos() {
  if (!currentUser) return [];
  const activeTasks = [];
  projects
    .filter(p => p.group === currentUser.group)
    .forEach(p => {
      (p.tasks || [])
        .filter(t => !t.done && t.status === 'progress')
        .forEach(t => activeTasks.push({ id: t.id, text: `${p.name}: ${t.name}`, ref: 'task' }));
    });
  return activeTasks;
}

// ── Panel de entrega ─────────────────────────────────────

export function openHandoverPanel() {
  if (!currentUser) return;
  const shift = getCurrentShift();
  const nextShift = getNextShift(shift);
  const shiftInfo = SHIFTS[shift];
  const nextShiftInfo = SHIFTS[nextShift];

  const incidencias = autoCollectIncidencias();
  const pendientes = autoCollectPendientes();
  const proyectos = autoCollectProyectos();

  const el = document.getElementById('handover-panel');
  if (!el) return;

  el.innerHTML = `
    <div class="handover-panel-inner">
      <div class="handover-panel-header">
        <div class="handover-header-info">
          <h2 class="handover-title">🔄 Traspaso de Turno</h2>
          <p class="handover-subtitle">
            ${shiftInfo.emoji} <strong>${shiftInfo.label}</strong> →
            ${nextShiftInfo.emoji} <strong>${nextShiftInfo.label}</strong>
          </p>
        </div>
        <button type="button" class="handover-close-btn" onclick="closeHandoverPanel()">✕</button>
      </div>

      <div class="handover-sections">

        <details class="handover-section" open>
          <summary class="handover-section-summary">
            <span>📋 Incidencias del turno</span>
            <span class="handover-section-count">${incidencias.length}</span>
          </summary>
          <div class="handover-section-body">
            <div class="handover-items-list" id="ho-incidencias">
              ${incidencias.length > 0
                ? incidencias.map(i => `
                    <div class="handover-item">
                      <span class="handover-item-text" contenteditable="true">${i.text}</span>
                      <button type="button" class="handover-item-remove" onclick="this.closest('.handover-item').remove()">✕</button>
                    </div>`).join('')
                : '<p class="handover-empty">Sin incidencias destacadas. Puedes añadir manualmente.</p>'
              }
            </div>
            <button type="button" class="handover-add-btn" onclick="addHandoverItem('incidencias')">+ Añadir</button>
          </div>
        </details>

        <details class="handover-section" open>
          <summary class="handover-section-summary">
            <span>⚠️ Pendientes para el siguiente turno</span>
            <span class="handover-section-count">${pendientes.length}</span>
          </summary>
          <div class="handover-section-body">
            <div class="handover-items-list" id="ho-pendientes">
              ${pendientes.length > 0
                ? pendientes.map(p => `
                    <div class="handover-item">
                      <span class="handover-item-text" contenteditable="true">${p.text}</span>
                      <button type="button" class="handover-item-remove" onclick="this.closest('.handover-item').remove()">✕</button>
                    </div>`).join('')
                : '<p class="handover-empty">Sin pendientes activos en el tablero.</p>'
              }
            </div>
            <button type="button" class="handover-add-btn" onclick="addHandoverItem('pendientes')">+ Añadir</button>
          </div>
        </details>

        <details class="handover-section" open>
          <summary class="handover-section-summary">
            <span>🎯 Proyectos y tareas en curso</span>
            <span class="handover-section-count">${proyectos.length}</span>
          </summary>
          <div class="handover-section-body">
            <div class="handover-items-list" id="ho-proyectos">
              ${proyectos.length > 0
                ? proyectos.map(p => `
                    <div class="handover-item">
                      <span class="handover-item-text" contenteditable="true">${p.text}</span>
                      <button type="button" class="handover-item-remove" onclick="this.closest('.handover-item').remove()">✕</button>
                    </div>`).join('')
                : '<p class="handover-empty">Sin tareas en progreso.</p>'
              }
            </div>
            <button type="button" class="handover-add-btn">+ Añadir</button>
          </div>
        </details>

        <details class="handover-section" open>
          <summary class="handover-section-summary">
            <span>🔔 Avisos para el siguiente turno</span>
          </summary>
          <div class="handover-section-body">
            <textarea class="handover-avisos-input" id="ho-avisos" placeholder="Escribe aquí cualquier aviso importante que no encaje en las categorías anteriores..."></textarea>
          </div>
        </details>

      </div>

      <div class="handover-panel-footer">
        <button type="button" class="btn-secondary" onclick="closeHandoverPanel()">Cancelar</button>
        <button type="button" class="handover-deliver-btn" onclick="deliverHandover()">
          ✅ Firmar y entregar turno
        </button>
      </div>
    </div>`;

  setTimeout(() => setupHandoverProjectAutocomplete(), 0);
  el.classList.add('open');
}

export function closeHandoverPanel() {
  const el = document.getElementById('handover-panel');
  if (el) el.classList.remove('open');
}

export function addHandoverItem(section) {
  const list = document.getElementById(`ho-${section}`);
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'handover-item';
  div.innerHTML = `
    <span class="handover-item-text" contenteditable="true" placeholder="Escribe aquí..."></span>
    <button type="button" class="handover-item-remove" onclick="this.closest('.handover-item').remove()">✕</button>`;
  // Quitar mensaje vacío si existe
  const empty = list.querySelector('.handover-empty');
  if (empty) empty.remove();
  list.appendChild(div);
  div.querySelector('.handover-item-text').focus();
}

export function removeHandoverItem(section, idx) {
  const list = document.getElementById(`ho-${section}`);
  if (!list) return;
  const items = list.querySelectorAll('.handover-item');
  if (items[idx]) items[idx].remove();
}

export async function deliverHandover() {
  console.log('deliverHandover llamado');
  if (!currentUser) return;
  const shift = getCurrentShift();
  const nextShift = getNextShift(shift);

  const collectItems = (sectionId) => {
    const list = document.getElementById(`ho-${sectionId}`);
    if (!list) return [];
    return [...list.querySelectorAll('.handover-item-text')]
      .map(el => el.textContent.trim())
      .filter(Boolean);
  };

  const avisos = document.getElementById('ho-avisos')?.value.trim() || '';

  console.log('Llamando a apiCreateHandover...');
  try {
    const saved = await apiCreateHandover({
      date: toDateStr(new Date()),
      fromShift: getCurrentShift(),
      toShift: getNextShift(getCurrentShift()),
      deliveredAt: new Date().toISOString(),
      sections: {
        incidencias: collectItems('incidencias'),
        pendientes: collectItems('pendientes'),
        proyectos: collectItems('proyectos'),
        avisos: avisos,
      }
    });
    console.log('Traspaso guardado en API:', saved);
    const list = loadHandovers();
    list.unshift({ ...saved, id: saved._id || saved.id });
    saveHandovers(list);
  } catch (err) {
    console.error('Error en apiCreateHandover:', err);
    console.error('Error guardando traspaso:', err);
    showToast('Error al guardar traspaso en servidor', 'error');
    return;
  }

  closeHandoverPanel();
  showToast('Traspaso entregado y firmado ✅', 'success');
  checkPendingHandover();
}

// ── Recepción ────────────────────────────────────────────

export function checkPendingHandover() {
  if (!currentUser) return;
  const handovers = loadHandovers();
  const currentShift = getCurrentShift();
  const today = toDateStr(new Date());

  const pending = handovers.find(h =>
    h.group === currentUser.group &&
    h.toShift === currentShift &&
    h.date === today &&
    !h.receivedBy &&
    !sameId(h.authorId, currentUser.id)
  );

  const banner = document.getElementById('handover-banner');
  if (!banner) return;

  if (pending) {
    const fromShift = SHIFTS[pending.fromShift];
    const time = new Date(pending.deliveredAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    banner.innerHTML = `
      <span class="handover-banner-icon">📨</span>
      <span class="handover-banner-text">Traspaso del turno <strong>${fromShift.label}</strong> de <strong>${pending.authorName}</strong> · ${time}</span>
      <button type="button" class="handover-banner-btn" onclick="openHandoverReceive('${pending.id}')">Ver traspaso</button>
      <button type="button" class="handover-banner-close" onclick="dismissHandoverBanner()">✕</button>`;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

export function dismissHandoverBanner() {
  const banner = document.getElementById('handover-banner');
  if (banner) banner.classList.remove('visible');
}

export function openHandoverReceive(handoverId) {
  const handovers = loadHandovers();
  const h = handovers.find(x => sameId(x.id, handoverId));
  if (!h) return;

  const fromShift = SHIFTS[h.fromShift];
  const toShift = SHIFTS[h.toShift];
  const time = new Date(h.deliveredAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const renderItems = (items) => items.length > 0
    ? `<ul class="handover-receive-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
    : `<p class="handover-empty">Sin elementos</p>`;

  document.getElementById('handover-receive-body').innerHTML = `
    <div class="handover-receive-meta">
      ${fromShift.emoji} <strong>${fromShift.label}</strong> →
      ${toShift.emoji} <strong>${toShift.label}</strong> ·
      <strong>${h.authorName}</strong> · ${h.date} ${time}
    </div>

    <div class="handover-receive-section">
      <h4>📋 Incidencias</h4>
      ${renderItems(h.sections.incidencias || [])}
    </div>
    <div class="handover-receive-section">
      <h4>⚠️ Pendientes</h4>
      ${renderItems(h.sections.pendientes || [])}
    </div>
    <div class="handover-receive-section">
      <h4>🎯 Proyectos y tareas</h4>
      ${renderItems(h.sections.proyectos || [])}
    </div>
    ${h.sections.avisos ? `
    <div class="handover-receive-section">
      <h4>🔔 Avisos</h4>
      <p class="handover-avisos-text">${h.sections.avisos}</p>
    </div>` : ''}

    ${!h.receivedBy ? `
    <div class="handover-receive-footer">
      <button type="button" class="handover-deliver-btn" onclick="confirmHandoverReceived('${h.id}')">
        ✅ Confirmar recepción del turno
      </button>
    </div>` : `
    <div class="handover-received-stamp">
      ✅ Recibido por ${h.receivedByName || '—'} · ${h.receivedAt ? new Date(h.receivedAt).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'}) : ''}
    </div>`}`;

  openModal('handover-receive-modal');
}

export async function confirmHandoverReceived(handoverId) {
  if (!currentUser) return;
  const handovers = loadHandovers();
  const idx = handovers.findIndex(h => sameId(h.id, handoverId));
  if (idx === -1) return;
  const handover = handovers[idx];
  try {
    const mongoId = handover._id || handover.id;
    await apiReceiveHandover(mongoId);
    handover.receivedBy = currentUser.id;
    handover.receivedByName = currentUser.name;
    handover.receivedAt = new Date().toISOString();
    saveHandovers(loadHandovers());
  } catch (err) {
    console.error('Error confirmando traspaso:', err);
    showToast('Error al confirmar traspaso', 'error');
    return;
  }
  closeModal('handover-receive-modal');
  checkPendingHandover();
  showToast('Turno recibido confirmado ✅', 'success');
}

// ── Historial ────────────────────────────────────────────

export function openHandoverHistory() {
  const handovers = loadHandovers();
  const el = document.getElementById('handover-history-body');
  if (!el) return;

  const mine = handovers.filter(h => h.group === currentUser?.group);

  if (mine.length === 0) {
    el.innerHTML = `<div class="handover-empty" style="padding:32px;text-align:center">No hay traspasos registrados aún.</div>`;
  } else {
    el.innerHTML = mine.map(h => {
      const from = SHIFTS[h.fromShift];
      const to = SHIFTS[h.toShift];
      const time = new Date(h.deliveredAt).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'});
      const status = h.receivedBy
        ? `<span class="handover-status handover-status--received">✅ Recibido</span>`
        : `<span class="handover-status handover-status--pending">⏳ Sin confirmar</span>`;
      return `
        <div class="handover-history-item" onclick="openHandoverReceive('${h.id}')" style="cursor:pointer">
          <div class="handover-history-shifts">
            ${from.emoji} ${from.label} → ${to.emoji} ${to.label}
          </div>
          <div class="handover-history-meta">
            <span>${h.authorName}</span> · <span>${h.date}</span> · <span>${time}</span>
          </div>
          ${status}
        </div>`;
    }).join('');
  }

  openModal('handover-history-modal');
}

export function setupHandoverProjectAutocomplete() {
  const addBtn = document.querySelector('#ho-proyectos')?.closest('.handover-section-body')?.querySelector('.handover-add-btn');
  if (!addBtn) return;

  addBtn.onclick = () => {
    const list = document.getElementById('ho-proyectos');
    if (!list) return;

    const empty = list.querySelector('.handover-empty');
    if (empty) empty.remove();

    const suggestions = [];
    if (currentUser) {
      projects.filter(p => p.group === currentUser.group).forEach(p => {
        const activeTasks = (p.tasks || []).filter(t => !t.done);
        if (activeTasks.length > 0) {
          activeTasks.forEach(t => {
            suggestions.push({ text: `${p.name}: ${t.name}`, type: 'task', label: 'Tarea' });
          });
        } else {
          suggestions.push({ text: p.name, type: 'project', label: 'Proyecto' });
        }
      });
    }

    const div = document.createElement('div');
    div.className = 'handover-item handover-item--autocomplete';
    div.innerHTML = `
      <div style="position:relative;flex:1">
        <input type="text" class="handover-autocomplete-input" placeholder="Escribe o selecciona proyecto/tarea..." autocomplete="off">
        <div class="handover-autocomplete-list hidden"></div>
      </div>
      <button type="button" class="handover-item-remove" onclick="this.closest('.handover-item').remove()">✕</button>`;

    list.appendChild(div);

    const input = div.querySelector('.handover-autocomplete-input');
    const dropdown = div.querySelector('.handover-autocomplete-list');

    const showSuggestions = (filter) => {
      const q = (filter || '').trim().toLowerCase();
      const filtered = suggestions.filter(s => s.text.toLowerCase().includes(q)).slice(0, 8);
      dropdown.innerHTML = '';
      if (filtered.length === 0) {
        dropdown.classList.add('hidden');
        return;
      }
      filtered.forEach(s => {
        const row = document.createElement('div');
        row.className = 'handover-autocomplete-item';
        const badge = document.createElement('span');
        badge.className = `handover-autocomplete-type handover-autocomplete-type--${s.type}`;
        badge.textContent = s.label;
        const textSpan = document.createElement('span');
        textSpan.textContent = s.text;
        row.appendChild(badge);
        row.appendChild(textSpan);
        row.addEventListener('mousedown', e => {
          e.preventDefault();
          selectHandoverSuggestion(row, s.text);
        });
        dropdown.appendChild(row);
      });
      dropdown.classList.remove('hidden');
    };

    input.addEventListener('input', () => showSuggestions(input.value));
    input.addEventListener('focus', () => showSuggestions(input.value));
    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
    input.focus();
  };
}

export function selectHandoverSuggestion(el, text) {
  const item = el.closest('.handover-item--autocomplete');
  if (!item) return;
  item.classList.remove('handover-item--autocomplete');
  item.innerHTML = `
    <span class="handover-item-text" contenteditable="true"></span>
    <button type="button" class="handover-item-remove" onclick="this.closest('.handover-item').remove()">✕</button>`;
  const span = item.querySelector('.handover-item-text');
  if (span) span.textContent = text;
  span?.focus();
}
