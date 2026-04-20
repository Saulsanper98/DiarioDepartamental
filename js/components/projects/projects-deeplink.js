/**
 * Enlace profundo: #/projects/<projectId>[/<taskId>]
 * IDs no deben contener "/" (ObjectId y numéricos cumplen).
 */
const HASH_RE = /^#\/?projects\/([^/]+)(?:\/([^/]+))?\/?$/;

export function parseProjectsDeepLink() {
  const h = typeof location !== 'undefined' ? location.hash || '' : '';
  const m = h.match(HASH_RE);
  if (!m) return null;
  return { projectId: decodeURIComponent(m[1]), taskId: m[2] ? decodeURIComponent(m[2]) : null };
}

export function replaceProjectsDeepLink(projectId, taskId) {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  if (!projectId) return;
  const p = encodeURIComponent(String(projectId));
  const t = taskId != null && String(taskId) ? `/${encodeURIComponent(String(taskId))}` : '';
  const next = `#/projects/${p}${t}`;
  if (location.hash !== next) {
    history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }
}

export function clearProjectsTaskFromHash(projectId) {
  const cur = parseProjectsDeepLink();
  if (!cur || String(cur.projectId) !== String(projectId)) return;
  replaceProjectsDeepLink(projectId, null);
}
