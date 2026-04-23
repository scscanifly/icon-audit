// utils.js — Path/string helpers, icon lookup utilities, and CSV/download helpers

function getFileComponent(file) {
  const parts = String(file || '').replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}
function getFilePath(file) {
  const parts = String(file || '').replace(/\\/g, '/').split('/');
  return parts.slice(0, -1).join('/');
}
function getDirPath(file) {
  const clean = normalizePath(file);
  const parts = clean.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}
function resolveRelativePath(baseDir, relPath) {
  const rel = normalizePath(relPath);
  const base = normalizePath(baseDir);
  if (!rel.startsWith('.')) return rel;
  const stack = base ? base.split('/').filter(Boolean) : [];
  const parts = rel.split('/').filter(p => p.length);
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function formatRepoFileLine(row) {
  const base = row.repoPath || row.file || '';
  const line = row.line ? `:${row.line}` : '';
  return `${base}${line}`;
}
function repoBadgeHtml(repo) {
  const cfg = getRepoConfig(repo);
  const label = escapeAttr(cfg.label || repo);
  // Keep color values constrained to plain color-ish tokens.
  const sanitizeCssColor = value => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
    if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)$/i.test(raw)) return raw;
    if (/^var\(--[a-z0-9-_]+\)$/i.test(raw)) return raw;
    if (/^[a-z]+$/i.test(raw)) return raw;
    return '';
  };
  const color = sanitizeCssColor(cfg.color) || 'var(--accent)';
  const bg = sanitizeCssColor(cfg.bg) || 'rgba(47, 125, 225, 0.12)';
  return `<span class="repo-pill" style="--repo-color:${escapeAttr(color)};--repo-bg:${escapeAttr(bg)}">${label}</span>`;
}
function badgeClass(type) {
  if (type === 'SVG_import' || type === 'SVG_asset') return 'badge-svg';
  if (type === 'ReactIcons') return 'badge-react';
  if (type === 'FontAwesome') return 'badge-fa';
  return 'badge-inline';
}
function badgeLabel(type) {
  if (type === 'SVG_import') return 'SVG';
  if (type === 'SVG_asset') return 'Asset';
  if (type === 'ReactIcons') return 'React';
  if (type === 'FontAwesome') return 'FA';
  if (type === 'SCSS_url') return 'SCSS';
  return 'Inline';
}
function cleanName(name) {
  return name.split(' as ')[0].split('→')[0].trim();
}
function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(b => {
    ['active-all', 'active-svg', 'active-react', 'active-fa', 'active-inline'].forEach(cls => b.classList.remove(cls));
  });
  const map = { all: 'active-all', SVG_import: 'active-svg', SVG_asset: 'active-svg', ReactIcons: 'active-react', FontAwesome: 'active-fa', SVG_inline: 'active-inline', SCSS_url: 'active-inline' };
  const btn = document.getElementById('btn-' + currentType);
  if (btn) btn.classList.add(map[currentType] || 'active-all');
}


const USAGE_CACHE = new Map();
function clearUsageCaches() {
  USAGE_CACHE.clear();
}
function getSvgAssetFiles() {
  if (window._cachedSvgAssetFiles) return window._cachedSvgAssetFiles;
  window._cachedSvgAssetFiles = Object.keys(EXTRACTED_ASSETS).map(k => {
    const [repo, file] = k.split('||');
    return { repo, file: normalizePath(file) };
  });
  return window._cachedSvgAssetFiles;
}
const USAGE_KEYWORDS = [
  { pattern: /toolbar/i, label: 'Toolbar' },
  { pattern: /sidebar/i, label: 'Sidebar' },
  { pattern: /nav/i, label: 'Navigation' },
  { pattern: /menu/i, label: 'Menu' },
  { pattern: /dropdown/i, label: 'Dropdown' },
  { pattern: /modal|dialog|drawer/i, label: 'Modal' },
  { pattern: /table|grid/i, label: 'Table' },
  { pattern: /form|input|field/i, label: 'Form' },
  { pattern: /button|btn/i, label: 'Button' },
  { pattern: /layers/i, label: 'Layers' },
  { pattern: /tree/i, label: 'Tree' },
  { pattern: /pane/i, label: 'Pane' },
  { pattern: /widget/i, label: 'Widget' },
  { pattern: /settings/i, label: 'Settings' },
  { pattern: /export/i, label: 'Export' },
  { pattern: /import/i, label: 'Import' },
  { pattern: /calendar/i, label: 'Calendar' },
  { pattern: /album/i, label: 'Album' },
  { pattern: /map|location/i, label: 'Map' },
  { pattern: /overlay/i, label: 'Overlay' },
  { pattern: /viewer|viewport/i, label: 'Viewer' },
  { pattern: /toolbar.*simple/i, label: 'Toolbar (Simple)' },
];

function normalizePath(p) {
  let out = String(p || '').replace(/\\/g, '/');
  if (out.startsWith('@/')) out = out.slice(2);
  if (out.startsWith('@')) out = out.slice(1);
  if (out.startsWith('~')) out = out.replace(/^~\//, '');
  return out;
}

function findSvgPath(fragment) {
  const fragNorm = normalizePath(fragment);
  if (!fragNorm) return null;
  const svgAssetFiles = getSvgAssetFiles();
  const suffixMatch = svgAssetFiles.find(p => p.file.endsWith(fragNorm));
  if (suffixMatch) return suffixMatch;
  const base = fragNorm.split('/').pop();
  if (!base) return null;
  const baseMatch = svgAssetFiles.find(p => p.file.endsWith('/' + base) || p.file.endsWith(base));
  if (baseMatch) return baseMatch;
  return null;
}

function resolveSvgPath(primaryName) {
  const name = String(primaryName || '').trim();
  if (!name) return null;
  const candidates = new Set();

  const normalized = normalizePath(name);
  
  // Try the exact provided path first (important for .png, .jpg, etc)
  candidates.add(normalized);
  
  const parts = normalized.split('/');
  if (normalized.includes('.svg') || normalized.includes('.png') || normalized.includes('.jpg') || normalized.includes('.gif')) {
    candidates.add(normalized);
    candidates.add(parts[0]);
    candidates.add(parts[parts.length - 1]);
  } else {
    candidates.add(normalized + '.svg');
    candidates.add(toKebab(normalized) + '.svg');
  }

  if (normalized.includes('svg') && !normalized.endsWith('.svg')) {
    candidates.add(normalized.replace(/svg$/i, '.svg'));
  }

  if (normalized.endsWith('svg')) {
    candidates.add(normalized.replace(/svg$/i, '.svg'));
  }

  if (normalized.endsWith('SVG')) {
    const base = normalized.slice(0, -3);
    candidates.add(base + '.svg');
    candidates.add(toKebab(base) + '.svg');
  }

  if (/^[A-Za-z0-9_-]+$/.test(normalized)) {
    candidates.add(normalized + '.svg');
    candidates.add(toKebab(normalized) + '.svg');
  }

  for (const candidate of candidates) {
    const svgPath = findSvgPath(candidate);
    if (svgPath) return svgPath;
  }
  return null;
}

function extractIconToken(value) {
  const rawInput = String(value || '').replace(/\(.*?\)/g, ' ').trim();
  const raw = rawInput.includes(' as ') ? rawInput.split(' as ')[0].trim() : rawInput;
  if (!raw) return '';
  const tokens = raw.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i] === 'Icon' && i > 0 && /^[A-Z][A-Za-z0-9]+$/.test(tokens[i - 1])) {
      return tokens[i - 1];
    }
    if (/^[A-Z][A-Za-z0-9]+$/.test(tokens[i]) && tokens[i] !== 'Icon') return tokens[i];
  }
  return raw;
}

function normalizeLib(lib) {
  const raw = String(lib || '').trim();
  if (!raw) return '';
  const parts = raw.split(/ \+ | \/ /);
  return parts[0].trim();
}

function getUsageLocations(name, lib) {
  const key = `${name}||${lib}`;
  if (USAGE_CACHE.has(key)) return USAGE_CACHE.get(key);

  const results = [];
  const primaryName = String(name || '').replace(/\(.*?\)/g, '').trim();
  const iconToken = extractIconToken(primaryName);
  const libNorm = normalizeLib(lib);
  const faClassMatch = primaryName.match(/\bfa-([a-z0-9-]+)\b/);
  const svgResolved = resolveSvgPath(primaryName);

  for (const r of data) {
    if (r.type === 'ReactIcons') {
      const rn = cleanName(r.icon_name);
      const libMatch = libNorm ? r.library.includes(libNorm) : true;
      if (libMatch && rn === iconToken) {
        results.push(r);
        continue;
      }
    }
    if (r.type === 'FontAwesome') {
      const rn = cleanName(r.icon_name);
      if (faClassMatch && rn.includes(`fa-${faClassMatch[1]}`)) {
        results.push(r);
        continue;
      }
      if ((/^fa[A-Z]/.test(iconToken) || /^Fa[A-Z]/.test(iconToken)) && rn.toLowerCase() === iconToken.toLowerCase()) {
        results.push(r);
        continue;
      }
    }
    if (r.type === 'SVG_asset' || r.type === 'SVG_import') {
      const rn = cleanName(r.icon_name);
      if (svgResolved && normalizePath(r.file).endsWith(svgResolved.file)) {
        results.push(r);
        continue;
      }
      if (rn && iconToken && rn === iconToken) {
        results.push(r);
        continue;
      }
    }
  }

  USAGE_CACHE.set(key, results);
  return results;
}

function getUsageLocationsForRepo(name, lib, repo) {
  return getUsageLocations(name, lib).filter(u => u.repo === repo);
}

// Convert PascalCase icon name to kebab-case for data-lucide attribute
function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeColor(val) {
  if (!val) return null;
  const v = String(val).trim().toLowerCase();
  if (v === 'none' || v === 'transparent' || v === 'currentcolor') return v;
  if (v.startsWith('url(')) return v;
  const hex = v.replace('#', '');
  if (hex === '000' || hex === '000000') return '#000000';
  if (hex === 'fff' || hex === 'ffffff') return '#ffffff';
  if (v.startsWith('rgb(')) {
    const nums = v.replace(/[^\d,]/g, '').split(',').map(n => parseInt(n, 10));
    if (nums.length >= 3 && nums[0] === 0 && nums[1] === 0 && nums[2] === 0) return '#000000';
    if (nums.length >= 3 && nums[0] === 255 && nums[1] === 255 && nums[2] === 255) return '#ffffff';
  }
  return null;
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}
