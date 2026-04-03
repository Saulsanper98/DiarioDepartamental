// ===== THEMES MODULE =====

// Import required dependencies
import { currentUser } from './data.js';
import { showToast } from './modalControl.js';

// ===== THEME DEFINITIONS =====

export const USER_THEMES = [
  {
    id: 'default', name: 'Oscuro', emoji: '🌑',
    vars: {
      '--bg':'#0f0e0c','--surface':'#1a1917','--surface2':'#232220','--surface3':'#2d2b28',
      '--border':'#3a3834','--text':'#f0ebe3','--text-dim':'#8a8378','--text-muted':'#5a5650',
      '--accent':'#e8c547','--accent2':'#c47b3a',
    }
  },
  {
    id: 'slate', name: 'Pizarra', emoji: '🌊',
    vars: {
      '--bg':'#0d1117','--surface':'#161b22','--surface2':'#21262d','--surface3':'#30363d',
      '--border':'#3d444d','--text':'#e6edf3','--text-dim':'#8d96a0','--text-muted':'#656d76',
      '--accent':'#58a6ff','--accent2':'#3fb950',
    }
  },
  {
    id: 'forest', name: 'Bosque', emoji: '🌲',
    vars: {
      '--bg':'#0d1208','--surface':'#131a0e','--surface2':'#1c2614','--surface3':'#253020',
      '--border':'#3a4a2e','--text':'#e8f0e0','--text-dim':'#8aaa78','--text-muted':'#5a7048',
      '--accent':'#7ed44c','--accent2':'#d4a017',
    }
  },
  {
    id: 'dusk', name: 'Crepúsculo', emoji: '🌅',
    vars: {
      '--bg':'#160e0e','--surface':'#1e1414','--surface2':'#281c1c','--surface3':'#342626',
      '--border':'#4a3030','--text':'#f0e8e8','--text-dim':'#a08080','--text-muted':'#6a5050',
      '--accent':'#e87a5a','--accent2':'#e8c547',
    }
  },
  {
    id: 'violet', name: 'Violeta', emoji: '🔮',
    vars: {
      '--bg':'#100d18','--surface':'#171220','--surface2':'#20182e','--surface3':'#2c2040',
      '--border':'#3d3060','--text':'#ede8f8','--text-dim':'#9080c0','--text-muted':'#6050a0',
      '--accent':'#b48aff','--accent2':'#e87aaa',
    }
  },
  {
    id: 'steel', name: 'Acero', emoji: '⚙️',
    vars: {
      '--bg':'#0e1014','--surface':'#141820','--surface2':'#1c222c','--surface3':'#252d3a',
      '--border':'#3a4452','--text':'#d0dce8','--text-dim':'#7090a8','--text-muted':'#506070',
      '--accent':'#5ab4d8','--accent2':'#e87a50',
    }
  },
  {
    id: 'aurora',
    name: 'Aurora',
    emoji: '🌌',
    vars: {
      '--bg': '#0d1117',
      '--surface': 'rgba(255,255,255,0.06)',
      '--surface2': 'rgba(255,255,255,0.04)',
      '--surface3': 'rgba(255,255,255,0.02)',
      '--border': 'rgba(255,255,255,0.1)',
      '--text': 'rgba(255,255,255,0.9)',
      '--text-dim': 'rgba(255,255,255,0.6)',
      '--text-muted': 'rgba(255,255,255,0.35)',
      '--accent': '#7864ff',
      '--accent2': '#4de8a0',
    },
  },
  {
    id: 'claro', name: 'Claro', emoji: '☀️',
    vars: {
      '--bg':'#ffffff','--surface':'#ffffff','--surface2':'#f5f5f4','--surface3':'#e5e5e0',
      '--border':'#e2e8f0','--text':'#111827','--text-dim':'#4b5563','--text-muted':'#9ca3af',
      '--accent':'#2563eb','--accent2':'#f97316',
    }
  },
  {
    id: 'sakura', name: 'Sakura', emoji: '🌸',
    vars: {
      '--bg':'#16100e','--surface':'#201618','--surface2':'#2c1e22','--surface3':'#38282e',
      '--border':'#54383e','--text':'#f8e8ea','--text-dim':'#c08090','--text-muted':'#806070',
      '--accent':'#f088a8','--accent2':'#f8d050',
    }
  },
  {
    id: 'papel', name: 'Papel', emoji: '📄',
    vars: {
      '--bg':'#fafaf7','--surface':'#ffffff','--surface2':'#f2f0ec','--surface3':'#e8e5df',
      '--border':'#ccc9c2','--text':'#1c1a16','--text-dim':'#4a4840','--text-muted':'#9a9890',
      '--accent':'#2563eb','--accent2':'#16a34a',
    }
  },
  {
    id: 'menta', name: 'Menta', emoji: '🍃',
    vars: {
      '--bg':'#f0faf4','--surface':'#ffffff','--surface2':'#e6f5ec','--surface3':'#d4ede0',
      '--border':'#b2d8c0','--text':'#0d2b1e','--text-dim':'#3a6a4e','--text-muted':'#7aaa90',
      '--accent':'#059669','--accent2':'#0284c7',
    }
  },
  {
    id: 'cielo', name: 'Cielo', emoji: '☁️',
    vars: {
      '--bg':'#f0f8ff','--surface':'#ffffff','--surface2':'#e2f0fb','--surface3':'#cce3f5',
      '--border':'#a8cce8','--text':'#0c1f30','--text-dim':'#2a5070','--text-muted':'#6090b0',
      '--accent':'#0369a1','--accent2':'#d97706',
    }
  },
  {
    id: 'lavanda', name: 'Lavanda', emoji: '💜',
    vars: {
      '--bg':'#f8f6ff','--surface':'#ffffff','--surface2':'#f0ecff','--surface3':'#e4dcff',
      '--border':'#c4b8ee','--text':'#1a1030','--text-dim':'#4a3870','--text-muted':'#8878b0',
      '--accent':'#7c3aed','--accent2':'#db2777',
    }
  },
  {
    id: 'arena', name: 'Arena', emoji: '🏜️',
    vars: {
      '--bg':'#fdf8f0','--surface':'#ffffff','--surface2':'#f5ede0','--surface3':'#ece0cc',
      '--border':'#d4c4a8','--text':'#2a1e0a','--text-dim':'#6a5030','--text-muted':'#a09070',
      '--accent':'#b45309','--accent2':'#0f766e',
    }
  },
];

// ===== THEME MANAGEMENT FUNCTIONS =====

/**
 * Get the user theme storage key
 * @returns {string|null} Storage key for current user
 */
export function getUserThemeKey() {
  return currentUser ? `diario_theme_${currentUser.id}` : null;
}

/**
 * Load user's saved theme
 * @returns {string|null} Theme ID or null
 */
export function loadUserTheme() {
  const key = getUserThemeKey();
  if (!key) return null;
  return localStorage.getItem(key) || 'default';
}

/**
 * Save user's theme preference
 * @param {string} themeId - Theme ID to save
 */
export function saveUserTheme(themeId) {
  const key = getUserThemeKey();
  if (!key) return;
  localStorage.setItem(key, themeId);
}

/**
 * Orbes de fondo para tema Aurora (nodos fijos en body; evita overflow:hidden en #app/.layout)
 */
export function createAuroraOrbs() {
  document.querySelectorAll('.aurora-orb').forEach(el => el.remove());
  const orbs = [
    { top: '-80px', left: '-60px', size: '380px', color: 'rgba(120,80,255,0.35)' },
    { bottom: '-50px', right: '80px', size: '300px', color: 'rgba(0,200,150,0.25)' },
    { top: '200px', right: '20px', size: '250px', color: 'rgba(255,150,50,0.15)' },
  ];
  orbs.forEach(orb => {
    const el = document.createElement('div');
    el.className = 'aurora-orb';
    el.style.cssText = `position:fixed;width:${orb.size};height:${orb.size};background:radial-gradient(circle,${orb.color} 0%,transparent 70%);border-radius:50%;pointer-events:none;z-index:0;${orb.top ? 'top:' + orb.top + ';' : ''}${orb.bottom ? 'bottom:' + orb.bottom + ';' : ''}${orb.left ? 'left:' + orb.left + ';' : ''}${orb.right ? 'right:' + orb.right + ';' : ''}`;
    document.body.appendChild(el);
  });
}

/**
 * Apply a theme to the document
 * @param {string} themeId - Theme ID to apply
 */
export function applyUserTheme(themeId) {
  const theme = USER_THEMES.find(t => t.id === themeId) || USER_THEMES[0];
  const root = document.documentElement;

  // Remove previous theme classes
  root.className = root.className.replace(/tema-\w+/g, '');
  // Add new theme class
  root.classList.add(`tema-${theme.id}`);

  Object.entries(theme.vars).forEach(([k,v]) => root.style.setProperty(k, v));
  saveUserTheme(themeId);
  // SAVE ALSO IN GLOBAL KEY FOR LOGIN
  localStorage.setItem('globalSelectedTheme', themeId);

  // Detect if theme is light based on background color
  const bg = theme.vars['--bg'] || '#0f0e0c';
  const isLight = isLightColor(bg);
  if (isLight) {
    root.style.setProperty('--postit-yellow', '#fef9c3');
    root.style.setProperty('--postit-blue',   '#dbeafe');
    root.style.setProperty('--postit-purple',  '#ede9fe');
    root.style.setProperty('--postit-green',   '#dcfce7');
    root.style.setProperty('--postit-red',     '#fee2e2');
    // Modal in light theme: clean white surface and soft blue-gray borders
    root.style.setProperty('--modal-surface', '#ffffff');
    root.style.setProperty('--modal-input-bg', '#ffffff');
    root.style.setProperty('--modal-input-border', '#e2e8f0');
  } else {
    root.style.setProperty('--postit-yellow', '#2a2510');
    root.style.setProperty('--postit-blue',   '#0d1e2e');
    root.style.setProperty('--postit-purple',  '#1a1428');
    root.style.setProperty('--postit-green',   '#0d1f18');
    root.style.setProperty('--postit-red',     '#2a1010');
    // Modal in dark theme: use surface mixes for glassmorphism
    root.style.setProperty('--modal-surface', 'color-mix(in srgb, var(--surface) 78%, transparent 22%)');
    root.style.setProperty('--modal-input-bg', 'color-mix(in srgb, var(--surface2) 85%, transparent 15%)');
    root.style.setProperty('--modal-input-border', 'color-mix(in srgb, var(--border) 35%, transparent)');
  }

  if (themeId === 'aurora') {
    createAuroraOrbs();
  } else {
    document.querySelectorAll('.aurora-orb').forEach(el => el.remove());
  }

  // Sync accent color pickers if on settings
  const ac = document.getElementById('cfg-accent-color');
  const ac2 = document.getElementById('cfg-accent2-color');
  if (ac) ac.value = theme.vars['--accent'] || '#e8c547';
  if (ac2) ac2.value = theme.vars['--accent2'] || '#c47b3a';

  renderThemeGrid();
  showToast(`Tema "${theme.name}" aplicado`, 'success');
}

/**
 * Apply stored theme on app load
 */
export function applyStoredTheme() {
  const storedTheme = localStorage.getItem('globalSelectedTheme') || 'default';
  const theme = USER_THEMES.find(t => t.id === storedTheme) || USER_THEMES[0];
  const root = document.documentElement;

  // Remove previous theme classes
  root.className = root.className.replace(/tema-\w+/g, '');
  // Add theme class
  root.classList.add(`tema-${theme.id}`);

  Object.entries(theme.vars).forEach(([k,v]) => root.style.setProperty(k, v));

  // Apply post-it colors based on luminosity
  const bg = theme.vars['--bg'] || '#0f0e0c';
  const isLight = isLightColor(bg);
  if (isLight) {
    root.style.setProperty('--postit-yellow', '#fef9c3');
    root.style.setProperty('--postit-blue',   '#dbeafe');
    root.style.setProperty('--postit-purple',  '#ede9fe');
    root.style.setProperty('--postit-green',   '#dcfce7');
    root.style.setProperty('--postit-red',     '#fee2e2');
    root.style.setProperty('--modal-surface', '#ffffff');
    root.style.setProperty('--modal-input-bg', '#ffffff');
    root.style.setProperty('--modal-input-border', '#e2e8f0');
  } else {
    root.style.setProperty('--postit-yellow', '#2a2510');
    root.style.setProperty('--postit-blue',   '#0d1e2e');
    root.style.setProperty('--postit-purple',  '#1a1428');
    root.style.setProperty('--postit-green',   '#0d1f18');
    root.style.setProperty('--postit-red',     '#2a1010');
    root.style.setProperty('--modal-surface', 'color-mix(in srgb, var(--surface) 78%, transparent 22%)');
    root.style.setProperty('--modal-input-bg', 'color-mix(in srgb, var(--surface2) 85%, transparent 15%)');
    root.style.setProperty('--modal-input-border', 'color-mix(in srgb, var(--border) 35%, transparent)');
  }

  document.querySelectorAll('.aurora-orb').forEach(el => el.remove());
}

/**
 * Check if a color is light
 * @param {string} hex - Hex color string
 * @returns {boolean} True if light color
 */
export function isLightColor(hex) {
  // Parse hex to RGB and compute luminance
  const h = hex.replace('#','');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  // Perceived luminance formula
  return (0.299*r + 0.587*g + 0.114*b) > 140;
}

/**
 * Reset user theme to default
 */
export function resetUserTheme() {
  applyUserTheme('default');
}

// ===== CUSTOM THEME FUNCTIONS =====

/**
 * Toggle custom theme panel visibility
 */
export function toggleCustomThemePanel() {
  const panel = document.getElementById('custom-theme-panel');
  const icon = document.getElementById('custom-theme-toggle-icon');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (icon) icon.textContent = isOpen ? '▶ Expandir' : '▼ Ocultar';
  if (!isOpen) loadCustomThemeIntoEditor();
}

/**
 * Load custom theme values into editor
 */
export function loadCustomThemeIntoEditor() {
  const saved = getCustomThemeVars();
  const defaults = USER_THEMES[0].vars;
  const vars = saved || defaults;
  const fields = {
    'ct-bg': '--bg', 'ct-surface': '--surface', 'ct-surface2': '--surface2',
    'ct-surface3': '--surface3', 'ct-border': '--border', 'ct-text': '--text',
    'ct-text-dim': '--text-dim', 'ct-text-muted': '--text-muted',
    'ct-accent': '--accent', 'ct-accent2': '--accent2',
  };
  Object.entries(fields).forEach(([id, cssVar]) => {
    const el = document.getElementById(id);
    if (el) el.value = vars[cssVar] || '#000000';
  });
  const nameEl = document.getElementById('ct-name');
  const emojiEl = document.getElementById('ct-emoji');
  const savedMeta = getCustomThemeMeta();
  if (nameEl) nameEl.value = savedMeta?.name || 'Mi Tema';
  if (emojiEl) emojiEl.value = savedMeta?.emoji || '✨';
}

/**
 * Get saved custom theme variables
 * @returns {Object|null} Custom theme variables or null
 */
export function getCustomThemeVars() {
  try {
    const raw = localStorage.getItem('diario_custom_theme_vars');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Get saved custom theme metadata
 * @returns {Object|null} Custom theme metadata or null
 */
export function getCustomThemeMeta() {
  try {
    const raw = localStorage.getItem('diario_custom_theme_meta');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Read custom theme from editor inputs
 * @returns {Object} Theme data with vars, name, and emoji
 */
export function readCustomThemeFromEditor() {
  const fields = {
    'ct-bg': '--bg', 'ct-surface': '--surface', 'ct-surface2': '--surface2',
    'ct-surface3': '--surface3', 'ct-border': '--border', 'ct-text': '--text',
    'ct-text-dim': '--text-dim', 'ct-text-muted': '--text-muted',
    'ct-accent': '--accent', 'ct-accent2': '--accent2',
  };
  const vars = {};
  Object.entries(fields).forEach(([id, cssVar]) => {
    const el = document.getElementById(id);
    if (el) vars[cssVar] = el.value;
  });
  const name = document.getElementById('ct-name')?.value || 'Mi Tema';
  const emoji = document.getElementById('ct-emoji')?.value || '✨';
  return { vars, name, emoji };
}

/**
 * Preview custom theme
 */
export function previewCustomTheme() {
  const { vars } = readCustomThemeFromEditor();
  Object.entries(vars).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
  showToast('Vista previa del tema personalizado', 'info');
}

/**
 * Save custom theme
 */
export function saveCustomTheme() {
  const { vars, name, emoji } = readCustomThemeFromEditor();
  localStorage.setItem('diario_custom_theme_vars', JSON.stringify(vars));
  localStorage.setItem('diario_custom_theme_meta', JSON.stringify({ name, emoji }));
  // Inject as a dynamic theme into USER_THEMES (replace if exists)
  const existingIdx = USER_THEMES.findIndex(t => t.id === 'custom');
  const customTheme = { id: 'custom', name, emoji, vars };
  if (existingIdx !== -1) USER_THEMES[existingIdx] = customTheme;
  else USER_THEMES.push(customTheme);
  Object.entries(vars).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
  saveUserTheme('custom');
  renderThemeGrid();
  showToast(`Tema "${name}" guardado y aplicado`, 'success');
}

/**
 * Delete custom theme
 */
export function deleteCustomTheme() {
  const idx = USER_THEMES.findIndex(t => t.id === 'custom');
  if (idx !== -1) USER_THEMES.splice(idx, 1);
  localStorage.removeItem('diario_custom_theme_vars');
  localStorage.removeItem('diario_custom_theme_meta');
  applyUserTheme('default');
  showToast('Tema personalizado eliminado', 'info');
}

/**
 * Load custom theme if saved
 */
export function loadCustomThemeIfSaved() {
  const vars = getCustomThemeVars();
  if (!vars) return;
  const meta = getCustomThemeMeta() || { name: 'Mi Tema', emoji: '✨' };
  const existingIdx = USER_THEMES.findIndex(t => t.id === 'custom');
  const customTheme = { id: 'custom', name: meta.name, emoji: meta.emoji, vars };
  if (existingIdx !== -1) USER_THEMES[existingIdx] = customTheme;
  else USER_THEMES.push(customTheme);
}

export function saveCfg() {
  const cfg = {
    appName: document.getElementById('cfg-app-name')?.value,
    deptName: document.getElementById('cfg-dept-name')?.value,
    accentColor: document.getElementById('cfg-accent-color')?.value,
    accent2Color: document.getElementById('cfg-accent2-color')?.value,
  };
  localStorage.setItem('diario_cfg', JSON.stringify(cfg));
  if (cfg.appName) document.title = cfg.appName;
  showToast('Configuración guardada', 'success');
}

export function applyAccentColor(v) {
  document.documentElement.style.setProperty('--accent', v);
  saveCfg();
}

export function applyAccent2Color(v) {
  document.documentElement.style.setProperty('--accent2', v);
  saveCfg();
}

/**
 * Render theme grid in settings
 */
export function renderThemeGrid() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  const activeId = loadUserTheme() || 'default';
  grid.innerHTML = USER_THEMES.map(t => {
    const isActive = t.id === activeId;
    return `<button class="theme-card ${isActive ? 'active' : ''}" onclick="applyUserTheme('${t.id}')" title="${t.name}">
      <div class="theme-preview" style="background:${t.vars['--bg']}">
        <div class="theme-preview-sidebar" style="background:${t.vars['--surface']};border-right:2px solid ${t.vars['--border']}">
          <div class="theme-preview-brand" style="background:${t.vars['--accent']}"></div>
          <div class="theme-preview-line" style="background:${t.vars['--surface3']}"></div>
          <div class="theme-preview-line short" style="background:${t.vars['--surface2']}"></div>
          <div class="theme-preview-line short" style="background:${t.vars['--surface2']}"></div>
        </div>
        <div class="theme-preview-main">
          <div class="theme-preview-topbar" style="background:${t.vars['--surface']};border-bottom:1px solid ${t.vars['--border']}">
            <div style="width:50%;height:6px;background:${t.vars['--text-dim']};border-radius:3px;opacity:0.5"></div>
            <div style="width:18px;height:6px;background:${t.vars['--accent']};border-radius:3px;margin-left:auto"></div>
          </div>
          <div class="theme-preview-card" style="background:${t.vars['--surface']};border:1px solid ${t.vars['--border']}">
            <div style="width:70%;height:5px;background:${t.vars['--text']};border-radius:2px;opacity:0.8;margin-bottom:4px"></div>
            <div style="width:90%;height:4px;background:${t.vars['--text-dim']};border-radius:2px;opacity:0.5"></div>
          </div>
          <div class="theme-preview-card" style="background:${t.vars['--surface']};border:1px solid ${t.vars['--border']}">
            <div style="width:50%;height:5px;background:${t.vars['--accent']};border-radius:2px;margin-bottom:4px"></div>
            <div style="width:80%;height:4px;background:${t.vars['--text-dim']};border-radius:2px;opacity:0.5"></div>
          </div>
        </div>
      </div>
      <div class="theme-card-footer">
        <span class="theme-emoji">${t.emoji}</span>
        <span class="theme-name">${t.name}</span>
        ${isActive ? '<span class="theme-active-dot"></span>' : ''}
      </div>
    </button>`;
  }).join('');
}

// ===== LOGIN THEME FUNCTIONS =====

/**
 * Toggle login theme panel
 */
export function toggleLoginThemePanel() {
  const panel = document.getElementById('login-theme-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderLoginThemeButtons();
}

/**
 * Render login theme buttons
 */
export function renderLoginThemeButtons() {
  const container = document.getElementById('login-theme-buttons');
  if (!container) return;
  container.innerHTML = USER_THEMES.map(t =>
    `<button class="theme-btn-mini ${localStorage.getItem('globalSelectedTheme') === t.id ? 'active' : ''}" onclick="applyUserThemeLogin('${t.id}')">
      ${t.emoji} ${t.name}
    </button>`
  ).join('');
}

/**
 * Apply theme for login screen
 * @param {string} themeId - Theme ID to apply
 */
export function applyUserThemeLogin(themeId) {
  const theme = USER_THEMES.find(t => t.id === themeId) || USER_THEMES[0];
  const root = document.documentElement;

  // Remove previous theme classes
  root.className = root.className.replace(/tema-\w+/g, '');
  // Add theme class
  root.classList.add(`tema-${theme.id}`);

  Object.entries(theme.vars).forEach(([k,v]) => root.style.setProperty(k, v));
  localStorage.setItem('globalSelectedTheme', themeId);

  // Update active button
  const buttons = document.querySelectorAll('.theme-btn-mini');
  buttons.forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.theme-btn-mini[onclick="applyUserThemeLogin('${themeId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.aurora-orb').forEach(el => el.remove());
}