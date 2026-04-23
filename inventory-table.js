// inventory-table.js — Inventory filtering, sorting, pagination, rendering, and export setup

let filtered = [...data];
let currentType = 'all';
let currentRepo = 'all';
let sortCol = null;
let sortDir = 1;
let page = 1;
const PAGE_SIZE = 40;
let selectedItems = new Set();

// ── Filter / Sort ─────────────────────────────────────────────
function filterType(type) {
  currentType = type;
  document.querySelectorAll('.filter-btn').forEach(b => {
    ['active-all', 'active-svg', 'active-react', 'active-fa', 'active-inline'].forEach(cls => b.classList.remove(cls));
  });
  const map = { all: 'active-all', SVG_import: 'active-svg', SVG_asset: 'active-svg', ReactIcons: 'active-react', FontAwesome: 'active-fa', SVG_inline: 'active-inline', SCSS_url: 'active-inline' };
  const btn = document.getElementById('btn-' + type);
  if (btn) btn.classList.add(map[type] || 'active-all');
  applyFilters();
}

function getUsageLocationsForRepo(name, lib, repo) {
  return getUsageLocations(name, lib).filter(u => u.repo === repo);
}

function labelFromRow(row) {
  const raw = cleanName(row.icon_name);
  const base = raw.replace(/\.(svg|png|jpg|jpeg|gif)$/i, '');
  if (!base) return raw || row.icon_name || 'Icon';
  return base;
}

function buildInventoryKey(row) {
  const type = row.type || '';
  const lib = row.library || '';
  const name = cleanName(row.icon_name || '');
  if (type === 'SVG_asset') {
    const fileKey = normalizePath(row.file || '');
    return `SVG_asset||${fileKey}`;
  }
  if (type === 'SVG_import') {
    const path = row.icon_name && row.icon_name.includes('→') ? row.icon_name.split('→')[1].trim() : row.icon_name;
    const resolved = resolveSvgPath(path);
    const fileKey = resolved ? resolved.file : normalizePath(path || name);
    return `SVG_import||${fileKey}`;
  }
  if (type === 'SVG_inline') {
    return `SVG_inline||${row.repo || ''}||${normalizePath(row.file || '')}||${row.line || ''}`;
  }
  if (type === 'SCSS_url') {
    const baseDir = getDirPath(row.file);
    const resolvedPath = resolveRelativePath(baseDir, row.icon_name);
    return `SCSS_url||${normalizePath(resolvedPath || row.icon_name || name)}`;
  }
  return `${type}||${lib}||${name.toLowerCase()}`;
}

function buildComparisonsFromInventory() {
  const source = (filtered && filtered.length) ? filtered : data;
  const repoMap = new Map();
  source.forEach(row => {
    const repo = row.repo || 'default';
    if (!repoMap.has(repo)) repoMap.set(repo, new Map());
    const group = repoMap.get(repo);
    const label = row.label || labelFromRow(row);
    const key = buildInventoryKey(row);
    if (group.has(key)) return;
    const currentLib = row.type === 'SVG_inline'
      ? `SVG_inline||${row.repo || ''}||${row.file || ''}||${row.line || ''}`
      : (row.library || '');
    group.set(key, {
      label,
      usage: '',
      current: row.icon_name || label,
      currentLib,
      proposed: '',
      proposedLib: 'lucide-react',
      emoji: '•'
    });
  });

  const sections = [];
  REPO_ORDER.forEach(repo => {
    const group = repoMap.get(repo);
    if (!group || !group.size) return;
    const items = Array.from(group.values()).map(item => {
      const uses = getUsageLocationsForRepo(item.current, item.currentLib, repo);
      const summary = generateUsageFromLocations(uses);
      return {
        ...item,
        usage: summary || item.usage
      };
    });
    sections.push({
      section: `${getRepoLabel(repo)} — Inventory`,
      items
    });
  });

  // Include any repos not in REPO_ORDER
  repoMap.forEach((group, repo) => {
    if (REPO_ORDER.includes(repo)) return;
    if (!group || !group.size) return;
    const items = Array.from(group.values()).map(item => {
      const uses = getUsageLocationsForRepo(item.current, item.currentLib, repo);
      const summary = generateUsageFromLocations(uses);
      return {
        ...item,
        usage: summary || item.usage
      };
    });
    sections.push({
      section: `${getRepoLabel(repo)} — Inventory`,
      items
    });
  });

  comparisons = sections;
  ensureItemIds(comparisons);
  saveComparisons();
  updateComparisonControls();
  renderComparison();
}

function filterRepo(repo) {
  currentRepo = repo;
  applyFilters();
}

function applyFilters(keepPage = false) {
  const searchEl = document.getElementById('search-input');
  const q = String(searchEl ? searchEl.value : '').toLowerCase();
  filtered = data.filter(r => {
    const typeMatch = currentType === 'all' || r.type === currentType;
    const repoMatch = currentRepo === 'all' || r.repo === currentRepo;
    const searchMatch = !q || r.file.toLowerCase().includes(q) || r.icon_name.toLowerCase().includes(q) || r.library.toLowerCase().includes(q) || String(r.repo || '').toLowerCase().includes(q) || String(r.repoPath || '').toLowerCase().includes(q);
    return typeMatch && repoMatch && searchMatch;
  });
  if (sortCol) {
    filtered.sort((a, b) => {
      const av = String(a[sortCol]).toLowerCase();
      const bv = String(b[sortCol]).toLowerCase();
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });
  }
  if (!keepPage) {
    page = 1;
  } else {
    const total = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page < 1) page = 1;
    if (page > total) page = total;
  }
  renderTable();
  renderLibChips();
  saveInventoryState();
}

function exportInventoryJson() {
  const payload = JSON.stringify(filtered, null, 2);
  downloadFile('icon-audit-inventory.json', 'application/json', payload);
}

function exportInventoryCsv() {
  const rows = [];
  rows.push(['repo', 'repo_path', 'type', 'icon_name', 'library', 'file', 'line', 'context']);
  filtered.forEach(r => {
    rows.push([
      r.repo,
      r.repoPath,
      r.type,
      r.icon_name,
      r.library,
      r.file,
      r.line,
      r.context || ''
    ]);
  });
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  downloadFile('icon-audit-inventory.csv', 'text/csv', csv);
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  applyFilters();
}

// ── Render Table ──────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('table-body');
  const resultCountEl = document.getElementById('result-count');
  if (!tbody) return;
  const start = (page - 1) * PAGE_SIZE;
  const pageData = filtered.slice(start, start + PAGE_SIZE);
  if (resultCountEl) resultCountEl.textContent = `${filtered.length} results`;

  tbody.innerHTML = pageData.map(r => {
    const key = rowEditKey(r);
    const safeKey = escapeAttr(key);

    const iconNameValue = escapeAttr(cleanName(r.icon_name));
    const iconCell = inventoryEditMode
      ? `<input class="inv-edit-input" data-key="${safeKey}" value="${iconNameValue}" title="Technical icon name" autocomplete="off" spellcheck="false">`
      : iconNameValue;

    const labelValue = escapeAttr(r.label || labelFromRow(r));
    const labelCell = inventoryEditMode
      ? `<input class="inv-label-input" data-key="${safeKey}" value="${labelValue}" title="Display label" autocomplete="off" spellcheck="false">`
      : `<strong>${labelValue}</strong>`;

    const actionsCell = inventoryEditMode
      ? `<td class="td-actions"><button class="inv-delete-btn" data-key="${safeKey}" title="Delete row">×</button></td>`
      : '';

    return `
    <tr>
      <td><span class="badge ${badgeClass(r.type)}">${badgeLabel(r.type)}</span></td>
      <td class="td-repo">${repoBadgeHtml(r.repo)}</td>
      <td class="td-icon-name">${iconCell}</td> <td class="td-label">${labelCell}</td>      <td class="td-lib"><span style="color:var(--text-dim)">${escapeAttr(r.library)}</span></td>
      <td class="td-file">
        <div class="td-file-component">${escapeAttr(getFileComponent(r.repoPath || r.file))}</div>
        <div class="td-file-path">${escapeAttr(getFilePath(r.repoPath || r.file))}</div>
      </td>
      <td class="td-line">${escapeAttr(r.line)}</td>
      <td class="td-context">${iconPreview(r)}</td>
      ${actionsCell}
    </tr>`;
  }).join('');

  renderPagination();
  inlineSvgPreviews();
  inlineSourceSvgs();
}

function renderPagination() {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  const pagTop = document.getElementById('pagination-top');
  if (total <= 1) {
    if (pag) pag.innerHTML = '';
    if (pagTop) pagTop.innerHTML = '';
    return;
  }
  let html = `<button class="page-btn" onclick="goPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>← Prev</button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - page) <= 2) {
      html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - page) === 3) {
      html += `<span class="page-info">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${page + 1})" ${page === total ? 'disabled' : ''}>Next →</button>`;
  if (pag) pag.innerHTML = html;
  if (pagTop) pagTop.innerHTML = html;
}

function goPage(p) {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > total) return;
  page = p;
  renderTable();
  saveInventoryState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLibChips() {
  const counts = {};
  filtered.forEach(r => { counts[r.library] = (counts[r.library] || 0) + 1; });
  const chips = document.getElementById('lib-chips');
  if (!chips) return;
  chips.innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([lib, cnt]) =>
    `<div class="lib-chip"><span class="lib-chip-count">${cnt}</span> ${escapeAttr(lib)}</div>`
  ).join('');
}

function setupInventoryExport() {
  const jsonBtn = document.getElementById('btn-export-inventory-json');
  if (jsonBtn) jsonBtn.addEventListener('click', exportInventoryJson);
  const csvBtn = document.getElementById('btn-export-inventory-csv');
  if (csvBtn) csvBtn.addEventListener('click', exportInventoryCsv);
}
