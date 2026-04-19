/**
 * Métricas locales (localStorage) para priorizar mejoras en Notas.
 * Sin PII; solo contadores por clave.
 */
const KEY = 'diario_notes_metrics_v1';

export function bumpNotesMetric(eventKey) {
  if (!eventKey || typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(KEY) || '{}';
    const o = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return;
    o[eventKey] = (Number(o[eventKey]) || 0) + 1;
    o._lastAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}
