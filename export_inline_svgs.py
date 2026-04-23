import json
import os
import re
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent

REPO_ROOTS = {
    "3dviewer": PROJECT / "3d-viewer-staging" / "app",
    "portal-fe": PROJECT / "portal-fe-develop" / "src",
    "settings-ui": PROJECT / "settings-ui-main" / "lib",
}

DATA_FILES = [
    ROOT / "data-3dviewer.js",
    ROOT / "data-portal-fe.js",
    ROOT / "data-settings-ui.js",
]

OUT_DIR = ROOT / "extracted"
INDEX_PATH = OUT_DIR / "inline-index.js"

# Manual overrides for known dynamic/JSX-heavy inline SVGs
MANUAL_SVG_OVERRIDES = {
    ("3dviewer", "scripts/components/PaneKeepOuts/Options/AutoAI.tsx"): """
<svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg">
  <path d="M5.25 7.5a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M9.5 9.5 L13 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
""",
    ("settings-ui", "components/core/Icons/IconArrow.tsx"): """
<svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg">
  <path d="M0,0 10,10 20,0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
""",
    ("settings-ui", "components/core/Icons/IconOverflow.tsx"): """
<svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg">
  <g fill="currentColor">
    <circle cx="5" cy="5" r="1.5"/>
    <circle cx="10" cy="5" r="1.5"/>
    <circle cx="15" cy="5" r="1.5"/>
  </g>
</svg>
""",
    ("settings-ui", "components/SettingsShell/NavSubs.tsx"): """
<svg viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
  <path d="M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z" fill="currentColor"/>
</svg>
""",
    ("3dviewer", "scripts/components/Nav/NavItems.tsx"): """
<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
  <circle cx="11" cy="11" r="10" fill="currentColor" opacity="0.25"/>
  <path d="M13.01,4.71c.59,.3,1.05,.73,1.38,1.28,.33,.56,.49,1.2,.49,1.93,0,1.29-.4,2.24-1.19,2.84-.8,.6-1.88,.91-3.26,.91l-.05,1.97h-1.08l-.07-2.87h.47c1.23,0,2.2-.19,2.92-.58,.71-.39,1.07-1.15,1.07-2.27,0-.79-.25-1.42-.74-1.88-.5-.47-1.15-.7-1.96-.7s-1.46,.22-1.94,.66c-.48,.44-.72,1.05-.72,1.81h-1.2c0-.72,.16-1.34,.49-1.88,.33-.53,.78-.94,1.36-1.24,.58-.29,1.25-.44,2-.44s1.44,.15,2.04,.45Zm-3.82,12.08c-.17-.18-.26-.4-.26-.66s.09-.48,.26-.65c.17-.17,.39-.26,.65-.26s.46,.09,.64,.26c.17,.17,.26,.39,.26,.65s-.09,.48-.26,.66c-.17,.18-.39,.27-.64,.27s-.48-.09-.65-.27Z" fill="currentColor"/>
</svg>
""",
    ("3dviewer", "scripts/state/Viewsheds/components/ViewshedSvg.tsx"): """
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <circle cx="23.9" cy="24" r="21.2" fill="none" stroke="currentColor" stroke-width="4"/>
  <path d="M1.6,24c0,0,21.5,13.6,41.4-5.7" fill="none" stroke="currentColor" stroke-width="4"/>
  <path d="M4.4,33.1c0,0,20.4,13,40.8-6.7" fill="none" stroke="currentColor" stroke-width="4"/>
</svg>
""",
}

# For complex inline SVGs, map to an existing asset if present
MANUAL_ASSET_OVERRIDES = {
}


def load_rows(path: Path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\.ICON_DATA\s*=\s*(\{.*\});?\s*$", text, re.S)
    if not m:
        raise RuntimeError(f"Could not parse {path}")
    data = json.loads(m.group(1))
    return data.get("rows", [])


def extract_svg_snippet(text: str, line_num: int):
    lines = text.splitlines()
    idx = max(0, (line_num or 1) - 1)
    start_line = -1
    for i in range(idx, -1, -1):
        if "<svg" in lines[i]:
            start_line = i
            break
    if start_line < 0:
        return None
    start_pos = sum(len(lines[i]) + 1 for i in range(start_line))
    after = text[start_pos:]
    local_start = re.search(r"<svg[\s\S]*?>", after, re.I)
    if not local_start:
        return None
    svg_start = start_pos + local_start.start()
    end_idx = text.find("</svg>", svg_start)
    if end_idx < 0:
        return None
    return text[svg_start : end_idx + 6]


_CAMEL_TO_KEBAB = {
    "strokeWidth": "stroke-width",
    "strokeLinecap": "stroke-linecap",
    "strokeLinejoin": "stroke-linejoin",
    "strokeDasharray": "stroke-dasharray",
    "strokeDashoffset": "stroke-dashoffset",
    "strokeMiterlimit": "stroke-miterlimit",
    "strokeOpacity": "stroke-opacity",
    "fillOpacity": "fill-opacity",
    "fillRule": "fill-rule",
    "clipPath": "clip-path",
    "clipRule": "clip-rule",
    "vectorEffect": "vector-effect",
    "markerEnd": "marker-end",
    "markerStart": "marker-start",
    "markerMid": "marker-mid",
    "fontSize": "font-size",
    "fontFamily": "font-family",
    "fontWeight": "font-weight",
    "textAnchor": "text-anchor",
    "dominantBaseline": "dominant-baseline",
    "stopColor": "stop-color",
    "stopOpacity": "stop-opacity",
}


def sanitize_jsx(svg_text: str):
    out = svg_text
    out = re.sub(r"\s*\{\.{3}[^}]+\}", "", out)
    out = out.replace("className=", "class=")
    out = re.sub(r'=\{\s*"([^"]*)"\s*\}', r'="\1"', out)
    out = re.sub(r"=\{\s*'([^']*)'\s*\}", r'="\1"', out)
    out = re.sub(r"=\{\s*([0-9.]+)\s*\}", r'="\1"', out)
    out = re.sub(r'=\{\s*"currentColor"\s*\}', r'="currentColor"', out)
    out = re.sub(r"=\{\s*'currentColor'\s*\}", r'="currentColor"', out)
    out = re.sub(r"\s+[A-Za-z0-9:_-]+=\{[^}]*\}", "", out)
    # Convert camelCase SVG attributes to kebab-case
    for camel, kebab in _CAMEL_TO_KEBAB.items():
        out = re.sub(rf'\b{camel}=', f'{kebab}=', out)
    # Ensure xmlns is present on the root <svg> element
    if 'xmlns=' not in out:
        out = re.sub(r'<svg\b', '<svg xmlns="http://www.w3.org/2000/svg"', out, count=1)
    return out


def is_renderable(svg_text: str):
    if "{" in svg_text or "}" in svg_text:
        return False
    if re.search(r'var\(--', svg_text):
        return False
    if "<svg" not in svg_text:
        return False
    if re.search(r"<path\b[^>]*\bd=['\"][^'\"]+['\"]", svg_text):
        return True
    if re.search(r"<circle\b[^>]*\br=['\"][^'\"]+['\"]", svg_text):
        return True
    if re.search(r"<rect\b[^>]*(width|height)=['\"][^'\"]+['\"]", svg_text):
        return True
    if re.search(r"<(polygon|polyline)\b[^>]*\bpoints=['\"][^'\"]+['\"]", svg_text):
        return True
    if re.search(r"<line\b[^>]*\b(x1|y1|x2|y2)=['\"][^'\"]+['\"]", svg_text):
        return True
    return False


def extract_const_map(text: str):
    consts = {}
    for m in re.finditer(r"(?ms)^\s*(const|let)\s+([A-Za-z0-9_]+)\s*=\s*(.+?);", text):
        name = m.group(2)
        expr = m.group(3).strip()
        if expr.startswith("<"):
            continue
        if "=>" in expr or "function" in expr:
            continue
        # avoid very large captures
        if len(expr) > 500:
            continue
        consts[name] = expr
    return consts


def eval_js_expr(expr: str, scope: dict):
    if expr.startswith("`") and expr.endswith("`"):
        body = expr[1:-1]
        body = re.sub(r"\$\{([^}]+)\}", r"{\1}", body)
        py = f"f'''{body}'''"
        return eval(py, {"__builtins__": {}}, scope)
    if (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
        return expr[1:-1]
    expr = expr.replace("Math.", "math.")
    expr = expr.replace("degToRad", "deg_to_rad")
    return eval(expr, {"__builtins__": {}}, scope)


def resolve_exprs(consts: dict):
    scope = {
        "math": math,
        "deg_to_rad": lambda d: (d * math.pi) / 180.0,
    }
    resolved = {}
    # best-effort multi-pass
    for _ in range(5):
        changed = False
        for name, expr in list(consts.items()):
            if name in resolved:
                continue
            try:
                value = eval_js_expr(expr, {**scope, **resolved})
                resolved[name] = value
                changed = True
            except Exception:
                continue
        if not changed:
            break
    return resolved


def apply_const_values(svg_text: str, resolved: dict):
    out = svg_text
    for name, value in resolved.items():
        if isinstance(value, (int, float)):
            val = str(value)
        else:
            val = str(value)
        out = re.sub(rf"=\{{\s*{re.escape(name)}\s*\}}", f'="{val}"', out)
    return out


def replace_jsx_attr_expressions(svg_text: str, resolved: dict):
    def repl(match):
        attr = match.group(1)
        expr = match.group(2).strip()
        try:
            val = eval_js_expr(expr, resolved)
            return f'{attr}="{val}"'
        except Exception:
            return match.group(0)
    return re.sub(r"([A-Za-z0-9:_-]+)=\{([^}]+)\}", repl, svg_text)


def safe_name(repo: str, file_path: str, line: int):
    clean = file_path.replace("\\", "/").replace("/", "__")
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", clean)
    return f"{repo}__{clean}__L{line}.svg"

def should_skip_path(file_path: str):
    lower = file_path.lower()
    if ".test." in lower or ".spec." in lower or ".stories." in lower:
        return True
    return False


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = {}
    skipped = []

    for data_file in DATA_FILES:
        rows = load_rows(data_file)
        # infer repo from filename
        if "3dviewer" in data_file.name:
            repo = "3dviewer"
        elif "portal-fe" in data_file.name:
            repo = "portal-fe"
        elif "settings-ui" in data_file.name:
            repo = "settings-ui"
        else:
            continue

        repo_root = REPO_ROOTS.get(repo)
        if not repo_root:
            continue

        for r in rows:
            file_path, line, rtype = r[0], r[1], r[2]
            if rtype != "SVG_inline":
                continue
            norm_path = file_path.replace("\\", "/")
            if should_skip_path(file_path):
                skipped.append((repo, file_path, line, "test/story file"))
                continue
            src_file = repo_root / file_path
            if not src_file.exists():
                # try fallback svg by basename
                base = Path(file_path).stem
                matches = list(repo_root.rglob(f"{base}.svg"))
                if matches:
                    svg_path = matches[0]
                    out_name = safe_name(repo, str(svg_path.relative_to(repo_root)), int(line or 0))
                    out_path = OUT_DIR / out_name
                    out_path.write_text(svg_path.read_text(encoding="utf-8"), encoding="utf-8")
                    key = f"{repo}||{file_path}||{line}"
                    index[key] = f"extracted/{out_name}"
                    continue
                skipped.append((repo, file_path, line, "source not found"))
                continue
            text = src_file.read_text(encoding="utf-8")
            snippet = extract_svg_snippet(text, int(line or 1))
            if not snippet:
                skipped.append((repo, file_path, line, "svg not found"))
                continue
            consts = extract_const_map(text)
            resolved = resolve_exprs(consts)
            if resolved:
                snippet = replace_jsx_attr_expressions(snippet, resolved)
                snippet = apply_const_values(snippet, resolved)
            cleaned = sanitize_jsx(snippet)
            if not is_renderable(cleaned):
                # manual overrides
                override = MANUAL_SVG_OVERRIDES.get((repo, norm_path))
                if override:
                    name = safe_name(repo, file_path, int(line or 0))
                    out_path = OUT_DIR / name
                    out_path.write_text(override.strip() + "\n", encoding="utf-8")
                    key = f"{repo}||{file_path}||{line}"
                    index[key] = f"extracted/{name}"
                    continue
                asset_override = MANUAL_ASSET_OVERRIDES.get((repo, norm_path))
                if asset_override:
                    asset_path = repo_root / asset_override
                    if asset_path.exists():
                        name = safe_name(repo, file_path, int(line or 0))
                        out_path = OUT_DIR / name
                        out_path.write_text(asset_path.read_text(encoding="utf-8"), encoding="utf-8")
                        key = f"{repo}||{file_path}||{line}"
                        index[key] = f"extracted/{name}"
                        continue
                skipped.append((repo, file_path, line, "non-renderable jsx"))
                continue
            name = safe_name(repo, file_path, int(line or 0))
            out_path = OUT_DIR / name
            out_path.write_text(cleaned, encoding="utf-8")
            key = f"{repo}||{file_path}||{line}"
            index[key] = f"extracted/{name}"

    INDEX_PATH.write_text(
        "window.INLINE_SVG_INDEX = " + json.dumps(index, indent=2) + ";",
        encoding="utf-8",
    )

    print(f"Exported {len(index)} inline SVGs to {OUT_DIR}")
    if skipped:
        print(f"Skipped {len(skipped)} items:")
        for repo, file_path, line, reason in skipped:
            print(f"- {repo} {file_path}:{line} — {reason}")


if __name__ == "__main__":
    main()
