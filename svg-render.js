// svg-render.js — SVG thumbnail rendering, inline SVG extraction, and recoloring helpers

function universalSvgHtml(src, title, fallbackText) {
  const escSrc = escapeAttr(src);
  const escTitle = escapeAttr(title || '');
  const fallback = escapeAttr(fallbackText || title || '—');
  const isSvg = String(src || '').toLowerCase().endsWith('.svg');
  if (isSvg) {
    return `<span class="ctx-inline-holder" data-svg-src="${escSrc}" title="${escTitle}"><img src="${escSrc}" alt="${escTitle}" class="compare-svg-thumb ctx-svg-thumb" onerror="this.outerHTML='<span class=&quot;ctx-path&quot; title=&quot;${fallback}&quot;>${fallback}</span>'"></span>`;
  }
  return `<img src="${escSrc}" alt="${escTitle}" title="${escTitle}" class="compare-svg-thumb ctx-svg-thumb" onerror="this.outerHTML='<span class=&quot;ctx-path&quot; title=&quot;${fallback}&quot;>${fallback}</span>'">`;
}

function sanitizeSvgMarkup(svgText) {
  const raw = String(svgText || '').trim();
  if (!raw || !raw.includes('<svg')) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'image/svg+xml');
    if (!doc || doc.querySelector('parsererror')) return null;
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;

    doc.querySelectorAll('script, foreignObject, iframe, object, embed').forEach(el => el.remove());

    const uniqueId = 'svg_' + Math.random().toString(36).substr(2, 9);
    doc.querySelectorAll('style').forEach(style => {
      let text = style.textContent;
      const classRe = /\.([A-Za-z0-9_-]+)(?![^{}]*})/g;
      const foundClasses = new Set();
      let match;
      while ((match = classRe.exec(text))) {
        foundClasses.add(match[1]);
      }
      if (foundClasses.size > 0) {
        foundClasses.forEach(c => {
          text = text.replace(new RegExp('\\.' + c + '\\b', 'g'), '.' + c + '_' + uniqueId);
        });
        style.textContent = text;
        doc.querySelectorAll('*').forEach(el => {
          if (el.classList) {
            Array.from(el.classList).forEach(c => {
              if (foundClasses.has(c)) {
                el.classList.remove(c);
                el.classList.add(c + '_' + uniqueId);
              }
            });
          }
        });
      }
    });

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
  } catch (err) {
    return null;
  }
}

function shouldInlineSvgPreview(originalSvgText, processedSvgText) {
  if (processedSvgText !== originalSvgText) return true;
  const text = String(originalSvgText || '');
  const hasFillClassToken = /class=["'][^"']*--fill\b/i.test(text);
  if (hasFillClassToken) return true;
  const hasExplicitWhite = /(fill|stroke)=["'](?:#fff|#ffffff|white)["']/i.test(text)
    || /(fill|stroke)\s*:\s*(?:#fff|#ffffff|white)\b/i.test(text);
  if (hasExplicitWhite) return true;
  const hasCurrentColor = /(?:fill|stroke)=["']currentColor["']/i.test(text) || /(?:fill|stroke):\s*currentColor/i.test(text);
  return hasCurrentColor;
}

function inlineSvgPreviews() {
  const holders = document.querySelectorAll('.ctx-inline-holder[data-svg-src]');
  holders.forEach(holder => {
    if (holder.dataset.inlineDone) return;
    const src = holder.dataset.svgSrc;
    if (!src) return;
    fetch(src)
      .then(res => (res && res.ok) ? res.text() : Promise.reject())
      .then(text => {
        const match = text.match(/<svg[\s\S]*<\/svg>/i);
        if (!match) return;
        const sanitized = sanitizeSvgMarkup(match[0]);
        if (!sanitized) return;
        const processed = maybeRecolorSvgText(sanitized);
        holder.dataset.inlineDone = '1';
        if (shouldInlineSvgPreview(sanitized, processed)) {
          holder.innerHTML = processed;
          const svg = holder.querySelector('svg');
          if (svg) {
            svg.classList.add('ctx-inline-svg');
            svg.setAttribute('aria-hidden', 'true');
          }
        }
      })
      .catch(() => {
        delete holder.dataset.inlineDone;
        // Keep <img> fallback if fetch fails (e.g. file:// restrictions)
      });
  });
}

const SOURCE_SVG_CACHE = new Map();
const SOURCE_TEXT_CACHE = new Map();

function extractSvgSnippetFromSource(text, lineNum) {
  const lines = text.split(/\r?\n/);
  const idx = Math.max(0, (parseInt(lineNum, 10) || 1) - 1);
  let startLine = -1;
  for (let i = idx; i >= 0; i--) {
    if (lines[i] && lines[i].includes('<svg')) { startLine = i; break; }
  }
  if (startLine < 0) return null;
  let startPos = 0;
  for (let i = 0; i < startLine; i++) startPos += lines[i].length + 1;
  const after = text.slice(startPos);
  const localStart = after.search(/<svg[\s\S]*?>/i);
  if (localStart < 0) return null;
  const svgStart = startPos + localStart;
  const endIdx = text.indexOf('</svg>', svgStart);
  if (endIdx < 0) return null;
  return text.slice(svgStart, endIdx + 6);
}

function sanitizeInlineSvgMarkup(svgText) {
  let out = String(svgText || '');
  out = out.replace(/\s*\{\.{3}[^}]+\}/g, '');
  out = out.replace(/\bclassName=/g, 'class=');
  out = out.replace(/=\{\s*"([^"]*)"\s*\}/g, '="$1"');
  out = out.replace(/=\{\s*'([^']*)'\s*\}/g, '="$1"');
  out = out.replace(/=\{\s*([0-9.]+)\s*\}/g, '="$1"');
  // Drop any remaining JSX expressions in attributes
  out = out.replace(/\s+[A-Za-z0-9:_-]+=\{[^}]*\}/g, '');
  return out;
}

function isRenderableSvgMarkup(svgText) {
  const t = String(svgText || '');
  if (!t.includes('<svg')) return false;
  if (/[{}]/.test(t)) return false;
  const hasPath = /<path\b[^>]*\bd=["'][^"']+["']/.test(t);
  const hasCircle = /<circle\b[^>]*\br=["'][^"']+["']/.test(t);
  const hasRect = /<rect\b[^>]*\b(width|height)=["'][^"']+["']/.test(t);
  const hasPoly = /<(polygon|polyline)\b[^>]*\bpoints=["'][^"']+["']/.test(t);
  const hasLine = /<line\b[^>]*\b(x1|y1|x2|y2)=["'][^"']+["']/.test(t);
  return hasPath || hasCircle || hasRect || hasPoly || hasLine;
}

function inlineSourceSvgs() {
  const holders = document.querySelectorAll('.ctx-inline-source[data-inline-src]');
  holders.forEach(holder => {
    if (holder.dataset.inlineDone) return;
    const file = holder.dataset.inlineSrc || '';
    const line = holder.dataset.inlineLine || '';
    const repo = holder.dataset.inlineRepo || '';
    const cacheKey = `${repo}||${file}||${line}`;
    if (SOURCE_SVG_CACHE.has(cacheKey)) {
      const svgText = SOURCE_SVG_CACHE.get(cacheKey);
      holder.innerHTML = svgText;
      holder.dataset.inlineDone = '1';
      const svg = holder.querySelector('svg');
      if (svg) {
        svg.classList.add('ctx-inline-svg');
        svg.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    const src = buildAssetUrl(repo, file);
    const loadText = () => fetch(src).then(r => (r && r.ok) ? r.text() : Promise.reject());
    const useText = text => {
      const snippet = extractSvgSnippetFromSource(text, line);
      if (!snippet) return;
      const cleaned = sanitizeInlineSvgMarkup(snippet);
      if (!isRenderableSvgMarkup(cleaned)) {
        const fallback = renderInlineSvgFallback(repo, file);
        if (fallback) {
          holder.innerHTML = fallback;
          holder.dataset.inlineDone = '1';
          inlineSvgPreviews();
          return;
        }
        delete holder.dataset.inlineDone;
        return;
      }
      const sanitized = sanitizeSvgMarkup(cleaned);
      if (!sanitized) {
        delete holder.dataset.inlineDone;
        return;
      }
      const processed = maybeRecolorSvgText(sanitized);
      SOURCE_SVG_CACHE.set(cacheKey, processed);
      holder.innerHTML = processed;
      holder.dataset.inlineDone = '1';
      const svg = holder.querySelector('svg');
      if (svg) {
        svg.classList.add('ctx-inline-svg');
        svg.setAttribute('aria-hidden', 'true');
      }
    };
    if (SOURCE_TEXT_CACHE.has(src)) {
      useText(SOURCE_TEXT_CACHE.get(src));
      return;
    }
    loadText()
      .then(text => {
        SOURCE_TEXT_CACHE.set(src, text);
        useText(text);
      })
      .catch(() => {
        holder.textContent = '<svg>';
        holder.classList.add('ctx-inline-badge');
        delete holder.dataset.inlineDone;
      });
  });
}

function renderInlineSvgFallback(repo, file) {
  const base = String(file || '').replace(/\\/g, '/').split('/').pop() || '';
  const name = base.replace(/\.[^/.]+$/, '');
  if (!name) return null;
  const dir = getDirPath(file);
  const candidate = dir ? `${dir}/${name}.svg` : `${name}.svg`;
  const resolved = findSvgPath(candidate) || findSvgPath(name + '.svg');
  if (resolved) {
    const src = resolveAssetUrl(resolved.repo || repo, resolved.file);
    return universalSvgHtml(src, resolved.file || name, resolved.file || name);
  }
  // fallback to direct sibling path in repo
  const direct = candidate;
  const directSrc = resolveAssetUrl(repo, direct);
  return universalSvgHtml(directSrc, direct, direct);
}

function maybeRecolorSvgText(svgText) {
  let t = String(svgText || '');
  t = t.replace(/fill=["']current["']/gi, 'fill="currentColor"');
  t = t.replace(/stroke=["']current["']/gi, 'stroke="currentColor"');
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(t, 'image/svg+xml');
    const svg = doc && doc.documentElement;
    if (svg && svg.tagName && svg.tagName.toLowerCase() === 'svg') {
      const paintEls = Array.from(svg.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse'));
      const getStylePaint = (el, prop) => {
        const style = String(el.getAttribute('style') || '');
        const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
        return match ? match[1].trim() : '';
      };
      for (const el of paintEls) {
        const explicitFill = el.getAttribute('fill') || getStylePaint(el, 'fill');
        const explicitStroke = el.getAttribute('stroke') || getStylePaint(el, 'stroke');
        const hasExplicitPaint = Boolean(explicitFill || explicitStroke);
        if (!hasExplicitPaint) {
          return t;
        }
        for (const value of [explicitFill, explicitStroke]) {
          if (!value) continue;
          const norm = normalizeColor(value);
          if (!norm) {
            return t;
          }
        }
      }
    }
  } catch (err) {
    return t;
  }
  const paints = { fill: new Set(), stroke: new Set() };
  const collect = (attr, value) => {
    const norm = normalizeColor(value);
    if (norm) paints[attr].add(norm);
  };
  const attrRe = /(fill|stroke)=["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(t))) collect(m[1].toLowerCase(), m[2]);
  const styleRe = /(fill|stroke)\s*:\s*([^;"]+)/gi;
  while ((m = styleRe.exec(t))) collect(m[1].toLowerCase(), m[2]);
  const usesFill = paints.fill.size > 0 && ![...paints.fill].every(v => v === 'none' || v === 'transparent');
  const usesStroke = paints.stroke.size > 0 && ![...paints.stroke].every(v => v === 'none' || v === 'transparent');
  const allPaints = new Set([...paints.fill, ...paints.stroke].filter(v => v !== 'none' && v !== 'transparent'));
  const nonBW = [...allPaints].some(v => v !== '#000000' && v !== '#ffffff');
  if (nonBW) return t;
  if (usesFill && usesStroke) return t;
  const target = '#2e3134';
  return t
    .replace(/fill=["']#000["']/gi, `fill="${target}"`)
    .replace(/fill=["']#000000["']/gi, `fill="${target}"`)
    .replace(/fill=["']#fff["']/gi, `fill="${target}"`)
    .replace(/fill=["']#ffffff["']/gi, `fill="${target}"`)
    .replace(/fill=["']white["']/gi, `fill="${target}"`)
    .replace(/fill:\s*#000000/gi, `fill:${target}`)
    .replace(/fill:\s*#000\b/gi, `fill:${target}`)
    .replace(/fill:\s*#ffffff/gi, `fill:${target}`)
    .replace(/fill:\s*#fff\b/gi, `fill:${target}`)
    .replace(/fill:\s*white\b/gi, `fill:${target}`)
    .replace(/stroke=["']#000["']/gi, `stroke="${target}"`)
    .replace(/stroke=["']#000000["']/gi, `stroke="${target}"`)
    .replace(/stroke=["']#fff["']/gi, `stroke="${target}"`)
    .replace(/stroke=["']#ffffff["']/gi, `stroke="${target}"`)
    .replace(/stroke=["']white["']/gi, `stroke="${target}"`)
    .replace(/stroke:\s*#000000/gi, `stroke:${target}`)
    .replace(/stroke:\s*#000\b/gi, `stroke:${target}`)
    .replace(/stroke:\s*#ffffff/gi, `stroke:${target}`)
    .replace(/stroke:\s*#fff\b/gi, `stroke:${target}`)
    .replace(/stroke:\s*white\b/gi, `stroke:${target}`)
    .replace(/(\bfill\s*:\s*)(#000000|#000\b|#ffffff|#fff\b|white\b)/gi, `$1${target}`)
    .replace(/(\bstroke\s*:\s*)(#000000|#000\b|#ffffff|#fff\b|white\b)/gi, `$1${target}`);
}

function parseStyle(styleText) {
  const out = {};
  String(styleText || '').split(';').forEach(part => {
    const [k, v] = part.split(':').map(s => s && s.trim());
    if (k && v) out[k.toLowerCase()] = v;
  });
  return out;
}

function parseSvgClassStyles(svg) {
  const map = {};
  if (!svg) return map;
  const styles = Array.from(svg.querySelectorAll('style'));
  styles.forEach(styleEl => {
    const text = styleEl.textContent || '';
    const re = /\.([A-Za-z0-9_-]+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = re.exec(text))) {
      const cls = match[1];
      const body = match[2];
      if (!cls || !body) continue;
      const rules = parseStyle(body);
      map[cls] = map[cls] || {};
      if (rules.fill) map[cls].fill = rules.fill;
      if (rules.stroke) map[cls].stroke = rules.stroke;
    }
  });
  return map;
}

function getClassPaint(el, attr, classMap) {
  if (!el || !classMap) return null;
  const classAttr = el.getAttribute('class');
  if (!classAttr) return null;
  const classes = classAttr.split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    const rules = classMap[cls];
    if (rules && rules[attr]) return rules[attr];
  }
  return null;
}

function getPaintValue(el, attr, classMap) {
  if (!el || !attr) return null;
  const direct = el.getAttribute(attr);
  if (direct != null && direct !== '') return direct;
  const style = parseStyle(el.getAttribute('style'));
  if (style[attr]) return style[attr];
  return getClassPaint(el, attr, classMap);
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

function recolorInlineSvg(svg) {
  const classMap = parseSvgClassStyles(svg);
  const paintEls = Array.from(svg.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse'));
  if (!paintEls.length) return;

  let usesFill = false;
  let usesStroke = false;
  let nonBW = false;
  const inheritedPaintCache = new WeakMap();

  const getComputedPaint = (el, prop) => {
    try {
      if (window.getComputedStyle) {
        const cs = window.getComputedStyle(el);
        if (cs && cs[prop]) return cs[prop];
      }
    } catch (err) {
      // ignore
    }
    return null;
  };

  const getInheritedPaint = (el, prop) => {
    if (!el || !prop) return null;
    let cache = inheritedPaintCache.get(el);
    if (!cache) {
      cache = {};
      inheritedPaintCache.set(el, cache);
    }
    if (Object.prototype.hasOwnProperty.call(cache, prop)) {
      return cache[prop];
    }
    let node = el;
    while (node && node.nodeType === 1) {
      const value = getPaintValue(node, prop, classMap);
      if (value != null && value !== '') {
        cache[prop] = value;
        return value;
      }
      node = node.parentElement;
    }
    cache[prop] = null;
    return null;
  };

  paintEls.forEach(el => {
    const fillRaw = getInheritedPaint(el, 'fill') || getComputedPaint(el, 'fill');
    const strokeRaw = getInheritedPaint(el, 'stroke') || getComputedPaint(el, 'stroke');
    const fillNorm = normalizeColor(fillRaw);
    const strokeNorm = normalizeColor(strokeRaw);

    if (fillRaw && fillNorm !== 'none' && fillNorm !== 'transparent') {
      usesFill = true;
      if (fillNorm !== '#000000' && fillNorm !== '#ffffff') nonBW = true;
    }
    if (strokeRaw && strokeNorm !== 'none' && strokeNorm !== 'transparent') {
      usesStroke = true;
      if (strokeNorm !== '#000000' && strokeNorm !== '#ffffff') nonBW = true;
    }
  });

  if (nonBW) return;
  if (usesFill && usesStroke) return;

  const target = '#2e3134';
  if (usesFill && !usesStroke) {
    let changed = false;
    paintEls.forEach(el => {
      const fillRaw = getInheritedPaint(el, 'fill') || getComputedPaint(el, 'fill');
      const fillNorm = normalizeColor(fillRaw);
      if (fillNorm === '#000000' || fillNorm === '#ffffff') {
        el.setAttribute('fill', target);
        changed = true;
      }
    });
    if (!changed) {
      const svgFill = getComputedPaint(svg, 'fill') || svg.getAttribute('fill');
      const svgNorm = normalizeColor(svgFill);
      if (svgNorm === '#000000' || svgNorm === '#ffffff') {
        svg.setAttribute('fill', target);
      }
    }
  }
  if (usesStroke && !usesFill) {
    paintEls.forEach(el => {
      const strokeRaw = getInheritedPaint(el, 'stroke') || getComputedPaint(el, 'stroke');
      const strokeNorm = normalizeColor(strokeRaw);
      if (strokeNorm === '#000000' || strokeNorm === '#ffffff') {
        el.setAttribute('stroke', target);
      }
    });
  }
}
