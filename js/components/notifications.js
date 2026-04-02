// ===== NOTIFICATIONS MODULE =====

import { currentUser, notes } from './data.js';
import { updateChatNavBadge } from './chat.js';
import { loadReadMentions } from './views.js';

export function processNotificationInbox() {
  if (!currentUser) return;

  // This is minimal example behavior:
  //   - notifications are based on mentions (matching old implementation)
  const readSet = loadReadMentions();
  const allMentions = notes.filter(n => n?.group === currentUser.group && n?.mentions?.includes?.(currentUser.id));
  const unreadMentions = allMentions.filter(n => !readSet.has(n.id));

  const mentionsBadge = document.getElementById('mention-badge');
  if (mentionsBadge) {
    if (unreadMentions.length > 0) {
      mentionsBadge.textContent = unreadMentions.length;
      mentionsBadge.classList.remove('hidden');
    } else {
      mentionsBadge.classList.add('hidden');
    }
  }

  const notifBadge = document.getElementById('notif-badge');
  if (notifBadge) {
    if (unreadMentions.length > 0) {
      notifBadge.textContent = unreadMentions.length;
      notifBadge.classList.remove('hidden');
    } else {
      notifBadge.classList.add('hidden');
    }
  }

  if (typeof window.renderDateNav === 'function') {
    window.renderDateNav();
  }

  updateChatNavBadge();
}
