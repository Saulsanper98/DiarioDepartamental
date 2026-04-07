// Dropdown custom sincronizado con <select> nativo (solo tema Aurora).
// Módulo aislado para evitar dependencia circular notes ↔ comments ↔ projects.

const PROJECT_PARENT_SELECT_ID = 'project-parent-select';

/** Misma UI de jerarquía (DFS, └─, --tree-indent) que project-parent-select. */
const DOC_FOLDER_TREE_SELECT_IDS = ['doc-parent-input', 'insert-file-folder-select'];

function isDocFolderTreeSelect(selectId) {
  return DOC_FOLDER_TREE_SELECT_IDS.includes(selectId);
}

/** Fallback: texto del <option> con prefijo · (fillProjectParentSelect) si no hay filas DFS Aurora. */
function parseProjectParentOptionLabel(text) {
  const t = (text || '').trim();
  const m = t.match(/^(\u00B7+)\s*(.*)$/);
  if (m) {
    return { depth: m[1].length, label: (m[2] || '').trim() || t };
  }
  return { depth: 0, label: t };
}

function projectParentTreePaddingLeft(depth) {
  if (depth <= 0) return 12;
  return depth * 16;
}

let auroraCustomSelectOutsideBound = false;

function bindAuroraCustomSelectOutsideOnce() {
  if (auroraCustomSelectOutsideBound) return;
  auroraCustomSelectOutsideBound = true;
  document.addEventListener(
    'mousedown',
    e => {
      if (e.target.closest('.custom-select-wrapper')) return;
      document.querySelectorAll('.custom-select-dropdown.open').forEach(el => el.classList.remove('open'));
    },
    true
  );
}

/** Sincroniza con <select> oculto vía CSS (html.tema-aurora). buildSharesFromCollabSelect no cambia. */
export function createCustomSelect(selectId, modalRootSelector = '#note-modal', options = {}) {
  const treeRows = options.projectParentAuroraRows ?? options.treeRows;

  const sel = document.getElementById(selectId);
  if (!sel) return;

  const prev = document.querySelector(`${modalRootSelector} .custom-select-wrapper[data-for="${selectId}"]`);
  if (prev) prev.remove();

  sel.style.removeProperty('display');

  if (!document.documentElement.classList.contains('tema-aurora')) {
    return;
  }

  if (!sel.options || sel.options.length === 0) return;

  bindAuroraCustomSelectOutsideOnce();

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  wrapper.dataset.for = selectId;

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';

  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown';

  function bindOptionClick(div) {
    div.addEventListener('mousedown', e => e.preventDefault());
    div.addEventListener('click', e => {
      e.stopPropagation();
      sel.value = div.dataset.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      dropdown.querySelectorAll('.custom-select-option').forEach(o => {
        o.classList.toggle('selected', String(o.dataset.value) === String(sel.value));
      });
      syncTrigger();
      dropdown.classList.remove('open');
    });
  }

  function syncTrigger() {
    trigger.replaceChildren();
    const opt = sel.options[sel.selectedIndex];
    const label = document.createElement('span');
    label.className = 'custom-select-trigger-label';
    if (opt && selectId === PROJECT_PARENT_SELECT_ID) {
      if (Array.isArray(treeRows)) {
        if (opt.value === '_root') {
          label.textContent = (opt.textContent || '').trim();
        } else {
          const row = treeRows.find(r => String(r.value) === String(opt.value));
          if (row) {
            if (row.depth >= 1) {
              const conn = document.createElement('span');
              conn.className = 'custom-select-tree-connector';
              conn.textContent = '└─ ';
              label.append(conn, document.createTextNode(row.label));
            } else {
              label.textContent = row.label;
            }
          } else {
            label.textContent = (opt.textContent || '').trim();
          }
        }
      } else {
        const raw = opt.textContent || '';
        const { depth, label: plain } = parseProjectParentOptionLabel(raw);
        if (depth >= 1) {
          const conn = document.createElement('span');
          conn.className = 'custom-select-tree-connector';
          conn.textContent = '└─ ';
          label.append(conn, document.createTextNode(plain));
        } else {
          label.textContent = plain;
        }
      }
    } else if (opt && isDocFolderTreeSelect(selectId) && Array.isArray(treeRows)) {
      const rootVal = 'null';
      if (opt.value === rootVal) {
        label.textContent = (opt.textContent || '').trim();
      } else {
        const row = treeRows.find(r => String(r.value) === String(opt.value));
        if (row) {
          if (row.depth >= 1) {
            const conn = document.createElement('span');
            conn.className = 'custom-select-tree-connector';
            conn.textContent = '└─ ';
            label.append(conn, document.createTextNode(row.label));
          } else {
            label.textContent = row.label;
          }
        } else {
          label.textContent = (opt.textContent || '').trim();
        }
      }
    } else {
      label.textContent = opt ? opt.textContent.trim() : '';
    }
    const caret = document.createElement('span');
    caret.className = 'custom-select-trigger-caret';
    caret.textContent = '▾';
    trigger.append(label, caret);
  }

  function appendOption(optEl) {
    const div = document.createElement('div');
    div.className = 'custom-select-option';
    if (optEl.selected) div.classList.add('selected');
    div.dataset.value = optEl.value;

    if (selectId === PROJECT_PARENT_SELECT_ID) {
      div.classList.add('custom-select-option--tree');
      const raw = optEl.textContent || '';
      const { depth, label: plain } = parseProjectParentOptionLabel(raw);
      div.style.setProperty('--tree-indent', `${projectParentTreePaddingLeft(depth)}px`);
      if (depth >= 1) {
        const conn = document.createElement('span');
        conn.className = 'custom-select-tree-connector';
        conn.textContent = '└─ ';
        div.append(conn, document.createTextNode(plain));
      } else {
        div.textContent = plain;
      }
    } else {
      div.textContent = optEl.textContent.trim();
    }

    bindOptionClick(div);
    dropdown.appendChild(div);
  }

  function appendProjectParentRowFromAurora(row) {
    const div = document.createElement('div');
    div.className = 'custom-select-option custom-select-option--tree';
    div.dataset.value = row.value;
    if (String(sel.value) === String(row.value)) div.classList.add('selected');
    div.style.setProperty('--tree-indent', `${projectParentTreePaddingLeft(row.depth)}px`);
    if (row.depth >= 1) {
      const conn = document.createElement('span');
      conn.className = 'custom-select-tree-connector';
      conn.textContent = '└─ ';
      div.append(conn, document.createTextNode(row.label));
    } else {
      div.textContent = row.label;
    }
    bindOptionClick(div);
    dropdown.appendChild(div);
  }

  function buildDropdown() {
    dropdown.replaceChildren();
    if (selectId === PROJECT_PARENT_SELECT_ID && Array.isArray(treeRows)) {
      const rootOpt = sel.querySelector('option[value="_root"]');
      if (rootOpt) {
        const div = document.createElement('div');
        div.className = 'custom-select-option custom-select-option--tree';
        div.dataset.value = '_root';
        if (sel.value === '_root') div.classList.add('selected');
        div.style.setProperty('--tree-indent', `${projectParentTreePaddingLeft(0)}px`);
        div.textContent = (rootOpt.textContent || '').trim();
        bindOptionClick(div);
        dropdown.appendChild(div);
      }
      treeRows.forEach(appendProjectParentRowFromAurora);
      return;
    }
    if (isDocFolderTreeSelect(selectId) && Array.isArray(treeRows)) {
      const rootOpt = sel.querySelector('option[value="null"]');
      if (rootOpt) {
        const div = document.createElement('div');
        div.className = 'custom-select-option custom-select-option--tree';
        div.dataset.value = 'null';
        if (sel.value === 'null') div.classList.add('selected');
        div.style.setProperty('--tree-indent', `${projectParentTreePaddingLeft(0)}px`);
        div.textContent = (rootOpt.textContent || '').trim();
        bindOptionClick(div);
        dropdown.appendChild(div);
      }
      treeRows.forEach(appendProjectParentRowFromAurora);
      return;
    }
    for (const node of sel.children) {
      const tag = node.tagName;
      if (tag === 'OPTGROUP') {
        if (node.label) {
          const labEl = document.createElement('div');
          labEl.className = 'custom-select-optgroup-label';
          labEl.textContent = node.label;
          dropdown.appendChild(labEl);
        }
        node.querySelectorAll('option').forEach(appendOption);
      } else if (tag === 'OPTION') {
        appendOption(node);
      }
    }
  }

  buildDropdown();
  syncTrigger();

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = dropdown.classList.contains('open');
    document.querySelectorAll(`${modalRootSelector} .custom-select-dropdown.open`).forEach(el => el.classList.remove('open'));
    if (!wasOpen) dropdown.classList.add('open');
  });

  wrapper.append(trigger, dropdown);
  sel.insertAdjacentElement('beforebegin', wrapper);
  sel.style.setProperty('display', 'none', 'important');
}
