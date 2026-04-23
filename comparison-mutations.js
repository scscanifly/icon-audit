// comparison-mutations.js — Comparison item/section CRUD, move, sort, and merge operations

function updateCurrentEntry(sectionIndex, itemIndex, curIndex, field, value) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  const entries = splitCurrents(item);
  if (!entries[curIndex]) return;

  // Update data
  if (field === 'current') entries[curIndex].name = value;
  if (field === 'currentLib') entries[curIndex].lib = value;
  item.current = entries.map(e => e.name).join(' / ');
  item.currentLib = entries.map(e => e.lib).join(' + ');

  saveComparisons();

  const fieldEl = document.querySelector(`[data-item-id="${item._id}"]`);
  const rowElement = fieldEl ? fieldEl.closest('.compare-row') : null;
  if (rowElement) {
    const currentIconBox = rowElement.querySelector('.compare-current .compare-icon-box');
    if (currentIconBox) {
      currentIconBox.innerHTML = currentIconHtml(item.current, item.currentLib, item.emoji);
      if (window.lucide) lucide.createIcons();
    }
  }
}

function addCurrentEntry(sectionIndex, itemIndex) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  const entries = splitCurrents(item);
  entries.push({ name: '', lib: '' });
  item.current = entries.map(e => e.name).join(' / ');
  item.currentLib = entries.map(e => e.lib).join(' + ');
  saveComparisons();
  renderComparison();
}

function removeCurrentEntry(sectionIndex, itemIndex, curIndex) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  const entries = splitCurrents(item);
  if (entries.length <= 1) return;
  entries.splice(curIndex, 1);
  item.current = entries.map(e => e.name).join(' / ');
  item.currentLib = entries.map(e => e.lib).join(' + ');
  saveComparisons();
  renderComparison();
}

function duplicateItem(sectionIndex, itemIndex) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  const clone = JSON.parse(JSON.stringify(item));
  clone._id = newItemId();
  section.items.splice(itemIndex + 1, 0, clone);
  saveComparisons();
  renderComparison();
}

function combineCurrentEntries(sectionIndex, itemIndex) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  const entries = splitCurrents(item);
  if (entries.length <= 1) return;
  const name = entries.map(e => e.name).filter(Boolean).join(' / ');
  const lib = entries.map(e => e.lib).filter(Boolean).join(' + ');
  item.current = name || item.current;
  item.currentLib = lib || item.currentLib;
  saveComparisons();
  renderComparison();
}

function moveItem(sectionIndex, itemIndex, delta) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const items = section.items;
  const newIndex = itemIndex + delta;
  if (newIndex < 0 || newIndex >= items.length) return;
  const [item] = items.splice(itemIndex, 1);
  items.splice(newIndex, 0, item);
  saveComparisons();
  renderComparison();
}

function moveItemToSection(sectionIndex, itemIndex, newSectionIndex) {
  if (sectionIndex === newSectionIndex) return;
  if (!comparisons[newSectionIndex]) return;
  const source = comparisons[sectionIndex];
  if (!source || !source.items || itemIndex < 0 || itemIndex >= source.items.length) return;
  const item = source.items[itemIndex];
  source.items.splice(itemIndex, 1);
  comparisons[newSectionIndex].items.push(item);
  saveComparisons();
  renderComparison();
}

function moveSelectedItemsToSection(newSectionIndex) {
  if (!comparisons[newSectionIndex] || !selectedItems.size) return;
  const moves = [];
  comparisons.forEach((section, sectionIndex) => {
    const items = Array.isArray(section.items) ? section.items : [];
    items.forEach((item, itemIndex) => {
      if (!item || !selectedItems.has(item._id)) return;
      if (sectionIndex === newSectionIndex) return;
      moves.push({ sectionIndex, itemIndex, item });
    });
  });
  if (!moves.length) return;
  moves.sort((a, b) => {
    if (a.sectionIndex !== b.sectionIndex) return b.sectionIndex - a.sectionIndex;
    return b.itemIndex - a.itemIndex;
  });
  moves.forEach(({ sectionIndex, itemIndex, item }) => {
    comparisons[sectionIndex].items.splice(itemIndex, 1);
    comparisons[newSectionIndex].items.push(item);
  });
  selectedItems = new Set();
  saveComparisons();
  renderComparison();
}

function setCurrentRepo(sectionIndex, itemIndex, curIndex, repo) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  const currents = splitCurrents(item);
  const repos = splitCurrentRepos(item);
  const repoArr = currents.map((_, i) => repos[i] || '');
  repoArr[curIndex] = String(repo || '').trim();
  item.currentRepo = repoArr.join(' / ');
  saveComparisons();
  renderComparison();
}

function setProposedLib(sectionIndex, itemIndex, lib) {
  const section = comparisons[sectionIndex];
  if (!section || !section.items || itemIndex < 0 || itemIndex >= section.items.length) return;
  const item = section.items[itemIndex];
  if (!item) return;
  item.proposedLib = lib;
  saveComparisons();
  renderComparison();
}

function toggleComparisonSort(key) {
  if (comparisonSort.key === key) {
    comparisonSort.dir *= -1;
  } else {
    comparisonSort.key = key;
    comparisonSort.dir = 1;
  }
  selectedItems = new Set();
  renderComparison();
  updateSortButtons();
}

function toggleComparisonSortScope() {
  const order = ['repo', 'section', 'all'];
  const currentIndex = order.indexOf(comparisonSort.scope);
  comparisonSort.scope = order[(currentIndex + 1) % order.length];
  selectedItems = new Set();
  renderComparison();
  updateSortButtons();
}

function updateSortButtons() {
  const nameBtn = document.getElementById('btn-sort-name');
  const proposedBtn = document.getElementById('btn-sort-proposed');
  const multiBtn = document.getElementById('btn-sort-multi');
  const scopeBtn = document.getElementById('btn-sort-scope');
  if (scopeBtn) {
    scopeBtn.classList.toggle('active', comparisonSort.scope !== 'section');
    scopeBtn.textContent = comparisonSort.scope === 'repo'
      ? 'Sort Scope: Repo'
      : comparisonSort.scope === 'all'
        ? 'Sort Scope: All Repos'
        : 'Sort Scope: Section';
  }
  if (nameBtn) {
    nameBtn.classList.toggle('active', comparisonSort.key === 'name');
    nameBtn.textContent = comparisonSort.key === 'name'
      ? `Sort: Name ${comparisonSort.dir === 1 ? '↑' : '↓'}`
      : 'Sort: Name';
  }
  if (proposedBtn) {
    proposedBtn.classList.toggle('active', comparisonSort.key === 'proposed');
    proposedBtn.textContent = comparisonSort.key === 'proposed'
      ? `Sort: Proposed ${comparisonSort.dir === 1 ? '↑' : '↓'}`
      : 'Sort: Proposed';
  }
  if (multiBtn) {
    multiBtn.classList.toggle('active', comparisonSort.key === 'multi');
    multiBtn.textContent = comparisonSort.key === 'multi'
      ? `Sort: Multi ${comparisonSort.dir === 1 ? '↑' : '↓'}`
      : 'Sort: Multi';
  }
}

function mergeDuplicatesByCurrent() {
  const keyFor = (name, lib) => `${String(name || '').trim().toLowerCase()}||${String(lib || '').trim().toLowerCase()}`;
  comparisons.forEach(section => {
    const map = new Map();
    const newItems = [];
    section.items.forEach(item => {
      const currents = splitCurrents(item);
      const primary = currents[0] || { name: item.current, lib: item.currentLib };
      const key = keyFor(primary.name, primary.lib);
      if (!map.has(key)) {
        map.set(key, { item, currents: [...currents] });
        newItems.push(item);
        return;
      }
      const target = map.get(key);
      const usageTokens = new Set(
        String(target.item.usage || '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
      );
      String(item.usage || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .forEach(t => usageTokens.add(t));
      target.item.usage = Array.from(usageTokens).join(', ');
      const combinedCurrents = target.currents.concat(currents);
      target.currents = combinedCurrents;
      target.item.current = combinedCurrents.map(c => c.name).filter(Boolean).join(' / ');
      target.item.currentLib = combinedCurrents.map(c => c.lib).filter(Boolean).join(' + ');
    });
    section.items = newItems;
  });
  saveComparisons();
  renderComparison();
}

function moveSection(sectionIndex, delta) {
  const newIndex = sectionIndex + delta;
  if (newIndex < 0 || newIndex >= comparisons.length) return;
  const [section] = comparisons.splice(sectionIndex, 1);
  comparisons.splice(newIndex, 0, section);
  saveComparisons();
  renderComparison();
}

function combineSelectedItems(sectionIndex) {
  const items = comparisons[sectionIndex]?.items || [];
  const selected = [];
  const hasCrossSection = Array.from(selectedItems).some(id => {
    const idx = findSectionIndexByItemId(id);
    return idx >= 0 && idx !== sectionIndex;
  });
  if (hasCrossSection) return;
  for (const id of selectedItems) {
    const idx = items.findIndex(it => it._id === id);
    if (idx >= 0) selected.push({ index: idx, item: items[idx] });
  }
  if (selected.length < 2) return;
  selected.sort((a, b) => a.index - b.index);
  const base = selected[0].item;
  const suggested = base.label || 'Combined';
  const newLabel = prompt('New label for combined item:', suggested);
  if (newLabel === null) return;
  if (newLabel.trim()) base.label = newLabel.trim();
  const currents = [];
  const libs = [];
  const usageTokens = new Set();
  selected.forEach(({ item }) => {
    currents.push(item.current);
    libs.push(item.currentLib);
    String(item.usage || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .forEach(t => usageTokens.add(t));
  });
  base.current = currents.filter(Boolean).join(' / ');
  base.currentLib = libs.filter(Boolean).join(' + ');
  if (usageTokens.size) {
    base.usage = Array.from(usageTokens).join(', ');
  }
  for (let i = selected.length - 1; i >= 1; i--) {
    items.splice(selected[i].index, 1);
  }
  selectedItems = new Set();
  saveComparisons();
  renderComparison();
}
