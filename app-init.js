// app-init.js — Application initialization, tab/sticky/stats wiring, and upload/edit listeners

const TAB_IDS = ['inventory', 'comparison', 'issues', 'proposed-grid'];
let appInitialized = false;
let activeUploadId = null;

function showTab(id) {
  const tabId = TAB_IDS.includes(id) ? id : 'inventory';
  TAB_IDS.forEach(t => {
    const tabEl = document.getElementById('tab-' + t);
    if (tabEl) tabEl.classList.toggle('hidden', t !== tabId);
  });
  document.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  const controls = document.getElementById('compare-controls-bar');
  if (controls) controls.classList.toggle('hidden', tabId !== 'comparison');
  const jumpBar = document.getElementById('compare-jump-bar');
  if (jumpBar && tabId !== 'comparison') jumpBar.classList.add('hidden');
  updateStickySpacer();
  try {
    localStorage.setItem('iconAuditActiveTab', tabId);
  } catch (err) {
    // ignore storage errors
  }
}

function updateStickySpacer() {
  const spacer = document.getElementById('sticky-spacer');
  const stack = document.getElementById('sticky-stack');
  if (!spacer || !stack) return;
  spacer.style.height = `${stack.offsetHeight}px`;
}

// ── Stats (populated from aggregated datasets) ─────────────────
function updateStats() {
  const d = AGG;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-total', d.total);
  setEl('stat-libs', Object.keys(d.byLib).length);
  setEl('stat-svgs', d.uniqueSVGs);
  setEl('stat-react', d.uniqueReact);
  // Summary bar counts
  Object.entries(d.byType).forEach(([type, count]) => {
    setEl('sum-val-' + type, count);
  });
  // Summary bar sub-text
  const svgSub = document.getElementById('sum-sub-SVG_import');
  if (svgSub) svgSub.textContent = d.uniqueSVGs + ' unique files';
  const reactSub = document.getElementById('sum-sub-ReactIcons');
  if (reactSub) reactSub.textContent = Object.keys(d.byLib).filter(l => l.startsWith('react-icons')).length + ' sub-libraries';
  // Version / date
  const tag = document.querySelector('.header-tag');
  if (tag && d.generated) tag.title = 'Generated ' + d.generated;
}

function sanitizeUploadedSvg(svgText) {
  const stripped = String(svgText || '').replace(/<\?xml[^>]*\?>/gi, '').trim();
  if (!stripped) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(stripped, 'image/svg+xml');
  if (!doc || doc.querySelector('parsererror')) return null;
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;

  doc.querySelectorAll('script, foreignObject, iframe, object, embed').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').trim();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'xlink:href') && /^javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return new XMLSerializer().serializeToString(svg);
}

function getSavedTab() {
  try {
    return localStorage.getItem('iconAuditActiveTab');
  } catch (err) {
    return null;
  }
}

function findComparisonItemById(itemId) {
  for (const section of comparisons) {
    const item = section.items.find(i => i._id === itemId);
    if (item) return item;
  }
  return null;
}

function bindGlobalSvgUpload() {
  const globalSvgInput = document.getElementById('global-svg-upload');
  if (!globalSvgInput || globalSvgInput.dataset.bound === '1') return;
  globalSvgInput.dataset.bound = '1';
  globalSvgInput.addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file || !activeUploadId) return;
    try {
      const text = await file.text();
      const cleanSvg = sanitizeUploadedSvg(text);
      if (!cleanSvg) {
        console.error('Upload error: invalid SVG');
        return;
      }
      const item = findComparisonItemById(activeUploadId);
      if (item) {
        item.proposed = cleanSvg;
        item.proposedLib = 'custom-svg-upload';
        saveComparisons();
        renderComparison();
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      e.target.value = '';
      activeUploadId = null;
    }
  });
}

function bindShuffleButton() {
  const shuffleBtn = document.getElementById('btn-shuffle-proposed');
  if (!shuffleBtn || shuffleBtn.dataset.bound === '1') return;
  shuffleBtn.dataset.bound = '1';
  shuffleBtn.addEventListener('click', () => {
    window.PROPOSED_GRID_SHUFFLE = true;
    renderProposedGrid();
  });
}

function bindStaticUiHandlers() {
  document.querySelectorAll('.tab[data-tab]').forEach(btn => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => showTab(btn.dataset.tab || 'inventory'));
  });

  document.querySelectorAll('.summary-cell[data-filter-type], .filter-btn[data-filter-type]').forEach(el => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('click', () => filterType(el.dataset.filterType || 'all'));
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput && searchInput.dataset.bound !== '1') {
    searchInput.dataset.bound = '1';
    searchInput.addEventListener('input', () => applyFilters());
  }

  const repoFilter = document.getElementById('repo-filter');
  if (repoFilter && repoFilter.dataset.bound !== '1') {
    repoFilter.dataset.bound = '1';
    repoFilter.addEventListener('change', () => filterRepo(repoFilter.value));
  }

  document.querySelectorAll('th[data-sort-col]').forEach(th => {
    if (th.dataset.bound === '1') return;
    th.dataset.bound = '1';
    th.addEventListener('click', () => sortBy(th.dataset.sortCol));
  });

  document.querySelectorAll('[data-grid-mode]').forEach(btn => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => setGridMode(btn.dataset.gridMode));
  });
}

function bindInventoryEditEvents() {
  const editToggleBtn = document.getElementById('btn-inv-edit-toggle');
  if (editToggleBtn && editToggleBtn.dataset.bound !== '1') {
    editToggleBtn.dataset.bound = '1';
    editToggleBtn.addEventListener('click', toggleInventoryEditMode);
  }

  const tableBody = document.getElementById('table-body');
  if (!tableBody || tableBody.dataset.bound === '1') return;
  tableBody.dataset.bound = '1';

  tableBody.addEventListener('change', e => {
    const target = e.target;
    if (!target || !target.matches) return;
    const key = target.dataset.key;
    const value = target.value;
    if (target.matches('.inv-edit-input')) {
      saveInventoryIconEdit(key, value);
    }
    if (target.matches('.inv-label-input')) {
      saveInventoryLabelEdit(key, value);
    }
  });

  tableBody.addEventListener('keydown', e => {
    if (!e.target || !e.target.matches) return;
    const isInput = e.target.matches('.inv-edit-input') || e.target.matches('.inv-label-input');
    if (e.key === 'Enter' && isInput) {
      e.target.blur();
    }
  });

  tableBody.addEventListener('click', e => {
    const btn = e.target.closest('.inv-delete-btn');
    if (btn) deleteInventoryRow(btn.dataset.key);
  });
}

window.triggerSvgUpload = function (itemId) {
  activeUploadId = itemId;
  const input = document.getElementById('global-svg-upload');
  if (input) input.click();
};

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  updateStats();
  const inventoryState = loadInventoryState();
  if (inventoryState) {
    if (inventoryState.currentType) currentType = inventoryState.currentType;
    if (inventoryState.currentRepo) currentRepo = inventoryState.currentRepo;
    if (typeof inventoryState.page === 'number') page = inventoryState.page;
    if (inventoryState.sortCol) sortCol = inventoryState.sortCol;
    if (typeof inventoryState.sortDir === 'number') sortDir = inventoryState.sortDir;
  }
  renderRepoFilter();
  updateFilterButtons();
  const searchInput = document.getElementById('search-input');
  if (searchInput && inventoryState && typeof inventoryState.search === 'string') {
    searchInput.value = inventoryState.search;
  }

  const savedTab = getSavedTab();
  applyFilters(true);
  renderComparison();
  updateComparisonControls();
  setupComparisonControls();
  setupInventoryExport();
  applyGeneratedUsage();
  updateStickySpacer();
  window.addEventListener('resize', updateStickySpacer);
  showTab((savedTab && TAB_IDS.includes(savedTab)) ? savedTab : 'inventory');
  updateSortButtons();

  bindShuffleButton();
  bindStaticUiHandlers();
  bindInventoryEditEvents();
  bindGlobalSvgUpload();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}
