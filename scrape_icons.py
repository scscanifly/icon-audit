"""
scrape_icons.py
---------------
Scans a React/TypeScript codebase for icon usage across:
  - Font Awesome (@fortawesome / FontAwesomeIcon)
  - Custom <FA icon="fa-*"> wrapper component
  - React Icons (react-icons/*)
  - Material UI Icons (@mui/icons-material, @material-ui/icons)
  - SVG file imports (*.svg)
  - Inline SVGs (<svg ...>)
  - SCSS background-image url() icon references
  - SCSS Font Awesome class selectors and unicode glyphs
  - HTML <i class="fa fa-*"> usages
  - Icon asset files on disk (styles/images/icons/)

Usage:
  # Scan a known repo by key (no path needed):
  python scrape_icons.py --repo 3dviewer
  python scrape_icons.py --repo portal-fe
  python scrape_icons.py --repo settings-ui
  python scrape_icons.py --repo proposal
  python scrape_icons.py --repo mobile

  # Scan all known repos in one shot:
  python scrape_icons.py --repo all

  # Scan an arbitrary directory:
  python scrape_icons.py --repo my-app --root "C:/path/to/my-app"

Output:
  icon_inventory-{repo}.csv  and  data-{repo}.js  written to the icon-audit directory.
"""

import os
import re
import csv
import json
import shutil
import argparse
from collections import Counter
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# Repo config — edit these paths if your folder layout changes
# ---------------------------------------------------------------------------

ROOT    = Path(__file__).resolve().parent   # icon-audit/
PROJECT = ROOT.parent                       # Scanifly/

KNOWN_REPOS = {
    "3dviewer": PROJECT / "3d-viewer-staging" / "app",
    "portal-fe": PROJECT / "portal-fe-develop" / "src",
    "settings-ui": PROJECT / "settings-ui-main" / "lib",
    "proposal": PROJECT / "proposals-app-develop" / "src",
    "mobile": PROJECT / "mobile-rn-develop" / "app",
}

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

PATTERNS = {
        "Asset_registry_entry": re.compile(
        r"""([A-Za-z0-9_]+)\s*:\s*require\(\s*['"]([^'"]+\.(?:png|jpg|jpeg|gif|svg))['"]\s*\)"""
    ),
    "Asset_object_usage": re.compile(
    r"\b(icons|images)\.([A-Za-z0-9_]+)\b"
),
    # React Native vector icons
    "RN_vector_icons_default_import": re.compile(
        r"import\s+(\w+)\s+from\s+['\"](@react-native-vector-icons|react-native-vector-icons)/([^'\"]+)['\"]"
    ),
    "RN_vector_icons_named_import": re.compile(
        r"import\s+\{([^}]+)\}\s+from\s+['\"]@expo/vector-icons['\"]"
    ),
    "RN_vector_icons_usage": re.compile(
        r"<(\w+)\b[^>]*\bname=['\"]([^'\"]+)['\"]"
    ),

    # React Native SVG
    "RN_svg_import": re.compile(
        r"import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['\"]react-native-svg['\"]"
    ),
    "RN_svg_component_usage": re.compile(
        r"<(Svg|Path|Circle|Rect|Ellipse|Line|Polyline|Polygon|G|Defs|ClipPath|Mask|LinearGradient|RadialGradient|Stop|Use|Text|TSpan|TextPath|Symbol|Pattern|Image)\b(?:\s|/?>)"
    ),
    "FontAwesome_import": re.compile(
        r"import\s+\{([^}]+)\}\s+from\s+['\"]@fortawesome/([^'\"]+)['\"]"
    ),
    "FontAwesome_component": re.compile(
        r"<FontAwesomeIcon[^>]*icon=\{([^}]+)\}"
    ),
    # Custom <FA icon="fa-*"> wrapper and any icon="fa-*" string prop
    "FA_string_prop": re.compile(
        r"""icon=['"](fa-[a-z0-9\-\s]+)['"]"""
    ),
    # className="fa fa-name" or class="fa fa-name" (HTML files)
    "FontAwesome_class": re.compile(
        r'(?:class|className)=["\'][^"\']*fa-([a-z0-9\-]+)[^"\']*["\']'
    ),
    "ReactIcons_import": re.compile(
        r"import\s+\{([^}]+)\}\s+from\s+['\"]react-icons/([^'\"]+)['\"]"
    ),
    "ReactIcons_usage": re.compile(
        r"<(Ai|Bi|Bs|Ci|Di|Fa|Fc|Fi|Gi|Go|Gr|Hi|Im|Io|Lu|Md|Pi|Ri|Rx|Si|Sl|Tb|Ti|Vsc|Wi)[A-Z][A-Za-z0-9]+(?:\s|/>|>)"
    ),
    "MUI_import": re.compile(
        r"import\s+(\w+)\s+from\s+['\"]@(?:mui|material-ui)/icons(?:-material)?/([^'\"]+)['\"]"
    ),
    "SVG_import": re.compile(
        r"import\s+(\w+)\s+from\s+['\"]([^'\"]+\.svg)['\"]"
    ),
    "Image_import": re.compile(
    r"import\s+(\w+)\s+from\s+['\"]([^'\"]+\.(?:svg|png|gif|jpg|jpeg))['\"]"
),
"Image_require": re.compile(
    r"""require\(\s*['"]([^'"]+\.(?:svg|png|gif|jpg|jpeg))['"]\s*\)"""
),
    "SVG_inline": re.compile(
        r"<svg[\s>]"
    ),
    # SCSS background-image url() referencing an icon asset
    "SCSS_url_icon": re.compile(
        r"""url\(['""]?([^'""\)]*(?:icons?|icon)[^'""\)]*\.(?:svg|png|gif|jpg))['""]?\)""",
        re.IGNORECASE,
    ),
    # SCSS selector referencing a Font Awesome class e.g. .fa-star { ... }
    "SCSS_fa_selector": re.compile(
        r"\.fa-([a-z0-9\-]+)\s*[{,]"
    ),
    # SCSS content: "\fXXX" (Font Awesome unicode glyph)
    "SCSS_fa_unicode": re.compile(
        r"""content:\s*['"\\]+(\\f[0-9a-fA-F]{3,4})['"\\]*"""
    ),
}

LIBRARY_PREFIXES = {
    "Ai": "react-icons/ai (Ant Design)",
    "Bi": "react-icons/bi (Boxicons)",
    "Bs": "react-icons/bs (Bootstrap)",
    "Ci": "react-icons/ci (Circum)",
    "Di": "react-icons/di (Devicons)",
    "Fa": "react-icons/fa (Font Awesome)",
    "Fc": "react-icons/fc (Flat Color)",
    "Fi": "react-icons/fi (Feather)",
    "Gi": "react-icons/gi (Game Icons)",
    "Go": "react-icons/go (Github Octicons)",
    "Gr": "react-icons/gr (Grommet)",
    "Hi": "react-icons/hi (Heroicons)",
    "Im": "react-icons/im (IcoMoon)",
    "Io": "react-icons/io (Ionicons)",
    "Lu": "react-icons/lu (Lucide)",
    "Md": "react-icons/md (Material Design)",
    "Pi": "react-icons/pi (Phosphor)",
    "Ri": "react-icons/ri (Remix)",
    "Rx": "react-icons/rx (Radix)",
    "Si": "react-icons/si (Simple Icons)",
    "Sl": "react-icons/sl (Simple Line)",
    "Tb": "react-icons/tb (Tabler)",
    "Ti": "react-icons/ti (Typicons)",
    "Vsc": "react-icons/vsc (VS Code)",
    "Wi": "react-icons/wi (Weather Icons)",
}

EXPO_ICON_LIBRARY_NAMES = {
    "AntDesign",
    "Entypo",
    "EvilIcons",
    "Feather",
    "FontAwesome",
    "FontAwesome5",
    "FontAwesome6",
    "Foundation",
    "Ionicons",
    "MaterialCommunityIcons",
    "MaterialIcons",
    "Octicons",
    "SimpleLineIcons",
    "Zocial",
}

# ---------------------------------------------------------------------------
# Label generation
# ---------------------------------------------------------------------------

# React-icon / FA prefixes to strip from the start of component-style names.
# Only stripped when the remaining string starts with an uppercase letter.
STRIP_PREFIXES = ["Fa", "fa-", "Md", "Bs", "Pi", "Fi", "Go"]


def make_label(icon_type: str, icon_name: str) -> str:
    """Return a clean, human-readable label for an icon row."""
    name = str(icon_name or "").strip()
    if not name or name == "(inline)":
        return ""

    # SVG imports: always derive from the file path, not the alias
    # icon_name looks like  "MyAlias → @components/core/Icons/satellite.svg"
    if icon_type == "SVG_import" and "→" in name:
        path_part = name.split("→", 1)[1].strip()
        name = Path(path_part.replace("\\", "/")).stem

    # SVG asset files and SCSS url() refs: use the filename stem
    elif icon_type in ("SVG_asset", "SCSS_url"):
        name = Path(name.replace("\\", "/")).stem

    # MUI: drop the parenthesised path suffix, e.g. "DeleteIcon (@mui/…)"
    elif icon_type == "MUI":
        name = re.sub(r"\s*\(.*\)", "", name)

    # Strip any remaining .svg extension
    name = re.sub(r"\.svg$", "", name, flags=re.IGNORECASE)

    # Strip leading library prefix (Fa, fa-, Md, Bs, Pi, Fi, Go …)
    for prefix in STRIP_PREFIXES:
        if name.startswith(prefix):
            rest = name[len(prefix):]
            # Only strip when the remainder starts uppercase, OR prefix is "fa-"
            if rest and (prefix == "fa-" or rest[0].isupper()):
                name = rest
                break

    # Remove 'Icon' and 'SVG'/'Svg' substrings anywhere in the name
    name = re.sub(r"Icon", "", name)
    name = re.sub(r"SVG|Svg", "", name)

    # Split camelCase / PascalCase into words
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", name)

    # Convert kebab-case and underscores to spaces
    name = name.replace("-", " ").replace("_", " ")

    # Collapse whitespace and lowercase
    name = re.sub(r"\s+", " ", name).strip().lower()

    return name


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_library_from_prefix(component_name):
    for prefix, lib in LIBRARY_PREFIXES.items():
        if component_name.startswith(prefix) and (
            len(component_name) == len(prefix) or component_name[len(prefix)].isupper()
        ):
            return lib
    return "react-icons (unknown prefix)"
def normalize_imported_names(names_blob: str):
    """
    Convert 'Foo, Bar as Baz' into [('Foo', 'Foo'), ('Bar', 'Baz')].
    Returns tuples of (original_name, local_alias).
    """
    results = []
    for part in names_blob.split(","):
        piece = part.strip()
        if not piece:
            continue
        if " as " in piece:
            original, alias = [p.strip() for p in piece.split(" as ", 1)]
        else:
            original, alias = piece, piece
        results.append((original, alias))
    return results
def asset_basename(asset_path: str) -> str:
    return Path(asset_path.replace("\\", "/")).name



def scan_file(filepath, root, global_asset_registry_map=None):
    results = []
    rel_path = str(Path(filepath).relative_to(root))

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            lines = content.splitlines()
    except Exception as e:
        print(f"  [WARN] Could not read {filepath}: {e}")
        return results

    def add(line_no, icon_type, library, icon_name, context=""):
        results.append({
            "file": rel_path,
            "line": line_no,
            "type": icon_type,
            "library": library,
            "icon_name": icon_name,
            "context": context.strip()[:120],
            "label": make_label(icon_type, icon_name),
        })
            # Track imported RN icon/SVG components so usage matching is accurate
    rn_icon_components = {}
    rn_svg_components = set()
    asset_registry_map = global_asset_registry_map or {}
        # --- RN vector icon default imports ---
    for m in PATTERNS["RN_vector_icons_default_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        local_name = m.group(1).strip()
        package_root = m.group(2).strip()
        family = m.group(3).strip()
        library = f"{package_root}/{family}"

        rn_icon_components[local_name] = library
        add(line_no, "RN_VectorIcons_Import", library, local_name)

    # --- Expo icon named imports ---
    for m in PATTERNS["RN_vector_icons_named_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        imported_names = normalize_imported_names(m.group(1))

        for original_name, local_name in imported_names:
            if original_name in EXPO_ICON_LIBRARY_NAMES:
                library = f"@expo/vector-icons ({original_name})"
                rn_icon_components[local_name] = library
                add(line_no, "RN_VectorIcons_Import", library, local_name)

    # --- RN SVG imports ---
    for m in PATTERNS["RN_svg_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        names_blob = m.group(1)
        default_name = m.group(2)

        if names_blob:
            imported_names = normalize_imported_names(names_blob)
            for original_name, local_name in imported_names:
                rn_svg_components.add(local_name)
                add(line_no, "RN_SVG_Import", "react-native-svg", local_name)
        elif default_name:
            rn_svg_components.add(default_name.strip())
            add(line_no, "RN_SVG_Import", "react-native-svg", default_name.strip())
    # --- Font Awesome imports ---
    for m in PATTERNS["FontAwesome_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        icons = [i.strip() for i in m.group(1).split(",") if i.strip()]
        pkg = m.group(2)
        for icon in icons:
            add(line_no, "FontAwesome", f"@fortawesome/{pkg}", icon)

    # --- FontAwesomeIcon component usage ---
    for m in PATTERNS["FontAwesome_component"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        icon_ref = m.group(1).strip()
        add(line_no, "FontAwesome", "@fortawesome (component)", icon_ref,
            lines[line_no - 1] if line_no <= len(lines) else "")

    # --- <FA icon="fa-*"> and any icon="fa-*" string prop ---
    for m in PATTERNS["FA_string_prop"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        icon_name = m.group(1).strip()
        add(line_no, "FontAwesome", "FA component (string prop)", icon_name,
            lines[line_no - 1] if line_no <= len(lines) else "")

    # --- Font Awesome class-based (className or class) ---
    for m in PATTERNS["FontAwesome_class"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        icon_class = f"fa-{m.group(1)}"
        # Skip if already captured by FA_string_prop for the same line
        already = any(
            r["file"] == rel_path and r["line"] == line_no
            and r["type"] == "FontAwesome" and r["icon_name"] == icon_class
            for r in results
        )
        if not already:
            add(line_no, "FontAwesome", "FontAwesome (CSS class)", icon_class,
                lines[line_no - 1] if line_no <= len(lines) else "")

    # --- React Icons imports ---
    for m in PATTERNS["ReactIcons_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        icons = [i.strip() for i in m.group(1).split(",") if i.strip()]
        sublib = m.group(2)
        for icon in icons:
            library = LIBRARY_PREFIXES.get(sublib, f"react-icons/{sublib}")
            add(line_no, "ReactIcons", library, icon)

    # --- React Icons JSX usage (catches usages without explicit import scan) ---
    for m in PATTERNS["ReactIcons_usage"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        component = m.group(0).strip().lstrip("<").split()[0].rstrip("/>").rstrip(">")
        library = get_library_from_prefix(component)
        # Avoid duplicate if already captured via import
        already = any(
            r["file"] == rel_path and r["icon_name"] == component and r["type"] == "ReactIcons"
            for r in results
        )
        if not already:
            add(line_no, "ReactIcons", library, component,
                lines[line_no - 1] if line_no <= len(lines) else "")

    # --- MUI Icons ---
    for m in PATTERNS["MUI_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        component = m.group(1)
        icon_path = m.group(2)
        add(line_no, "MUI", "@mui/icons-material", f"{component} ({icon_path})")
    # --- Image file imports (svg/png/jpg/gif) ---
    for m in PATTERNS["Image_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        local_alias = m.group(1).strip()
        asset_path = m.group(2).strip()

        ext = Path(asset_path).suffix.lower()
        asset_type = "SVG_import" if ext == ".svg" else "Image_import"

        add(
            line_no,
            asset_type,
            "Local asset file",
            f"{local_alias} → {asset_path}",
            lines[line_no - 1] if line_no <= len(lines) else "",
        )

            # --- Asset registry entries (camera: require('./camera.png')) ---
    for m in PATTERNS["Asset_registry_entry"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        asset_key = m.group(1).strip()
        asset_path = m.group(2).strip()
        filename = asset_basename(asset_path)

        asset_registry_map[asset_key] = filename

        add(
            line_no,
            "Asset_registry_entry",
            "Asset registry definition",
            f"{asset_key} → {filename}",
            lines[line_no - 1] if line_no <= len(lines) else "",
        )
            # --- Image require(...) asset usage ---
for m in PATTERNS["Image_require"].finditer(content):
    line_no = content[:m.start()].count("\n") + 1

    # skip registry lines
    if PATTERNS["Asset_registry_entry"].search(lines[line_no - 1]):
        continue

    asset_path = m.group(1).strip()
    ext = Path(asset_path).suffix.lower()
    asset_type = "SVG_require" if ext == ".svg" else "Image_require"
    add(
            line_no,
            asset_type,
            "Local asset require()",
            asset_path,
            lines[line_no - 1] if line_no <= len(lines) else "",
        )
      # --- Asset object usage (icons.foo / images.bar) ---
    for m in PATTERNS["Asset_object_usage"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        asset_group = m.group(1).strip()   # icons or images
        asset_key = m.group(2).strip()

        resolved_filename = asset_registry_map.get(asset_key)

        if resolved_filename:
            icon_name = f"{asset_key} → {resolved_filename}"
            library = f"Asset registry usage ({asset_group})"
        else:
            icon_name = asset_key
            library = f"Asset registry usage ({asset_group}, unresolved)"

        add(
            line_no,
            "Asset_object_usage",
            library,
            icon_name,
            lines[line_no - 1] if line_no <= len(lines) else "",
        )
    # --- SVG file imports ---
    for m in PATTERNS["SVG_import"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        svg_path = m.group(2)
        add(line_no, "SVG_import", "Local SVG file", Path(svg_path).name)

    # --- Inline SVGs ---
    for m in PATTERNS["SVG_inline"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        add(line_no, "SVG_inline", "Inline SVG", "(inline)",
            lines[line_no - 1] if line_no <= len(lines) else "")
    # --- RN vector icon component usage ---
    for m in PATTERNS["RN_vector_icons_usage"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        component = m.group(1).strip()
        icon_name = m.group(2).strip()

        # Only count components we know were imported from RN icon libraries
        if component in rn_icon_components:
            library = rn_icon_components[component]
            add(
                line_no,
                "RN_VectorIcons",
                library,
                f"{icon_name} → {component}",
                lines[line_no - 1] if line_no <= len(lines) else "",
            )

     # --- RN SVG component usage ---
    rn_svg_known_tags = {
        "Svg", "Path", "Circle", "Rect", "Ellipse", "Line", "Polyline",
        "Polygon", "G", "Defs", "ClipPath", "Mask", "LinearGradient",
        "RadialGradient", "Stop", "Use", "Text", "TSpan", "TextPath",
        "Symbol", "Pattern", "Image"
    }

    for m in PATTERNS["RN_svg_component_usage"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        component = m.group(1).strip()

        if rn_svg_components and component in rn_svg_known_tags:
            add(
                line_no,
                "RN_SVG_Component",
                "react-native-svg",
                component,
                lines[line_no - 1] if line_no <= len(lines) else "",
            )
    # --- SCSS url() icon references ---
    for m in PATTERNS["SCSS_url_icon"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        icon_path = m.group(1).strip()
        add(line_no, "SCSS_url", "SCSS background-image", icon_path,
            lines[line_no - 1] if line_no <= len(lines) else "")

    # --- SCSS Font Awesome class selectors ---
    for m in PATTERNS["SCSS_fa_selector"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        add(line_no, "FontAwesome", "SCSS FA selector", f"fa-{m.group(1)}",
            lines[line_no - 1] if line_no <= len(lines) else "")

    # --- SCSS Font Awesome unicode glyphs ---
    for m in PATTERNS["SCSS_fa_unicode"].finditer(content):
        line_no = content[:m.start()].count("\n") + 1
        add(line_no, "FontAwesome", "SCSS FA unicode", m.group(1),
            lines[line_no - 1] if line_no <= len(lines) else "")
return results


# ---------------------------------------------------------------------------
# Helpers shared with csv_to_data.py
# ---------------------------------------------------------------------------

def safe_asset_name(repo: str, file_path: str) -> str:
    clean = file_path.replace("\\", "/").replace("/", "__")
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", clean)
    return f"{repo}__{clean}"


# ---------------------------------------------------------------------------
# Core scan + write — called once per repo
# ---------------------------------------------------------------------------

NON_ICON_NAMES = {
    "s3d-background.svg",
    "scanifly-illustration-primary.svg",
    "scanifly-illustration-viewsheds.svg",
}
SKIP_DIRS      = {"node_modules", ".git", "dist", "build", "__pycache__", ".next"}
SRC_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
                  ".scss", ".css", ".html", ".hbs"}
ASSET_EXTENSIONS = {".svg", ".png", ".gif", ".jpg", ".jpeg"}

def build_asset_registry_map(root: Path):
    registry_map = {}

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for filename in filenames:
            if Path(filename).suffix not in SRC_EXTENSIONS:
                continue

            filepath = Path(os.path.join(dirpath, filename))

            try:
                content = filepath.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            for m in PATTERNS["Asset_registry_entry"].finditer(content):
                asset_key = m.group(1).strip()
                asset_path = m.group(2).strip()
                registry_map[asset_key] = asset_basename(asset_path)

    return registry_map
def run_scan(root: Path, repo_key: str, out_path: Path, include_node_modules: bool = False):
    """Scan *root*, write CSV to *out_path* and data-{repo_key}.js next to it."""
    all_results = []
    file_count  = 0
    global_asset_registry_map = build_asset_registry_map(root)

    print(f"\nScanning [{repo_key}]: {root}")
    print("-" * 60)

    # ── Source files ──────────────────────────────────────────────
    for dirpath, dirnames, filenames in os.walk(root):
        if not include_node_modules:
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            if Path(filename).suffix in SRC_EXTENSIONS:
                filepath = os.path.join(dirpath, filename)
                hits = scan_file(filepath, root, global_asset_registry_map)
                if hits:
                    file_count += 1
                    all_results.extend(hits)
                    print(f"  [{len(hits):3d} hits] {Path(filepath).relative_to(root)}")

    # ── Build set of SVG filenames already covered by SVG_import entries ──
    # An SVG file on disk whose basename matches an import is not an orphan —
    # it's already represented in the inventory via its import rows.
    referenced_asset_filenames = set()
    for r in all_results:
        if r["type"] not in {
            "SVG_import",
            "Image_import",
            "SVG_require",
            "Image_require",
            "Asset_object_usage",
            "Asset_registry_entry",
        }:
            continue

        path_part = r["icon_name"].split("→", 1)[1].strip() if "→" in r["icon_name"] else r["icon_name"]
        basename = Path(path_part.replace("\\", "/")).name.lower()
        if basename:
            referenced_asset_filenames.add(basename)

    # ── Icon asset files on disk ──────────────────────────────────
    # SVG_asset rows are only emitted for files with no SVG_import match
    # (i.e. orphaned files — on disk but never imported anywhere).
    # All SVGs are still copied to extracted/ so previews work regardless.
    extracted_dir = out_path.parent / "extracted"
    extracted_dir.mkdir(parents=True, exist_ok=True)

    asset_count    = 0   # orphaned assets added as rows
    skipped_count  = 0   # SVGs skipped because they're already imported
    svg_copy_count = 0
    seen_assets    = set()
    extracted_assets = {}

    for dirpath, dirnames, filenames in os.walk(root):
        if not include_node_modules:
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            if Path(filename).suffix.lower() not in ASSET_EXTENSIONS:
                continue
            if filename in NON_ICON_NAMES:
                continue
            filepath = Path(os.path.join(dirpath, filename))
            rel = str(filepath.relative_to(root))
            if rel in seen_assets:
                continue
            seen_assets.add(rel)

            is_svg = Path(filename).suffix.lower() == ".svg"

            # Only emit a row for SVGs with no corresponding import (orphans),
            # and for all non-SVG assets (png/gif/jpg have no import counterpart).
            if filename.lower() not in referenced_asset_filenames:
                all_results.append({
                    "file": rel,
                    "line": "",
                    "type": "SVG_asset",
                    "library": "Local icon asset",
                    "icon_name": filename,
                    "context": "",
                    "label": make_label("SVG_asset", filename),
                })
                asset_count += 1
            else:
                skipped_count += 1

            # Always copy ALL assets (SVGs, PNGs, etc.) to extracted/ so the viewer can render previews
            dest_name = safe_asset_name(repo_key, rel)
            dest_path = extracted_dir / dest_name
            try:
                shutil.copy2(filepath, dest_path)
                extracted_assets[rel] = f"extracted/{dest_name}"
                svg_copy_count += 1
            except Exception as e:
                print(f"  [WARN] Could not copy {filepath}: {e}")

    if asset_count:
        print(f"  [{asset_count:3d} assets] orphaned SVG/image assets (no import found)")
    if skipped_count:
        print(f"  [{skipped_count:3d} svgs  ] already covered by SVG_import rows — skipped")
    if svg_copy_count:
        print(f"  [{svg_copy_count:3d} svgs  ] copied to extracted/")

    print("-" * 60)
    print(f"  Files with icons : {file_count}")
    print(f"  Icon assets found: {asset_count}")
    print(f"  Total hits       : {len(all_results)}")

    # ── Write CSV ─────────────────────────────────────────────────
    fieldnames = ["file", "line", "type", "library", "icon_name", "context", "label"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)
    print(f"\n  CSV     → {out_path}")

    # ── Write data-{repo}.js ──────────────────────────────────────
    by_type      = Counter(r["type"] for r in all_results)
    by_lib       = Counter(r["library"] for r in all_results if r["library"])
    unique_svgs  = len({r["icon_name"] for r in all_results if r["type"] == "SVG_import"})
    unique_react = len({r["icon_name"] for r in all_results if r["type"] == "ReactIcons"})
    unique_rn_vector_icons = len({r["icon_name"] for r in all_results if r["type"] == "RN_VectorIcons"})
    rows = [
        [r["file"], r["line"], r["type"], r["library"], r["icon_name"],
         r["context"], r.get("label", "")]
        for r in all_results
    ]
    data_obj = {
        "generated":      date.today().isoformat(),
        "total":          len(all_results),
        "uniqueSVGs":     unique_svgs,
        "uniqueReact":    unique_react,
        "uniqueRNVectorIcons": unique_rn_vector_icons,
        "byType":         dict(by_type),
        "byLib":          dict(by_lib),
        "rows":           rows,
        "extractedAssets": extracted_assets,
    }
    data_js_path = out_path.parent / f"data-{repo_key}.js"
    json_assets_path = out_path.parent / f"{repo_key}-assets.json"
    with open(json_assets_path, "w", encoding="utf-8") as f:
        json.dump(extracted_assets, f, indent=2)

    with open(data_js_path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by scrape_icons.py — do not edit by hand\n")
        f.write(f"// Generated: {data_obj['generated']}\n")
        f.write("window.ICON_DATA = ")
        f.write(json.dumps(data_obj, indent=2, ensure_ascii=False))
        f.write(";\n")
    print(f"  data.js → {data_js_path}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Scrape icon usage from a React/TS codebase.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n".join([
            "Known repo keys (no --root needed):",
            *[f"  {k:<14} {v}" for k, v in KNOWN_REPOS.items()],
            "",
            "Examples:",
            "  python scrape_icons.py --repo 3dviewer",
            "  python scrape_icons.py --repo all",
            "  python scrape_icons.py --repo my-app --root /path/to/my-app",
        ]),
    )
    parser.add_argument(
        "--repo",
        default=None,
        help='Repo key (e.g. 3dviewer, portal-fe, settings-ui) or "all" to scan every known repo.',
    )
    parser.add_argument(
        "--root",
        default=None,
        help="Source root path. Required only when --repo is not a known key.",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="CSV output path. Defaults to icon_inventory-{repo}.csv in the icon-audit directory.",
    )
    parser.add_argument(
        "--include-node-modules",
        action="store_true",
        help="Include node_modules in scanning (default: false).",
    )
    args = parser.parse_args()

    # Build the list of (repo_key, root_path, out_path) tuples to process
    jobs = []

    if args.repo == "all":
        if args.root:
            print("[WARN] --root is ignored when --repo all is used.")
        for key, repo_root in KNOWN_REPOS.items():
            jobs.append((key, repo_root, ROOT / f"icon_inventory-{key}.csv"))

    else:
        repo_key = args.repo

        # Resolve root
        if args.root:
            root = Path(args.root).resolve()
        elif repo_key and repo_key in KNOWN_REPOS:
            root = KNOWN_REPOS[repo_key]
        else:
            if repo_key:
                print(f"[ERROR] '{repo_key}' is not a known repo key and no --root was given.")
                print(f"  Known keys: {', '.join(KNOWN_REPOS)}")
            else:
                print("[ERROR] Provide --repo (or --repo with --root for custom paths).")
                parser.print_help()
            return

        # Default repo key to directory name if not specified
        if not repo_key:
            repo_key = root.name

        # Default output path
        if args.out:
            out_path = Path(args.out).resolve()
        else:
            out_path = ROOT / f"icon_inventory-{repo_key}.csv"

        jobs.append((repo_key, root, out_path))

    # Run
    for repo_key, root, out_path in jobs:
        if not root.exists():
            print(f"[ERROR] Root path does not exist: {root}  (repo: {repo_key})")
            continue
        run_scan(root, repo_key, out_path, args.include_node_modules)


if __name__ == "__main__":
    main()
