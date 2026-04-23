"""
repopulate.py — regenerates 0icon-clean-up.html from all SVG files in this directory.

Usage:
    python repopulate.py

Run this any time new SVGs are added to the folder, or to reset the sheet to
a clean auto-generated state. Duplicate SVG files (identical content, different
paths) are merged into a single card; the label shows all source filenames.
"""

import os
import re
import hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "0icon-clean-up.html")

HEADER = """\
<!doctype html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SVG Sheet</title>
    <style>
        :root {
            --page-bg: #f6f6f6;
            --card-bg: #ffffff;
            --border: #d9d9d9;
            --text: #222;
            --muted: #666;
            --icon-color: #222;
            --icon-size: 48px;
            --card-width: 180px;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: var(--page-bg);
            color: var(--text);
        }

        .toolbar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: white;
            border-bottom: 1px solid var(--border);
            padding: 12px 16px;
        }

        .toolbar h1 {
            margin: 0 0 8px;
            font-size: 18px;
        }

        .toolbar p {
            margin: 0;
            color: var(--muted);
            font-size: 13px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(var(--card-width), 1fr));
            gap: 16px;
            padding: 16px;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .preview {
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px dashed #ddd;
            border-radius: 8px;
            background:
                linear-gradient(45deg, #f3f3f3 25%, transparent 25%),
                linear-gradient(-45deg, #f3f3f3 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #f3f3f3 75%),
                linear-gradient(-45deg, transparent 75%, #f3f3f3 75%);
            background-size: 16px 16px;
            background-position: 0 0, 0 8px, 8px -8px, -8px 0;
        }

        .preview svg {
            width: var(--icon-size);
            height: var(--icon-size);
            color: var(--icon-color);
            overflow: visible;
        }

        .card:hover {
            border-color: #999;
        }

        .selected {
            outline: 2px solid #3b82f6;
            outline-offset: 1px;
        }

        /* Optional helpers for testing CSS-driven icons */
        .force-current-color svg * {
            fill: currentColor !important;
            stroke: currentColor !important;
        }

        .stroke-only svg *[stroke] {
            stroke: currentColor !important;
        }

        .fill-only svg *[fill]:not([fill="none"]) {
            fill: currentColor !important;
        }

        .label {
            padding: 4px 8px 8px;
            font-size: 11px;
            color: var(--muted);
            word-break: break-all;
        }

        .label details summary {
            cursor: pointer;
        }

        .label ul {
            margin: 4px 0 0;
            padding-left: 16px;
        }
    </style>
</head>

<body>
    <div class="toolbar">
        <h1>SVG Sheet</h1>
        <p>Edit CSS at the top to test color, size, borders, spacing, and hover behavior.</p>
    </div>

    <div class="grid">
"""

FOOTER = """\
    </div>
</body>
</html>
"""


def pick_primary_name(names):
    """Prefer shorter, simpler filenames (no double-underscores)."""
    simple = [n for n in names if "__" not in n]
    pool = simple if simple else names
    return min(pool, key=lambda n: (len(n), n))


def make_card(svg_content, names):
    primary = pick_primary_name(names)

    # Strip XML declaration — not valid inside HTML
    svg_content = re.sub(r"<\?xml[^?]*\?>", "", svg_content).strip()

    # Indent SVG lines inside the preview div
    indented = "\n".join("                " + line for line in svg_content.splitlines())

    if len(names) == 1:
        label_html = primary
    else:
        items = "\n".join(f"                    <li>{n}</li>" for n in sorted(names))
        label_html = (
            f"<details><summary>{primary}</summary>"
            f"<ul>\n{items}\n                </ul></details>"
        )

    return (
        f'        <div class="card">\n'
        f'            <div class="preview">\n'
        f"{indented}\n"
        f"            </div>\n"
        f'            <div class="label">{label_html}</div>\n'
        f"        </div>\n"
    )


def main():
    svg_files = sorted(f for f in os.listdir(SCRIPT_DIR) if f.endswith(".svg"))

    # Deduplicate by content hash
    seen = {}
    for fname in svg_files:
        fpath = os.path.join(SCRIPT_DIR, fname)
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        h = hashlib.md5(content.strip().encode()).hexdigest()
        if h not in seen:
            seen[h] = {"content": content, "names": []}
        seen[h]["names"].append(fname)

    cards = [make_card(data["content"], data["names"]) for data in seen.values()]

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(HEADER)
        f.write("\n".join(cards))
        f.write(FOOTER)

    print(f"Done. {len(seen)} unique SVGs written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
