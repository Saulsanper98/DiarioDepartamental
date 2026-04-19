// ===== DATA CONSTANTS =====

// Default users data (loaded from localStorage if available)
export let USERS = JSON.parse(localStorage.getItem('diario_users') || 'null') || [
  {id:1,name:'Saul',initials:'SL',color:'#e8c547',role:'Técnico',group:'Sistemas'},
  {id:2,name:'Daniel Clemente',initials:'DC',color:'#5ba3e8',role:'Técnico',group:'Sistemas'},
  {id:3,name:'Daniel Mendoza',initials:'DM',color:'#8b6fd4',role:'Técnico',group:'Redes'},
  {id:4,name:'Alberto',initials:'AB',color:'#5aaa7a',role:'Técnico',group:'Sistemas'},
  {id:5,name:'Sergio',initials:'SR',color:'#e05a5a',role:'Técnico',group:'Tecnicos de sala'},
  {id:6,name:'Adrian',initials:'AD',color:'#c47b3a',role:'Técnico',group:'Operadores'},
];

// Shift definitions
export const SHIFTS = {
  morning:  {label:'Mañana',hours:'06:00–14:00',color:'#f4a042',emoji:'🌅',dot:'#f4a042'},
  afternoon:{label:'Tarde',hours:'14:00–22:00',color:'#5ba3e8',emoji:'🌤',dot:'#5ba3e8'},
  night:    {label:'Noche',hours:'22:00–06:00',color:'#8b6fd4',emoji:'🌙',dot:'#8b6fd4'},
};

// Available groups
export const GROUPS = ['Sistemas','Redes','Tecnicos de sala','Operadores'];

/** Los cuatro departamentos principales: la visibilidad en «Notas Públicas» nunca es automática por pertenencia; debe figurar en comparticiones explícitas. */
export const CORE_DEPARTMENT_GROUPS = ['Sistemas','Redes','Operadores','Tecnicos de sala'];

// Initial limit for public notes per group
export const PUBLIC_NOTES_PER_GROUP_INITIAL = 5;

// Group passwords (hashed for security)
export const GROUP_PASSWORDS = {
  Sistemas: 'Autgc',
  Redes: 'Redesgc',
  'Tecnicos de sala': 'Tecsala',
};

// Image temporary store
export const IMAGE_TEMP_STORE = {};

// ===== GLOBAL STATE VARIABLES =====
export let currentUser = null;
export let currentGroup = null;
export let notes = [];
export let postitCards = [];
export let projects = [];
export let docs = [];
export let workGroups = [];
export let wgInvites = [];
export let groupViewFilter = null;
export let currentView = 'notes';
export let currentNoteView = 'all';
export let currentDate = toDateStr(new Date());
export let weekOffset = 0;
export let activeShiftFilters = ['morning','afternoon','night'];
export let searchQuery = '';
/** Con texto de búsqueda, incluir todas las fechas (no solo el día del calendario). */
export let searchNotesAllDates = false;
export let activeNoteTagFilter = null;
/** Filtro rápido «solo notas de este autor» en la vista lista del día. */
export let notesAuthorFilterId = null;
/** Orden de notas dentro de cada turno: 'recent' | 'oldest'. */
export let notesListSort = 'recent';
try {
  const _nss = sessionStorage.getItem('diario_notes_list_sort');
  if (_nss === 'oldest' || _nss === 'recent') notesListSort = _nss;
} catch {
  /* ignore */
}
export let editingNoteId = null;
export let editingPostitId = null;
export let reminderOn = false;
export let selectedShift = null;
export let selectedPriority = 'normal';
export let selectedNoteVisibility = 'department';
export let selectedMentions = [];
export let selectedMentionGroup = null;
export let editingNoteImages = {};
export let editingPostitImages = {};
export let editingDocImages = {};
export let slashMenuActive = false;
export let projectUserFilter = null;
export let editingProjectId = null;
export let editingTaskId = null;
export let editingProjectImages = {};
export let editingTaskImages = {};
export let comments = [];
export let editingUserId = null;
export let shortcuts = [];
export let shortcutsScope = 'group'; // 'group' | 'me'
export let slashMenuCurrentTextArea = null;
export let slashMenuCurrentImageMap = null;
export let slashMenuCurrentPreview = null;
export let slashImageTarget = null;
export let selectedPostitPriority = 'normal';
export let currentProjectId = null;

// ===== SETTER FUNCTIONS =====
export function setCurrentUser(val) { currentUser = val; }
export function setCurrentGroup(val) { currentGroup = val; }
export function setNotes(val) { notes = val; }
export function setProjects(arr) {
  projects.length = 0;
  arr.forEach(p => projects.push(p));
}
export function setDocs(arr) {
  docs.length = 0;
  arr.forEach(d => docs.push(d));
}
export function setCurrentView(val) { currentView = val; }
export function setCurrentNoteView(val) { currentNoteView = val; }
export function setCurrentDate(val) { currentDate = val; }
export function setUSERS(val) { USERS = val; }
export function setWeekOffset(val) { weekOffset = val; }
export function setActiveShiftFilters(val) { activeShiftFilters = val; }
export function setSearchQuery(val) { searchQuery = val; }
export function setSearchNotesAllDates(val) { searchNotesAllDates = !!val; }
export function setActiveNoteTagFilter(val) { activeNoteTagFilter = val; }
export function setNotesAuthorFilterId(val) {
  notesAuthorFilterId = val == null || val === '' ? null : val;
}
export function setNotesListSort(val) {
  notesListSort = val === 'oldest' ? 'oldest' : 'recent';
  try {
    sessionStorage.setItem('diario_notes_list_sort', notesListSort);
  } catch {
    /* ignore */
  }
}
export function setEditingNoteId(val) { editingNoteId = val; }
export function setEditingPostitId(val) { editingPostitId = val; }
export function setReminderOn(val) { reminderOn = val; }
export function setSelectedShift(val) { selectedShift = val; }
export function setSelectedPriority(val) { selectedPriority = val; }
export function setSelectedNoteVisibility(val) { selectedNoteVisibility = val; }
export function setSelectedMentions(val) { selectedMentions = val; }
export function setSelectedMentionGroup(val) { selectedMentionGroup = val; }
export function setEditingNoteImages(val) { editingNoteImages = val; }
export function setEditingPostitImages(val) { editingPostitImages = val; }
export function setEditingDocImages(val) { editingDocImages = val; }
export function setEditingProjectImages(val) { editingProjectImages = val; }
export function setEditingTaskImages(val) { editingTaskImages = val; }
export function setComments(arr) {
  comments.length = 0;
  arr.forEach(c => comments.push(c));
}
export function setEditingUserId(val) { editingUserId = val; }
export function setShortcuts(val) { shortcuts = val; }
export function setShortcutsScope(val) { shortcutsScope = val; }
export function setSlashMenuCurrentTextArea(val) { slashMenuCurrentTextArea = val; }
export function setSlashMenuCurrentImageMap(val) { slashMenuCurrentImageMap = val; }
export function setSlashMenuCurrentPreview(val) { slashMenuCurrentPreview = val; }
export function setSlashImageTarget(val) { slashImageTarget = val; }
export function setSelectedPostitPriority(val) { selectedPostitPriority = val; }
export function setCurrentProjectId(val) { currentProjectId = val; }
export function setSlashMenuActive(val) { slashMenuActive = val; }
export function setProjectUserFilter(val) { projectUserFilter = val; }
export function setEditingProjectId(val) { editingProjectId = val; }
export function setEditingTaskId(val) { editingTaskId = val; }
export function setGroupViewFilter(val) { groupViewFilter = val; }
export function setWgInvites(val) { wgInvites = val; }
export function setWorkGroups(val) { workGroups = val; }
export function setPostitCards(val) { postitCards = val; }

// ===== UTILITY FUNCTIONS =====
export function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

export function sameId(a, b) {
  // Normalizar valores "vacios" como equivalentes
  const isEmpty = v => v === null || v === undefined || v === '' || v === 'null';
  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) || isEmpty(b)) return false;
  return String(a) === String(b);
}

// ===== IMAGE FUNCTIONS =====
export function registerTempImage(key, dataUrl) {
  IMAGE_TEMP_STORE[key] = dataUrl;
}

export function makeImageKey() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function collectImageMap(body, existingImages = {}) {
  const images = {...existingImages};
  body.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (_, src) => {
    if (IMAGE_TEMP_STORE[src]) images[src] = IMAGE_TEMP_STORE[src];
    else if (existingImages[src]) images[src] = existingImages[src];
    return _;
  });
  return images;
}