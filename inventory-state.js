// inventory-state.js — Inventory persistence, edit-mode state, and row edit/delete/save behavior

const INVENTORY_STATE_KEY = 'iconAuditInventoryState:v1';
const INVENTORY_EDITS_KEY = 'iconAuditInventoryEdits:v1';
let inventoryDeleted = new Set();
let inventoryEdits = {};
let inventoryEditMode = false;

function rowEditKey(r) {
  const cleanFile = normalizePath(r.file);
  // Stable key must avoid mutable fields like icon_name.
  return `${r.repo}||${cleanFile}||${r.line}||${r.type || ''}||${r.library || ''}`;
}

function legacyRowEditKey(r) {
  const cleanFile = normalizePath(r.file);
  const name = cleanName(r.icon_name || '');
  return `${r.repo}||${cleanFile}||${r.line}||${name}`;
}

function loadInventoryEdits() {
  try {
    const raw = localStorage.getItem(INVENTORY_EDITS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    inventoryDeleted = new Set(parsed.deleted || []);
    inventoryEdits = parsed.edits || {};
  } catch (err) { /* ignore */ }
}

function saveInventoryEdits() {
  try {
    localStorage.setItem(INVENTORY_EDITS_KEY, JSON.stringify({
      deleted: Array.from(inventoryDeleted),
      edits: inventoryEdits,
    }));
  } catch (err) { /* ignore */ }
}

function rebuildData() {
  data = RAW
    .filter(r => {
      const key = rowEditKey(r);
      const legacyKey = legacyRowEditKey(r);
      return !inventoryDeleted.has(key) && !inventoryDeleted.has(legacyKey);
    })
    .map(r => {
      const key = rowEditKey(r);
      const legacyKey = legacyRowEditKey(r);
      const edit = inventoryEdits[key] || inventoryEdits[legacyKey];

      return edit ? { ...r, ...edit } : r;
    });
  if (typeof clearUsageCaches === 'function') clearUsageCaches();
}

loadInventoryEdits();
let data = [];
rebuildData();

function saveInventoryState() {
  try {
    const q = document.getElementById('search-input')?.value || '';
    const state = {
      currentType,
      currentRepo,
      page,
      search: q,
      sortCol,
      sortDir
    };
    localStorage.setItem(INVENTORY_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    // ignore storage errors
  }
}

function loadInventoryState() {
  try {
    const raw = localStorage.getItem(INVENTORY_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function toggleInventoryEditMode() {
  inventoryEditMode = !inventoryEditMode;
  const btn = document.getElementById('btn-inv-edit-toggle');
  if (btn) {
    btn.textContent = inventoryEditMode ? 'Done Editing' : 'Edit Mode';
    btn.classList.toggle('active-edit', inventoryEditMode);
  }
  renderTable();
}

function deleteInventoryRow(key) {
  inventoryDeleted.add(key);
  saveInventoryEdits();

  data = data.filter(r => rowEditKey(r) !== key);
  if (typeof clearUsageCaches === 'function') clearUsageCaches();
  applyFilters(true);
}

function saveInventoryIconEdit(key, newName) {
  const trimmed = String(newName || '').trim();
  if (!trimmed) return;

  if (!inventoryEdits[key]) inventoryEdits[key] = {};
  inventoryEdits[key].icon_name = trimmed;

  const row = data.find(r => rowEditKey(r) === key);
  if (row) row.icon_name = trimmed;

  saveInventoryEdits();
  if (typeof clearUsageCaches === 'function') clearUsageCaches();
}

function saveInventoryLabelEdit(key, newLabel) {
  const trimmed = String(newLabel || '').trim();
  if (!inventoryEdits[key]) inventoryEdits[key] = {};

  inventoryEdits[key].label = trimmed;

  const row = data.find(r => rowEditKey(r) === key);
  if (row) row.label = trimmed;

  saveInventoryEdits();
  if (typeof clearUsageCaches === 'function') clearUsageCaches();
}
