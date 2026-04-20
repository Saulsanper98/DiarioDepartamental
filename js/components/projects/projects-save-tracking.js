/**
 * Cola ligera de guardados para Proyectos: refleja peticiones concurrentes en la sync strip.
 */
import { apiUpdateProject } from '../../api.js';

let _pending = 0;

export function getProjectsSavePendingCount() {
  return _pending;
}

function updateStrip() {
  const el = document.getElementById('projects-sync-strip');
  if (!el) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    el.textContent = 'Sin conexión. Los cambios pueden no guardarse en el servidor.';
    el.classList.add('is-offline');
    el.classList.remove('is-ready', 'is-saving');
    return;
  }
  if (_pending > 0) {
    el.textContent =
      _pending === 1 ? 'Guardando cambios…' : `Guardando cambios… (${_pending})`;
    el.classList.add('is-saving');
    el.classList.remove('is-ready', 'is-offline');
    return;
  }
  el.classList.remove('is-saving', 'is-offline');
  el.classList.add('is-ready');
  el.textContent = '';
}

/** PUT proyecto con indicador de cola en la strip de sincronización. */
export async function projectsTrackedUpdateProject(mongoId, payload) {
  _pending++;
  updateStrip();
  try {
    return await apiUpdateProject(mongoId, payload);
  } finally {
    _pending--;
    updateStrip();
  }
}
