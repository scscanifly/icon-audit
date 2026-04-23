// comparison-data.js — Default comparison data and storage/lookup helpers

const DEFAULT_COMPARISONS = [
  {
    section: "Navigation & Chevrons",
    items: [
      { label: "Chevron Right", usage: "Collapsible, Sidebar, Expand", current: "FaChevronRight (fa)", currentLib: "react-icons/fa", proposed: "ChevronRight", proposedLib: "lucide-react", emoji: "›" },
      { label: "Chevron Down", usage: "Collapsible, Dropdowns", current: "FaChevronDown (fa)", currentLib: "react-icons/fa", proposed: "ChevronDown", proposedLib: "lucide-react", emoji: "⌄" },
      { label: "Chevron Left", usage: "ExpandToggle", current: "FaChevronLeft (fa6)", currentLib: "react-icons/fa6", proposed: "ChevronLeft", proposedLib: "lucide-react", emoji: "‹" },
      { label: "Angle Up/Down", usage: "ExpandCollapseButton", current: "FaAngleUp / FaAngleDown", currentLib: "react-icons/fa6", proposed: "ChevronUp / ChevronDown", proposedLib: "lucide-react", emoji: "^" },
      { label: "Arrow Left", usage: "Nav back button", current: "fa-arrow-left (CSS)", currentLib: "FontAwesome CSS", proposed: "ArrowLeft", proposedLib: "lucide-react", emoji: "←" },
      { label: "Sort Up/Down", usage: "Roof segment table", current: "FaSort / FaSortUp / FaSortDown", currentLib: "react-icons/fa6", proposed: "ArrowUpDown / ArrowUp / ArrowDown", proposedLib: "lucide-react", emoji: "↕" },
    ]
  },
  {
    section: "Actions",
    items: [
      { label: "Close / X", usage: "Toaster, Cancel", current: "MdClose + fa-close (CSS)", currentLib: "react-icons/md + FA CSS", proposed: "X", proposedLib: "lucide-react", emoji: "×" },
      { label: "Add / Plus", usage: "Layout editing, Toolbar", current: "MdAdd + fa6 FaPlus", currentLib: "react-icons/md + fa6", proposed: "Plus", proposedLib: "lucide-react", emoji: "+" },
      { label: "Delete / Trash", usage: "File options, Layout", current: "FaTrashCan + TrashSVG", currentLib: "react-icons/fa6 + SVG", proposed: "Trash2", proposedLib: "lucide-react", emoji: "🗑" },
      { label: "Copy", usage: "Layout, File options", current: "MdContentCopy + CopySVG", currentLib: "react-icons/md + SVG", proposed: "Copy", proposedLib: "lucide-react", emoji: "⎘" },
      { label: "Cut", usage: "Layout editing", current: "MdContentCut", currentLib: "react-icons/md", proposed: "Scissors", proposedLib: "lucide-react", emoji: "✂" },
      { label: "Paste", usage: "Layout editing", current: "MdContentPaste", currentLib: "react-icons/md", proposed: "Clipboard", proposedLib: "lucide-react", emoji: "📋" },
      { label: "Save", usage: "LayersWidget menu", current: "FaSave", currentLib: "react-icons/fa (v4!)", proposed: "Save", proposedLib: "lucide-react", emoji: "💾" },
      { label: "Undo / Redo", usage: "Toolbar", current: "UndoSVG / RedoSVG (custom)", currentLib: "Local SVG", proposed: "Undo2 / Redo2", proposedLib: "lucide-react", emoji: "↩" },
      { label: "Expand", usage: "Carousel", current: "FaExpand", currentLib: "react-icons/fa6", proposed: "Maximize2", proposedLib: "lucide-react", emoji: "⤢" },
      { label: "Minimize", usage: "Carousel", current: "FiMinimize2", currentLib: "react-icons/fi", proposed: "Minimize2", proposedLib: "lucide-react", emoji: "⤡" },
      { label: "Restart", usage: "Shade animation", current: "MdRestartAlt", currentLib: "react-icons/md", proposed: "RotateCcw", proposedLib: "lucide-react", emoji: "↺" },
      { label: "Download", usage: "Shade report", current: "MdOutlineFileDownload", currentLib: "react-icons/md", proposed: "Download", proposedLib: "lucide-react", emoji: "↓" },
      { label: "Export / Upload", usage: "API export, Toolbar", current: "FaFileExport + UploadSVG", currentLib: "react-icons/fa6 + SVG", proposed: "Upload / Share2", proposedLib: "lucide-react", emoji: "↑" },
    ]
  },
  {
    section: "Status & Feedback",
    items: [
      { label: "Alert / Warning", usage: "Info, QuickFill, Finalize", current: "FiAlertTriangle", currentLib: "react-icons/fi", proposed: "AlertTriangle", proposedLib: "lucide-react", emoji: "⚠" },
      { label: "Info", usage: "ProgressToast, SolarAI, Albums", current: "MdInfoOutline / FiInfo", currentLib: "react-icons/md + fi", proposed: "Info", proposedLib: "lucide-react", emoji: "ℹ" },
      { label: "Check / Success", usage: "Copy confirmation, Finalize", current: "MdCheck + MdCheckCircle", currentLib: "react-icons/md", proposed: "Check / CheckCircle", proposedLib: "lucide-react", emoji: "✓" },
      { label: "Lightbulb", usage: "Info, GridModeOnly", current: "MdLightbulbOutline", currentLib: "react-icons/md", proposed: "Lightbulb", proposedLib: "lucide-react", emoji: "💡" },
      { label: "Disabled", usage: "PaneTrees header", current: "MdOutlineDisabledByDefault", currentLib: "react-icons/md", proposed: "Ban", proposedLib: "lucide-react", emoji: "⊘" },
    ]
  },
  {
    section: "Legacy Font Awesome (CSS) → React",
    items: [
      { label: "3D Cube / Model", usage: "Nav bar", current: "fa-cube (CSS class)", currentLib: "FontAwesome CSS", proposed: "Box", proposedLib: "lucide-react", emoji: "□" },
      { label: "Bar Chart", usage: "Nav bar", current: "fa-bar-chart (CSS class)", currentLib: "FontAwesome CSS", proposed: "BarChart2", proposedLib: "lucide-react", emoji: "📊" },
      { label: "Share", usage: "Nav bar", current: "fa-share-alt (CSS class)", currentLib: "FontAwesome CSS", proposed: "Share2", proposedLib: "lucide-react", emoji: "↗" },
      { label: "Icon spacing (fw)", usage: "Dropdown spacing util", current: "fa-fw (CSS only)", currentLib: "FontAwesome CSS", proposed: "Remove — use CSS gap/padding", proposedLib: "CSS layout", emoji: "⬚" },
      { label: "Loading spinner", usage: "SidebarExports", current: "fa-pulse (CSS animation)", currentLib: "FontAwesome CSS", proposed: "Loader2 (or CSS spin)", proposedLib: "lucide-react", emoji: "○" },
    ]
  },
  {
    section: "Custom SVGs — Keep as Custom",
    items: [
      { label: "Modules On/Off", usage: "Layers, Pane, Toolbar", current: "modules-on/off.svg", currentLib: "Custom SVG", proposed: "Keep — solar-specific concept", proposedLib: "Custom SVG ✓", emoji: "☀" },
      { label: "Shade On/Off", usage: "Layers, Pane, Toolbar", current: "shade-on/off.svg", currentLib: "Custom SVG", proposed: "Keep — solar-specific concept", proposedLib: "Custom SVG ✓", emoji: "◑" },
      { label: "Keepouts On/Off", usage: "Layers, Pane", current: "keepouts-on/off.svg", currentLib: "Custom SVG", proposed: "Keep — domain-specific", proposedLib: "Custom SVG ✓", emoji: "⬡" },
      { label: "Azimuth / Tilt / Pitch", usage: "TiltAzimuthEditor, Pane", current: "azimuth-icon / tilt-icon / pitch.svg", currentLib: "Custom SVG", proposed: "Keep — no standard equivalent", proposedLib: "Custom SVG ✓", emoji: "∠" },
      { label: "LiDAR / Point Cloud", usage: "Toolbar, Reference Layers", current: "lidaricon / lidar-mesh / lidar-point-cloud.svg", currentLib: "Custom SVG", proposed: "Keep — technology-specific", proposedLib: "Custom SVG ✓", emoji: "⊹" },
      { label: "Drone / Satellite", usage: "Design Compare, hooks", current: "drone.svg / satellite.svg", currentLib: "Custom SVG (3 paths!)", proposed: "Consolidate to 1 path each, keep custom", proposedLib: "Custom SVG ✓", emoji: "✈" },
      { label: "XRay Mode", usage: "Toolbar", current: "xraymodeIcon.svg", currentLib: "Custom SVG", proposed: "Keep — no standard equivalent", proposedLib: "Custom SVG ✓", emoji: "◎" },
      { label: "Max Fill", usage: "Toolbar, VerticalToolbar", current: "max-fill.svg (3 paths!)", currentLib: "Custom SVG", proposed: "Consolidate to 1 path", proposedLib: "Custom SVG ✓", emoji: "▦" },
    ]
  },
  {
    section: "Miscellaneous React Icons",
    items: [
      { label: "Drag handle", usage: "DraggableButton", current: "PiDotsSixVerticalBold", currentLib: "react-icons/pi", proposed: "GripVertical", proposedLib: "lucide-react", emoji: "⋮⋮" },
      { label: "Resize", usage: "ResizeWidthHeight", current: "GiResize", currentLib: "react-icons/gi (!)", proposed: "Maximize / Expand", proposedLib: "lucide-react", emoji: "⤢" },
      { label: "Magic Wand (AI)", usage: "AIDesign", current: "PiMagicWand", currentLib: "react-icons/pi", proposed: "Wand2", proposedLib: "lucide-react", emoji: "✦" },
      { label: "Table options", usage: "LayersWidget menu", current: "TbTableOptions", currentLib: "react-icons/tb", proposed: "Table2", proposedLib: "lucide-react", emoji: "▤" },
      { label: "Grid On/Off", usage: "GridModeToggle", current: "MdGridOn / MdGridOff", currentLib: "react-icons/md", proposed: "Grid3X3 / Grid3X3 (toggled)", proposedLib: "lucide-react", emoji: "⊞" },
      { label: "Tree shapes", usage: "PaneTrees", current: "LuTreeDeciduous / LuTreePine", currentLib: "lucide-react ✓", proposed: "Already on lucide-react — keep", proposedLib: "lucide-react ✓", emoji: "🌲" },
      { label: "Play / Pause", usage: "Shade animation controls", current: "FaRegCirclePlay / FaRegCirclePause", currentLib: "react-icons/fa6", proposed: "Play / Pause", proposedLib: "lucide-react", emoji: "▶" },
      { label: "Calendar, Clock, Location", usage: "Album meta info", current: "FaCalendarDays / FaClock / FaLocationDot", currentLib: "react-icons/fa6", proposed: "Calendar / Clock / MapPin", proposedLib: "lucide-react", emoji: "📅" },
      { label: "Lock open/closed", usage: "Toolbar", current: "lockClosedIcon / lockOpenIcon.svg", currentLib: "Custom SVG", proposed: "Lock / Unlock", proposedLib: "lucide-react", emoji: "🔒" },
      { label: "Settings", usage: "Toolbar", current: "settingsIcon.svg", currentLib: "Custom SVG", proposed: "Settings2", proposedLib: "lucide-react", emoji: "⚙" },
      { label: "Screenshot", usage: "Toolbar", current: "screenshotIcon.svg", currentLib: "Custom SVG", proposed: "Camera", proposedLib: "lucide-react", emoji: "📷" },
      { label: "Help", usage: "ToolbarSimpleDesign", current: "help.svg", currentLib: "Custom SVG", proposed: "CircleHelp", proposedLib: "lucide-react", emoji: "?" },
    ]
  }
];

const STORAGE_KEY = 'iconAuditComparisons:v1';
let comparisons = loadComparisons();
let editMode = false;
ensureItemIds(comparisons);

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function renderRepoFilter() {
  const select = document.getElementById('repo-filter');
  if (!select) return;
  const options = ['all'].concat(DATASET_LIST.map(d => d.key));
  select.innerHTML = options.map(key => {
    const label = key === 'all' ? 'All Repos' : getRepoLabel(key);
    return `<option value="${escapeAttr(key)}">${escapeAttr(label)}</option>`;
  }).join('');
  select.value = currentRepo;
}

function newItemId() {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureItemIds(list = comparisons) {
  if (!Array.isArray(list)) return;
  list.forEach(section => {
    if (!section || typeof section !== 'object') return;
    const items = Array.isArray(section.items) ? section.items : [];
    items.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (!item._id) item._id = newItemId();
    });
  });
}

function findItem(sectionIndex, itemId) {
  const items = comparisons[sectionIndex]?.items || [];
  const index = items.findIndex(i => i._id === itemId);
  return { item: index >= 0 ? items[index] : null, index };
}

function findSectionIndexByItemId(itemId) {
  for (let s = 0; s < comparisons.length; s++) {
    const items = comparisons[s]?.items || [];
    const idx = items.findIndex(i => i && i._id === itemId);
    if (idx >= 0) return s;
  }
  return -1;
}

function loadComparisons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(DEFAULT_COMPARISONS);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return deepClone(DEFAULT_COMPARISONS);
    const normalized = parsed.map(section => {
      const sectionName = String((section && section.section) || '');
      const items = Array.isArray(section && section.items) ? section.items : [];
      return {
        ...section,
        section: sectionName,
        items: items
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            ...item,
            label: String(item.label || ''),
            usage: String(item.usage || ''),
            current: String(item.current || ''),
            currentLib: String(item.currentLib || ''),
            currentRepo: String(item.currentRepo || ''),
            proposed: String(item.proposed || ''),
            proposedLib: String(item.proposedLib || 'lucide-react'),
            emoji: String(item.emoji || '•'),
          }))
      };
    });
    ensureItemIds(normalized);
    return normalized;
  } catch (err) {
    return deepClone(DEFAULT_COMPARISONS);
  }
}

function saveComparisons() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comparisons));
  } catch (err) {
    // ignore storage errors (private browsing, quota)
  }
}
