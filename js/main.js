// ===== MAIN APPLICATION MODULE =====

import { initMSAL, getCurrentUser, getAuthHeaders } from './auth.js';
import { setNotes, setProjects, setDocs, setUSERS, setWorkGroups, setWgInvites, setComments, setCurrentUser, currentUser, wgInvites, makeImageKey, registerTempImage, collectImageMap, editingNoteImages, setEditingNoteImages, editingPostitImages, setEditingPostitImages, editingDocImages, setEditingDocImages, editingProjectImages, setEditingProjectImages, editingTaskImages, setEditingTaskImages } from './components/data.js';
import {
  showView,
  renderDateNav,
  navigateWeek,
  toggleShiftFilter,
  handleSearch,
  onNotesSearchHistoryChange,
  setNoteView,
  setNoteViewCalendar,
  markAllNoteMentionsAsRead,
  createWorkGroup,
  openWorkGroupInvitesModal,
  onWorkGroupCardClick,
  openEditWorkGroupModal,
  deleteWorkGroup,
  saveWorkGroupEdit,
  acceptWgInvite,
  declineWgInvite,
  removeWgMember,
  saveNewWorkGroup,
  onWgEditInviteSearchInput,
  selectWgInviteSuggestion,
  sendWgInviteFromEditModal,
} from './components/views.js';
import {
  selectGroup,
  submitPassword,
  togglePwdVisibility,
  cancelPasswordModal,
  openPasswordModal,
  proceedAfterPassword,
  backToGroups,
  selectUser as loginSelectUser,
  logout as appLogout,
  logoutMicrosoft as appLogoutMicrosoft,
  addUser,
  removeUser,
  saveUsers,
  verifyGroupPassword,
  openAddUserModal,
  openEditUserModal,
  saveEditUserModal,
  clearGroupFilter,
  openGroupMembers,
  openEditGroupModal,
  openNewGroupModal,
  saveGroup,
  deleteEditingGroup,
} from './components/login.js';
import {
  applyStoredTheme,
  loadCustomThemeIfSaved,
  renderLoginThemeButtons,
  toggleLoginThemePanel,
  resetUserTheme,
  toggleCustomThemePanel,
  previewCustomTheme,
  saveCustomTheme,
  deleteCustomTheme,
  applyUserTheme,
  applyUserThemeLogin,
  saveCfg,
  applyAccentColor,
  applyAccent2Color,
  renderThemeGrid,
} from './components/themes.js?v=2';
import {
  openNewNoteModal,
  editNote,
  saveNote,
  deleteNote,
  toggleShiftSection,
  openImageModal,
  executeSlashCommand,
  insertImage,
  insertImagePostit,
  insertImageDoc,
  insertImageProject,
  insertImageTask,
  selectShiftOpt,
  selectPriority,
  selectVisibility,
  toggleReminder,
  toggleNotePinnedModal,
  handleNoteEditorInput,
  renderNotes,
  goToNoteInDiary,
  duplicateNote,
  toggleNotePinnedQuick,
  saveNoteAsTemplate,
  openNoteTemplatesModal,
  applyNoteTemplate,
  deleteNoteTemplate,
  filterNotesByTag,
  toggleNoteTagDropdown,
  setWeekMode,
} from './components/notes.js';
import {
  openNewPostitModal,
  editPostitCard,
  movePostitCard,
  deletePostitCard,
  savePostit,
  selectPostitPriority,
  renderPostitBoard,
  addPostitSubtask,
  confirmPostitSubtask,
  cancelPostitInlineInput,
  togglePostitSubtask,
  deletePostitSubtask,
  addPostitChecklistItem,
  confirmPostitChecklist,
  togglePostitChecklist,
  deletePostitChecklist,
  triggerPostitAttachment,
  handlePostitAttachment,
  deletePostitAttachment,
  openPostitAttachmentPreview,
  renderPostitSubtasks,
  renderPostitChecklist,
  renderPostitAttachments,
  setPostitUserFilter,
} from './components/postit.js';
import {
  renderDocs,
  filterDocsBySearch,
  applyDocsFilters,
  openNewDocModal,
  openCreateFolderModal,
  openInsertFileModal,
  updateMarkdownPreview,
  selectDocFolder,
  downloadDocAsMarkdown,
  editDocument,
  downloadFile,
  downloadItem,
  deleteDocElement,
  closeDocView,
  confirmInsertFile,
  clearInsertFile,
  toggleDocFolderCollapse,
  openProjectCommentsModal,
  closeDocModalWithCleanup,
  saveDocOrFolder,
  toggleIconPopover,
  selectIcon,
  setDocsViewMode,
  setDocsSortOrder,
  viewDoc,
  openDocTemplatesModal,
  applyDocTemplate,
  deleteDocTemplate,
  saveDocTemplateFromCurrent,
  openDocVersionsModal,
  restoreDocVersion,
  editDocFolder,
  openEditDocModal,
  deleteDoc,
  openDocCommentsModal,
} from './components/docs.js';
import {
  setProjectUserFilter,
  selectProject,
  renderProjects,
  openNewProjectModal,
  openEditProjectModal,
  deleteProject,
  openAddTaskModal,
  openEditTaskModal,
  saveProject,
  saveTask,
  quickToggleTask,
  deleteTask,
  toggleProjectTreeCollapse,
  setProjectViewMode,
  setTaskSort,
  filterTaskSearch,
  addTaskDep,
  removeTaskDep,
  dragTaskStart,
  dropTaskToColumn,
  openTaskViewer,
  openEditFromViewer,
  openTaskCommentsFromViewer,
  openMyWorkTasksView,
  openSaveProjectTemplateModal,
  confirmSaveProjectTemplate,
  openManageProjectTemplatesModal,
  deleteCustomProjectTemplate,
  openRenameProjectTemplateModal,
  confirmRenameProjectTemplate,
  duplicateCustomProjectTemplate,
  showProjectTreeContextMenu,
  openApplyTemplateToProjectModal,
  confirmApplyTemplateToProject,
  toggleProjectActivityVisibility,
} from './components/projects.js';
import {
  exportNotes,
  exportAllData,
  clearAllData,
  exportProjectAsText,
  openProjectPrintReport,
  triggerImportDiarioBackup,
  generateDepartmentReport,
  openReportModal,
} from './components/export.js';
import {
  openNewChatModal,
  sendChatMessage,
  openChatLinkPicker,
  closeCurrentChatThread,
  selectChatThread,
  closeChatThread,
  filterNewChatUsers,
  buildChatLinkTargetList,
  buildChatTaskOptions,
  confirmChatLinkPick,
  startNewChatWith,
  removeChatPendingLink,
} from './components/chat.js';
import {
  clearShortcutDraft,
  toggleShortcutAddPanel,
  onShortcutIconModeChange,
  pickShortcutEmoji,
  toggleShortcutIconPicker,
  togglePreview,
  onShortcutsScopeChange,
  handleShortcutFileSelected,
  handleShortcutIconUpload,
  addShortcut,
  deleteShortcut,
  openEditShortcutModal,
  saveEditShortcut,
  openShortcutPreview,
} from './components/shortcuts.js';
import {
  closeModal,
  openModal,
  executeConfirm,
  closeConfirmModal,
  showConfirmModal,
  showToast,
} from './components/modalControl.js';
import {
  openDetail,
  selectMentionGroup,
  backToMentionGroups,
  toggleMention,
  openPostitCommentsFromModal,
  openNoteCommentsModal,
  openTaskCommentsModal,
  handleCommentInput,
  submitComment,
  selectMentionAutocomplete,
  toggleMentionPick,
  toggleCommentMentionMenu,
  insertSelectedMentions,
  insertImageIntoCommentTextarea,
  loadMorePublicNotes,
} from './components/comments.js';
import {
  renderWhiteboard, wbSetTool, wbSetShape, wbSetColor, wbSetSize,
  wbToggleFill,
  wbUndo, wbRedo, wbClear, wbExport, wbZoomIn, wbZoomOut, wbResetView,
  wbStickyDragStart, wbDeleteSticky, wbStickyTextChange, wbStickySetColor, wbStickyResizeStart,
  wbCtxFontSizeInput, wbCtxToggleBold, wbCtxToggleItalic, wbCtxToggleUnderline, wbCtxSetColor,
  wbStickySetTextColor, wbStickySetFontSize,
  wbAddPage, wbSwitchPage, wbRenamePage, wbDeletePage, wbMinimapClick,
  wbOpenCardPicker, wbCardPickerTab, wbCardPickerSearch,
  wbAddCardToCanvas, wbOpenCardRef,
  wbToggleLayers, renderLayersPanel, wbLayerSelect,
  wbLayerToggleVisibility, wbLayerMoveUp, wbLayerMoveDown,
  wbLayerDelete, wbLayerDragStart, wbLayerDrop,
  wbToggleShapesMenu, wbPickShape,
  wbShapeMenuPick, wbShapeMenuToggleFill, wbShapeMenuSetColor
} from './components/whiteboard.js';
import {
  openHandoverPanel, closeHandoverPanel, addHandoverItem,
  removeHandoverItem, deliverHandover, checkPendingHandover,
  dismissHandoverBanner, openHandoverReceive, confirmHandoverReceived,
  openHandoverHistory, setupHandoverProjectAutocomplete, selectHandoverSuggestion,
} from './handover.js';

// Exponer navegación principal desde el arranque del módulo
window.showView = showView;
window.renderDateNav = renderDateNav;

// Exponer funciones de tema globalmente de inmediato
import('./components/themes.js').then(m => {
  window.toggleLoginThemePanel = m.toggleLoginThemePanel;
  window.renderLoginThemeButtons = m.renderLoginThemeButtons;
  window.applyStoredTheme = m.applyStoredTheme;
  window.applyUserThemeLogin = m.applyUserThemeLogin;
  m.applyStoredTheme();
  setTimeout(() => m.renderLoginThemeButtons(), 100);
});

function generateColorFromId(id) {
  const colors = ['#7858f6', '#5ba3e8', '#f4a042', '#5aaa7a', '#e05a5a', '#c47b3a', '#8b6fd4', '#14b8a6'];
  const idx = String(id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function logout() {
  appLogout();
}

function logoutMicrosoft() {
  appLogoutMicrosoft();
}

async function bootApp() {
  window.onerror = (msg, src, line, col, err) => {
    console.error('Error global:', msg, 'en', src, 'linea', line);
  };

  try {
    const account = await initMSAL();
    if (!account) return;

    const msUser = await getCurrentUser();
    const headers = await getAuthHeaders();
    const meRes = await fetch('http://localhost:3001/api/users/me', { headers });
    const meData = await meRes.json();

    if (!msUser || !msUser.userId || !msUser.name) {
      throw new Error('No se pudo obtener el perfil del usuario en Microsoft Graph');
    }

    window._msAuthUser = {
      id: msUser.userId,
      name: msUser.name,
      email: msUser.email,
      group: meData.department,
      role: msUser.jobTitle || 'Técnico',
      initials: msUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      color: generateColorFromId(msUser.userId),
    };

    await showUserSelector(meData.department, headers);
    const step2 = document.getElementById('login-step-2');
    if (step2 && !step2.querySelector('.ms-logout-btn')) {
      const msLogoutBtn = document.createElement('div');
      msLogoutBtn.style.cssText = 'text-align:center;margin-top:20px';
      msLogoutBtn.innerHTML = `<button class="ms-logout-btn btn-secondary" 
    onclick="logoutMicrosoft()" 
    style="font-size:11px;opacity:0.6;padding:6px 14px;border-radius:8px">
    🔓 Cerrar sesión de Microsoft
  </button>`;
      step2.appendChild(msLogoutBtn);
    }
  } catch (err) {
    console.error('Error en bootApp:', err);
    document.getElementById('login-screen').innerHTML = `
      <div class="login-box" style="max-width:420px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h2 style="font-family:'Syne',sans-serif;font-size:18px;margin-bottom:8px;color:var(--text)">
          Error al conectar
        </h2>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px;line-height:1.6">
          No se pudo establecer conexion con el servidor.<br>
          Verifica que el servidor esta arrancado e intentalo de nuevo.
        </p>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:20px;font-family:'DM Mono',monospace;font-size:11px;color:var(--danger,#e05a5a);text-align:left">
          ${err.message || 'Error desconocido'}
        </div>
        <button class="btn-primary" onclick="bootApp()" style="width:100%">
          🔄 Reintentar
        </button>
      </div>
    `;
  }
}

async function showUserSelector(department, headers) {
  // Aplicar tema guardado
  if (typeof window.applyStoredTheme === 'function') {
    window.applyStoredTheme();
  } else {
    import('./components/themes.js').then(m => m.applyStoredTheme());
  }

  const res = await fetch('http://localhost:3001/api/users/department', { headers });
  const deptUsers = await res.json();

  const loginScreen = document.getElementById('login-screen');
  loginScreen.innerHTML = `
    <div class="login-theme-selector">
      <button class="theme-toggle-btn" onclick="toggleLoginThemePanel()" title="Cambiar tema">🎨</button>
      <div class="theme-panel-mini hidden" id="login-theme-panel">
        <div class="theme-panel-label">Selecciona tema</div>
        <div class="theme-buttons-row" id="login-theme-buttons"></div>
      </div>
    </div>
    <div class="login-box login-user-selector">
      <div class="login-header">
        <span class="logo-mark">D</span>
        <h1>Diario Departamental</h1>
        <p>${department} · ¿Quién eres?</p>
      </div>
      <div class="user-selector-grid" id="user-selector-grid">
        ${deptUsers.map(u => `
          <button class="user-selector-card" onclick="selectAppUser('${u._id}')">
            <div class="user-selector-avatar" style="background:${u.color}">${u.initials}</div>
            <div class="user-selector-name">${u.name}</div>
            <div class="user-selector-role">${u.role}</div>
            ${u.pin ? '<div class="user-selector-pin-badge">🔒</div>' : ''}
          </button>
        `).join('')}
      </div>
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <button onclick="logoutMicrosoft()"
          style="background:none;border:none;color:var(--text-muted);font-size:11px;cursor:pointer;padding:6px 14px;border-radius:8px">
          🔓 Cerrar sesión de Microsoft
        </button>
      </div>
    </div>
  `;

  window._deptUsers = deptUsers;
  setTimeout(() => {
    if (typeof window.renderLoginThemeButtons === 'function') {
      window.renderLoginThemeButtons();
    }
  }, 50);
}

window.showUserSelectorDirect = function() {
  const department = window._msAuthUser?.group || '';
  const deptUsers = window._deptUsers || [];
  if (!deptUsers.length) { window.bootApp(); return; }
  if (typeof window.applyStoredTheme === 'function') window.applyStoredTheme();
  const loginScreen = document.getElementById('login-screen');
  loginScreen.innerHTML = `
    <div class="login-theme-selector">
      <button class="theme-toggle-btn" onclick="toggleLoginThemePanel()" title="Cambiar tema">🎨</button>
      <div class="theme-panel-mini hidden" id="login-theme-panel">
        <div class="theme-panel-label">Selecciona tema</div>
        <div class="theme-buttons-row" id="login-theme-buttons"></div>
      </div>
    </div>
    <div class="login-box login-user-selector">
      <div class="login-header">
        <span class="logo-mark">D</span>
        <h1>Diario Departamental</h1>
        <p>${department} · ¿Quién eres?</p>
      </div>
      <div class="user-selector-grid" id="user-selector-grid">
        ${deptUsers.map(u => `
          <button class="user-selector-card" onclick="selectAppUser('${u._id}')">
            <div class="user-selector-avatar" style="background:${u.color}">${u.initials}</div>
            <div class="user-selector-name">${u.name}</div>
            <div class="user-selector-role">${u.role}</div>
            ${u.pin ? '<div class="user-selector-pin-badge">🔒</div>' : ''}
          </button>
        `).join('')}
      </div>
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <button onclick="logoutMicrosoft()"
          style="background:none;border:none;color:var(--text-muted);font-size:11px;cursor:pointer;padding:6px 14px;border-radius:8px">
          🔓 Cerrar sesión de Microsoft
        </button>
      </div>
    </div>
  `;
  setTimeout(() => {
    if (typeof window.renderLoginThemeButtons === 'function') window.renderLoginThemeButtons();
  }, 50);
};

window.selectAppUser = async function(userId) {
  const user = window._deptUsers.find(u => u._id === userId);
  if (!user) return;

  if (user.pin) {
    showPinInput(user);
  } else {
    showCreatePin(user);
  }
};

function showCreatePin(user) {
  if (typeof window.applyStoredTheme === 'function') window.applyStoredTheme();
  const loginScreen = document.getElementById('login-screen');
  loginScreen.innerHTML = `
    <div class="login-box pin-screen-box">
      <div class="login-header">
        <div class="pin-user-avatar" style="background:${user.color}">${user.initials}</div>
        <h2 class="pin-user-name">${user.name}</h2>
        <p class="pin-warning">⚠️ No tienes PIN configurado</p>
        <p class="pin-hint">Crea un PIN de 4 dígitos para proteger tu perfil</p>
      </div>

      <div class="pin-section">
        <label class="pin-label">Nuevo PIN</label>
        <div class="pin-boxes" id="pin-new-boxes">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
        </div>
      </div>

      <div class="pin-section">
        <label class="pin-label">Repite el PIN</label>
        <div class="pin-boxes" id="pin-confirm-boxes">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
        </div>
        <p id="pin-create-error" class="pin-box-error hidden">Los PINs no coinciden</p>
      </div>

      <div class="pin-actions">
        <button class="btn-primary pin-btn" onclick="saveNewPinBoxes('${user._id}')">
          Guardar PIN y entrar
        </button>
        <button class="btn-secondary pin-btn" onclick="bootApp()">
          ← Volver
        </button>
      </div>
    </div>
  `;
  setupPinBoxes('pin-new-boxes', 'pin-confirm-boxes');
  setTimeout(() => document.querySelector('#pin-new-boxes .pin-box')?.focus(), 100);
}

function showPinInput(user) {
  if (typeof window.applyStoredTheme === 'function') window.applyStoredTheme();

  const loginScreen = document.getElementById('login-screen');
  loginScreen.innerHTML = `
    <div class="login-box pin-screen-box">
      <div class="login-header">
        <div class="pin-user-avatar" style="background:${user.color}">${user.initials}</div>
        <h2 class="pin-user-name">${user.name}</h2>
        <p class="pin-hint">Introduce tu PIN para entrar</p>
      </div>

      <div class="pin-section">
        <div class="pin-boxes" id="pin-verify-boxes">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
          <input class="pin-box" type="password" maxlength="1" inputmode="numeric" pattern="[0-9]">
        </div>
        <p id="pin-verify-error" class="pin-box-error hidden">PIN incorrecto</p>
      </div>

      <div class="pin-actions">
        <button class="btn-secondary pin-btn" onclick="enterAppWithoutPin('${user._id}')">
          Entrar sin PIN
        </button>
        <button class="btn-secondary pin-btn" onclick="bootApp()">
          ← Volver
        </button>
      </div>
    </div>
  `;
  const uid = user._id;
  setupPinBoxes('pin-verify-boxes', null, () => {
    verifyPinBoxes(uid);
  });
  setTimeout(() => document.querySelector('#pin-verify-boxes .pin-box')?.focus(), 100);
}

function setupPinBoxes(firstGroupId, secondGroupId, onComplete) {
  function setupGroup(groupId, nextGroupId, doneCb) {
    const boxes = document.querySelectorAll('#' + groupId + ' .pin-box');

    function handleInput(e) {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val;
      const i = Array.from(boxes).indexOf(e.target);
      if (val && i < boxes.length - 1) {
        boxes[i + 1].focus();
      } else if (val && i === boxes.length - 1) {
        if (nextGroupId) {
          document.querySelector('#' + nextGroupId + ' .pin-box')?.focus();
        } else if (doneCb) {
          setTimeout(doneCb, 100);
        }
      }
    }

    boxes.forEach((box) => {
      box.addEventListener('input', handleInput);
      box.addEventListener('keydown', (e) => {
        const i = Array.from(boxes).indexOf(e.target);
        if (e.key === 'Backspace' && !box.value && i > 0) {
          boxes[i - 1].focus();
          boxes[i - 1].value = '';
        }
      });
    });
  }

  setupGroup(firstGroupId, secondGroupId, secondGroupId ? null : onComplete);
  if (secondGroupId) setupGroup(secondGroupId, null, onComplete);
}

function getPinFromBoxes(groupId) {
  return [...document.querySelectorAll('#' + groupId + ' .pin-box')]
    .map(b => b.value).join('');
}

window.verifyPinBoxes = function(userId) {
  const user = window._deptUsers.find(u => u._id === userId);
  const input = getPinFromBoxes('pin-verify-boxes');
  if (!user || !input) return;

  if (input === user.pin) {
    enterApp(user);
  } else {
    document.querySelectorAll('#pin-verify-boxes .pin-box').forEach(b => b.value = '');
    document.querySelector('#pin-verify-boxes .pin-box')?.focus();
    const err = document.getElementById('pin-verify-error');
    if (err) {
      err.classList.remove('hidden');
      setTimeout(() => err.classList.add('hidden'), 2000);
    }
  }
};

window.enterAppWithoutPin = function(userId) {
  const user = window._deptUsers.find(u => u._id === userId);
  if (user) enterApp(user);
};

window.saveNewPinBoxes = async function(userId) {
  const user = window._deptUsers.find(u => u._id === userId);
  const pinNew = getPinFromBoxes('pin-new-boxes');
  const pinConfirm = getPinFromBoxes('pin-confirm-boxes');
  const errEl = document.getElementById('pin-create-error');

  if (pinNew.length < 4) {
    if (errEl) {
      errEl.textContent = 'Introduce 4 dígitos';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (pinNew !== pinConfirm) {
    if (errEl) {
      errEl.textContent = 'Los PINs no coinciden';
      errEl.classList.remove('hidden');
    }
    document.querySelectorAll('#pin-confirm-boxes .pin-box').forEach(b => b.value = '');
    document.querySelector('#pin-confirm-boxes .pin-box')?.focus();
    return;
  }

  try {
    const headers = await getAuthHeaders();
    await fetch(`http://localhost:3001/api/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ pin: pinNew }),
    });

    user.pin = pinNew;
    enterApp(user);
  } catch (err) {
    console.error('Error guardando PIN:', err);
  }
};

function enterApp(dbUser) {
  const msAuth = window._msAuthUser;

  const appUser = {
    id: dbUser._id,
    name: dbUser.name,
    initials: dbUser.initials,
    color: dbUser.color,
    role: dbUser.role,
    group: dbUser.department,
    department: dbUser.department,
    email: msAuth?.email || '',
    msId: msAuth?.id || '',
  };
  console.log('enterApp appUser.id:', appUser.id, 'dbUser._id:', dbUser._id);
  const usuario = appUser;
  console.log('setCurrentUser llamado con id:', usuario?.id, 'name:', usuario?.name);
  setCurrentUser(appUser);
  window._msUser = appUser;
  window._currentDbUser = dbUser;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  // Inicializar la app (expone funciones en window)
  initializeApp();

  // Actualizar header con datos del usuario
  const avatarEl = document.getElementById('sidebar-avatar');
  const nameEl = document.getElementById('sidebar-name');
  const shiftEl = document.getElementById('sidebar-shift');
  const brandEl = document.getElementById('brand-group-badge');

  if (avatarEl) {
    avatarEl.style.background = appUser.color;
    avatarEl.style.backgroundImage = '';
    avatarEl.textContent = appUser.initials;
  }
  if (nameEl) nameEl.textContent = appUser.name;
  if (shiftEl) shiftEl.textContent = appUser.group + ' · ' + (appUser.role || 'Técnico');
  if (brandEl) brandEl.textContent = appUser.group;

  initApp(appUser);
}

window.openChangePinModal = function() {
  const user = window._currentDbUser;
  if (!user) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'change-pin-modal';
  modal.innerHTML = `
    <div class="modal-overlay open" style="background:rgba(0,0,0,0.6);backdrop-filter:blur(8px)">
      <div class="modal tema-aware" style="max-width:340px">
        <div class="modal-header">
          <h3>🔒 Cambiar PIN</h3>
          <button class="modal-close" onclick="document.getElementById('change-pin-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="pin-section">
            <label class="pin-label">PIN actual</label>
            <div class="pin-boxes" id="pin-current-boxes">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
            </div>
          </div>
          <div class="pin-section" style="margin-top:16px">
            <label class="pin-label">Nuevo PIN</label>
            <div class="pin-boxes" id="pin-change-new-boxes">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
            </div>
          </div>
          <div class="pin-section" style="margin-top:16px">
            <label class="pin-label">Repite el nuevo PIN</label>
            <div class="pin-boxes" id="pin-change-confirm-boxes">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
              <input class="pin-box" type="password" maxlength="1" inputmode="numeric">
            </div>
          </div>
          <p id="change-pin-error" class="pin-box-error hidden"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('change-pin-modal').remove()">Cancelar</button>
          <button class="btn-primary" onclick="submitChangePin()">Guardar PIN</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setupPinBoxes('pin-current-boxes', 'pin-change-new-boxes');
  setupPinBoxes('pin-change-new-boxes', 'pin-change-confirm-boxes');
  setupPinBoxes('pin-change-confirm-boxes', null, null);
  setTimeout(() => document.querySelector('#pin-current-boxes .pin-box')?.focus(), 100);
};

window.submitChangePin = async function() {
  const user = window._currentDbUser;
  if (!user) return;

  const current = getPinFromBoxes('pin-current-boxes');
  const newPin = getPinFromBoxes('pin-change-new-boxes');
  const confirm = getPinFromBoxes('pin-change-confirm-boxes');
  const errEl = document.getElementById('change-pin-error');

  if (user.pin && current !== user.pin) {
    errEl.textContent = 'PIN actual incorrecto'; errEl.classList.remove('hidden'); return;
  }
  if (newPin.length < 4) {
    errEl.textContent = 'El nuevo PIN debe tener 4 dígitos'; errEl.classList.remove('hidden'); return;
  }
  if (newPin !== confirm) {
    errEl.textContent = 'Los PINs no coinciden'; errEl.classList.remove('hidden'); return;
  }

  try {
    const headers = await getAuthHeaders();
    await fetch(`http://localhost:3001/api/users/${user._id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ pin: newPin }),
    });
    user.pin = newPin;
    if (window._deptUsers) {
      const u = window._deptUsers.find((deptUser) => deptUser._id === user._id);
      if (u) u.pin = newPin;
    }
    document.getElementById('change-pin-modal').remove();
    if (typeof showToast === 'function') showToast('PIN actualizado correctamente', 'success');
  } catch (err) {
    errEl.textContent = 'Error al guardar PIN'; errEl.classList.remove('hidden');
  }
};

function retryLogin() {
  document.getElementById('login-error')?.classList.add('hidden');
  document.getElementById('login-loading')?.classList.remove('hidden');
  bootApp();
}

async function checkApiStatus() {
  const indicator = document.getElementById('api-status-indicator');
  if (!indicator) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('http://localhost:3001/api/users/me', { headers });
    if (res.ok) {
      indicator.className = 'api-status online';
      indicator.title = 'Servidor conectado';
    } else {
      indicator.className = 'api-status offline';
      indicator.title = 'Error de servidor';
    }
  } catch {
    indicator.className = 'api-status offline';
    indicator.title = 'Servidor desconectado';
  }
}

async function initApp(appUser) {
  const usuario = appUser;
  console.log('setCurrentUser llamado con id:', usuario?.id, 'name:', usuario?.name);
  setCurrentUser(appUser);
  console.log('currentUser después de set:', currentUser?.id, currentUser?.name);

  // Cargar datos en paralelo
  await Promise.all([
    import('./components/notes.js').then(m => m.loadNotesFromAPI()),
    import('./components/projects.js').then(m => m.loadProjectsFromAPI()),
    import('./components/postit.js').then(m => m.loadPostitFromAPI()),
    import('./components/docs.js').then(m => m.loadDocsFromAPI()),
    import('./components/comments.js').then(m => m.loadCommentsFromAPI()),
    import('./components/views.js').then(m => m.refreshPendingInvitesFromAPI?.()),
    import('./handover.js').then(m => m.loadHandoversFromAPI()),
    fetch('http://localhost:3001/api/users/department', {
      headers: await getAuthHeaders(),
    }).then(r => r.json()).then(deptUsers => {
      setUSERS(deptUsers.map(u => ({
        id: u._id, name: u.name, initials: u.initials,
        color: u.color, role: u.role, group: u.department,
      })));
    }).catch(err => console.error('Error cargando usuarios:', err)),
  ]);

  import('./components/login.js').then(m => m.updateWorkGroupInviteNavBadge());

  // Quitar overlay de carga
  const overlay = document.getElementById('app-loading-overlay');
  if (overlay) overlay.remove();

  // Esperar a que window.showView esté disponible
  // (se define en el Object.assign posterior)
  setTimeout(() => {
    if (typeof window.showView === 'function') {
      window.showView('notes', document.getElementById('nav-all'));
    }
    if (typeof window.renderDateNav === 'function') {
      window.renderDateNav();
    }
    if (typeof window.updateBadges === 'function') {
      window.updateBadges();
    }
  }, 500);
  setTimeout(() => checkApiStatus(), 2000);
  setInterval(() => checkApiStatus(), 30000);
}

function selectUser(id) {
  loginSelectUser(id);
  checkPendingHandover();
}

function loadData() {
  try {
    const saved = localStorage.getItem('diario_notes');
    const list = saved ? JSON.parse(saved) : [];
    setNotes(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error('Error loading notes:', e);
  }

  try {
    const savedProjects = localStorage.getItem('diario_projects');
    const list = savedProjects ? JSON.parse(savedProjects) : [];
    setProjects(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error('Error loading projects:', e);
  }

  try {
    const savedDocs = localStorage.getItem('diario_docs');
    const list = savedDocs ? JSON.parse(savedDocs) : [];
    setDocs(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error('Error loading docs:', e);
  }

  // IMPORTANTE:
  // No cargar usuarios desde localStorage para evitar pisar los usuarios
  // del backend (MongoDB) y mostrar autores incorrectos en notas.

  // Cargar grupos de trabajo
  try {
    const rawWg = localStorage.getItem('diario_workgroups');
    setWorkGroups(rawWg ? JSON.parse(rawWg) : []);
  } catch {
    setWorkGroups([]);
  }

  // Cargar invitaciones
  try {
    const rawWgi = localStorage.getItem('diario_wginvites');
    setWgInvites(rawWgi ? JSON.parse(rawWgi) : []);
  } catch {
    setWgInvites([]);
  }

  try {
    const rawComments = localStorage.getItem('diario_comments');
    const cList = rawComments ? JSON.parse(rawComments) : [];
    setComments(Array.isArray(cList) ? cList : []);
  } catch {
    setComments([]);
  }
}

function applyTheme() {
  applyStoredTheme();
  loadCustomThemeIfSaved();
  renderLoginThemeButtons();
}

function setupEventListeners() {
  document.addEventListener('keydown', () => {});
}

async function initializeApp() {
  try {
    if (!window._editingWorkGroupImages) window._editingWorkGroupImages = {};
    Object.defineProperty(window, 'editingWorkGroupImages', {
      configurable: true,
      get: () => window._editingWorkGroupImages,
      set: (val) => { window._editingWorkGroupImages = val || {}; },
    });
    Object.defineProperty(window, 'editingNoteImages', {
      configurable: true,
      get: () => editingNoteImages,
      set: (val) => setEditingNoteImages(val || {}),
    });
    Object.defineProperty(window, 'editingPostitImages', {
      configurable: true,
      get: () => editingPostitImages,
      set: (val) => setEditingPostitImages(val || {}),
    });
    Object.defineProperty(window, 'editingDocImages', {
      configurable: true,
      get: () => editingDocImages,
      set: (val) => setEditingDocImages(val || {}),
    });
    Object.defineProperty(window, 'editingProjectImages', {
      configurable: true,
      get: () => editingProjectImages,
      set: (val) => setEditingProjectImages(val || {}),
    });
    Object.defineProperty(window, 'editingTaskImages', {
      configurable: true,
      get: () => editingTaskImages,
      set: (val) => setEditingTaskImages(val || {}),
    });

    // Primero: exponer handlers globales (onclick en HTML) antes de loadData/tema por si algo falla o el usuario interactúa enseguida.
    Object.assign(window, {
      showView,
      renderDateNav,
      navigateWeek,
      toggleShiftFilter,
      handleSearch,
      onNotesSearchHistoryChange,
      setNoteView,
      setNoteViewCalendar,
      markAllNoteMentionsAsRead,
      goToNoteInDiary,
      duplicateNote,
      toggleNotePinnedQuick,
      saveNoteAsTemplate,
      openNoteTemplatesModal,
      applyNoteTemplate,
      deleteNoteTemplate,
      selectGroup,
      submitPassword,
      togglePwdVisibility,
      cancelPasswordModal,
      openPasswordModal,
      proceedAfterPassword,
      backToGroups,
      selectUser,
      logout,
      logoutMicrosoft,
      addUser,
      removeUser,
      saveUsers,
      verifyGroupPassword,
      toggleLoginThemePanel,
      resetUserTheme,
      toggleCustomThemePanel,
      previewCustomTheme,
      saveCustomTheme,
      deleteCustomTheme,
      applyUserTheme,
      applyUserThemeLogin,
      saveCfg,
      applyAccentColor,
      applyAccent2Color,
      renderThemeGrid,
      exportNotes,
      exportAllData,
      triggerImportDiarioBackup,
      generateDepartmentReport,
      openReportModal,
      clearAllData,
      exportProjectAsText,
      openProjectPrintReport,
      openNewNoteModal,
      editNote,
      saveNote,
      deleteNote,
      toggleShiftSection,
      openImageModal,
      executeSlashCommand,
      updateMarkdownPreview,
      insertImage,
      insertImagePostit,
      insertImageDoc,
      insertImageProject,
      insertImageTask,
      renderNotes,
      makeImageKey,
      registerTempImage,
      collectImageMap,
      openNewPostitModal,
      editPostitCard,
      movePostitCard,
      deletePostitCard,
      savePostit,
      selectPostitPriority,
      renderPostitBoard,
      addPostitSubtask,
      confirmPostitSubtask,
      cancelPostitInlineInput,
      togglePostitSubtask,
      deletePostitSubtask,
      addPostitChecklistItem,
      confirmPostitChecklist,
      togglePostitChecklist,
      deletePostitChecklist,
      triggerPostitAttachment,
      handlePostitAttachment,
      deletePostitAttachment,
      openPostitAttachmentPreview,
      renderPostitSubtasks,
      renderPostitChecklist,
      renderPostitAttachments,
      createWorkGroup,
      openWorkGroupInvitesModal,
      onWorkGroupCardClick,
      openEditWorkGroupModal,
      deleteWorkGroup,
      saveWorkGroupEdit,
      acceptWgInvite,
      declineWgInvite,
      removeWgMember,
      saveNewWorkGroup,
      onWgEditInviteSearchInput,
      selectWgInviteSuggestion,
      sendWgInviteFromEditModal,
      renderDocs,
      filterDocsBySearch,
      applyDocsFilters,
      openNewDocModal,
      openCreateFolderModal,
      openInsertFileModal,
      togglePreview,
      selectDocFolder,
      downloadDocAsMarkdown,
      editDocument,
      downloadFile,
      downloadItem,
      deleteDocElement,
      closeDocView,
      confirmInsertFile,
      clearInsertFile,
      toggleDocFolderCollapse,
      setProjectUserFilter,
      selectProject,
      renderProjects,
      openNewProjectModal,
      openEditProjectModal,
      deleteProject,
      openAddTaskModal,
      openEditTaskModal,
      saveProject,
      saveTask,
      quickToggleTask,
      deleteTask,
      openProjectCommentsModal,
      toggleProjectTreeCollapse,
      setProjectViewMode,
      setTaskSort,
      filterTaskSearch,
      addTaskDep,
      removeTaskDep,
      dragTaskStart,
      dropTaskToColumn,
      openTaskViewer,
      openEditFromViewer,
      openTaskCommentsFromViewer,
      openMyWorkTasksView,
      openSaveProjectTemplateModal,
      confirmSaveProjectTemplate,
      openManageProjectTemplatesModal,
      deleteCustomProjectTemplate,
      openRenameProjectTemplateModal,
      confirmRenameProjectTemplate,
      duplicateCustomProjectTemplate,
      showProjectTreeContextMenu,
      openApplyTemplateToProjectModal,
      confirmApplyTemplateToProject,
      toggleProjectActivityVisibility,
      openNewChatModal,
      sendChatMessage,
      openChatLinkPicker,
      closeCurrentChatThread,
      selectChatThread,
      closeChatThread,
      filterNewChatUsers,
      buildChatLinkTargetList,
      buildChatTaskOptions,
      confirmChatLinkPick,
      startNewChatWith,
      removeChatPendingLink,
      clearShortcutDraft,
      toggleShortcutAddPanel,
      onShortcutIconModeChange,
      pickShortcutEmoji,
      toggleShortcutIconPicker,
      onShortcutsScopeChange,
      handleShortcutFileSelected,
      handleShortcutIconUpload,
      addShortcut,
      deleteShortcut,
      openEditShortcutModal,
      saveEditShortcut,
      openShortcutPreview,
      closeModal,
      openModal,
      executeConfirm,
      closeConfirmModal,
      showConfirmModal,
      openDetail,
      selectMentionGroup,
      backToMentionGroups,
      toggleMention,
      openPostitCommentsFromModal,
      openNoteCommentsModal,
      openTaskCommentsModal,
      handleCommentInput,
      submitComment,
      selectMentionAutocomplete,
      toggleMentionPick,
      toggleCommentMentionMenu,
      insertSelectedMentions,
      insertImageIntoCommentTextarea,
      loadMorePublicNotes,
      renderWhiteboard, wbSetTool, wbSetShape, wbSetColor, wbSetSize,
      wbToggleFill,
      wbUndo, wbRedo, wbClear, wbExport, wbZoomIn, wbZoomOut, wbResetView,
      wbStickyDragStart, wbDeleteSticky, wbStickyTextChange, wbStickySetColor, wbStickyResizeStart,
      wbCtxFontSizeInput, wbCtxToggleBold, wbCtxToggleItalic, wbCtxToggleUnderline, wbCtxSetColor,
      wbStickySetTextColor, wbStickySetFontSize,
      wbAddPage, wbSwitchPage, wbRenamePage, wbDeletePage,
      wbMinimapClick,
      wbOpenCardPicker, wbCardPickerTab, wbCardPickerSearch,
      wbAddCardToCanvas, wbOpenCardRef,
      wbToggleLayers, renderLayersPanel, wbLayerSelect,
      wbLayerToggleVisibility, wbLayerMoveUp, wbLayerMoveDown,
      wbLayerDelete, wbLayerDragStart, wbLayerDrop,
      wbToggleShapesMenu, wbPickShape,
      wbShapeMenuPick, wbShapeMenuToggleFill, wbShapeMenuSetColor,
      openAddUserModal,
      openEditUserModal,
      saveEditUserModal,
      clearGroupFilter,
      openGroupMembers,
      openEditGroupModal,
      openNewGroupModal,
      saveGroup,
      deleteEditingGroup,
      saveDocOrFolder,
      closeDocModalWithCleanup,
      toggleIconPopover,
      selectIcon,
      setDocsViewMode,
      setDocsSortOrder,
      viewDoc,
      openDocTemplatesModal,
      applyDocTemplate,
      deleteDocTemplate,
      saveDocTemplateFromCurrent,
      openDocVersionsModal,
      restoreDocVersion,
      selectShiftOpt,
      selectPriority,
      selectVisibility,
      toggleReminder,
      toggleNotePinnedModal,
      handleNoteEditorInput,
      filterNotesByTag,
      toggleNoteTagDropdown,
      setWeekMode,
    });

    window.toggleLoginThemePanel = toggleLoginThemePanel;
    window.renderLoginThemeButtons = renderLoginThemeButtons;

    window.editDocFolder = editDocFolder;
    window.editDocument = editDocument;
    window.openEditDocModal = openEditDocModal;
    window.selectDocFolder = selectDocFolder;
    window.viewDoc = viewDoc;
    window.deleteDocElement = deleteDocElement;
    window.deleteDoc = deleteDoc;
    window.downloadFile = downloadFile;
    window.downloadItem = downloadItem;
    window.downloadDocAsMarkdown = downloadDocAsMarkdown;
    window.openDocCommentsModal = openDocCommentsModal;
    window.setDocsViewMode = setDocsViewMode;
    window.setDocsSortOrder = setDocsSortOrder;
    window.openDocTemplatesModal = openDocTemplatesModal;
    window.applyDocTemplate = applyDocTemplate;
    window.deleteDocTemplate = deleteDocTemplate;
    window.saveDocTemplateFromCurrent = saveDocTemplateFromCurrent;
    window.openDocVersionsModal = openDocVersionsModal;
    window.restoreDocVersion = restoreDocVersion;
    window.setPostitUserFilter = setPostitUserFilter;

    window.openHandoverPanel = openHandoverPanel;
    window.closeHandoverPanel = closeHandoverPanel;
    window.addHandoverItem = addHandoverItem;
    window.removeHandoverItem = removeHandoverItem;
    window.deliverHandover = deliverHandover;
    window.checkPendingHandover = checkPendingHandover;
    window.dismissHandoverBanner = dismissHandoverBanner;
    window.openHandoverReceive = openHandoverReceive;
    window.confirmHandoverReceived = confirmHandoverReceived;
    window.openHandoverHistory = openHandoverHistory;
    window.setupHandoverProjectAutocomplete = setupHandoverProjectAutocomplete;
    window.selectHandoverSuggestion = selectHandoverSuggestion;

    loadData();
    applyTheme();
    setupEventListeners();
    checkPendingHandover();

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

document.addEventListener('DOMContentLoaded', bootApp);

window.retryLogin = retryLogin;
window.bootApp = bootApp;

export { initializeApp };
