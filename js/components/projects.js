// ===== PROJECTS MODULE =====

import { USERS, projects, currentUser, currentProjectId, projectUserFilter, editingProjectId, editingTaskId, editingProjectImages, editingTaskImages, comments, workGroups, GROUPS, collectImageMap, setProjects, setCurrentProjectId, setEditingProjectId, setEditingTaskId, setEditingProjectImages, setEditingTaskImages, setProjectUserFilter as setProjectUserFilterState } from './data.js';
import { showToast, openModal, closeModal, showConfirmModal, escapeChatHtml } from './modalControl.js';
import { renderMarkdown, fillCollabTargetSelect, buildSharesFromCollabSelect } from './notes.js';
import { createCustomSelect } from './auroraCustomSelect.js';
import { commentIndicators, getLatestCommentPreview } from './docs.js';
import { sameId } from './data.js';

function toOnclickStringArg(value) {
  return JSON.stringify(value).replace(/'/g, "\\'");
}

export function getProjectTreeCollapsedSet() {
  if (!window._projTreeCollapsed) {
    try {
      const raw = sessionStorage.getItem('diario_proj_tree_collapsed');
      window._projTreeCollapsed = new Set((raw ? JSON.parse(raw) : []).map(String));
    } catch {
      window._projTreeCollapsed = new Set();
    }
  }
  return window._projTreeCollapsed;
}

export function saveProjectTreeCollapsedSet() {
  sessionStorage.setItem('diario_proj_tree_collapsed', JSON.stringify([...getProjectTreeCollapsedSet()]));
}

export function userIsActiveWorkGroupMember(wg) {
  if (!wg || !currentUser) return false;
  if (sameId(wg.ownerId, currentUser.id)) return true;
  return (wg.memberUserIds || []).some(mid => sameId(mid, currentUser.id));
}

export function shareMatchesUser(shares) {
  if (!shares || !shares.length || !currentUser) return false;
  for (const s of shares) {
    if (s.type === 'user' && sameId(s.userId, currentUser.id)) return true;
    if (s.type === 'dept' && currentUser.group === s.deptName) return true;
    if (s.type === 'workgroup') {
      const wg = workGroups.find(w => sameId(w.id, s.workGroupId));
      if (wg && (sameId(wg.ownerId, currentUser.id) || (wg.memberUserIds || []).some(id => sameId(id, currentUser.id)))) return true;
    }
  }
  return false;
}

export function expandProjectTreeAncestors(projectId) {
  let walk = projects.find(p => sameId(p.id, projectId));
  let g = 0;
  const col = getProjectTreeCollapsedSet();
  let changed = false;
  while (walk && walk.parentProjectId != null && g++ < 64) {
    const pid = walk.parentProjectId;
    const key = String(pid);
    if (col.has(key)) {
      col.delete(key);
      changed = true;
    }
    walk = projects.find(p => sameId(p.id, pid));
  }
  if (changed) saveProjectTreeCollapsedSet();
}

export function toggleProjectTreeCollapse(projectId, ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  const col = getProjectTreeCollapsedSet();
  const key = String(projectId);
  if (col.has(key)) col.delete(key);
  else col.add(key);
  saveProjectTreeCollapsedSet();
  renderProjects();
}

export function isProjectDescendantOf(candidateId, ancestorId) {
  let walk = projects.find(p => sameId(p.id, candidateId));
  let g = 0;
  while (walk && walk.parentProjectId != null && g++ < 64) {
    if (sameId(walk.parentProjectId, ancestorId)) return true;
    walk = projects.find(p => sameId(p.id, walk.parentProjectId));
  }
  return false;
}

export function validateProjectReparent(projectId, newParentId) {
  if (newParentId == null) return true;
  if (sameId(projectId, newParentId)) return false;
  if (isProjectDescendantOf(newParentId, projectId)) return false;
  return true;
}

export function cascadeProjectGroupToDescendants(rootId, newGroup) {
  projects.filter(c => sameId(c.parentProjectId, rootId)).forEach(c => {
    c.group = newGroup;
    cascadeProjectGroupToDescendants(c.id, newGroup);
  });
}

export function fillProjectParentSelect(opts) {
  const editingId = opts.editingId;
  const selectedParentId = opts.selectedParentId;
  const impliedGroup = opts.impliedGroup;
  const sel = document.getElementById('project-parent-select');
  if (!sel) return;
  const ed = editingId != null ? projects.find(p => sameId(p.id, editingId)) : null;
  const groupFilter = ed ? ed.group : (impliedGroup != null ? impliedGroup : currentUser.group);
  let html = '<option value="_root">— Raíz (sin proyecto padre)</option>';
  const candidates = projects
    .filter(p => userCanSeeProject(p) && p.group === groupFilter)
    .filter(p => {
      if (editingId == null) return true;
      if (sameId(p.id, editingId)) return false;
      if (isProjectDescendantOf(p.id, editingId)) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  function depthOf(pid) {
    let d = 0;
    let x = projects.find(q => sameId(q.id, pid));
    while (x && x.parentProjectId != null && d < 32) {
      d++;
      x = projects.find(q => sameId(q.id, x.parentProjectId));
    }
    return d;
  }

  candidates.forEach(p => {
    const d = depthOf(p.id);
    const pad = d ? `${'·'.repeat(Math.min(d, 10))} ` : '';
    html += `<option value="${p.id}">${escapeChatHtml(pad + p.name)}</option>`;
  });
  sel.innerHTML = html;
  const want = selectedParentId == null || selectedParentId === '' ? '_root' : String(selectedParentId);
  sel.value = want;
  if (sel.value !== want) sel.value = '_root';
}

/**
 * Filas DFS del árbol de padres (mismos candidatos que fillProjectParentSelect), solo para UI Aurora.
 * No modifica el DOM ni el <select>.
 */
export function getProjectParentSelectAuroraRows(opts) {
  const editingId = opts.editingId;
  const impliedGroup = opts.impliedGroup;
  const ed = editingId != null ? projects.find(p => sameId(p.id, editingId)) : null;
  const groupFilter = ed ? ed.group : (impliedGroup != null ? impliedGroup : currentUser.group);
  const candidates = projects
    .filter(p => userCanSeeProject(p) && p.group === groupFilter)
    .filter(p => {
      if (editingId == null) return true;
      if (sameId(p.id, editingId)) return false;
      if (isProjectDescendantOf(p.id, editingId)) return false;
      return true;
    });

  const candidateIds = new Set(candidates.map(p => String(p.id)));

  function parentInCandidates(p) {
    if (p.parentProjectId == null) return false;
    return candidateIds.has(String(p.parentProjectId));
  }

  const roots = candidates
    .filter(p => !parentInCandidates(p))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const rows = [];
  function dfs(node, depth) {
    rows.push({ value: String(node.id), depth, label: node.name });
    const children = candidates
      .filter(c => sameId(c.parentProjectId, node.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    children.forEach(ch => dfs(ch, depth + 1));
  }
  roots.forEach(r => dfs(r, 0));
  return rows;
}

export function renderProjectUserFilter() {
  const bar = document.getElementById('project-user-filter');
  if (!bar) return;
  const usersInGroup = USERS.filter(u => u.group === currentUser.group);
  const allActive = projectUserFilter === null;
  bar.innerHTML = `<span class="puf-label">Filtrar por:</span>
    <button class="puf-pill ${allActive ? 'active' : ''}" onclick="setProjectUserFilter(null)">👥 Todos</button>
    ${usersInGroup.map(u => {
      const isActive = projectUserFilter === u.id;
      return `<button class="puf-pill ${isActive ? 'active' : ''}" onclick="setProjectUserFilter(${u.id})">
        <div class="puf-avatar" style="background:${u.color}">${u.initials}</div>
        ${u.name}
      </button>`;
    }).join('')}`;
}

export function setProjectUserFilter(userId) {
  setProjectUserFilterState(userId);
  renderProjectUserFilter();
  renderProjects();
}

export function renderProjects() {
  renderProjectUserFilter();
  const list = document.getElementById('projects-list');
  const statusLabels = {activo:'✅ Activo',pausa:'⏸ En Pausa',completado:'🏁 Completado'};
  let visibleProjects = projects.filter(p => userCanSeeProject(p));
  if (projectUserFilter !== null) {
    visibleProjects = visibleProjects.filter(p => projectSubtreeHasAssignee(p, projectUserFilter, new Set()));
  }

  if (currentProjectId) expandProjectTreeAncestors(currentProjectId);

  function isDisplayedRoot(proj) {
    if (proj.parentProjectId == null) return true;
    const par = visibleProjects.find(vp => sameId(vp.id, proj.parentProjectId));
    return !par;
  }

  const roots = visibleProjects.filter(isDisplayedRoot).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  function rowHtml(proj, depth) {
    const childs = visibleProjects.filter(c => sameId(c.parentProjectId, proj.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const subCount = childs.length;
    const collapsed = subCount > 0 && getProjectTreeCollapsedSet().has(String(proj.id));
    const tasksToShow = projectUserFilter !== null
      ? proj.tasks.filter(t => sameId(t.assigneeId, projectUserFilter))
      : proj.tasks;
    const done = tasksToShow.filter(t => t.done).length;
    const total = tasksToShow.length;
    const pComments = commentIndicators('project', proj.id);
    const pLast = getLatestCommentPreview('project', proj.id);
    const commentTooltip = pLast ? ` title="${escapeChatHtml(pLast.substring(0, 100))}"` : '';
    const pad = Math.min(depth, 12) * 10;
    const projIdArg = toOnclickStringArg(proj.id);
    const toggleBtn = subCount
      ? `<button type="button" class="project-tree-toggle" onclick="toggleProjectTreeCollapse(${projIdArg},event)" aria-expanded="${!collapsed}"${commentTooltip} title="${collapsed ? 'Expandir subproyectos' : 'Contraer subproyectos'}${pLast ? ' — ' + escapeChatHtml(pLast.substring(0, 80)) : ''}">${collapsed ? '▸' : '▾'}</button>`
      : '<span class="project-tree-toggle-spacer"></span>';
    const rowInner = `<div class="project-item project-item-depth ${depth > 0 ? 'subproject' : ''} ${sameId(currentProjectId, proj.id) ? 'active' : ''}" style="padding-left:${8 + pad}px;--project-color:${proj.color}" data-project-id="${proj.id}" data-depth="${depth}" data-project-color="${proj.color}" onclick="selectProject(${projIdArg})">
      <div class="project-item-row-head">
        ${toggleBtn}
        <div class="project-item-row-body">
          <div class="project-item-name">${escapeChatHtml(proj.name)}${subCount ? `<span style="font-size:10px;opacity:0.75;margin-left:6px">· ${subCount} sub</span>` : ''}</div>
          <div class="project-item-meta">
            <span>${statusLabels[proj.status]}</span>
            <span>${done}/${total} tareas${projectUserFilter !== null ? ' asignadas' : ''}</span>
          </div>
        </div>
      </div>
    </div>`;
    let childrenInner = '';
    childs.forEach(c => { childrenInner += rowHtml(c, depth + 1); });
    const childrenWrap = subCount
      ? `<div class="project-tree-children${collapsed ? ' is-collapsed' : ''}" role="group" aria-label="Subproyectos">${childrenInner}</div>`
      : '';
    return `<div class="project-tree-node" data-tree-pid="${proj.id}">${rowInner}${childrenWrap}</div>`;
  }

  let treeHtml = '';
  roots.forEach(r => { treeHtml += rowHtml(r, 0); });

  document.getElementById('projects-count').textContent = String(visibleProjects.length);

  list.innerHTML = treeHtml.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🎯</div><div>${projectUserFilter !== null ? 'Sin proyectos con esas asignaciones en el árbol' : 'Sin proyectos aún'}</div></div>`
    : treeHtml;

  if (currentProjectId && visibleProjects.find(pr => sameId(pr.id, currentProjectId))) {
    selectProject(currentProjectId);
  } else if (visibleProjects.length === 0) {
    document.getElementById('project-detail').innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div>Selecciona un proyecto para ver sus detalles</div></div>`;
  }
}

function renderTasksList(p) {
  if (p.tasks.length === 0) {
    return `<div class="empty-state" style="padding:20px"><div>Sin tareas aún</div></div>`;
  }
  return p.tasks.map(t => {
    const assignee = USERS.find(u => u.id === t.assigneeId);
    const isFiltered = projectUserFilter !== null && t.assigneeId !== projectUserFilter;
    const taskComments = commentIndicators('task', p.id, t.id);
    return `<div class="task-item" data-task-id="${t.id}" style="${isFiltered ? 'opacity:0.35;' : ''}">
      <div class="task-check ${t.done?'done':''}" onclick="quickToggleTask(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)},this)">${t.done?'✓':''}</div>
      <span class="task-name ${t.done?'done':''}" style="cursor:pointer"
        onclick="openTaskViewer(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)})">
        <span>${t.name}${taskComments}${t.desc ? ' <span style="font-size:9px;opacity:0.85">📄</span>' : ''}</span>
      </span>
      ${t.priority!=='normal'?`<span class="task-priority ${t.priority}">${t.priority}</span>`:''}
      ${t.dueDate ? `<span class="task-due ${new Date(t.dueDate+'T12:00:00') < new Date() && !t.done ? 'task-due-overdue' : ''}">${t.dueDate}</span>` : ''}
      ${assignee?`<span class="task-assignee" style="display:flex;align-items:center;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:${assignee.color};display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:var(--accent-text-on-bg)">${assignee.initials}</div>${assignee.name}</span>`:''}
      <button type="button" class="task-comment-btn" onclick="event.stopPropagation();openTaskCommentsModal(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)})" title="Comentarios">💬</button>
      <button class="task-edit-btn" onclick="event.stopPropagation();openEditTaskModal(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)})" title="Editar">✏️</button>
      <button class="task-delete-btn" onclick="deleteTask(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)})">✕</button>
    </div>`;
  }).join('');
}

function renderTasksKanban(p) {
  const columns = [
    { id: 'pending',     label: 'Pendiente',    filter: t => !t.done && t.status !== 'progress' },
    { id: 'progress',    label: 'En progreso',  filter: t => !t.done && t.status === 'progress' },
    { id: 'done',        label: 'Completado',   filter: t => t.done },
  ];

  return `<div class="kanban-board">
    ${columns.map(col => {
      const tasks = p.tasks.filter(col.filter);
      return `<div class="kanban-col" data-col="${col.id}"
        ondragover="event.preventDefault()"
        ondrop="dropTaskToColumn(event,'${col.id}',${toOnclickStringArg(p.id)})">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${col.label}</span>
          <span class="kanban-col-count">${tasks.length}</span>
        </div>
        <div class="kanban-col-body">
          ${tasks.length === 0
            ? `<div class="kanban-empty">Sin tareas</div>`
            : tasks.map(t => {
                const assignee = USERS.find(u => u.id === t.assigneeId);
                const pid = toOnclickStringArg(p.id);
                const tid = toOnclickStringArg(t.id);
                return `<div class="kanban-card" 
                  draggable="true"
                  ondragstart="dragTaskStart(event,${tid},${pid})"
                  onclick="openTaskViewer(${pid},${tid})">
                  <div class="kanban-card-name">${escapeChatHtml(t.name)}</div>
                  ${t.priority !== 'normal' ? `<span class="task-priority ${t.priority}" style="font-size:9px">${t.priority}</span>` : ''}
                  ${t.dueDate ? `<div class="kanban-card-due ${new Date(t.dueDate+'T12:00:00') < new Date() && !t.done ? 'overdue' : ''}">${t.dueDate}</div>` : ''}
                  <div class="kanban-card-footer">
                    ${assignee ? `<div class="kanban-avatar" style="background:${assignee.color}" title="${escapeChatHtml(assignee.name)}">${assignee.initials}</div>` : ''}
                    <button onclick="event.stopPropagation();quickToggleTask(${pid},${tid},this)" 
                      class="kanban-check ${t.done?'done':''}" title="${t.done?'Marcar pendiente':'Marcar completado'}">${t.done?'✓':'○'}</button>
                  </div>
                </div>`;
              }).join('')
          }
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

let _viewerProjectId = null;
let _viewerTaskId = null;

export function openTaskViewer(projectId, taskId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) return;
  const t = p.tasks.find(tk => sameId(tk.id, taskId));
  if (!t) return;

  _viewerProjectId = projectId;
  _viewerTaskId = taskId;

  const assignee = USERS.find(u => sameId(u.id, t.assigneeId));
  const priorityLabels = { alta: 'Alta', media: 'Media', normal: 'Normal', baja: 'Baja' };

  const isOverdue = t.dueDate && new Date(t.dueDate + 'T12:00:00') < new Date() && !t.done;

  document.getElementById('task-viewer-title').textContent = t.name;

  const dot = document.getElementById('task-viewer-status-dot');
  dot.style.cssText = `width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${t.done ? 'var(--success)' : t.status === 'progress' ? 'var(--accent2)' : 'var(--text-muted)'}`;

  const taskCommentCount = comments.filter(c => c.kind === 'task' && sameId(c.targetId, projectId) && sameId(c.extraId, taskId)).length;
  document.getElementById('task-viewer-badges').innerHTML = `
    ${t.done
      ? `<span style="background:rgba(52,211,153,0.15);color:rgba(52,211,153,0.9);border:1px solid rgba(52,211,153,0.25);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.03em">✓ Completada</span>`
      : t.status === 'progress'
        ? `<span style="background:rgba(251,191,36,0.12);color:rgba(255,210,60,0.9);border:1px solid rgba(251,191,36,0.22);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.03em">⏳ En progreso</span>`
        : `<span style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.1);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.03em">○ Pendiente</span>`
    }
    ${t.priority && t.priority !== 'normal'
      ? `<span style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.03em;${
          t.priority === 'alta' ? 'background:rgba(239,68,68,0.15);color:rgba(255,120,120,0.95);border:1px solid rgba(239,68,68,0.25)' :
          t.priority === 'media' ? 'background:rgba(251,191,36,0.12);color:rgba(255,210,60,0.95);border:1px solid rgba(251,191,36,0.22)' :
          'background:rgba(52,211,153,0.1);color:rgba(52,211,153,0.85);border:1px solid rgba(52,211,153,0.2)'
        }">⚑ ${priorityLabels[t.priority]}</span>`
      : ''
    }
    ${isOverdue ? `<span style="background:rgba(239,68,68,0.15);color:rgba(255,100,100,0.9);border:1px solid rgba(239,68,68,0.25);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px">⚠ Vencida</span>` : ''}
    ${taskCommentCount > 0 ? `<span style="font-size:10px;color:rgba(255,255,255,0.3)">💬 ${taskCommentCount} comentario${taskCommentCount !== 1 ? 's' : ''}</span>` : ''}
  `;

  const descWrap = document.getElementById('task-viewer-desc-wrap');
  if (t.desc) {
    descWrap.style.display = 'block';
    document.getElementById('task-viewer-desc').innerHTML = renderMarkdown(t.desc, t.images || {});
  } else {
    descWrap.style.display = 'none';
  }

  const metaItems = [];
  if (assignee) {
    metaItems.push(`
      <div class="task-viewer-meta-item">
        <div class="task-viewer-meta-label">Asignado a</div>
        <div class="task-viewer-meta-value" style="display:flex;align-items:center;gap:6px">
          <div style="width:20px;height:20px;border-radius:50%;background:${assignee.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:white">${assignee.initials}</div>
          ${escapeChatHtml(assignee.name)}
        </div>
      </div>`);
  }
  if (t.dueDate) {
    metaItems.push(`
      <div class="task-viewer-meta-item">
        <div class="task-viewer-meta-label">Fecha límite</div>
        <div class="task-viewer-meta-value ${isOverdue ? 'task-due-overdue' : ''}">${t.dueDate}</div>
      </div>`);
  }

  document.getElementById('task-viewer-meta').innerHTML = metaItems.join('');
  document.getElementById('task-viewer-project-dot').style.background = p.color;
  document.getElementById('task-viewer-project-name').textContent = p.name;

  const taskComments = comments
    .filter(c => c.kind === 'task' && sameId(c.targetId, projectId) && sameId(c.extraId, taskId))
    .slice(-3);
  const commentsWrap = document.getElementById('task-viewer-comments-wrap');
  if (taskComments.length > 0) {
    commentsWrap.style.display = 'block';
    document.getElementById('task-viewer-comments').innerHTML = taskComments.map(c => {
      const author = USERS.find(u => sameId(u.id, c.authorId));
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);margin-bottom:4px">
      <div style="width:24px;height:24px;border-radius:50%;background:${author?.color || 'rgba(120,100,255,0.4)'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;flex-shrink:0">${author?.initials || '?'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:3px">${author ? escapeChatHtml(author.name) : 'Anónimo'}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.75);line-height:1.5;word-break:break-word">${escapeChatHtml(c.body || '')}</div>
      </div>
    </div>`;
    }).join('');
  } else {
    commentsWrap.style.display = 'none';
  }

  openModal('task-viewer-modal');
}

export function openEditFromViewer() {
  if (!_viewerProjectId || !_viewerTaskId) return;
  closeModal('task-viewer-modal');
  openEditTaskModal(_viewerProjectId, _viewerTaskId);
}

export function openTaskCommentsFromViewer() {
  if (!_viewerProjectId || !_viewerTaskId) return;
  closeModal('task-viewer-modal');
  if (typeof window.openTaskCommentsModal === 'function') {
    window.openTaskCommentsModal(_viewerProjectId, _viewerTaskId);
  }
}

export function setProjectViewMode(mode, projectId) {
  window._projectViewMode = mode;
  selectProject(projectId);
}

let _dragTaskId = null;
let _dragProjectId = null;

export function dragTaskStart(event, taskId, projectId) {
  _dragTaskId = taskId;
  _dragProjectId = projectId;
  event.dataTransfer.effectAllowed = 'move';
}

export function dropTaskToColumn(event, colId, projectId) {
  event.preventDefault();
  if (!_dragTaskId || !_dragProjectId) return;
  const p = projects.find(pr => sameId(pr.id, _dragProjectId));
  if (!p) return;
  const task = p.tasks.find(t => sameId(t.id, _dragTaskId));
  if (!task) return;

  if (colId === 'done') {
    task.done = true;
    task.status = 'done';
  } else if (colId === 'progress') {
    task.done = false;
    task.status = 'progress';
  } else {
    task.done = false;
    task.status = 'pending';
    delete task.status;
  }

  _dragTaskId = null;
  _dragProjectId = null;
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

export function selectProject(id) {
  setCurrentProjectId(id);
  const p = projects.find(pr => sameId(pr.id, id));
  if (!p) return;

  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.project-item[data-project-id="${id}"]`);
  if (active) active.classList.add('active');

  const done = p.tasks.filter(t => t.done).length;
  const total = p.tasks.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const statusColors = {activo:'var(--success)',pausa:'var(--accent2)',completado:'var(--accent)'};
  const statusLabels = {activo:'✅ Activo',pausa:'⏸ En Pausa',completado:'🏁 Completado'};

  const childProjects = projects.filter(c => sameId(c.parentProjectId, p.id) && userCanSeeProject(c)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const crumbs = [];
  let walk = p;
  let guard = 0;
  while (walk && guard++ < 32) {
    crumbs.unshift(walk);
    if (!walk.parentProjectId) break;
    walk = projects.find(x => sameId(x.id, walk.parentProjectId));
  }
  const crumbHtml = crumbs.length > 1
    ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;display:flex;flex-wrap:wrap;align-items:center;gap:4px">${crumbs.slice(0, -1).map(c => `<button type="button" class="btn-secondary" style="font-size:10px;padding:3px 8px" onclick="event.stopPropagation();selectProject(${toOnclickStringArg(c.id)})">${escapeChatHtml(c.name)}</button><span style="opacity:0.45;font-size:10px">▸</span>`).join('')}<span style="font-size:10px;font-weight:700;color:var(--accent)">Nivel ${crumbs.length}</span></div>`
    : '';
  const subprojectsBlock = `<div style="margin-top:var(--space-6)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);flex-wrap:wrap;gap:8px">
      <h4 style="font-size:12px;color:var(--text-dim);margin:0">Subproyectos${childProjects.length ? ` (${childProjects.length})` : ''}</h4>
      <button type="button" class="btn-primary" style="font-size:11px;padding:5px 12px" onclick="event.stopPropagation();openNewProjectModal(${toOnclickStringArg(p.id)})">+ Subproyecto</button>
    </div>
    ${childProjects.length === 0
      ? `<p style="font-size:11px;color:var(--text-muted);margin:0">Sin subproyectos. Puedes anidar varios niveles para organizar el trabajo.</p>`
      : `<div style="display:flex;flex-direction:column;gap:var(--space-1)">${childProjects.map(c => `<button type="button" class="btn-secondary btn-subproject-row" style="text-align:left;font-size:12px" onclick="event.stopPropagation();selectProject(${toOnclickStringArg(c.id)})">${escapeChatHtml(c.name)} <span style="opacity:0.55;font-size:10px">Abrir →</span></button>`).join('')}</div>`}
  </div>`;

  document.getElementById('project-detail').innerHTML = `
    <div class="project-header-detail">
      <div class="project-color-dot" style="--project-color:${p.color};background:var(--project-color)"></div>
      <div class="project-title-area">
        ${crumbHtml}
        <h2>${escapeChatHtml(p.name)}</h2>
        <div class="project-desc">${p.desc ? renderMarkdown(p.desc, p.images || {}) : ''}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="project-badge project-badge-status" style="--badge-color:${statusColors[p.status]}">${statusLabels[p.status]}</span>
        <button type="button" class="btn-secondary" onclick="openEditProjectModal(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px">✏️ Editar</button>
        <button type="button" class="btn-secondary btn-secondary-danger" onclick="deleteProject(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px">🗑</button>
      </div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:8px">
        <span>Progreso</span><span>${pct}% (${done}/${total})</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="tasks-section">
      <div class="tasks-section-header">
        <h4>Tareas</h4>
        <div style="display:flex;gap:6px;align-items:center">
          <div class="view-toggle">
            <button class="view-toggle-btn ${window._projectViewMode !== 'kanban' ? 'active' : ''}" 
              onclick="setProjectViewMode('list',${toOnclickStringArg(p.id)})" title="Vista lista">≡</button>
            <button class="view-toggle-btn ${window._projectViewMode === 'kanban' ? 'active' : ''}" 
              onclick="setProjectViewMode('kanban',${toOnclickStringArg(p.id)})" title="Vista Kanban">⊞</button>
          </div>
          <button class="btn-primary" onclick="openAddTaskModal(${toOnclickStringArg(p.id)})" style="font-size:11px;padding:5px 12px">+ Tarea</button>
        </div>
      </div>
      ${window._projectViewMode === 'kanban' ? renderTasksKanban(p) : renderTasksList(p)}
    </div>
    ${subprojectsBlock}
    <div style="margin-top:var(--space-6)">
      <button type="button" class="btn-secondary btn-full-width" onclick="openProjectCommentsModal(${toOnclickStringArg(p.id)})">💬 Comentarios del proyecto${comments.filter(c=>c.kind==='project'&&sameId(c.targetId,p.id)).length ? ' ('+comments.filter(c=>c.kind==='project'&&sameId(c.targetId,p.id)).length+')' : ''}</button>
    </div>
  `;
}

export function openNewProjectModal(parentProjectId) {
  setEditingProjectId(null);
  setEditingProjectImages({});
  document.getElementById('project-modal-title').textContent = parentProjectId != null ? 'Nuevo subproyecto' : 'Nuevo Proyecto';
  const parObj = parentProjectId != null ? projects.find(p => sameId(p.id, parentProjectId)) : null;
  fillProjectParentSelect({
    editingId: null,
    selectedParentId: parentProjectId != null ? parentProjectId : null,
    impliedGroup: parObj ? parObj.group : currentUser.group,
  });
  document.getElementById('project-name-input').value = '';
  document.getElementById('project-desc-input').value = '';
  document.getElementById('project-desc-preview').innerHTML = '';
  document.getElementById('project-color-input').value = '#e8c547';
  document.getElementById('project-status-input').value = 'activo';
  fillCollabTargetSelect('project-collab-target-select');
  const pts = document.getElementById('project-collab-target-select');
  const pps = document.getElementById('project-collab-permission-select');
  if (pts) pts.value = '_none';
  if (pps) pps.value = 'read';
  openModal('project-modal');
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => {
      const parentRows = getProjectParentSelectAuroraRows({
        editingId: null,
        impliedGroup: parObj ? parObj.group : currentUser.group,
      });
      createCustomSelect('project-parent-select', '#project-modal', { projectParentAuroraRows: parentRows });
      createCustomSelect('project-collab-target-select', '#project-modal');
      createCustomSelect('project-collab-permission-select', '#project-modal');
      createCustomSelect('project-status-input', '#project-modal');
    }, 0);
  }
}

export function openEditProjectModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p || !userCanSeeProject(p)) return;
  setEditingProjectId(id);
  setEditingProjectImages({...(p.images || {})});
  fillProjectParentSelect({ editingId: id, selectedParentId: p.parentProjectId });
  document.getElementById('project-modal-title').textContent = 'Editar Proyecto';
  document.getElementById('project-name-input').value = p.name;
  document.getElementById('project-desc-input').value = p.desc || '';
  document.getElementById('project-desc-preview').innerHTML = p.desc ? renderMarkdown(p.desc, editingProjectImages) : '';
  document.getElementById('project-color-input').value = p.color || '#e8c547';
  document.getElementById('project-status-input').value = p.status || 'activo';
  fillCollabTargetSelect('project-collab-target-select');
  const sh = (p.shares || []).find(s => s.type === 'dept' || s.type === 'workgroup');
  const pts = document.getElementById('project-collab-target-select');
  const pps = document.getElementById('project-collab-permission-select');
  if (pts) {
    pts.value = '_none';
    if (sh) {
      if (sh.type === 'dept') pts.value = 'dept:' + sh.deptName;
      if (sh.type === 'workgroup') pts.value = 'wg:' + sh.workGroupId;
    }
  }
  if (pps) pps.value = (sh && sh.permission) ? sh.permission : 'read';
  openModal('project-modal');
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => {
      const parentRows = getProjectParentSelectAuroraRows({ editingId: id });
      createCustomSelect('project-parent-select', '#project-modal', { projectParentAuroraRows: parentRows });
      createCustomSelect('project-collab-target-select', '#project-modal');
      createCustomSelect('project-collab-permission-select', '#project-modal');
      createCustomSelect('project-status-input', '#project-modal');
    }, 0);
  }
}

export function userCanSeeProject(p, visited) {
  visited = visited || new Set();
  if (!p || !currentUser) return false;
  if (visited.has(p.id)) return false;
  visited.add(p.id);
  if (sameId(p.createdById, currentUser.id)) return true;
  if (p.group === currentUser.group) return true;
  if (shareMatchesUser(p.shares || [])) return true;
  if (p.parentProjectId) {
    const par = projects.find(x => sameId(x.id, p.parentProjectId));
    if (par) return userCanSeeProject(par, visited);
  }
  return false;
}

export function collectDescendantProjectIds(rootId, acc) {
  projects.filter(c => sameId(c.parentProjectId, rootId)).forEach(c => {
    acc.add(c.id);
    collectDescendantProjectIds(c.id, acc);
  });
}

export function projectSubtreeHasAssignee(p, userId, seen) {
  seen = seen || new Set();
  if (!p || seen.has(p.id)) return false;
  seen.add(p.id);
  if ((p.tasks || []).some(t => sameId(t.assigneeId, userId))) return true;
  return projects.filter(c => sameId(c.parentProjectId, p.id)).some(c => userCanSeeProject(c) && projectSubtreeHasAssignee(c, userId, seen));
}

export function saveProject() {
  const name = document.getElementById('project-name-input').value.trim();
  if (!name) { showToast('El nombre es requerido','error'); return; }
  const desc = document.getElementById('project-desc-input').value.trim();
  const prev = editingProjectId ? projects.find(p => p.id === editingProjectId) : null;
  const baseImg = prev?.images || {};
  const images = collectImageMap(desc, {...baseImg, ...editingProjectImages});
  const addSh = buildSharesFromCollabSelect('project-collab-target-select', 'project-collab-permission-select');
  if (editingProjectId) {
    const idx = projects.findIndex(p => p.id === editingProjectId && userCanSeeProject(p));
    if (idx === -1) { showToast('No autorizado','error'); return; }
    const old = projects[idx].shares || [];
    const rest = old.filter(s => s.type !== 'dept' && s.type !== 'workgroup');
    const pSel = document.getElementById('project-parent-select');
    let newParentId = null;
    if (pSel && pSel.value !== '_root') {
      const v = pSel.value;
      const n = Number(v);
      newParentId = Number.isFinite(n) && String(n) === String(v) ? n : v;
    }
    if (!validateProjectReparent(editingProjectId, newParentId)) {
      showToast('Proyecto padre no válido: no puede ser el propio proyecto ni un descendiente.', 'error');
      return;
    }
    const oldG = projects[idx].group;
    let newG = projects[idx].group;
    if (newParentId != null) {
      const par = projects.find(x => sameId(x.id, newParentId));
      if (!par) { showToast('Proyecto padre no encontrado', 'error'); return; }
      newG = par.group;
    }
    projects[idx] = {
      ...projects[idx],
      name,
      desc,
      images,
      color: document.getElementById('project-color-input').value,
      status: document.getElementById('project-status-input').value,
      shares: [...rest, ...addSh],
      parentProjectId: newParentId,
      group: newG,
    };
    if (oldG !== newG) cascadeProjectGroupToDescendants(editingProjectId, newG);
    saveProjectData();
    closeModal('project-modal');
    renderProjects();
    selectProject(editingProjectId);
    showToast('Proyecto actualizado','success');
    return;
  }
  const pSelNew = document.getElementById('project-parent-select');
  let newParentIdRoot = null;
  if (pSelNew && pSelNew.value !== '_root') {
    const v = pSelNew.value;
    const n = Number(v);
    newParentIdRoot = Number.isFinite(n) && String(n) === String(v) ? n : v;
  }
  const par = newParentIdRoot != null ? projects.find(x => sameId(x.id, newParentIdRoot)) : null;
  if (pSelNew && pSelNew.value !== '_root' && !par) { showToast('Proyecto padre no encontrado', 'error'); return; }
  const newId = Date.now();
  projects.push({
    id: newId,
    name,
    group: par ? par.group : currentUser.group,
    parentProjectId: par ? par.id : null,
    desc,
    images,
    color:document.getElementById('project-color-input').value,
    status:document.getElementById('project-status-input').value,
    tasks:[],
    createdById: currentUser.id,
    shares: addSh,
  });
  saveProjectData();
  closeModal('project-modal');
  renderProjects();
  selectProject(newId);
  showToast(par ? 'Subproyecto creado' : 'Proyecto creado','success');
}

export function deleteProject(id) {
  const p = projects.find(x => sameId(x.id, id));
  const nameSafe = p ? escapeChatHtml(p.name) : 'este proyecto';
  showConfirmModal({
    icon: '🗑',
    title: 'Eliminar proyecto',
    destructive: true,
    confirmLabel: 'Sí, eliminar todo',
    messageHtml: `<p class="confirm-modal-lead">Vas a eliminar <strong>${nameSafe}</strong> junto con <strong>todos sus subproyectos</strong> y <strong>todas las tareas</strong> del árbol. Esta acción <strong>no se puede deshacer</strong>.</p>`,
    onConfirm: () => executeDeleteProjectTree(id),
  });
}

export function executeDeleteProjectTree(id) {
  const kill = new Set();
  kill.add(id);
  collectDescendantProjectIds(id, kill);
  setProjects(projects.filter(p => !kill.has(p.id)));
  if (currentProjectId != null && [...kill].some(pid => sameId(pid, currentProjectId))) setCurrentProjectId(null);
  [...kill].forEach(k => getProjectTreeCollapsedSet().delete(String(k)));
  saveProjectTreeCollapsedSet();
  saveProjectData();
  renderProjects();
  document.getElementById('project-detail').innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div>Selecciona un proyecto</div></div>`;
  showToast('Proyecto eliminado', 'info');
}

export function openAddTaskModal(projectId) {
  setCurrentProjectId(projectId);
  setEditingTaskId(null);
  setEditingTaskImages({});
  document.getElementById('task-name-input').value = '';
  document.getElementById('task-desc-input').value = '';
  document.getElementById('task-desc-preview').innerHTML = '';
  document.getElementById('task-priority-input').value = 'normal';
  document.getElementById('task-due-date').value = '';
  fillCollabTargetSelect('task-collab-target-select');
  const tts = document.getElementById('task-collab-target-select');
  const tps = document.getElementById('task-collab-permission-select');
  if (tts) tts.value = '_none';
  if (tps) tps.value = 'read';
  const sel = document.getElementById('task-assignee-input');
  sel.innerHTML = `<option value="">Sin asignar</option>` + USERS.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  document.getElementById('task-modal-title').textContent = 'Nueva Tarea';
  openModal('task-modal');
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => {
      createCustomSelect('task-collab-target-select', '#task-modal');
      createCustomSelect('task-collab-permission-select', '#task-modal');
      createCustomSelect('task-assignee-input', '#task-modal');
      createCustomSelect('task-priority-input', '#task-modal');
    }, 0);
  }
}

export function openEditTaskModal(projectId, taskId) {
  const p = projects.find(pr => pr.id === projectId);
  if (!p || !userCanSeeProject(p)) return;
  const t = p.tasks.find(x => sameId(x.id, taskId));
  if (!t) return;
  setCurrentProjectId(projectId);
  setEditingTaskId(taskId);
  setEditingTaskImages({...(t.images || {})});
  document.getElementById('task-modal-title').textContent = 'Editar Tarea';
  document.getElementById('task-name-input').value = t.name;
  document.getElementById('task-desc-input').value = t.desc || '';
  document.getElementById('task-desc-preview').innerHTML = t.desc ? renderMarkdown(t.desc, editingTaskImages) : '';
  document.getElementById('task-priority-input').value = t.priority || 'normal';
  document.getElementById('task-due-date').value = t.dueDate || '';
  fillCollabTargetSelect('task-collab-target-select');
  const sh = (t.shares || []).find(s => s.type === 'dept' || s.type === 'workgroup');
  const tts = document.getElementById('task-collab-target-select');
  const tps = document.getElementById('task-collab-permission-select');
  if (tts) {
    tts.value = '_none';
    if (sh) {
      if (sh.type === 'dept') tts.value = 'dept:' + sh.deptName;
      if (sh.type === 'workgroup') tts.value = 'wg:' + sh.workGroupId;
    }
  }
  if (tps) tps.value = (sh && sh.permission) ? sh.permission : 'read';
  const sel = document.getElementById('task-assignee-input');
  sel.innerHTML = `<option value="">Sin asignar</option>` + USERS.map(u => `<option value="${u.id}" ${t.assigneeId === u.id ? 'selected' : ''}>${u.name}</option>`).join('');
  openModal('task-modal');
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => {
      createCustomSelect('task-collab-target-select', '#task-modal');
      createCustomSelect('task-collab-permission-select', '#task-modal');
      createCustomSelect('task-assignee-input', '#task-modal');
      createCustomSelect('task-priority-input', '#task-modal');
    }, 0);
  }
}

export function saveTask() {
  const name = document.getElementById('task-name-input').value.trim();
  if (!name) { showToast('El nombre es requerido','error'); return; }
  const p = projects.find(pr => pr.id === currentProjectId);
  if (!p) return;
  const desc = document.getElementById('task-desc-input').value.trim();
  const prev = editingTaskId ? p.tasks.find(t => t.id === editingTaskId) : null;
  const baseImg = prev?.images || {};
  const images = collectImageMap(desc, {...baseImg, ...editingTaskImages});
  const addSh = buildSharesFromCollabSelect('task-collab-target-select', 'task-collab-permission-select');
  const assigneeId = parseInt(document.getElementById('task-assignee-input').value) || null;
  const priority = document.getElementById('task-priority-input').value;
  const dueDate = document.getElementById('task-due-date').value || null;

  if (editingTaskId) {
    const t = p.tasks.find(x => x.id === editingTaskId);
    if (!t) return;
    const old = t.shares || [];
    const rest = old.filter(s => s.type !== 'dept' && s.type !== 'workgroup');
    Object.assign(t, { name, desc, images, assigneeId, priority, dueDate, shares: [...rest, ...addSh] });
    showToast('Tarea actualizada','success');
  } else {
    p.tasks.push({id:Date.now(),name,desc,done:false,assigneeId,priority,dueDate,images,shares:addSh});
    showToast('Tarea añadida','success');
  }
  saveProjectData();
  closeModal('task-modal');
  setEditingTaskId(null);
  selectProject(currentProjectId);
  renderProjects();
}

export function quickToggleTask(projectId, taskId, el) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) return;
  const t = p.tasks.find(x => sameId(x.id, taskId));
  if (!t) return;
  t.done = !t.done;
  saveProjectData();
  el.classList.toggle('done', t.done);
  if (el.classList.contains('kanban-check')) {
    el.textContent = t.done ? '✓' : '○';
  } else {
    el.textContent = t.done ? '✓' : '';
  }
  const card = el.closest('.kanban-card');
  const nameEl = card ? card.querySelector('.kanban-card-name') : el.nextElementSibling;
  if (nameEl) nameEl.classList.toggle('done', t.done);
  const allTasks = p.tasks;
  const done = allTasks.filter(t => t.done).length;
  const total = allTasks.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const fill = document.querySelector('#project-detail .progress-fill');
  if (fill) fill.style.width = pct + '%';
  const projItem = document.querySelector(`.project-item[data-project-id="${projectId}"] .project-item-meta span:last-child`);
  if (projItem) projItem.textContent = `${done}/${total} tareas`;
  if (window._projectViewMode === 'kanban') {
    selectProject(projectId);
  }
}

export function toggleTask(projectId, taskId) {
  const p = projects.find(pr => pr.id === projectId);
  if (!p) return;
  const t = p.tasks.find(t => t.id === taskId);
  if (t) t.done = !t.done;
  saveProjectData();
  selectProject(projectId);
  renderProjects();
}

export function deleteTask(projectId, taskId) {
  const p = projects.find(pr => pr.id === projectId);
  if (!p) return;
  const task = p.tasks.find(t => sameId(t.id, taskId));
  showConfirmModal({
    icon: '✓',
    title: '¿Eliminar esta tarea?',
    message: task ? `Se eliminará "${task.name}" y todos sus comentarios.` : 'Se eliminará la tarea.',
    onConfirm: () => {
      p.tasks = p.tasks.filter(t => !sameId(t.id, taskId));
      saveProjectData();
      selectProject(projectId);
      renderProjects();
      showToast('Tarea eliminada','info');
    }
  });
}

export function saveProjectData() {
  localStorage.setItem('diario_projects', JSON.stringify(projects));
}
