// comparison-render.js — Comparison/proposed grid rendering and usage generation

let comparisonSort = { key: null, dir: 1, scope: 'repo' };
let gridMode = 'proposed';

function setGridMode(mode) {
  gridMode = mode;
  document.getElementById('btn-grid-proposed')?.classList.toggle('active', mode === 'proposed');
  document.getElementById('btn-grid-proposed')?.classList.toggle('ghost', mode !== 'proposed');
  document.getElementById('btn-grid-current')?.classList.toggle('active', mode === 'current');
  document.getElementById('btn-grid-current')?.classList.toggle('ghost', mode !== 'current');
  window.PROPOSED_GRID_SHUFFLE = false;
  renderProposedGrid();
}

function renderProposedGrid() {
  const grid = document.getElementById('proposed-grid');
  if (!grid) return;

  const isCurrent = gridMode === 'current';

  let html = '';
  comparisons.forEach(section => {
    const sectionItems = Array.isArray(section.items) ? section.items : [];
    const items = isCurrent ? sectionItems : (
      window.PROPOSED_GRID_SHUFFLE ? shuffleArray(sectionItems.slice()) : sectionItems
    );
    if (!items.length) return;
    html += `<div class="proposed-grid-section-header">${escapeAttr(section.section || '')}</div>`;
    html += `<div class="proposed-grid-section">`;
    html += items.map(item => {
      const currents = splitCurrents(item);
      if (isCurrent) {
        return currents.map(cur => `
          <div class="proposed-grid-cell">
            <div class="proposed-grid-icon">${currentIconHtml(cur.name, cur.lib, item.emoji)}</div>
            <div class="proposed-grid-label">${escapeAttr(item.label || cur.name)}</div>
            <div class="proposed-grid-lib">${escapeAttr(cur.lib || '')}</div>
          </div>`).join('');
      }
      return `
        <div class="proposed-grid-cell">
          <div class="proposed-grid-icon">${proposedIconHtml(item)}</div>
          <div class="proposed-grid-label">${escapeAttr(item.label || item.proposed || '')}</div>
          <div class="proposed-grid-lib">${escapeAttr(item.proposedLib || '')}</div>
        </div>`;
    }).join('');
    html += `</div>`;
  });
  grid.innerHTML = html;

  if (window.lucide) lucide.createIcons();
  inlineSvgPreviews();
  inlineSourceSvgs();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sectionAnchorId(sectionIndex) {
  return `compare-section-${sectionIndex}`;
}

function renderComparisonJumpBar() {
  const bar = document.getElementById('compare-jump-bar');
  if (!bar) return;
  if (comparisonSort.scope === 'all') {
    bar.classList.add('hidden');
    return;
  }
  if (comparisons.length === 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.innerHTML = comparisons.map((section, i) =>
    `<a class="jump-pill" href="#${sectionAnchorId(i)}" data-jump="${sectionAnchorId(i)}">${escapeAttr(section.section)}</a>`
  ).join('');
  bar.classList.remove('hidden');

  bar.querySelectorAll('[data-jump]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.jump);
      if (!target) return;
      const stack = document.getElementById('sticky-stack');
      const offset = stack ? stack.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

function renderComparison() {
  const grid = document.getElementById('compare-grid');
  if (!grid) return;
  const groups = getComparisonRenderGroups();
  grid.innerHTML = groups.map(group => `
    ${group.header ? `
      <div class="compare-section-header" ${group.sectionIndex >= 0 ? `id="${sectionAnchorId(group.sectionIndex)}"` : ''}>
        <span>${escapeAttr(group.header)}</span>
        <span class="compare-count">${group.count}</span>
        ${group.sectionIndex >= 0 && editMode
          ? `
              <div class="compare-section-actions">
                <button class="compare-mini-btn" data-action="move-section-up" data-section="${group.sectionIndex}">Move Up</button>
                <button class="compare-mini-btn" data-action="move-section-down" data-section="${group.sectionIndex}">Move Down</button>
                <button class="compare-mini-btn ghost" data-action="combine-selected" data-section="${group.sectionIndex}">Combine Selected</button>
              </div>
            `
          : ''
        }
      </div>
    ` : ''}
    ${group.items.map(({ item, index: itemIndex, sectionIndex, sectionName }) => {
      const itemId = item._id;
      const currents = splitCurrents(item);
      const rows = currents.map((cur, curIndex) => {
        const isGroup = currents.length > 1;
        const groupPos = curIndex === 0 ? 'first' : (curIndex === currents.length - 1 ? 'last' : 'mid');
        const rowClass = curIndex === 0
          ? `compare-row ${isGroup ? 'compare-row-group compare-row-group-' + groupPos : 'compare-row-single'}`
          : `compare-row compare-row-dup compare-row-group compare-row-group-${groupPos}`;
        const labelHtml = curIndex === 0
          ? `
            <div class="compare-label ${editMode ? 'compare-label-selectable' : ''}" ${editMode ? `data-action="toggle-select-item" data-section="${sectionIndex}" data-item-id="${itemId}"` : ''}>
              ${editMode
            ? `
                    <div class="compare-label-editor">
                      <label class="compare-select-row">
                        <input type="checkbox" data-action="select-item" data-section="${sectionIndex}" data-item-id="${itemId}" ${selectedItems.has(itemId) ? 'checked' : ''}>
                        <span>Select</span>
                      </label>
                      <input type="text" autocomplete="off" spellcheck="false" data-field="label" data-section="${sectionIndex}" data-item-id="${itemId}" value="${escapeAttr(item.label)}">
                      <input type="text" autocomplete="off" spellcheck="false" data-field="usage" data-section="${sectionIndex}" data-item-id="${itemId}" value="${escapeAttr(item.usage)}">
                    </div>
                  `
            : `
                    <div class="compare-label-name">${escapeAttr(item.label)}</div>
                    <div class="compare-label-usage">${escapeAttr(item.usage)}</div>
                  `
          }
            </div>
          `
          : `
            <div class="compare-label">
              <div class="compare-dup-indicator">↳</div>
            </div>
          `;
        const curRepo = splitCurrentRepos(item)[curIndex] || '';
        const currentMetaHtml = editMode
          ? `
            <div class="compare-current-editor">
              <div class="compare-current-row">
                <input type="text" autocomplete="off" spellcheck="false" data-field="current" data-section="${sectionIndex}" data-item-id="${itemId}" data-cur="${curIndex}" value="${escapeAttr(cur.name)}">
                <input type="text" autocomplete="off" spellcheck="false" data-field="currentLib" data-section="${sectionIndex}" data-item-id="${itemId}" data-cur="${curIndex}" value="${escapeAttr(cur.lib)}">
                <select class="compare-mini-select" data-action="set-current-repo" data-section="${sectionIndex}" data-item-id="${itemId}" data-cur="${curIndex}" title="Repo override (fixes Unknown Repo)">
                  <option value="" ${!curRepo ? 'selected' : ''}>Auto</option>
                  ${DATASET_LIST.map(d => `<option value="${escapeAttr(d.key)}" ${curRepo === d.key ? 'selected' : ''}>${escapeAttr(getRepoDisplayMeta(d.key).shortLabel)}</option>`).join('')}
                </select>
                <button class="compare-mini-btn" data-action="remove-current" data-section="${sectionIndex}" data-item-id="${itemId}" data-cur="${curIndex}" ${currents.length === 1 ? 'disabled' : ''}>Remove</button>
              </div>
              ${curIndex === 0
                ? `
                  <div class="compare-current-actions">
                    <button class="compare-mini-btn ghost" data-action="add-current" data-section="${sectionIndex}" data-item-id="${itemId}">Add Current Line</button>
                    <button class="compare-mini-btn" data-action="combine-current" data-section="${sectionIndex}" data-item-id="${itemId}">Combine Lines</button>
                  </div>
                `
                : ''
              }
            </div>
          `
          : `
            <div class="compare-icon-meta">
              <div class="compare-icon-name">${escapeAttr(cur.name)}</div>
              <div class="compare-icon-lib">${escapeAttr(cur.lib)}</div>
              <div class="compare-usage-inline">
                ${renderUsageBadge(cur.name, cur.lib)}
                ${renderUsageList(cur.name, cur.lib)}
              </div>
            </div>
          `;
        const showProposed = curIndex === 0;
        // ... inside the editMode check for proposedHtml
        const proposedHtml = showProposed
          ? (editMode
            ? `
        <div class="compare-edit-fields">
          <label>Proposed</label>
          <input type="text" autocomplete="off" spellcheck="false" data-field="proposed" data-section="${sectionIndex}" data-item-id="${itemId}" value="${escapeAttr(item.proposed)}">
          <label>Library</label>
          <select class="compare-mini-select" data-action="set-proposed-lib" data-section="${sectionIndex}" data-item-id="${itemId}">
            <option value="lucide-react" ${item.proposedLib === 'lucide-react' ? 'selected' : ''}>Lucide</option>
            <option value="lucide-lab" ${item.proposedLib === 'lucide-lab' ? 'selected' : ''}>Lucide Lab</option>
            <option value="custom-svg" ${item.proposedLib === 'custom-svg' ? 'selected' : ''}>Custom SVG</option>
          </select>
          <label>Emoji</label>
          <input type="text" autocomplete="off" spellcheck="false" data-field="emoji" data-section="${sectionIndex}" data-item-id="${itemId}" value="${escapeAttr(item.emoji || '')}" maxlength="3">

          <div class="compare-edit-actions">
            <button class="compare-mini-btn upload-btn" onclick="triggerSvgUpload('${itemId}')" title="Upload Custom SVG">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Upload SVG
            </button>

            <button class="compare-mini-btn ghost" data-action="duplicate-item" data-section="${sectionIndex}" data-item-id="${itemId}">Duplicate Item</button>
            <button class="compare-mini-btn" data-action="move-up" data-section="${sectionIndex}" data-item-id="${itemId}">Move Up</button>
            <button class="compare-mini-btn" data-action="move-down" data-section="${sectionIndex}" data-item-id="${itemId}">Move Down</button>

            <select class="compare-mini-select" data-action="move-section" data-section="${sectionIndex}" data-item-id="${itemId}">
              ${comparisons.map((s, idx) => `<option value="${idx}" ${idx === sectionIndex ? 'selected' : ''}>${escapeAttr(s.section)}</option>`).join('')}
            </select>
          </div>
        </div>
      `
            : `
                <div class="compare-icon-meta">
                  <div class="compare-icon-name">${escapeAttr(item.proposed)}</div>
                  <div class="compare-icon-lib">${escapeAttr(item.proposedLib)}</div>
                </div>
              `)
          : `
              <div class="compare-icon-meta muted"></div>
            `;
        return `
          <div class="${rowClass}">
            ${labelHtml}
            <div class="compare-current ${editMode ? 'compare-current-edit' : ''}">
              ${renderCurrentIconStack(cur.name, cur.lib, item.emoji, curRepo)}
              ${currentMetaHtml}
            </div>
            <div class="compare-proposed ${editMode && showProposed ? 'compare-proposed-edit' : ''}">
              ${showProposed ? `<div class="compare-icon-box proposed">${proposedIconHtml(item)}</div>` : ''}
              ${proposedHtml}
            </div>
          </div>
        `;
      }).join('');
      return `<div class="compare-item-wrapper">${rows}</div>`;
    }).join('')}
`).join('');

  if (window.lucide) lucide.createIcons();
  inlineSvgPreviews();
  inlineSourceSvgs();

  if (!editMode) {
    selectedItems = new Set();
  }

  renderComparisonJumpBar();
  renderProposedGrid();
}

function getComparisonRenderGroups() {
  if (comparisonSort.scope === 'all') {
    const items = comparisons.flatMap((section, sectionIndex) =>
      (Array.isArray(section.items) ? section.items : []).map((item, index) => ({
        item,
        index,
        sectionIndex,
        sectionName: section.section || '',
        repoKey: 'all'
      }))
    );
    return [{
      header: 'All Repos',
      sectionIndex: -1,
      count: items.length,
      items: getSortedComparisonEntries(items)
    }];
  }

  if (comparisonSort.scope === 'repo') {
    const repoGroups = new Map();
    comparisons.forEach((section, sectionIndex) => {
      const items = Array.isArray(section.items) ? section.items : [];
      items.forEach((item, index) => {
        const repoKeys = getItemRepoKeys(item);
        const targets = repoKeys.length ? repoKeys : ['unknown'];
        targets.forEach(repoKey => {
          if (!repoGroups.has(repoKey)) repoGroups.set(repoKey, []);
          repoGroups.get(repoKey).push({
            item,
            index,
            sectionIndex,
            sectionName: section.section || '',
            repoKey
          });
        });
      });
    });

    return Array.from(repoGroups.entries()).map(([repoKey, items]) => ({
      header: getRepoLabelForGroup(repoKey),
      sectionIndex: -1,
      count: items.length,
      items: getSortedComparisonEntries(items)
    }));
  }

  return comparisons.map((section, sectionIndex) => {
    const items = (Array.isArray(section.items) ? section.items : []).map((item, index) => ({
      item,
      index,
      sectionIndex,
      sectionName: section.section || '',
      repoKey: null
    }));
    return {
      header: section.section || '',
      sectionIndex,
      count: items.length,
      items: getSortedComparisonEntries(items)
    };
  });
}

function getItemRepoKeys(item) {
  const seen = new Set();
  const repos = splitCurrentRepos(item);
  splitCurrents(item).forEach((cur, i) => {
    const override = repos[i] || '';
    if (override) {
      seen.add(override);
    } else {
      getUsageLocations(cur.name, cur.lib).forEach(u => {
        const repo = String(u.repo || '').trim();
        if (repo) seen.add(repo);
      });
    }
  });
  return Array.from(seen);
}

function getRepoLabelForGroup(repoKey) {
  if (!repoKey || repoKey === 'unknown') return 'Unknown Repo';
  return getRepoDisplayMeta(repoKey).shortLabel;
}

function renderRepoBadges(name, lib, repoOverride) {
  let repos;
  if (repoOverride) {
    repos = [repoOverride];
  } else {
    repos = Array.from(new Set(
      getUsageLocations(name, lib)
        .map(u => String(u.repo || '').trim())
        .filter(Boolean)
    ));
  }
  if (!repos.length) return '';
  return `
    <div class="compare-repo-tags">
      ${repos.map(repo => {
        const meta = getRepoDisplayMeta(repo);
        return `<span class="compare-repo-tag" style="--repo-color:${escapeAttr(meta.color)};--repo-bg:${escapeAttr(meta.bg)}">${escapeAttr(meta.shortLabel)}</span>`;
      }).join('')}
    </div>
  `;
}

function renderCurrentIconStack(name, lib, emoji, repoOverride) {
  return `
    <div class="compare-current-stack">
      <div class="compare-icon-box">${currentIconHtml(name, lib, emoji)}</div>
      ${renderRepoBadges(name, lib, repoOverride)}
    </div>
  `;
}

function getRepoDisplayMeta(repoKey) {
  const cfg = getRepoConfig(repoKey);
  const shortMap = {
    '3dviewer': 'S3D',
    'portal-fe': 'P-FE',
    'settings-ui': 'SUI'
  };
  return {
    shortLabel: shortMap[repoKey] || cfg.label || repoKey || 'Unknown',
    color: cfg.color || '#2f7de1',
    bg: cfg.bg || 'rgba(47, 125, 225, 0.12)'
  };
}

function getSortedComparisonEntries(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (!comparisonSort.key) return safeEntries;
  return safeEntries.slice().sort((a, b) => {
    if (comparisonSort.key === 'name') {
      const av = String(a.item.label || '').toLowerCase();
      const bv = String(b.item.label || '').toLowerCase();
      if (av < bv) return -comparisonSort.dir;
      if (av > bv) return comparisonSort.dir;
      return 0;
    }
    if (comparisonSort.key === 'proposed') {
      const av = String(a.item.proposed || '').toLowerCase();
      const bv = String(b.item.proposed || '').toLowerCase();
      if (av < bv) return -comparisonSort.dir;
      if (av > bv) return comparisonSort.dir;
      const al = String(a.item.label || '').toLowerCase();
      const bl = String(b.item.label || '').toLowerCase();
      if (al < bl) return -comparisonSort.dir;
      if (al > bl) return comparisonSort.dir;
      return 0;
    }
    if (comparisonSort.key === 'multi') {
      const am = splitCurrents(a.item).length > 1 ? 1 : 0;
      const bm = splitCurrents(b.item).length > 1 ? 1 : 0;
      if (am !== bm) return (bm - am) * comparisonSort.dir;
      const av = String(a.item.label || '').toLowerCase();
      const bv = String(b.item.label || '').toLowerCase();
      if (av < bv) return -comparisonSort.dir;
      if (av > bv) return comparisonSort.dir;
      return 0;
    }
    return 0;
  });
}

function renderUsageBadge(name, lib) {
  const uses = getUsageLocations(name, lib);
  const label = `${uses.length} use${uses.length === 1 ? '' : 's'}`;
  if (!uses.length) {
    return `<div class="compare-usage-count muted">${label}</div>`;
  }
  const tooltip = uses.map(u => formatRepoFileLine(u)).join('\n');
  return `<div class="compare-usage-count" title="${escapeAttr(tooltip)}">${label}</div>`;
}

function renderUsageList(name, lib) {
  const uses = getUsageLocations(name, lib);
  if (!uses.length) return '';
  const max = 4;
  const items = uses.slice(0, max).map(u => {
    const fileName = getFileComponent(u.file);
    const repoPrefix = u.repoLabel || u.repo || 'repo';
    const fullPath = formatRepoFileLine(u);
    const lineSuffix = u.line ? `:${u.line}` : '';
    return `<div class="compare-usage-item" title="${escapeAttr(fullPath)}">${escapeAttr(repoPrefix)}/${escapeAttr(fileName)}${lineSuffix}</div>`;
  });
  const remaining = uses.length - max;
  if (remaining > 0) {
    items.push(`<div class="compare-usage-more">+${remaining} more</div>`);
  }
  return `
    <details class="compare-usage-details">
      <summary>Locations</summary>
      <div class="compare-usage-list">${items.join('')}</div>
    </details>
  `;
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function generateUsageFromLocations(locations) {
  const counts = new Map();
  const add = label => counts.set(label, (counts.get(label) || 0) + 1);
  locations.forEach(u => {
    const path = String(u.file || '').replace(/\\/g, '/');
    let matched = false;
    const parts = path.split('/').filter(Boolean);
    const partsLower = parts.map(p => p.toLowerCase());
    const file = parts[parts.length - 1] || '';
    const fileName = file.replace(/\.[^/.]+$/, '');

    const buildDetail = (baseIndex, prefix) => {
      const next = parts[baseIndex + 1] || '';
      const nextName = next && !next.includes('.') ? next : fileName;
      if (nextName) {
        return `${prefix}${toTitleCase(parts[baseIndex])} > ${toTitleCase(nextName)}`;
      }
      return `${prefix}${toTitleCase(parts[baseIndex])}`;
    };

    const focusKeys = ['pane', 'toolbar', 'sidebar', 'nav', 'layers', 'widget', 'menu', 'dropdown', 'overlay', 'viewer', 'viewport'];
    for (const key of focusKeys) {
      const idx = partsLower.findIndex(p => p.startsWith(key));
      if (idx >= 0) {
        const prefix = key === 'pane' ? 'Pane: ' : '';
        add(buildDetail(idx, prefix));
        matched = true;
        break;
      }
    }

    const paneIndex = parts.findIndex(p => /^pane/i.test(p));
    if (paneIndex >= 0) {
      const pane = parts[paneIndex];
      const next = parts[paneIndex + 1] || '';
      const paneName = pane.replace(/^pane/i, '').trim() || next;
      if (paneName) {
        add(`Pane: ${toTitleCase(paneName.replace(/\.tsx?$/i, ''))}`);
        matched = true;
      } else {
        add('Pane');
        matched = true;
      }
    }
    if (!matched) {
      for (const rule of USAGE_KEYWORDS) {
        if (rule.pattern.test(path)) {
          add(rule.label);
          matched = true;
          break;
        }
      }
    }
    if (!matched && path) {
      if (fileName) add(toTitleCase(fileName));
    }
  });
  if (!counts.size) return '';
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label)
    .join(', ');
}

function isPathLike(text) {
  const t = String(text || '').toLowerCase();
  return t.includes('/') || t.includes('\\') || t.includes('.tsx') || t.includes('.ts') || t.includes('.jsx') || t.includes('.js');
}

function isGenericUsage(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.includes(',') || t.includes('>')) return false;
  return /^(Pane|Toolbar|Sidebar|Navigation|Menu|Dropdown|Modal|Table|Form|Button|Layers|Tree|Widget|Settings|Export|Import|Calendar|Album|Map|Overlay|Viewer)$/i.test(t);
}

function applyGeneratedUsage(forceAll = false) {
  let updated = false;
  comparisons.forEach(section => {
    const items = Array.isArray(section.items) ? section.items : [];
    items.forEach(item => {
      if (!forceAll && !isPathLike(item.usage) && !isGenericUsage(item.usage)) return;
      const currents = splitCurrents(item);
      const allUses = currents.flatMap(cur => getUsageLocations(cur.name, cur.lib));
      const summary = generateUsageFromLocations(allUses);
      if (summary) {
        item.usage = summary;
        updated = true;
      }
    });
  });
  if (updated) {
    saveComparisons();
    renderComparison();
  }
}
