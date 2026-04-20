// ===== PROJECTS MODULE =====

import { USERS, projects, currentUser, currentProjectId, currentView, projectUserFilter, editingProjectId, editingTaskId, editingProjectImages, editingTaskImages, comments, workGroups, GROUPS, collectImageMap, setProjects, setCurrentProjectId, setEditingProjectId, setEditingTaskId, setEditingProjectImages, setEditingTaskImages, setProjectUserFilter as setProjectUserFilterState, sameId } from './data.js';
import { showToast, openModal, closeModal, showConfirmModal, escapeChatHtml } from './modalControl.js';
import { renderMarkdown, fillCollabTargetSelect, buildSharesFromCollabSelect } from './notes.js';
import { createCustomSelect } from './auroraCustomSelect.js';
import { commentIndicators, getLatestCommentPreview } from './docs.js';
import {
  apiGetProjects,
  apiCreateProject,
  apiDeleteProject,
} from '../api.js';
import { projectsTrackedUpdateProject, getProjectsSavePendingCount } from './projects/projects-save-tracking.js';
import {
  parseProjectsDeepLink,
  replaceProjectsDeepLink,
  clearProjectsTaskFromHash,
} from './projects/projects-deeplink.js';

const PROJECT_STATS_COMPACT_LS = 'diario_proj_stats_compact_v1';
const PROJECT_ACTIVITY_FILTER_LS = 'diario_proj_activity_filter_v2';
const PROJECT_ACTIVITY_FILTER_LEGACY = 'diario_proj_activity_filter_v1';
const PROJECT_TASK_LIST_DENSITY_LS = 'diario_proj_tasks_density_v1';
const PROJECT_ACTIVITY_EXPANDED_V2 = 'diario_project_activity_expanded_v2';
const PROJECT_ACTIVITY_V2_MIGRATED = 'diario_project_activity_v2_migrated';
const PROJECT_KANBAN_WIP_SOFT = 7;
const PROJECT_DETAIL_ONLY_MINE_LS = 'diario_proj_detail_only_mine_v1';
const MY_WORK_GROUP_LS = 'diario_my_work_group_v1';
const PROJECT_TASK_LIST_PAGE_SIZE = 42;
const PROJECT_KANBAN_SWIMLANE_LS = 'diario_proj_kanban_swimlane_v1';

function clearProjectModalFooters() {
  ['project-modal-footer-feedback-wizard', 'project-modal-footer-feedback-main'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function setTaskModalFooterMsg(text) {
  const el = document.getElementById('task-modal-footer-feedback');
  if (el) el.textContent = text || '';
}

function setProjectSaveLoading(on) {
  const btn = document.getElementById('project-save-btn');
  if (!btn) return;
  if (on) {
    if (!btn.dataset.saveLabel) btn.dataset.saveLabel = btn.textContent.trim();
    btn.disabled = true;
    btn.classList.add('btn-save--loading');
    btn.textContent = 'Guardando…';
  } else {
    btn.disabled = false;
    btn.classList.remove('btn-save--loading');
    btn.textContent = btn.dataset.saveLabel || 'Guardar Proyecto';
  }
}

function setTaskSaveLoading(on) {
  const btn = document.getElementById('task-save-btn');
  if (!btn) return;
  if (on) {
    if (!btn.dataset.saveLabel) btn.dataset.saveLabel = btn.textContent.trim();
    btn.disabled = true;
    btn.classList.add('btn-save--loading');
    btn.textContent = 'Guardando…';
  } else {
    btn.disabled = false;
    btn.classList.remove('btn-save--loading');
    btn.textContent = btn.dataset.saveLabel || 'Añadir tarea';
  }
}

function updateProjectModalStepEyebrow() {
  const el = document.getElementById('project-modal-step-eyebrow');
  if (!el) return;
  if (editingProjectId) {
    el.classList.add('is-hidden');
    return;
  }
  el.classList.remove('is-hidden');
  const step = window._projectCreateWizardStep || 1;
  el.textContent = step === 1 ? 'Paso 1 de 2' : 'Paso 2 de 2';
}

function updateProjectModalStickyDraftVisibility() {
  const draft = document.getElementById('project-modal-sticky-draft');
  if (!draft) return;
  const show = !editingProjectId && (window._projectCreateWizardStep || 1) === 2;
  draft.classList.toggle('project-modal-sticky-draft--visible', show);
}

export function syncProjectModalStickyName() {
  const input = document.getElementById('project-name-input');
  const draftName = document.getElementById('project-modal-sticky-draft-name');
  const v = input?.value?.trim() || '';
  if (draftName) draftName.textContent = v || '—';
  if (input) {
    input.classList.toggle('form-input--wiz-valid', v.length > 0);
    input.classList.toggle('form-input--wiz-invalid', v.length === 0);
  }
  updateProjectModalStickyDraftVisibility();
}

export function copyTaskViewerDeepLink() {
  if (!_viewerProjectId || !_viewerTaskId) return;
  const p = encodeURIComponent(String(_viewerProjectId));
  const t = encodeURIComponent(String(_viewerTaskId));
  const url = `${location.origin}${location.pathname}${location.search}#/projects/${p}/${t}`;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(url).then(() => showToast('Enlace copiado al portapapeles', 'success')).catch(() => showToast('No se pudo copiar el enlace', 'error'));
  } else {
    showToast('Portapapeles no disponible en este navegador', 'error');
  }
}

let _projectTreeSearchQuery = '';
let _taskListPage = 0;
let _lastTaskListProjectKey = null;
let _projectTasksStaleFromRemote = false;
let _projectsDeepLinkBound = false;
let _projectRemoteSnapshot = null;

let _projectTaskMultiselect = false;
const _selectedTaskIds = new Set();
let _projectsNetworkBound = false;
let _projectPresentationMode = false;

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

/** Parsea `dueDate` en formato YYYY-MM-DD (mediodía local). Devuelve `null` si es inválido o año fuera de rango. */
function parseProjectTaskDueDate(dueDateStr) {
  if (dueDateStr == null || dueDateStr === '') return null;
  const s = String(dueDateStr).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  if (y < 1970 || y > 2100 || mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function formatCalendarMonthYearLabel(d) {
  const cap = x => (x && x.length ? x.charAt(0).toUpperCase() + x.slice(1) : '');
  const month = cap(d.toLocaleDateString('es-ES', { month: 'long' }));
  return `${month} de ${d.getFullYear()}`;
}

/** Vencida = fecha límite (día natural) anterior a hoy. */
function isTaskDueDateOverdue(dueStr, done) {
  if (done) return false;
  const dd = parseProjectTaskDueDate(dueStr);
  if (!dd) return false;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), 0, 0, 0, 0);
  return startDue < startToday;
}

export async function loadProjectsFromAPI() {
  try {
    let prevSnap = null;
    try {
      if (currentProjectId && currentView === 'projects') {
        const cur = projects.find(pr => sameId(pr.id, currentProjectId));
        if (cur) prevSnap = JSON.stringify(cur.tasks || []);
      }
    } catch (_) {
      prevSnap = null;
    }

    const data = await apiGetProjects();
    const mapped = data.map(p => ({
      ...p,
      id: p._id || p.id,
      group: p.department || p.group,
    }));

    if (prevSnap != null && currentProjectId) {
      const neu = mapped.find(pr => sameId(pr.id, currentProjectId));
      if (neu && JSON.stringify(neu.tasks || []) !== prevSnap) {
        _projectTasksStaleFromRemote = true;
      }
    }

    setProjects(mapped);
    return mapped;
  } catch (err) {
    console.error('Error cargando proyectos desde API:', err);
    try {
      const local = localStorage.getItem('diario_projects');
      if (local) setProjects(JSON.parse(local));
    } catch {}
    return [];
  }
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
const PROJECT_ACTIVITY_HIDDEN_KEY = 'diario_project_activity_hidden';

function migrateProjectActivityPanelStorageOnce() {
  try {
    if (localStorage.getItem(PROJECT_ACTIVITY_V2_MIGRATED)) return;
    const v2Raw = localStorage.getItem(PROJECT_ACTIVITY_EXPANDED_V2);
    if (v2Raw != null && v2Raw !== '') {
      localStorage.setItem(PROJECT_ACTIVITY_V2_MIGRATED, '1');
      return;
    }
    const legacyRaw = localStorage.getItem(PROJECT_ACTIVITY_HIDDEN_KEY);
    if (legacyRaw != null) {
      const hidden = new Set(JSON.parse(legacyRaw).map(String));
      const expanded = projects.map(pr => String(pr.id)).filter(id => !hidden.has(id));
      localStorage.setItem(PROJECT_ACTIVITY_EXPANDED_V2, JSON.stringify(expanded));
      localStorage.removeItem(PROJECT_ACTIVITY_HIDDEN_KEY);
    } else {
      localStorage.setItem(PROJECT_ACTIVITY_EXPANDED_V2, '[]');
    }
    localStorage.setItem(PROJECT_ACTIVITY_V2_MIGRATED, '1');
  } catch (_) {
    try {
      localStorage.setItem(PROJECT_ACTIVITY_EXPANDED_V2, '[]');
      localStorage.setItem(PROJECT_ACTIVITY_V2_MIGRATED, '1');
    } catch (__) { /* noop */ }
  }
}

function getProjectActivityExpandedSet() {
  migrateProjectActivityPanelStorageOnce();
  try {
    const raw = localStorage.getItem(PROJECT_ACTIVITY_EXPANDED_V2);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(x => String(x)));
  } catch {
    return new Set();
  }
}

function setProjectActivityExpandedSet(set) {
  try {
    localStorage.setItem(PROJECT_ACTIVITY_EXPANDED_V2, JSON.stringify(Array.from(set)));
  } catch (_) { /* noop */ }
}

function isProjectActivityPanelExpanded(projectId) {
  return getProjectActivityExpandedSet().has(String(projectId));
}

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

function getProjectActivityFilter() {
  try {
    let v = localStorage.getItem(PROJECT_ACTIVITY_FILTER_LS);
    if (!v) {
      const leg = localStorage.getItem(PROJECT_ACTIVITY_FILTER_LEGACY);
      if (leg === 'tasks' || leg === 'templates') v = leg;
    }
    const allowed = new Set([
      'all', 'templates', 'tasks', 'task_completed', 'task_added', 'task_deleted', 'task_updated', 'task_reopened',
    ]);
    if (allowed.has(v)) return v;
  } catch (_) { /* noop */ }
  return 'all';
}

function activityEntryMatchesFilter(e, filt) {
  if (filt === 'all') return true;
  if (filt === 'templates') return e.type === 'template_applied';
  if (filt === 'tasks') return e.type !== 'template_applied';
  if (filt === 'task_completed') return e.type === 'task_completed';
  if (filt === 'task_added') return e.type === 'task_added';
  if (filt === 'task_deleted') return e.type === 'task_deleted';
  if (filt === 'task_updated') return e.type === 'task_updated';
  if (filt === 'task_reopened') return e.type === 'task_reopened';
  return true;
}

function renderProjectActivity(p) {
  const log = p.activityLog || [];
  if (!log.length) return '';
  const expanded = isProjectActivityPanelExpanded(p.id);
  if (!expanded) {
    const last = log[0];
    const preview = last
      ? `<p class="project-activity-collapsed-preview"><span class="project-activity-collapsed-preview__text">${projectActivityLine(last)}</span><span class="project-activity-collapsed-preview__when">${formatActivityRelative(last.at)}</span></p>`
      : '';
    return `<div class="project-activity-block project-activity-block--collapsed">
      <div class="project-activity-header">
        <div class="project-activity-header-start">
          <span class="proj-section-heading">Actividad reciente</span>
          <span class="project-activity-collapsed-meta">${log.length} evento${log.length !== 1 ? 's' : ''}</span>
        </div>
        <button type="button" class="project-activity-toggle" onclick="toggleProjectActivityVisibility('${toOnclickStringArg(p.id)}', true)">Mostrar</button>
      </div>
      ${preview}
    </div>`;
  }
  const filt = getProjectActivityFilter();
  const idLit = JSON.stringify(p.id);
  const taskFamily =
    filt === 'tasks' ||
    filt === 'task_completed' ||
    filt === 'task_added' ||
    filt === 'task_deleted' ||
    filt === 'task_updated' ||
    filt === 'task_reopened';
  const chips = `
    <div class="project-activity-filters" role="tablist" aria-label="Filtrar actividad">
      <button type="button" class="proj-act-chip ${filt === 'all' ? 'is-active' : ''}" role="tab" aria-selected="${filt === 'all' ? 'true' : 'false'}" onclick="setProjectActivityFilter('all', ${idLit})">Todos</button>
      <button type="button" class="proj-act-chip ${taskFamily ? 'is-active' : ''}" role="tab" aria-selected="${taskFamily ? 'true' : 'false'}" onclick="setProjectActivityFilter('tasks', ${idLit})">Tareas</button>
      <button type="button" class="proj-act-chip ${filt === 'templates' ? 'is-active' : ''}" role="tab" aria-selected="${filt === 'templates' ? 'true' : 'false'}" onclick="setProjectActivityFilter('templates', ${idLit})">Plantillas</button>
    </div>
    ${
      taskFamily
        ? `<div class="project-activity-filters project-activity-filters--sub" role="tablist" aria-label="Tipo de evento de tarea">
      <button type="button" class="proj-act-chip proj-act-chip--sub ${filt === 'tasks' ? 'is-active' : ''}" role="tab" onclick="setProjectActivityFilter('tasks', ${idLit})">Todas</button>
      <button type="button" class="proj-act-chip proj-act-chip--sub ${filt === 'task_completed' ? 'is-active' : ''}" role="tab" onclick="setProjectActivityFilter('task_completed', ${idLit})">Completadas</button>
      <button type="button" class="proj-act-chip proj-act-chip--sub ${filt === 'task_added' ? 'is-active' : ''}" role="tab" onclick="setProjectActivityFilter('task_added', ${idLit})">Añadidas</button>
      <button type="button" class="proj-act-chip proj-act-chip--sub ${filt === 'task_deleted' ? 'is-active' : ''}" role="tab" onclick="setProjectActivityFilter('task_deleted', ${idLit})">Eliminadas</button>
      <button type="button" class="proj-act-chip proj-act-chip--sub ${filt === 'task_updated' ? 'is-active' : ''}" role="tab" onclick="setProjectActivityFilter('task_updated', ${idLit})">Editadas</button>
      <button type="button" class="proj-act-chip proj-act-chip--sub ${filt === 'task_reopened' ? 'is-active' : ''}" role="tab" onclick="setProjectActivityFilter('task_reopened', ${idLit})">Reabiertas</button>
    </div>`
        : ''
    }`;
  const filtered = log.filter(e => activityEntryMatchesFilter(e, filt));
  const rows = filtered.slice(0, 20).map(e => {
    const evt = String(e.type || 'other').replace(/[^a-z0-9_]/gi, '');
    return `
    <div class="project-activity-row project-activity-row--evt-${evt}">
      <span class="project-activity-text">${projectActivityLine(e)}</span>
      <span class="project-activity-when">${formatActivityRelative(e.at)}</span>
    </div>`;
  }).join('');
  return `
    <div class="project-activity-block">
      <div class="project-activity-header">
        <span class="proj-section-heading">Actividad reciente</span>
        <button type="button" class="project-activity-toggle" onclick="toggleProjectActivityVisibility('${toOnclickStringArg(p.id)}', false)">Ocultar</button>
      </div>
      ${chips}
      <div class="project-activity-list">${rows || '<div class="project-activity-empty">Sin entradas en este filtro.</div>'}</div>
    </div>`;
}

export function toggleProjectActivityVisibility(projectId, expand) {
  const set = getProjectActivityExpandedSet();
  const key = String(projectId);
  if (expand) set.add(key);
  else set.delete(key);
  setProjectActivityExpandedSet(set);
  if (currentProjectId && sameId(currentProjectId, projectId)) {
    selectProject(projectId);
  }
}

let _taskSortMode = 'default'; // 'default' | 'priority' | 'dueDate' | 'status'
let _taskSearchQuery = '';
let _editingTaskDeps = [];

const PROJECTS_TREE_COLLAPSED_LS = 'projects_tree_collapsed_v1';

export function toggleProjectsTreeCollapsed() {
  try {
    const on = localStorage.getItem(PROJECTS_TREE_COLLAPSED_LS) === '1';
    localStorage.setItem(PROJECTS_TREE_COLLAPSED_LS, on ? '0' : '1');
  } catch (_) { /* noop */ }
  syncProjectsTreePanelCollapse();
}

function syncProjectsTreePanelCollapse() {
  const root = document.getElementById('projects-layout-root');
  if (!root) return;
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(PROJECTS_TREE_COLLAPSED_LS) === '1';
  } catch (_) { /* noop */ }
  root.classList.toggle('projects-layout--tree-collapsed', collapsed);
  const collapseHandle = root.querySelector('.projects-edge-toggle--collapse');
  const expandHandle = root.querySelector('.projects-edge-toggle--expand');
  if (collapseHandle) collapseHandle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  if (expandHandle) expandHandle.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
}

function toOnclickStringArg(val) {
  if (val == null) return '';
  return String(val).replace(/'/g, "\\'");
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
  const cnt = document.getElementById('task-deps-section-count');
  if (cnt) cnt.textContent = deps.length ? `(${deps.length})` : '';
  if (!deps.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = deps.map(depId => {
    const depTask = p?.tasks.find(t => sameId(t.id, depId));
    const overdueDep = !!(depTask && !depTask.done && isTaskDueDateOverdue(depTask.dueDate, depTask.done));
    return `<div class="task-dep-chip${overdueDep ? ' task-dep-chip--dep-overdue' : ''}">
      <span class="task-dep-chip__main">
        <span class="task-dep-chip__lock" aria-hidden="true">🔒</span>
        ${escapeChatHtml(depTask?.name || 'Tarea eliminada')}
        ${depTask?.done ? '<span class="task-dep-chip__done">Completada</span>' : ''}
        ${overdueDep ? '<span class="task-dep-chip__overdue-tag">Vencida</span>' : ''}
      </span>
      <button type="button" class="task-dep-chip__remove" onclick="removeTaskDep('${toOnclickStringArg(depId)}')" aria-label="Quitar dependencia">✕</button>
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

function announceProjectsUserFilter(message) {
  const el = document.getElementById('projects-filter-announce');
  if (!el || !message) return;
  el.textContent = '';
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

/** Carril «Filtrar por» retirado de la UI; se mantiene la exportación por compatibilidad. */
export function renderProjectUserFilter() {
  /* noop */
}

export function setProjectUserFilter(userId) {
  setProjectUserFilterState(userId);
  renderProjects();
  const u = userId != null ? USERS.find(x => x.id === userId) : null;
  announceProjectsUserFilter(
    u ? `Filtrando árbol de proyectos por ${u.name}` : 'Filtro de miembro quitado: se muestran todos los proyectos'
  );
}

/** Árbol izquierdo: filtro por nombre (incluye coincidencias en subárbol). */
export function filterProjectsTreeSearch(raw) {
  _projectTreeSearchQuery = String(raw || '');
  renderProjects();
}

export function toggleProjectsListDrawer(open) {
  const root = document.getElementById('projects-layout-root');
  if (!root) return;
  root.classList.toggle('projects-layout--drawer-open', !!open);
  const btn = document.querySelector('.projects-mobile-tree-btn');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function computeTreeSearchAllowedIds(visibleProjects, nq) {
  const ids = new Set();
  const byId = new Map(visibleProjects.map(p => [String(p.id), p]));
  visibleProjects.forEach(p => {
    if (!normalizeTaskSearchText(p.name).includes(nq)) return;
    ids.add(String(p.id));
    let x = p;
    let g = 0;
    while (x.parentProjectId && g++ < 64) {
      const par = byId.get(String(x.parentProjectId));
      if (!par) break;
      ids.add(String(par.id));
      x = par;
    }
  });
  let chg = true;
  while (chg) {
    chg = false;
    visibleProjects.forEach(p => {
      const pid = String(p.id);
      if (ids.has(pid)) return;
      if (p.parentProjectId && ids.has(String(p.parentProjectId))) {
        ids.add(pid);
        chg = true;
      }
    });
  }
  return ids;
}

export function initProjectsDeepLinkFromHash() {
  if (_projectsDeepLinkBound) return;
  _projectsDeepLinkBound = true;
  window.addEventListener('hashchange', () => {
    applyProjectsDeepLinkFromHash();
  });
}

export function applyProjectsDeepLinkFromHash() {
  const parsed = parseProjectsDeepLink();
  if (!parsed) return false;
  const p = projects.find(pr => sameId(pr.id, parsed.projectId));
  if (!p || !userCanSeeProject(p)) return false;
  window.__fromProjectsDeepLink = true;
  if (currentView !== 'projects' && typeof window.showView === 'function') {
    window.showView('projects', null);
  }
  requestAnimationFrame(() => {
    selectProject(parsed.projectId);
    if (parsed.taskId) {
      const t = p.tasks.find(tk => sameId(tk.id, parsed.taskId));
      if (t) openTaskViewer(parsed.projectId, parsed.taskId);
    }
    window.__fromProjectsDeepLink = false;
  });
  return true;
}

export function dismissProjectRemoteStaleBanner() {
  _projectTasksStaleFromRemote = false;
  if (currentProjectId) selectProject(currentProjectId);
}

export function renderProjects() {
  const list = document.getElementById('projects-list');
  const statusLabels = {activo:'✅ Activo',pausa:'⏸ En Pausa',completado:'🏁 Completado'};
  let visibleProjects = projects.filter(p => userCanSeeProject(p));
  if (projectUserFilter !== null) {
    visibleProjects = visibleProjects.filter(p => projectSubtreeHasAssignee(p, projectUserFilter, new Set()));
  }

  if (currentProjectId) expandProjectTreeAncestors(currentProjectId);

  const nqTree = normalizeTaskSearchText(_projectTreeSearchQuery).trim();
  const allowedTreeIds = nqTree ? computeTreeSearchAllowedIds(visibleProjects, nqTree) : null;

  function isDisplayedRoot(proj) {
    if (proj.parentProjectId == null) return true;
    const par = visibleProjects.find(vp => sameId(vp.id, proj.parentProjectId));
    return !par;
  }

  const roots = visibleProjects.filter(isDisplayedRoot).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  function rowHtml(proj, depth) {
    if (allowedTreeIds && !allowedTreeIds.has(String(proj.id))) return '';
    const childs = visibleProjects
      .filter(c => sameId(c.parentProjectId, proj.id))
      .filter(c => !allowedTreeIds || allowedTreeIds.has(String(c.id)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const subCount = childs.length;
    const collapsed = subCount > 0 && getProjectTreeCollapsedSet().has(String(proj.id));
    const tasksToShow = projectUserFilter !== null
      ? (proj.tasks || []).filter(t =>
          sameId(t.assignedTo, projectUserFilter) ||
          sameId(t.assigneeId, projectUserFilter)
        )
      : (proj.tasks || []);
    const done = tasksToShow.filter(t =>
      t.done === true || t.done === 'true' || t.status === 'done'
    ).length;
    const total = tasksToShow.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const progressBar = total > 0 ? `
  <div class="project-tree-progress">
    <div class="project-tree-progress-fill" style="width:${pct}%"></div>
  </div>` : '';
    const overdueTasks = tasksToShow.filter(t => isTaskDueDateOverdue(t.dueDate, t.done)).length;
    const pComments = commentIndicators('project', proj.id);
    const pLast = getLatestCommentPreview('project', proj.id);
    const commentTooltip = pLast ? ` title="${escapeChatHtml(pLast.substring(0, 100))}"` : '';
    const pad = Math.min(depth, 12) * 10;
    const projIdArg = toOnclickStringArg(proj.id);
    const toggleBtn = subCount
      ? `<button type="button" class="project-tree-toggle" onclick="toggleProjectTreeCollapse('${projIdArg}',event)" aria-expanded="${!collapsed}"${commentTooltip} title="${collapsed ? 'Expandir subproyectos' : 'Contraer subproyectos'}${pLast ? ' — ' + escapeChatHtml(pLast.substring(0, 80)) : ''}">${collapsed ? '▸' : '▾'}</button>`
      : '<span class="project-tree-toggle-spacer"></span>';
    const rowInner = `<div class="project-item project-item-depth ${depth > 0 ? 'subproject' : ''} ${sameId(currentProjectId, proj.id) ? 'active' : ''}" style="padding-left:${8 + pad}px;--project-color:${proj.color}" data-project-id="${proj.id}" data-depth="${depth}" data-project-color="${proj.color}" onclick="selectProject('${projIdArg}')" oncontextmenu="showProjectTreeContextMenu(event,'${projIdArg}');return false;">
      <div class="project-item-row-head">
        ${toggleBtn}
        <div class="project-item-row-body">
          <div class="project-item-name">
            <span class="project-item-name-text" title="${escapeChatHtml(proj.name)}">${escapeChatHtml(proj.name)}</span>
            ${subCount ? `<span class="project-subcount-pill" title="${subCount} subproyecto${subCount !== 1 ? 's' : ''}" aria-label="${subCount} subproyectos"><span class="project-subcount-pill__icon" aria-hidden="true">⎘</span><span class="project-subcount-pill__n">${subCount}</span></span>` : ''}
            ${overdueTasks > 0 ? `<span class="project-item-overdue-dot" title="${overdueTasks} tarea${overdueTasks !== 1 ? 's' : ''} vencida${overdueTasks !== 1 ? 's' : ''}"></span>` : ''}
          </div>
          <div class="project-item-meta">
            <span>${statusLabels[proj.status]}</span>
            <span>${done}/${total} tareas${projectUserFilter !== null ? ' asignadas' : ''}</span>
            ${overdueTasks > 0
              ? `<span class="project-item-meta-overdue">⚠ ${overdueTasks} vencida${overdueTasks !== 1 ? 's' : ''}</span>`
              : ''}
          </div>
          ${progressBar}
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
  roots.forEach(r => {
    treeHtml += rowHtml(r, 0);
  });

  const countShown = allowedTreeIds
    ? visibleProjects.filter(p => allowedTreeIds.has(String(p.id))).length
    : visibleProjects.length;
  document.getElementById('projects-count').textContent = String(countShown);

  const treeIn = document.getElementById('projects-tree-search');
  if (treeIn && document.activeElement !== treeIn) {
    treeIn.value = _projectTreeSearchQuery || '';
  }

  const emptyTreeMsg = nqTree
    ? 'Ningún proyecto coincide con el buscador del árbol'
    : projectUserFilter !== null
      ? 'Sin proyectos con esas asignaciones en el árbol'
      : 'Sin proyectos aún';

  list.innerHTML = treeHtml.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🎯</div><div>${emptyTreeMsg}</div></div>`
    : treeHtml;

  if (currentProjectId && visibleProjects.find(pr => sameId(pr.id, currentProjectId))) {
    selectProject(currentProjectId);
  } else if (visibleProjects.length === 0) {
    document.getElementById('project-detail').innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div>Selecciona un proyecto para ver sus detalles</div></div>`;
  }

  const ob = document.getElementById('projects-onboarding-banner');
  if (ob) {
    try {
      if (localStorage.getItem('diario_projects_onboarding_dismissed_v1')) ob.classList.add('hidden');
      else ob.classList.remove('hidden');
    } catch (_) {
      ob.classList.add('hidden');
    }
  }
  syncProjectsTreePanelCollapse();
  bindProjectsViewShortcutsOnce();
  initProjectsDeepLinkFromHash();
}

function normalizeTaskSearchText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function taskCommentsSearchBlob(projectId, taskId) {
  return comments
    .filter(c => c.kind === 'task' && sameId(c.targetId, projectId) && sameId(c.extraId, taskId))
    .map(c => String(c.body || ''))
    .join('\n');
}

function taskMatchesSearch(t, rawQ, projectId) {
  const q = normalizeTaskSearchText(rawQ).trim();
  if (!q) return true;
  const name = normalizeTaskSearchText(t.name);
  const desc = normalizeTaskSearchText(t.desc || '');
  const fromComments =
    projectId != null ? normalizeTaskSearchText(taskCommentsSearchBlob(projectId, t.id)) : '';
  return name.includes(q) || desc.includes(q) || fromComments.includes(q);
}

function analyzeProjectTasks(tasks) {
  const arr = Array.isArray(tasks) ? tasks : [];
  const total = arr.length;
  const done = arr.filter(t => t.done === true || t.done === 'true' || t.status === 'done').length;
  const pending = arr.filter(t => !t.done && t.status !== 'progress').length;
  const inProgress = arr.filter(t => !t.done && t.status === 'progress').length;
  const overdue = arr.filter(t => isTaskDueDateOverdue(t.dueDate, t.done)).length;
  const alta = arr.filter(t => t.priority === 'alta').length;
  const media = arr.filter(t => t.priority === 'media').length;
  const normal = arr.filter(t => !t.priority || t.priority === 'normal').length;
  const totalEstimated = arr.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  const totalReal = arr.reduce((sum, t) => sum + (Number(t.realHours) || 0), 0);
  const hoursEfficiency = totalEstimated > 0 ? Math.round(totalReal / totalEstimated * 100) : null;
  const byAssignee = {};
  arr.forEach(t => {
    const key = t.assigneeId || t.assignedTo || '__none__';
    if (!byAssignee[key]) byAssignee[key] = { done: 0, total: 0, overdue: 0 };
    byAssignee[key].total++;
    if (t.done === true || t.done === 'true' || t.status === 'done') byAssignee[key].done++;
    if (isTaskDueDateOverdue(t.dueDate, t.done)) {
      byAssignee[key].overdue++;
    }
  });
  const unassigned = arr.filter(t => !t.assigneeId && !t.assignedTo).length;
  return {
    arr, total, done, pending, inProgress, overdue, alta, media, normal,
    totalEstimated, totalReal, hoursEfficiency, byAssignee, unassigned,
  };
}

function renderProjectQuickStrip(p) {
  const m = analyzeProjectTasks(p.tasks || []);
  if (m.total === 0) return '';
  const parts = [
    `<span class="project-quick-strip__metric" title="Tareas completadas respecto al total del proyecto">${m.done}/${m.total} hechas</span>`,
    `<span class="project-quick-strip__sep" aria-hidden="true">·</span>`,
    `<span class="project-quick-strip__metric" title="Tareas pendientes (no hechas, no en progreso)">${m.pending} pend.</span>`,
    `<span class="project-quick-strip__sep" aria-hidden="true">·</span>`,
    `<span class="project-quick-strip__metric" title="Tareas marcadas como en progreso">${m.inProgress} en curso</span>`,
  ];
  if (m.overdue > 0) {
    parts.push(`<span class="project-quick-strip__sep" aria-hidden="true">·</span>`);
    parts.push(
      `<span class="project-quick-strip__warn project-quick-strip__metric" title="Pendientes con fecha de vencimiento pasada">${m.overdue} vencidas</span>`
    );
  }
  if (m.unassigned > 0) {
    parts.push(`<span class="project-quick-strip__sep" aria-hidden="true">·</span>`);
    parts.push(
      `<span class="project-quick-strip__metric" title="Tareas sin responsable asignado">${m.unassigned} sin asignar</span>`
    );
  }
  return `<div class="project-quick-strip-region"><div class="project-quick-strip" role="status">${parts.join('')}</div></div>`;
}

let _projectActionsMenuOutsideBound = false;
function ensureProjectActionsMenuOutsideClose() {
  if (_projectActionsMenuOutsideBound) return;
  _projectActionsMenuOutsideBound = true;
  document.addEventListener(
    'mousedown',
    e => {
      if (e.target.closest?.('.project-header-actions__more-wrap')) return;
      const menu = document.getElementById('project-actions-menu');
      if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        const btn = document.getElementById('project-actions-more-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    },
    true
  );
}

function closeProjectActionsMenuIfOpen() {
  const menu = document.getElementById('project-actions-menu');
  const btn = document.getElementById('project-actions-more-btn');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

let _projectDetailMenuMutexBound = false;
/** Solo un <details> abierto a la vez en el detalle; al abrir uno se cierra el menú «Más». */
function bindProjectDetailMenuMutexOnce() {
  if (_projectDetailMenuMutexBound) return;
  _projectDetailMenuMutexBound = true;
  document.addEventListener(
    'toggle',
    e => {
      const t = e.target;
      if (!(t instanceof HTMLDetailsElement) || !t.open) return;
      const root = t.closest('#project-detail-root');
      if (!root) return;
      root.querySelectorAll('details').forEach(d => {
        if (d !== t && d.open) d.open = false;
      });
      closeProjectActionsMenuIfOpen();
    },
    true
  );
}

/** @param {boolean} [forceClose] true: cerrar menú (desde ítems). */
export function toggleProjectActionsMenu(forceClose) {
  ensureProjectActionsMenuOutsideClose();
  bindProjectDetailMenuMutexOnce();
  const menu = document.getElementById('project-actions-menu');
  const btn = document.getElementById('project-actions-more-btn');
  if (!menu || !btn) return;
  if (forceClose === true) {
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    return;
  }
  menu.classList.toggle('hidden');
  const open = !menu.classList.contains('hidden');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    document.querySelectorAll('#project-detail details').forEach(d => {
      d.open = false;
    });
  }
}

export function dismissProjectsOnboarding() {
  try {
    localStorage.setItem('diario_projects_onboarding_dismissed_v1', '1');
  } catch (_) { /* ignore */ }
  document.getElementById('projects-onboarding-banner')?.classList.add('hidden');
}

export function openProjectsShortcutsModal() {
  openModal('projects-shortcuts-modal');
}

export function setProjectActivityFilter(filter, projectId) {
  const allowed = new Set([
    'all', 'templates', 'tasks', 'task_completed', 'task_added', 'task_deleted', 'task_updated', 'task_reopened',
  ]);
  const f = allowed.has(filter) ? filter : 'all';
  try {
    localStorage.setItem(PROJECT_ACTIVITY_FILTER_LS, f);
  } catch (_) { /* noop */ }
  selectProject(projectId);
}

export function toggleProjectStatsCompactLayout() {
  const root = document.getElementById('project-detail-root');
  if (!root) return;
  root.classList.toggle('project-detail-root--stats-compact');
  try {
    localStorage.setItem(
      PROJECT_STATS_COMPACT_LS,
      root.classList.contains('project-detail-root--stats-compact') ? '1' : '0'
    );
  } catch (_) { /* noop */ }
}

function projectToolbarCloseAll() {
  document.querySelectorAll('#project-detail .tasks-toolbar-dd').forEach(d => {
    d.open = false;
  });
}

export function projectToolbarPickSort(mode, projectIdStr, el) {
  projectToolbarCloseAll();
  if (el && el.closest) el.closest('details')?.removeAttribute('open');
  setTaskSort(mode, projectIdStr);
}

export function projectToolbarPickView(mode, projectIdStr, el) {
  projectToolbarCloseAll();
  if (el && el.closest) el.closest('details')?.removeAttribute('open');
  setProjectViewMode(mode, projectIdStr);
}

export function kanbanColDragOver(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('kanban-col--drag-over');
}

export function kanbanColDragLeave(ev) {
  const col = ev.currentTarget;
  if (!col || !col.classList.contains('kanban-col')) return;
  const rel = ev.relatedTarget;
  if (rel && col.contains(rel)) return;
  col.classList.remove('kanban-col--drag-over');
}

export function closeTaskRowMenu(el) {
  const dd = el && el.closest ? el.closest('details.task-item-dd') : null;
  if (dd) dd.open = false;
}

function syncProjAssigneeDisclosureViewport() {
  const det = document.querySelector('#project-detail .proj-assignee-disclosure');
  if (!det) return;
  try {
    const mq = window.matchMedia('(max-width: 900px)');
    if (mq.matches) det.removeAttribute('open');
    else det.setAttribute('open', '');
  } catch (_) { /* noop */ }
}

let _projAssigneeMqlBound = false;
function bindProjAssigneeDisclosureMqlOnce() {
  if (_projAssigneeMqlBound) return;
  _projAssigneeMqlBound = true;
  try {
    const mq = window.matchMedia('(max-width: 900px)');
    mq.addEventListener('change', () => syncProjAssigneeDisclosureViewport());
  } catch (_) { /* noop */ }
}

function bindTaskListRovingFocus() {
  const root = document.getElementById('project-detail-root');
  if (!root || (window._projectViewMode || 'list') !== 'list') return;
  if (root._taskRovingHandler) {
    root.removeEventListener('keydown', root._taskRovingHandler);
    root._taskRovingHandler = null;
  }
  const handler = e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const wrap = root.querySelector('.project-task-list-root');
    if (!wrap || !wrap.contains(e.target)) return;
    const items = [...wrap.querySelectorAll('.task-item')];
    if (!items.length) return;
    let i = items.indexOf(document.activeElement);
    if (i < 0) {
      const host = document.activeElement?.closest?.('.task-item');
      i = host ? items.indexOf(host) : 0;
    }
    if (e.key === 'ArrowDown') i = Math.min(items.length - 1, i + 1);
    else i = Math.max(0, i - 1);
    items[i].focus();
    e.preventDefault();
  };
  root._taskRovingHandler = handler;
  root.addEventListener('keydown', handler);
}

function applyAfterProjectDetailRender() {
  bindProjectDetailMenuMutexOnce();
  const root = document.getElementById('project-detail-root');
  if (root) {
    try {
      if (localStorage.getItem(PROJECT_STATS_COMPACT_LS) === '1') {
        root.classList.add('project-detail-root--stats-compact');
      }
    } catch (_) { /* noop */ }
  }
  updateProjectMultiselectBar();
  bindProjectsNetworkStatusOnce();
  bindProjAssigneeDisclosureMqlOnce();
  syncProjAssigneeDisclosureViewport();
  bindTaskListRovingFocus();
  const strip = document.getElementById('projects-sync-strip');
  if (strip) {
    if (getProjectsSavePendingCount() > 0) {
      /* projectsTrackedUpdateProject ya dejó mensaje en cola */
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      strip.textContent = 'Sin conexión. Los cambios pueden no guardarse en el servidor.';
      strip.classList.add('is-offline');
      strip.classList.remove('is-ready');
    } else {
      strip.classList.remove('is-offline');
      strip.classList.add('is-ready');
      if (!strip.textContent) strip.textContent = '';
    }
  }
}

function bindProjectsNetworkStatusOnce() {
  if (_projectsNetworkBound) return;
  _projectsNetworkBound = true;
  const sync = () => {
    const el = document.getElementById('projects-sync-strip');
    if (!el || currentView !== 'projects') return;
    if (getProjectsSavePendingCount() > 0) return;
    el.classList.remove('is-offline', 'is-saving');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      el.textContent = 'Sin conexión. Los cambios pueden no guardarse en el servidor.';
      el.classList.add('is-offline');
      el.classList.remove('is-ready');
    } else {
      el.classList.remove('is-offline');
      el.classList.add('is-ready');
      el.textContent = '';
    }
  };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
}

export function toggleProjectTaskMultiselect(projectId) {
  _projectTaskMultiselect = !_projectTaskMultiselect;
  if (!_projectTaskMultiselect) _selectedTaskIds.clear();
  if (projectId != null) selectProject(projectId);
}

export function toggleProjectTaskSelect(projectIdStr, taskIdStr, checked) {
  const proj = projects.find(pr => sameId(pr.id, projectIdStr));
  const t = proj?.tasks.find(x => sameId(x.id, taskIdStr));
  if (!t) return;
  const key = String(t.id);
  if (checked) _selectedTaskIds.add(key);
  else _selectedTaskIds.delete(key);
  updateProjectMultiselectBar();
}

export function clearProjectTaskMultiselect(projectId) {
  void projectId;
  _selectedTaskIds.clear();
  _projectTaskMultiselect = false;
  updateProjectMultiselectBar();
  if (currentProjectId && sameId(currentProjectId, projectId)) {
    selectProject(projectId);
  }
}

function updateProjectMultiselectBar() {
  const bar = document.getElementById('project-task-multiselect-bar');
  if (!bar) return;
  const cnt = document.getElementById('project-ms-count');
  const n = _selectedTaskIds.size;
  if (cnt) {
    cnt.textContent = `${n} seleccionada${n !== 1 ? 's' : ''}`;
  }
  bar.classList.toggle('hidden', !_projectTaskMultiselect);
}

export function toggleProjectTaskListDensity() {
  try {
    if (localStorage.getItem(PROJECT_TASK_LIST_DENSITY_LS) === 'compact') {
      localStorage.removeItem(PROJECT_TASK_LIST_DENSITY_LS);
    } else {
      localStorage.setItem(PROJECT_TASK_LIST_DENSITY_LS, 'compact');
    }
  } catch (_) { /* noop */ }
  if (currentProjectId) selectProject(currentProjectId);
}

export async function batchMarkSelectedTasksDone(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p || _selectedTaskIds.size === 0) return;
  const tasksBackup = JSON.parse(JSON.stringify(p.tasks || []));
  const logBackup = Array.isArray(p.activityLog) ? JSON.parse(JSON.stringify(p.activityLog)) : null;
  let changed = false;
  for (const t of p.tasks) {
    if (_selectedTaskIds.has(String(t.id)) && !t.done) {
      t.done = true;
      t.status = 'done';
      pushProjectActivity(p, { type: 'task_completed', taskName: t.name, taskId: t.id });
      changed = true;
    }
  }
  if (!changed) {
    showToast('Nada que marcar (ya completadas o vacío)', 'info');
    return;
  }
  _selectedTaskIds.clear();
  _projectTaskMultiselect = false;
  try {
    const mongoId = p._id || p.id;
    const payload = { tasks: p.tasks };
    if (Array.isArray(p.activityLog)) payload.activityLog = p.activityLog;
    await projectsTrackedUpdateProject(mongoId, payload);
    showToast('Tareas marcadas como completadas', 'success', 4000, {
      undoLabel: 'Deshacer',
      onUndo: () => {
        p.tasks = tasksBackup;
        if (logBackup) p.activityLog = logBackup;
        const mid = p._id || p.id;
        const pl = { tasks: p.tasks };
        if (Array.isArray(p.activityLog)) pl.activityLog = p.activityLog;
        projectsTrackedUpdateProject(mid, pl).then(() => {
          saveProjectData();
          renderProjects();
          selectProject(projectId);
        });
      },
    });
  } catch (err) {
    console.error(err);
    p.tasks = tasksBackup;
    if (logBackup) p.activityLog = logBackup;
    showToast('Error al guardar el lote', 'error');
  }
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

export async function batchApplyAssigneeToSelection(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const sel = document.getElementById('batch-ms-assignee');
  const uid = sel && sel.value ? String(sel.value) : '';
  if (!p || !uid || _selectedTaskIds.size === 0) {
    showToast('Selecciona tareas y un usuario', 'info');
    return;
  }
  const tasksBackup = JSON.parse(JSON.stringify(p.tasks || []));
  let n = 0;
  for (const t of p.tasks) {
    if (!_selectedTaskIds.has(String(t.id))) continue;
    t.assigneeId = uid;
    t.assignedTo = uid;
    pushProjectActivity(p, { type: 'task_updated', taskName: t.name, taskId: t.id });
    n++;
  }
  try {
    const mongoId = p._id || p.id;
    const payload = { tasks: p.tasks };
    if (Array.isArray(p.activityLog)) payload.activityLog = p.activityLog;
    await projectsTrackedUpdateProject(mongoId, payload);
    showToast(`Asignación aplicada a ${n} tarea(s)`, 'success');
  } catch (err) {
    console.error(err);
    p.tasks = tasksBackup;
    showToast('No se pudo guardar la asignación', 'error');
  }
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

export async function batchApplyDueToSelection(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const inp = document.getElementById('batch-ms-due');
  const due = inp && inp.value ? String(inp.value) : '';
  if (!p || !due || _selectedTaskIds.size === 0) {
    showToast('Selecciona tareas y una fecha', 'info');
    return;
  }
  const tasksBackup = JSON.parse(JSON.stringify(p.tasks || []));
  let n = 0;
  for (const t of p.tasks) {
    if (!_selectedTaskIds.has(String(t.id))) continue;
    t.dueDate = due;
    pushProjectActivity(p, { type: 'task_updated', taskName: t.name, taskId: t.id });
    n++;
  }
  try {
    const mongoId = p._id || p.id;
    const payload = { tasks: p.tasks };
    if (Array.isArray(p.activityLog)) payload.activityLog = p.activityLog;
    await projectsTrackedUpdateProject(mongoId, payload);
    showToast(`Fecha aplicada a ${n} tarea(s)`, 'success');
  } catch (err) {
    console.error(err);
    p.tasks = tasksBackup;
    showToast('No se pudo guardar la fecha', 'error');
  }
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

export async function batchApplyPriorityToSelection(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  const sel = document.getElementById('batch-ms-priority');
  const prioVal = sel && sel.value ? String(sel.value) : 'normal';
  if (!p || _selectedTaskIds.size === 0) {
    showToast('Selecciona al menos una tarea', 'info');
    return;
  }
  const tasksBackup = JSON.parse(JSON.stringify(p.tasks || []));
  let n = 0;
  for (const t of p.tasks) {
    if (!_selectedTaskIds.has(String(t.id))) continue;
    t.priority = prioVal;
    pushProjectActivity(p, { type: 'task_updated', taskName: t.name, taskId: t.id });
    n++;
  }
  try {
    const mongoId = p._id || p.id;
    const payload = { tasks: p.tasks };
    if (Array.isArray(p.activityLog)) payload.activityLog = p.activityLog;
    await projectsTrackedUpdateProject(mongoId, payload);
    showToast(`Prioridad aplicada a ${n} tarea(s)`, 'success');
  } catch (err) {
    console.error(err);
    p.tasks = tasksBackup;
    showToast('No se pudo guardar la prioridad', 'error');
  }
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

export function openAddTaskModalWithColumn(projectId, colId) {
  window._taskModalPresetColumn = colId;
  openAddTaskModal(projectId);
}

export function exitMyWorkTasksView() {
  exitProjectPresentationMode();
  setCurrentProjectId(null);
  _taskSearchQuery = '';
  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
  const d = document.getElementById('project-detail');
  if (d) {
    d.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div>Selecciona un proyecto para ver sus detalles</div></div>`;
  }
  renderProjects();
}

/** Cierra el modo presentación (barra lateral, árbol y cromo extra ocultos). */
export function exitProjectPresentationMode() {
  if (!_projectPresentationMode) return;
  _projectPresentationMode = false;
  document.documentElement.classList.remove('project-presentation-mode');
  const legacy = document.getElementById('project-presentation-exit');
  if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
}

/**
 * Alterna modo presentación: solo el panel del proyecto, máximo espacio.
 * Requiere vista Proyectos y un proyecto abierto. Esc o «Volver» en la cinta de presentación lo cierran.
 */
export function toggleProjectPresentationMode() {
  if (currentView !== 'projects') return;
  if (_projectPresentationMode) {
    exitProjectPresentationMode();
    return;
  }
  if (!currentProjectId) return;
  _projectPresentationMode = true;
  document.documentElement.classList.add('project-presentation-mode');
}

let _projectsShortcutsBound = false;
function bindProjectsViewShortcutsOnce() {
  if (_projectsShortcutsBound) return;
  _projectsShortcutsBound = true;
  document.addEventListener('keydown', e => {
    if (currentView !== 'projects') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (document.documentElement.classList.contains('project-presentation-mode')) {
        e.preventDefault();
        exitProjectPresentationMode();
        return;
      }
      const openDds = document.querySelectorAll('#project-detail .tasks-toolbar-dd[open]');
      if (openDds.length) {
        e.preventDefault();
        openDds.forEach(d => {
          d.open = false;
        });
        return;
      }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (document.activeElement?.closest?.('details[open].tasks-toolbar-dd')) return;
      if (!currentProjectId) return;
      const nodes = [...document.querySelectorAll('#projects-list .project-item[data-project-id]')];
      if (!nodes.length) return;
      const cur = document.querySelector('#projects-list .project-item.active');
      let idx = cur ? nodes.indexOf(cur) : -1;
      if (e.key === 'ArrowDown') idx = Math.min(nodes.length - 1, idx + 1);
      else idx = Math.max(0, idx - 1);
      if (idx < 0) idx = 0;
      const row = nodes[idx];
      const pidAttr = row && row.getAttribute('data-project-id');
      if (pidAttr) {
        e.preventDefault();
        selectProject(pidAttr);
      }
      return;
    }
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      if (!currentProjectId) return;
      e.preventDefault();
      const modes = { 1: 'list', 2: 'kanban', 3: 'calendar' };
      setProjectViewMode(modes[e.key], currentProjectId);
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('task-search-input')?.focus();
    } else if (e.key === '?') {
      e.preventDefault();
      openProjectsShortcutsModal();
    } else if (e.key === 'n' || e.key === 'N') {
      if (!currentProjectId) return;
      e.preventDefault();
      openAddTaskModal(currentProjectId);
    }
  });
}

function getSortedTasks(p) {
  const tasks = p.tasks || [];
  let arr = [...tasks];

  if (_taskSearchQuery.trim()) {
    arr = arr.filter(t => taskMatchesSearch(t, _taskSearchQuery, p.id));
  }

  if (projectDetailOnlyMineActive() && currentUser) {
    arr = arr.filter(
      t => sameId(t.assigneeId, currentUser.id) || sameId(t.assignedTo, currentUser.id)
    );
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
        const da = parseProjectTaskDueDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const db = parseProjectTaskDueDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return da - db;
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

export function loadMoreProjectTasksPage(projectId) {
  _taskListPage++;
  selectProject(projectId);
}

function renderTasksList(p) {
  const pidArg = toOnclickStringArg(p.id);
  if (p.tasks.length === 0) {
    return `<div class="empty-state project-view-empty" role="status">
      <div class="project-view-empty__icon" aria-hidden="true">📋</div>
      <div class="project-view-empty__title">Sin tareas aún</div>
      <p class="project-view-empty-hint">Crea la primera tarea para seguir el avance del proyecto.</p>
      <button type="button" class="btn-primary project-view-empty__cta" onclick="openAddTaskModal('${pidArg}')">+ Añadir tarea</button>
    </div>`;
  }
  const pid = pidArg;
  const sortedAll = getSortedTasks(p);
  if (sortedAll.length === 0 && _taskSearchQuery.trim()) {
    return `<div class="empty-state project-view-empty project-tasks-empty-search" role="status">
      <div class="project-view-empty__icon" aria-hidden="true">🔎</div>
      <div class="project-view-empty__title">Sin resultados</div>
      <p class="project-view-empty-hint">Ninguna tarea coincide con «${escapeChatHtml(_taskSearchQuery.trim())}».</p>
      <button type="button" class="btn-secondary project-view-empty__cta" onclick="filterTaskSearch('','${pid}')">Limpiar búsqueda</button>
    </div>`;
  }
  if (sortedAll.length === 0 && projectDetailOnlyMineActive()) {
    return `<div class="empty-state project-view-empty" role="status">
      <div class="project-view-empty__icon" aria-hidden="true">👤</div>
      <div class="project-view-empty__title">Nada que mostrar con «Solo mías»</div>
      <p class="project-view-empty-hint">Este filtro oculta las tareas no asignadas a ti.</p>
      <button type="button" class="btn-secondary project-view-empty__cta" onclick="toggleProjectDetailOnlyMine('${pid}')">Ver todas las tareas</button>
    </div>`;
  }
  let showCommentPreview = true;
  try {
    showCommentPreview = localStorage.getItem(PROJECT_TASK_LIST_DENSITY_LS) !== 'compact';
  } catch (_) { /* noop */ }
  const pageEnd = Math.min(sortedAll.length, (_taskListPage + 1) * PROJECT_TASK_LIST_PAGE_SIZE);
  const sorted = sortedAll.slice(0, pageEnd);
  const rest = sortedAll.length - sorted.length;
  const rows = sorted.map(t => {
    const tid = toOnclickStringArg(t.id);
    const assignee = USERS.find(u => u.id === t.assigneeId);
    const isFiltered = projectUserFilter !== null && t.assigneeId !== projectUserFilter;
    const taskComments = commentIndicators('task', p.id, t.id);
    const blockingDeps = (t.blockedBy || [])
      .map(id => p.tasks.find(x => sameId(x.id, id)))
      .filter(dep => dep && !dep.done);
    const isBlocked = blockingDeps.length > 0;
    const msCheck = _projectTaskMultiselect
      ? `<div class="task-ms-check" onclick="event.stopPropagation()"><input type="checkbox" aria-label="Seleccionar tarea" ${
          _selectedTaskIds.has(String(t.id)) ? 'checked' : ''
        } onchange="toggleProjectTaskSelect('${pid}','${tid}',this.checked)"></div>`
      : '';
    const rowMenu = `<details class="task-item-dd" onclick="event.stopPropagation()">
      <summary class="task-item-dd-sum" aria-label="Más acciones">⋯</summary>
      <div class="task-item-dd-menu" role="menu">
        <button type="button" role="menuitem" class="task-item-dd-menu__btn" onclick="closeTaskRowMenu(this);openTaskCommentsModal('${pid}','${tid}')"><span class="task-item-dd-menu__ic task-item-dd-menu__ic--comments" aria-hidden="true"></span><span class="task-item-dd-menu__label">Comentarios</span></button>
        <button type="button" role="menuitem" class="task-item-dd-menu__btn" onclick="closeTaskRowMenu(this);openEditTaskModal('${pid}','${tid}')"><span class="task-item-dd-menu__ic task-item-dd-menu__ic--edit" aria-hidden="true"></span><span class="task-item-dd-menu__label">Editar</span></button>
        <button type="button" role="menuitem" class="task-item-dd-menu__btn" onclick="closeTaskRowMenu(this);openTaskViewer('${pid}','${tid}')"><span class="task-item-dd-menu__ic task-item-dd-menu__ic--view" aria-hidden="true"></span><span class="task-item-dd-menu__label">Ver</span></button>
        <button type="button" role="menuitem" class="task-item-dd-menu__btn task-item-dd-menu__btn--danger" onclick="closeTaskRowMenu(this);deleteTask('${pid}','${tid}')"><span class="task-item-dd-menu__ic task-item-dd-menu__ic--delete" aria-hidden="true"></span><span class="task-item-dd-menu__label">Eliminar</span></button>
      </div>
    </details>`;
    const preview = showCommentPreview ? getLatestCommentPreview('task', p.id, t.id) : '';
    const previewHtml = preview
      ? `<div class="task-item-comment-preview" title="${escapeChatHtml(preview)}">${escapeChatHtml(preview)}</div>`
      : '';
    const assigneeHtml = assignee
      ? `<span class="task-assignee task-assignee--row"><span class="task-assignee-avatar" style="background:${escapeChatHtml(assignee.color)}">${assignee.initials}</span><span class="task-assignee-name">${escapeChatHtml(assignee.name)}</span></span>`
      : '';
    const trailChips = [
      t.priority !== 'normal' ? `<span class="task-priority task-priority-pill ${t.priority}">${t.priority}</span>` : '',
      t.dueDate
        ? `<span class="task-due${isTaskDueDateOverdue(t.dueDate, t.done) ? ' task-due-overdue' : ''}">${escapeChatHtml(t.dueDate)}</span>`
        : '',
      t.estimatedHours != null
        ? `<span class="task-hours" title="Estimado: ${t.estimatedHours}h${t.realHours != null ? ' · Real: ' + t.realHours + 'h' : ''}">⏱ ${t.realHours != null ? t.realHours + '/' : ''}${t.estimatedHours}h</span>`
        : '',
    ]
      .filter(Boolean)
      .join('');
    return `<div class="task-item${isBlocked ? ' task-blocked' : ''}${t.done ? ' task-item--done' : ''}" role="listitem" tabindex="-1" data-task-id="${t.id}" style="${isFiltered ? 'opacity:0.35;' : ''}">
      ${msCheck}
      <div class="task-check-wrap">
        <div class="task-check ${t.done ? 'done' : ''}" onclick="quickToggleTask('${pid}','${tid}',this)">${t.done ? '✓' : ''}</div>
      </div>
      <div class="task-item-main">
        <span class="task-name ${t.done ? 'done' : ''}" style="cursor:pointer"
          onclick="openTaskViewer('${pid}','${tid}')">
          <span class="task-name-text">${t.name}${taskComments}${t.desc ? ' <span class="task-name-doc-flag" title="Tiene descripción" aria-hidden="true"></span>' : ''}</span>
          ${isBlocked ? `<span class="task-item-blocked-msg" title="Bloqueada por: ${blockingDeps.map(d => escapeChatHtml(d.name)).join(', ')}">🔒 ${blockingDeps.length} bloq.</span>` : ''}
        </span>
        ${previewHtml}
      </div>
      <div class="task-item-trail">
        <div class="task-item-trail-chips">${trailChips}</div>
        ${assigneeHtml}
        ${rowMenu}
      </div>
    </div>`;
  }).join('');
  const loadMore =
    rest > 0
      ? `<div class="project-task-list-more">
      <span class="project-task-list-more__meta" aria-live="polite">Mostrando ${sorted.length} de ${sortedAll.length}</span>
      <button type="button" class="btn-secondary" onclick="loadMoreProjectTasksPage('${pid}')">Cargar más (${rest} restantes)</button>
    </div>`
      : '';
  return `<div class="project-task-list-root" role="list" aria-label="Tareas del proyecto">${rows}${loadMore}</div>`;
}

function buildKanbanCardHtml(p, t) {
  const assignee = USERS.find(u => u.id === t.assigneeId);
  const pid = toOnclickStringArg(p.id);
  const tid = toOnclickStringArg(t.id);
  const blockingDeps = (t.blockedBy || [])
    .map(id => p.tasks.find(x => sameId(x.id, id)))
    .filter(dep => dep && !dep.done);
  const isBlocked = blockingDeps.length > 0;
  const tComments = commentIndicators('task', p.id, t.id);
  return `<div class="kanban-card" 
                  draggable="true"
                  ondragstart="dragTaskStart(event,'${tid}','${pid}')"
                  ondragend="dragTaskEndClear()"
                  onclick="openTaskViewer('${pid}','${tid}')">
                  <div class="kanban-card-name">${escapeChatHtml(t.name)}</div>
                  ${isBlocked ? `<div class="kanban-card-blocked" title="Bloqueada por: ${blockingDeps.map(d => escapeChatHtml(d.name)).join(', ')}">🔒 Bloqueada por ${blockingDeps.length}</div>` : ''}
                  ${t.priority !== 'normal' ? `<span class="task-priority task-priority-pill ${t.priority}" style="font-size:9px">${t.priority}</span>` : ''}
                  ${t.dueDate
                    ? `<div class="kanban-card-due ${isTaskDueDateOverdue(t.dueDate, t.done) ? 'overdue' : ''}">${escapeChatHtml(t.dueDate)}</div>`
                    : ''}
                  ${t.estimatedHours != null ? `<div class="kanban-card-hours">⏱ ${t.realHours != null ? t.realHours + '/' : ''}${t.estimatedHours}h</div>` : ''}
                  ${tComments ? `<div class="kanban-card-comments">${tComments}</div>` : ''}
                  <div class="kanban-card-footer">
                    ${assignee ? `<div class="kanban-avatar" style="background:${assignee.color}" title="${escapeChatHtml(assignee.name)}">${assignee.initials}</div>` : ''}
                    <button type="button" onclick="event.stopPropagation();quickToggleTask('${pid}','${tid}',this)" 
                      class="kanban-check ${t.done ? 'done' : ''}" title="${t.done ? 'Marcar pendiente' : 'Marcar completado'}">${t.done ? '✓' : '○'}</button>
                  </div>
                </div>`;
}

function renderTasksKanban(p) {
  const columns = [
    { id: 'pending',     label: 'Pendiente',    filter: t => !t.done && t.status !== 'progress' },
    { id: 'progress',    label: 'En progreso',  filter: t => !t.done && t.status === 'progress' },
    { id: 'done',        label: 'Completado',   filter: t => t.done },
  ];

  const sortedAll = getSortedTasks(p);
  const nTasks = (p.tasks || []).length;
  if (nTasks === 0) {
    return `<div class="empty-state project-view-empty" role="status">
      <div class="project-view-empty__icon" aria-hidden="true">📋</div>
      <div class="project-view-empty__title">Sin tareas en este proyecto</div>
      <p class="project-view-empty-hint">El tablero Kanban aparecerá aquí cuando añadas tareas.</p>
      <button type="button" class="btn-primary project-view-empty__cta" onclick="openAddTaskModal('${pid}')">+ Nueva tarea</button>
    </div>`;
  }
  if (sortedAll.length === 0) {
    return `<div class="empty-state project-view-empty" role="status">
      <div class="project-view-empty__icon" aria-hidden="true">🔍</div>
      <div class="project-view-empty__title">Sin tareas visibles</div>
      <p class="project-view-empty-hint">Revisa el buscador, «Solo mías» o el filtro de compañeros arriba.</p>
    </div>`;
  }

  const swim = kanbanSwimlaneEnabled();

  return `<div class="kanban-board-wrap${swim ? ' kanban-board-wrap--swimlane' : ''}" aria-label="Tablero Kanban">
    <div class="kanban-board">
    ${columns.map(col => {
      const tasks = getSortedTasks(p).filter(col.filter);
      const wipHint =
        tasks.length >= PROJECT_KANBAN_WIP_SOFT
          ? `<span class="kanban-wip-hint" title="Columna con muchas tareas; conviene repriorizar o repartir">⚠</span>`
          : '';
      let bodyInner = '';
      if (tasks.length === 0) {
        bodyInner = `<div class="kanban-empty-wrap">
            <div class="kanban-empty">Sin tareas en ${escapeChatHtml(col.label)}</div>
            <button type="button" class="btn-secondary kanban-empty-cta" onclick="openAddTaskModalWithColumn('${toOnclickStringArg(p.id)}','${col.id}')">+ Nueva aquí</button>
          </div>`;
      } else if (!swim) {
        bodyInner = tasks.map(t => buildKanbanCardHtml(p, t)).join('');
      } else {
        const m = new Map();
        tasks.forEach(t => {
          const k = String(t.assigneeId || t.assignedTo || '_none_');
          if (!m.has(k)) m.set(k, []);
          m.get(k).push(t);
        });
        const entries = [...m.entries()].sort((a, b) => {
          const la = a[0] === '_none_' ? 'zzz' : (USERS.find(u => sameId(u.id, a[0]))?.name || '');
          const lb = b[0] === '_none_' ? 'zzz' : (USERS.find(u => sameId(u.id, b[0]))?.name || '');
          return la.localeCompare(lb, 'es');
        });
        bodyInner = entries
          .map(([uid, arr]) => {
            const u = USERS.find(x => sameId(x.id, uid));
            const label = uid === '_none_' ? 'Sin asignar' : escapeChatHtml(u?.name || 'Sin asignar');
            return `<div class="kanban-swimlane"><div class="kanban-swimlane-title">${label}</div><div class="kanban-swimlane-cards">${arr.map(t => buildKanbanCardHtml(p, t)).join('')}</div></div>`;
          })
          .join('');
      }
      return `<div class="kanban-col" data-col="${col.id}" role="region" aria-label="${escapeChatHtml(col.label)}"
        ondragover="event.preventDefault();kanbanColDragOver(event)"
        ondragleave="kanbanColDragLeave(event)"
        ondrop="kanbanColDragLeave(event);dropTaskToColumn(event,'${col.id}','${toOnclickStringArg(p.id)}')">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${col.label}</span>
          <span class="kanban-col-count">${tasks.length}${wipHint}</span>
        </div>
        <div class="kanban-col-body">
          ${bodyInner}
        </div>
      </div>`;
    }).join('')}
  </div>
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

  const isOverdue = isTaskDueDateOverdue(t.dueDate, t.done);

  document.getElementById('task-viewer-title').textContent = t.name;

  const viewerInner = document.querySelector('#task-viewer-modal .task-viewer-modal-inner');
  if (viewerInner) {
    const strip = t.done ? 'var(--success)' : t.status === 'progress' ? 'var(--accent2)' : 'var(--text-muted)';
    viewerInner.style.setProperty('--task-viewer-strip', strip);
  }

  const dot = document.getElementById('task-viewer-status-dot');
  dot.style.cssText = `width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${t.done ? 'var(--success)' : t.status === 'progress' ? 'var(--accent2)' : 'var(--text-muted)'}`;

  const allTaskComments = comments.filter(c => c.kind === 'task' && sameId(c.targetId, projectId) && sameId(c.extraId, taskId));
  const taskCommentCount = allTaskComments.length;
  document.getElementById('task-viewer-badges').innerHTML = `
    ${t.done
      ? `<span class="task-viewer-badge task-viewer-badge--done">Completada</span>`
      : t.status === 'progress'
        ? `<span class="task-viewer-badge task-viewer-badge--progress">En progreso</span>`
        : `<span class="task-viewer-badge task-viewer-badge--pending">Pendiente</span>`
    }
    ${t.priority && t.priority !== 'normal'
      ? `<span class="task-viewer-badge task-viewer-badge--priority task-viewer-badge--p-${['alta', 'media', 'baja'].includes(t.priority) ? t.priority : 'media'}">${escapeChatHtml(priorityLabels[t.priority])}</span>`
      : ''
    }
    ${isOverdue ? `<span class="task-viewer-badge task-viewer-badge--overdue">Vencida</span>` : ''}
    ${taskCommentCount > 0 ? `<span class="task-viewer-badge task-viewer-badge--meta">${taskCommentCount} comentario${taskCommentCount !== 1 ? 's' : ''}</span>` : ''}
  `;

  const descWrap = document.getElementById('task-viewer-desc-wrap');
  const descEl = document.getElementById('task-viewer-desc');
  descWrap.style.display = 'block';
  if (t.desc) {
    descEl.innerHTML = renderMarkdown(t.desc, t.images || {});
    descEl.classList.remove('task-viewer-desc--placeholder-only');
  } else {
    descEl.innerHTML =
      '<p class="task-viewer-desc-placeholder">Sin descripción. Añade contexto, enlaces o criterios de aceptación editando la tarea.</p>';
    descEl.classList.add('task-viewer-desc--placeholder-only');
  }

  const metaItems = [];
  if (assignee) {
    metaItems.push(`
      <div class="task-viewer-meta-item">
        <div class="task-viewer-meta-label">Asignado a</div>
        <div class="task-viewer-meta-value task-viewer-meta-value--assignee">
          <span class="task-viewer-assignee-avatar" style="background:${assignee.color}">${assignee.initials}</span>
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
        <div class="task-viewer-meta-value task-viewer-meta-value--hours">
          <span>${t.realHours ? t.realHours + 'h real' : '— real'}</span>
          <span class="task-viewer-hours-sep">/</span>
          <span class="task-viewer-hours-muted">${t.estimatedHours ? t.estimatedHours + 'h est.' : '— est.'}</span>
          ${efficiency !== null ? `<span class="task-viewer-eff-pill ${efficiency > 100 ? 'task-viewer-eff-pill--high' : 'task-viewer-eff-pill--ok'}">${efficiency}%</span>` : ''}
        </div>
        ${efficiency !== null ? `<div class="task-viewer-eff-bar-wrap" aria-hidden="true"><div class="task-viewer-eff-bar"><div class="task-viewer-eff-bar-fill${efficiency > 100 ? ' task-viewer-eff-bar-fill--over' : ''}" style="width:${Math.min(efficiency, 100)}%"></div></div></div>` : ''}
      </div>`);
  }

  if (t.createdAt) {
    const d = new Date(t.createdAt);
    if (!Number.isNaN(d.getTime())) {
      metaItems.push(`
      <div class="task-viewer-meta-item">
        <div class="task-viewer-meta-label">Alta en el sistema</div>
        <div class="task-viewer-meta-value">${escapeChatHtml(d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))}</div>
      </div>`);
    }
  }
  if (t.updatedAt && String(t.updatedAt) !== String(t.createdAt)) {
    const d2 = new Date(t.updatedAt);
    if (!Number.isNaN(d2.getTime())) {
      metaItems.push(`
      <div class="task-viewer-meta-item">
        <div class="task-viewer-meta-label">Última actualización</div>
        <div class="task-viewer-meta-value">${escapeChatHtml(d2.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))}</div>
      </div>`);
    }
  }

  const blockingDepsViewer = (t.blockedBy || [])
    .map(id => p.tasks.find(x => sameId(x.id, id)))
    .filter(Boolean);
  if (blockingDepsViewer.length > 0) {
    metaItems.push(`
        <div class="task-viewer-meta-item task-viewer-meta-item--full">
          <div class="task-viewer-meta-label">Bloqueada por</div>
          <div class="task-viewer-deps-list">
            ${blockingDepsViewer.map(dep => `
              <div class="task-viewer-dep-row">
                <span class="task-viewer-dep-ic${dep.done ? ' task-viewer-dep-ic--done' : ''}" aria-hidden="true"></span>
                <span class="task-viewer-dep-name${dep.done ? ' task-viewer-dep-name--done' : ''}">${escapeChatHtml(dep.name)}</span>
              </div>`).join('')}
          </div>
        </div>`);
  }

  const metaEl = document.getElementById('task-viewer-meta');
  metaEl.innerHTML = metaItems.join('');
  metaEl.style.display = metaItems.length ? 'grid' : 'none';
  const metaLab = document.getElementById('task-viewer-meta-label');
  if (metaLab) metaLab.style.display = metaItems.length ? '' : 'none';

  document.getElementById('task-viewer-project-dot').style.background = p.color;
  document.getElementById('task-viewer-project-name').textContent = p.name;
  const projectBlock = document.getElementById('task-viewer-project-block');
  if (projectBlock) {
    projectBlock.classList.add('task-viewer-project-block--clickable');
    projectBlock.tabIndex = 0;
    projectBlock.setAttribute('role', 'button');
    projectBlock.setAttribute('aria-label', `Abrir proyecto: ${(p.name || 'Proyecto').slice(0, 120)}`);
    projectBlock.onclick = () => {
      closeTaskViewerModal();
      selectProject(p.id);
    };
    projectBlock.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        projectBlock.click();
      }
    };
  }

  const taskComments = allTaskComments.slice(-3);
  const commentsWrap = document.getElementById('task-viewer-comments-wrap');
  const commentsAllBtn = document.getElementById('task-viewer-comments-all');
  const commentsHeading = document.getElementById('task-viewer-comments-heading');
  if (commentsHeading) {
    commentsHeading.innerHTML =
      taskCommentCount > 0
        ? `Comentarios recientes <span class="task-viewer-comments-count" aria-label="Total en la tarea">(${taskCommentCount})</span>`
        : 'Comentarios recientes';
  }
  commentsWrap.style.display = 'block';
  if (taskComments.length > 0) {
    document.getElementById('task-viewer-comments').innerHTML = taskComments.map(c => {
      const author = USERS.find(u => sameId(u.id, c.authorId));
      const tsStr = c.createdAt
        ? new Date(c.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';
      const iso = c.createdAt ? String(c.createdAt).replace(/"/g, '') : '';
      return `<div class="task-viewer-comment-row">
      <div class="task-viewer-comment-avatar" style="background:${author?.color || 'rgba(120,100,255,0.45)'}">${author?.initials || '?'}</div>
      <div class="task-viewer-comment-body">
        <div class="task-viewer-comment-author-line">
          <span class="task-viewer-comment-author">${author ? escapeChatHtml(author.name) : 'Anónimo'}</span>
          ${tsStr ? `<time class="task-viewer-comment-time" datetime="${iso}">${escapeChatHtml(tsStr)}</time>` : ''}
        </div>
        <div class="task-viewer-comment-text">${escapeChatHtml(c.body || '')}</div>
      </div>
    </div>`;
    }).join('');
    if (commentsAllBtn) commentsAllBtn.style.display = taskCommentCount > 3 ? '' : 'none';
  } else {
    document.getElementById('task-viewer-comments').innerHTML =
      '<div class="task-viewer-comments-empty" role="status">Aún no hay comentarios en esta tarea.</div>';
    if (commentsAllBtn) commentsAllBtn.style.display = 'none';
  }

  openModal('task-viewer-modal');
  replaceProjectsDeepLink(projectId, taskId);
}

export function closeTaskViewerModal() {
  closeModal('task-viewer-modal');
  if (_viewerProjectId) clearProjectsTaskFromHash(_viewerProjectId);
  _viewerProjectId = null;
  _viewerTaskId = null;
}

export function openEditFromViewer() {
  if (!_viewerProjectId || !_viewerTaskId) return;
  const pid = _viewerProjectId;
  const tid = _viewerTaskId;
  closeTaskViewerModal();
  openEditTaskModal(pid, tid);
}

export function openTaskCommentsFromViewer() {
  if (!_viewerProjectId || !_viewerTaskId) return;
  const pid = _viewerProjectId;
  const tid = _viewerTaskId;
  closeTaskViewerModal();
  if (typeof window.openTaskCommentsModal === 'function') {
    window.openTaskCommentsModal(pid, tid);
  }
}

export function setProjectViewMode(mode, projectId) {
  if (mode !== 'list' && _projectTaskMultiselect) {
    _projectTaskMultiselect = false;
    _selectedTaskIds.clear();
  }
  _taskListPage = 0;
  window._projectViewMode = mode;
  selectProject(projectId);
}

export function setTaskSort(mode, projectId) {
  _taskSortMode = mode;
  _taskListPage = 0;
  selectProject(projectId);
}

export function filterTaskSearch(query, projectId) {
  _taskSearchQuery = query;
  _taskListPage = 0;
  selectProject(projectId);
  const p = projects.find(pr => sameId(pr.id, projectId));
  requestAnimationFrame(() => {
    const ann = document.getElementById('project-task-search-announce');
    if (!ann || !p) return;
    const q = String(query || '').trim();
    if (!q) {
      ann.textContent = '';
      return;
    }
    const n = getSortedTasks(p).length;
    ann.textContent = n === 0 ? 'Sin resultados para la búsqueda' : `${n} resultado${n !== 1 ? 's' : ''}`;
  });
  setTimeout(() => {
    const input = document.getElementById('task-search-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
}

export function setMyWorkGroupMode(mode) {
  try {
    if (mode === 'project') localStorage.setItem(MY_WORK_GROUP_LS, 'project');
    else localStorage.setItem(MY_WORK_GROUP_LS, 'due');
  } catch (_) { /* noop */ }
  openMyWorkTasksView();
}

function myWorkRowHtml(p, t) {
  const pid = toOnclickStringArg(p.id);
  const tid = toOnclickStringArg(t.id);
  const overdue = isTaskDueDateOverdue(t.dueDate, t.done);
  return `<div class="my-work-task-row">
          <div class="task-check ${t.done ? 'done' : ''}" onclick="quickToggleTask('${pid}','${tid}',this)"></div>
          <div class="my-work-task-main">
            <span class="my-work-task-name" onclick="openTaskViewer('${pid}','${tid}')">${escapeChatHtml(t.name)}</span>
            <button type="button" class="my-work-project-link btn-secondary" style="font-size:10px;padding:2px 8px;margin-top:4px" onclick="selectProject('${pid}')">${escapeChatHtml(p.name)}</button>
          </div>
          ${
            t.dueDate
              ? `<span class="my-work-due${overdue ? ' my-work-due-overdue' : ''}">${escapeChatHtml(t.dueDate)}</span>`
              : ''
          }
          ${
            t.priority && t.priority !== 'normal'
              ? `<span class="task-priority task-priority-pill ${t.priority}" style="font-size:9px;align-self:center">${t.priority}</span>`
              : ''
          }
        </div>`;
}

export function openMyWorkTasksView() {
  if (!currentUser) {
    showToast('Inicia sesión para ver tus tareas', 'info');
    return;
  }
  setCurrentProjectId(null);
  _taskSearchQuery = '';
  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));

  let groupMode = 'due';
  try {
    if (localStorage.getItem(MY_WORK_GROUP_LS) === 'project') groupMode = 'project';
  } catch (_) { /* noop */ }

  const rows = [];
  for (const p of projects) {
    if (!userCanSeeProject(p)) continue;
    for (const t of p.tasks || []) {
      if (t.done) continue;
      if (!sameId(t.assigneeId, currentUser.id) && !sameId(t.assignedTo, currentUser.id)) continue;
      rows.push({ p, t });
    }
  }

  if (groupMode === 'project') {
    rows.sort((a, b) => {
      const pg = a.p.name.localeCompare(b.p.name, 'es');
      if (pg !== 0) return pg;
      const da = a.t.dueDate || '9999-12-31';
      const db = b.t.dueDate || '9999-12-31';
      if (da !== db) return da.localeCompare(db);
      return String(a.t.name || '').localeCompare(String(b.t.name || ''), 'es');
    });
  } else {
    rows.sort((a, b) => {
      const da = a.t.dueDate || '9999-12-31';
      const db = b.t.dueDate || '9999-12-31';
      if (da !== db) return da.localeCompare(db);
      const pg = a.p.name.localeCompare(b.p.name, 'es');
      if (pg !== 0) return pg;
      return String(a.t.name || '').localeCompare(String(b.t.name || ''), 'es');
    });
  }

  const groupBar = `<div class="my-work-group-bar" role="toolbar" aria-label="Cómo ordenar mis tareas">
    <button type="button" class="btn-secondary${groupMode === 'due' ? ' is-active' : ''}" onclick="setMyWorkGroupMode('due')">Por fecha</button>
    <button type="button" class="btn-secondary${groupMode === 'project' ? ' is-active' : ''}" onclick="setMyWorkGroupMode('project')">Por proyecto</button>
  </div>`;

  let listHtml = '';
  if (rows.length === 0) {
    listHtml = `<div class="empty-state" style="padding:32px 20px"><div class="empty-icon">✓</div><div>No tienes tareas pendientes asignadas en los proyectos visibles.</div></div>`;
  } else if (groupMode === 'project') {
    const byP = new Map();
    rows.forEach(({ p, t }) => {
      const k = String(p.id);
      if (!byP.has(k)) byP.set(k, { p, items: [] });
      byP.get(k).items.push(t);
    });
    listHtml = [...byP.values()]
      .map(
        ({ p, items }) =>
          `<div class="my-work-project-block"><h4 class="my-work-project-block-title">${escapeChatHtml(p.name)}</h4><div class="my-work-tasks-list">${items.map(t => myWorkRowHtml(p, t)).join('')}</div></div>`
      )
      .join('');
  } else {
    listHtml = `<div class="my-work-tasks-list">${rows.map(({ p, t }) => myWorkRowHtml(p, t)).join('')}</div>`;
  }

  document.getElementById('project-detail').innerHTML = `
    <div class="my-work-back-bar">
      <button type="button" class="btn-secondary" onclick="exitMyWorkTasksView()">← Volver a proyectos</button>
    </div>
    <div class="my-work-header">
      <h3 class="my-work-header-title">📋 Mis tareas</h3>
      <p class="my-work-header-lead">Pendientes y en progreso asignadas a ti, en todos los proyectos que puedes ver.</p>
      ${groupBar}
      <p class="my-work-header-count" role="status">${rows.length} tarea${rows.length !== 1 ? 's' : ''} mostrada${rows.length !== 1 ? 's' : ''}</p>
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

export function dragTaskEndClear() {
  document.querySelectorAll('.kanban-col--drag-over').forEach(el => el.classList.remove('kanban-col--drag-over'));
}

export async function dropTaskToColumn(event, colId, projectId) {
  event.preventDefault();
  document.querySelectorAll('.kanban-col--drag-over').forEach(el => el.classList.remove('kanban-col--drag-over'));
  if (!_dragTaskId || !_dragProjectId) return;
  const p = projects.find(pr => sameId(pr.id, _dragProjectId));
  if (!p) return;
  const task = p.tasks.find(t => sameId(t.id, _dragTaskId));
  if (!task) return;

  const wasDone = task.done;
  const prevDone = task.done;
  const prevStatus = task.status;

  if (colId === 'done') {
    task.done = true;
    task.status = 'done';
  } else if (colId === 'progress') {
    task.done = false;
    task.status = 'progress';
  } else {
    task.done = false;
    task.status = 'pending';
  }

  let activityPushed = false;
  if (task.done && !wasDone) {
    pushProjectActivity(p, { type: 'task_completed', taskName: task.name, taskId: task.id });
    activityPushed = true;
  } else if (!task.done && wasDone) {
    pushProjectActivity(p, { type: 'task_reopened', taskName: task.name, taskId: task.id });
    activityPushed = true;
  }

  _dragTaskId = null;
  _dragProjectId = null;
  try {
    const mongoId = p._id || p.id;
    const payload = { tasks: p.tasks };
    if (Array.isArray(p.activityLog)) {
      payload.activityLog = p.activityLog;
    }
    await projectsTrackedUpdateProject(mongoId, payload);
    showToast('Columna de la tarea actualizada', 'success');
  } catch (err) {
    console.error('Error guardando tarea en API:', err);
    task.done = prevDone;
    task.status = prevStatus;
    if (activityPushed && p.activityLog?.length) {
      p.activityLog.shift();
    }
    showToast('No se pudo guardar el cambio de columna', 'error');
  }
  saveProjectData();
  renderProjects();
  selectProject(projectId);
}

/** Partición mutuamente excluyente para la barra de estado (suma = total). */
function partitionTasksForStatusBar(tasks) {
  const arr = Array.isArray(tasks) ? tasks : [];
  const total = arr.length;
  if (total === 0) {
    return { total: 0, doneN: 0, overdueN: 0, progressN: 0, pendingN: 0 };
  }
  let doneN = 0;
  let overdueN = 0;
  let progressN = 0;
  let pendingN = 0;
  for (const t of arr) {
    const isDone = t.done === true || t.done === 'true' || t.status === 'done';
    if (isDone) {
      doneN++;
      continue;
    }
    if (isTaskDueDateOverdue(t.dueDate, t.done)) overdueN++;
    else if (t.status === 'progress') progressN++;
    else pendingN++;
  }
  return { total, doneN, overdueN, progressN, pendingN };
}

/** Porcentajes de barra que suman ~100% (evita segmentos invisibles por redondeo). */
function statusBarWidths(total, doneN, overdueN, progressN, pendingN) {
  if (!total) return { wDone: 0, wOverdue: 0, wProgress: 0, wPending: 0 };
  let wDone = (doneN / total) * 100;
  let wOverdue = (overdueN / total) * 100;
  let wProgress = (progressN / total) * 100;
  let wPending = (pendingN / total) * 100;
  const sum = wDone + wOverdue + wProgress + wPending;
  if (sum > 0 && Math.abs(sum - 100) > 0.02) {
    const k = 100 / sum;
    wDone *= k;
    wOverdue *= k;
    wProgress *= k;
    wPending *= k;
  }
  return { wDone, wOverdue, wProgress, wPending };
}

function renderProjectStats(p) {
  const m = analyzeProjectTasks(p.tasks || []);
  if (m.total === 0) return '';

  const {
    done, overdue, alta, total,
    totalEstimated, totalReal, hoursEfficiency, byAssignee,
  } = m;

  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

  const bar = partitionTasksForStatusBar(p.tasks || []);
  const { wDone, wOverdue, wProgress, wPending } = statusBarWidths(
    bar.total,
    bar.doneN,
    bar.overdueN,
    bar.progressN,
    bar.pendingN
  );
  const ariaTrack = `Completadas ${bar.doneN}, en progreso ${bar.progressN}, pendientes sin vencer ${bar.pendingN}, vencidas ${bar.overdueN}`;

  const statusTrack = `
    <div class="proj-status-track" role="img" aria-label="${ariaTrack.replace(/"/g, '')}">
      <div class="proj-status-track__seg proj-status-track__seg--done" style="width:${wDone}%"></div>
      <div class="proj-status-track__seg proj-status-track__seg--progress" style="width:${wProgress}%"></div>
      <div class="proj-status-track__seg proj-status-track__seg--pending" style="width:${wPending}%"></div>
      <div class="proj-status-track__seg proj-status-track__seg--overdue" style="width:${wOverdue}%"></div>
    </div>
    <details class="proj-status-legend-wrap" open>
      <summary class="proj-status-legend-sum">Qué significa la barra</summary>
      <div class="proj-status-legend">
      <span><span class="proj-status-legend__dot proj-status-legend__dot--done"></span>${done} completadas</span>
      <span><span class="proj-status-legend__dot proj-status-legend__dot--progress"></span>${bar.progressN} en progreso</span>
      <span><span class="proj-status-legend__dot proj-status-legend__dot--pending"></span>${bar.pendingN} pendientes sin vencer</span>
      ${overdue > 0 ? `<span class="proj-status-legend__overdue"><span class="proj-status-legend__dot proj-status-legend__dot--overdue"></span>${overdue} vencidas</span>` : ''}
    </div>
    </details>`;

  const overdueValClass = overdue > 0 ? 'proj-stat-value--danger' : 'proj-stat-value--danger-muted';

  const metricCards = `
    <div class="proj-stat-cards">
      <div class="proj-stat-card">
        <div class="proj-stat-value">${total}</div>
        <div class="proj-stat-label">Total</div>
      </div>
      <div class="proj-stat-card proj-stat-card--accent-done">
        <div class="proj-stat-value proj-stat-value--success">${pctDone}%</div>
        <div class="proj-stat-label">Completado</div>
      </div>
      <div class="proj-stat-card proj-stat-card--accent-danger">
        <div class="proj-stat-value ${overdueValClass}">${overdue}</div>
        <div class="proj-stat-label">Vencidas</div>
      </div>
      <div class="proj-stat-card proj-stat-card--accent-warn">
        <div class="proj-stat-value proj-stat-value--warn">${alta}</div>
        <div class="proj-stat-label">Alta prioridad</div>
      </div>
    </div>`;

  const assigneeRows = Object.entries(byAssignee)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([uid, data]) => {
      const user = USERS.find(u => String(u.id) === String(uid));
      const pct = Math.round((data.done / data.total) * 100);
      const fillColor = user?.color || 'rgba(120, 100, 255, 0.55)';
      return `<div class="proj-assignee-row">
          <div class="proj-assignee-avatar" style="background:${fillColor}">${escapeChatHtml(user?.initials || '?')}</div>
          <div class="proj-assignee-main">
            <div class="proj-assignee-meta">
              <span>${escapeChatHtml(user?.name || 'Sin asignar')}</span>
              <span>${data.done}/${data.total}${data.overdue > 0 ? ` · <span class="proj-assignee-meta-overdue">${data.overdue} venc.</span>` : ''}</span>
            </div>
            <div class="proj-assignee-bar">
              <div class="proj-assignee-bar-fill" style="width:${pct}%;background:${fillColor}"></div>
            </div>
          </div>
          <span class="proj-assignee-pct">${pct}%</span>
        </div>`;
    }).join('');

  const hoursBlock = totalEstimated > 0 ? `
        <div class="proj-hours-row">
          <div>
            <span class="proj-hours-row__mono">${totalReal}h real <span class="proj-hours-row__muted">/ ${totalEstimated}h estimadas</span></span>
          </div>
          ${hoursEfficiency !== null ? `
            <span class="proj-efficiency-badge ${hoursEfficiency > 100 ? 'proj-efficiency-badge--warn' : 'proj-efficiency-badge--ok'}">
              ${hoursEfficiency}% eficiencia
            </span>` : ''}
        </div>` : '';

  const assigneeKeys = Object.keys(byAssignee);
  const assigneeBlock = assigneeKeys.length > 0 ? `
        <details class="proj-assignee-disclosure" open>
          <summary class="proj-assignee-disclosure-summary">
            <span class="proj-section-heading proj-section-heading--inline">Por asignado</span>
            <span class="proj-assignee-count">${assigneeKeys.length}</span>
          </summary>
          <div class="proj-assignee-grid">${assigneeRows}</div>
        </details>` : '';

  return `
    <div class="proj-stats-block">
      <div class="proj-stats-heading-row">
        <div class="proj-stats-heading proj-section-heading">Estadísticas</div>
        <button type="button" class="proj-stats-compact-btn" onclick="toggleProjectStatsCompactLayout()" title="Alternar vista compacta del bloque">⇕</button>
      </div>
      ${statusTrack}
      ${metricCards}
      ${hoursBlock}
      ${assigneeBlock}
    </div>`;
}

function normalizeTaskStatusesForProject(proj) {
  if (!proj || !Array.isArray(proj.tasks)) return;
  for (const t of proj.tasks) {
    const done = t.done === true || t.done === 'true' || t.status === 'done';
    if (done) {
      t.done = true;
      t.status = 'done';
    } else {
      if (t.status === 'done') t.status = 'pending';
      if (t.status !== 'progress' && t.status !== 'pending') t.status = 'pending';
    }
  }
}

function projectDetailOnlyMineActive() {
  if (!currentUser) return false;
  try {
    return localStorage.getItem(PROJECT_DETAIL_ONLY_MINE_LS) === '1';
  } catch (_) {
    return false;
  }
}

export function toggleProjectDetailOnlyMine(projectId) {
  try {
    if (localStorage.getItem(PROJECT_DETAIL_ONLY_MINE_LS) === '1') {
      localStorage.removeItem(PROJECT_DETAIL_ONLY_MINE_LS);
    } else {
      localStorage.setItem(PROJECT_DETAIL_ONLY_MINE_LS, '1');
    }
  } catch (_) { /* noop */ }
  selectProject(projectId);
}

export function toggleKanbanSwimlane(projectId) {
  try {
    if (localStorage.getItem(PROJECT_KANBAN_SWIMLANE_LS) === '1') {
      localStorage.removeItem(PROJECT_KANBAN_SWIMLANE_LS);
    } else {
      localStorage.setItem(PROJECT_KANBAN_SWIMLANE_LS, '1');
    }
  } catch (_) { /* noop */ }
  selectProject(projectId);
}

function kanbanSwimlaneEnabled() {
  try {
    return localStorage.getItem(PROJECT_KANBAN_SWIMLANE_LS) === '1';
  } catch (_) {
    return false;
  }
}

export function selectProject(id) {
  const prevProjectId = currentProjectId;
  if (currentProjectId != null && !sameId(currentProjectId, id)) {
    _taskSearchQuery = '';
  }
  setCurrentProjectId(id);
  if (prevProjectId != null && !sameId(prevProjectId, id)) {
    _selectedTaskIds.clear();
    _projectTaskMultiselect = false;
    _taskListPage = 0;
  }
  const p = projects.find(pr => sameId(pr.id, id));
  if (!p) return;

  normalizeTaskStatusesForProject(p);

  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.project-item[data-project-id="${id}"]`);
  if (active) active.classList.add('active');

  const statusColors = { activo: 'var(--success)', pausa: 'var(--accent2)', completado: 'var(--accent)' };
  const statusLabels = { activo: 'Activo', pausa: 'En pausa', completado: 'Completado' };
  const viewMode = window._projectViewMode || 'list';
  const pid = toOnclickStringArg(p.id);

  const tasksDep = (p.tasks || []).filter(t => (t.blockedBy || []).length > 0);
  const depsInsightBlock =
    tasksDep.length > 0
      ? `<div class="project-deps-insight" role="region" aria-label="Resumen de dependencias entre tareas">
          <div class="proj-section-heading proj-section-heading--inline">${tasksDep.length} tarea${tasksDep.length !== 1 ? 's' : ''} con dependencias</div>
          <ul class="project-deps-insight-list">
            ${tasksDep
              .slice(0, 10)
              .map(t => {
                const names = (t.blockedBy || [])
                  .map(bid => p.tasks.find(x => sameId(x.id, bid)))
                  .filter(Boolean)
                  .map(d => escapeChatHtml(d.name))
                  .join(', ');
                return `<li><button type="button" class="project-deps-insight-link" onclick="openTaskViewer('${pid}','${toOnclickStringArg(t.id)}')">${escapeChatHtml(t.name)}</button><span class="project-deps-insight-wait"> · espera: ${names || '—'}</span></li>`;
              })
              .join('')}
          </ul>
          ${tasksDep.length > 10 ? `<p class="project-deps-insight-more">Y ${tasksDep.length - 10} más…</p>` : ''}
        </div>`
      : '';

  const staleBanner = _projectTasksStaleFromRemote
    ? `<div class="project-remote-stale-banner" role="alert"><span class="project-remote-stale-banner__icon" aria-hidden="true"></span><span class="project-remote-stale-banner__text">Puede haber cambios en el servidor para las tareas de este proyecto.</span><button type="button" class="btn-secondary" onclick="dismissProjectRemoteStaleBanner()">Entendido</button></div>`
    : '';

  const onlyMine = projectDetailOnlyMineActive();
  const kanbanSwimOn = kanbanSwimlaneEnabled();
  const batchUserOpts = USERS.filter(u => u.group === currentUser.group)
    .map(
      u =>
        `<option value="${String(u.id).replace(/"/g, '')}">${escapeChatHtml(u.name)}</option>`
    )
    .join('');

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
    ? `<div class="project-detail-breadcrumbs" role="navigation" aria-label="Ruta del proyecto">${crumbs.slice(0, -1).map(c => `<button type="button" class="btn-secondary project-detail-crumb-btn" onclick="event.stopPropagation();selectProject('${toOnclickStringArg(c.id)}')">${escapeChatHtml(c.name)}</button><span class="project-detail-crumb-sep" aria-hidden="true">▸</span>`).join('')}<span class="project-detail-crumb-level">Nivel ${crumbs.length}</span></div>`
    : '';
  const subprojectsBlock = `<div class="subprojects-section">
    <div class="subprojects-section-head">
      <h4 class="proj-section-heading proj-section-heading--subprojects">Subproyectos${childProjects.length ? ` (${childProjects.length})` : ''}</h4>
      <button type="button" class="btn-secondary project-subproject-add-btn" onclick="event.stopPropagation();openNewProjectModal('${pid}')">+ Subproyecto</button>
    </div>
    ${childProjects.length === 0
      ? `<p class="subprojects-section__empty">Sin subproyectos. Puedes anidar varios niveles para organizar el trabajo.</p>`
      : `<div class="subproject-cards subproject-cards--grid">${childProjects.map(c => `<button type="button" class="subproject-card" onclick="event.stopPropagation();selectProject('${toOnclickStringArg(c.id)}')" style="--subproject-color:${escapeChatHtml(c.color || '#7864ff')}"><span class="subproject-card__accent" aria-hidden="true"></span><span class="subproject-card__body"><span class="subproject-card__title">${escapeChatHtml(c.name)}</span><span class="subproject-card__kind">Subproyecto</span></span><span class="subproject-card__hint">Abrir</span></button>`).join('')}</div>`}
  </div>`;

  const brokenDeps = countBrokenDependencyRefs(p);
  const brokenBanner = brokenDeps > 0
    ? `<div class="project-deps-warning" role="alert"><span class="project-deps-warning__icon" aria-hidden="true"></span><span class="project-deps-warning__text">Hay <strong>${brokenDeps}</strong> referencia(s) de dependencia rota(s) (tareas eliminadas). Edita las tareas afectadas y quita esas dependencias.</span></div>`
    : '';

  const sortSummaryLabels = {
    default: 'Orden: por defecto',
    priority: 'Orden: prioridad',
    dueDate: 'Orden: fecha',
    status: 'Orden: estado',
  };
  const sortSummaryLabel = sortSummaryLabels[_taskSortMode] || sortSummaryLabels.default;
  const viewSummaryLabel =
    viewMode === 'kanban' ? 'Vista: Kanban' : viewMode === 'calendar' ? 'Vista: Calendario' : 'Vista: Lista';
  const idLit = JSON.stringify(p.id);

  let rootClass = 'project-detail-root';
  try {
    if (localStorage.getItem(PROJECT_TASK_LIST_DENSITY_LS) === 'compact') {
      rootClass += ' project-detail-root--task-density-compact';
    }
  } catch (_) { /* noop */ }
  if (_projectTaskMultiselect) rootClass += ' project-detail-root--multiselect';

  document.getElementById('project-detail').innerHTML = `
    <div id="project-detail-root" class="${rootClass}">
    <header class="project-detail-head">
    <div class="projects-sync-strip" id="projects-sync-strip" role="status" aria-live="polite"></div>
    <div class="project-header-detail">
      <div class="project-color-dot" style="--project-color:${p.color};background:var(--project-color)"></div>
      <div class="project-title-area">
        ${crumbHtml}
        <h2>${escapeChatHtml(p.name)}</h2>
        <div class="project-desc">${p.desc ? renderMarkdown(p.desc, p.images || {}) : ''}</div>
      </div>
      <div class="project-header-actions-bar">
      <div class="project-header-actions">
        <span class="project-badge project-badge-status project-badge-status--${
          p.status === 'pausa' ? 'pausa' : p.status === 'completado' ? 'completado' : 'activo'
        }" style="--badge-color:${statusColors[p.status] || statusColors.activo}">${statusLabels[p.status] || statusLabels.activo}</span>
        <button type="button" class="btn-secondary project-header-edit-btn" onclick="openEditProjectModal('${pid}')">Editar</button>
        <div class="project-header-actions__more-wrap">
          <button type="button" class="btn-secondary project-header-more-btn" id="project-actions-more-btn" onclick="toggleProjectActionsMenu()" aria-expanded="false" aria-haspopup="true">Más ▾</button>
          <div id="project-actions-menu" class="project-actions-menu hidden" role="menu">
            <div class="project-actions-menu__head" aria-hidden="true">Acciones del proyecto</div>
            <div class="project-actions-menu__group" role="group" aria-label="Vista">
              <div class="project-actions-menu__group-label">Vista</div>
              <button type="button" class="project-actions-menu__stacked" role="menuitem" onclick="toggleProjectActionsMenu(true);toggleProjectPresentationMode()">Modo presentación<span class="project-actions-menu__hint">Oculta barra lateral, lista y cabeceras · Esc o «Volver» en la cinta inferior</span></button>
            </div>
            <div class="project-actions-menu__group" role="group" aria-label="Plantillas">
              <div class="project-actions-menu__group-label">Plantillas</div>
              <button type="button" role="menuitem" onclick="toggleProjectActionsMenu(true);openApplyTemplateToProjectModal('${pid}')">Aplicar plantilla…</button>
              <button type="button" role="menuitem" onclick="toggleProjectActionsMenu(true);openSaveProjectTemplateModal('${pid}')">Guardar como plantilla</button>
            </div>
            <div class="project-actions-menu__group" role="group" aria-label="Exportar e informes">
              <div class="project-actions-menu__group-label">Exportar e informes</div>
              <button type="button" class="project-actions-menu__stacked" role="menuitem" onclick="toggleProjectActionsMenu(true);exportProjectAsText('${pid}')">Descargar TXT<span class="project-actions-menu__hint">Listado de tareas en texto plano</span></button>
              <button type="button" class="project-actions-menu__stacked" role="menuitem" onclick="toggleProjectActionsMenu(true);exportProjectTasksCSV('${pid}')">Descargar CSV<span class="project-actions-menu__hint">Hoja de cálculo</span></button>
              <button type="button" class="project-actions-menu__stacked" role="menuitem" onclick="toggleProjectActionsMenu(true);exportProjectTasksJSON('${pid}')">JSON de tareas<span class="project-actions-menu__hint">Datos estructurados</span></button>
              <button type="button" class="project-actions-menu__stacked" role="menuitem" onclick="toggleProjectActionsMenu(true);copyProjectSummaryMarkdown('${pid}')">Copiar resumen Markdown<span class="project-actions-menu__hint">Al portapapeles</span></button>
              <button type="button" class="project-actions-menu__stacked" role="menuitem" onclick="toggleProjectActionsMenu(true);openProjectPrintReport('${pid}')">Informe para imprimir / PDF<span class="project-actions-menu__hint">Imprimir o Guardar como PDF</span></button>
            </div>
            <div class="project-actions-menu__group project-actions-menu__group--danger" role="group" aria-label="Zona peligrosa">
              <button type="button" class="project-actions-menu__danger" role="menuitem" onclick="toggleProjectActionsMenu(true);deleteProject('${pid}')">Eliminar proyecto</button>
            </div>
      </div>
    </div>
      </div>
      </div>
    </div>
    <div class="project-presentation-ribbon" role="region" aria-label="Modo presentación">
      <span class="project-presentation-ribbon__hint">Modo presentación: vista ampliada de este proyecto.</span>
      <button type="button" class="project-presentation-ribbon__exit" onclick="exitProjectPresentationMode()" title="Volver a la vista normal (Esc)">Volver</button>
    </div>
    ${renderProjectQuickStrip(p)}
    ${brokenBanner}
    ${staleBanner}
    </header>
    <div class="project-detail-scroll">
    <div class="project-detail-body-stack">
    <div class="project-detail-insights">
      <div class="project-detail-insights__stats">${renderProjectStats(p)}</div>
      <div class="project-detail-insights__activity-wrap">${renderProjectActivity(p)}</div>
    </div>
    ${depsInsightBlock}
    <div class="tasks-section project-tasks-main project-tasks-view-wrap project-tasks-view-wrap--${viewMode}">
      <div class="tasks-section-header">
        <div class="tasks-section-header-row">
          <h4 class="proj-section-heading proj-section-heading--tasks">Tareas</h4>
          <button type="button" class="btn-secondary tasks-density-toggle-btn" onclick="toggleProjectTaskListDensity()" title="Alternar lista compacta o cómoda">⇕ Densidad</button>
        </div>
        <div class="tasks-toolbar-cluster" role="toolbar" aria-label="Herramientas de tareas">
          <div class="tasks-toolbar-group tasks-toolbar-group--search">
          <div class="task-search-wrap${_taskSearchQuery && String(_taskSearchQuery).trim() ? ' task-search-wrap--has-value' : ''}">
            <input type="text"
              class="task-search-input"
              id="task-search-input"
              placeholder="Buscar tarea..."
              value="${escapeChatHtml(_taskSearchQuery)}"
              oninput="filterTaskSearch(this.value,'${pid}')"
              aria-label="Buscar en tareas del proyecto">
            ${_taskSearchQuery ? `<button type="button" class="task-search-clear" onclick="filterTaskSearch('','${pid}')" title="Limpiar búsqueda" aria-label="Limpiar búsqueda"><span class="task-search-clear__ic" aria-hidden="true"></span></button>` : ''}
            <span id="project-task-search-announce" class="sr-only" aria-live="polite" aria-atomic="true"></span>
          </div>
          <button type="button" class="btn-secondary tasks-only-mine-btn${onlyMine ? ' is-active' : ''}" onclick="toggleProjectDetailOnlyMine('${pid}')" title="Mostrar solo tareas asignadas a ti">Solo mías</button>
          </div>
          <div class="tasks-toolbar-overflow">
          <div class="tasks-toolbar-group tasks-toolbar-group--controls">
          <details class="tasks-toolbar-dd tasks-toolbar-dd--sort">
            <summary class="tasks-toolbar-dd-summary">${sortSummaryLabel}</summary>
            <div class="tasks-toolbar-dd-menu" role="menu">
              <button type="button" role="menuitem" onclick="projectToolbarPickSort('default','${pid}',this)">Por defecto</button>
              <button type="button" role="menuitem" onclick="projectToolbarPickSort('priority','${pid}',this)">Por prioridad</button>
              <button type="button" role="menuitem" onclick="projectToolbarPickSort('dueDate','${pid}',this)">Por fecha límite</button>
              <button type="button" role="menuitem" onclick="projectToolbarPickSort('status','${pid}',this)">Por estado</button>
          </div>
          </details>
          <details class="tasks-toolbar-dd tasks-toolbar-dd--view">
            <summary class="tasks-toolbar-dd-summary">${viewSummaryLabel}</summary>
            <div class="tasks-toolbar-dd-menu" role="menu">
              <button type="button" role="menuitem" onclick="projectToolbarPickView('list','${pid}',this)">Lista</button>
              <button type="button" role="menuitem" onclick="projectToolbarPickView('kanban','${pid}',this)">Kanban</button>
              <button type="button" role="menuitem" onclick="projectToolbarPickView('calendar','${pid}',this)">Calendario</button>
        </div>
          </details>
      </div>
          </div>
          <div class="tasks-toolbar-group tasks-toolbar-group--actions">
          ${viewMode === 'kanban' ? `<button type="button" class="btn-secondary" onclick="toggleKanbanSwimlane('${pid}')" title="Agrupar tarjetas por asignado dentro de cada columna">${kanbanSwimOn ? 'Kanban clásico' : 'Kanban por persona'}</button>` : ''}
          ${viewMode === 'list' ? `<button type="button" class="btn-secondary tasks-multiselect-toggle-btn" onclick="toggleProjectTaskMultiselect('${pid}')" title="Seleccionar varias tareas en lista">${_projectTaskMultiselect ? 'Salir selección' : 'Selección'}</button>` : ''}
          <button type="button" class="btn-secondary tasks-shortcuts-btn" onclick="openProjectsShortcutsModal()">Atajos</button>
          <button type="button" class="btn-primary tasks-toolbar-add-btn" onclick="openAddTaskModal('${pid}')">+ Tarea</button>
          </div>
        </div>
      </div>
      <div id="project-task-multiselect-bar" class="project-task-multiselect-bar ${_projectTaskMultiselect ? '' : 'hidden'}" role="region" aria-label="Selección múltiple">
        <span id="project-ms-count" class="project-ms-count">0 seleccionadas</span>
        <button type="button" class="btn-secondary" onclick="batchMarkSelectedTasksDone('${pid}')">Marcar completadas</button>
        <div class="project-ms-batch-grid">
          <label class="project-ms-batch-label">Asignar a
            <select id="batch-ms-assignee" class="form-select">${batchUserOpts}</select>
          </label>
          <button type="button" class="btn-secondary" onclick="batchApplyAssigneeToSelection('${pid}')">Aplicar asignación</button>
          <label class="project-ms-batch-label">Nueva fecha
            <input type="date" id="batch-ms-due" class="form-input" />
          </label>
          <button type="button" class="btn-secondary" onclick="batchApplyDueToSelection('${pid}')">Aplicar fecha</button>
          <label class="project-ms-batch-label">Prioridad
            <select id="batch-ms-priority" class="form-select">
              <option value="alta">alta</option>
              <option value="media">media</option>
              <option value="normal" selected>normal</option>
              <option value="baja">baja</option>
            </select>
          </label>
          <button type="button" class="btn-secondary" onclick="batchApplyPriorityToSelection('${pid}')">Aplicar prioridad</button>
        </div>
        <button type="button" class="btn-secondary" onclick="clearProjectTaskMultiselect('${pid}')">Cancelar</button>
      </div>
      ${(() => {
        if (viewMode === 'calendar') {
          const tasksWithDate = p.tasks.filter(t => t.dueDate && !t.done);
          if (tasksWithDate.length === 0) {
            return `<div class="empty-state project-view-empty" role="status">
              <div class="project-view-empty__icon" aria-hidden="true">📅</div>
              <div class="project-view-empty__title">Sin fechas en el calendario</div>
              <p class="project-view-empty-hint">Añade una fecha de vencimiento (AAAA-MM-DD) a las tareas pendientes para verlas aquí.</p>
              <button type="button" class="btn-primary project-view-empty__cta" onclick="openAddTaskModal('${pid}')">+ Añadir tarea</button>
            </div>`;
          }

          const tasksValid = tasksWithDate.filter(t => parseProjectTaskDueDate(t.dueDate));
          if (tasksValid.length === 0) {
            return `<div class="empty-state project-view-empty project-view-empty--warn" role="alert">
              <div class="project-view-empty__icon" aria-hidden="true">⚠</div>
              <div class="project-view-empty__title">Fechas no válidas</div>
              <p class="project-view-empty-hint">Corrige el campo <code>dueDate</code> (formato AAAA-MM-DD, entre 1970 y 2100) en las tareas afectadas.</p>
            </div>`;
          }

          const byMonth = {};
          tasksValid.forEach(t => {
            const d = parseProjectTaskDueDate(t.dueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = { anchor: d, tasks: [] };
            byMonth[key].tasks.push(t);
          });

          const monthEntries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
          const nowD = new Date();
          const curMonthKey = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;
          const showCalJump = monthEntries.length > 1;
          const jumpBar = showCalJump
            ? `<div class="project-cal-toolbar"><button type="button" class="btn-secondary project-cal-jump-btn" onclick="document.getElementById('project-cal-anchor-current-month')?.scrollIntoView({behavior:'smooth',block:'start'})">Ir al mes actual</button></div>`
            : '';
          const monthsHtml = monthEntries
            .map(([key, { anchor, tasks }]) => {
              const monthTitle = escapeChatHtml(formatCalendarMonthYearLabel(anchor));
              const sorted = [...tasks].sort(
                (a, b) =>
                  (parseProjectTaskDueDate(a.dueDate)?.getTime() ?? 0) -
                  (parseProjectTaskDueDate(b.dueDate)?.getTime() ?? 0)
              );
              const isCur = key === curMonthKey;
              const safeKey = escapeChatHtml(key);
              return `<div class="cal-month-block${isCur ? ' cal-month-block--current' : ''}"${isCur ? ' id="project-cal-anchor-current-month"' : ''}
              data-month-key="${safeKey}"
              ondragover="onProjectCalMonthDragOver(event)"
              ondragleave="onProjectCalMonthDragLeave(event)"
              ondrop="onProjectCalMonthDrop(event,'${safeKey}','${pid}')">
              <div class="cal-month-header">${monthTitle}</div>
              ${sorted.map(t => {
                const assignee = USERS.find(u => sameId(u.id, t.assignedTo || t.assigneeId));
                const d = parseProjectTaskDueDate(t.dueDate);
                const isOverdue = isTaskDueDateOverdue(t.dueDate, t.done);
                const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                const dueEsc = escapeChatHtml(String(t.dueDate || ''));
                return `<div class="cal-task-row ${isOverdue ? 'cal-task-overdue' : 'cal-task-ontime'}"
                  draggable="true"
                  ondragstart="onCalTaskRowDragStart(event,'${pid}','${toOnclickStringArg(t.id)}','${dueEsc}')"
                  onclick="openTaskViewer('${pid}','${toOnclickStringArg(t.id)}')">
                  <div class="cal-task-date">${escapeChatHtml(dayLabel)}</div>
                  <div class="cal-task-name">${escapeChatHtml(t.name)}</div>
                  ${assignee ? `<div class="cal-task-assignee" style="background:${assignee.color}">${assignee.initials}</div>` : ''}
                </div>`;
              }).join('')}
            </div>`;
            })
            .join('');
          return `${jumpBar}${monthsHtml}`;
        }
        if (viewMode === 'kanban') return renderTasksKanban(p);
        return renderTasksList(p);
      })()}
    </div>
    ${subprojectsBlock}
    <div class="project-comments-cta project-comments-cta--spaced">
      <button type="button" class="btn-secondary btn-full-width" onclick="openProjectCommentsModal('${pid}')">💬 Comentarios del proyecto${comments.filter(c=>c.kind==='project'&&sameId(c.targetId,p.id)).length ? ' ('+comments.filter(c=>c.kind==='project'&&sameId(c.targetId,p.id)).length+')' : ''}</button>
    </div>
    </div>
    </div>
  `;
  applyAfterProjectDetailRender();
  const vm = document.getElementById('task-viewer-modal');
  if (vm?.classList.contains('open') && _viewerProjectId && sameId(_viewerProjectId, p.id) && _viewerTaskId) {
    replaceProjectsDeepLink(p.id, _viewerTaskId);
  } else {
    replaceProjectsDeepLink(p.id, null);
  }
}

export function syncProjectModalWizardStep() {
  const step = window._projectCreateWizardStep || 2;
  const s1 = document.getElementById('project-modal-step-1');
  const s2 = document.getElementById('project-modal-step-2');
  const overlay = document.getElementById('project-modal');
  if (!s1 || !s2) return;
  if (overlay) {
    overlay.classList.remove('project-modal--create-step-1', 'project-modal--create-step-2', 'project-modal--edit');
    if (editingProjectId) {
      overlay.classList.add('project-modal--edit');
    } else {
      overlay.classList.add(step === 1 ? 'project-modal--create-step-1' : 'project-modal--create-step-2');
    }
  }
  if (editingProjectId) {
    s1.style.display = '';
    s2.style.display = '';
    updateProjectModalStepEyebrow();
    syncProjectModalStickyName();
    updateProjectModalStickyDraftVisibility();
    return;
  }
  if (step === 1) {
    s1.style.display = '';
    s2.style.display = 'none';
  } else {
    s1.style.display = 'none';
    s2.style.display = '';
  }
  updateProjectModalStepEyebrow();
  syncProjectModalStickyName();
  updateProjectModalStickyDraftVisibility();
}

export function projectModalWizardNext() {
  const name = document.getElementById('project-name-input')?.value?.trim();
  const fb = document.getElementById('project-modal-footer-feedback-wizard');
  if (fb) fb.textContent = '';
  if (!name) {
    if (fb) fb.textContent = 'Indica el nombre del proyecto para continuar.';
    const ov = document.getElementById('project-modal');
    ov?.classList.add('project-modal--shake');
    window.setTimeout(() => ov?.classList.remove('project-modal--shake'), 480);
    document.getElementById('project-name-input')?.focus();
    showToast('Indica el nombre del proyecto para continuar', 'warning');
    return;
  }
  window._projectCreateWizardStep = 2;
  syncProjectModalWizardStep();
  const body = document.querySelector('#project-modal .modal-body');
  if (body) {
    body.classList.add('project-modal-body--stepping');
    window.setTimeout(() => body.classList.remove('project-modal-body--stepping'), 240);
  }
}

export function projectModalWizardPrev() {
  window._projectCreateWizardStep = 1;
  syncProjectModalWizardStep();
  const body = document.querySelector('#project-modal .modal-body');
  if (body) {
    body.classList.add('project-modal-body--stepping');
    window.setTimeout(() => body.classList.remove('project-modal-body--stepping'), 240);
  }
}

export function openNewProjectModal(parentProjectId) {
  clearProjectModalFooters();
  setEditingProjectId(null);
  setEditingProjectImages({});
  window._projectCreateWizardStep = 1;
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
  syncProjectModalWizardStep();
  openModal('project-modal');
  syncProjectModalStickyName();
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
  clearProjectModalFooters();
  window._projectCreateWizardStep = 2;
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
  syncProjectModalWizardStep();
  openModal('project-modal');
  syncProjectModalStickyName();
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

export async function saveProject() {
  const fbMain = document.getElementById('project-modal-footer-feedback-main');
  if (fbMain) fbMain.textContent = '';
  if (!editingProjectId && (window._projectCreateWizardStep || 1) === 1) {
    showToast('Pulsa «Siguiente →» para el paso 2 o rellena el nombre y avanza.', 'info');
    return;
  }
  const name = document.getElementById('project-name-input').value.trim();
  if (!name) {
    if (fbMain) fbMain.textContent = 'El nombre del proyecto es obligatorio.';
    showToast('El nombre es requerido', 'error');
    return;
  }
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
      if (fbMain) fbMain.textContent = 'Proyecto padre no válido (evita ciclos en el árbol).';
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
    const updated = {
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
    setProjectSaveLoading(true);
    try {
      const mongoId = (prev && (prev._id || prev.id)) || updated._id || updated.id;
      await projectsTrackedUpdateProject(mongoId, updated);
    } catch (err) {
      console.error('Error actualizando proyecto:', err);
      showToast('Error al guardar en servidor', 'error');
      setProjectSaveLoading(false);
      return;
    }
    setProjectSaveLoading(false);
    projects[idx] = updated;
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
  setProjectSaveLoading(true);
  try {
    const saved = await apiCreateProject(newProj);
    newProj._id = saved._id;
    newProj.id = saved._id || newProj.id;
  } catch (err) {
    console.error('Error creando proyecto:', err);
    showToast('Error al guardar en servidor', 'error');
    setProjectSaveLoading(false);
    return;
  }
  setProjectSaveLoading(false);
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

export async function executeDeleteProjectTree(id) {
  const kill = new Set();
  kill.add(id);
  collectDescendantProjectIds(id, kill);
  try {
    for (const pid of kill) {
      const proj = projects.find(p => sameId(p.id, pid));
      if (proj) {
        const mongoId = proj._id || proj.id;
        await apiDeleteProject(mongoId);
      }
    }
  } catch (err) {
    console.error('Error eliminando proyecto:', err);
    showToast('Error al eliminar en servidor', 'error');
    return;
  }
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
  const presetCol = window._taskModalPresetColumn;
  window._taskModalPresetColumn = null;
  if (presetCol === 'pending') {
    document.getElementById('task-status-input').value = 'pending';
  } else if (presetCol === 'progress') {
    document.getElementById('task-status-input').value = 'progress';
  } else if (presetCol === 'done') {
    document.getElementById('task-status-input').value = 'done';
  }
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
  setTaskModalFooterMsg('');
  const tsb = document.getElementById('task-save-btn');
  if (tsb) {
    tsb.textContent = 'Añadir tarea';
    tsb.dataset.saveLabel = 'Añadir tarea';
  }
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
  setTaskModalFooterMsg('');
  const tsbEdit = document.getElementById('task-save-btn');
  if (tsbEdit) {
    tsbEdit.textContent = 'Guardar tarea';
    tsbEdit.dataset.saveLabel = 'Guardar tarea';
  }
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

export async function saveTask() {
  setTaskModalFooterMsg('');
  const name = document.getElementById('task-name-input').value.trim();
  if (!name) {
    setTaskModalFooterMsg('El nombre de la tarea es obligatorio.');
    showToast('El nombre es requerido', 'error');
    return;
  }
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
      shares: [...rest, ...addSh],
      updatedAt: Date.now(),
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
      shares: addSh,
      createdAt: Date.now(),
    });
    pushProjectActivity(p, { type: 'task_added', taskName: name, taskId: newTaskId });
    showToast('Tarea añadida','success');
  }
  setTaskSaveLoading(true);
  try {
    const mongoId = p._id || p.id;
    await projectsTrackedUpdateProject(mongoId, p);
  } catch (err) {
    console.error('Error guardando tarea en API:', err);
    showToast('Error al guardar en servidor', 'error');
    setTaskSaveLoading(false);
    return;
  }
  setTaskSaveLoading(false);
  saveProjectData();
  closeModal('task-modal');
  setEditingTaskId(null);
  selectProject(currentProjectId);
  renderProjects();
}

export async function quickToggleTask(projectId, taskId, el) {
  const proj = projects.find(pr => sameId(pr.id, projectId));
  if (!proj) return;
  const t = proj.tasks.find(x => sameId(x.id, taskId));
  if (!t) return;

  if (!t.done && t.blockedBy && t.blockedBy.length > 0) {
    const blocking = t.blockedBy
      .map(id => proj.tasks.find(x => sameId(x.id, id)))
      .filter(dep => dep && !dep.done);
    if (blocking.length > 0) {
      showToast(`Bloqueada por: ${blocking.map(d => d.name).join(', ')}`, 'error');
      return;
    }
  }

  const wasDone = t.done;
  const prevStatus = t.status;
  const logLenBefore = Array.isArray(proj.activityLog) ? proj.activityLog.length : 0;
  t.done = !t.done;
  if (t.done) {
    t.status = 'done';
  } else {
    t.status = 'pending';
  }
  if (t.done && !wasDone) {
    pushProjectActivity(proj, { type: 'task_completed', taskName: t.name, taskId: t.id });
  } else if (!t.done && wasDone) {
    pushProjectActivity(proj, { type: 'task_reopened', taskName: t.name, taskId: t.id });
  }
  try {
    const mongoId = proj._id || proj.id;
    const payload = { tasks: proj.tasks };
    if (Array.isArray(proj.activityLog)) {
      payload.activityLog = proj.activityLog;
    }
    await projectsTrackedUpdateProject(mongoId, payload);
  } catch (err) {
    console.error('Error guardando tarea en API:', err);
    t.done = wasDone;
    t.status = prevStatus;
    if (Array.isArray(proj.activityLog) && proj.activityLog.length > logLenBefore) {
      proj.activityLog.shift();
    }
    showToast('No se pudo guardar el cambio; se revirtió', 'error');
    selectProject(projectId);
    return;
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
  const allTasks = proj.tasks;
  const done = allTasks.filter(tk =>
    tk.done === true || tk.done === 'true' || tk.status === 'done'
  ).length;
  const total = allTasks.length;
  const projItem = document.querySelector(`.project-item[data-project-id="${projectId}"] .project-item-meta span:nth-child(2)`);
  if (projItem) projItem.textContent = `${done}/${total} tareas${projectUserFilter !== null ? ' asignadas' : ''}`;
  const progressFill = document.querySelector(`.project-item[data-project-id="${projectId}"] .project-tree-progress-fill`);
  if (progressFill) {
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    progressFill.style.width = `${pct}%`;
  }
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

export function onCalTaskRowDragStart(ev, pid, tid, dueStr) {
  try {
    ev.dataTransfer.setData('application/json', JSON.stringify({ pid, tid, dueStr }));
    ev.dataTransfer.effectAllowed = 'move';
  } catch (_) { /* noop */ }
}

export function onProjectCalMonthDragOver(ev) {
  ev.preventDefault();
  const el = ev.currentTarget;
  if (el?.classList) el.classList.add('cal-month-block--drop-target');
}

export function onProjectCalMonthDragLeave(ev) {
  const el = ev.currentTarget;
  if (el?.classList) el.classList.remove('cal-month-block--drop-target');
}

export async function onProjectCalMonthDrop(ev, monthKey, projectIdStr) {
  ev.preventDefault();
  const el = ev.currentTarget;
  if (el?.classList) el.classList.remove('cal-month-block--drop-target');
  let raw;
  try {
    raw = JSON.parse(ev.dataTransfer.getData('application/json') || '{}');
  } catch (_) {
    return;
  }
  const { pid, tid, dueStr } = raw;
  const p = projects.find(pr => sameId(pr.id, projectIdStr || pid));
  if (!p) return;
  const t = p.tasks.find(x => sameId(x.id, tid));
  if (!t || t.done) return;
  const old = parseProjectTaskDueDate(dueStr || t.dueDate);
  if (!old) return;
  const parts = String(monthKey).split('-');
  const Y = Number(parts[0]);
  const M = Number(parts[1]);
  if (!Y || !M) return;
  const maxD = new Date(Y, M, 0).getDate();
  const day = Math.min(old.getDate(), maxD);
  const nd = new Date(Y, M - 1, day);
  const y = nd.getFullYear();
  const mo = String(nd.getMonth() + 1).padStart(2, '0');
  const da = String(nd.getDate()).padStart(2, '0');
  const newDue = `${y}-${mo}-${da}`;
  if (newDue === t.dueDate) return;
  const prevDue = t.dueDate;
  t.dueDate = newDue;
  pushProjectActivity(p, { type: 'task_updated', taskName: t.name, taskId: t.id });
  try {
    const mongoId = p._id || p.id;
    const payload = { tasks: p.tasks };
    if (Array.isArray(p.activityLog)) payload.activityLog = p.activityLog;
    await projectsTrackedUpdateProject(mongoId, payload);
    showToast('Fecha de la tarea actualizada', 'success');
  } catch (err) {
    console.error(err);
    t.dueDate = prevDue;
    if (Array.isArray(p.activityLog) && p.activityLog.length) p.activityLog.shift();
    showToast('No se pudo guardar la nueva fecha', 'error');
  }
  saveProjectData();
  selectProject(projectIdStr || pid);
}

export function deleteTask(projectId, taskId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) return;
  const task = p.tasks.find(t => sameId(t.id, taskId));
  showConfirmModal({
    icon: '🗑',
    title: '¿Eliminar esta tarea?',
    message: task ? `Se eliminará "${task.name}" y quedará fuera del proyecto.` : 'Se eliminará la tarea.',
    onConfirm: async () => {
      const tasksBackup = JSON.parse(JSON.stringify(p.tasks || []));
      const logBackup = Array.isArray(p.activityLog) ? JSON.parse(JSON.stringify(p.activityLog)) : null;
      const taskName = task?.name || 'Tarea';
      pushProjectActivity(p, { type: 'task_deleted', taskName, taskId });
      p.tasks = p.tasks.filter(t => !sameId(t.id, taskId));
      try {
        const mongoId = p._id || p.id;
        const payload = { tasks: p.tasks };
        if (Array.isArray(p.activityLog)) payload.activityLog = p.activityLog;
        await projectsTrackedUpdateProject(mongoId, payload);
        showToast('Tarea eliminada', 'info', 6000, {
          undoLabel: 'Deshacer',
          onUndo: () => {
            p.tasks = tasksBackup;
            if (logBackup) p.activityLog = logBackup;
            const mid = p._id || p.id;
            const pl = { tasks: p.tasks };
            if (Array.isArray(p.activityLog)) pl.activityLog = p.activityLog;
            projectsTrackedUpdateProject(mid, pl).then(() => {
              saveProjectData();
              renderProjects();
              selectProject(projectId);
            });
          },
        });
      } catch (err) {
        console.error(err);
        p.tasks = tasksBackup;
        if (logBackup) p.activityLog = logBackup;
        showToast('No se pudo eliminar en el servidor', 'error');
        return;
      }
      saveProjectData();
      selectProject(projectId);
      renderProjects();
    },
  });
}

export function saveProjectData() {
  // Compatibilidad — no hacer nada aquí
}

(function bindTaskModalSaveShortcut() {
  document.addEventListener('keydown', e => {
    const m = document.getElementById('task-modal');
    if (!m?.classList.contains('open')) return;
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
    const a = document.activeElement;
    if (!a || !a.closest('#task-modal')) return;
    const ok =
      a.tagName === 'TEXTAREA' ||
      (a.tagName === 'INPUT' &&
        !['button', 'submit', 'checkbox', 'radio', 'file', 'color'].includes(a.type));
    if (!ok) return;
    e.preventDefault();
    saveTask();
  });
})();
