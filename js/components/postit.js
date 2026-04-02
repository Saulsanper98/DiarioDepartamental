// ===== POSTIT MODULE =====

import { postitCards, USERS, currentUser, collectImageMap, editingPostitId, selectedPostitPriority, sameId, editingPostitImages, setEditingPostitId, setEditingPostitImages, setSelectedPostitPriority } from './data.js';
import { showToast, openModal, showConfirmModal } from './modalControl.js';
import { renderMarkdown } from './notes.js';

export const POSTIT_COLS = [
  {id:'pendiente',label:'Pendiente',icon:'📋',color:'var(--text-muted)'},
  {id:'progreso',label:'En Progreso',icon:'⚡',color:'var(--afternoon)'},
  {id:'revision',label:'Revisión',icon:'🔍',color:'var(--accent2)'},
  {id:'hecho',label:'Hecho',icon:'✅',color:'var(--success)'},
];

export function renderPostitBoard() {
  const board = document.getElementById('postit-board');
  if (!board) return;
  board.innerHTML = POSTIT_COLS.map(col => {
    const cards = postitCards.filter(c => c.column === col.id && c.group === currentUser.group);
    return `<div class="postit-col">
      <div class="postit-col-header">
        <h4 style="color:${col.color}">${col.icon} ${col.label}</h4>
        <span class="postit-col-count">${cards.length}</span>
      </div>
      <div class="postit-cards" id="pcol-${col.id}">
        ${cards.map(c => renderPostitCard(c)).join('')}
      </div>
      <button class="btn-add-postit" onclick="openNewPostitModal('${col.id}')">+ Añadir tarjeta</button>
    </div>`;
  }).join('');
}

export function renderPostitCard(c) {
  const author = USERS.find(u => u.id === c.authorId) || {color:'#888',initials:'?'};
  const priorityColors = {normal:'var(--text-muted)',media:'var(--accent2)',alta:'var(--danger)'};
  const bodyHtml = c.body ? renderMarkdown(c.body, c.images || {}) : '';
  const commentCount = (window.comments || []).filter(cm => cm.kind === 'postit' && sameId(cm.targetId, c.id)).length;
  const commentsHtml = commentCount > 0 ? `<span class="comment-badge-postit" title="Hay comentarios">💬 ${commentCount}</span>` : '';
  return `<div class="postit-card ${c.color}" onclick="editPostitCard(${c.id})">
    <div class="postit-card-actions">
      <button class="postit-card-action" onclick="movePostitCard(event,${c.id},-1)" title="Mover a la izquierda">←</button>
      <button class="postit-card-action" onclick="movePostitCard(event,${c.id},1)" title="Mover a la derecha">→</button>
      <button class="postit-card-action" onclick="deletePostitCard(event,${c.id})" style="color:var(--danger)" title="Eliminar">✕</button>
    </div>
    <div class="postit-card-title-row">
      <div class="postit-card-title">${c.title}</div>
      ${commentsHtml}
    </div>
    ${bodyHtml ? `<div class="postit-card-body">${bodyHtml}</div>` : ''}
    <div class="postit-card-footer">
      <div class="note-author-avatar" style="background:${author.color};width:18px;height:18px;font-size:8px">${author.initials}</div>
      <span style="color:${priorityColors[c.priority]}">${c.priority !== 'normal' ? '● ' + c.priority : ''}</span>
    </div>
  </div>`;
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
  openModal('postit-modal');
}

export function editPostitCard(id) {
  const c = postitCards.find(p => p.id === id);
  if (!c) return;
  setEditingPostitId(id);
  setEditingPostitImages(c.images || {});
  document.getElementById('postit-modal-title').textContent = 'Editar Tarjeta';
  document.getElementById('postit-title-input').value = c.title;
  document.getElementById('postit-body-input').value = c.body || '';
  document.getElementById('postit-content-preview').innerHTML = c.body ? renderMarkdown(c.body, editingPostitImages) : '';
  document.getElementById('postit-col-select').value = c.column;
  document.getElementById('postit-color-select').value = c.color;
  setSelectedPostitPriority(c.priority);
  document.querySelectorAll('#postit-modal .priority-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.priority === c.priority);
  });
  openModal('postit-modal');
}

export function selectPostitPriority(el) {
  document.querySelectorAll('#postit-modal .priority-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  setSelectedPostitPriority(el.dataset.priority);
}

export function savePostit() {
  const title = document.getElementById('postit-title-input').value.trim();
  if (!title) { showToast('El título es requerido', 'error'); return; }
  const body = document.getElementById('postit-body-input').value.trim();
  const column = document.getElementById('postit-col-select').value;
  const color = document.getElementById('postit-color-select').value;
  const currentImages = editingPostitId ? postitCards.find(c => c.id === editingPostitId)?.images || {} : {};
  const images = collectImageMap(body, currentImages);

  if (editingPostitId) {
    const idx = postitCards.findIndex(c => c.id === editingPostitId && c.group === currentUser.group);
    if (idx !== -1) postitCards[idx] = {...postitCards[idx], title, body, column, color, priority:selectedPostitPriority, images};
    else { showToast('No autorizado para editar esta tarjeta', 'error'); return; }
  } else {
    postitCards.push({id:Date.now(), title, body, column, color, priority:selectedPostitPriority, authorId:currentUser.id, group:currentUser.group, createdAt:new Date().toISOString(), images});
  }
  savePostitData();
  closeModal('postit-modal');
  renderPostitBoard();
  showToast(editingPostitId ? 'Tarjeta actualizada' : 'Tarjeta creada', 'success');
}

export function movePostitCard(e, id, dir) {
  e.stopPropagation();
  const colIds = POSTIT_COLS.map(c => c.id);
  const card = postitCards.find(c => c.id === id);
  if (!card) return;
  const idx = colIds.indexOf(card.column);
  const newIdx = Math.max(0, Math.min(colIds.length - 1, idx + dir));
  card.column = colIds[newIdx];
  const colToColor = {pendiente:'yellow', progreso:'blue', revision:'purple', hecho:'green'};
  if (colToColor[card.column]) card.color = colToColor[card.column];
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
    onConfirm: () => {
      const idx = postitCards.findIndex(c => sameId(c.id, id));
      if (idx !== -1) {
        postitCards.splice(idx, 1);
        savePostitData();
        renderPostitBoard();
        showToast('Tarjeta eliminada', 'info');
      }
    }
  });
}

export function savePostitData() {
  localStorage.setItem('diario_postit', JSON.stringify(postitCards));
}

