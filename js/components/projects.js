// ===== PROJECTS MODULE =====

import { USERS, projects, currentUser, currentProjectId, projectUserFilter, editingProjectId, editingTaskId, editingProjectImages, editingTaskImages, comments, workGroups, GROUPS, collectImageMap, setProjects, setCurrentProjectId, setEditingProjectId, setEditingTaskId, setEditingProjectImages, setEditingTaskImages, setProjectUserFilter as setProjectUserFilterState } from './data.js';
import { showToast, openModal, closeModal, showConfirmModal, escapeChatHtml } from './modalControl.js';
import { renderMarkdown, fillCollabTargetSelect, buildSharesFromCollabSelect } from './notes.js';
import { createCustomSelect } from './auroraCustomSelect.js';
import { commentIndicators, getLatestCommentPreview } from './docs.js';
import { sameId } from './data.js';

/** Plantillas al crear proyecto nuevo (id vacío = sin plantilla). */
export const PROJECT_TASK_TEMPLATES = [
  {
    id: '',
    name: '— Sin plantilla —',
    description: '',
    tasks: [],
  },
  {
    id: 'migracion',
    name: 'Migración / despliegue',
    description: 'Checklist típico de cambio en producción.',
    tasks: [
      { name: 'Inventario y alcance del cambio' },
      { name: 'Plan de rollback y ventana autorizada' },
      { name: 'Pruebas en entorno de pruebas' },
      { name: 'Comunicación a usuarios o áreas afectadas' },
      { name: 'Ejecución y verificación post-cambio' },
      { name: 'Actualizar documentación y cerrar cambio' },
    ],
  },
  {
    id: 'revision',
    name: 'Revisión / mantenimiento',
    description: 'Pasos para una revisión periódica de sistemas.',
    tasks: [
      { name: 'Comprobar backups y política de retención' },
      { name: 'Revisar espacio en disco y rotación de logs' },
      { name: 'Actualizaciones de seguridad pendientes' },
      { name: 'Registrar hallazgos y cerrar revisión' },
    ],
  },
  {
    id: 'incidencia',
    name: 'Incidencia / soporte',
    description: 'Flujo básico de gestión de incidencia.',
    tasks: [
      { name: 'Registrar síntomas y alcance' },
      { name: 'Clasificar prioridad e impacto' },
      { name: 'Diagnóstico y plan de acción' },
      { name: 'Resolución y prueba con usuario' },
      { name: 'Cierre: causa raíz y prevención' },
    ],
  },
];

const CUSTOM_PROJECT_TEMPLATES_STORAGE_KEY = 'diario_project_custom_templates';
const MAX_CUSTOM_PROJECT_TEMPLATES = 30;

function loadCustomProjectTemplates() {
  try {
    const raw = localStorage.getItem(CUSTOM_PROJECT_TEMPLATES_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      x =>
        x &&
        typeof x.id === 'string' &&
        x.id.startsWith('custom_') &&
        typeof x.name === 'string' &&
        Array.isArray(x.tasks),
    );
  } catch {
    return [];
  }
}

function saveCustomProjectTemplates(list) {
  localStorage.setItem(CUSTOM_PROJECT_TEMPLATES_STORAGE_KEY, JSON.stringify(list));
}

/** Para incluir en «Exportar todo» (misma forma que en localStorage). */
export function getProjectCustomTemplatesForBackup() {
  return loadCustomProjectTemplates();
}

/**
 * Sustituye plantillas personalizadas desde un backup.
 * @returns {number} cantidad guardada, o -1 si `list === undefined` (no tocar almacén)
 */
export function replaceProjectCustomTemplatesFromBackup(list) {
  if (list === undefined) return -1;
  if (!Array.isArray(list)) {
    saveCustomProjectTemplates([]);
    return 0;
  }
  const valid = list.filter(
    x =>
      x &&
      typeof x.id === 'string' &&
      x.id.startsWith('custom_') &&
      typeof x.name === 'string' &&
      Array.isArray(x.tasks),
  );
  const capped = valid.slice(0, MAX_CUSTOM_PROJECT_TEMPLATES);
  saveCustomProjectTemplates(capped);
  return capped.length;
}

/** Serializa tareas para plantilla: sin asignación, dependencias, imágenes ni compartidos. */
function serializeProjectTasksForTemplate(p) {
  const tasks = p.tasks || [];
  return tasks
    .map(t => {
      const def = {
        name: (t.name || '').trim(),
        desc: t.desc || '',
        priority: t.priority || 'normal',
        dueDate: t.dueDate || null,
        estimatedHours: t.estimatedHours ?? null,
      };
      if (t.status === 'progress') def.status = 'progress';
      return def;
    })
    .filter(def => def.name.length > 0);
}

function getProjectTaskTemplateById(templateId) {
  const built = PROJECT_TASK_TEMPLATES.find(t => t.id === templateId);
  if (built) return built;
  const c = loadCustomProjectTemplates().find(t => sameId(t.id, templateId));
  if (c) {
    return {
      id: c.id,
      name: c.name,
      description: c.description || '',
      tasks: Array.isArray(c.tasks) ? c.tasks : [],
    };
  }
  return PROJECT_TASK_TEMPLATES[0];
}

function taskFromTemplateDef(def, taskId) {
  return {
    id: taskId,
    name: def.name,
    desc: def.desc || '',
    done: false,
    status: def.status === 'progress' ? 'progress' : undefined,
    assigneeId: def.assigneeId != null ? def.assigneeId : null,
    priority: def.priority || 'normal',
    dueDate: def.dueDate || null,
    estimatedHours: def.estimatedHours ?? null,
    realHours: null,
    images: {},
    blockedBy: [],
    shares: [],
  };
}

function buildTasksFromTemplate(templateTaskDefs, projectId) {
  if (!templateTaskDefs || !templateTaskDefs.length) return [];
  const base = Number(projectId);
  const numericBase = Number.isFinite(base) ? base : Date.now();
  return templateTaskDefs.map((def, i) => taskFromTemplateDef(def, numericBase + i + 1));
}

/** Plantillas con al menos una tarea (para aplicar a proyecto existente). */
function fillApplyTemplateToProjectSelect() {
  const sel = document.getElementById('apply-template-to-project-select');
  if (!sel) return false;
  const escAttr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const customs = loadCustomProjectTemplates().filter(t => (t.tasks || []).length > 0);
  let html = '';
  for (const t of PROJECT_TASK_TEMPLATES) {
    if (!t.id || !(t.tasks || []).length) continue;
    html += `<option value="${escAttr(t.id)}">${escapeChatHtml(t.name)} (${(t.tasks || []).length})</option>`;
  }
  if (customs.length) {
    html += '<optgroup label="Mis plantillas">';
    html += customs
      .map(t => {
        const n = (t.tasks || []).length;
        return `<option value="${escAttr(t.id)}">${escapeChatHtml(t.name)} (${n})</option>`;
      })
      .join('');
    html += '</optgroup>';
  }
  sel.innerHTML = html || '<option value="">— No hay plantillas con tareas —</option>';
  return Boolean(html);
}

function fillProjectTemplateSelect() {
  const sel = document.getElementById('project-template-select');
  if (!sel) return;
  const escAttr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const customs = loadCustomProjectTemplates();
  let html = PROJECT_TASK_TEMPLATES.map(
    t => `<option value="${escAttr(t.id)}">${escapeChatHtml(t.name)}</option>`,
  ).join('');
  if (customs.length) {
    html += '<optgroup label="Mis plantillas">';
    html += customs
      .map(t => {
        const n = (t.tasks || []).length;
        const suffix = n ? ` (${n})` : '';
        return `<option value="${escAttr(t.id)}">${escapeChatHtml(t.name)}${suffix}</option>`;
      })
      .join('');
    html += '</optgroup>';
  }
  sel.innerHTML = html;
}

function refreshProjectTemplateSelectIfOpen() {
  const modal = document.getElementById('project-modal');
  if (!modal || !modal.classList.contains('open')) return;
  const grp = document.getElementById('project-template-group');
  if (!grp || grp.style.display === 'none') return;
  fillProjectTemplateSelect();
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => createCustomSelect('project-template-select', '#project-modal'), 0);
  }
}

function renderManageCustomTemplatesList() {
  const wrap = document.getElementById('manage-custom-templates-list');
  if (!wrap) return;
  const list = loadCustomProjectTemplates();
  if (!list.length) {
    wrap.innerHTML =
      '<p style="font-size:12px;color:var(--text-muted);margin:0">No tienes plantillas guardadas. Abre un proyecto y usa «Guardar como plantilla».</p>';
    return;
  }
  wrap.innerHTML = list
    .map(t => {
      const n = (t.tasks || []).length;
      const idArg = toOnclickStringArg(t.id);
      return `<div class="manage-template-row" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:12px 14px;flex-wrap:wrap">
      <div style="min-width:0;flex:1">
        <div class="manage-template-row-name">${escapeChatHtml(t.name)}</div>
        <div class="manage-template-row-meta">${n} tarea(s)</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex-shrink:0">
        <button type="button" class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick='openRenameProjectTemplateModal(${idArg})'>Renombrar</button>
        <button type="button" class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick='duplicateCustomProjectTemplate(${idArg})'>Duplicar</button>
        <button type="button" class="btn-secondary btn-secondary-danger" style="font-size:11px;padding:4px 10px" onclick='deleteCustomProjectTemplate(${idArg})'>Eliminar</button>
      </div>
    </div>`;
    })
    .join('');
}

export function openManageProjectTemplatesModal() {
  renderManageCustomTemplatesList();
  openModal('manage-project-templates-modal');
}

export function deleteCustomProjectTemplate(templateId) {
  const cur = loadCustomProjectTemplates();
  const t = cur.find(x => sameId(x.id, templateId));
  if (!t) return;
  const nameSafe = escapeChatHtml(t.name);
  showConfirmModal({
    icon: '🗑',
    title: 'Eliminar plantilla',
    destructive: true,
    confirmLabel: 'Eliminar',
    messageHtml: `<p class="confirm-modal-lead">Se eliminará la plantilla <strong>${nameSafe}</strong> en este navegador. Los proyectos ya creados no cambian.</p>`,
    onConfirm: () => {
      const next = loadCustomProjectTemplates().filter(x => !sameId(x.id, templateId));
      saveCustomProjectTemplates(next);
      showToast('Plantilla eliminada', 'info');
      renderManageCustomTemplatesList();
      refreshProjectTemplateSelectIfOpen();
    },
  });
}

export function openRenameProjectTemplateModal(templateId) {
  const cur = loadCustomProjectTemplates();
  const t = cur.find(x => sameId(x.id, templateId));
  if (!t) return;
  const modal = document.getElementById('rename-project-template-modal');
  const input = document.getElementById('rename-template-name-input');
  if (!modal || !input) return;
  modal.dataset.templateId = String(t.id);
  input.value = t.name || '';
  openModal('rename-project-template-modal');
  setTimeout(() => input.focus(), 0);
}

export function confirmRenameProjectTemplate() {
  const modal = document.getElementById('rename-project-template-modal');
  const tid = modal?.dataset.templateId;
  const name = document.getElementById('rename-template-name-input')?.value?.trim();
  if (!tid) return;
  if (!name) {
    showToast('Indica un nombre', 'error');
    return;
  }
  const cur = loadCustomProjectTemplates();
  const ix = cur.findIndex(x => sameId(x.id, tid));
  if (ix === -1) {
    closeModal('rename-project-template-modal');
    return;
  }
  cur[ix] = { ...cur[ix], name };
  saveCustomProjectTemplates(cur);
  closeModal('rename-project-template-modal');
  showToast('Nombre actualizado', 'success');
  renderManageCustomTemplatesList();
  refreshProjectTemplateSelectIfOpen();
}

export function duplicateCustomProjectTemplate(templateId) {
  const cur = loadCustomProjectTemplates();
  const t = cur.find(x => sameId(x.id, templateId));
  if (!t) return;
  if (cur.length >= MAX_CUSTOM_PROJECT_TEMPLATES) {
    showToast(`Máximo ${MAX_CUSTOM_PROJECT_TEMPLATES} plantillas. Elimina alguna antes de duplicar.`, 'error');
    return;
  }
  const tasks = JSON.parse(JSON.stringify(t.tasks || []));
  const id = `custom_${Date.now()}`;
  const baseName = (t.name || 'Plantilla').trim() || 'Plantilla';
  const copyName = `${baseName} (copia)`;
  cur.push({ id, name: copyName, tasks, createdAt: Date.now() });
  saveCustomProjectTemplates(cur);
  showToast(`Plantilla duplicada: «${copyName}»`, 'success');
  renderManageCustomTemplatesList();
  refreshProjectTemplateSelectIfOpen();
}

let _projectTreeCtxMenuEl = null;
let _projectTreeCtxOnDoc = null;

function hideProjectTreeContextMenu() {
  if (_projectTreeCtxMenuEl) {
    _projectTreeCtxMenuEl.remove();
    _projectTreeCtxMenuEl = null;
  }
  if (_projectTreeCtxOnDoc) {
    document.removeEventListener('click', _projectTreeCtxOnDoc, true);
    document.removeEventListener('keydown', _projectTreeCtxOnDoc, true);
    window.removeEventListener('scroll', _projectTreeCtxOnDoc, true);
    _projectTreeCtxOnDoc = null;
  }
}

export function showProjectTreeContextMenu(event, projectId) {
  event.preventDefault();
  event.stopPropagation();
  hideProjectTreeContextMenu();
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p || !userCanSeeProject(p)) return;

  const menu = document.createElement('div');
  menu.className = 'project-tree-ctx-menu';
  menu.setAttribute('role', 'menu');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'project-tree-ctx-item';
  btn.textContent = '📋 Guardar como plantilla';
  btn.addEventListener('click', () => {
    hideProjectTreeContextMenu();
    openSaveProjectTemplateModal(projectId);
  });
  menu.appendChild(btn);
  const btnApply = document.createElement('button');
  btnApply.type = 'button';
  btnApply.className = 'project-tree-ctx-item';
  btnApply.textContent = '⤵ Aplicar plantilla al proyecto';
  btnApply.addEventListener('click', () => {
    hideProjectTreeContextMenu();
    openApplyTemplateToProjectModal(projectId);
  });
  menu.appendChild(btnApply);
  menu.addEventListener('mousedown', e => e.stopPropagation());

  const w = 220;
  const h = 92;
  let left = event.clientX;
  let top = event.clientY;
  if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
  if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;

  document.body.appendChild(menu);
  _projectTreeCtxMenuEl = menu;

  const onDoc = ev => {
    if (!_projectTreeCtxMenuEl) return;
    if (ev.type === 'scroll' || (ev.type === 'keydown' && ev.key === 'Escape')) {
      hideProjectTreeContextMenu();
      return;
    }
    if (ev.type === 'click' && !_projectTreeCtxMenuEl.contains(ev.target)) hideProjectTreeContextMenu();
  };
  _projectTreeCtxOnDoc = onDoc;
  requestAnimationFrame(() => {
    document.addEventListener('click', onDoc, true);
    document.addEventListener('keydown', onDoc, true);
    window.addEventListener('scroll', onDoc, true);
  });
}

function countBrokenDependencyRefs(p) {
  const taskList = p.tasks || [];
  const idOk = id => taskList.some(x => sameId(x.id, id));
  let count = 0;
  for (const t of taskList) {
    for (const bid of t.blockedBy || []) {
      if (!idOk(bid)) count++;
    }
  }
  return count;
}

const PROJECT_ACTIVITY_MAX = 50;

function pushProjectActivity(project, { type, taskName, taskId, detail }) {
  if (!project.activityLog) project.activityLog = [];
  const entry = {
    at: Date.now(),
    userId: currentUser?.id ?? null,
    type,
    taskName: taskName || 'Tarea',
    taskId: taskId != null ? taskId : null,
  };
  if (detail != null) entry.detail = detail;
  project.activityLog.unshift(entry);
  project.activityLog = project.activityLog.slice(0, PROJECT_ACTIVITY_MAX);
}

function activityActorName(userId) {
  if (userId == null) return 'Alguien';
  const u = USERS.find(x => sameId(x.id, userId));
  return u ? u.name : 'Alguien';
}

function formatActivityRelative(ts) {
  const now = Date.now();
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 45) return 'hace un momento';
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? 'hace 1 min' : `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'hace 1 h' : `hace ${h} h`;
  const d = new Date(ts);
  const startOf = x => {
    const z = new Date(x);
    z.setHours(0, 0, 0, 0);
    return z.getTime();
  };
  const dayDiff = Math.floor((startOf(now) - startOf(ts)) / 86400000);
  if (dayDiff === 1) return 'ayer';
  if (dayDiff > 1 && dayDiff < 7) return `hace ${dayDiff} días`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function projectActivityLine(e) {
  const who = activityActorName(e.userId);
  const t = escapeChatHtml(e.taskName || 'Tarea');
  switch (e.type) {
    case 'task_added': return `${who} añadió «${t}»`;
    case 'task_updated': return `${who} actualizó «${t}»`;
    case 'task_completed': return `${who} completó «${t}»`;
    case 'task_reopened': return `${who} reabrió «${t}»`;
    case 'task_deleted': return `${who} eliminó «${t}»`;
    case 'template_applied':
      return `${who} aplicó la plantilla «${t}» (${e.detail ?? 0} tareas)`;
    default: return `${who} modificó «${t}»`;
  }
}

function renderProjectActivity(p) {
  const log = p.activityLog || [];
  if (!log.length) return '';
  const rows = log.slice(0, 20).map(e => `
    <div class="project-activity-row">
      <span class="project-activity-text">${projectActivityLine(e)}</span>
      <span class="project-activity-when">${formatActivityRelative(e.at)}</span>
    </div>`).join('');
  return `
    <div class="project-activity-block">
      <div class="project-activity-header">Actividad reciente</div>
      <div class="project-activity-list">${rows}</div>
    </div>`;
}

let _taskSortMode = 'default'; // 'default' | 'priority' | 'dueDate' | 'status'
let _taskSearchQuery = '';
let _editingTaskDeps = [];

function toOnclickStringArg(value) {
  return JSON.stringify(value).replace(/'/g, "\\'");
}

function fillTaskDepsSelect(projectId, excludeTaskId, currentDeps) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const sel = document.getElementById('task-deps-select');
  const list = document.getElementById('task-deps-list');
  if (!p || !sel || !list) return;

  const available = p.tasks.filter(t =>
    (excludeTaskId == null || !sameId(t.id, excludeTaskId)) &&
    !(currentDeps || []).some(d => sameId(d, t.id))
  );
  sel.innerHTML = `<option value="">+ Añadir dependencia...</option>` +
    available.map(t => `<option value="${t.id}">${escapeChatHtml(t.name)}</option>`).join('');

  renderTaskDepsList(projectId, excludeTaskId, currentDeps || []);
}

function renderTaskDepsList(projectId, _excludeTaskId, deps) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const list = document.getElementById('task-deps-list');
  if (!list) return;
  if (!deps.length) { list.innerHTML = ''; return; }
  list.innerHTML = deps.map(depId => {
    const depTask = p?.tasks.find(t => sameId(t.id, depId));
    return `<div style="display:flex;align-items:center;justify-content:space-between;
      padding:5px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
      border-radius:6px;font-size:11px;color:rgba(255,255,255,0.65)">
      <span style="display:flex;align-items:center;gap:6px">
        <span style="color:rgba(239,68,68,0.6)">🔒</span>
        ${escapeChatHtml(depTask?.name || 'Tarea eliminada')}
        ${depTask?.done ? '<span style="color:rgba(52,211,153,0.7);font-size:10px">✓ completada</span>' : ''}
      </span>
      <button type="button" onclick="removeTaskDep(${toOnclickStringArg(depId)})"
        style="background:none;border:none;color:rgba(255,255,255,0.25);cursor:pointer;font-size:12px;
        padding:0 2px">✕</button>
    </div>`;
  }).join('');
}

export function addTaskDep() {
  const sel = document.getElementById('task-deps-select');
  if (!sel || !sel.value) return;
  const depId = Number(sel.value) || sel.value;
  if (!_editingTaskDeps.some(d => sameId(d, depId))) {
    _editingTaskDeps.push(depId);
  }
  fillTaskDepsSelect(currentProjectId, editingTaskId, _editingTaskDeps);
}

export function removeTaskDep(depId) {
  _editingTaskDeps = _editingTaskDeps.filter(d => !sameId(d, depId));
  fillTaskDepsSelect(currentProjectId, editingTaskId, _editingTaskDeps);
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
    const overdueTasks = tasksToShow.filter(t =>
      !t.done &&
      t.dueDate &&
      new Date(t.dueDate + 'T12:00:00') < new Date()
    ).length;
    const pComments = commentIndicators('project', proj.id);
    const pLast = getLatestCommentPreview('project', proj.id);
    const commentTooltip = pLast ? ` title="${escapeChatHtml(pLast.substring(0, 100))}"` : '';
    const pad = Math.min(depth, 12) * 10;
    const projIdArg = toOnclickStringArg(proj.id);
    const toggleBtn = subCount
      ? `<button type="button" class="project-tree-toggle" onclick="toggleProjectTreeCollapse(${projIdArg},event)" aria-expanded="${!collapsed}"${commentTooltip} title="${collapsed ? 'Expandir subproyectos' : 'Contraer subproyectos'}${pLast ? ' — ' + escapeChatHtml(pLast.substring(0, 80)) : ''}">${collapsed ? '▸' : '▾'}</button>`
      : '<span class="project-tree-toggle-spacer"></span>';
    const rowInner = `<div class="project-item project-item-depth ${depth > 0 ? 'subproject' : ''} ${sameId(currentProjectId, proj.id) ? 'active' : ''}" style="padding-left:${8 + pad}px;--project-color:${proj.color}" data-project-id="${proj.id}" data-depth="${depth}" data-project-color="${proj.color}" onclick="selectProject(${projIdArg})" oncontextmenu="showProjectTreeContextMenu(event,${projIdArg});return false;">
      <div class="project-item-row-head">
        ${toggleBtn}
        <div class="project-item-row-body">
          <div class="project-item-name">
            ${escapeChatHtml(proj.name)}
            ${subCount ? `<span style="font-size:10px;opacity:0.75;margin-left:6px">· ${subCount} sub</span>` : ''}
            ${overdueTasks > 0 ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(239,68,68,0.85);margin-left:6px;vertical-align:middle" title="${overdueTasks} tarea${overdueTasks !== 1 ? 's' : ''} vencida${overdueTasks !== 1 ? 's' : ''}"></span>` : ''}
          </div>
          <div class="project-item-meta">
            <span>${statusLabels[proj.status]}</span>
            <span>${done}/${total} tareas${projectUserFilter !== null ? ' asignadas' : ''}</span>
            ${overdueTasks > 0
              ? `<span style="color:rgba(239,68,68,0.85);font-size:10px;font-weight:600">⚠ ${overdueTasks} vencida${overdueTasks !== 1 ? 's' : ''}</span>`
              : ''}
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

function getSortedTasks(tasks) {
  let arr = [...tasks];

  if (_taskSearchQuery.trim()) {
    const q = _taskSearchQuery.toLowerCase().trim();
    arr = arr.filter(t => {
      const words = t.name.toLowerCase().split(/\s+/);
      return words.some(word => word.startsWith(q));
    });
  }

  const priorityOrder = { alta: 0, media: 1, normal: 2, baja: 3 };
  const statusOrder = { progress: 0, pending: 1, done: 2 };
  switch (_taskSortMode) {
    case 'priority':
      return arr.sort((a, b) =>
        (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );
    case 'dueDate':
      return arr.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    case 'status':
      return arr.sort((a, b) => {
        const aS = a.done ? 'done' : (a.status === 'progress' ? 'progress' : 'pending');
        const bS = b.done ? 'done' : (b.status === 'progress' ? 'progress' : 'pending');
        return (statusOrder[aS] ?? 1) - (statusOrder[bS] ?? 1);
      });
    default:
      return arr;
  }
}

function renderTasksList(p) {
  if (p.tasks.length === 0) {
    return `<div class="empty-state" style="padding:20px"><div>Sin tareas aún</div></div>`;
  }
  return getSortedTasks(p.tasks).map(t => {
    const assignee = USERS.find(u => u.id === t.assigneeId);
    const isFiltered = projectUserFilter !== null && t.assigneeId !== projectUserFilter;
    const taskComments = commentIndicators('task', p.id, t.id);
    const blockingDeps = (t.blockedBy || [])
      .map(id => p.tasks.find(x => sameId(x.id, id)))
      .filter(dep => dep && !dep.done);
    const isBlocked = blockingDeps.length > 0;
    return `<div class="task-item${isBlocked ? ' task-blocked' : ''}" data-task-id="${t.id}" style="${isFiltered ? 'opacity:0.35;' : ''}">
      <div class="task-check ${t.done?'done':''}" onclick="quickToggleTask(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)},this)">${t.done?'✓':''}</div>
      <span class="task-name ${t.done?'done':''}" style="cursor:pointer"
        onclick="openTaskViewer(${toOnclickStringArg(p.id)},${toOnclickStringArg(t.id)})">
        <span>${t.name}${taskComments}${t.desc ? ' <span style="font-size:9px;opacity:0.85">📄</span>' : ''}</span>
        ${isBlocked ? `<span style="font-size:10px;color:rgba(239,68,68,0.7);
    display:flex;align-items:center;gap:3px"
    title="Bloqueada por: ${blockingDeps.map(d => escapeChatHtml(d.name)).join(', ')}">
    🔒 ${blockingDeps.length} bloq.
  </span>` : ''}
      </span>
      ${t.priority!=='normal'?`<span class="task-priority ${t.priority}">${t.priority}</span>`:''}
      ${t.dueDate ? `<span class="task-due ${new Date(t.dueDate+'T12:00:00') < new Date() && !t.done ? 'task-due-overdue' : ''}">${t.dueDate}</span>` : ''}
      ${t.estimatedHours != null ? `<span class="task-hours" title="Estimado: ${t.estimatedHours}h${t.realHours != null ? ' · Real: ' + t.realHours + 'h' : ''}">⏱ ${t.realHours != null ? t.realHours + '/' : ''}${t.estimatedHours}h</span>` : ''}
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
      const tasks = getSortedTasks(p.tasks).filter(col.filter);
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
                const blockingDeps = (t.blockedBy || [])
                  .map(id => p.tasks.find(x => sameId(x.id, id)))
                  .filter(dep => dep && !dep.done);
                const isBlocked = blockingDeps.length > 0;
                return `<div class="kanban-card" 
                  draggable="true"
                  ondragstart="dragTaskStart(event,${tid},${pid})"
                  onclick="openTaskViewer(${pid},${tid})">
                  <div class="kanban-card-name">${escapeChatHtml(t.name)}</div>
                  ${isBlocked ? `<div style="font-size:10px;color:rgba(239,68,68,0.7);
      display:flex;align-items:center;gap:3px">
      🔒 Bloqueada por ${blockingDeps.length}
    </div>` : ''}
                  ${t.priority !== 'normal' ? `<span class="task-priority ${t.priority}" style="font-size:9px">${t.priority}</span>` : ''}
                  ${t.dueDate ? `<div class="kanban-card-due ${new Date(t.dueDate+'T12:00:00') < new Date() && !t.done ? 'overdue' : ''}">${t.dueDate}</div>` : ''}
                  ${t.estimatedHours != null ? `<div class="kanban-card-hours">⏱ ${t.realHours != null ? t.realHours + '/' : ''}${t.estimatedHours}h</div>` : ''}
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

  if (t.estimatedHours || t.realHours) {
    const efficiency = t.estimatedHours && t.realHours
      ? Math.round(t.realHours / t.estimatedHours * 100)
      : null;
    metaItems.push(`
      <div class="task-viewer-meta-item">
        <div class="task-viewer-meta-label">Horas</div>
        <div class="task-viewer-meta-value" style="font-family:'DM Mono',monospace;display:flex;align-items:center;gap:6px">
          <span>${t.realHours ? t.realHours + 'h real' : '— real'}</span>
          <span style="color:rgba(255,255,255,0.25)">/</span>
          <span style="color:rgba(255,255,255,0.4)">${t.estimatedHours ? t.estimatedHours + 'h est.' : '— est.'}</span>
          ${efficiency !== null ? `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;
            background:${efficiency > 100 ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.12)'};
            color:${efficiency > 100 ? 'rgba(239,68,68,0.9)' : 'rgba(52,211,153,0.9)'}">${efficiency}%</span>` : ''}
        </div>
      </div>`);
  }

  const blockingDepsViewer = (t.blockedBy || [])
    .map(id => p.tasks.find(x => sameId(x.id, id)))
    .filter(Boolean);
  if (blockingDepsViewer.length > 0) {
    metaItems.push(`
        <div class="task-viewer-meta-item" style="grid-column:1/-1">
          <div class="task-viewer-meta-label">Bloqueada por</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:2px">
            ${blockingDepsViewer.map(dep => `
              <div style="display:flex;align-items:center;gap:6px;font-size:12px">
                <span style="color:${dep.done ? 'rgba(52,211,153,0.7)' : 'rgba(239,68,68,0.7)'}">
                  ${dep.done ? '✓' : '🔒'}
                </span>
                <span style="color:rgba(255,255,255,${dep.done ? '0.4' : '0.75'});
                  text-decoration:${dep.done ? 'line-through' : 'none'}">
                  ${escapeChatHtml(dep.name)}
                </span>
              </div>`).join('')}
          </div>
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

export function setTaskSort(mode, projectId) {
  _taskSortMode = mode;
  selectProject(projectId);
}

export function filterTaskSearch(query, projectId) {
  _taskSearchQuery = query;
  selectProject(projectId);
  setTimeout(() => {
    const input = document.getElementById('task-search-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
}

export function openMyWorkTasksView() {
  if (!currentUser) {
    showToast('Inicia sesión para ver tus tareas', 'info');
    return;
  }
  setCurrentProjectId(null);
  _taskSearchQuery = '';
  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));

  const rows = [];
  for (const p of projects) {
    if (!userCanSeeProject(p)) continue;
    for (const t of p.tasks || []) {
      if (t.done) continue;
      if (!sameId(t.assigneeId, currentUser.id)) continue;
      rows.push({ p, t });
    }
  }

  rows.sort((a, b) => {
    const da = a.t.dueDate || '9999-12-31';
    const db = b.t.dueDate || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    const pg = a.p.name.localeCompare(b.p.name, 'es');
    if (pg !== 0) return pg;
    return String(a.t.name || '').localeCompare(String(b.t.name || ''), 'es');
  });

  const listHtml =
    rows.length === 0
      ? `<div class="empty-state" style="padding:32px 20px"><div class="empty-icon">✓</div><div>No tienes tareas pendientes asignadas en los proyectos visibles.</div></div>`
      : `<div class="my-work-tasks-list">${rows
          .map(({ p, t }) => {
            const pid = toOnclickStringArg(p.id);
            const tid = toOnclickStringArg(t.id);
            const overdue =
              t.dueDate && new Date(t.dueDate + 'T12:00:00') < new Date();
            return `<div class="my-work-task-row">
          <div class="task-check ${t.done ? 'done' : ''}" onclick="quickToggleTask(${pid},${tid},this)"></div>
          <div class="my-work-task-main">
            <span class="my-work-task-name" onclick="openTaskViewer(${pid},${tid})">${escapeChatHtml(t.name)}</span>
            <button type="button" class="my-work-project-link btn-secondary" style="font-size:10px;padding:2px 8px;margin-top:4px" onclick="selectProject(${pid})">${escapeChatHtml(p.name)}</button>
          </div>
          ${
            t.dueDate
              ? `<span class="my-work-due${overdue ? ' my-work-due-overdue' : ''}">${escapeChatHtml(t.dueDate)}</span>`
              : ''
          }
          ${
            t.priority && t.priority !== 'normal'
              ? `<span class="task-priority ${t.priority}" style="font-size:9px;align-self:center">${t.priority}</span>`
              : ''
          }
        </div>`;
          })
          .join('')}</div>`;

  document.getElementById('project-detail').innerHTML = `
    <div class="my-work-header">
      <h3 style="margin:0 0 6px;font-size:18px">📋 Mis tareas</h3>
      <p style="margin:0;font-size:12px;color:var(--text-muted)">Pendientes y en progreso asignadas a ti, en todos los proyectos que puedes ver.</p>
    </div>
    ${listHtml}
  `;
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

  const wasDone = task.done;

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

  if (task.done && !wasDone) {
    pushProjectActivity(p, { type: 'task_completed', taskName: task.name, taskId: task.id });
  } else if (!task.done && wasDone) {
    pushProjectActivity(p, { type: 'task_reopened', taskName: task.name, taskId: task.id });
  }

  _dragTaskId = null;
  _dragProjectId = null;
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

function renderProjectStats(p) {
  const tasks = p.tasks;
  if (tasks.length === 0) return '';

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalReal = tasks.reduce((sum, t) => sum + (t.realHours || 0), 0);
  const hoursEfficiency = totalEstimated > 0 ? Math.round(totalReal / totalEstimated * 100) : null;

  const pending = tasks.filter(t => !t.done && t.status !== 'progress').length;
  const inProgress = tasks.filter(t => !t.done && t.status === 'progress').length;
  const done = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate + 'T12:00:00') < new Date()).length;

  const alta = tasks.filter(t => t.priority === 'alta').length;
  const media = tasks.filter(t => t.priority === 'media').length;
  const normal = tasks.filter(t => !t.priority || t.priority === 'normal').length;

  const byAssignee = {};
  tasks.forEach(t => {
    const key = t.assigneeId || '__none__';
    if (!byAssignee[key]) byAssignee[key] = { done: 0, total: 0 };
    byAssignee[key].total++;
    if (t.done) byAssignee[key].done++;
  });

  const total = tasks.length;
  const pctDone = Math.round(done / total * 100);
  const pctProgress = Math.round(inProgress / total * 100);
  const pctPending = Math.round(pending / total * 100);

  const statusBar = `
    <div style="display:flex;height:6px;border-radius:6px;overflow:hidden;gap:1px;margin-bottom:6px">
      <div style="width:${pctDone}%;background:rgba(52,211,153,0.7);transition:width 0.3s"></div>
      <div style="width:${pctProgress}%;background:rgba(251,191,36,0.7);transition:width 0.3s"></div>
      <div style="width:${pctPending}%;background:rgba(255,255,255,0.15);transition:width 0.3s"></div>
    </div>
    <div style="display:flex;gap:12px;font-size:10px;color:rgba(255,255,255,0.4)">
      <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:rgba(52,211,153,0.7);display:inline-block"></span>${done} completadas</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:rgba(251,191,36,0.7);display:inline-block"></span>${inProgress} en progreso</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.15);display:inline-block"></span>${pending} pendientes</span>
      ${overdue > 0 ? `<span style="display:flex;align-items:center;gap:4px;color:rgba(239,68,68,0.8)"><span style="width:8px;height:8px;border-radius:50%;background:rgba(239,68,68,0.7);display:inline-block"></span>${overdue} vencidas</span>` : ''}
    </div>`;

  const metricCards = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;margin-top:12px">
      <div class="proj-stat-card">
        <div class="proj-stat-value">${total}</div>
        <div class="proj-stat-label">Total</div>
      </div>
      <div class="proj-stat-card" style="border-color:rgba(52,211,153,0.2)">
        <div class="proj-stat-value" style="color:rgba(52,211,153,0.9)">${pctDone}%</div>
        <div class="proj-stat-label">Completado</div>
      </div>
      <div class="proj-stat-card" style="border-color:rgba(239,68,68,0.2)">
        <div class="proj-stat-value" style="color:rgba(239,68,68,${overdue > 0 ? '0.9' : '0.3'})">${overdue}</div>
        <div class="proj-stat-label">Vencidas</div>
      </div>
      <div class="proj-stat-card" style="border-color:rgba(251,191,36,0.2)">
        <div class="proj-stat-value" style="color:rgba(251,191,36,0.9)">${alta}</div>
        <div class="proj-stat-label">Alta prioridad</div>
      </div>
    </div>`;

  const assigneeRows = Object.entries(byAssignee)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([uid, data]) => {
      const user = USERS.find(u => String(u.id) === String(uid));
      const pct = Math.round(data.done / data.total * 100);
      return `
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:20px;height:20px;border-radius:50%;background:${user?.color || 'rgba(120,100,255,0.4)'};
            display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;
            color:white;flex-shrink:0">${user?.initials || '?'}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;font-size:11px;
              color:rgba(255,255,255,0.65);margin-bottom:3px">
              <span>${user?.name || 'Sin asignar'}</span>
              <span style="color:rgba(255,255,255,0.35)">${data.done}/${data.total}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${user?.color || 'rgba(120,100,255,0.6)'};
                border-radius:4px;transition:width 0.3s"></div>
            </div>
          </div>
          <span style="font-size:10px;color:rgba(255,255,255,0.3);min-width:28px;text-align:right">${pct}%</span>
        </div>`;
    }).join('');

  return `
    <div class="proj-stats-block">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.25);
          text-transform:uppercase;letter-spacing:0.1em">Estadísticas</span>
      </div>
      ${statusBar}
      ${metricCards}
      ${totalEstimated > 0 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-top:8px;padding:8px 12px;
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:rgba(255,255,255,0.3)">⏱</span>
            <span style="font-size:12px;font-family:'DM Mono',monospace;color:rgba(255,255,255,0.65)">
              ${totalReal}h real
              <span style="color:rgba(255,255,255,0.25)"> / ${totalEstimated}h estimadas</span>
            </span>
          </div>
          ${hoursEfficiency !== null ? `
            <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;
              background:${hoursEfficiency > 100 ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.1)'};
              color:${hoursEfficiency > 100 ? 'rgba(239,68,68,0.8)' : 'rgba(52,211,153,0.8)'}">
              ${hoursEfficiency}% eficiencia
            </span>` : ''}
        </div>` : ''}
      ${Object.keys(byAssignee).length > 0 ? `
        <div style="margin-top:14px">
          <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.2);
            text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Por asignado</div>
          <div style="display:flex;flex-direction:column;gap:10px">${assigneeRows}</div>
        </div>` : ''}
    </div>`;
}

export function selectProject(id) {
  if (currentProjectId != null && !sameId(currentProjectId, id)) {
    _taskSearchQuery = '';
  }
  setCurrentProjectId(id);
  const p = projects.find(pr => sameId(pr.id, id));
  if (!p) return;

  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.project-item[data-project-id="${id}"]`);
  if (active) active.classList.add('active');

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

  const brokenDeps = countBrokenDependencyRefs(p);
  const brokenBanner = brokenDeps > 0
    ? `<div class="project-deps-warning" role="alert">⚠ Hay <strong>${brokenDeps}</strong> referencia(s) de dependencia rota(s) (tareas eliminadas). Edita las tareas afectadas y quita esas dependencias.</div>`
    : '';

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
        <button type="button" class="btn-secondary" onclick="openApplyTemplateToProjectModal(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px" title="Añadir tareas desde una plantilla al proyecto actual">⤵ Plantilla</button>
        <button type="button" class="btn-secondary" onclick="openSaveProjectTemplateModal(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px" title="Guardar la lista de tareas como plantilla reutilizable">📋 Guardar plantilla</button>
        <button type="button" class="btn-secondary" onclick="exportProjectAsText(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px" title="Descargar resumen en texto">📥 TXT</button>
        <button type="button" class="btn-secondary" onclick="openProjectPrintReport(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px" title="Informe para imprimir o guardar como PDF">🖨 PDF</button>
        <button type="button" class="btn-secondary" onclick="openEditProjectModal(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px">✏️ Editar</button>
        <button type="button" class="btn-secondary btn-secondary-danger" onclick="deleteProject(${toOnclickStringArg(p.id)})" style="font-size:12px;padding:6px 12px">🗑</button>
      </div>
    </div>
    ${brokenBanner}
    ${renderProjectStats(p)}
    ${renderProjectActivity(p)}
    <div class="tasks-section">
      <div class="tasks-section-header">
        <h4>Tareas</h4>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <div class="task-search-wrap">
            <input type="text"
              class="task-search-input"
              id="task-search-input"
              placeholder="Buscar tarea..."
              value="${escapeChatHtml(_taskSearchQuery)}"
              oninput="filterTaskSearch(this.value,${toOnclickStringArg(p.id)})">
            ${_taskSearchQuery ? `<button type="button" class="task-search-clear" onclick="filterTaskSearch('',${toOnclickStringArg(p.id)})" title="Limpiar">✕</button>` : ''}
          </div>
          <div class="task-sort-btns">
            <button type="button" class="task-sort-btn ${_taskSortMode === 'default' ? 'active' : ''}"
              onclick="setTaskSort('default',${toOnclickStringArg(p.id)})" title="Orden por defecto">↕</button>
            <button type="button" class="task-sort-btn ${_taskSortMode === 'priority' ? 'active' : ''}"
              onclick="setTaskSort('priority',${toOnclickStringArg(p.id)})" title="Por prioridad">⚑</button>
            <button type="button" class="task-sort-btn ${_taskSortMode === 'dueDate' ? 'active' : ''}"
              onclick="setTaskSort('dueDate',${toOnclickStringArg(p.id)})" title="Por fecha límite">📅</button>
            <button type="button" class="task-sort-btn ${_taskSortMode === 'status' ? 'active' : ''}"
              onclick="setTaskSort('status',${toOnclickStringArg(p.id)})" title="Por estado">◉</button>
          </div>
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
  const tplGrp = document.getElementById('project-template-group');
  if (tplGrp) tplGrp.style.display = '';
  fillProjectTemplateSelect();
  const tplSel = document.getElementById('project-template-select');
  if (tplSel) tplSel.value = '';
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
      createCustomSelect('project-template-select', '#project-modal');
    }, 0);
  }
}

export function openEditProjectModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p || !userCanSeeProject(p)) return;
  const tplGrp = document.getElementById('project-template-group');
  if (tplGrp) tplGrp.style.display = 'none';
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

export function openSaveProjectTemplateModal(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p || !userCanSeeProject(p)) {
    showToast('Proyecto no encontrado', 'error');
    return;
  }
  const snap = serializeProjectTasksForTemplate(p);
  if (!snap.length) {
    showToast('No hay tareas con título para incluir en la plantilla', 'error');
    return;
  }
  const modal = document.getElementById('save-project-template-modal');
  const input = document.getElementById('template-save-name');
  const hint = document.getElementById('template-save-task-count');
  if (!modal || !input) return;
  modal.dataset.projectId = String(p.id);
  input.value = '';
  if (hint) {
    hint.textContent = `Se guardarán ${snap.length} tarea(s): título, descripción, prioridad, estado (pendiente/en progreso), fecha límite y horas estimadas. No se incluyen asignaciones ni dependencias.`;
  }
  openModal('save-project-template-modal');
}

export function confirmSaveProjectTemplate() {
  const modal = document.getElementById('save-project-template-modal');
  const pid = modal?.dataset.projectId;
  const p = projects.find(pr => sameId(pr.id, pid));
  if (!p || !userCanSeeProject(p)) {
    closeModal('save-project-template-modal');
    showToast('Proyecto no válido', 'error');
    return;
  }
  const name = document.getElementById('template-save-name')?.value?.trim();
  if (!name) {
    showToast('Indica un nombre para la plantilla', 'error');
    return;
  }
  const list = loadCustomProjectTemplates();
  if (list.length >= MAX_CUSTOM_PROJECT_TEMPLATES) {
    showToast(
      `Máximo ${MAX_CUSTOM_PROJECT_TEMPLATES} plantillas. Elimina alguna en «Gestionar mis plantillas».`,
      'error',
    );
    return;
  }
  const tasks = serializeProjectTasksForTemplate(p);
  if (!tasks.length) {
    showToast('No hay tareas con título', 'error');
    return;
  }
  const id = `custom_${Date.now()}`;
  list.push({ id, name, tasks, createdAt: Date.now() });
  saveCustomProjectTemplates(list);
  closeModal('save-project-template-modal');
  showToast(`Plantilla «${name}» guardada`, 'success');
  refreshProjectTemplateSelectIfOpen();
}

export function openApplyTemplateToProjectModal(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p || !userCanSeeProject(p)) {
    showToast('Proyecto no encontrado', 'error');
    return;
  }
  if (!fillApplyTemplateToProjectSelect()) {
    showToast('No hay plantillas con tareas para aplicar', 'info');
    return;
  }
  const modal = document.getElementById('apply-template-to-project-modal');
  if (!modal) return;
  modal.dataset.projectId = String(p.id);
  const skip = document.getElementById('apply-template-skip-duplicates');
  if (skip) skip.checked = true;
  openModal('apply-template-to-project-modal');
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => createCustomSelect('apply-template-to-project-select', '#apply-template-to-project-modal'), 0);
  }
}

export function confirmApplyTemplateToProject() {
  const modal = document.getElementById('apply-template-to-project-modal');
  const pid = modal?.dataset.projectId;
  const p = projects.find(pr => sameId(pr.id, pid));
  if (!p || !userCanSeeProject(p)) {
    closeModal('apply-template-to-project-modal');
    showToast('Proyecto no válido', 'error');
    return;
  }
  const sel = document.getElementById('apply-template-to-project-select');
  const tplId = sel?.value?.trim();
  if (!tplId) {
    showToast('Elige una plantilla', 'error');
    return;
  }
  const tpl = getProjectTaskTemplateById(tplId);
  const defs = tpl.tasks || [];
  if (!defs.length) {
    showToast('Esta plantilla no tiene tareas', 'error');
    return;
  }
  const skipDupes = document.getElementById('apply-template-skip-duplicates')?.checked !== false;
  const existingLower = new Set(
    (p.tasks || []).map(t => String(t.name || '').trim().toLowerCase()).filter(Boolean),
  );
  const toAdd = skipDupes
    ? defs.filter(d => !existingLower.has(String(d.name || '').trim().toLowerCase()))
    : defs.slice();
  const skipped = defs.length - toAdd.length;
  if (!toAdd.length) {
    showToast(
      skipDupes
        ? 'Todas las tareas de la plantilla coinciden con un título ya existente en el proyecto.'
        : 'No hay tareas que añadir.',
      'info',
    );
    return;
  }
  const nameSafe = escapeChatHtml(tpl.name);
  showConfirmModal({
    icon: '📋',
    title: 'Aplicar plantilla al proyecto',
    confirmLabel: 'Sí, añadir tareas',
    messageHtml: `<p class="confirm-modal-lead">Se añadirán <strong>${toAdd.length}</strong> tarea(s) desde «${nameSafe}» al proyecto «${escapeChatHtml(p.name)}».${skipped ? ` Se omiten <strong>${skipped}</strong> por título duplicado.` : ''} Las tareas actuales no se eliminan.</p>`,
    onConfirm: () => {
      let id = Date.now();
      for (const def of toAdd) {
        while (p.tasks.some(t => sameId(t.id, id))) id += 1;
        p.tasks.push(taskFromTemplateDef(def, id));
        id += 1;
      }
      pushProjectActivity(p, { type: 'template_applied', taskName: tpl.name, detail: toAdd.length });
      saveProjectData();
      closeModal('apply-template-to-project-modal');
      renderProjects();
      selectProject(p.id);
      showToast(`Añadidas ${toAdd.length} tarea(s)`, 'success');
    },
  });
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
  const tplPick = document.getElementById('project-template-select');
  const tplId = tplPick && tplPick.value ? tplPick.value : '';
  const tpl = getProjectTaskTemplateById(tplId);
  const tasksFromTpl = tpl.id ? buildTasksFromTemplate(tpl.tasks, newId) : [];

  const newProj = {
    id: newId,
    name,
    group: par ? par.group : currentUser.group,
    parentProjectId: par ? par.id : null,
    desc,
    images,
    color: document.getElementById('project-color-input').value,
    status: document.getElementById('project-status-input').value,
    tasks: tasksFromTpl,
    createdById: currentUser.id,
    shares: addSh,
  };
  projects.push(newProj);
  if (tasksFromTpl.length > 0) {
    pushProjectActivity(newProj, {
      type: 'template_applied',
      taskName: tpl.name,
      detail: tasksFromTpl.length,
    });
  }
  saveProjectData();
  closeModal('project-modal');
  renderProjects();
  selectProject(newId);
  const tplMsg = tasksFromTpl.length ? ` (${tasksFromTpl.length} tareas desde plantilla)` : '';
  showToast((par ? 'Subproyecto creado' : 'Proyecto creado') + tplMsg, 'success');
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
  document.getElementById('task-status-input').value = 'pending';
  document.getElementById('task-due-date').value = '';
  document.getElementById('task-estimated-hours').value = '';
  document.getElementById('task-real-hours').value = '';
  _editingTaskDeps = [];
  fillTaskDepsSelect(currentProjectId, null, []);
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
      createCustomSelect('task-status-input', '#task-modal');
      createCustomSelect('task-deps-select', '#task-modal');
    }, 0);
  }
}

export function openEditTaskModal(projectId, taskId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
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
  document.getElementById('task-estimated-hours').value = t.estimatedHours ?? '';
  document.getElementById('task-real-hours').value = t.realHours ?? '';
  const statusInput = document.getElementById('task-status-input');
  if (statusInput) {
    if (t.done) statusInput.value = 'done';
    else if (t.status === 'progress') statusInput.value = 'progress';
    else statusInput.value = 'pending';
  }
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
  _editingTaskDeps = [...(t.blockedBy || [])];
  fillTaskDepsSelect(projectId, taskId, _editingTaskDeps);
  openModal('task-modal');
  if (document.documentElement.classList.contains('tema-aurora')) {
    setTimeout(() => {
      createCustomSelect('task-collab-target-select', '#task-modal');
      createCustomSelect('task-collab-permission-select', '#task-modal');
      createCustomSelect('task-assignee-input', '#task-modal');
      createCustomSelect('task-priority-input', '#task-modal');
      createCustomSelect('task-status-input', '#task-modal');
      createCustomSelect('task-deps-select', '#task-modal');
    }, 0);
  }
}

export function saveTask() {
  const name = document.getElementById('task-name-input').value.trim();
  if (!name) { showToast('El nombre es requerido','error'); return; }
  const p = projects.find(pr => sameId(pr.id, currentProjectId));
  if (!p) return;
  const desc = document.getElementById('task-desc-input').value.trim();
  const prev = editingTaskId ? p.tasks.find(x => sameId(x.id, editingTaskId)) : null;
  const baseImg = prev?.images || {};
  const images = collectImageMap(desc, {...baseImg, ...editingTaskImages});
  const addSh = buildSharesFromCollabSelect('task-collab-target-select', 'task-collab-permission-select');
  const assigneeId = parseInt(document.getElementById('task-assignee-input').value) || null;
  const priority = document.getElementById('task-priority-input').value;
  const dueDate = document.getElementById('task-due-date').value || null;
  const statusVal = document.getElementById('task-status-input')?.value || 'pending';
  const estHRaw = document.getElementById('task-estimated-hours').value.trim();
  const realHRaw = document.getElementById('task-real-hours').value.trim();
  const estimatedHours = estHRaw === '' ? null : (Number.isFinite(parseFloat(estHRaw)) ? parseFloat(estHRaw) : null);
  const realHours = realHRaw === '' ? null : (Number.isFinite(parseFloat(realHRaw)) ? parseFloat(realHRaw) : null);

  if (editingTaskId) {
    const t = p.tasks.find(x => sameId(x.id, editingTaskId));
    if (!t) return;
    const prevDone = t.done;
    const old = t.shares || [];
    const rest = old.filter(s => s.type !== 'dept' && s.type !== 'workgroup');
    Object.assign(t, {
      name, desc, images, assigneeId, priority, dueDate,
      done: statusVal === 'done',
      status: statusVal === 'progress' ? 'progress' : (statusVal === 'done' ? 'done' : undefined),
      estimatedHours, realHours,
      blockedBy: [..._editingTaskDeps],
      shares: [...rest, ...addSh]
    });
    if (!prevDone && t.done) {
      pushProjectActivity(p, { type: 'task_completed', taskName: name, taskId: t.id });
    } else if (prevDone && !t.done) {
      pushProjectActivity(p, { type: 'task_reopened', taskName: name, taskId: t.id });
    } else {
      pushProjectActivity(p, { type: 'task_updated', taskName: name, taskId: t.id });
    }
    showToast('Tarea actualizada','success');
  } else {
    const newTaskId = Date.now();
    p.tasks.push({
      id: newTaskId, name, desc, done: statusVal === 'done',
      status: statusVal === 'progress' ? 'progress' : undefined,
      assigneeId, priority, dueDate, estimatedHours, realHours, images,
      blockedBy: [..._editingTaskDeps],
      shares: addSh
    });
    pushProjectActivity(p, { type: 'task_added', taskName: name, taskId: newTaskId });
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

  if (!t.done && t.blockedBy && t.blockedBy.length > 0) {
    const blocking = t.blockedBy
      .map(id => p.tasks.find(x => sameId(x.id, id)))
      .filter(dep => dep && !dep.done);
    if (blocking.length > 0) {
      showToast(`Bloqueada por: ${blocking.map(d => d.name).join(', ')}`, 'error');
      return;
    }
  }

  const wasDone = t.done;
  t.done = !t.done;
  if (t.done && !wasDone) {
    pushProjectActivity(p, { type: 'task_completed', taskName: t.name, taskId: t.id });
  } else if (!t.done && wasDone) {
    pushProjectActivity(p, { type: 'task_reopened', taskName: t.name, taskId: t.id });
  }
  saveProjectData();

  const detailEl = document.getElementById('project-detail');
  const inMyWorkView = detailEl && detailEl.querySelector('.my-work-tasks-list');
  if (inMyWorkView) {
    renderProjects();
    openMyWorkTasksView();
    return;
  }

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
  const done = allTasks.filter(tk => tk.done).length;
  const total = allTasks.length;
  const projItem = document.querySelector(`.project-item[data-project-id="${projectId}"] .project-item-meta span:nth-child(2)`);
  if (projItem) projItem.textContent = `${done}/${total} tareas${projectUserFilter !== null ? ' asignadas' : ''}`;
  selectProject(projectId);
}

export function toggleTask(projectId, taskId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) return;
  const t = p.tasks.find(x => sameId(x.id, taskId));
  if (!t) return;
  const wasDone = t.done;
  t.done = !t.done;
  if (t.done && !wasDone) {
    pushProjectActivity(p, { type: 'task_completed', taskName: t.name, taskId: t.id });
  } else if (!t.done && wasDone) {
    pushProjectActivity(p, { type: 'task_reopened', taskName: t.name, taskId: t.id });
  }
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
      const taskName = task?.name || 'Tarea';
      pushProjectActivity(p, { type: 'task_deleted', taskName, taskId });
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
