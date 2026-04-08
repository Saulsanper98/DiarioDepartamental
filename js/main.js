// ===== MAIN APPLICATION MODULE =====

import { setNotes, setProjects, setDocs, setUSERS, setWorkGroups, setWgInvites, wgInvites, makeImageKey, registerTempImage, collectImageMap, editingNoteImages, setEditingNoteImages, editingPostitImages, setEditingPostitImages, editingDocImages, setEditingDocImages, editingProjectImages, setEditingProjectImages, editingTaskImages, setEditingTaskImages } from './components/data.js';
import {
  showView,
  renderDateNav,
  navigateWeek,
  toggleShiftFilter,
  handleSearch,
  setNoteView,
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
  selectUser,
  logout,
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
  handleNoteEditorInput,
  renderNotes,
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
} from './components/projects.js';
import { exportNotes, exportAllData, clearAllData } from './components/export.js';
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
} from './components/comments.js';
import {
  renderWhiteboard, wbSetTool, wbSetShape, wbSetColor, wbSetSize,
  wbToggleFill,
  wbUndo, wbRedo, wbClear, wbExport, wbZoomIn, wbZoomOut, wbResetView,
  wbStickyDragStart, wbDeleteSticky, wbStickyTextChange, wbStickySetColor, wbStickyResizeStart,
  wbCtxFontSize, wbCtxToggleBold, wbCtxToggleItalic, wbCtxSetColor,
  wbCtxToggleSizeMenu, wbCtxToggleColorMenu,
  wbStickySetTextColor, wbStickySetFontSize,
  wbAddPage, wbSwitchPage, wbRenamePage, wbDeletePage, wbMinimapClick,
  wbOpenCardPicker, wbCardPickerTab, wbCardPickerSearch,
  wbAddCardToCanvas, wbOpenCardRef,
  wbToggleLayers, renderLayersPanel, wbLayerSelect,
  wbLayerToggleVisibility, wbLayerMoveUp, wbLayerMoveDown,
  wbLayerDelete, wbLayerDragStart, wbLayerDrop,
  wbToggleShapesMenu, wbPickShape
} from './components/whiteboard.js';

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

  try {
    const savedUsers = localStorage.getItem('diario_users');
    if (savedUsers) {
      const users = JSON.parse(savedUsers);
      if (Array.isArray(users) && users.length) setUSERS(users);
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }

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
      setNoteView,
      selectGroup,
      submitPassword,
      togglePwdVisibility,
      cancelPasswordModal,
      openPasswordModal,
      proceedAfterPassword,
      backToGroups,
      selectUser,
      logout,
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
      clearAllData,
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
      renderWhiteboard, wbSetTool, wbSetShape, wbSetColor, wbSetSize,
      wbToggleFill,
      wbUndo, wbRedo, wbClear, wbExport, wbZoomIn, wbZoomOut, wbResetView,
      wbStickyDragStart, wbDeleteSticky, wbStickyTextChange, wbStickySetColor, wbStickyResizeStart,
      wbCtxFontSize, wbCtxToggleBold, wbCtxToggleItalic, wbCtxSetColor,
      wbCtxToggleSizeMenu, wbCtxToggleColorMenu,
      wbStickySetTextColor, wbStickySetFontSize,
      wbAddPage, wbSwitchPage, wbRenamePage, wbDeletePage,
      wbMinimapClick,
      wbOpenCardPicker, wbCardPickerTab, wbCardPickerSearch,
      wbAddCardToCanvas, wbOpenCardRef,
      wbToggleLayers, renderLayersPanel, wbLayerSelect,
      wbLayerToggleVisibility, wbLayerMoveUp, wbLayerMoveDown,
      wbLayerDelete, wbLayerDragStart, wbLayerDrop,
      wbToggleShapesMenu, wbPickShape,
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
      selectShiftOpt,
      selectPriority,
      selectVisibility,
      toggleReminder,
      handleNoteEditorInput,
    });

    loadData();
    applyTheme();
    setupEventListeners();

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);

export { initializeApp };
