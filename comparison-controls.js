// comparison-controls.js — Comparison control event wiring, import/export, and CSV parsing

function buildComparisonExport() {
  return comparisons.map(section => ({
    section: section.section,
    items: (section.items || []).map(item => ({
      label: item.label,
      usage: item.usage,
      current: item.current,
      currentLib: item.currentLib,
      currentRepo: item.currentRepo,
      proposed: item.proposed,
      proposedLib: item.proposedLib,
      emoji: item.emoji,
      currentEntries: splitCurrents(item).map((cur, index) => ({
        name: cur.name,
        lib: cur.lib,
        repo: splitCurrentRepos(item)[index] || '',
        usages: getUsageLocations(cur.name, cur.lib).map(u => ({
          file: u.file,
          line: u.line,
          type: u.type,
          library: u.library,
          icon_name: u.icon_name
        }))
      }))
    }))
  }));
}

let addSectionFormOpen = false;
let addItemFormOpen = false;

function updateAddFormVisibility() {
  const sectionForm = document.getElementById('add-section-form');
  const itemForm = document.getElementById('add-item-form');
  const sectionToggle = document.getElementById('btn-add-section-toggle');
  const itemToggle = document.getElementById('btn-add-item-toggle');

  if (sectionForm) {
    const showSectionForm = editMode && addSectionFormOpen;
    sectionForm.classList.toggle('hidden', !showSectionForm);
    sectionForm.classList.toggle('is-open', showSectionForm);
  }
  if (itemForm) {
    const showItemForm = editMode && addItemFormOpen;
    itemForm.classList.toggle('hidden', !showItemForm);
    itemForm.classList.toggle('is-open', showItemForm);
  }
  if (sectionToggle) {
    sectionToggle.classList.toggle('active', editMode && addSectionFormOpen);
    sectionToggle.textContent = editMode && addSectionFormOpen ? 'Hide Section Form' : 'Add Section';
  }
  if (itemToggle) {
    itemToggle.classList.toggle('active', editMode && addItemFormOpen);
    itemToggle.textContent = editMode && addItemFormOpen ? 'Hide Line Item Form' : 'Add Line Item';
  }
}

function updateComparisonControls() {
  const forms = document.getElementById('compare-forms');
  const toggleBtn = document.getElementById('btn-edit-toggle');
  if (forms) forms.classList.toggle('hidden', !editMode);
  if (toggleBtn) toggleBtn.textContent = editMode ? 'Exit Edit Mode' : 'Enable Edit Mode';
  if (!editMode) {
    addSectionFormOpen = false;
    addItemFormOpen = false;
  }
  updateAddFormVisibility();

  const sectionSelect = document.getElementById('item-section');
  if (sectionSelect) {
    sectionSelect.innerHTML = comparisons
      .map((section, idx) => `<option value="${idx}">${escapeAttr(section.section)}</option>`)
      .join('');
  }
  const bulkMoveSelect = document.getElementById('bulk-move-section');
  if (bulkMoveSelect) {
    bulkMoveSelect.innerHTML = comparisons
      .map((section, idx) => `<option value="${idx}">${escapeAttr(section.section)}</option>`)
      .join('');
  }
  const proposedLibInput = document.getElementById('item-proposed-lib');
  if (proposedLibInput && !proposedLibInput.value) {
    proposedLibInput.value = 'lucide-react';
  }
  updateStickySpacer();
}

function setupComparisonControls() {
  if (setupComparisonControls._bound) return;
  setupComparisonControls._bound = true;

  const toggleBtn = document.getElementById('btn-edit-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      editMode = !editMode;
      updateComparisonControls();
      renderComparison();
    });
  }

  const addSectionToggle = document.getElementById('btn-add-section-toggle');
  if (addSectionToggle) {
    addSectionToggle.addEventListener('click', () => {
      if (!editMode) return;
      addSectionFormOpen = !addSectionFormOpen;
      if (addSectionFormOpen) addItemFormOpen = false;
      updateAddFormVisibility();
      updateStickySpacer();
      if (addSectionFormOpen) {
        const input = document.getElementById('section-name');
        if (input) input.focus();
      }
    });
  }

  const addItemToggle = document.getElementById('btn-add-item-toggle');
  if (addItemToggle) {
    addItemToggle.addEventListener('click', () => {
      if (!editMode) return;
      addItemFormOpen = !addItemFormOpen;
      if (addItemFormOpen) addSectionFormOpen = false;
      updateAddFormVisibility();
      updateStickySpacer();
      if (addItemFormOpen) {
        const select = document.getElementById('item-section');
        if (select) select.focus();
      }
    });
  }

  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      comparisons = deepClone(DEFAULT_COMPARISONS);
      ensureItemIds(comparisons);
      saveComparisons();
      updateComparisonControls();
      renderComparison();
    });
  }

  const buildFromInventoryBtn = document.getElementById('btn-build-from-inventory');
  if (buildFromInventoryBtn) {
    buildFromInventoryBtn.addEventListener('click', () => {
      if (!confirm('Build comparison sections from the current inventory filter? This will replace the current comparison list.')) return;
      buildComparisonsFromInventory();
    });
  }

  const exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const payload = JSON.stringify({
        version: 1,
        comparisons: buildComparisonExport()
      }, null, 2);
      downloadFile('icon-audit-comparison.json', 'application/json', payload);
    });
  }

  const generateUsageBtn = document.getElementById('btn-generate-usage');
  if (generateUsageBtn) {
    generateUsageBtn.addEventListener('click', () => {
      applyGeneratedUsage(true);
    });
  }

  const combineSelectedBtn = document.getElementById('btn-combine-selected');
  if (combineSelectedBtn) {
    combineSelectedBtn.addEventListener('click', () => {
      if (!selectedItems.size) return;
      const firstId = Array.from(selectedItems)[0];
      const sectionIndex = findSectionIndexByItemId(firstId);
      if (sectionIndex < 0) return;
      const hasCrossSection = Array.from(selectedItems).some(id => findSectionIndexByItemId(id) !== sectionIndex);
      if (hasCrossSection) {
        alert('Select items from a single section before combining.');
        return;
      }
      combineSelectedItems(sectionIndex);
    });
  }

  const bulkMoveBtn = document.getElementById('btn-bulk-move');
  if (bulkMoveBtn) {
    bulkMoveBtn.addEventListener('click', () => {
      if (!selectedItems.size) return;
      const bulkMoveSelect = document.getElementById('bulk-move-section');
      const targetSectionIndex = bulkMoveSelect ? parseInt(bulkMoveSelect.value, 10) : NaN;
      if (Number.isNaN(targetSectionIndex) || !comparisons[targetSectionIndex]) return;
      moveSelectedItemsToSection(targetSectionIndex);
    });
  }

  const mergeDupBtn = document.getElementById('btn-merge-duplicates');
  if (mergeDupBtn) {
    mergeDupBtn.addEventListener('click', () => {
      mergeDuplicatesByCurrent();
    });
  }

  const sortScopeBtn = document.getElementById('btn-sort-scope');
  if (sortScopeBtn) {
    sortScopeBtn.addEventListener('click', () => {
      toggleComparisonSortScope();
    });
  }

  const sortNameBtn = document.getElementById('btn-sort-name');
  if (sortNameBtn) {
    sortNameBtn.addEventListener('click', () => {
      toggleComparisonSort('name');
    });
  }

  const sortProposedBtn = document.getElementById('btn-sort-proposed');
  if (sortProposedBtn) {
    sortProposedBtn.addEventListener('click', () => {
      toggleComparisonSort('proposed');
    });
  }

  const sortMultiBtn = document.getElementById('btn-sort-multi');
  if (sortMultiBtn) {
    sortMultiBtn.addEventListener('click', () => {
      toggleComparisonSort('multi');
    });
  }

  const exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const rows = [];
      rows.push(['section', 'label', 'usage', 'current', 'currentLib', 'proposed', 'proposedLib', 'emoji', 'usage_locations', 'group_id']);
      comparisons.forEach(section => {
        (section.items || []).forEach(item => {
          const currents = splitCurrents(item);
          currents.forEach(cur => {
            const uses = getUsageLocations(cur.name, cur.lib)
              .map(u => `${u.file}:${u.line}`)
              .join('; ');
            rows.push([
              section.section,
              item.label,
              item.usage,
              cur.name,
              cur.lib,
              item.proposed,
              item.proposedLib,
              item.emoji || '',
              uses
              ,
              item._id || ''
            ]);
          });
        });
      });
      const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
      downloadFile('icon-audit-comparison.csv', 'text/csv', csv);
    });
  }

  const importInput = document.getElementById('compare-import');
  if (importInput) {
    importInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith('.csv')) {
          const parsed = parseComparisonCsv(text);
          if (parsed) {
            comparisons = parsed;
            ensureItemIds(comparisons);
          }
        } else {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            comparisons = parsed.map(section => ({
              ...section,
              items: (section.items || []).map(item => ({
                ...item,
                proposedLib: item.proposedLib || 'lucide-react',
              }))
            }));
            ensureItemIds(comparisons);
          } else if (parsed && Array.isArray(parsed.comparisons)) {
            comparisons = parsed.comparisons.map(section => ({
              ...section,
              items: (section.items || []).map(item => ({
                ...item,
                proposedLib: item.proposedLib || 'lucide-react',
              }))
            }));
            ensureItemIds(comparisons);
          }
        }
        saveComparisons();
        updateComparisonControls();
        renderComparison();
      } catch (err) {
        console.error('Import parse error:', err);
        alert('Import failed. Please check that the file is valid JSON or CSV.');
      } finally {
        e.target.value = '';
      }
    });
  }

  const addSectionForm = document.getElementById('add-section-form');
  if (addSectionForm) {
    addSectionForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('section-name');
      const name = input ? input.value.trim() : '';
      if (!name) return;
      comparisons.push({ section: name, items: [] });
      if (input) input.value = '';
      addSectionFormOpen = false;
      saveComparisons();
      updateComparisonControls();
      renderComparison();
    });
  }

  const addItemForm = document.getElementById('add-item-form');
  if (addItemForm) {
    addItemForm.addEventListener('submit', e => {
      e.preventDefault();
      const sectionIndex = parseInt(document.getElementById('item-section').value, 10);
      const getVal = id => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
      const item = {
        label: getVal('item-label'),
        usage: getVal('item-usage'),
        current: getVal('item-current'),
        currentLib: getVal('item-current-lib'),
        proposed: getVal('item-proposed'),
        proposedLib: getVal('item-proposed-lib') || 'lucide-react',
        emoji: getVal('item-emoji') || '•',
      };
      if (!item.label || !item.usage || !item.current || !item.currentLib || !item.proposed || !item.proposedLib) return;
      if (!comparisons[sectionIndex]) return;
      item._id = newItemId();
      comparisons[sectionIndex].items.push(item);
      ['item-label', 'item-usage', 'item-current', 'item-current-lib', 'item-proposed', 'item-proposed-lib', 'item-emoji'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      addItemFormOpen = false;
      saveComparisons();
      updateComparisonControls();
      renderComparison();
    });
  }

  const grid = document.getElementById('compare-grid');
  if (grid) {
    grid.addEventListener('change', e => {
      const target = e.target;
      if (!target || !target.dataset || !target.dataset.field) return;
      const field = target.dataset.field;
      const sectionIndex = parseInt(target.dataset.section, 10);
      const itemId = target.dataset.itemId;
      const { item, index: itemIndex } = findItem(sectionIndex, itemId);
      if (!item) return;
      if (field === 'current' || field === 'currentLib') {
        const curIndex = parseInt(target.dataset.cur, 10);
        updateCurrentEntry(sectionIndex, itemIndex, curIndex, field, target.value.trim());
      } else {
        item[field] = target.value.trim();
        saveComparisons();
        renderComparison();
      }
    });
    grid.addEventListener('change', e => {
      const target = e.target;
      if (!target || !target.dataset || target.dataset.action !== 'select-item') return;
      const itemId = target.dataset.itemId;
      if (target.checked) selectedItems.add(itemId);
      else selectedItems.delete(itemId);
    });
    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !btn.dataset || !btn.dataset.action) return;
      if (btn.tagName === 'SELECT') return;
      if (btn.dataset.action === 'toggle-select-item') {
        if (e.target.closest('input, textarea, select, button, label')) return;
        const checkbox = btn.querySelector('input[data-action="select-item"]');
        if (!checkbox) return;
        checkbox.checked = !checkbox.checked;
        const itemId = checkbox.dataset.itemId;
        if (checkbox.checked) selectedItems.add(itemId);
        else selectedItems.delete(itemId);
        return;
      }
      const action = btn.dataset.action;
      const sectionIndex = parseInt(btn.dataset.section, 10);
      if (action === 'move-section-up') {
        moveSection(sectionIndex, -1);
        return;
      }
      if (action === 'move-section-down') {
        moveSection(sectionIndex, 1);
        return;
      }
      if (action === 'combine-selected') {
        combineSelectedItems(sectionIndex);
        return;
      }
      const itemId = btn.dataset.itemId;
      const { index: itemIndex } = findItem(sectionIndex, itemId);
      if (itemIndex < 0) return;
      if (action === 'add-current') {
        addCurrentEntry(sectionIndex, itemIndex);
      }
      if (action === 'remove-current') {
        const curIndex = parseInt(btn.dataset.cur, 10);
        removeCurrentEntry(sectionIndex, itemIndex, curIndex);
      }
      if (action === 'duplicate-item') {
        duplicateItem(sectionIndex, itemIndex);
      }
      if (action === 'move-up') {
        moveItem(sectionIndex, itemIndex, -1);
      }
      if (action === 'move-down') {
        moveItem(sectionIndex, itemIndex, 1);
      }
      if (action === 'combine-current') {
        combineCurrentEntries(sectionIndex, itemIndex);
      }
    });
    grid.addEventListener('change', e => {
      const target = e.target;
      if (!target || !target.dataset || target.dataset.action !== 'move-section') return;
      const sectionIndex = parseInt(target.dataset.section, 10);
      const itemId = target.dataset.itemId;
      const { index: itemIndex } = findItem(sectionIndex, itemId);
      const newSectionIndex = parseInt(target.value, 10);
      if (itemIndex < 0 || Number.isNaN(newSectionIndex) || !comparisons[newSectionIndex]) return;
      moveItemToSection(sectionIndex, itemIndex, newSectionIndex);
    });
    grid.addEventListener('change', e => {
      const target = e.target;
      if (!target || !target.dataset || target.dataset.action !== 'set-current-repo') return;
      const sectionIndex = parseInt(target.dataset.section, 10);
      const itemId = target.dataset.itemId;
      const curIndex = parseInt(target.dataset.cur, 10);
      if (Number.isNaN(sectionIndex) || !itemId || Number.isNaN(curIndex)) return;
      const { index: itemIndex } = findItem(sectionIndex, itemId);
      if (itemIndex < 0) return;
      setCurrentRepo(sectionIndex, itemIndex, curIndex, target.value);
    });
    grid.addEventListener('change', e => {
      const target = e.target;
      if (!target || !target.dataset || target.dataset.action !== 'set-proposed-lib') return;
      const sectionIndex = parseInt(target.dataset.section, 10);
      const itemId = target.dataset.itemId;
      const lib = target.value || '';
      if (Number.isNaN(sectionIndex) || !itemId || !lib) return;
      const { index: itemIndex } = findItem(sectionIndex, itemId);
      if (itemIndex < 0) return;
      setProposedLib(sectionIndex, itemIndex, lib);
    });
  }
}

function parseComparisonCsv(text) {
  const rows = parseCsv(text);
  if (!rows || rows.length < 2) return null;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    section: header.indexOf('section'),
    label: header.indexOf('label'),
    usage: header.indexOf('usage'),
    current: header.indexOf('current'),
    currentLib: header.indexOf('currentlib'),
    proposed: header.indexOf('proposed'),
    proposedLib: header.indexOf('proposedlib'),
    emoji: header.indexOf('emoji'),
    groupId: header.indexOf('group_id'),
  };
  if (idx.section < 0 || idx.label < 0 || idx.usage < 0 || idx.current < 0 || idx.currentLib < 0 || idx.proposed < 0 || idx.proposedLib < 0) {
    return null;
  }
  const sectionMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sectionName = (r[idx.section] || '').trim();
    if (!sectionName) continue;
    if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, new Map());
    const groupId = idx.groupId >= 0 ? (r[idx.groupId] || '').trim() : '';
    const label = (r[idx.label] || '').trim();
    const usage = (r[idx.usage] || '').trim();
    const proposed = (r[idx.proposed] || '').trim();
    const proposedLib = (r[idx.proposedLib] || '').trim() || 'lucide-react';
    const emoji = (idx.emoji >= 0 ? (r[idx.emoji] || '').trim() : '') || '•';
    const fallbackKey = [label, usage, proposed, proposedLib, emoji].join('||');
    const itemKey = groupId ? `gid:${groupId}` : `f:${fallbackKey}`;
    const groupMap = sectionMap.get(sectionName);
    if (!groupMap.has(itemKey)) {
      groupMap.set(itemKey, {
        _id: groupId || undefined,
        label,
        usage,
        proposed,
        proposedLib,
        emoji,
        currents: [],
      });
    }
    const cur = (r[idx.current] || '').trim();
    const curLib = (r[idx.currentLib] || '').trim();
    if (cur) {
      const key = `${cur}||${curLib}`;
      const bucket = groupMap.get(itemKey);
      if (!bucket._seen) bucket._seen = new Set();
      if (!bucket._seen.has(key)) {
        bucket._seen.add(key);
        bucket.currents.push({ name: cur, lib: curLib });
      }
    }
  }
  return Array.from(sectionMap.entries()).map(([section, groupMap]) => {
    const items = Array.from(groupMap.values()).map(bucket => {
      const names = bucket.currents.map(c => c.name).filter(Boolean);
      const libs = bucket.currents.map(c => c.lib).filter(Boolean);
      const current = names.length ? names.join(' + ') : '';
      const currentLib = libs.length ? libs.join(' + ') : '';
      const item = {
        label: bucket.label,
        usage: bucket.usage,
        current,
        currentLib,
        proposed: bucket.proposed,
        proposedLib: bucket.proposedLib,
        emoji: bucket.emoji,
      };
      if (bucket._id) item._id = bucket._id;
      return item;
    });
    return { section, items };
  });
}
