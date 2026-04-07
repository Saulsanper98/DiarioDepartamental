// ===== LOGIN MODULE =====

// Import required dependencies
import {
  USERS,
  GROUPS,
  GROUP_PASSWORDS,
  currentUser,
  currentGroup,
  editingUserId,
  setCurrentUser,
  setCurrentGroup,
  setUSERS,
  setEditingUserId,
  wgInvites,
  notes,
  postitCards,
  projects,
  docs,
  sameId,
  groupViewFilter,
  setGroupViewFilter,
  setNotes,
  setPostitCards,
  setProjects,
  setDocs,
} from './data.js';
import { applyStoredTheme, loadUserTheme, USER_THEMES, isLightColor, createAuroraOrbs, removeAuroraOrbsFromDom } from './themes.js';
import { showToast, openModal, closeModal, showConfirmModal } from './modalControl.js';
import { saveData } from './notes.js';
import { savePostitData } from './postit.js';
import { saveProjectData } from './projects.js';
import { saveDocData } from './docs.js';
import { reloadChatFromStorage, initChatSessionAfterLogin, updateChatNavBadge } from './chat.js';
import { processNotificationInbox } from './notifications.js';
import { loadReadMentions, renderDateNav, showView } from './views.js';

// ===== GRUPO EN EDICIÓN (modal group-modal) =====
let editingGroupName = null;

// ===== PASSWORD MODAL STATE =====
let _pwdGroup = null;
let _pwdIcon = null;
let _pwdAttempts = 0;
const MAX_PWD_ATTEMPTS = 3;

// ===== PASSWORD HASHING =====

// Simple hash function (FNV-1a 32-bit) for client-side obfuscation
function hashPassword(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Pre-hashed group passwords (FNV-1a of originals)
const GROUP_PASSWORD_HASHES = {};
(function() {
  Object.keys(GROUP_PASSWORDS).forEach(g => {
    GROUP_PASSWORD_HASHES[g] = hashPassword(GROUP_PASSWORDS[g]);
  });
})();

// ===== PASSWORD VERIFICATION =====

/**
 * Verify group password
 * @param {string} group - Group name
 * @param {string} input - Password input
 * @returns {boolean} True if password is correct
 */
export function verifyGroupPassword(group, input) {
  const expected = GROUP_PASSWORD_HASHES[group];
  if (!expected) return true; // no password set for group = free access
  return hashPassword(input) === expected;
}

/**
 * Toggle password visibility in modal
 */
export function togglePwdVisibility() {
  const inp = document.getElementById('pwd-modal-input');
  const btn = document.getElementById('pwd-toggle');
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁';
  }
}

/**
 * Cancel password modal
 */
export function cancelPasswordModal() {
  document.getElementById('password-modal-overlay').classList.remove('open');
  document.getElementById('pwd-modal-input').value = '';
  document.getElementById('pwd-error').textContent = '';
  document.getElementById('pwd-attempts').textContent = '';
  _pwdGroup = null;
  _pwdIcon = null;
  _pwdAttempts = 0;
}

/**
 * Submit password from modal
 */
export function submitPassword() {
  const input = document.getElementById('pwd-modal-input').value;
  console.log('submitPassword called, _pwdGroup:', _pwdGroup, 'input:', input);
  // TODO: reactivar validación antes de producción
  // if (!input) {
  //   document.getElementById('pwd-error').textContent = 'Por favor introduce la contraseña.';
  //   return;
  // }

  console.log('Verifying password...');
  // TODO: reactivar validación antes de producción
  // (equivalente a comprobar contraseña del grupo en GROUP_PASSWORDS; aquí se usa verifyGroupPassword)
  // if (input !== GROUP_PASSWORDS[_pwdGroup]) { ... return; }
  // if (verifyGroupPassword(_pwdGroup, input)) {
  const group = _pwdGroup;
  const icon = _pwdIcon;
  // Flujo sin validación: continuar login y cerrar modal (sin returns previos)
  proceedAfterPassword(group, icon);
  cancelPasswordModal();
  // } else {
  //   _pwdAttempts++;
  //   document.getElementById('pwd-modal-input').value = '';
  //   const remaining = MAX_PWD_ATTEMPTS - _pwdAttempts;
  //   if (remaining <= 0) {
  //     document.getElementById('pwd-error').textContent = 'Acceso denegado. Demasiados intentos fallidos.';
  //     document.getElementById('pwd-attempts').textContent = '';
  //     setTimeout(cancelPasswordModal, 2000);
  //   } else {
  //     document.getElementById('pwd-error').textContent = '❌ Contraseña incorrecta.';
  //     document.getElementById('pwd-attempts').textContent = `${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`;
  //   }
  // }
}

/**
 * Open password modal for group
 * @param {string} group - Group name
 * @param {string} icon - Group icon
 */
export function openPasswordModal(group, icon) {
  _pwdGroup = group;
  _pwdIcon = icon;
  _pwdAttempts = 0;
  document.getElementById('pwd-modal-input').value = '';
  document.getElementById('pwd-modal-input').type = 'password';
  document.getElementById('pwd-toggle').textContent = '👁';
  document.getElementById('pwd-error').textContent = '';
  document.getElementById('pwd-attempts').textContent = '';
  document.getElementById('pwd-modal-title').textContent = `🔐 Acceso — ${icon} ${group}`;
  document.getElementById('pwd-modal-desc').textContent = `Introduce la contraseña del grupo "${group}" para continuar.`;
  document.getElementById('password-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('pwd-modal-input').focus(), 80);
}

// ===== GROUP SELECTION =====

/**
 * Select a group and proceed to user selection
 * @param {string} group - Group name
 * @param {string} icon - Group icon
 */
export function selectGroup(group, icon) {
  console.log('selectGroup called with:', group, icon);
  setCurrentGroup(group);
  const hasPassword = !!GROUP_PASSWORDS[group];
  console.log('hasPassword:', hasPassword, 'GROUP_PASSWORDS:', GROUP_PASSWORDS);

  if (!hasPassword) {
    console.log('No password required, proceeding...');
    proceedAfterPassword(group, icon);
    return;
  }

  console.log('Opening password modal...');
  openPasswordModal(group, icon);
}

/**
 * Proceed after password verification
 * @param {string} group - Group name
 * @param {string} icon - Group icon
 */
export function proceedAfterPassword(group, icon) {
  console.log('proceedAfterPassword called with:', group, icon, 'USERS:', USERS);
  setCurrentGroup(group);

  document.getElementById('login-step-1').classList.add('hidden');
  document.getElementById('login-step-2').classList.remove('hidden');
  document.getElementById('step2-label').textContent = '— Paso 2: ' + icon + ' ' + group;

  const usersInGroup = USERS.filter(u => u.group === group);
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = usersInGroup.length === 0
    ? `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;padding:20px">No hay usuarios en este grupo.<br><small>Puedes añadirlos desde Configuración.</small></div>`
    : usersInGroup.map(u => `
      <button class="profile-btn" onclick="selectUser(${u.id})">
        <div class="profile-avatar" style="background:${u.color}">${u.initials}</div>
        <div class="profile-info">
          <strong>${u.name}</strong>
          <span>${u.role}</span>
        </div>
      </button>
    `).join('');
}

/**
 * Go back to group selection
 */
export function backToGroups() {
  document.getElementById('login-step-1').classList.remove('hidden');
  document.getElementById('login-step-2').classList.add('hidden');
  setCurrentGroup(null);
}

// ===== USER SELECTION =====

/**
 * Select a user and login
 * @param {number} id - User ID
 */
export function selectUser(id) {
  console.log('selectUser called with id:', id, 'USERS:', USERS);
  const user = USERS.find(u => u.id === id);
  console.log('Found user:', user);
  if (!user) {
    console.error('User not found with id:', id);
    return;
  }
  setCurrentUser(user);
  console.log('currentUser set to:', currentUser);

  // CRÍTICO: Aplicar tema guardado (desde login o guardado en localStorage global)
  console.log('Applying stored theme...');
  applyStoredTheme();

  // LUEGO mostrar la app
  console.log('Hiding login screen, showing app...');
  const loginScreen = document.getElementById('login-screen');
  const appDiv = document.getElementById('app');
  console.log('login-screen element:', loginScreen, 'app element:', appDiv);
  if (loginScreen) loginScreen.style.display = 'none';
  if (appDiv) appDiv.style.display = 'block';
  console.log('Calling initApp...');
  initApp();
  console.log('initApp completed');
}

// ===== LOGOUT =====

/**
 * Logout current user
 */
export function logout() {
  // Restaurar tema por defecto al salir
  const defaultTheme = USER_THEMES[0];
  const root = document.documentElement;

  // Restaurar clase de tema
  root.className = root.className.replace(/tema-\w+/g, '');
  root.classList.add(`tema-${defaultTheme.id}`);

  // Restaurar variables
  Object.entries(defaultTheme.vars).forEach(([k,v]) => root.style.setProperty(k, v));

  removeAuroraOrbsFromDom();

  setCurrentUser(null);
  setCurrentGroup(null);
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-step-1').classList.remove('hidden');
  document.getElementById('login-step-2').classList.add('hidden');
  renderLoginGroupCounts();
}

// ===== APP INITIALIZATION =====

/**
 * Initialize app after login
 */
export function initApp() {
  reloadChatFromStorage();
  initChatSessionAfterLogin();
  const av = document.getElementById('sidebar-avatar');
  av.textContent = currentUser.initials;
  av.style.background = currentUser.color;
  document.getElementById('sidebar-name').textContent = currentUser.name;
  document.getElementById('sidebar-shift').textContent = currentUser.group + ' · ' + currentUser.role;
  const badgeEl = document.getElementById('brand-group-badge');
  badgeEl.textContent = currentUser.group;
  badgeEl.style.cssText = 'white-space:nowrap !important; overflow:visible !important; display:inline-flex !important; align-items:center !important; flex-shrink:0 !important; width:auto !important; max-width:none !important;';

  // El tema YA se aplicó en selectUser(), pero aplicar colores de post-it según luminosidad
  const themeId = loadUserTheme() || 'default';
  const theme = USER_THEMES.find(t => t.id === themeId) || USER_THEMES[0];
  const root = document.documentElement;
  const bg = theme.vars['--bg'] || '#0f0e0c';
  const isLight = isLightColor(bg);
  if (isLight) {
    root.style.setProperty('--postit-yellow', '#fef9c3');
    root.style.setProperty('--postit-blue',   '#dbeafe');
    root.style.setProperty('--postit-purple',  '#ede9fe');
    root.style.setProperty('--postit-green',   '#dcfce7');
    root.style.setProperty('--postit-red',     '#fee2e2');
  } else {
    root.style.setProperty('--postit-yellow', '#2a2510');
    root.style.setProperty('--postit-blue',   '#0d1e2e');
    root.style.setProperty('--postit-purple',  '#1a1428');
    root.style.setProperty('--postit-green',   '#0d1f18');
    root.style.setProperty('--postit-red',     '#2a1010');
  }

  showView('notes', document.getElementById('nav-all'));
  updateBadges();
  updateWorkGroupInviteNavBadge();
  renderSettingsEditor();

  if (window._inboxTimer) clearInterval(window._inboxTimer);
  processNotificationInbox();
  window._inboxTimer = setInterval(processNotificationInbox, 12000);

  if (document.documentElement.classList.contains('tema-aurora')) {
    createAuroraOrbs();
  }
}

// ===== UTILITY FUNCTIONS =====
// These functions are placeholders that will be implemented in other modules
// They are called from initApp but defined elsewhere

export function updateBadges() {
  if (!currentUser) return;
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
  renderDateNav();
  updateChatNavBadge();
}

export function pendingInvitesForCurrentUser() {
  if (!currentUser) return [];
  return wgInvites.filter(i => i.status === 'pending' && sameId(i.toUserId, currentUser.id));
}

export function updateWorkGroupInviteNavBadge() {
  const n = pendingInvitesForCurrentUser().length;
  const el = document.getElementById('wg-invites-nav-badge');
  if (!el) return;
  if (n > 0) {
    el.textContent = n;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

export function renderSettingsEditor() {
  const list = document.getElementById('users-editor-list');
  const groups = groupViewFilter ? [groupViewFilter] : GROUPS;

  if (!list) return;

  list.innerHTML = groups.map(gr => {
    const groupUsers = USERS.filter(u => u.group === gr);
    return `
      <div class="settings-section" style="padding:12px;margin-bottom:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <strong>${gr} (${groupUsers.length})</strong>
          <div style="display:flex;gap:8px">
            <button class="btn-secondary" onclick="openGroupMembers('${gr}')">Ver miembros</button>
            <button class="btn-secondary" onclick="openEditGroupModal('${gr}')">✏️ Editar grupo</button>
          </div>
        </div>
        ${groupUsers.length === 0 ? '<div style="color:var(--text-muted);font-size:12px">No hay usuarios en este grupo</div>' : groupUsers.map(u => `
          <div class="user-editor-row">
            <div class="user-editor-avatar" style="background:${u.color}">${u.initials}</div>
            <div class="user-editor-info">
              <strong>${u.name}</strong>
              <span>${u.group} · ${u.role}</span>
            </div>
            <button class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick="openEditUserModal(${u.id})">✏️</button>
            <button class="btn-secondary btn-secondary-danger" style="font-size:11px;padding:4px 10px" onclick="removeUser(${u.id})">✕</button>
          </div>`).join('')}
      </div>`;
  }).join('');

  const ge = document.getElementById('groups-editor');
  if (!ge) return;
  const groupsHtml = GROUPS.map(g => {
    const count = USERS.filter(u => u.group === g).length;
    return `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;width:220px;">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${g}</strong>
          <span style="font-size:11px;color:var(--text-muted)">${count} usuario${count===1?'':'s'}</span>
        </div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn-secondary" style="font-size:11px;padding:4px 8px" onclick="openGroupMembers('${g}')">Ver</button>
          <button class="btn-secondary" style="font-size:11px;padding:4px 8px" onclick="openEditGroupModal('${g}')">✏️</button>
        </div>
      </div>`;
  }).join('');

  ge.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px">${groupsHtml}</div>
    <button class="btn-primary" style="margin-top:10px;font-size:11px" onclick="openNewGroupModal()">+ Nuevo Grupo</button>
    ${groupViewFilter ? '<button class="btn-secondary" style="margin-left:12px;font-size:11px" onclick="clearGroupFilter()">Mostrar todos</button>' : ''}
  `;
}

// ===== GROUP COUNT RENDERING =====

/**
 * Render login group counts
 */
export function renderLoginGroupCounts() {
  GROUPS.forEach(g => {
    const el = document.getElementById('g-count-' + g);
    if (el) {
      const count = USERS.filter(u => u.group === g).length;
      el.textContent = count + ' usuario' + (count !== 1 ? 's' : '');
    }
  });
}

// ===== USER MANAGEMENT =====

export function addUser() {
  const name = document.getElementById('new-user-name').value.trim();
  if (!name) { showToast('El nombre es requerido','error'); return; }
  const role = document.getElementById('new-user-role').value.trim() || 'Usuario';
  const group = document.getElementById('new-user-group').value;
  const color = document.getElementById('new-user-color').value;
  const parts = name.split(' ');
  const initials = (parts[0][0] + (parts[1] ? parts[1][0] : (parts[0][1] || ''))).toUpperCase();

  setUSERS([...USERS, {id: Date.now(), name, initials, color, role, group}]);
  showToast('Usuario añadido','success');

  setEditingUserId(null);
  saveUsers();
  closeModal('add-user-modal');
  renderSettingsEditor();
  renderLoginGroupCounts();
}

export function saveEditUserModal() {
  if (editingUserId == null) return;
  const nameEl = document.getElementById('edit-user-name');
  const roleEl = document.getElementById('edit-user-role');
  const groupEl = document.getElementById('edit-user-group');
  const colorEl = document.getElementById('edit-user-color');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { showToast('El nombre es requerido','error'); return; }
  const role = (roleEl && roleEl.value.trim()) || 'Usuario';
  const group = groupEl ? groupEl.value : 'Sistemas';
  const color = colorEl ? colorEl.value : '#e8c547';
  const parts = name.split(' ');
  const initials = (parts[0][0] + (parts[1] ? parts[1][0] : (parts[0][1] || ''))).toUpperCase();

  setUSERS(USERS.map(u => (u.id === editingUserId ? { ...u, name, initials, role, group, color } : u)));
  showToast('Usuario actualizado', 'success');
  setEditingUserId(null);
  saveUsers();
  closeModal('edit-user-modal');
  renderSettingsEditor();
  renderLoginGroupCounts();
}

export function removeUser(id) {
  if (currentUser && currentUser.id === id) { showToast('No puedes eliminar tu propio usuario','error'); return; }
  showConfirmModal({
    icon: '👤',
    title: '¿Eliminar este usuario?',
    message: 'Se eliminará al usuario permanentemente.',
    onConfirm: () => {
      setUSERS(USERS.filter(u => u.id !== id));
      saveUsers();
      renderSettingsEditor();
      renderLoginGroupCounts();
      showToast('Usuario eliminado','info');
    }
  });
  return;
}

export function saveUsers() {
  localStorage.setItem('diario_users', JSON.stringify(USERS));
}

export function openAddUserModal() {
  setEditingUserId(null);
  const title = document.getElementById('add-user-modal-title');
  if (title) title.textContent = 'Añadir Usuario';
  const nameEl = document.getElementById('new-user-name');
  const roleEl = document.getElementById('new-user-role');
  const groupEl = document.getElementById('new-user-group');
  const colorEl = document.getElementById('new-user-color');
  if (nameEl) nameEl.value = '';
  if (roleEl) roleEl.value = '';
  if (groupEl) groupEl.value = 'Sistemas';
  if (colorEl) colorEl.value = '#e8c547';
  openModal('add-user-modal');
}

export function openEditUserModal(id) {
  const user = USERS.find(u => u.id === id);
  if (!user) return;
  setEditingUserId(id);
  const title = document.getElementById('edit-user-modal-title');
  if (title) title.textContent = 'Editar Usuario';
  const nameEl = document.getElementById('edit-user-name');
  const roleEl = document.getElementById('edit-user-role');
  const groupEl = document.getElementById('edit-user-group');
  const colorEl = document.getElementById('edit-user-color');
  if (nameEl) nameEl.value = user.name;
  if (roleEl) roleEl.value = user.role;
  if (groupEl) groupEl.value = user.group;
  if (colorEl) colorEl.value = user.color;
  openModal('edit-user-modal');
}

export function clearGroupFilter() {
  setGroupViewFilter(null);
  renderSettingsEditor();
}

export function openGroupMembers(_groupName) {
  showToast('Ver miembros: pendiente de portar (modal del monolito)', 'info');
}

export function openEditGroupModal(groupName) {
  if (!groupName) return;
  editingGroupName = groupName;
  const input = document.getElementById('group-name-input');
  if (input) input.value = groupName;
  const delBtn = document.getElementById('group-delete-btn');
  if (delBtn) delBtn.classList.remove('hidden');
  openModal('group-modal');
}

export function openNewGroupModal() {
  editingGroupName = null;
  const input = document.getElementById('group-name-input');
  if (input) input.value = '';
  const delBtn = document.getElementById('group-delete-btn');
  if (delBtn) delBtn.classList.add('hidden');
  openModal('group-modal');
}

export function deleteEditingGroup() {
  if (!editingGroupName) return;
  const g = editingGroupName;
  const usedByUsers = USERS.some(u => u.group === g);
  const usedByData =
    notes.some(n => n.group === g) ||
    postitCards.some(p => p.group === g) ||
    projects.some(p => p.group === g) ||
    docs.some(d => d.group === g);
  if (usedByUsers || usedByData) {
    showToast('No puedes borrar un grupo en uso. Reasigna antes sus datos/usuarios.', 'error');
    return;
  }
  showConfirmModal({
    icon: '🏢',
    title: '¿Eliminar este grupo?',
    message: `Se eliminará el grupo "${editingGroupName}" y todos sus datos.`,
    onConfirm: () => {
      const idx = GROUPS.indexOf(g);
      if (idx !== -1) GROUPS.splice(idx, 1);
      closeModal('group-modal');
      editingGroupName = null;
      clearGroupFilter();
      renderLoginGroupCounts();
      renderSettingsEditor();
      showToast('Grupo eliminado', 'info');
    }
  });
  return;
}

export function saveGroup() {
  const name = document.getElementById('group-name-input')?.value.trim();
  if (!name) {
    showToast('El nombre de grupo es requerido', 'error');
    return;
  }
  if (editingGroupName) {
    if (name !== editingGroupName && GROUPS.includes(name)) {
      showToast('Ese grupo ya existe', 'error');
      return;
    }
    const idx = GROUPS.indexOf(editingGroupName);
    if (idx !== -1) GROUPS[idx] = name;
    setUSERS(USERS.map(u => (u.group === editingGroupName ? { ...u, group: name } : u)));
    setNotes(notes.map(n => (n.group === editingGroupName ? { ...n, group: name } : n)));
    setPostitCards(postitCards.map(p => (p.group === editingGroupName ? { ...p, group: name } : p)));
    setProjects(projects.map(p => (p.group === editingGroupName ? { ...p, group: name } : p)));
    setDocs(docs.map(d => (d.group === editingGroupName ? { ...d, group: name } : d)));
    showToast('Grupo actualizado', 'success');
  } else {
    if (GROUPS.includes(name)) {
      showToast('Ese grupo ya existe', 'error');
      return;
    }
    GROUPS.push(name);
    showToast('Grupo creado', 'success');
  }
  saveUsers();
  saveData();
  savePostitData();
  saveProjectData();
  saveDocData();
  closeModal('group-modal');
  editingGroupName = null;
  clearGroupFilter();
  renderLoginGroupCounts();
  renderSettingsEditor();
}