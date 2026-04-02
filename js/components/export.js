// ===== EXPORT MODULE =====

import { notes, postitCards, projects, docs, USERS, currentUser, currentDate, SHIFTS, workGroups, sameId } from './data.js';
import { chatMessages } from './chat.js';
import { saveData, renderNotes } from './notes.js';
import { showToast, escapeChatHtml } from './modalControl.js';

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
        if (n.reminder) txt += `  ⏰ Recordatorio: ${n.reminderTime || 'No especificado'}\n`;
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
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diario_backup_${toDateStr(new Date())}.json`;
  a.click();
  showToast('Backup exportado correctamente', 'success');
}

export function clearAllData() {
  if (!confirm('¿Seguro que quieres eliminar TODAS las notas? Esta acción no se puede deshacer.')) return;
  notes.length = 0;
  saveData();
  renderNotes();
  if (typeof window !== 'undefined' && typeof window.updateBadges === 'function') window.updateBadges();
  showToast('Todas las notas eliminadas', 'info');
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

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}
