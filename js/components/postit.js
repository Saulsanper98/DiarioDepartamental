// ===== POSTIT MODULE =====

import { postitCards, USERS, currentUser, collectImageMap, editingPostitId, selectedPostitPriority, sameId, comments, toDateStr, editingPostitImages, setEditingPostitId, setEditingPostitImages, setSelectedPostitPriority, setPostitCards } from './data.js';
import { showToast, openModal, showConfirmModal } from './modalControl.js';
import { renderMarkdown } from './notes.js';
import { commentIndicators } from './docs.js';
import {
  apiGetPostits,
  apiCreatePostit,
  apiUpdatePostit,
  apiDeletePostit,
} from '../api.js';

export const POSTIT_COLS = [
  {id:'pendiente',label:'Pendiente',icon:'📋',color:'var(--text-muted)'},
  {id:'progreso',label:'En Progreso',icon:'⚡',color:'var(--afternoon)'},
  {id:'revision',label:'Revisión',icon:'🔍',color:'var(--accent2)'},
  {id:'hecho',label:'Hecho',icon:'✅',color:'var(--success)'},
];
let draggingPostitId = null;
let postitDropPlaceholder = null;
let postitUserFilter = null;

export async function loadPostitFromAPI() {
  try {
    const data = await apiGetPostits();
    const mapped = data.map(c => ({
      ...c,
      id: c._id || c.id,
      group: c.department || c.group,
    }));
    setPostitCards(mapped);
    return mapped;
  } catch (err) {
    console.error('Error cargando post-its desde API:', err);
    try {
      const local = localStorage.getItem('diario_postit');
      if (local) setPostitCards(JSON.parse(local));
    } catch {}
    return [];
  }
}

function renderPostitUserFilter() {
  const bar = document.getElementById('postit-user-filter-bar');
  if (!bar || !currentUser) return;
  const usersInBoard = USERS.filter(u => u.group === currentUser.group);
  bar.innerHTML = [
    `<button type="button" class="postit-user-filter-btn${!postitUserFilter ? ' active' : ''}" data-uid="" onclick="setPostitUserFilter(null)">Todos</button>`,
    ...usersInBoard.map(u =>
      `<button type="button" class="postit-user-filter-btn${postitUserFilter != null && sameId(postitUserFilter, u.id) ? ' active' : ''}" data-uid="${u.id}" onclick="setPostitUserFilter('${u.id}')">
          <span class="postit-filter-av" style="background:${u.color}">${u.initials}</span>${u.name.split(' ')[0]}
        </button>`
    )
  ].join('');
}

export function setPostitUserFilter(userId) {
  postitUserFilter = userId ? Number(userId) : null;
  document.querySelectorAll('.postit-user-filter-btn').forEach(b => {
    const uid = b.dataset.uid;
    const isAll = uid === '' || uid === undefined;
    b.classList.toggle('active', postitUserFilter == null ? isAll : Number(uid) === postitUserFilter);
  });
  renderPostitBoard();
}

function applyPostitColorByColumn(card) {
  const colToColor = { pendiente: 'yellow', progreso: 'blue', revision: 'purple', hecho: 'green' };
  if (card && colToColor[card.column]) card.color = colToColor[card.column];
}

export function renderPostitBoard() {
  const board = document.getElementById('postit-board');
  if (!board) return;
  const todayStr = toDateStr(new Date());
  const visibleCards = (col) => postitCards
    .filter(c => c.column === col.id && c.group === currentUser.group)
    .filter(c => !postitUserFilter || sameId(c.assignedTo, postitUserFilter));
  board.innerHTML = POSTIT_COLS.map(col => {
    const cards = visibleCards(col);
    const overdueCount = cards.filter(c =>
      c.dueDate && c.dueDate < todayStr && c.column !== 'hecho'
    ).length;
    const overdueIndicator = overdueCount > 0
      ? `<span class="postit-overdue-count" title="${overdueCount} vencidas">⚠️ ${overdueCount}</span>`
      : '';
    return `<div class="postit-col">
      <div class="postit-col-header">
        <h4 style="color:${col.color}">${col.icon} ${col.label}</h4>
        <span class="postit-col-count">${cards.length}</span>
        ${overdueIndicator}
      </div>
      <div class="postit-cards" id="pcol-${col.id}">
        ${cards.map(c => renderPostitCard(c)).join('')}
      </div>
      <button class="btn-add-postit" onclick="openNewPostitModal('${col.id}')">+ Añadir tarjeta</button>
    </div>`;
  }).join('');
  setupPostitDragAndDrop();
  renderPostitUserFilter();
}

export function renderPostitCard(c) {
  const isOverdue = c.dueDate && !c.done && new Date(c.dueDate + 'T23:59:59') < new Date();
  const author = USERS.find(u => u.id === c.authorId) || {color:'#888',initials:'?'};
  const priorityColors = {normal:'var(--text-muted)',media:'var(--accent2)',alta:'var(--danger)'};
  const bodyHtml = c.body ? renderMarkdown(c.body, c.images || {}) : '';
  const commentCount = (window.comments || []).filter(cm => cm.kind === 'postit' && sameId(cm.targetId, c.id)).length;
  const commentsHtml = commentCount > 0 ? `<span class="comment-badge-postit" title="Hay comentarios">💬 ${commentCount}</span>` : '';

  // Asignado a
  const assignedUser = c.assignedTo != null ? USERS.find(u => sameId(u.id, c.assignedTo)) : null;
  const assignedHtml = assignedUser
    ? `<div class="postit-card-assignee" title="Asignado a ${assignedUser.name}">
        <div class="postit-assignee-avatar" style="background:${assignedUser.color}">${assignedUser.initials}</div>
       </div>`
    : '';

  // Fecha límite
  let dueDateHtml = '';
  if (c.dueDate) {
    const due = new Date(c.dueDate + 'T12:00:00');
    const dateStr = due.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    dueDateHtml = `<span class="postit-card-due${isOverdue ? ' postit-card-due--overdue' : ''}" title="Fecha límite: ${dateStr}">${c.dueDate}</span>`;
  }

  // Checklist progress
  let checklistHtml = '';
  if (c.checklist && c.checklist.length > 0) {
    const done = c.checklist.filter(i => i.done).length;
    const total = c.checklist.length;
    const pct = Math.round(done / total * 100);
    checklistHtml = `<div class="postit-card-checklist">
      <div class="postit-card-checklist-bar">
        <div class="postit-card-checklist-fill" style="width:${pct}%"></div>
      </div>
      <span>${done}/${total}</span>
    </div>`;
  }

  return `<div class="postit-card ${c.color}${isOverdue ? ' postit-card--overdue' : ''}" draggable="true" data-postit-id="${c.id}" onclick="if(!window._postitDragSuppressClick){editPostitCard('${c.id}')}">
    <div class="postit-card-actions">
      <button class="postit-card-action" onclick="movePostitCard(event,'${c.id}',-1)" title="Mover a la izquierda">←</button>
      <button class="postit-card-action" onclick="movePostitCard(event,'${c.id}',1)" title="Mover a la derecha">→</button>
      <button class="postit-card-action" onclick="deletePostitCard(event,'${c.id}')" style="color:var(--danger)" title="Eliminar">✕</button>
    </div>
    <div class="postit-card-title-row">
      <div class="postit-card-title">${c.title}</div>
      ${commentsHtml}
    </div>
    ${bodyHtml ? `<div class="postit-card-body">${bodyHtml}</div>` : ''}
    ${checklistHtml}
    <div class="postit-card-footer">
      <div class="note-author-avatar" style="background:${author.color};width:18px;height:18px;font-size:8px">${author.initials}</div>
      ${assignedHtml}
      <span style="color:${priorityColors[c.priority]};margin-left:auto">${c.priority !== 'normal' ? '● ' + c.priority : ''}</span>
      ${dueDateHtml}
      ${commentIndicators('postit', c.id)}
    </div>
  </div>`;
}

function setupPostitDragAndDrop() {
  const columns = POSTIT_COLS.map(c => ({ id: c.id, el: document.getElementById(`pcol-${c.id}`) })).filter(c => c.el);
  if (!postitDropPlaceholder) {
    postitDropPlaceholder = document.createElement('div');
    postitDropPlaceholder.className = 'postit-drop-placeholder';
  }
  const cards = document.querySelectorAll('#postit-board .postit-card[data-postit-id]');
  cards.forEach(cardEl => {
    cardEl.addEventListener('dragstart', (e) => {
      const id = String(cardEl.getAttribute('data-postit-id') || '');
      if (!id) return;
      draggingPostitId = id;
      cardEl.classList.add('dragging');
      window._postitDragSuppressClick = false;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(id));
      }
    });
    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('dragging');
      document.querySelectorAll('#postit-board .postit-cards.drag-over').forEach(el => el.classList.remove('drag-over'));
      postitDropPlaceholder?.remove();
      draggingPostitId = null;
      window._postitDragSuppressClick = true;
      setTimeout(() => { window._postitDragSuppressClick = false; }, 120);
    });
  });

  columns.forEach(({ id: columnId, el: colEl }) => {
    colEl.addEventListener('dragover', (e) => {
      if (draggingPostitId == null) return;
      e.preventDefault();
      colEl.classList.add('drag-over');
      autoScrollColumn(colEl, e.clientY);
      const afterEl = getDragAfterElement(colEl, e.clientY);
      if (afterEl == null) colEl.appendChild(postitDropPlaceholder);
      else colEl.insertBefore(postitDropPlaceholder, afterEl);
    });
    colEl.addEventListener('dragleave', (e) => {
      if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('drag-over');
    });
    colEl.addEventListener('drop', (e) => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      if (draggingPostitId == null) return;
      const draggingEl = document.querySelector('#postit-board .postit-card.dragging');
      if (draggingEl) {
        if (postitDropPlaceholder?.parentNode === colEl) colEl.insertBefore(draggingEl, postitDropPlaceholder);
        else colEl.appendChild(draggingEl);
      }
      postitDropPlaceholder?.remove();
      applyPostitOrderFromDOM();
      const moved = postitCards.find(c => sameId(c.id, draggingPostitId));
      if (moved && moved.column !== columnId) moved.column = columnId;
      applyPostitColorByColumn(moved);
      savePostitData();
      renderPostitBoard();
    });
  });
}

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll('.postit-card:not(.dragging)')];
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function applyPostitOrderFromDOM() {
  const domOrder = [];
  POSTIT_COLS.forEach(col => {
    const colEl = document.getElementById(`pcol-${col.id}`);
    if (!colEl) return;
    colEl.querySelectorAll('.postit-card[data-postit-id]').forEach((el, idx) => {
      const id = String(el.getAttribute('data-postit-id') || '');
      if (id) domOrder.push({ id, column: col.id, idx });
    });
  });
  if (!domOrder.length) return;

  const rank = new Map(domOrder.map((r, i) => [String(r.id), i]));
  domOrder.forEach(({ id, column }) => {
    const card = postitCards.find(c => sameId(c.id, id));
    if (card) {
      card.column = column;
      applyPostitColorByColumn(card);
    }
  });
  postitCards.sort((a, b) => {
    const ra = rank.get(String(a.id));
    const rb = rank.get(String(b.id));
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1;
    if (rb == null) return -1;
    return ra - rb;
  });
}

function autoScrollColumn(colEl, clientY) {
  const rect = colEl.getBoundingClientRect();
  const threshold = 48;
  const maxStep = 16;
  if (clientY < rect.top + threshold) {
    const intensity = (rect.top + threshold - clientY) / threshold;
    colEl.scrollTop -= Math.ceil(maxStep * Math.max(0.2, intensity));
  } else if (clientY > rect.bottom - threshold) {
    const intensity = (clientY - (rect.bottom - threshold)) / threshold;
    colEl.scrollTop += Math.ceil(maxStep * Math.max(0.2, intensity));
  }
}

function populatePostitAssigneeSelect(selectedUserId = null) {
  const select = document.getElementById('postit-assignee-select');
  if (!select) return;
  let html = '<option value="">Sin asignar</option>';
  USERS.forEach(u => {
    html += `<option value="${u.id}">${u.name}</option>`;
  });
  select.innerHTML = html;
  select.value = selectedUserId == null ? '' : String(selectedUserId);
}

function renderPostitCommentsInModal(postitId) {
  renderPostitCommentsSidebar(postitId);
}

export function renderPostitCommentsSidebar(postitId) {
  const listEl = document.getElementById('postit-comments-list');
  const countEl = document.getElementById('postit-comments-count');
  if (!listEl) return;

  if (postitId == null) {
    listEl.innerHTML = '<div class="postit-comments-empty-msg">Guarda la tarjeta primero para añadir comentarios.</div>';
    if (countEl) countEl.textContent = '';
    const ta = document.getElementById('postit-comment-input');
    const btn = document.querySelector('#postit-modal .btn-compose-send');
    if (ta) { ta.disabled = true; ta.placeholder = 'Guarda la tarjeta para comentar...'; }
    if (btn) btn.disabled = true;
    return;
  }

  // Habilitar textarea y botón
  const ta = document.getElementById('postit-comment-input');
  const btn = document.querySelector('#postit-modal .btn-compose-send');
  if (ta) { ta.disabled = false; ta.placeholder = 'Escribe un comentario... (@nombre para mencionar)'; }
  if (btn) btn.disabled = false;

  // Renderizar comentarios
  const relevant = comments
    .filter(c => c.kind === 'postit' && sameId(c.targetId, postitId))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (countEl) countEl.textContent = relevant.length > 0 ? String(relevant.length) : '';

  if (relevant.length === 0) {
    listEl.innerHTML = '<div class="postit-comments-empty-msg">Sin comentarios todavía.<br>Sé el primero en comentar.</div>';
  } else {
    listEl.innerHTML = relevant.map(c => {
      const author = USERS.find(u => sameId(u.id, c.authorId)) || { initials: '?', color: '#888', name: 'Desconocido' };
      const mine = currentUser && sameId(c.authorId, currentUser.id);
      const time = new Date(c.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const text = (c.body || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/@([A-Za-záéíóúÁÉÍÓÚñÑ]+ ?[A-Za-záéíóúÁÉÍÓÚñÑ]*)/g,'<span class="mention">@$1</span>');
      return `<div class="postit-comment-item ${mine ? 'mine' : ''}">
        <div class="postit-comment-av" style="background:${author.color}">${author.initials}</div>
        <div class="postit-comment-bubble">
          <div class="postit-comment-meta">
            <span class="postit-comment-author">${author.name}</span>
            <span class="postit-comment-time">${time}</span>
          </div>
          <div class="postit-comment-text">${text}</div>
        </div>
      </div>`;
    }).join('');
    listEl.scrollTop = listEl.scrollHeight;
  }

  const mentionPop = document.getElementById('postit-comment-input-mention-pop');
  if (mentionPop && currentUser) {
    const usersHtml = USERS
      .filter(u => u.group === currentUser.group)
      .map(u => `<div class="comment-mention-item" data-mention-name="${u.name}" 
        onclick="toggleMentionPick('postit-comment-input', this.getAttribute('data-mention-name'), this)">
        <div class="comment-mention-avatar" style="background:${u.color}">${u.initials}</div>
        <span>${u.name}</span>
      </div>`).join('');
    mentionPop.innerHTML = usersHtml + 
      `<div style="padding:8px 10px;border-top:1px solid var(--border)">
        <button class="btn-secondary" type="button" 
          onclick="insertSelectedMentions('postit-comment-input')">Insertar menciones</button>
      </div>`;
  }

  // Conectar botón Enviar — siempre reemplazar el listener para que tenga el postitId correcto
  if (btn) {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      const input = document.getElementById('postit-comment-input');
      if (!input || !input.value.trim() || !currentUser) return;
      comments.push({
        id: Date.now(),
        kind: 'postit',
        targetId: postitId,
        extraId: null,
        authorId: currentUser.id,
        body: input.value.trim(),
        images: {},
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('diario_comments', JSON.stringify(comments));
      input.value = '';
      renderPostitCommentsSidebar(postitId);
      renderPostitBoard();
    });
  }
}

export function openNewPostitModal(colId) {
  setEditingPostitId(null);
  setEditingPostitImages({});
  document.getElementById('postit-modal-title').textContent = 'Nueva Tarjeta';
  document.getElementById('postit-title-input').value = '';
  document.getElementById('postit-body-input').value = '';
  document.getElementById('postit-content-preview').innerHTML = '';
  document.getElementById('postit-col-select').value = colId || 'pendiente';
  document.getElementById('postit-color-select').value = 'yellow';
  setSelectedPostitPriority('normal');
  document.querySelectorAll('#postit-modal .priority-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.priority === 'normal');
  });
  populatePostitAssigneeSelect(null);
  const dueDateInput = document.getElementById('postit-due-date-input');
  if (dueDateInput) dueDateInput.value = '';
  window._postitChecklist = [];
  window._postitSubtasks = [];
  window._postitAttachments = [];
  renderPostitSubtasks();
  renderPostitChecklist();
  renderPostitAttachments();
  document.getElementById('postit-comments-col')?.classList.add('hidden');
  document.querySelector('#postit-modal .modal')?.classList.remove('postit-modal-editing');
  openModal('postit-modal');
  setTimeout(() => renderPostitCommentsInModal(null), 0);
}

export function editPostitCard(id) {
  const c = postitCards.find(p => sameId(p.id, id));
  if (!c) return;
  setEditingPostitId(id);
  setEditingPostitImages(c.images || {});
  document.getElementById('postit-modal-title').textContent = 'Editar Tarjeta';
  document.getElementById('postit-title-input').value = c.title;
  document.getElementById('postit-body-input').value = c.body || '';
  document.getElementById('postit-content-preview').innerHTML = c.body ? renderMarkdown(c.body, editingPostitImages) : '';
  document.getElementById('postit-col-select').value = c.column;
  document.getElementById('postit-color-select').value = c.color;
  populatePostitAssigneeSelect(c.assignedTo ?? null);
  const dueDateInput = document.getElementById('postit-due-date-input');
  if (dueDateInput) {
    dueDateInput.value = c.dueDate ? String(c.dueDate).slice(0, 10) : '';
  }
  window._postitChecklist = c.checklist ? [...c.checklist] : [];
  window._postitSubtasks = c.subtasks ? [...c.subtasks] : [];
  window._postitAttachments = c.attachments ? [...c.attachments] : [];
  renderPostitSubtasks();
  renderPostitChecklist();
  renderPostitAttachments();
  setSelectedPostitPriority(c.priority);
  document.querySelectorAll('#postit-modal .priority-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.priority === c.priority);
  });
  document.getElementById('postit-comments-col')?.classList.remove('hidden');
  document.querySelector('#postit-modal .modal')?.classList.add('postit-modal-editing');
  openModal('postit-modal');
  setTimeout(() => renderPostitCommentsInModal(c.id), 0);
}

export function selectPostitPriority(el) {
  document.querySelectorAll('#postit-modal .priority-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  setSelectedPostitPriority(el.dataset.priority);
}

export async function savePostit() {
  const title = document.getElementById('postit-title-input').value.trim();
  if (!title) { showToast('El título es requerido', 'error'); return; }
  const body = document.getElementById('postit-body-input').value.trim();
  const column = document.getElementById('postit-col-select').value;
  const color = document.getElementById('postit-color-select').value;
  const assignedToRaw = document.getElementById('postit-assignee-select')?.value ?? '';
  const assignedTo = assignedToRaw === ''
    ? null
    : (Number.isNaN(Number(assignedToRaw)) ? assignedToRaw : Number(assignedToRaw));
  const dueDateRaw = document.getElementById('postit-due-date-input')?.value ?? '';
  const dueDate = dueDateRaw ? dueDateRaw : null;
  const currentImages = editingPostitId ? postitCards.find(c => sameId(c.id, editingPostitId))?.images || {} : {};
  const images = collectImageMap(body, currentImages);
  // Recoger checklist
  const checklist = window._postitChecklist || [];
  
  // Recoger subtareas
  const subtasks = window._postitSubtasks || [];
  
  // Recoger adjuntos
  const attachments = window._postitAttachments || [];

  if (editingPostitId) {
    const idx = postitCards.findIndex(c => sameId(c.id, editingPostitId) && c.group === currentUser.group);
    if (idx === -1) {
      showToast('No autorizado para editar esta tarjeta', 'error');
      return;
    }
    try {
      const mongoId = postitCards[idx]._id || postitCards[idx].id;
      await apiUpdatePostit(mongoId, {
        title,
        body,
        column,
        color,
        priority: selectedPostitPriority,
        assignedTo,
        dueDate,
        images,
        checklist,
        subtasks,
        attachments,
      });
    } catch (err) {
      console.error('Error actualizando post-it:', err);
      showToast('Error al guardar en servidor', 'error');
      return;
    }
    postitCards[idx] = {...postitCards[idx], title, body, column, color, priority:selectedPostitPriority, assignedTo, dueDate, images, checklist, subtasks, attachments};
  } else {
    const newCard = {
      title,
      body,
      column,
      color,
      priority: selectedPostitPriority,
      assignedTo,
      dueDate,
      authorId: currentUser.id,
      group: currentUser.group,
      department: currentUser.group,
      createdAt: new Date().toISOString(),
      images,
      checklist,
      subtasks,
      attachments,
    };
    try {
      const saved = await apiCreatePostit(newCard);
      newCard._id = saved._id;
      newCard.id = saved._id || Date.now();
    } catch (err) {
      console.error('Error creando post-it:', err);
      showToast('Error al guardar en servidor', 'error');
      return;
    }
    postitCards.push(newCard);
  }
  savePostitData();
  closeModal('postit-modal');
  renderPostitBoard();
  showToast(editingPostitId ? 'Tarjeta actualizada' : 'Tarjeta creada', 'success');
}

export async function movePostitCard(e, id, dir) {
  e.stopPropagation();
  const colIds = POSTIT_COLS.map(c => c.id);
  const card = postitCards.find(c => sameId(c.id, id));
  if (!card) return;
  const idx = colIds.indexOf(card.column);
  const newIdx = Math.max(0, Math.min(colIds.length - 1, idx + dir));
  card.column = colIds[newIdx];
  try {
    const mongoId = card._id || card.id;
    await apiUpdatePostit(mongoId, { column: card.column });
  } catch (err) {
    console.error('Error moviendo post-it:', err);
  }
  applyPostitColorByColumn(card);
  savePostitData();
  renderPostitBoard();
}

export function deletePostitCard(e, id) {
  e.stopPropagation();
  const card = postitCards.find(c => sameId(c.id, id));
  showConfirmModal({
    icon: '🗂',
    title: '¿Eliminar esta tarjeta?',
    message: card ? `Se eliminará "${card.title}" y todos sus comentarios.` : 'Se eliminará la tarjeta.',
    onConfirm: async () => {
      const idx = postitCards.findIndex(c => sameId(c.id, id));
      if (idx !== -1) {
        try {
          const mongoId = card._id || card.id;
          await apiDeletePostit(mongoId);
        } catch (err) {
          console.error('Error eliminando post-it:', err);
          showToast('Error al eliminar en servidor', 'error');
          return;
        }
        postitCards.splice(idx, 1);
        savePostitData();
        renderPostitBoard();
        showToast('Tarjeta eliminada', 'info');
      }
    }
  });
}

// ── Renderizar las tres secciones ──
export function renderPostitSubtasks() {
  const list = document.getElementById('postit-subtasks-list');
  if (!list) return;
  const items = window._postitSubtasks || [];
  if (items.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = items.map((s, i) => `
    <div class="postit-item-row">
      <input type="checkbox" class="postit-item-check" ${s.done ? 'checked' : ''}
        onchange="togglePostitSubtask('${i}')">
      <span class="postit-item-text ${s.done ? 'done' : ''}">${s.text}</span>
      <button type="button" class="postit-item-delete" onclick="deletePostitSubtask('${i}')">✕</button>
    </div>
  `).join('');
}

export function renderPostitChecklist() {
  const list = document.getElementById('postit-checklist-list');
  if (!list) return;
  const items = window._postitChecklist || [];
  if (items.length === 0) { list.innerHTML = ''; return; }
  const done = items.filter(i => i.done).length;
  list.innerHTML = `
    <div class="postit-checklist-progress">
      <div class="postit-checklist-bar">
        <div class="postit-checklist-fill" style="width:${items.length ? Math.round(done/items.length*100) : 0}%"></div>
      </div>
      <span>${done}/${items.length}</span>
    </div>
    ${items.map((s, i) => `
      <div class="postit-item-row">
        <input type="checkbox" class="postit-item-check" ${s.done ? 'checked' : ''}
          onchange="togglePostitChecklist('${i}')">
        <span class="postit-item-text ${s.done ? 'done' : ''}">${s.text}</span>
        <button type="button" class="postit-item-delete" onclick="deletePostitChecklist('${i}')">✕</button>
      </div>
    `).join('')}
  `;
}

export function renderPostitAttachments() {
  const list = document.getElementById('postit-attachments-list');
  if (!list) return;
  const items = window._postitAttachments || [];
  if (items.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = items.map((a, i) => {
    const isImage = a.type.startsWith('image');
    const preview = isImage
      ? `<img src="${a.dataUrl}" class="postit-attachment-thumb" onclick="openPostitAttachmentPreview('${i}')" title="Ver imagen">`
      : `<span class="postit-attachment-icon" onclick="openPostitAttachmentPreview('${i}')" 
           style="cursor:pointer" title="Abrir archivo">📄</span>`;
    return `<div class="postit-attachment-row">
      ${preview}
      <span class="postit-attachment-name">${a.name}</span>
      <span class="postit-attachment-size">${Math.round(a.size/1024)}kb</span>
      <button type="button" class="postit-item-delete" onclick="deletePostitAttachment('${i}')">✕</button>
    </div>`;
  }).join('');
}

export function openPostitAttachmentPreview(i) {
  const a = (window._postitAttachments || [])[i];
  if (!a) return;
  if (a.type.startsWith('image')) {
    // Abrir imagen en lightbox simple
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);
      z-index:999999;display:flex;align-items:center;justify-content:center;cursor:zoom-out`;
    overlay.onclick = () => overlay.remove();
    const img = document.createElement('img');
    img.src = a.dataUrl;
    img.style.cssText = `max-width:90vw;max-height:90vh;border-radius:12px;
      box-shadow:0 0 60px rgba(0,0,0,0.8)`;
    overlay.appendChild(img);
    document.body.appendChild(overlay);
  } else {
    // Para otros archivos, abrir en nueva pestaña
    const url = URL.createObjectURL(
      new Blob([a.dataUrl], {type: a.type})
    );
    window.open(url, '_blank');
  }
}

// ── Acciones subtareas ──
export function addPostitSubtask() {
  const list = document.getElementById('postit-subtasks-list');
  if (!list) return;
  // Si ya hay un input abierto no abrir otro
  if (list.querySelector('.postit-inline-input-row')) return;
  const row = document.createElement('div');
  row.className = 'postit-inline-input-row';
  row.innerHTML = `
    <input type="text" class="postit-inline-input" placeholder="Nombre de la subtarea..."
      onkeydown="if(event.key==='Enter'){confirmPostitSubtask(this)}
                 else if(event.key==='Escape'){cancelPostitInlineInput('postit-subtasks-list')}">
    <button type="button" class="btn-postit-confirm" onclick="confirmPostitSubtask(this.previousElementSibling)">✓</button>
    <button type="button" class="postit-item-delete" onclick="cancelPostitInlineInput('postit-subtasks-list')">✕</button>
  `;
  list.appendChild(row);
  row.querySelector('input').focus();
}

export function confirmPostitSubtask(input) {
  const text = input.value.trim();
  if (!text) return;
  if (!window._postitSubtasks) window._postitSubtasks = [];
  window._postitSubtasks.push({ id: Date.now(), text, done: false });
  renderPostitSubtasks();
}

export function cancelPostitInlineInput(listId) {
  const row = document.getElementById(listId)?.querySelector('.postit-inline-input-row');
  if (row) row.remove();
}
export function togglePostitSubtask(i) {
  if (!window._postitSubtasks) return;
  window._postitSubtasks[i].done = !window._postitSubtasks[i].done;
  renderPostitSubtasks();
}
export function deletePostitSubtask(i) {
  if (!window._postitSubtasks) return;
  window._postitSubtasks.splice(i, 1);
  renderPostitSubtasks();
}

// ── Acciones checklist ──
export function addPostitChecklistItem() {
  const list = document.getElementById('postit-checklist-list');
  if (!list) return;
  if (list.querySelector('.postit-inline-input-row')) return;
  const row = document.createElement('div');
  row.className = 'postit-inline-input-row';
  row.innerHTML = `
    <input type="text" class="postit-inline-input" placeholder="Elemento de la lista..."
      onkeydown="if(event.key==='Enter'){confirmPostitChecklist(this)}
                 else if(event.key==='Escape'){cancelPostitInlineInput('postit-checklist-list')}">
    <button type="button" class="btn-postit-confirm" onclick="confirmPostitChecklist(this.previousElementSibling)">✓</button>
    <button type="button" class="postit-item-delete" onclick="cancelPostitInlineInput('postit-checklist-list')">✕</button>
  `;
  list.appendChild(row);
  row.querySelector('input').focus();
}

export function confirmPostitChecklist(input) {
  const text = input.value.trim();
  if (!text) return;
  if (!window._postitChecklist) window._postitChecklist = [];
  window._postitChecklist.push({ id: Date.now(), text, done: false });
  renderPostitChecklist();
}
export function togglePostitChecklist(i) {
  if (!window._postitChecklist) return;
  window._postitChecklist[i].done = !window._postitChecklist[i].done;
  renderPostitChecklist();
}
export function deletePostitChecklist(i) {
  if (!window._postitChecklist) return;
  window._postitChecklist.splice(i, 1);
  renderPostitChecklist();
}

// ── Acciones adjuntos ──
export function triggerPostitAttachment() {
  document.getElementById('postit-file-input')?.click();
}
export function handlePostitAttachment(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  if (!window._postitAttachments) window._postitAttachments = [];
  if (window._postitAttachments.length + files.length > 5) {
    alert('Máximo 5 adjuntos por tarjeta');
    return;
  }
  files.forEach(file => {
    if (file.size > 2 * 1024 * 1024) {
      alert(`${file.name} supera el límite de 2MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      window._postitAttachments.push({
        id: Date.now(),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: e.target.result
      });
      renderPostitAttachments();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}
export function deletePostitAttachment(i) {
  if (!window._postitAttachments) return;
  window._postitAttachments.splice(i, 1);
  renderPostitAttachments();
}

export function savePostitData() {
  // Ya no guarda en localStorage — operaciones individuales usan API
}

