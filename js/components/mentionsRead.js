// Persistencia de menciones en notas leídas (localStorage por usuario).
import { currentUser } from './data.js';

export function getReadMentionsKey() {
  return currentUser ? `diario_read_mentions_${currentUser.id}` : null;
}

export function loadReadMentions() {
  const key = getReadMentionsKey();
  if (!key) return new Set();
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return new Set();
    const arr = JSON.parse(stored);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function saveReadMentions(readSet) {
  const key = getReadMentionsKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify([...readSet]));
}
