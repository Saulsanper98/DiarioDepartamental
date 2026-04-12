// ===== EXPORT MODULE =====

import {
  notes,
  postitCards,
  projects,
  docs,
  USERS,
  currentUser,
  currentDate,
  SHIFTS,
  workGroups,
  sameId,
  toDateStr,
  setNotes,
  setProjects,
  setDocs,
  setUSERS,
  setWorkGroups,
  setPostitCards,
  comments,
  setComments,
} from './data.js';
import { chatMessages, reloadChatFromStorage, renderChat, updateChatNavBadge } from './chat.js';
import { saveData, renderNotes } from './notes.js';
import { showToast, escapeChatHtml, showConfirmModal, openModal } from './modalControl.js';
import { getProjectCustomTemplatesForBackup, replaceProjectCustomTemplatesFromBackup, renderProjects } from './projects.js';
import { renderPostitBoard } from './postit.js';
import { renderDocs, refreshCommentIndicators } from './docs.js';

export function exportNotes(period) {
  const now = new Date();
  let filtered;
  let periodLabel;

  if (period === 'day') {
    filtered = notes.filter(n => n.date === currentDate && n.group === currentUser.group);
    periodLabel = 'Día ' + currentDate;
  } else if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    filtered = notes.filter(n => n.date >= toDateStr(start) && n.date <= toDateStr(end) && n.group === currentUser.group);
    periodLabel = `Semana ${toDateStr(start)} — ${toDateStr(end)}`;
  } else {
    const year = now.getFullYear();
    const month = now.getMonth();
    const mStart = toDateStr(new Date(year, month, 1));
    const mEnd = toDateStr(new Date(year, month + 1, 0));
    filtered = notes.filter(n => n.date >= mStart && n.date <= mEnd && n.group === currentUser.group);
    periodLabel = now.toLocaleDateString('es-ES', { month:'long', year:'numeric' });
  }

  if (filtered.length === 0) {
    showToast('No hay notas en este período', 'info');
    return;
  }

  let txt = `DIARIO DEPARTAMENTAL\n`;
  txt += `Exportado: ${now.toLocaleString('es-ES')}\n`;
  txt += `Período: ${periodLabel}\n`;
  txt += `Usuario: ${currentUser.name} (${currentUser.group})\n`;
  txt += `${'='.repeat(60)}\n\n`;

  const byDate = {};
  filtered.forEach(n => { if (!byDate[n.date]) byDate[n.date] = []; byDate[n.date].push(n); });

  Object.keys(byDate).sort().forEach(date => {
    txt += `📅 ${date}\n${'─'.repeat(40)}\n`;
    const byShift = {morning:[],afternoon:[],night:[]};
    byDate[date].forEach(n => byShift[n.shift].push(n));
    ['morning','afternoon','night'].forEach(shift => {
      if (byShift[shift].length === 0) return;
      const s = SHIFTS[shift];
      txt += `\n  ${s.emoji} ${s.label} (${s.hours})\n`;
      byShift[shift].forEach(n => {
        const author = USERS.find(u => u.id === n.authorId);
        txt += `\n  [${(n.priority || 'normal').toUpperCase()}] ${n.title}\n`;
        txt += `  Autor: ${author ? author.name : 'Desconocido'}\n`;
        txt += `  ${n.body}\n`;
        if (n.reminder) {
          const rtxt =
            typeof n.reminder === 'string' ? n.reminder : n.reminderTime || 'No especificado';
          txt += `  ⏰ Recordatorio: ${rtxt}\n`;
        }
      });
    });
    txt += '\n';
  });

  const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diario_${period}_${toDateStr(now)}.txt`;
  a.click();
  showToast(`Exportadas ${filtered.length} notas (${period})`, 'success');
}

export function exportAllData() {
  const data = {
    notes,
    postitCards,
    projects,
    docs,
    users: USERS,
    chatMessages,
    workGroups,
    projectCustomTemplates: getProjectCustomTemplatesForBackup(),
    comments: [...comments],
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diario_backup_${toDateStr(new Date())}.json`;
  a.click();
  showToast('Backup exportado correctamente', 'success');
}

function applyDiarioBackupData(data) {
  if (!data || typeof data !== 'object') {
    showToast('Backup vacío o inválido', 'error');
    return;
  }
  try {
    const notesArr = Array.isArray(data.notes) ? data.notes : [];
    const projArr = Array.isArray(data.projects) ? data.projects : [];
    const docsArr = Array.isArray(data.docs) ? data.docs : [];
    const postitArr = Array.isArray(data.postitCards) ? data.postitCards : [];
    const chatArr = Array.isArray(data.chatMessages) ? data.chatMessages : [];
    const wgArr = Array.isArray(data.workGroups) ? data.workGroups : [];

    setNotes(notesArr);
    localStorage.setItem('diario_notes', JSON.stringify(notesArr));

    setProjects(projArr);
    localStorage.setItem('diario_projects', JSON.stringify(projArr));

    setDocs(docsArr);
    localStorage.setItem('diario_docs', JSON.stringify(docsArr));

    if (Array.isArray(data.users) && data.users.length) {
      setUSERS(data.users);
      localStorage.setItem('diario_users', JSON.stringify(data.users));
    }

    setWorkGroups(wgArr);
    localStorage.setItem('diario_workgroups', JSON.stringify(wgArr));

    setPostitCards(postitArr);
    localStorage.setItem('diario_postit', JSON.stringify(postitArr));

    localStorage.setItem('diario_chat', JSON.stringify(chatArr));
    reloadChatFromStorage();

    replaceProjectCustomTemplatesFromBackup(data.projectCustomTemplates);

    if (data.comments !== undefined) {
      const commArr = Array.isArray(data.comments) ? data.comments : [];
      setComments(commArr);
      localStorage.setItem('diario_comments', JSON.stringify(commArr));
    }

    saveData();
    renderNotes();
    renderProjects();
    renderPostitBoard();
    renderDocs();
    renderChat();
    if (typeof refreshCommentIndicators === 'function') refreshCommentIndicators();
    if (currentUser && typeof updateChatNavBadge === 'function') updateChatNavBadge();
    if (typeof window !== 'undefined' && typeof window.updateBadges === 'function') window.updateBadges();

    showToast('Backup restaurado correctamente', 'success');
  } catch (e) {
    console.error(e);
    showToast('Error al aplicar el backup', 'error');
  }
}

/**
 * Abre selector de archivo JSON y restaura datos (incl. plantillas de proyecto personalizadas).
 */
export function triggerImportDiarioBackup() {
  let inp = document.getElementById('import-backup-input');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.id = 'import-backup-input';
    inp.style.cssText = 'position:absolute;width:0;height:0;opacity:0';
    document.body.appendChild(inp);
  }
  inp.onchange = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        showConfirmModal({
          icon: '📥',
          title: 'Restaurar backup',
          destructive: true,
          confirmLabel: 'Sí, reemplazar datos',
          messageHtml:
            '<p class="confirm-modal-lead">Se sustituirán en este navegador las notas, proyectos, documentos, post-it, mensajes de chat, comentarios hilados, grupos de trabajo y plantillas de proyecto personalizadas por el contenido del archivo. Conviene haber exportado un backup reciente antes.</p>',
          onConfirm: () => applyDiarioBackupData(parsed),
        });
      } catch (err) {
        console.error(err);
        showToast('El archivo no es un JSON válido', 'error');
      }
    };
    reader.onerror = () => showToast('No se pudo leer el archivo', 'error');
    reader.readAsText(f, 'utf-8');
  };
  inp.click();
}

export function clearAllData() {
  showConfirmModal({
    icon: '🗑',
    title: '¿Limpiar todos los datos?',
    message: 'Se eliminarán TODAS las notas, tareas y proyectos. Esta acción no se puede deshacer.',
    destructive: true,
    onConfirm: () => {
      notes.length = 0;
      saveData();
      renderNotes();
      if (typeof window !== 'undefined' && typeof window.updateBadges === 'function') window.updateBadges();
      showToast('Todas las notas eliminadas', 'info');
    }
  });
}

export function getPublicNoteShareContextsHtml(note) {
  const shares = note.shares || [];
  if (!shares.length) return '';
  const pills = shares.map(s => {
    if (s.type === 'dept') return `<span class="note-share-pill" title="Compartido con departamento">📁 ${escapeChatHtml(s.deptName || '—')}</span>`;
    if (s.type === 'workgroup') {
      const wg = workGroups.find(w => sameId(w.id, s.workGroupId));
      return `<span class="note-share-pill" title="Compartido con grupo de trabajo">👥 ${escapeChatHtml(wg ? wg.name : 'Grupo')}</span>`;
    }
    if (s.type === 'user') {
      const u = USERS.find(x => sameId(x.id, s.userId));
      return `<span class="note-share-pill" title="Compartido con usuario">👤 ${escapeChatHtml(u ? u.name : 'Usuario')}</span>`;
    }
    return '';
  }).filter(Boolean);
  if (!pills.length) return '';
  return `<div class="note-share-context" title="Contexto de visibilidad">${pills.join('')}</div>`;
}

function safeFilename(name) {
  return String(name || 'proyecto').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_').slice(0, 80);
}

/** Color de acento seguro para CSS en informe PDF (solo hex #RRGGBB). */
function projectPrintAccent(hex) {
  const s = String(hex || '').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : '#7858f6';
}

function buildProjectExportStats(p) {
  const tasks = p.tasks || [];
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const inProgress = tasks.filter(t => !t.done && t.status === 'progress').length;
  const pending = tasks.filter(t => !t.done && t.status !== 'progress').length;
  const overdue = tasks.filter(
    t => !t.done && t.dueDate && new Date(t.dueDate + 'T12:00:00') < new Date()
  ).length;
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalReal = tasks.reduce((sum, t) => sum + (t.realHours || 0), 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, inProgress, pending, overdue, pct, totalEstimated, totalReal };
}

function taskExportStatus(t) {
  if (t.done) return 'Completada';
  if (t.status === 'progress') return 'En progreso';
  return 'Pendiente';
}

function stripMarkdownLight(s) {
  if (!s) return '';
  return String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function collectProjectExportTasks(p) {
  return [...(p.tasks || [])].sort((a, b) => {
    const oa = a.done ? 2 : a.status === 'progress' ? 1 : 0;
    const ob = b.done ? 2 : b.status === 'progress' ? 1 : 0;
    if (oa !== ob) return oa - ob;
    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });
}

/** Descarga un resumen del proyecto en texto plano (.txt). */
export function exportProjectAsText(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) {
    showToast('Proyecto no encontrado', 'error');
    return;
  }
  const now = new Date();
  const st = buildProjectExportStats(p);
  const statusLabels = { activo: 'Activo', pausa: 'En pausa', completado: 'Completado' };
  const subNames = projects
    .filter(c => sameId(c.parentProjectId, p.id))
    .map(c => c.name)
    .sort((a, b) => a.localeCompare(b, 'es'));

  let txt = 'DIARIO DEPARTAMENTAL — RESUMEN DE PROYECTO\n';
  txt += `${'='.repeat(56)}\n\n`;
  txt += `Proyecto: ${p.name}\n`;
  txt += `Estado: ${statusLabels[p.status] || p.status}\n`;
  txt += `Exportado: ${now.toLocaleString('es-ES')}\n`;
  if (currentUser) txt += `Usuario: ${currentUser.name} (${currentUser.group})\n`;
  txt += '\n';

  if (p.desc) {
    txt += 'DESCRIPCIÓN\n';
    txt += `${'-'.repeat(40)}\n`;
    txt += `${stripMarkdownLight(p.desc)}\n\n`;
  }

  txt += 'PROGRESO Y ESTADÍSTICAS\n';
  txt += `${'-'.repeat(40)}\n`;
  txt += `Tareas totales: ${st.total}\n`;
  txt += `Completadas: ${st.done} (${st.pct}%)\n`;
  txt += `En progreso: ${st.inProgress}\n`;
  txt += `Pendientes: ${st.pending}\n`;
  if (st.overdue) txt += `Vencidas (sin completar): ${st.overdue}\n`;
  if (st.totalEstimated > 0) {
    txt += `Horas estimadas (suma): ${st.totalEstimated} h\n`;
    txt += `Horas reales (suma): ${st.totalReal} h\n`;
  }
  txt += '\n';

  if (subNames.length) {
    txt += 'SUBPROYECTOS\n';
    txt += `${'-'.repeat(40)}\n`;
    subNames.forEach(n => { txt += `· ${n}\n`; });
    txt += '\n';
  }

  const taskLines = collectProjectExportTasks(p);
  txt += `TAREAS (${taskLines.length})\n`;
  txt += `${'-'.repeat(40)}\n`;
  taskLines.forEach(t => {
    const assignee = USERS.find(u => sameId(u.id, t.assigneeId));
    txt += `\n• ${t.name}\n`;
    txt += `  Estado: ${taskExportStatus(t)}\n`;
    if (t.priority && t.priority !== 'normal') txt += `  Prioridad: ${t.priority}\n`;
    if (t.dueDate) txt += `  Fecha límite: ${t.dueDate}\n`;
    if (assignee) txt += `  Asignado: ${assignee.name}\n`;
    if (t.estimatedHours != null || t.realHours != null) {
      txt += `  Horas: ${t.realHours != null ? t.realHours + ' real' : '—'} / ${t.estimatedHours != null ? t.estimatedHours + ' est.' : '—'}\n`;
    }
    if (t.blockedBy && t.blockedBy.length) {
      txt += `  Dependencias: ${t.blockedBy.length}\n`;
    }
    if (t.desc) {
      const d = stripMarkdownLight(t.desc).split('\n').map(line => `  ${line}`).join('\n');
      txt += `  Detalle:\n${d}\n`;
    }
  });
  txt += '\n';

  const log = p.activityLog || [];
  if (log.length) {
    txt += 'ACTIVIDAD RECIENTE (últimas entradas)\n';
    txt += `${'-'.repeat(40)}\n`;
    const actor = uid => {
      if (uid == null) return 'Alguien';
      const u = USERS.find(x => sameId(x.id, uid));
      return u ? u.name : 'Alguien';
    };
    const lineMsg = e => {
      const who = actor(e.userId);
      const tn = e.taskName || 'Tarea';
      switch (e.type) {
        case 'task_added': return `${who} añadió «${tn}»`;
        case 'task_updated': return `${who} actualizó «${tn}»`;
        case 'task_completed': return `${who} completó «${tn}»`;
        case 'task_reopened': return `${who} reabrió «${tn}»`;
        case 'task_deleted': return `${who} eliminó «${tn}»`;
        case 'template_applied':
          return `${who} aplicó la plantilla «${tn}» (${e.detail ?? 0} tareas)`;
        default: return `${who} modificó «${tn}»`;
      }
    };
    log.slice(0, 25).forEach(e => {
      const when = new Date(e.at).toLocaleString('es-ES');
      txt += `· ${when} — ${lineMsg(e)}\n`;
    });
  }

  txt += `\n${'='.repeat(56)}\nGenerado por Diario Departamental\n`;

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `proyecto_${safeFilename(p.name)}_${toDateStr(now)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Resumen del proyecto descargado (.txt)', 'success');
}

/** Abre una ventana con informe imprimible (Imprimir → Guardar como PDF). */
export function openProjectPrintReport(projectId) {
  const p = projects.find(pr => sameId(pr.id, projectId));
  if (!p) {
    showToast('Proyecto no encontrado', 'error');
    return;
  }
  const accent = projectPrintAccent(p.color);
  const now = new Date();
  const st = buildProjectExportStats(p);
  const statusLabels = { activo: 'Activo', pausa: 'En pausa', completado: 'Completado' };
  const subNames = projects
    .filter(c => sameId(c.parentProjectId, p.id))
    .map(c => escapeChatHtml(c.name))
    .sort((a, b) => a.localeCompare(b, 'es'));

  const tasksHtml = collectProjectExportTasks(p)
    .map(t => {
      const assignee = USERS.find(u => sameId(u.id, t.assigneeId));
      const stLabel = taskExportStatus(t);
      let badgeClass = 'badge-pend';
      if (t.done) badgeClass = 'badge-hecho';
      else if (t.status === 'progress') badgeClass = 'badge-prog';
      const chips = [];
      if (t.priority && t.priority !== 'normal') {
        chips.push(`Prioridad: ${t.priority}`);
      }
      if (t.dueDate) chips.push(`Vence: ${t.dueDate}`);
      if (assignee) chips.push(`Asignado: ${assignee.name}`);
      if (t.estimatedHours != null || t.realHours != null) {
        chips.push(
          `Horas: ${t.realHours != null ? `${t.realHours} h real` : '—'} / ${t.estimatedHours != null ? `${t.estimatedHours} h est.` : '—'}`,
        );
      }
      if (t.blockedBy && t.blockedBy.length) {
        chips.push(`${t.blockedBy.length} dependencia(s)`);
      }
      const chipsHtml = chips
        .map(c => `<span class="chip">${escapeChatHtml(c)}</span>`)
        .join('');
      const desc = t.desc
        ? `<div class="task-desc">${escapeChatHtml(stripMarkdownLight(t.desc)).replace(/\n/g, '<br>')}</div>`
        : '';
      return `<article class="task-card">
  <header class="task-card-head">
    <h3 class="task-title">${escapeChatHtml(t.name)}</h3>
    <span class="badge ${badgeClass}">${escapeChatHtml(stLabel)}</span>
  </header>
  ${chipsHtml ? `<div class="task-chips">${chipsHtml}</div>` : ''}
  ${desc}
</article>`;
    })
    .join('');

  const log = p.activityLog || [];
  const actor = uid => {
    if (uid == null) return 'Alguien';
    const u = USERS.find(x => sameId(x.id, uid));
    return u ? escapeChatHtml(u.name) : 'Alguien';
  };
  const logHtml = log.length
    ? `<div class="activity-list">${log
        .slice(0, 20)
        .map(e => {
          const tn = escapeChatHtml(e.taskName || 'Tarea');
          let msg = '';
          switch (e.type) {
            case 'task_added': msg = `${actor(e.userId)} añadió «${tn}»`; break;
            case 'task_updated': msg = `${actor(e.userId)} actualizó «${tn}»`; break;
            case 'task_completed': msg = `${actor(e.userId)} completó «${tn}»`; break;
            case 'task_reopened': msg = `${actor(e.userId)} reabrió «${tn}»`; break;
            case 'task_deleted': msg = `${actor(e.userId)} eliminó «${tn}»`; break;
            case 'template_applied':
              msg = `${actor(e.userId)} aplicó la plantilla «${tn}» (${e.detail ?? 0} tareas)`;
              break;
            default: msg = `${actor(e.userId)} modificó «${tn}»`;
          }
          const d = new Date(e.at);
          const when = escapeChatHtml(d.toLocaleString('es-ES'));
          const iso = escapeChatHtml(d.toISOString());
          return `<div class="activity-row">
  <time class="activity-time" datetime="${iso}">${when}</time>
  <p class="activity-msg">${msg}</p>
</div>`;
        })
        .join('')}</div>`
    : '<p class="muted empty-hint">Sin actividad registrada.</p>';

  const descBlock = p.desc
    ? `<section class="block">
  <h2 class="section-title">Descripción</h2>
  <div class="prose">${escapeChatHtml(stripMarkdownLight(p.desc)).replace(/\n/g, '<br>')}</div>
</section>`
    : '';

  const subBlock = subNames.length
    ? `<section class="block">
  <h2 class="section-title">Subproyectos</h2>
  <ul class="sub-list">${subNames.map(n => `<li>${n}</li>`).join('')}</ul>
</section>`
    : '';

  const hoursBlock =
    st.totalEstimated > 0
      ? `<div class="stat-row"><span class="stat-k">Horas (real / est.)</span><span class="stat-v">${st.totalReal} h / ${st.totalEstimated} h</span></div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeChatHtml(p.name)} — Informe</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --accent: ${accent};
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --surface: #f8fafc;
    }
    @page { margin: 14mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      color: var(--ink);
      line-height: 1.5;
      max-width: 190mm;
      margin: 0 auto;
      padding: 0 0 36px;
      background: #fff;
      font-size: 13px;
    }
    .no-print { font-size: 12px; color: var(--muted); margin: 0 20px 16px; padding: 10px 14px; background: var(--surface); border-radius: 8px; border: 1px solid var(--line); }
    .report-hero {
      margin: 0 0 28px;
      border-radius: 0 0 14px 14px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-top: none;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
    }
    .report-accent-bar {
      height: 5px;
      background: var(--accent);
    }
    .report-hero-inner {
      padding: 22px 22px 20px;
      background: linear-gradient(165deg, #fff 0%, var(--surface) 100%);
    }
    .brand-row {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }
    h1.report-title {
      font-family: 'Syne', sans-serif;
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 16px;
      line-height: 1.15;
      color: var(--ink);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px 24px;
      font-size: 12.5px;
      color: var(--muted);
    }
    .meta-grid .lbl { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 2px; }
    .meta-grid .val { color: var(--ink); font-weight: 600; }
    .block { margin: 0 20px 22px; }
    h2.section-title {
      font-family: 'Syne', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--line);
    }
    .prose { font-size: 13px; color: #334155; line-height: 1.6; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0;
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }
    .stat-row:nth-child(odd) { background: #fafbfc; }
    .stat-row:last-child { border-bottom: none; }
    .stat-k { color: var(--muted); font-size: 12px; }
    .stat-v { font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
    .sub-list { margin: 0; padding-left: 1.15rem; color: #334155; }
    .sub-list li { margin: 4px 0; }
    .tasks-list { display: flex; flex-direction: column; gap: 12px; }
    .task-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 14px;
      background: #fff;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .task-card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px 12px;
      margin-bottom: 8px;
    }
    h3.task-title {
      font-size: 14px;
      font-weight: 700;
      margin: 0;
      flex: 1;
      min-width: 0;
      color: var(--ink);
    }
    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 4px 10px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .badge-hecho { background: #dcfce7; color: #166534; }
    .badge-prog { background: #fef3c7; color: #92400e; }
    .badge-pend { background: #f1f5f9; color: #475569; }
    .task-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
    .chip {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--surface);
      border: 1px solid var(--line);
      color: #475569;
    }
    .task-desc {
      font-size: 12px;
      color: #475569;
      line-height: 1.55;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--line);
    }
    .activity-list { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
    .activity-row {
      display: grid;
      grid-template-columns: 148px 1fr;
      gap: 12px 16px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      align-items: start;
    }
    .activity-row:last-child { border-bottom: none; }
    .activity-row:nth-child(odd) { background: #fafbfc; }
    .activity-time {
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 11px;
      color: var(--muted);
      margin: 0;
    }
    .activity-msg { margin: 0; font-size: 12px; color: #334155; line-height: 1.45; }
    .muted { color: var(--muted); }
    .empty-hint { margin: 0 20px; }
    .footer {
      margin: 28px 20px 0;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .footer strong { color: var(--muted); }
    @media print {
      body { padding-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .report-hero { box-shadow: none; }
    }
    @media (max-width: 520px) {
      .stats-grid { grid-template-columns: 1fr; }
      .activity-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <p class="no-print">Usa <strong>Imprimir</strong> en tu navegador y elige <strong>Guardar como PDF</strong> si lo necesitas.</p>
  <header class="report-hero">
    <div class="report-accent-bar"></div>
    <div class="report-hero-inner">
      <div class="brand-row">Diario departamental · Informe de proyecto</div>
      <h1 class="report-title">${escapeChatHtml(p.name)}</h1>
      <div class="meta-grid">
        <div><span class="lbl">Estado del proyecto</span><span class="val">${escapeChatHtml(statusLabels[p.status] || p.status)}</span></div>
        <div><span class="lbl">Exportado</span><span class="val">${escapeChatHtml(now.toLocaleString('es-ES'))}</span></div>
        ${
          currentUser
            ? `<div><span class="lbl">Usuario</span><span class="val">${escapeChatHtml(currentUser.name)} · ${escapeChatHtml(currentUser.group)}</span></div>`
            : ''
        }
      </div>
    </div>
  </header>
  ${descBlock}
  <section class="block">
    <h2 class="section-title">Progreso y estadísticas</h2>
    <div class="stats-grid">
      <div class="stat-row"><span class="stat-k">Tareas totales</span><span class="stat-v">${st.total}</span></div>
      <div class="stat-row"><span class="stat-k">Completadas</span><span class="stat-v">${st.done} (${st.pct}%)</span></div>
      <div class="stat-row"><span class="stat-k">En progreso</span><span class="stat-v">${st.inProgress}</span></div>
      <div class="stat-row"><span class="stat-k">Pendientes</span><span class="stat-v">${st.pending}</span></div>
      ${st.overdue ? `<div class="stat-row"><span class="stat-k">Vencidas (sin completar)</span><span class="stat-v">${st.overdue}</span></div>` : ''}
      ${hoursBlock}
    </div>
  </section>
  ${subBlock}
  <section class="block">
    <h2 class="section-title">Tareas</h2>
    <div class="tasks-list">${tasksHtml || '<p class="muted empty-hint" style="margin:0">Sin tareas en el proyecto.</p>'}</div>
  </section>
  <section class="block">
    <h2 class="section-title">Actividad reciente</h2>
    ${logHtml}
  </section>
  <footer class="footer">
    <span><strong>Diario Departamental</strong> — informe de proyecto</span>
    <span>${escapeChatHtml(now.toLocaleDateString('es-ES'))}</span>
  </footer>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    showToast('Permite ventanas emergentes para abrir el informe', 'error');
    return;
  }
  w.addEventListener(
    'load',
    () => {
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          /* ignore */
        }
      }, 300);
    },
    { once: true }
  );
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  showToast('Informe abierto: usa Imprimir para PDF', 'info');
}

// ══════════════════════════════════════════════════
// INFORME DEPARTAMENTAL AUTOMÁTICO
// ══════════════════════════════════════════════════

export function openReportModal() {
  const modal = document.getElementById('report-modal');
  if (modal) openModal('report-modal');
}

export function generateDepartmentReport(period) {
  if (!currentUser) return;

  const now = new Date();
  let startDate, endDate, periodLabel;

  if (period === 'week') {
    const start = new Date(now);
    const dow = start.getDay();
    start.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    startDate = toDateStr(start);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    endDate = toDateStr(end);
    periodLabel = `Semana del ${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} al ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  } else {
    const year = now.getFullYear();
    const month = now.getMonth();
    startDate = toDateStr(new Date(year, month, 1));
    endDate = toDateStr(new Date(year, month + 1, 0));
    periodLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    periodLabel = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);
  }

  const group = currentUser.group;
  const generatedAt = now.toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Datos de notas ──
  const periodNotes = notes.filter(n => n.date >= startDate && n.date <= endDate && n.group === group);

  const notesByShift = { morning: 0, afternoon: 0, night: 0 };
  periodNotes.forEach(n => { if (notesByShift[n.shift] !== undefined) notesByShift[n.shift]++; });

  const notesByUser = {};
  periodNotes.forEach(n => {
    const u = USERS.find(usr => sameId(usr.id, n.authorId));
    const name = u ? u.name : 'Desconocido';
    notesByUser[name] = (notesByUser[name] || 0) + 1;
  });

  const tagCount = {};
  periodNotes.forEach(n => (n.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const highPriorityNotes = periodNotes.filter(n => n.priority === 'alta');

  // Días sin notas
  const daysInPeriod = [];
  const cur = new Date(startDate + 'T12:00:00');
  const endD = new Date(endDate + 'T12:00:00');
  while (cur <= endD) { daysInPeriod.push(toDateStr(cur)); cur.setDate(cur.getDate() + 1); }
  const daysWithNotes = new Set(periodNotes.map(n => n.date));
  const daysWithoutNotes = daysInPeriod.filter(d => !daysWithNotes.has(d));

  // ── Datos de proyectos ──
  const groupProjects = projects.filter(p => p.group === group && !p.parentProjectId);
  const projectStats = groupProjects.map(p => {
    const tasks = p.tasks || [];
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const inProgress = tasks.filter(t => !t.done && t.status === 'progress').length;
    const overdue = tasks.filter(t => !t.done && t.dueDate && t.dueDate < toDateStr(now)).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    return { name: p.name, total, done, inProgress, overdue, pct };
  });

  const allTasks = groupProjects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectName: p.name })));
  const overdueTasks = allTasks.filter(t => !t.done && t.dueDate && t.dueDate < toDateStr(now));

  const tasksByUser = {};
  allTasks.filter(t => !t.done && t.assigneeId != null).forEach(t => {
    const u = USERS.find(usr => sameId(usr.id, t.assigneeId));
    const name = u ? u.name : 'Sin asignar';
    tasksByUser[name] = (tasksByUser[name] || 0) + 1;
  });

  // ── Datos de traspasos ──
  let handovers = [];
  try {
    const raw = localStorage.getItem('diario_handovers');
    handovers = raw ? JSON.parse(raw) : [];
  } catch { handovers = []; }
  const periodHandovers = handovers.filter(h => h.group === group && h.date >= startDate && h.date <= endDate);

  // ── Métricas resumen ──
  const totalDoneTasks = allTasks.filter(t => t.done).length;

  // ── Generar HTML del informe ──
  const accentColor = '#7858f6';
  const esc = s => escapeChatHtml(String(s ?? ''));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe ${esc(group)} — ${esc(periodLabel)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; line-height: 1.5; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
  @media print { .page { padding: 20px; } .no-print { display: none !important; } }

  /* Header */
  .report-header { border-bottom: 3px solid ${accentColor}; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .report-brand { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .report-title { font-size: 24px; font-weight: 700; color: #1a1a2e; }
  .report-period { font-size: 14px; color: ${accentColor}; font-weight: 600; margin-top: 4px; }
  .report-meta { text-align: right; font-size: 11px; color: #888; line-height: 1.7; }

  /* Secciones */
  .section { margin-bottom: 40px; }
  .section-title { font-size: 15px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #e8e8f0; padding-bottom: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }

  /* Stats grid */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: #f8f8ff; border: 1px solid #e8e8f0; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-card .num { font-size: 28px; font-weight: 700; color: ${accentColor}; line-height: 1; }
  .stat-card .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
  .stat-card.danger .num { color: #dc2626; }
  .stat-card.success .num { color: #16a34a; }

  /* Tablas */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f0eeff; color: ${accentColor}; font-weight: 700; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f8; color: #333; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }

  /* Progress bar */
  .progress-wrap { background: #e8e8f0; border-radius: 4px; height: 6px; width: 100px; display: inline-block; vertical-align: middle; }
  .progress-fill { height: 100%; border-radius: 4px; background: ${accentColor}; }

  /* Tags */
  .tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; background: #f0eeff; color: ${accentColor}; font-size: 11px; font-family: monospace; }
  .tag-pill .cnt { background: ${accentColor}; color: #fff; border-radius: 10px; padding: 0 5px; font-size: 10px; }

  /* Badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-ok { background: #dcfce7; color: #16a34a; }
  .badge-warn { background: #fef9c3; color: #854d0e; }
  .badge-danger { background: #fee2e2; color: #dc2626; }
  .badge-info { background: #e0f2fe; color: #0369a1; }

  /* Traspasos */
  .handover-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f0f0f8; font-size: 12px; }
  .handover-row:last-child { border-bottom: none; }

  /* Print button */
  .print-btn { position: fixed; bottom: 24px; right: 24px; background: ${accentColor}; color: #fff; border: none; border-radius: 12px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(120,88,246,0.4); }
  .print-btn:hover { filter: brightness(1.1); }

  /* Days without notes */
  .days-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .day-chip { padding: 3px 10px; border-radius: 20px; background: #fee2e2; color: #dc2626; font-size: 11px; font-family: monospace; }
</style>
</head>
<body>
<div class="page">

  <button class="print-btn no-print" onclick="window.print()">🖨️ Guardar como PDF</button>

  <!-- CABECERA -->
  <div class="report-header">
    <div>
      <div class="report-brand">Diario Departamental</div>
      <div class="report-title">Informe de Actividad</div>
      <div class="report-period">${esc(group)} · ${esc(periodLabel)}</div>
    </div>
    <div class="report-meta">
      Generado por: <strong>${esc(currentUser.name)}</strong><br>
      Fecha: ${esc(generatedAt)}<br>
      Período: ${esc(startDate)} / ${esc(endDate)}
    </div>
  </div>

  <!-- RESUMEN EJECUTIVO -->
  <div class="section">
    <div class="section-title">📊 Resumen Ejecutivo</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="num">${periodNotes.length}</div>
        <div class="lbl">Notas del período</div>
      </div>
      <div class="stat-card">
        <div class="num">${groupProjects.length}</div>
        <div class="lbl">Proyectos activos</div>
      </div>
      <div class="stat-card success">
        <div class="num">${totalDoneTasks}</div>
        <div class="lbl">Tareas completadas</div>
      </div>
      <div class="stat-card${overdueTasks.length > 0 ? ' danger' : ''}">
        <div class="num">${overdueTasks.length}</div>
        <div class="lbl">Tareas vencidas</div>
      </div>
    </div>
  </div>

  <!-- ACTIVIDAD DE NOTAS -->
  <div class="section">
    <div class="section-title">📋 Actividad de Notas</div>

    <table style="margin-bottom:20px">
      <thead><tr><th>Turno</th><th>Notas</th><th>% del total</th></tr></thead>
      <tbody>
        ${['morning', 'afternoon', 'night'].map(s => {
          const sh = SHIFTS[s];
          const cnt = notesByShift[s];
          const pct = periodNotes.length > 0 ? Math.round(cnt / periodNotes.length * 100) : 0;
          return `<tr>
            <td>${sh.emoji} ${esc(sh.label)} (${esc(sh.hours)})</td>
            <td><strong>${cnt}</strong></td>
            <td>
              <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
              <span style="margin-left:8px;color:#888">${pct}%</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <table style="margin-bottom:20px">
      <thead><tr><th>Técnico</th><th>Notas</th></tr></thead>
      <tbody>
        ${Object.entries(notesByUser).sort((a, b) => b[1] - a[1]).map(([name, cnt]) =>
          `<tr><td>${esc(name)}</td><td><strong>${cnt}</strong></td></tr>`
        ).join('')}
      </tbody>
    </table>

    ${topTags.length > 0 ? `
    <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Etiquetas más usadas</p>
    <div class="tags-wrap" style="margin-bottom:20px">
      ${topTags.map(([tag, cnt]) => `<span class="tag-pill">${esc(tag)} <span class="cnt">${cnt}</span></span>`).join('')}
    </div>` : ''}

    ${highPriorityNotes.length > 0 ? `
    <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Notas de alta prioridad</p>
    <table style="margin-bottom:20px">
      <thead><tr><th>Fecha</th><th>Turno</th><th>Título</th><th>Autor</th></tr></thead>
      <tbody>
        ${highPriorityNotes.map(n => {
          const author = USERS.find(usr => sameId(usr.id, n.authorId));
          const sh = SHIFTS[n.shift];
          return `<tr>
            <td>${esc(n.date)}</td>
            <td>${sh ? esc(sh.emoji + ' ' + sh.label) : esc(n.shift)}</td>
            <td>${esc(n.title || 'Sin título')}</td>
            <td>${author ? esc(author.name) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : ''}

    ${daysWithoutNotes.length > 0 ? `
    <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Días sin notas</p>
    <div class="days-list" style="margin-bottom:16px">
      ${daysWithoutNotes.map(d => `<span class="day-chip">${esc(d)}</span>`).join('')}
    </div>` : '<p style="color:#16a34a;font-size:12px;margin-bottom:16px">✅ Sin días sin cobertura en este período.</p>'}
  </div>

  <!-- ESTADO DE PROYECTOS -->
  <div class="section">
    <div class="section-title">🎯 Estado de Proyectos</div>

    ${projectStats.length > 0 ? `
    <table style="margin-bottom:20px">
      <thead><tr><th>Proyecto</th><th>Progreso</th><th>Tareas</th><th>En progreso</th><th>Vencidas</th></tr></thead>
      <tbody>
        ${projectStats.map(p => `<tr>
          <td><strong>${esc(p.name)}</strong></td>
          <td>
            <div class="progress-wrap"><div class="progress-fill" style="width:${p.pct}%"></div></div>
            <span style="margin-left:8px;color:#888">${p.pct}%</span>
          </td>
          <td>${p.done}/${p.total}</td>
          <td>${p.inProgress > 0 ? `<span class="badge badge-info">${p.inProgress}</span>` : '—'}</td>
          <td>${p.overdue > 0 ? `<span class="badge badge-danger">${p.overdue}</span>` : '<span class="badge badge-ok">0</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p style="color:#888;font-size:12px;margin-bottom:20px">No hay proyectos en este período.</p>'}

    ${overdueTasks.length > 0 ? `
    <p style="font-size:11px;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">⚠️ Tareas vencidas sin completar</p>
    <table style="margin-bottom:20px">
      <thead><tr><th>Proyecto</th><th>Tarea</th><th>Vencimiento</th><th>Asignado</th></tr></thead>
      <tbody>
        ${overdueTasks.map(t => {
          const u = USERS.find(usr => sameId(usr.id, t.assigneeId));
          return `<tr>
            <td>${esc(t.projectName)}</td>
            <td>${esc(t.name)}</td>
            <td><span class="badge badge-danger">${esc(t.dueDate)}</span></td>
            <td>${u ? esc(u.name) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : ''}

    ${Object.keys(tasksByUser).length > 0 ? `
    <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Carga de trabajo pendiente por técnico</p>
    <table style="margin-bottom:20px">
      <thead><tr><th>Técnico</th><th>Tareas pendientes</th></tr></thead>
      <tbody>
        ${Object.entries(tasksByUser).sort((a, b) => b[1] - a[1]).map(([name, cnt]) =>
          `<tr><td>${esc(name)}</td><td><strong>${cnt}</strong></td></tr>`
        ).join('')}
      </tbody>
    </table>` : ''}
  </div>

  <!-- TRASPASOS -->
  <div class="section">
    <div class="section-title">🔄 Traspasos del Período</div>
    ${periodHandovers.length > 0 ? `
    <table>
      <thead><tr><th>Fecha</th><th>De</th><th>A</th><th>Entregado por</th><th>Estado</th></tr></thead>
      <tbody>
        ${periodHandovers.map(h => {
          const from = SHIFTS[h.fromShift];
          const to = SHIFTS[h.toShift];
          const status = h.receivedBy
            ? '<span class="badge badge-ok">✅ Recibido</span>'
            : '<span class="badge badge-warn">⏳ Sin confirmar</span>';
          return `<tr>
            <td>${esc(h.date)}</td>
            <td>${from ? esc(from.emoji + ' ' + from.label) : esc(h.fromShift)}</td>
            <td>${to ? esc(to.emoji + ' ' + to.label) : esc(h.toShift)}</td>
            <td>${esc(h.authorName || '—')}</td>
            <td>${status}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<p style="color:#888;font-size:12px">No hay traspasos registrados en este período.</p>'}
  </div>

  <!-- PIE -->
  <div style="border-top:1px solid #e8e8f0;padding-top:16px;margin-top:32px;font-size:10px;color:#bbb;text-align:center">
    Diario Departamental · ${esc(group)} · Informe generado el ${esc(generatedAt)}
  </div>

</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    showToast('Activa las ventanas emergentes para ver el informe', 'error');
  }
}
