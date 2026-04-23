// icon-preview.js — Icon mapping and preview HTML rendering across icon types

// ── React Icons → Iconify set mapping ────────────────────────
// Vsc must come first (3-char prefix) before 2-char entries
const RI_ICONIFY = {
  'Vsc': 'vscode-icons',
  'Ai': 'ant-design',
  'Bi': 'bi',
  'Bs': 'bi',
  'Ci': 'ci',
  'Di': 'devicon',
  'Fa': 'fa-solid',
  'Fc': 'flat-color-icons',
  'Fi': 'feather',
  'Gi': 'game-icons',
  'Go': 'octicon',
  'Gr': 'grommet-icons',
  'Hi': 'heroicons',
  'Im': 'icomoon-free',
  'Io': 'ion',
  'Lu': 'lucide',
  'Md': 'mdi',
  'Pi': 'ph',
  'Ri': 'ri',
  'Rx': 'radix-icons',
  'Si': 'simple-icons',
  'Sl': 'sl',
  'Tb': 'tabler',
  'Ti': 'ti',
  'Wi': 'wi',
};

const GO_ICONIFY_OVERRIDES = {
  GoBackButton: 'octicon:arrow-left-16',
  GoBackIcon: 'octicon:arrow-left-16',
};

const FA_UNICODE_MAP = {
  'f107': 'angle-down',
  'f105': 'angle-right',
  'f00d': 'times',
  'f111': 'circle',
};

function sanitizePreviewSvgMarkup(svgText) {
  const raw = String(svgText || '').trim();
  if (!raw || !raw.startsWith('<svg')) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'image/svg+xml');
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
    const serialized = new XMLSerializer().serializeToString(svg);
    if (!isRenderableSvgMarkup(serialized)) return null;
    return maybeRecolorSvgText(serialized);
  } catch (err) {
    return null;
  }
}

function inlineSvgMarkupHtml(svgText, fallback = '•') {
  const sanitized = sanitizePreviewSvgMarkup(svgText);
  if (!sanitized) {
    return `<span style="font-size:15px;line-height:1">${fallback}</span>`;
  }
  return `<span class="ctx-inline-holder">${sanitized}</span>`;
}

function reactIconToIconify(name, library) {
  const original = name;
  if (GO_ICONIFY_OVERRIDES[original]) {
    return GO_ICONIFY_OVERRIDES[original];
  }
  if (name.endsWith('Icon') && name.length > 4) {
    name = name.slice(0, -4);
  }

  if (GO_ICONIFY_OVERRIDES[name]) {
    return GO_ICONIFY_OVERRIDES[name];
  }
  // FA6 — library field tells us the package even though component prefix is still 'Fa'
  if (library && library.includes('fa6')) {
    if (name.startsWith('FaReg')) {
      return `fa6-regular:${toKebab(name.slice(5))}`;
    }
    return `fa6-solid:${toKebab(name.slice(2))}`;
  }
  if (name.startsWith('FaReg')) {
    return `fa-regular:${toKebab(name.slice(5))}`;
  }
  // Material Design variant prefixes: react-icons puts variant first (MdOutlineName),
  // but Iconify uses Google Material Icons set with variant last (ic:outline-name)
  if (name.startsWith('MdOutline')) return `ic:outline-${toKebab(name.slice(9))}`;
  if (name.startsWith('MdRound')) return `ic:round-${toKebab(name.slice(7))}`;
  if (name.startsWith('MdSharp')) return `ic:sharp-${toKebab(name.slice(7))}`;
  if (name.startsWith('MdTwoTone')) return `ic:twotone-${toKebab(name.slice(9))}`;
  if (name.startsWith('Md') && name.endsWith('Outline')) {
    return `ic:outline-${toKebab(name.slice(2, -7))}`;
  }
  if (library && library.includes('react-icons/md') && name.startsWith('Md')) {
    return `ic:baseline-${toKebab(name.slice(2))}`;
  }

  for (const [prefix, set] of Object.entries(RI_ICONIFY)) {
    if (name.startsWith(prefix) && name.length > prefix.length && /[A-Z]/.test(name[prefix.length])) {
      if (prefix === 'Go') {
        const base = toKebab(name.slice(prefix.length));
        const oct = /-(\d+)$/.test(base) ? base : `${base}-16`;
        return `octicon:${oct}`;
      }
      return `${set}:${toKebab(name.slice(prefix.length))}`;
    }
  }
  return null;
}

// ── Icon preview for the inventory context column ─────────────
function iconPreview(r) {
  const name = cleanName(r.icon_name);
  const esc = s => escapeAttr(s);

  if (r.type === 'FontAwesome') {
    if (name.startsWith('fa-')) {
      // Use Iconify FA4 set — better coverage than CDN, includes brands
      return `<iconify-icon icon="fa:${name.slice(3)}" width="16" height="16" title="${esc(name)}"></iconify-icon>`;
    }
    // Import-style name (faTrashCan) — convert to Iconify
    if (name.length > 2 && /^fa[A-Z]/.test(name)) {
      const set = r.library && r.library.includes('fa6') ? 'fa6-solid' : 'fa-solid';
      return `<iconify-icon icon="${set}:${toKebab(name.slice(2))}" width="16" height="16" title="${esc(name)}"></iconify-icon>`;
    }
    return `<code class="ctx-code">${esc(name)}</code>`;
  }

  if (r.type === 'ReactIcons') {
    const iconifyId = reactIconToIconify(name, r.library);
    if (iconifyId) {
      return `<iconify-icon icon="${iconifyId}" width="16" height="16" title="${esc(name)}"></iconify-icon>`;
    }
    return `<code class="ctx-code">${esc(name)}</code>`;
  }

  if (r.type === 'SVG_asset') {
    const src = resolveAssetUrl(r.repo, r.file);
    const fallback = esc(r.repoPath || r.file);
    return `<span class="ctx-icon-box">${universalSvgHtml(src, r.repoPath || r.file, fallback)}</span>`;
  }

  if (r.type === 'SVG_import') {
    const path = r.icon_name.includes('→') ? r.icon_name.split('→')[1].trim() : r.icon_name;
    const resolved = resolveSvgPath(path);
    if (resolved) {
      const src = resolveAssetUrl(resolved.repo, resolved.file);
      const fallback = esc(path);
      return `<span class="ctx-icon-box">${universalSvgHtml(src, resolved.file || path, fallback)}</span>`;
    }
    return `<span class="ctx-path" title="${esc(path)}">${esc(path)}</span>`;
  }

  if (r.type === 'SVG_inline') {
    const key = `${r.repo || ''}||${r.file || ''}||${r.line || ''}`;
    const idx = (window.INLINE_SVG_INDEX || {});
    const rel = idx[key];
    if (rel) {
      const src = String(rel).replace(/\\/g, '/');
      return `<span class="ctx-icon-box">${universalSvgHtml(src, src, src)}</span>`;
    }
    const file = escapeAttr(r.file || '');
    const line = escapeAttr(r.line || '');
    return `<span class="ctx-inline-source" data-inline-src="${file}" data-inline-line="${line}" data-inline-repo="${escapeAttr(r.repo || '')}">Loading…</span>`;
  }

  if (r.type === 'SCSS_url') {
    const path = r.icon_name;
    const baseDir = getDirPath(r.file);
    const resolvedPath = resolveRelativePath(baseDir, path);
    if (resolvedPath) {
      const src = resolveAssetUrl(r.repo, resolvedPath);
      return `<span class="ctx-icon-box">${universalSvgHtml(src, resolvedPath, esc(path))}</span>`;
    }
    return `<span class="ctx-path" title="${esc(path)}">${esc(path)}</span>`;
  }

  return r.context ? `<code class="ctx-code">${esc(r.context)}</code>` : '—';
}

// Convert PascalCase icon name to kebab-case for data-lucide attribute
function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Split a combined current field like "MdClose + fa-close (CSS)" or
// "FaSort / FaSortUp / FaSortDown" into individual {name, lib} pairs.
function splitCurrents(item) {
  const current = String((item && item.current) || '');
  const currentLib = String((item && item.currentLib) || '');
  const names = current.split(/ \+ | \/ /);
  if (names.length <= 1) return [{ name: current.trim(), lib: currentLib.trim() }];
  const libs = currentLib.split(/ \+ /);
  return names.map((name, i) => ({
    name: name.trim(),
    lib: (libs[i] || libs[libs.length - 1]).trim(),
  }));
}

function splitCurrentRepos(item) {
  const currents = splitCurrents(item);
  const currentRepo = String((item && item.currentRepo) || '').trim();
  if (!currentRepo) return currents.map(() => '');
  const repos = currentRepo.split(/ \/ /).map(part => part.trim());
  return currents.map((_, i) => repos[i] || '');
}

// Render the current-side icon box for a single {name, lib} entry.
// - FontAwesome CSS items: render <i class="fa fa-name">
// - React-icons: render Iconify (similar to Inventory table)
// - Everything else: fall back to emoji
function currentIconHtml(name, lib, emoji) {
  const primaryName = String(name || '').split(/ \+ | \/ /)[0].replace(/\(.*?\)/g, '').trim();
  const primaryLib = String(lib || '').split(/ \+ /)[0].trim();
  const iconToken = extractIconToken(primaryName);
  const safeTitle = escapeAttr(primaryName);
  const fallback = emoji || '•';

  if (primaryName.startsWith('<svg')) {
    return inlineSvgMarkupHtml(primaryName, fallback);
  }

  if (primaryLib.startsWith('SVG_inline||')) {
    const parts = primaryLib.split('||');
    const inlineRepo = parts[1] || '';
    const inlineFile = parts[2] || '';
    const inlineLine = parts[3] || '';
    const inlineKey = `${inlineRepo}||${inlineFile}||${inlineLine}`;
    const rel = (window.INLINE_SVG_INDEX || {})[inlineKey];
    if (rel) {
      const src = String(rel).replace(/\\/g, '/');
      return universalSvgHtml(src, name, emoji);
    }
    return `<span class="ctx-inline-source" data-inline-src="${escapeAttr(inlineFile)}" data-inline-line="${escapeAttr(inlineLine)}" data-inline-repo="${escapeAttr(inlineRepo)}">⋯</span>`;
  }

  if (primaryLib.includes('SCSS FA unicode')) {
    const uni = primaryName.replace(/^\\f/i, 'f').replace(/^f/i, 'f').toLowerCase();
    const icon = FA_UNICODE_MAP[uni];
    if (icon) {
      return `<iconify-icon icon="fa:${icon}" width="16" height="16" title="${safeTitle}"></iconify-icon>`;
    }
  }

  const faMatch = primaryName.match(/\bfa-([a-z0-9-]+)\b/);
  if (faMatch) {
    if (primaryLib.includes('FontAwesome CSS') || primaryLib.includes('FontAwesome (CSS class)') || primaryLib.includes('FA CSS')) {
      return `<i class="fa fa-${faMatch[1]}"></i>`;
    }
    return `<iconify-icon icon="fa:${faMatch[1]}" width="16" height="16" title="${safeTitle}"></iconify-icon>`;
  }

  const svgPath = resolveSvgPath(primaryName);
  if (svgPath) {
    const src = resolveAssetUrl(svgPath.repo, svgPath.file);
    return universalSvgHtml(src, primaryName, emoji);
  }

  if (primaryName.includes('→')) {
    const parts = primaryName.split('→');
    const pathHint = (parts[1] || '').trim();
    if (pathHint) {
      const svgPathFromHint = resolveSvgPath(pathHint);
      if (svgPathFromHint) {
        const src = resolveAssetUrl(svgPathFromHint.repo, svgPathFromHint.file);
        return universalSvgHtml(src, primaryName, emoji);
      }
    }
  }

  // Hard-mapped fallbacks for known misses
  if (iconToken === 'MdRestartAlt') {
    return `<iconify-icon icon="ic:baseline-restart-alt" width="16" height="16" title="${safeTitle}"></iconify-icon>`;
  }
  if (iconToken === 'FiMinimize2') {
    return `<iconify-icon icon="feather:minimize-2" width="16" height="16" title="${safeTitle}"></iconify-icon>`;
  }

  const iconifyId = reactIconToIconify(iconToken, primaryLib);
  if (iconifyId) {
    return `<iconify-icon icon="${iconifyId}" width="16" height="16" title="${safeTitle}"></iconify-icon>`;
  }

  // FontAwesome component-style (faTrashCan, FaSave, etc.)
  if (/^fa[A-Z]/.test(iconToken) || /^Fa[A-Z]/.test(iconToken)) {
    const set = primaryLib.includes('fa6') ? 'fa6-solid' : 'fa-solid';
    return `<iconify-icon icon="${set}:${toKebab(iconToken.slice(2))}" width="16" height="16" title="${safeTitle}"></iconify-icon>`;
  }

  return `<span style="font-size:15px;line-height:1">${fallback}</span>`;
}

// Render the proposed-side icon box:
// - lucide-react items with a valid PascalCase name: render <i data-lucide="kebab-name">
// - "Keep" / "Remove" / multi-word proposals: fall back to emoji
function proposedIconHtml(item) {
  const fallback = item.emoji || '•';
  const proposedText = String(item.proposed || '').trim();
  if (proposedText.startsWith('<svg')) {
    return inlineSvgMarkupHtml(proposedText, fallback);
  }
  const lib = String(item.proposedLib || '');
  const isLucide = lib === 'lucide-react' || lib.startsWith('lucide-react') || lib === 'lucide-lab' || lib.startsWith('lucide-lab');
  if (!isLucide) {
    const proposedSvgPath = resolveSvgPath(proposedText);
    if (proposedSvgPath) {
      const src = resolveAssetUrl(proposedSvgPath.repo, proposedSvgPath.file);
      return universalSvgHtml(src, proposedText, item.emoji);
    }
    return `<span style="font-size:32px;line-height:1">${fallback}</span>`;
  }
  // Take only the first name if the field contains multiple (e.g. "Undo2 / Redo2")
  const firstName = item.proposed.split(/\s*[/,]\s*/)[0].trim();
  // Allow kebab-case or single-word lowercase names copied from lucide site
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(firstName) || /^[a-z0-9]+$/.test(firstName)) {
    return `<iconify-icon icon="lucide:${escapeAttr(firstName)}"></iconify-icon>`;
  }
  // Must look like a PascalCase component name, not a sentence
  if (!/^[A-Z][A-Za-z0-9]+$/.test(firstName)) {
    return `<span style="font-size:15px;line-height:1">${fallback}</span>`;
  }
  return `<iconify-icon icon="lucide:${escapeAttr(toKebab(firstName))}"></iconify-icon>`;
}
