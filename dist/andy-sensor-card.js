/**
 * Andy Sensor Card v1.0.5
 * ------------------------------------------------------------------
 * Developed by: Andreas ("AndyBonde") with some help from AI :).
 *
 * License / Disclaimer:
 * - Free to use, copy, modify, redistribute.
 * - Provided "AS IS" without warranty. No liability.
 * - Not affiliated with Home Assistant / Nabu Casa.
 * - Runs fully in the browser.
 *
 *
 * Install: Se README.md in GITHUB
 *
 * 
 * 
*/

const CARD_NAME = "Andy Sensor Card";
const CARD_VERSION = "1.0.5";
const CARD_TAGLINE = `${CARD_NAME} v${CARD_VERSION}`;

//console.info(CARD_TAGLINE);

console.info(
  `%c${CARD_TAGLINE}`,
  [
    "background: rgba(255,152,0,0.95)",
    "color: #fff",
    "padding: 4px 10px",
    "border-radius: 10px",
    "font-weight: 800",
    "letter-spacing: 0.2px",
    "border: 1px solid rgba(0,0,0,0.25)",
    "box-shadow: 0 1px 0 rgba(0,0,0,0.15)"
  ].join(";")
);




const LitElement =
  window.LitElement || Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = window.html || LitElement.prototype.html;
const css = window.css || LitElement.prototype.css;


// Card tag + editor tag (reuse everywhere)
const CARD_TAG = "andy-sensor-card";
const EDITOR_TAG = "andy-sensor-card-editor";

// Battery-friendly default intervals (0..100)
const DEFAULT_INTERVALS = [
  { id: "it0", to: 0,   color: "#ef4444", outline: "#ffffff", scale_color: "#ef4444", gradient: { enabled: false, from: "#ef4444", to: "#ef4444" } },
  { id: "it1", to: 20,  color: "#f59e0b", outline: "#ffffff", scale_color: "#f59e0b", gradient: { enabled: false, from: "#f59e0b", to: "#f59e0b" } },
  { id: "it2", to: 40,  color: "#fbbf24", outline: "#ffffff", scale_color: "#fbbf24", gradient: { enabled: false, from: "#fbbf24", to: "#fbbf24" } },
  { id: "it3", to: 60,  color: "#22c55e", outline: "#ffffff", scale_color: "#22c55e", gradient: { enabled: false, from: "#22c55e", to: "#22c55e" } },
  { id: "it4", to: 100, color: "#16a34a", outline: "#ffffff", scale_color: "#16a34a", gradient: { enabled: false, from: "#16a34a", to: "#16a34a" } },
];

function deepClone(x) { return JSON.parse(JSON.stringify(x ?? {})); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function clampInt(v, minV, maxV, fallbackV) {
  const n = toNumberMaybe(v);
  if (n === null) return fallbackV;
  const i = Math.trunc(n);
  if (!Number.isFinite(i)) return fallbackV;
  const minN = Number.isFinite(minV) ? minV : i;
  const maxN = Number.isFinite(maxV) ? maxV : i;
  const lo = Math.min(minN, maxN);
  const hi = Math.max(minN, maxN);
  return Math.max(lo, Math.min(hi, i));
}
function isHexColor(s) { return typeof s === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(s).trim()); }
function normalizeHex(s, fallback = "#22c55e") {
  if (!s) return fallback;
  const t = String(s).trim();
  return isHexColor(t) ? t : fallback;
}

function escapeHtml(s) {
  // Minimal HTML escape for future-proofing when inserting dynamic text into innerHTML.
  // Prefer textContent when possible.
  const str = String(s ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// Prevent clicks/inputs from bubbling up and stealing focus (HA editor quirks)
function stopBubble(e) {
  try { e && e.stopPropagation && e.stopPropagation(); } catch (_) {}
  try { e && e.stopImmediatePropagation && e.stopImmediatePropagation(); } catch (_) {}
}

// Numeric clamp helper
function clamp(v, min, max) {
  const n = Number(v);
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(n)) return Number.isFinite(lo) ? lo : 0;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return n;
  return Math.max(Math.min(n, Math.max(lo, hi)), Math.min(lo, hi));
}


function hexToRgb(hex) {
  const h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}
function relLuminanceFromRgb(r, g, b) {
  const srgb = [r, g, b].map(v => {
    const c = v / 255;
    return (c <= 0.03928) ? (c / 12.92) : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function isLightHex(hex, threshold = 0.92) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return relLuminanceFromRgb(rgb.r, rgb.g, rgb.b) >= threshold;
}

function uid(prefix = "it") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function toNumberMaybe(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;

  // Support formats like "90", "90%", "90 %", "-12.3", "-12,3", "  +3.9 kW"
  const m = s.replace(",", ".").match(/[-+]?\d+(?:\.\d+)?/);
  if (m) {
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  // Common boolean-ish states (useful when the main entity is a switch/binary sensor)
  const sl = s.toLowerCase();
  if (sl === "on" || sl === "true" || sl === "open" || sl === "opened" || sl === "charging" || sl === "running") return 1;
  if (sl === "off" || sl === "false" || sl === "closed" || sl === "idle" || sl === "stopped") return 0;

  return null;
}
function normalizeInterval(it) {
  const out = { ...(it || {}) };
  if (!out.id) out.id = uid("it");

  out.to = Number(out.to);
  if (!Number.isFinite(out.to)) out.to = 0;

  out.color = normalizeHex(out.color, "#22c55e");
  out.outline = normalizeHex(out.outline, "#ffffff");

  out.scale_color = normalizeHex(out.scale_color, out.color);

  const g0 = out.gradient || {};
  out.gradient = { ...(g0 || {}) };
  out.gradient.enabled = !!out.gradient.enabled;
  out.gradient.from = normalizeHex(out.gradient.from, out.color);
  out.gradient.to = normalizeHex(out.gradient.to, out.gradient.from);

  // Optional: static match value (for string states). If set (non-empty), it has precedence
  // over numeric matching. Matching is case-insensitive exact match after trimming.
  out.match = (out.match == null) ? "" : String(out.match).trim();

  // Optional: value override (template string). If set, it can replace the displayed value text
  // when this interval is active (both for main card intervals and badge interval overrides).
  out.new_value = (out.new_value == null) ? "" : String(out.new_value);

  // Optional: icon override (primarily used by badge intervals). If set, it can replace the badge icon while this interval is active.
  out.icon = (out.icon == null) ? "" : String(out.icon).trim();

  // Optional: icon color override (HEX). If set, overrides the badge icon color while this interval is active.
  // When blank, the active interval will default to the badge text color (not the interval fill color).
  out.icon_color = (out.icon_color == null) ? "" : String(out.icon_color).trim();

  // Optional: per-section seconds (used by garage_door to simulate realistic opening time).
  // Only meaningful for certain symbols; safe to store globally.
  const sec = Number(out.seconds);
  out.seconds = (Number.isFinite(sec) && sec > 0) ? Math.min(600, sec) : null;

  return out;
}
function normalizeBadge(b) {
  const out = { ...(b || {}) };
  if (!out.id) out.id = uid("bdg");

  out.entity = String(out.entity || "").trim();
  out.title = String(out.title || "").trim();
  out.x = Number(out.x);
  out.y = Number(out.y);
  if (!Number.isFinite(out.x)) out.x = 50;
  if (!Number.isFinite(out.y)) out.y = 50;
  // Allow negative/off-card placement; clamp only to a sane range
  out.x = Math.max(-200, Math.min(200, out.x));
  out.y = Math.max(-200, Math.min(200, out.y));

  // Icon (mdi:...) used for the badge (optional)
  out.icon = String(out.icon || "").trim();

  // Optional opacity for badge (0–1). Default is 1 (fully opaque).
  out.opacity = Number(out.opacity);
  if (!Number.isFinite(out.opacity)) out.opacity = 1;
  out.opacity = Math.max(0, Math.min(1, out.opacity));
  out.show_icon = (typeof out.show_icon === "boolean") ? out.show_icon : true;
  out.icon_color_by_state = (typeof out.icon_color_by_state === "boolean") ? out.icon_color_by_state : true;
  out.icon_only = !!out.icon_only;

  out.label = (out.label == null) ? "<value>" : String(out.label);

  out.decimals = Number(out.decimals);
  if (!Number.isFinite(out.decimals)) out.decimals = null;

  const style = String(out.style || "glass");
  const ok = new Set(["glass","solid","outline","none","slider","left_arrow","right_arrow","top_arrow","bottom_arrow","recycle_left","recycle_right","fan","heatpump"]);
  out.style = ok.has(style) ? style : "glass";

  // Arrow/recycle flow animation
  out.arrow_animation = (typeof out.arrow_animation === "boolean") ? out.arrow_animation : false;

  // Optional badge-specific color intervals (same schema as global intervals)
  out.intervals = Array.isArray(out.intervals) ? out.intervals.map(normalizeInterval) : [];
  out.intervals = out.intervals.map((it) => ({ ...normalizeInterval(it), id: (it && it.id) ? it.id : uid("bint") }));

  out.bg_color = (out.bg_color == null || String(out.bg_color).trim() === "") ? "#000000" : String(out.bg_color);
  out.text_color = (out.text_color == null || String(out.text_color).trim() === "") ? "#ffffff" : String(out.text_color);
  out.border_color = (out.border_color == null || String(out.border_color).trim() === "") ? "#ffffff" : String(out.border_color);

  out.padding = Number(out.padding);
  if (!Number.isFinite(out.padding)) out.padding = 8;

  out.radius = Number(out.radius);
  if (!Number.isFinite(out.radius)) out.radius = 12;

  out.font_size = Number(out.font_size);
  if (!Number.isFinite(out.font_size)) out.font_size = 12;

  // Optional fixed width for badge (px). When set, badge keeps constant width regardless of label length.
  out.fixed_width_px = Number(out.fixed_width_px);
  if (!Number.isFinite(out.fixed_width_px) || out.fixed_width_px <= 0) out.fixed_width_px = null;
  if (out.fixed_width_px != null) out.fixed_width_px = Math.max(20, Math.min(400, Math.round(out.fixed_width_px)));

  // Badge icon size (px). This is independent from the badge font size.
  // Allows enlarging the icon without making the whole badge bigger.
  out.icon_size = Number(out.icon_size);
  if (!Number.isFinite(out.icon_size)) out.icon_size = 18;
  const __icoMax = (out.style === "fan" || out.style === "heatpump") ? 260 : 96;
  out.icon_size = Math.max(6, Math.min(__icoMax, Math.round(out.icon_size)));



  // Fan/Heatpump badge settings (when badge style is "fan" or "heatpump")
  out.fan_blade_count = clampInt(out.fan_blade_count ?? 3, 2, 8, 3);
  out.fan_show_frame = (typeof out.fan_show_frame === "boolean") ? out.fan_show_frame : false;

  // Badge image (optional) - use an image instead of an icon
  out.use_image = (typeof out.use_image === "boolean") ? out.use_image : false;
  out.img_source = String(out.img_source || "url").trim().toLowerCase();
  out.img_source = (out.img_source === "media") ? "media" : "url";
  out.img_url = String(out.img_url || "").trim();
  out.img_media = String(out.img_media || "").trim();
  out.img_fit = String(out.img_fit || "cover").trim().toLowerCase();
  out.img_fit = (out.img_fit === "contain") ? "contain" : "cover";

  out.img_opacity = Number(out.img_opacity);
  if (!Number.isFinite(out.img_opacity)) out.img_opacity = 1;

  out.img_radius = Number(out.img_radius);
  if (!Number.isFinite(out.img_radius)) out.img_radius = 8;

  out.img_tint = (typeof out.img_tint === "boolean") ? out.img_tint : false;
  out.img_tint_color = String(out.img_tint_color || "#000000").trim() || "#000000";
  out.img_tint_opacity = Number(out.img_tint_opacity);
  if (!Number.isFinite(out.img_tint_opacity)) out.img_tint_opacity = 0.0;

  out.img_frame = (typeof out.img_frame === "boolean") ? out.img_frame : false;
  out.img_frame_color = String(out.img_frame_color || "rgba(255,255,255,0.22)");
  out.img_frame_width = Number(out.img_frame_width);
  if (!Number.isFinite(out.img_frame_width)) out.img_frame_width = 2;

  // Dim image when entity is off (optional)
  out.img_dim_when_off = (typeof out.img_dim_when_off === "boolean") ? out.img_dim_when_off : false;
  out.img_dim_when_off_opacity = Number(out.img_dim_when_off_opacity);
  if (!Number.isFinite(out.img_dim_when_off_opacity)) out.img_dim_when_off_opacity = 0.45;

// Slider badge (optional)
out.slider_min = toNumberMaybe(out.slider_min);
if (!Number.isFinite(out.slider_min)) out.slider_min = null;
out.slider_max = toNumberMaybe(out.slider_max);
if (!Number.isFinite(out.slider_max)) out.slider_max = null;
out.slider_step = toNumberMaybe(out.slider_step);
if (!Number.isFinite(out.slider_step)) out.slider_step = null;
out.slider_orientation = String(out.slider_orientation || "horizontal").trim().toLowerCase();
out.slider_orientation = (out.slider_orientation === "vertical") ? "vertical" : "horizontal";
out.slider_update = String(out.slider_update || "release").trim().toLowerCase();
out.slider_update = (out.slider_update === "live") ? "live" : "release";
out.slider_show_value = (typeof out.slider_show_value === "boolean") ? out.slider_show_value : true;

out.show_slider = (typeof out.show_slider === "boolean") ? out.show_slider : (out.style === "slider"); // backward compatible
out.slider_length = toNumberMaybe(out.slider_length);
if (!Number.isFinite(out.slider_length)) out.slider_length = null;
out.slider_thickness = toNumberMaybe(out.slider_thickness);
if (!Number.isFinite(out.slider_thickness)) out.slider_thickness = null;
out.slider_thumb_size = toNumberMaybe(out.slider_thumb_size);
if (!Number.isFinite(out.slider_thumb_size)) out.slider_thumb_size = null;
out.slider_thumb_radius = toNumberMaybe(out.slider_thumb_radius);
if (!Number.isFinite(out.slider_thumb_radius)) out.slider_thumb_radius = null;
out.slider_track_radius = toNumberMaybe(out.slider_track_radius);
if (!Number.isFinite(out.slider_track_radius)) out.slider_track_radius = null;
out.slider_thumb_color = (out.slider_thumb_color == null) ? "" : String(out.slider_thumb_color);
out.slider_track_color = (out.slider_track_color == null) ? "" : String(out.slider_track_color);

  const ta = out.tap_action || {};
  out.tap_action = { ...(ta || {}) };
  const act = String(out.tap_action.action || "more-info");
  out.tap_action.action = (act === "toggle" || act === "call-service" || act === "none") ? act : "more-info";
  out.tap_action.service = String(out.tap_action.service || "").trim();
  out.tap_action.service_data = out.tap_action.service_data || null;

  return out;
}

function ascShowImageBrowser(hass, { startId = "media-source://media_source", title = "Browse images", onPick } = {}) {
  try {
    if (!hass || !hass.callWS) {
      console.warn("ascShowImageBrowser: hass.callWS not available");
      return;
    }

    const existing = document.querySelector("div.asc-imgbr-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "asc-imgbr-overlay";

    const dlg = document.createElement("div");
    dlg.className = "asc-imgbr-dialog";

    const head = document.createElement("div");
    head.className = "asc-imgbr-head";

    const titleEl = document.createElement("div");
    titleEl.className = "asc-imgbr-title";
    titleEl.textContent = title;

    const pathEl = document.createElement("div");
    pathEl.className = "asc-imgbr-path";
    pathEl.textContent = "";

    const right = document.createElement("div");
    right.className = "asc-imgbr-right";

    const btnClose = document.createElement("button");
    btnClose.className = "asc-imgbr-btn";
    btnClose.textContent = "Close";
    btnClose.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.remove();
    });

    right.appendChild(btnClose);

    head.appendChild(titleEl);
    head.appendChild(right);

    const sub = document.createElement("div");
    sub.className = "asc-imgbr-sub";

    const btnBack = document.createElement("button");
    btnBack.className = "asc-imgbr-btn";
    btnBack.textContent = "Back";
    btnBack.disabled = true;

    const search = document.createElement("input");
    search.className = "asc-imgbr-search";
    search.type = "text";
    search.placeholder = "Search…";

    sub.appendChild(btnBack);
    sub.appendChild(search);

    const list = document.createElement("div");
    list.className = "asc-imgbr-list";

    dlg.appendChild(head);
    dlg.appendChild(pathEl);
    dlg.appendChild(sub);
    dlg.appendChild(list);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);

    const stack = [];
    let currentId = startId;

    const isImageItem = (it) => {
      const t = String(it?.media_content_type || "");
      // HA commonly uses "image/jpeg", etc. Some providers may return "image"
      return t === "image" || t.startsWith("image/");
    };
    const isDir = (it) => String(it?.media_content_type || "") === "directory";

    const renderList = (items) => {
      list.innerHTML = "";
      const q = String(search.value || "").trim().toLowerCase();

      const filtered = (items || []).filter((it) => {
        const name = String(it?.title || it?.media_content_id || "");
        if (!q) return true;
        return name.toLowerCase().includes(q);
      });

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "asc-imgbr-empty";
        empty.textContent = "No items.";
        list.appendChild(empty);
        return;
      }

      filtered.forEach((it) => {
        const row = document.createElement("div");
        row.className = "asc-imgbr-item";

        const left = document.createElement("div");
        left.className = "asc-imgbr-item-left";

        const icon = document.createElement("div");
        icon.className = "asc-imgbr-ico";
        icon.textContent = isDir(it) ? "📁" : (isImageItem(it) ? "🖼️" : "•");

        const name = document.createElement("div");
        name.className = "asc-imgbr-name";
        name.textContent = String(it?.title || it?.media_content_id || "");

        left.appendChild(icon);
        left.appendChild(name);

        row.appendChild(left);

        row.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isDir(it)) {
            stack.push(currentId);
            currentId = String(it.media_content_id || currentId);
            btnBack.disabled = false;
            load();
            return;
          }
          if (isImageItem(it)) {
            const id = String(it.media_content_id || "");
            try { if (typeof onPick === "function") onPick(id); } catch (_) {}
            overlay.remove();
            return;
          }
        });

      list.appendChild(row);
      });
    };

    const load = async () => {
      try {
        pathEl.textContent = currentId;
        const res = await hass.callWS({ type: "media_source/browse", media_content_id: currentId });
        const ch = Array.isArray(res?.children) ? res.children : [];
        // Show folders first, then images
        const items = ch.filter((x) => isDir(x) || isImageItem(x));
        items.sort((a, b) => {
          const da = isDir(a) ? 0 : 1;
          const db = isDir(b) ? 0 : 1;
          if (da !== db) return da - db;
          return String(a?.title || "").localeCompare(String(b?.title || ""));
        });
        renderList(items);
      } catch (err) {
        console.warn("ascShowImageBrowser browse failed", err);
        list.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "asc-imgbr-empty";
        empty.textContent = "Could not browse media source. Add images to /media or use /local URL.";
        list.appendChild(empty);
      }
    };

    btnBack.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!stack.length) return;
      currentId = stack.pop();
      btnBack.disabled = stack.length === 0;
      load();
    });

    search.addEventListener("input", () => load());

    // Close when clicking outside dialog
    overlay.addEventListener("click", () => overlay.remove());
    dlg.addEventListener("click", (e) => e.stopPropagation());

    load();
  } catch (err) {
    console.warn("ascShowImageBrowser failed", err);
  }
}
function intervalsSortedByTo(intervals) {
  return (intervals || []).slice().map(normalizeInterval).sort((a, b) => Number(a.to) - Number(b.to));
}
function fmtNum(v, decimals = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(decimals);
}

function fmtNumLocale(v, decimals = 1, locale) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    const loc = locale || undefined;
    return new Intl.NumberFormat(loc, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch (e) {
    // Fallback with Swedish-style decimal comma
    return n.toFixed(decimals).replace(".", ",");
  }
}

function toCssSize(v) {
  if (v === null || typeof v === "undefined") return "";
  const s = String(v).trim();
  if (!s) return "";
  // If only a number -> treat as px
  if (/^\d+(?:\.\d+)?$/.test(s)) return `${s}px`;
  return s; // allow: 180px, 12rem, 100%, auto, etc.
}


class AndySensorCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { state: true },
      _stats: { state: true },
      _lastStatsAt: { state: false },
      _statsBusy: { state: false },
    };
  }

  constructor() {
    super();
    // Unique per card instance -> prevents SVG <defs> id collisions across multiple cards
    this._instanceId = `asc_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

    // Tap confirm (safety) for Gate/Garage/Blind when state is closed
    this._tapConfirmOpen = null; // { until, entityId, act, svc, data }
    this._tapConfirmTimer = 0;

    

    // Badge drag in HA preview (editor only)
    this._bdgDrag = null;
    this._suppressBadgeClickId = null;
// Media source resolution cache (Image symbol)
    this._mediaResolveCache = new Map(); // media_content_id -> resolved url
    this._mediaResolvePending = new Set(); // media_content_id currently resolving


    // Badge slider debounce timers
    this._badgeSliderTimers = new Map();

    // Garage door animation state (JS-driven to be reliable in HA)
    this._gdAnim = null; // { p, target, startP, startT, dur }
    this._gdAnimRaf = 0;
  
    // Garage door DOM injection (ensures SVG renders reliably in HA)
    this._gdDomRaf = 0;
    this._gdPendingMarkup = "";
    this._gdLastMarkup = "";

// Gate (sliding/door) DOM injection + animation
this._gateDomRaf = 0;
this._gatePendingMarkup = "";
this._gateLastMarkup = "";
this._gateAnim = null;
this._gateAnimRaf = 0;

  // Preview scroll persistence (Image symbol in HA visual editor preview)
    // Keeps the preview scroll position stable across rapid editor-driven re-renders,
    // so nudging X/Y doesn't jump the scroll back to 0,0.
    this._ascPrevScroll = { left: 0, top: 0 };
    this._ascPrevScrollEl = null;
    this._ascPrevScrollOnScroll = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // Detect HA visual editor preview (robust across Shadow DOM)
    try {
      const tags = new Set([
        "hui-card-preview",
        "hui-dialog-edit-card",
        "hui-dialog-edit-dashboard",
        "hui-dialog-edit-lovelace",
        "hui-dialog-edit-view",
        "hui-card-element-editor",
        "hui-element-editor",
        "ha-dialog",
        "ha-dialog-controls",
      ]);

      let n = this;
      let inPreview = false;
      for (let i = 0; i < 40; i++) {
        if (!n) break;
        const tn = String(n.tagName || "").toLowerCase();
        if (tags.has(tn)) { inPreview = true; break; }
        const root = n.getRootNode?.();
        const host = (root && root.host) ? root.host : null;
        n = n.parentNode || host;
      }

      if (inPreview) this.setAttribute("data-asc-preview", "1");
      else this.removeAttribute("data-asc-preview");
    } catch (_) {}
  }


  setConfig(config) {
    if (!config?.entity) throw new Error("You need to define an entity");

    const base = {
      name: "Sensor",
      entity: "",
      entity2: "",
      // Editor-only: drag badges in HA preview
      badge_drag_enabled: false,
      // Charging (Battery + Battery Splitted)
      charging_state_entity: "",
      charging_power_entity: "",
      charging_state_entity2: "",
      charging_power_entity2: "",

      // Segment symbols only (battery_segments, battery_splitted_segments, water_level_segments)
      // Gap is in SVG units/pixels inside the symbol.
      segment_gap: 5,
      show_split_entity_names: false,
      symbol: "battery_liquid", // battery_liquid | battery_segments
      industrial_look: false, // Use industrial/modern rendering (where available)
      min: 0,
      max: 100,
      unit: "",
      decimals: 0,
      //v1.0.2
      card_scale: 1,
      card_width: "",
      card_height: "",
      //v1.0.2
      value_position: "top_right",
      value_font_size: 0,
      name_font_size: 0,
      outline_value: false,

      glass: true,

      orientation: "vertical",

      // Main tap action + overlay positions
      tap_action: "more-info",
      tap_action_service: "",
      tap_action_service_data: "",
      tap_action_service_picker: true,
      // For Gate/Garage door/Blind: start animation immediately when you tap (useful when the sensor updates state only when fully closed)
      tap_starts_animation: true,
      // Safety confirm before opening when state is closed (Gate/Garage/Blind)
      tap_confirm_open: false,
      tap_confirm_open_window: 10,
      name_position: "top_left",
  name_offset_x: 0,
  name_offset_y: 0,
  value_offset_x: 0,
  value_offset_y: 0,
      stats_position: "bottom_center",

      show_scale: false,
      fan_show_frame: false, // Fan only

      fan_blade_count: 3, // Fan + Heatpump only (integer)
      garage_door_type: "single", // Garage door only (single|double)
      garage_door_width: 200, // Garage door only (SVG units, per door)
      garage_door_gap: 16, // Garage door only, double: gap between doors (SVG units)
      garage_door_entity2: "", // Garage door only: Door 2 position entity (optional)
      garage_door_lamp_entity: "", // Garage door only: Lamp entity for door 1 (optional)
      garage_door_lamp_entity2: "", // Garage door only: Lamp entity for door 2 (optional)
      window_lamp_opacity: 0.5, // Window (Blind style "window") lamp glow opacity (0..1 or 0..100)
      // Image only
      image_source: "url", // Image only: url | media
      image_url: "", // URL/path to image (e.g. /local/my-image.png or https://...)
      image_media: "", // Media browser id (e.g. media-source://media_source/local/my.jpg)
      image_fit: "cover", // cover | contain
      image_full_card: false, // Render image as full-card background
      image_opacity: 1, // 0..1
      image_radius: 0, // px (symbol box only)
      image_frame: false,
      image_frame_color: "rgba(255,255,255,0.22)",
      image_frame_width: 2,
      image_tint: false,
      image_tint_color: "#000000",
      image_tint_opacity: 0.0, // 0..1
      image_dim_off: false,
      image_dim_off_opacity: 0.45, // 0..1
      // Gate only
gate_type: "sliding", // Gate only (sliding|door)
gate_side: "left", // Gate only (left|right)
gate_width: 220, // Gate only (SVG units)
scale_color_mode: "per_interval",

      show_stats: false,
      stats_hours: 24,

      intervals: deepClone(DEFAULT_INTERVALS),
    };

    const cfg = { ...(config || {}) };
    // Back-compat: older builds used image_dim_when_off(_opacity). Map to image_dim_off(_opacity)
    if (("image_dim_when_off" in cfg) && !("image_dim_off" in cfg)) cfg.image_dim_off = cfg.image_dim_when_off;
    if (("image_dim_when_off_opacity" in cfg) && !("image_dim_off_opacity" in cfg)) cfg.image_dim_off_opacity = cfg.image_dim_when_off_opacity;
    if ("image_dim_when_off" in cfg) delete cfg.image_dim_when_off;
    if ("image_dim_when_off_opacity" in cfg) delete cfg.image_dim_when_off_opacity;

    if ("liquid_animation" in cfg) delete cfg.liquid_animation;

    this._config = Object.assign({}, base, cfg);

    if (!Number.isFinite(Number(this._config.min))) this._config.min = 0;
    if (!Number.isFinite(Number(this._config.max))) this._config.max = 100;

    const ori = String(this._config.orientation || "vertical");
    this._config.orientation = (ori === "horizontal") ? "horizontal" : "vertical";

    const scm = String(this._config.scale_color_mode || "per_interval");
    this._config.scale_color_mode = (scm === "active_interval") ? "active_interval" : "per_interval";
    // Fan/Heatpump: blade count (integer)
    this._config.fan_blade_count = clampInt(this._config.fan_blade_count ?? 3, 2, 8, 3);

    // Garage door type
    const gdt = String(this._config.garage_door_type || "single");
    this._config.garage_door_type = (gdt === "double") ? "double" : "single";

    // Garage door sizing (only used by garage_door)
    {
      let w = Number(this._config.garage_door_width ?? 200);
      if (!Number.isFinite(w)) w = 200;
      this._config.garage_door_width = Math.max(120, Math.min(320, w));

      let g = Number(this._config.garage_door_gap ?? 16);
      if (!Number.isFinite(g)) g = 16;
      this._config.garage_door_gap = Math.max(0, Math.min(120, g));

      if (typeof this._config.garage_door_entity2 !== "string") this._config.garage_door_entity2 = "";
      if (typeof this._config.garage_door_lamp_entity !== "string") this._config.garage_door_lamp_entity = "";
      if (typeof this._config.garage_door_lamp_entity2 !== "string") this._config.garage_door_lamp_entity2 = "";
    }

    
// Gate options (only used by gate)
{
  const gt = String(this._config.gate_type || "sliding").trim().toLowerCase();
  this._config.gate_type = (gt === "door") ? "door" : "sliding";

  const gs = String(this._config.gate_side || "left").trim().toLowerCase();
  this._config.gate_side = (gs === "right") ? "right" : "left";

  let w = Number(this._config.gate_width ?? 220);
  if (!Number.isFinite(w)) w = 220;
  this._config.gate_width = Math.max(160, Math.min(420, w));
}

// Blind style (only used by blind)
    {
      const bsRaw = (this._config.blind_style == null) ? "persienne" : String(this._config.blind_style).trim().toLowerCase();
      this._config.blind_style = (bsRaw === "window") ? "window" : ((bsRaw === "lamella" || bsRaw === "lamell") ? "lamella" : "persienne");
      if (this._config.blind_position_entity == null) this._config.blind_position_entity = "";
    }

const rawSym = String(this._config.symbol || "battery_liquid");
    // Normalize aggressively (editor + HA sometimes provide casing/whitespace)
    let sym = String(rawSym).trim().toLowerCase();
    let industrial = !!this._config.industrial_look;

    // Back-compat: accept *_modern symbols and map them to base + industrial look
    if (sym.endsWith("_modern")) {
      sym = sym.slice(0, -"_modern".length);
      industrial = true;
    }

    const allowed = new Set([
      "battery_liquid",
      "battery_segments",
      "battery_splitted_segments",
      "water_level_segments",
      "silo",
      "tank",
      "ibc_tank",
      "fan",
      "heatpump",
      "garage_door",
      "blind",
      "gate",
      "image",
      "gas_cylinder",
      "washing_machine",
      "tumble_dryer",
    ]);

    if (!allowed.has(sym)) sym = "battery_liquid";
    this._config.symbol = sym;

    // Default scale range for binary position symbols (Gate / Garage door / Blind)
    // If the user didn't explicitly set min/max, use 0..1 instead of 0..100.
    if ((sym === "gate" || sym === "garage_door" || sym === "blind")) {
      if (!("min" in cfg)) this._config.min = 0;
      if (!("max" in cfg)) this._config.max = 1;
    }


    // Industrial look only applies where we have modern renderings, and never for Fan/Heatpump.
    const industrialSupported = new Set([
      "battery_liquid",
      "battery_segments",
      "battery_splitted_segments",
      "water_level_segments",
      // Also support industrial look for these symbols (same functionality, updated casing/colors)
      "ibc_tank",
      "gas_cylinder",
      "silo",
      "tank",
    ]);

    if (sym === "fan" || sym === "heatpump" || sym === "garage_door" || sym === "blind" || sym === "gate" || sym === "washing_machine" || sym === "tumble_dryer") industrial = false;
    this._config.industrial_look = industrialSupported.has(sym) ? !!industrial : false;
    // Image options normalization
    if (typeof this._config.image_source !== "string") this._config.image_source = "url";
    this._config.image_source = (String(this._config.image_source).trim().toLowerCase() === "media") ? "media" : "url";

    if (typeof this._config.image_url !== "string") this._config.image_url = "";
    this._config.image_url = String(this._config.image_url || "").trim();

    if (typeof this._config.image_media !== "string") this._config.image_media = "";
    this._config.image_media = String(this._config.image_media || "").trim();

    const fit = String(this._config.image_fit || "cover").trim().toLowerCase();
    this._config.image_fit = (fit === "contain") ? "contain" : "cover";

    this._config.image_full_card = !!this._config.image_full_card;

    {
      let op = Number(this._config.image_opacity ?? 1);
      if (!Number.isFinite(op)) op = 1;
      this._config.image_opacity = Math.max(0, Math.min(1, op));
    }
    {
      let r = Number(this._config.image_radius ?? 0);
      if (!Number.isFinite(r)) r = 0;
      this._config.image_radius = Math.max(0, Math.min(48, r));
    }

    this._config.image_frame = !!this._config.image_frame;
    if (typeof this._config.image_frame_color !== "string") this._config.image_frame_color = "rgba(255,255,255,0.22)";
    this._config.image_frame_color = String(this._config.image_frame_color || "rgba(255,255,255,0.22)");
    {
      let fw = Number(this._config.image_frame_width ?? 2);
      if (!Number.isFinite(fw)) fw = 2;
      this._config.image_frame_width = Math.max(0, Math.min(10, fw));
    }

    this._config.image_tint = !!this._config.image_tint;
    if (typeof this._config.image_tint_color !== "string") this._config.image_tint_color = "#000000";
    this._config.image_tint_color = String(this._config.image_tint_color || "#000000").trim() || "#000000";
    {
      let to = Number(this._config.image_tint_opacity ?? 0);
      if (!Number.isFinite(to)) to = 0;
      this._config.image_tint_opacity = Math.max(0, Math.min(1, to));
    }

    this._config.image_dim_off = !!this._config.image_dim_off;
    {
      let doo = Number(this._config.image_dim_off_opacity ?? 0.45);
      if (!Number.isFinite(doo)) doo = 0.45;
      this._config.image_dim_off_opacity = Math.max(0, Math.min(1, doo));
    }
    // v1.0.2 card_scale clamp
    let cs = toNumberMaybe(this._config.card_scale);
    if (!Number.isFinite(cs) || cs <= 0) cs = 1;
    this._config.card_scale = Math.max(0.2, Math.min(4.0, cs));
    // v1.0.2 card_scale clamp

    if (!Array.isArray(this._config.intervals) || this._config.intervals.length === 0) {
      this._config.intervals = deepClone(DEFAULT_INTERVALS);
    }
    this._config.intervals = this._config.intervals.map(normalizeInterval);

    // Badges (global overlay)
    if (!Array.isArray(this._config.badges)) this._config.badges = [];
    this._config.badges = this._config.badges.map(normalizeBadge);

    // Normalize tap_action + overlay positions
    const ta = String(this._config.tap_action || 'more-info');
    this._config.tap_action = (ta === 'toggle' || ta === 'none' || ta === 'more-info' || ta === 'call-service') ? ta : 'more-info';
    this._config.tap_starts_animation = (this._config.tap_starts_animation == null) ? true : !!this._config.tap_starts_animation;

    // Tap confirm safety (Gate/Garage/Blind)
    this._config.tap_confirm_open = !!this._config.tap_confirm_open;
    let _tcw = Number(this._config.tap_confirm_open_window);
    if (!Number.isFinite(_tcw) || _tcw <= 0) _tcw = 10;
    this._config.tap_confirm_open_window = Math.max(1, Math.min(60, Math.round(_tcw)));

    const posOk = new Set(['top_left','top_center','top_right','bottom_left','bottom_center','bottom_right']);
    const np = String(this._config.name_position || 'top_left');
    const sp = String(this._config.stats_position || 'bottom_center');
    this._config.name_position = posOk.has(np) ? np : 'top_left';
    this._config.stats_position = posOk.has(sp) ? sp : 'bottom_center';

    this._stats = null;
    this._lastStatsAt = 0;
    this._statsBusy = false;
    
  }

  static getConfigElement() { return document.createElement(EDITOR_TAG); }

  _getStateValue(entityId) {
    if (!entityId) return null;
    const st = this.hass?.states?.[entityId];
    if (!st) return null;
    return toNumberMaybe(st.state);
  }

  _getRawState(entityId) {
    if (!entityId) return null;
    const st = this.hass?.states?.[entityId];
    if (!st) return null;
    return st.state;
  }


  _getUnit() {
    if (this._config.unit) return this._config.unit;
    const st = this.hass?.states?.[this._config.entity];
    return st?.attributes?.unit_of_measurement ?? "";
  }

  _getUnitForEntity(entityId) {
    if (!entityId) return "";
    const st = this.hass?.states?.[entityId];
    return st?.attributes?.unit_of_measurement || "";
  }

  _isOnLikeState(entityId) {
    if (!entityId) return false;
    const st = this.hass?.states?.[entityId];
    if (!st) return false;
    const s = String(st.state || "").trim().toLowerCase();
    return (s === "on" || s === "true" || s === "1" || s === "charging" || s === "yes");
  }

  _chargingSuffix(stateEntityId, powerEntityId) {
    // Returns { str, html } where str starts with a leading space, e.g. " +3,9 kW"
    const isCharging = this._isOnLikeState(stateEntityId);
    if (!isCharging || !powerEntityId) return { str: "", html: "" };

    const p = this._getStateValue(powerEntityId);
    if (p == null) return { str: "", html: "" };

    const unit = this._getUnitForEntity(powerEntityId) || "kW";
    const locale = this.hass?.locale?.language || "sv-SE";
    const shown = fmtNumLocale(p, 1, locale);
    if (!shown) return { str: "", html: "" };

    const txt = ` +${shown} ${unit}`.replace("  ", " ");
    return {
      str: txt,
      html: html`<span class="charge">${txt}</span>`,
    };
  }

  _findIntervalForValue(value) {
    return this._findIntervalForStateOrValue(value, null, this._config.intervals);
  }

  _findIntervalForStateOrValue(value, rawState, intervalsIn) {
    const intervals = intervalsSortedByTo(intervalsIn);
    if (!intervals.length) return normalizeInterval(DEFAULT_INTERVALS[3]);

    const s = (rawState == null) ? "" : String(rawState).trim();
    const sl = s ? s.toLowerCase() : "";

    // 1) Static match has precedence (case-insensitive exact match)
    if (sl) {
      for (const it of intervals) {
        const m = (it && it.match != null) ? String(it.match).trim() : "";
        if (m && sl === m.toLowerCase()) return it;
      }
    }

    // 2) Numeric match (either supplied numeric value, or extracted from raw state like "Normal 55%")
    let v = Number(value);
    if (!Number.isFinite(v) && s) {
      const n = toNumberMaybe(s);
      if (Number.isFinite(n)) v = n;
    }
    if (Number.isFinite(v)) {
      for (const it of intervals) if (v <= Number(it.to)) return it;
      return intervals[intervals.length - 1];
    }

    // 3) Fallback: last interval
    return intervals[intervals.length - 1];
  }

  _intervalIndexForValue(value) {
    const intervals = intervalsSortedByTo(this._config.intervals);
    for (let i = 0; i < intervals.length; i++) {
      if (value <= intervals[i].to) return i;
    }
    return Math.max(0, intervals.length - 1);
  }

  
  _getIndustrialFrameStyle() {
    // Shared casing colors for industrial look (used by multiple symbols).
    // Keep liquid/segment colors driven by intervals; only casing/background gets updated.
/*    return {
      outline: "rgba(230,235,240,0.92)",
      outerFill: "rgba(190,200,210,0.10)",
      innerBg: "rgba(255,255,255,0.04)",
      cageStroke: "rgba(230,235,240,0.28)",
      cageStrokeStrong: "rgba(230,235,240,0.42)",
      frameStroke: "rgba(0,0,0,0.72)",
    };*/
  }
  
_applyInsideValueY() {
  const root = this.renderRoot;
  if (!root) return;

  const wrap = root.querySelector(".iconWrap");
  const svg = root.querySelector("svg.sensor-svg");
  if (!wrap || !svg) return;

  const ref = svg.querySelector(".value-ref");
  if (!ref || !ref.getBBox) return;

  let bb;
  try { bb = ref.getBBox(); } catch { return; }

  // Y i SVG-koordinater → procent av viewBox-höjd
  const vb = svg.viewBox.baseVal;
  if (!vb || vb.height === 0) return;

  const yPct = ((bb.y + bb.height / 2) / vb.height) * 100;

  wrap.style.setProperty("--asc-value-y", `${yPct}%`);
}  

  async _maybeUpdateStats() {
    if (!this.hass || !this._config?.show_stats) return;

    const now = Date.now();
    const throttleMs = 3 * 60 * 1000;
    if (this._statsBusy) return;
    if (this._lastStatsAt && (now - this._lastStatsAt) < throttleMs && this._stats) return;

    const hours = Number(this._config.stats_hours ?? 24);
    const hrs = Number.isFinite(hours) && hours > 0 ? hours : 24;

    const end = new Date();
    const start = new Date(end.getTime() - hrs * 3600 * 1000);
    const entityId = this._config.entity;
    if (!entityId) return;

    this._statsBusy = true;

    try {
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const path = `history/period/${encodeURIComponent(startIso)}?end_time=${encodeURIComponent(endIso)}&filter_entity_id=${encodeURIComponent(entityId)}&minimal_response`;
      const data = await this.hass.callApi("GET", path);

      const series = Array.isArray(data) && data.length ? data[0] : [];
      const nums = [];

      for (const item of series) {
        const raw = item?.state ?? item?.s;
        const n = toNumberMaybe(raw);
        if (n != null && Number.isFinite(n)) nums.push(n);
      }

      if (!nums.length) {
        this._stats = { min: null, avg: null, max: null, samples: 0 };
      } else {
        let min = nums[0], max = nums[0], sum = 0;
        for (const n of nums) {
          if (n < min) min = n;
          if (n > max) max = n;
          sum += n;
        }
        this._stats = { min, avg: sum / nums.length, max, samples: nums.length };
      }
      this._lastStatsAt = now;
    } catch (e) {
      console.warn("Andy Sensor Card v1.0.1: history fetch failed (REST)", e);
      this._stats = { min: null, avg: null, max: null, samples: 0, error: true };
      this._lastStatsAt = now;
    } finally {
      this._statsBusy = false;
    }
  }
  _syncPreviewScrollPersistence() {
    try {
      // Only relevant for HA visual editor preview + Image symbol (we wrap with .asc-preview-scroll)
      if (this.getAttribute("data-asc-preview") !== "1") return;
      const sym = String(this._config?.symbol || "");
      if (sym !== "image") return;

      const sc = this.renderRoot?.querySelector?.(".asc-preview-scroll");
      if (!sc) return;

      // Attach passive scroll listener once per scroll element
      if (!this._ascPrevScrollOnScroll) {
        this._ascPrevScrollOnScroll = () => {
          try {
            const el = this._ascPrevScrollEl;
            if (!el) return;
            this._ascPrevScroll = { left: el.scrollLeft || 0, top: el.scrollTop || 0 };
          } catch (_) {}
        };
      }

      if (this._ascPrevScrollEl !== sc) {
        // New scroll element after re-render (Lit may recreate nodes). Restore last known scroll.
        try {
          if (this._ascPrevScrollEl && this._ascPrevScrollOnScroll) {
            this._ascPrevScrollEl.removeEventListener("scroll", this._ascPrevScrollOnScroll);
          }
        } catch (_) {}

        this._ascPrevScrollEl = sc;
        try {
          // Mark to avoid double-hooking
          if (!sc.__ascHooked) {
            sc.__ascHooked = true;
            sc.addEventListener("scroll", this._ascPrevScrollOnScroll, { passive: true });
          }
        } catch (_) {}

        // Restore scroll position immediately (avoid one-frame jump to 0,0 when Lit recreates nodes)
        try {
          const wantL0 = (this._ascPrevScroll?.left || 0);
          const wantT0 = (this._ascPrevScroll?.top || 0);
          if (wantL0 || wantT0) {
            sc.scrollLeft = wantL0;
            sc.scrollTop = wantT0;
          }
        } catch (_) {}

        // Clamp once layout is ready (only when scroll area is measurable). Do NOT force to 0 if not scrollable yet.
        requestAnimationFrame(() => {
          try {
            const el = this._ascPrevScrollEl;
            if (!el) return;
            const sw = el.scrollWidth || 0;
            const sh = el.scrollHeight || 0;
            const maxLeft = Math.max(0, sw - (el.clientWidth || 0));
            const maxTop = Math.max(0, sh - (el.clientHeight || 0));
            const wantL = (this._ascPrevScroll?.left || 0);
            const wantT = (this._ascPrevScroll?.top || 0);
            if ((maxLeft > 0 || maxTop > 0) && (wantL || wantT)) {
              el.scrollLeft = clamp(wantL, 0, maxLeft);
              el.scrollTop = clamp(wantT, 0, maxTop);
            }
          } catch (_) {}
        });
      }
    } catch (_) {}
  }
updated(changedProps) {
  if (changedProps.has("hass") || changedProps.has("_config")) {
    this._maybeUpdateStats();
  }
  if (changedProps.has("hass") || changedProps.has("_config") || changedProps.has("_stats")) {
    this._drawScaleDom();
    this._drawSegmentsDom();
  }

  if (this._config?.value_position === "inside") {
    this._applyInsideValueY();
  }

  // Performance: only run symbol-specific DOM sync logic when relevant.
  const sym = String(this._config?.symbol || "battery_liquid");

  if (sym === "fan" || sym === "heatpump") {
    this._fanSyncAnimation();
  } else {
    try { this._fanStopAnimation(); } catch (_) {}
  }

  // Badge symbol DOM injection is only needed when badges render pending SVG markups.
  const pendingB = this._bdgSymPending;
  if (pendingB && Object.keys(pendingB).length) {
    this._badgeSymbolSyncDom();
  } else {
    try { this._badgeSymbolStop(); } catch (_) {}
  }

  if (sym === "garage_door" || sym === "blind") {
    this._garageSyncDom();
  } else {
    try { this._garageStopAnimation(); } catch (_) {}
  }

  if (sym === "gate") {
    this._gateSyncDom();
  } else {
    try { this._gateStopAnimation(); } catch (_) {}
  }

  // Keep preview scroll position stable in HA visual editor (Image symbol)
  this._syncPreviewScrollPersistence();
}

  disconnectedCallback() {
    try { this._fanStopAnimation(); } catch (_) {}
    try { this._badgeSymbolStop(); } catch (_) {}
    try { this._garageStopAnimation(); } catch (_) {}
    try { this._gateStopAnimation(); } catch (_) {}
    try {
      if (this._ascPrevScrollEl && this._ascPrevScrollOnScroll) {
        this._ascPrevScrollEl.removeEventListener("scroll", this._ascPrevScrollOnScroll);
      }
    } catch (_) {}
    this._ascPrevScrollEl = null;
    super.disconnectedCallback();
  }
_fanStopAnimation() {
  if (this._fanAnimRaf) {
    cancelAnimationFrame(this._fanAnimRaf);
    this._fanAnimRaf = 0;
  }
  this._fanAnimState = null;
}

_fanSyncAnimation() {
  // Fan uses DOM-injected SVG to ensure correct SVG namespace for dynamic blades/frame in Home Assistant.
  const sym = String(this._config?.symbol || "battery_liquid");
  if (sym !== "fan" && sym !== "heatpump") {
    this._fanStopAnimation();
    this._fanPendingMarkup = "";
    this._fanLastMarkup = "";
    return;
  }

  // Defer DOM injection to the next frame to avoid touching DOM during render.
  this._fanStopAnimation();
  this._fanAnimRaf = requestAnimationFrame(() => {
    this._fanAnimRaf = 0;

    const host = this.renderRoot?.querySelector(`#asc-fan-dom-${this._instanceId}`);
    if (!host) return;

    const markup = this._fanPendingMarkup || "";
    if (markup && markup !== this._fanLastMarkup) {
      host.innerHTML = markup;
      this._fanLastMarkup = markup;
    }
  });
}

// ---------------------------
// Garage door DOM sync (inject SVG markup like Fan to avoid SVG namespace/render quirks in HA)
// ---------------------------
_garageSyncDom() {
  const sym = String(this._config?.symbol || "battery_liquid");
  if (sym !== "garage_door" && sym !== "blind") {
    this._garageStopAnimation();
    this._gdPendingMarkup = "";
    this._gdLastMarkup = "";
    if (this._gdDomRaf) {
      cancelAnimationFrame(this._gdDomRaf);
      this._gdDomRaf = 0;
    }
    return;
  }

  if (this._gdDomRaf) cancelAnimationFrame(this._gdDomRaf);
  this._gdDomRaf = requestAnimationFrame(() => {
    this._gdDomRaf = 0;

    const host = this.renderRoot?.querySelector(`#asc-gd-dom-${this._instanceId}`);
    if (!host) return;

    const markup = this._gdPendingMarkup || "";
    if (markup && markup !== this._gdLastMarkup) {
      host.innerHTML = markup;
      this._gdLastMarkup = markup;
    }

    this._garageSyncAnimation();
    this._garageBindDoor2Tap(host);
  });
}



// Bind tap on Door 2 / Blind 2 so clicks on the right-hand opening trigger tap action for entity 2.
// This prevents the whole card click from always opening the main entity.
_garageBindDoor2Tap(host) {
  try {
    if (!host) return;
    if (host.__ascDoor2TapBound) return;
    host.__ascDoor2TapBound = true;

    host.addEventListener("click", (ev) => {
      const sym = String(this._config?.symbol || "battery_liquid");
      if (sym !== "garage_door" && sym !== "blind") return;

      const type = String(this._config?.garage_door_type || "single");
      if (type !== "double") return;

      const e2 = String(this._config?.garage_door_entity2 || "").trim();
      if (!e2) return;

      const t = ev?.target;
      if (!t || typeof t.closest !== "function") return;

      const doorEl = t.closest("[data-asc-door]");
      if (!doorEl) return;

      const idx = String(doorEl.getAttribute("data-asc-door") || "");
      if (idx !== "2") return;

      try { ev.stopImmediatePropagation?.(); } catch (_) {}
      try { ev.stopPropagation?.(); } catch (_) {}
      try { ev.preventDefault?.(); } catch (_) {}

      this._tapEntity(e2, ev);
    }, true);
  } catch (_) {}
}


// ---------------------------
// Gate DOM sync + animation (inject SVG markup like Fan/Garage to avoid SVG namespace/render quirks in HA)
// ---------------------------
_gateStopAnimation() {
  if (this._gateAnimRaf) {
    cancelAnimationFrame(this._gateAnimRaf);
    this._gateAnimRaf = 0;
  }
  // Keep last p for stable rendering if we come back.
}

_gateSyncDom() {
  const sym = String(this._config?.symbol || "battery_liquid");
  if (sym !== "gate") {
    this._gateStopAnimation();
    this._gatePendingMarkup = "";
    this._gateLastMarkup = "";
    if (this._gateDomRaf) {
      cancelAnimationFrame(this._gateDomRaf);
      this._gateDomRaf = 0;
    }
    return;
  }

  if (this._gateDomRaf) cancelAnimationFrame(this._gateDomRaf);
  this._gateDomRaf = requestAnimationFrame(() => {
    this._gateDomRaf = 0;

    const host = this.renderRoot?.querySelector(`#asc-gate-dom-${this._instanceId}`);
    if (!host) return;

    const markup = this._gatePendingMarkup || "";
    if (markup && markup !== this._gateLastMarkup) {
      host.innerHTML = markup;
      this._gateLastMarkup = markup;
    }

    this._gateSyncAnimation();
  });
}

_gateComputeTargetP() {
  try {
    const entityId = this._config?.entity;
    if (!entityId || !this.hass?.states?.[entityId]) return 0;

    const st = this.hass.states[entityId];

    // Prefer cover current_position if available
    const cp = st?.attributes?.current_position;
    if (cp != null && Number.isFinite(Number(cp))) {
      return clamp01(Number(cp) / 100);
    }

    // Numeric state -> respect min/max
    const n = toNumberMaybe(st.state);
    if (n != null && Number.isFinite(Number(n))) {
      let minS = Number(this._config.min ?? 0);
      let maxS = Number(this._config.max ?? 100);
      if (!Number.isFinite(minS)) minS = 0;
      if (!Number.isFinite(maxS)) maxS = 100;
      if (maxS < minS) [minS, maxS] = [maxS, minS];
      const range = (maxS - minS) || 1;
      return clamp01((Number(n) - minS) / range);
    }

    // Common text states
    const s = String(st.state ?? "").trim().toLowerCase();
    if (s === "open" || s === "opening") return 1;
    if (s === "closed" || s === "closing") return 0;

    // Switch-like fallback
    return this._isOnLikeState(entityId) ? 1 : 0;
  } catch (_) {
    return 0;
  }
}

_gateGetDurationMs() {
  try {
    const its = Array.isArray(this._config?.intervals) ? this._config.intervals : [];
    const first = its && its.length ? normalizeInterval(its[0]) : null;
    const sec = first && Number.isFinite(Number(first.seconds)) ? Number(first.seconds) : null;
    if (sec != null && sec > 0) return Math.max(250, Math.round(sec * 1000));
  } catch (_) {}
  return 1400;
}

_gateApplyTransform(pNow) {
  const p = clamp01(Number.isFinite(Number(pNow)) ? Number(pNow) : 0);

  const type = String(this._config?.gate_type || "sliding");
  const side = String(this._config?.gate_side || "left");

  // Background reveal (inside opening)
  const bg = this.renderRoot?.querySelector(`#asc-gate-bg-${this._instanceId}`);
  if (bg) {
    try { bg.setAttribute("opacity", String((0.08 + 0.35 * p).toFixed(3))); } catch (_) {}
  }

  if (type === "door") {
    const g = this.renderRoot?.querySelector(`#asc-gate-doorleaf-${this._instanceId}`);
    if (!g) return;
    const hx = Number(g.getAttribute("data-hx") || "0");
    const hy = Number(g.getAttribute("data-hy") || "0");

    const maxAng = 70; // degrees (visual, not a flat rotate)
    const rad = (maxAng * p) * (Math.PI / 180);
    const sx = Math.max(0.18, Math.cos(rad));
    const skew = (Math.sin(rad) * 18) * (side === "right" ? -1 : 1); // degrees

    // Keep hinge fixed by transforming around hinge point
    g.setAttribute(
      "transform",
      `translate(${hx.toFixed(2)} ${hy.toFixed(2)}) skewY(${skew.toFixed(2)}) scale(${sx.toFixed(4)} 1) translate(${-hx.toFixed(2)} ${-hy.toFixed(2)})`
    );
    return;
  }

  // Sliding: move the whole gate leaf sideways (like a real sliding gate)
  const g = this.renderRoot?.querySelector(`#asc-gate-slideleaf-${this._instanceId}`);
  if (!g) return;
  const openW = Number(g.getAttribute("data-openw") || "0");
  const dx = (side === "right") ? (openW * p) : (-openW * p);
  g.setAttribute("transform", `translate(${dx.toFixed(2)} 0)`);
}

_gateAnimateTo(targetP) {
  const tp = clamp01(Number.isFinite(Number(targetP)) ? Number(targetP) : 0);
  const now = performance.now();

  if (!this._gateAnim) {
    this._gateAnim = { p: tp, target: tp, startP: tp, startT: now, dur: 0 };
    this._gateApplyTransform(tp);
    return;
  }

  const cur = clamp01(Number.isFinite(Number(this._gateAnim.p)) ? Number(this._gateAnim.p) : tp);

  if (Math.abs(tp - (this._gateAnim.target ?? 0)) < 0.0005) {
    // still apply in case DOM was recreated
    this._gateApplyTransform(cur);
    return;
  }

  this._gateAnim = {
    p: cur,
    target: tp,
    startP: cur,
    startT: now,
    dur: this._gateGetDurationMs(),
  };

  if (this._gateAnimRaf) cancelAnimationFrame(this._gateAnimRaf);

  // Smooth (but continuous) easing over the whole movement (no per-interval pauses)
  const easeInOutCubic = (t) => (t < 0.5)
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const tick = () => {
    if (!this._gateAnim) { this._gateAnimRaf = 0; return; }

    const a = this._gateAnim;
    const elapsed = performance.now() - (Number(a.startT) || now);
    const dur = Math.max(1, Number(a.dur) || 1);
    const t = clamp01(elapsed / dur);
    const e = easeInOutCubic(t);

    const pNow = Number(a.startP) + (Number(a.target) - Number(a.startP)) * e;
    a.p = pNow;
    this._gateApplyTransform(pNow);

    if (t >= 1) {
      a.p = a.target;
      this._gateApplyTransform(a.p);
      this._gateAnimRaf = 0;
      return;
    }

    this._gateAnimRaf = requestAnimationFrame(tick);
  };

  this._gateAnimRaf = requestAnimationFrame(tick);
}

_gateSyncAnimation() {
  const sym = String(this._config?.symbol || "battery_liquid");
  if (sym !== "gate") {
    this._gateStopAnimation();
    return;
  }

  const now = performance.now();

  // If we started a predictive animation on tap, keep animating towards the manual target
  // until HA state catches up (or the timeout expires).
  if (this._gateManual && now < Number(this._gateManual.until || 0)) {
    const tpState = this._gateComputeTargetP();
    const manualTp = clamp01(Number(this._gateManual.target ?? 0));
    if (Math.abs(tpState - manualTp) < 0.02) {
      this._gateManual = null;
    } else {
      this._gateAnimateTo(manualTp);
      return;
    }
  }

  const tp = this._gateComputeTargetP();
  this._gateAnimateTo(tp);
}


// ---------------------------
// Garage door animation (JS-driven, always animates between changes)
// ---------------------------
_garageStopAnimation() {
  if (this._gdAnimRaf) {
    cancelAnimationFrame(this._gdAnimRaf);
    this._gdAnimRaf = 0;
  }
  // Keep last p so it renders stable if we come back.
}

_garageComputeTargetP(entityIdOverride) {
  try {
    const entityId = entityIdOverride || this._config?.entity;
    if (!entityId || !this.hass?.states?.[entityId]) return 0;

    const st = this.hass.states[entityId];

    // Prefer cover current_position if available
    let raw = null;
    const cp = st?.attributes?.current_position;
    if (cp != null && Number.isFinite(Number(cp))) raw = Number(cp);
    if (raw == null) raw = toNumberMaybe(st.state);

    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];

    // If the entity provides text states (opening/open/closing/closed), map them to min/max
    // so the animation can move even when no numeric position is available.
    if (raw == null || !Number.isFinite(Number(raw))) {
      const s = String(st.state ?? "").trim().toLowerCase();
      if (s === "open" || s === "opening") raw = maxS;
      else if (s === "closed" || s === "closing") raw = minS;
    }

    const range = (maxS - minS) || 1;
    const p = (raw != null && Number.isFinite(Number(raw))) ? clamp01((Number(raw) - minS) / range) : 0;
    return p;
  } catch (_) {
    return 0;
  }
}

_garageComputeTargets() {
  const type = String(this._config?.garage_door_type || "single");
  const isDouble = (type === "double");
  const tp1 = this._garageComputeTargetP(this._config?.entity);

  if (!isDouble) return { tp1, tp2: null };

  const e2 = String(this._config?.garage_door_entity2 || "").trim();
  const tp2 = e2 ? this._garageComputeTargetP(e2) : tp1;
  return { tp1, tp2 };
}

_garageApplyTransform(p, doorIndex = 1) {
  const idx = clampInt(doorIndex ?? 1, 1, 2, 1);

  const g = this.renderRoot?.querySelector(`#asc-gd-door-${this._instanceId}-${idx}`);
  if (!g) return false;

  const travel = Number(g.getAttribute('data-travel') || '0');
  const ty = -clamp01(p) * (Number.isFinite(travel) ? travel : 0);
  g.setAttribute('transform', `translate(0 ${ty.toFixed(2)})`);

  // Update the dynamic "opening" clip rect so the room/light is only visible in the opened area.
  const openRect = this.renderRoot?.querySelector(`#asc-gd-openrect-${this._instanceId}-${idx}`);
  if (openRect) {
    const iny = Number(openRect.getAttribute('data-iny') || '0');
    const inh = Number(openRect.getAttribute('data-inh') || '0');
    const openH = clamp01(p) * (Number.isFinite(inh) ? inh : 0);
    const y = (Number.isFinite(iny) ? iny : 0) + (Number.isFinite(inh) ? inh : 0) - openH;
    openRect.setAttribute('y', y.toFixed(2));
    openRect.setAttribute('height', openH.toFixed(2));
  }

  return true;
}

_garageBuildSegments() {
  try {
    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];
    const range = (maxS - minS) || 1;

    const raw = intervalsSortedByTo(this._config?.intervals || []);
    // Ignore helper/zero interval if it ends at min
    const usable = raw.filter(it => Number.isFinite(Number(it.to)) && Number(it.to) > (minS + 1e-9));
    const caps = usable.slice(0, 12);

    const bounds = [];
    let prevP = 0;
    for (const it of caps) {
      const p = clamp01((Number(it.to) - minS) / range);
      if (p <= prevP + 1e-6) continue;
      bounds.push({ p, seconds: (it && it.seconds != null) ? Number(it.seconds) : null });
      prevP = p;
      if (p >= 0.9999) break;
    }
    if (!bounds.length || bounds[bounds.length - 1].p < 0.9999) {
      bounds.push({ p: 1, seconds: null });
    }

    const defaultSec = 0.9; // nice baseline feel per section
    const segs = [];
    let p0 = 0;
    for (const b of bounds) {
      const p1 = clamp01(b.p);
      const span = Math.max(1e-6, p1 - p0);
      const sec = (Number.isFinite(b.seconds) && b.seconds > 0) ? b.seconds : defaultSec;
      segs.push({ p0, p1, durMs: Math.max(120, Math.round(sec * 1000)), span });
      p0 = p1;
    }
    return segs;
  } catch (_) {
    return null;
  }
}

_garageBuildSteps(pStart, pEnd) {
  const segs = this._garageBuildSegments();
  const ps = clamp01(pStart);
  const pe = clamp01(pEnd);
  if (!segs || !segs.length) {
    const delta = Math.abs(pe - ps);
    const dur = 850 + Math.round(delta * 650);
    return { steps: [{ from: ps, to: pe, durMs: dur }], totalMs: dur };
  }

  const dirUp = pe >= ps;
  const steps = [];
  let total = 0;

  if (dirUp) {
    for (const sg of segs) {
      const a = Math.max(ps, sg.p0);
      const b = Math.min(pe, sg.p1);
      if (b <= a + 1e-6) continue;
      const frac = (b - a) / Math.max(1e-6, (sg.p1 - sg.p0));
      const d = Math.max(120, Math.round(sg.durMs * frac));
      steps.push({ from: a, to: b, durMs: d });
      total += d;
    }
  } else {
    for (let i = segs.length - 1; i >= 0; i--) {
      const sg = segs[i];
      const a = Math.min(ps, sg.p1);
      const b = Math.max(pe, sg.p0);
      if (a <= b + 1e-6) continue;
      const frac = (a - b) / Math.max(1e-6, (sg.p1 - sg.p0));
      const d = Math.max(120, Math.round(sg.durMs * frac));
      steps.push({ from: a, to: b, durMs: d });
      total += d;
    }
  }

  if (!steps.length) {
    const delta = Math.abs(pe - ps);
    const dur = 450 + Math.round(delta * 450);
    return { steps: [{ from: ps, to: pe, durMs: dur }], totalMs: dur };
  }

  return { steps, totalMs: Math.max(200, total) };
}

_garageAnimateTo(targetP) {
  this._garageAnimateToTargets(targetP, null);
}

_garageAnimateToTargets(targetP1, targetP2) {
  const now = performance.now();

  const type = String(this._config?.garage_door_type || "single");
  const isDouble = (type === "double");

  const tp1 = clamp01(Number.isFinite(targetP1) ? targetP1 : 0);
  const tp2 = (isDouble && targetP2 != null) ? clamp01(Number.isFinite(targetP2) ? targetP2 : 0) : null;

  const wantDoors = isDouble ? 2 : 1;

  // Init state if needed or if door count changed
  if (!this._gdAnim || !Array.isArray(this._gdAnim.doors) || this._gdAnim.doors.length !== wantDoors) {
    const doors = [];
    for (let i = 0; i < wantDoors; i++) {
      const t = (i === 1 && tp2 != null) ? tp2 : tp1;
      doors.push({ p: t, target: t, startP: t, startT: now, dur: 0, steps: null });
      // Apply immediately so newly injected DOM reflects the state.
      this._garageApplyTransform(t, i + 1);
    }
    this._gdAnim = { doors };
    return;
  }

  const doors = this._gdAnim.doors;

  const targets = [tp1, tp2].filter((v, i) => i === 0 || wantDoors === 2);
  let anyChange = false;

  for (let i = 0; i < wantDoors; i++) {
    const d = doors[i];
    const tp = (i === 1) ? (tp2 ?? tp1) : tp1;

    if (!d) continue;

    // If unchanged, still apply transform in case HA recreated the DOM
    if (Math.abs(tp - (d.target ?? 0)) < 0.0005) {
      this._garageApplyTransform(d.p ?? tp, i + 1);
      continue;
    }

    anyChange = true;
    const cur = clamp01(Number.isFinite(d.p) ? d.p : tp);
    const plan = this._garageBuildSteps(cur, tp);

    doors[i] = {
      p: cur,
      target: tp,
      startP: cur,
      startT: now,
      dur: plan.totalMs,
      steps: plan.steps,
    };
  }

  if (!anyChange) return;

  if (this._gdAnimRaf) cancelAnimationFrame(this._gdAnimRaf);

  const easeInOutCubic = (t) => (t < 0.5)
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const tick = () => {
    if (!this._gdAnim || !Array.isArray(this._gdAnim.doors)) { this._gdAnimRaf = 0; return; }

    let allDone = true;

    for (let i = 0; i < wantDoors; i++) {
      const a = this._gdAnim.doors[i];
      if (!a) continue;

      const elapsed = performance.now() - (Number(a.startT) || now);
      const total = Math.max(1, Number(a.dur) || 1);

      const steps = Array.isArray(a.steps) ? a.steps : [{ from: a.startP, to: a.target, durMs: total }];

      if (elapsed < total - 0.5) allDone = false;

      const easedTime = easeInOutCubic(clamp01(elapsed / total)) * total;

      let tRemain = easedTime;
      let pNow = a.target;

      for (const st of steps) {
        const dms = Math.max(1, Number(st.durMs) || 1);
        if (tRemain <= dms) {
          const localT = Math.min(1, Math.max(0, tRemain / dms));
          pNow = Number(st.from) + (Number(st.to) - Number(st.from)) * localT;
          break;
        }
        tRemain -= dms;
      }

      a.p = pNow;
      this._garageApplyTransform(pNow, i + 1);

      if (elapsed >= total - 0.5) {
        a.p = a.target;
        this._garageApplyTransform(a.p, i + 1);
      }
    }

    if (allDone) {
      this._gdAnimRaf = 0;
      return;
    }

    this._gdAnimRaf = requestAnimationFrame(tick);
  };

  this._gdAnimRaf = requestAnimationFrame(tick);
}

_garageSyncAnimation() {
  const sym = String(this._config?.symbol || 'battery_liquid');
  if (sym !== 'garage_door' && sym !== 'blind') {
    this._garageStopAnimation();
    return;
  }

  const now = performance.now();

  // Predictive animation on tap: keep animating to the manual target until HA state updates.
  if (this._gdManual && now < Number(this._gdManual.until || 0)) {
    const { tp1: st1, tp2: st2 } = this._garageComputeTargets();
    const m1 = clamp01(Number(this._gdManual.tp1 ?? 0));
    const m2 = (this._gdManual.tp2 != null) ? clamp01(Number(this._gdManual.tp2)) : null;

    const done1 = Math.abs(clamp01(st1) - m1) < 0.02;
    const done2 = (m2 == null) ? true : Math.abs(clamp01((st2 == null) ? st1 : st2) - m2) < 0.02;

    if (done1 && done2) {
      this._gdManual = null;
    } else {
      this._garageAnimateToTargets(m1, m2);
      return;
    }
  }

  const { tp1, tp2 } = this._garageComputeTargets();
  this._garageAnimateToTargets(tp1, tp2);
}


// ---------------------------
// Predictive animation on tap (Gate / Garage door / Blind)
// ---------------------------
_startPredictiveMotion(sym) {
  try {
    const s = String(sym || "").trim().toLowerCase();
    if (s === "gate") return this._gatePredictiveStart();
    if (s === "garage_door" || s === "blind") return this._garagePredictiveStart();
  } catch (_) {}
}

_garagePredictiveStart() {
  try {
    // Current positions (prefer current animated p to avoid jumps)
    const stTargets = this._garageComputeTargets();
    const cur1 = Number.isFinite(this._gdAnim?.doors?.[0]?.p) ? this._gdAnim.doors[0].p : stTargets.tp1;
    const cur2 = (stTargets.tp2 != null)
      ? (Number.isFinite(this._gdAnim?.doors?.[1]?.p) ? this._gdAnim.doors[1].p : stTargets.tp2)
      : null;

    const tgt1 = (clamp01(cur1) > 0.5) ? 0 : 1;
    const tgt2 = (cur2 != null) ? ((clamp01(cur2) > 0.5) ? 0 : 1) : null;

    const plan1 = this._garageBuildSteps(cur1, tgt1);
    const plan2 = (tgt2 != null) ? this._garageBuildSteps(cur2, tgt2) : { totalMs: 0 };
    const totalMs = Math.max(Number(plan1?.totalMs || 0), Number(plan2?.totalMs || 0));

    this._gdManual = {
      tp1: tgt1,
      tp2: tgt2,
      until: performance.now() + Math.max(800, totalMs) + 1400,
    };

    this._garageAnimateToTargets(tgt1, tgt2);
  } catch (_) {}
}

_gatePredictiveStart() {
  try {
    const cur = Number.isFinite(this._gateAnim?.p) ? this._gateAnim.p : this._gateComputeTargetP();
    const tgt = (clamp01(cur) > 0.5) ? 0 : 1;

    this._gateManual = {
      target: tgt,
      until: performance.now() + 1800,
    };

    this._gateAnimateTo(tgt);
  } catch (_) {}
}


_openMoreInfo(ev) {
  const entityId = this._config?.entity;
  if (!entityId) return;

  this.dispatchEvent(new CustomEvent("hass-more-info", {
    detail: { entityId },
    bubbles: true,
    composed: true,
  }));
}
  

_openMoreInfoEntity(entityId) {
  if (!entityId) return;
  this.dispatchEvent(new CustomEvent("hass-more-info", {
    detail: { entityId },
    bubbles: true,
    composed: true,
  }));
}

_badgeValueText(entityId, decimalsOverride) {
  if (!entityId) return "—";
  const st = this.hass?.states?.[entityId];
  if (!st) return "—";

  const unit = st.attributes?.unit_of_measurement ?? "";
  const locale = this.hass?.locale?.language || "sv-SE";

  const n = toNumberMaybe(st.state);
  if (n == null) {
    const s = String(st.state ?? "").trim();
    return unit ? `${s} ${unit}`.replace("  ", " ") : s;
  }

  let dec = decimalsOverride;
  if (dec == null || !Number.isFinite(Number(dec))) {
    dec = Number(this._config?.decimals ?? 0);
    if (!Number.isFinite(dec)) dec = 0;
  }
  const shown = fmtNumLocale(n, dec, locale);
  return unit ? `${shown} ${unit}`.replace("  ", " ") : String(shown);
}

_fmtIsoLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const locale = this.hass?.locale?.language || "sv-SE";
  return d.toLocaleString(locale);
}

_fmtIsoRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const absMs = Math.abs(diffMs);
  const sec = Math.round(absMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  let s = "";
  if (sec < 60) s = `${sec}s`;
  else if (min < 60) s = `${min}m`;
  else if (hr < 48) s = `${hr}h`;
  else s = `${day}d`;

  return diffMs >= 0 ? `${s} ago` : `in ${s}`;
}


_applyEntityTemplate(entityId, template, opts = {}) {
  if (template == null) return "";
  const s = String(template);
  if (!s.includes("<")) return s; // fast path

  const st = entityId ? this.hass?.states?.[entityId] : null;

  const valueTxt = (opts.valueTextOverride != null)
    ? String(opts.valueTextOverride)
    : this._badgeValueText(entityId, opts.decimals);

  const stateTxt = st ? String(st.state ?? "") : "—";
  const unitTxt  = st ? String(st.attributes?.unit_of_measurement ?? "") : "";
  const nameTxt  = st ? String(st.attributes?.friendly_name ?? entityId ?? "") : String(entityId ?? "");
  const idTxt    = String(entityId ?? "");
  const domainTxt = idTxt.includes(".") ? idTxt.split(".", 1)[0] : "";
  const lcIso = st ? String(st.last_changed ?? "") : "";
  const luIso = st ? String(st.last_updated ?? "") : "";

  const map = {
    value: valueTxt,
    state: stateTxt,
    name: nameTxt,
    unit: unitTxt,
    entity_id: idTxt,
    domain: domainTxt,
    last_changed: this._fmtIsoLocal(lcIso),
    last_updated: this._fmtIsoLocal(luIso),
    last_changed_iso: lcIso,
    last_updated_iso: luIso,
    last_changed_rel: this._fmtIsoRelative(lcIso),
    last_updated_rel: this._fmtIsoRelative(luIso),
  };

  let out = s;

  // Attributes: <attr:foo>
  out = out.replace(/<attr:([a-zA-Z0-9_]+)>/gi, (_, key) => {
    if (!st) return "";
    const v = st.attributes?.[key];
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  });

  // Simple tokens
  out = out.replace(/<value>/gi, map.value);
  out = out.replace(/<state>/gi, map.state);
  out = out.replace(/<name>/gi, map.name);
  out = out.replace(/<unit>/gi, map.unit);
  out = out.replace(/<entity_id>/gi, map.entity_id);
  out = out.replace(/<domain>/gi, map.domain);

  out = out.replace(/<last_changed_rel>/gi, map.last_changed_rel);
  out = out.replace(/<last_updated_rel>/gi, map.last_updated_rel);
  out = out.replace(/<last_changed_iso>/gi, map.last_changed_iso);
  out = out.replace(/<last_updated_iso>/gi, map.last_updated_iso);
  out = out.replace(/<last_changed>/gi, map.last_changed);
  out = out.replace(/<last_updated>/gi, map.last_updated);

  return out;
}

_onBadgeTap(ev, badge) {
  try { ev?.stopPropagation?.(); } catch (e) {}
  try { ev?.preventDefault?.(); } catch (e) {}

  const b = normalizeBadge(badge || {});
  if (this._suppressBadgeClickId && String(this._suppressBadgeClickId) === String(b.id)) {
    this._suppressBadgeClickId = null;
    return;
  }

  const entityId = b.entity;
  const act = b.tap_action?.action || "more-info";
  if (act === "none") return;

  if (act === "more-info") {
    this._openMoreInfoEntity(entityId);
    return;
  }
  if (act === "toggle") {
    if (!entityId) return;
    this.hass?.callService?.("homeassistant", "toggle", { entity_id: entityId });
    return;
  }

  if (act === "call-service") {
    const svc = String(b.tap_action?.service || "").trim();
    if (!svc || svc.indexOf(".") === -1) return;
    const [domain, service] = svc.split(".", 2);
    if (!domain || !service) return;

    let data = {};
    const sd = b.tap_action?.service_data;
    if (sd && typeof sd === "object") data = sd;
    else if (typeof sd === "string" && sd.trim()) {
      try { data = JSON.parse(sd); } catch (e) { data = {}; }
    }

    if (entityId && (data.entity_id == null) && domain !== "script") data.entity_id = entityId;

    this.hass?.callService?.(domain, service, data);
    return;
  }
}

// ---------------- Badge Slider ----------------
_badgeSliderMeta(badge) {
  const b = normalizeBadge(badge || {});
  const entityId = b.entity || "";
  const st = entityId ? (this.hass?.states?.[entityId] || null) : null;
  const domain = entityId.includes(".") ? entityId.split(".", 1)[0] : "";

  // Defaults per domain
  let autoMin = 0;
  let autoMax = 100;
  let autoStep = 1;

  if (st && (domain === "number" || domain === "input_number")) {
    const amin = parseFloat(st.attributes?.min);
    const amax = parseFloat(st.attributes?.max);
    const astep = parseFloat(st.attributes?.step);
    if (Number.isFinite(amin)) autoMin = amin;
    if (Number.isFinite(amax)) autoMax = amax;
    if (Number.isFinite(astep) && astep > 0) autoStep = astep;
  }

  const min = (Number.isFinite(b.slider_min) ? b.slider_min : autoMin);
  const max = (Number.isFinite(b.slider_max) ? b.slider_max : autoMax);
  const step = (Number.isFinite(b.slider_step) && b.slider_step > 0) ? b.slider_step : autoStep;

  let value = min;
  let displayValue = "—";

  if (st) {
    if (domain === "light") {
      const br = parseFloat(st.attributes?.brightness);
      const pct = Number.isFinite(br) ? Math.round((br / 255) * 100) : (st.state === "on" ? 100 : 0);
      value = clamp(pct, 0, 100);
      displayValue = `${Math.round(value)}%`;
    } else if (domain === "cover") {
      const pos = parseFloat(st.attributes?.current_position ?? st.attributes?.position);
      const v = Number.isFinite(pos) ? pos : (st.state === "open" ? 100 : 0);
      value = clamp(v, 0, 100);
      displayValue = `${Math.round(value)}%`;
    } else {
      const v = parseFloat(st.state);
      if (Number.isFinite(v)) {
        value = clamp(v, min, max);
        const unit = st.attributes?.unit_of_measurement;
        displayValue = unit ? `${value}${unit}` : String(value);
      } else {
        value = min;
        displayValue = String(st.state ?? "—");
      }
    }
  }

  const orientation = (String(b.slider_orientation || "horizontal").toLowerCase() === "vertical") ? "vertical" : "horizontal";
  const update = (String(b.slider_update || "release").toLowerCase() === "live") ? "live" : "release";

  return { min, max, step, value, displayValue, orientation, update };
}

_badgeDragEnabled() {
  try {
    // Drag & drop is always enabled in the visual editor preview only.
    return (this.getAttribute("data-asc-preview") === "1");
  } catch (e) {
    return false;
  }
}

_onBadgeDragStart(ev, badge) {
  try {
    if (!this._badgeDragEnabled()) return;
    if (!ev || !badge) return;
    // Do not start drag from sliders / inputs
    const path = ev.composedPath ? ev.composedPath() : [];
    for (const n of path) {
      const tn = String(n?.tagName || "").toLowerCase();
      if (tn === "input" || tn === "ha-slider" || tn === "ha-switch") return;
      if (n?.classList && (n.classList.contains("bSlider") || n.classList.contains("bSliderWrap"))) return;
    }
    if (ev.button != null && ev.button !== 0) return;

    const b = normalizeBadge(badge || {});
    const el = ev.currentTarget;
    if (!el || !b.id) return;

    const layer = this.renderRoot?.querySelector?.(".asc-badges-layer");
    if (!layer) return;

    const br = el.getBoundingClientRect();
    const cx = br.left + br.width / 2;
    const cy = br.top + br.height / 2;

    const start = {
      id: String(b.id),
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      offCX: ev.clientX - cx,
      offCY: ev.clientY - cy,
      moved: false,
      el,
      layer,
    };

    this._bdgDrag = start;

    // capture pointer so we keep getting moves even if pointer leaves the badge
    try { el.setPointerCapture(ev.pointerId); } catch (e) {}

    const onMove = (e) => this._onBadgeDragMove(e);
    const onEnd = (e) => this._onBadgeDragEnd(e);

    // attach to window for reliability
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd, { passive: false });
    window.addEventListener("pointercancel", onEnd, { passive: false });

    start._onMove = onMove;
    start._onEnd = onEnd;
  } catch (e) {}
}

_onBadgeDragMove(ev) {
  try {
    const st = this._bdgDrag;
    if (!st) return;
    if (ev.pointerId != null && st.pointerId != null && ev.pointerId !== st.pointerId) return;

    const dx = ev.clientX - st.startX;
    const dy = ev.clientY - st.startY;
    if (!st.moved) {
      if ((dx*dx + dy*dy) < 16) return; // ~4px threshold
      st.moved = true;
      try { st.el.classList.add("dragging"); } catch (e) {}
    }

    // prevent the editor/dialog from scrolling while dragging
    try { ev.preventDefault(); } catch (e) {}

    const layer = st.layer;
    const lr = layer.getBoundingClientRect();

    const newCX = ev.clientX - st.offCX;
    const newCY = ev.clientY - st.offCY;

    const px = (newCX - lr.left) / (lr.width || 1);
    const py = (newCY - lr.top) / (lr.height || 1);

    const x = Math.max(0, Math.min(100, px * 100));
    const y = Math.max(0, Math.min(100, py * 100));

    // Apply visually immediately (do NOT mutate config here)
    st.el.style.left = `${x}%`;
    st.el.style.top = `${y}%`;

    st.lastX = x;
    st.lastY = y;
  } catch (e) {}
}

_onBadgeDragEnd(ev) {
  try {
    const st = this._bdgDrag;
    if (!st) return;
    if (ev && ev.pointerId != null && st.pointerId != null && ev.pointerId !== st.pointerId) return;

    // cleanup listeners
    try {
      window.removeEventListener("pointermove", st._onMove);
      window.removeEventListener("pointerup", st._onEnd);
      window.removeEventListener("pointercancel", st._onEnd);
    } catch (e) {}

    try { st.el.releasePointerCapture(st.pointerId); } catch (e) {}

    try { st.el.classList.remove("dragging"); } catch (e) {}

    // If we actually dragged, suppress click and emit final position
    if (st.moved && Number.isFinite(st.lastX) && Number.isFinite(st.lastY)) {
      this._suppressBadgeClickId = st.id;

      this.dispatchEvent(new CustomEvent("asc-badge-drag-end", {
        detail: { id: st.id, x: st.lastX, y: st.lastY },
        bubbles: true,
        composed: true,
      }));
    }

    this._bdgDrag = null;
  } catch (e) {
    this._bdgDrag = null;
  }
}


_badgeSliderSend(badge, rawVal) {
  const b = normalizeBadge(badge || {});
  const entityId = b.entity || "";
  if (!entityId || !this.hass?.callService) return;

  const domain = entityId.includes(".") ? entityId.split(".", 1)[0] : "";
  const v = Number.isFinite(rawVal) ? rawVal : 0;

  // Route per domain
  if (domain === "light") {
    const pct = clamp(Math.round(v), 0, 100);
    if (pct <= 0) {
      this.hass.callService("light", "turn_off", { entity_id: entityId });
    } else {
      this.hass.callService("light", "turn_on", { entity_id: entityId, brightness_pct: pct });
    }
    return;
  }

  if (domain === "cover") {
    const pos = clamp(Math.round(v), 0, 100);
    this.hass.callService("cover", "set_cover_position", { entity_id: entityId, position: pos });
    return;
  }

  if (domain === "number") {
    this.hass.callService("number", "set_value", { entity_id: entityId, value: v });
    return;
  }

  if (domain === "input_number") {
    this.hass.callService("input_number", "set_value", { entity_id: entityId, value: v });
    return;
  }

  // Fallback: try homeassistant.turn_on with a "value" (may not work for all domains)
  try {
    this.hass.callService("homeassistant", "turn_on", { entity_id: entityId, value: v });
  } catch (e) {}
}

_badgeSliderSchedule(badge, rawVal) {
  const b = normalizeBadge(badge || {});
  const key = b.id || (b.entity || "") || "slider";
  if (!this._badgeSliderTimers) this._badgeSliderTimers = new Map();

  const prev = this._badgeSliderTimers.get(key);
  if (prev) {
    try { clearTimeout(prev); } catch(e) {}
    this._badgeSliderTimers.delete(key);
  }

  const t = setTimeout(() => {
    this._badgeSliderTimers.delete(key);
    this._badgeSliderSend(b, rawVal);
  }, 160);

  this._badgeSliderTimers.set(key, t);
}

_onBadgeSliderInput(ev, badge) {
  try { ev?.stopPropagation?.(); } catch(e) {}
  const meta = this._badgeSliderMeta(badge);
  if (meta.update !== "live") return;
  const v = parseFloat(ev?.target?.value);
  if (!Number.isFinite(v)) return;
  this._badgeSliderSchedule(badge, v);
}

_onBadgeSliderChange(ev, badge) {
  try { ev?.stopPropagation?.(); } catch(e) {}
  const v = parseFloat(ev?.target?.value);
  if (!Number.isFinite(v)) return;
  // Always send on change (release) – also acts as final value for "live"
  this._badgeSliderSend(badge, v);
}




  // ---------------------------
  // Tap confirm safety (Gate/Garage/Blind)
  // ---------------------------
  _isClosedLikeState(stateRaw) {
    const s = String(stateRaw ?? "").trim().toLowerCase();
    return (s === "closed" || s === "off" || s === "false" || s === "0");
  }

  _clearTapConfirmOpen() {
    if (this._tapConfirmTimer) {
      try { clearTimeout(this._tapConfirmTimer); } catch (_) {}
      this._tapConfirmTimer = 0;
    }
    this._tapConfirmOpen = null;
    try { this.requestUpdate?.(); } catch (_) {}
  }

  _armTapConfirmOpen(payload) {
    const win = Math.max(1, Math.round(Number(this._config?.tap_confirm_open_window) || 10));
    const until = Date.now() + win * 1000;
    this._tapConfirmOpen = { ...(payload || {}), until };

    if (this._tapConfirmTimer) {
      try { clearTimeout(this._tapConfirmTimer); } catch (_) {}
      this._tapConfirmTimer = 0;
    }

    this._tapConfirmTimer = setTimeout(() => {
      if (this._tapConfirmOpen && Date.now() >= (this._tapConfirmOpen.until || 0)) {
        this._tapConfirmOpen = null;
        this._tapConfirmTimer = 0;
        try { this.requestUpdate?.(); } catch (_) {}
      }
    }, win * 1000 + 50);

    try { this.requestUpdate?.(); } catch (_) {}
  }

  _onTapConfirmLock(ev) {
    try { ev?.stopPropagation?.(); } catch (_) {}
    try { ev?.preventDefault?.(); } catch (_) {}

    const p = this._tapConfirmOpen;
    if (!p || Date.now() > (p.until || 0)) {
      this._clearTapConfirmOpen();
      return;
    }

    const act = String(p.act || "");
    const entityId = String(p.entityId || "");

    try {
      if (act === "toggle") {
        this.hass?.callService?.("homeassistant", "toggle", { entity_id: entityId });
      } else if (act === "call-service") {
        const svc = String(p.svc || "").trim();
        if (svc && svc.indexOf(".") > 0) {
          const [domain, service] = svc.split(".", 2);
          const data = (p.data && typeof p.data === "object") ? p.data : {};
          this.hass?.callService?.(domain, service, data);
        }
      } else if (act === "more-info") {
        this._openMoreInfoEntity?.(entityId);
      }
    } catch (_) {}

    this._clearTapConfirmOpen();
  }

  _renderTapConfirmLock() {
    try {
      const sym = String(this._config?.symbol || "").trim().toLowerCase();
      if (!(sym === "gate" || sym === "garage_door" || (sym === "blind" && String(this._config?.blind_style || "persienne").trim().toLowerCase() !== "window"))) return html``;
      if (!this._config?.tap_confirm_open) return html``;

      const p = this._tapConfirmOpen;
      if (!p || Date.now() > (p.until || 0)) return html``;

      return html`
        <div class="tapConfirmLock" @click=${(e) => this._onTapConfirmLock(e)} title="Tap to confirm open">
          <ha-icon .icon=${"mdi:lock"}></ha-icon>
        </div>
      `;
    } catch (_) {
      return html``;
    }
  }


  _tapEntity(entityId, ev){
    try { ev?.stopPropagation?.(); } catch (e) {}
    try { ev?.preventDefault?.(); } catch (e) {}

    const act = String(this._config?.tap_action || 'more-info');
    if (!this.hass || !entityId || act === 'none') return;

    // Safety confirm: when state is closed, first tap shows a lock that must be confirmed within X seconds (Gate/Garage/Blind).
    try {
      const sym = String(this._config?.symbol || "").trim().toLowerCase();
      const confirmOn = !!this._config?.tap_confirm_open;
      if (confirmOn && (sym === "gate" || sym === "garage_door" || (sym === "blind" && String(this._config?.blind_style || "persienne").trim().toLowerCase() !== "window")) && (act === "toggle" || act === "call-service")) {
        const st = this.hass?.states?.[entityId];
        const raw = st?.state;
        if (this._isClosedLikeState(raw)) {
          if (act === "toggle") {
            this._armTapConfirmOpen({ entityId, act: "toggle" });
          } else {
            const svc = String(this._config?.tap_action_service || "").trim();
            let data = {};
            const sd = this._config?.tap_action_service_data;
            if (sd && typeof sd === "object") data = sd;
            else if (typeof sd === "string" && sd.trim()) {
              try { data = JSON.parse(sd); } catch (e) { data = {}; }
            }
            this._armTapConfirmOpen({ entityId, act: "call-service", svc, data });
          }
          return;
        } else {
          // If the entity is not closed anymore, clear any pending lock
          if (this._tapConfirmOpen) this._clearTapConfirmOpen();
        }
      }
    } catch (_) {}

    // Predictive animation: for Gate/Garage door/Blind, start moving immediately on tap (useful when the sensor updates state late).
    try {
      const sym = String(this._config?.symbol || "").trim().toLowerCase();
      const predictiveOn = (this._config?.tap_starts_animation == null) ? true : !!this._config.tap_starts_animation;
      if (predictiveOn && (act === "toggle" || act === "call-service") && (sym === "gate" || sym === "garage_door" || sym === "blind")) {
        this._startPredictiveMotion(sym);
      }
    } catch (_) {}

    if (act === 'toggle') {
      this.hass.callService('homeassistant', 'toggle', { entity_id: entityId });
      return;
    }

    if (act === 'call-service') {
      const svc = String(this._config?.tap_action_service || '').trim();
      if (!svc || svc.indexOf('.') === -1) return;
      const [domain, service] = svc.split('.', 2);

      let data = {};
      const sd = this._config?.tap_action_service_data;
      if (sd && typeof sd === "object") data = sd;
      else if (typeof sd === "string" && sd.trim()) {
        try { data = JSON.parse(sd); } catch (e) { data = {}; }
      }
      if (entityId && (data.entity_id == null) && domain !== "script") data.entity_id = entityId;

      this.hass?.callService?.(domain, service, data);
      return;
    }

 
    // Default: more-info
    this._openMoreInfoEntity(entityId);
  }


  _onMainTap(ev){
    const entityId = this._config?.entity;
    this._tapEntity(entityId, ev);
  }


  _renderNameOverlay(name){
    const pos = String(this._config?.name_position || 'top_left');
    if (!name) return '';
    return html`<div class="nameOverlay pos-${pos}">${name}</div>`;
  }

  _renderStatsOverlay(stats, decimals, unit){
    const pos = String(this._config?.stats_position || 'bottom_center');
    return html`<div class="statsOverlay pos-${pos}">${this._renderStatsRow(stats, decimals, unit)}</div>`;
  }
_findIntervalForValueCustom(value, intervals) {
  return this._findIntervalForStateOrValue(value, null, intervals);
}

_badgeIntervalForEntity(entityId, intervals) {
  if (!entityId || !Array.isArray(intervals) || intervals.length === 0) return null;
  const st = this.hass?.states?.[entityId];
  if (!st) return null;

  // Static match has precedence
  const rawS = String(st.state ?? "").trim();
  const itStatic = this._findIntervalForStateOrValue(null, rawS, intervals);
  if (itStatic && itStatic.match && String(itStatic.match).trim()) {
    return normalizeInterval(itStatic);
  }

  let v = toNumberMaybe(st.state);
  if (!Number.isFinite(v)) {
    const s = String(st.state || "").trim().toLowerCase();
    const onLike = (s === "on" || s === "true" || s === "1" || s === "charging" || s === "yes" || s === "open" || s === "home" || s === "playing");
    v = onLike ? 1 : 0;
  }

  return normalizeInterval(this._findIntervalForStateOrValue(v, rawS, intervals));
}

_badgeIconColor(entityId, intervals = null) {
  // If badge has its own intervals and icon_color_by_state is enabled,
  // prefer those colors for the icon.
  if (intervals && Array.isArray(intervals) && intervals.length) {
    const it = this._badgeIntervalForEntity(entityId, intervals);
    if (it && it.icon_color && String(it.icon_color).trim()) return String(it.icon_color).trim();
    if (it && it.color) return it.color;
  }

  if (!entityId) return null;
  const st = this.hass?.states?.[entityId];
  if (!st) return null;

  // Fallback highlight logic:
  // - Numeric state > 0 => highlight
  // - Otherwise treat common "on-like" states as highlight
  const num = toNumberMaybe(st.state);
  if (Number.isFinite(num)) {
    return (num > 0) ? "#EFC701" : null;
  }

  const s = String(st.state || "").trim().toLowerCase();
  const onLike = (s === "on" || s === "true" || s === "1" || s === "charging" || s === "yes" || s === "open" || s === "home" || s === "playing");
  return onLike ? "#EFC701" : null;
}


_intervalForEntityFallback(entityId) {
  if (!entityId) return null;
  const st = this.hass?.states?.[entityId];
  if (!st) return null;
  const intervals = Array.isArray(this._config?.intervals) ? this._config.intervals : [];
  if (!intervals.length) return null;
  const rawS = String(st.state ?? "").trim();
  // Static match precedence
  const itStatic = this._findIntervalForStateOrValue(null, rawS, intervals);
  if (itStatic && itStatic.match && String(itStatic.match).trim()) return normalizeInterval(itStatic);
  let v = toNumberMaybe(st.state);
  if (!Number.isFinite(v)) {
    const s = String(st.state || "").trim().toLowerCase();
    const onLike = (s === "on" || s === "true" || s === "1" || s === "charging" || s === "yes" || s === "open" || s === "home" || s === "playing");
    v = onLike ? 1 : 0;
  }
  return normalizeInterval(this._findIntervalForStateOrValue(v, rawS, intervals));
}

_badgeSymbolStop() {
  if (this._bdgSymRaf) {
    cancelAnimationFrame(this._bdgSymRaf);
    this._bdgSymRaf = 0;
  }
}

_badgeSymbolSyncDom() {
  // Inject badge fan/heatpump SVG markup after render (SVG namespace safe, like main fan).
  this._badgeSymbolStop();
  const pending = this._bdgSymPending || {};
  const last = this._bdgSymLast || (this._bdgSymLast = {});
  this._bdgSymRaf = requestAnimationFrame(() => {
    this._bdgSymRaf = 0;
    const root = this.renderRoot;
    if (!root) return;
    const keep = new Set(Object.keys(pending));
    for (const hostId of Object.keys(pending)) {
      const host = root.querySelector(`#${hostId}`);
      if (!host) continue;
      const mk = pending[hostId] || "";
      if (mk && mk !== last[hostId]) {
        host.innerHTML = mk;
        last[hostId] = mk;
      }
    }
    // Cleanup last entries that are no longer rendered
    for (const k of Object.keys(last)) {
      if (!keep.has(k)) delete last[k];
    }
  });
}


_renderBadgesLayer(isHorizontal) {
  const badges = Array.isArray(this._config?.badges) ? this._config.badges : [];
  if (!badges.length) return "";

  // Collect DOM-injected badge symbol markups (fan/heatpump)
  this._bdgSymPending = {};

  const isArrowStyle = (s) => (s === "left_arrow" || s === "right_arrow" || s === "top_arrow" || s === "bottom_arrow");
  const isRecycleStyle = (s) => (s === "recycle_left" || s === "recycle_right");

  const intervalBg = (it) => {
    if (!it) return null;
    const g = it.gradient;
    if (g && g.enabled && g.from && g.to) {
      return `linear-gradient(90deg, ${g.from}, ${g.to})`;
    }
    return it.color || null;
  };

  return html`
    <div class="asc-badges-layer">
      ${badges.map((raw, idx) => {
        const b = normalizeBadge(raw);
        if (!b.entity) return "";

        const baseValueTxt = this._badgeValueText(b.entity, b.decimals);

        // Badge-specific interval colors (optional)
        const it = this._badgeIntervalForEntity(b.entity, b.intervals);

        // Optional: interval "New value" template can override the value that <value> expands to for this badge
        const valueTxt = (it && it.new_value != null && String(it.new_value).trim() !== "")
          ? this._applyEntityTemplate(b.entity, String(it.new_value), { decimals: b.decimals, valueTextOverride: baseValueTxt })
          : baseValueTxt;

        const label = this._applyEntityTemplate(b.entity, (b.label ?? "<value>"), { decimals: b.decimals, valueTextOverride: valueTxt });

        // Optional: interval icon override can replace the badge icon while this interval is active
        const iconUse = (it && it.icon != null && String(it.icon).trim() !== "")
          ? String(it.icon).trim()
          : String(b.icon || "").trim();

        const itBg = intervalBg(it);
        const itBorder = (it && (it.outline || it.color)) ? (it.outline || it.color) : null;

        // Detect badge-specific shape styles
        const arrow = isArrowStyle(b.style);
        const recycle = isRecycleStyle(b.style);
        const flow = (b.arrow_animation && arrow);
        const spin = (b.arrow_animation && recycle);

        // Icon color rules:
        // - If a badge-interval is active, it overrides icon-color-from-state.
        //   If interval.icon_color is set, use it; otherwise use the badge text color.
        // - If no interval is active, honor icon_color_by_state as before.
        const iconColor = (it && it.icon_color && String(it.icon_color).trim())
          ? String(it.icon_color).trim()
          : (it
              ? "var(--asc-bdg-txt)"
              : ((b.icon_color_by_state)
                  ? (this._badgeIconColor(b.entity, b.intervals) || "var(--asc-bdg-txt)")
                  : "var(--asc-bdg-txt)"
                )
            );

        // Badge image (optional)
        const useImg = !!b.use_image;
        const imgUrl = useImg ? this._getBadgeImageUrl(b) : "";
        const imgFit = (String(b.img_fit || "cover").toLowerCase() === "contain") ? "contain" : "cover";
        const baseImgOpacity = Number.isFinite(Number(b.img_opacity)) ? Number(b.img_opacity) : 1;
        const dimImgOff = !!b.img_dim_when_off;
        const dimImgFactor = Number.isFinite(Number(b.img_dim_when_off_opacity)) ? Number(b.img_dim_when_off_opacity) : 0.45;
        const isOnB = this._isOnLikeState(b.entity);
        let imgOpacity = clamp01(baseImgOpacity);
        let imgFilter = "none";
        if (dimImgOff && !isOnB) {
          imgOpacity = clamp01(imgOpacity * clamp01(dimImgFactor));
          imgFilter = "grayscale(1)";
        }
        const imgRadius = clampInt(b.img_radius ?? 8, 0, 48, 8);
        const imgTintOn = !!b.img_tint;
        const imgTintColor = String(b.img_tint_color || "#000000").trim() || "#000000";
        const imgTintOpacity = Number.isFinite(Number(b.img_tint_opacity)) ? Number(b.img_tint_opacity) : 0;
        const imgFrameOn = !!b.img_frame;
        const imgFrameW = clampInt(b.img_frame_width ?? 2, 0, 10, 2);
        const imgFrameC = String(b.img_frame_color || "rgba(255,255,255,0.22)");

// Override colors depending on style
let bg = b.bg_color;
let brd = b.border_color;
let txt = b.text_color;

// For arrow/recycle styles: intervals color the SHAPE only (not the badge container)
// shapeFill can be a solid color or a CSS gradient string (used for arrow shapes)
// shapeStroke is a solid color (used for recycle strokes/heads)
let shapeFill = b.bg_color;
let shapeStroke = b.border_color;

if (it) {
  const itSolid = it.color || null;
  const itStroke = (it.outline || it.color) || null;

  if (arrow || recycle) {
    // Paint the arrow/recycle graphic using the badge-level interval
    shapeFill = itBg || itSolid || shapeFill;
    shapeStroke = itStroke || itSolid || shapeStroke;
  } else if (itBg) {
    if (b.style === "none") {
      txt = itSolid || txt;
    } else if (b.style === "outline") {
      brd = itStroke || brd;
    } else {
      bg = itBg;
      brd = itStroke || brd;
    }
  }
}

// Arrow/recycle container is always transparent; only the graphic is colored
if (arrow || recycle) {
  bg = "transparent";
  brd = "transparent";
}

const styleVars = [
          `left:${b.x}%;`,
          `top:${b.y}%;`,
          (Number.isFinite(b.opacity) && clamp01(b.opacity) < 1) ? `opacity:${clamp01(b.opacity)};` : ``,
          `--asc-bdg-bg:${bg};`,
          `--asc-bdg-txt:${txt};`,
          `--asc-bdg-ico:${iconColor};`,
          `--asc-bdg-brd:${brd};`,
          `--asc-bdg-shape:${shapeFill};`,
          `--asc-bdg-shape-stroke:${shapeStroke};`,
          `--asc-bdg-pad:${b.padding}px;`,
          `--asc-bdg-rad:${b.radius}px;`,
          `--asc-bdg-fs:${b.font_size}px;`,
          `--asc-bdg-icoSize:${b.icon_size}px;`,
          `--asc-bdg-img-fit:${imgFit};`,
          `--asc-bdg-img-opacity:${imgOpacity};`,
          `--asc-bdg-img-filter:${imgFilter};`,
          `--asc-bdg-img-radius:${imgRadius}px;`,
          `--asc-bdg-img-frame-w:${imgFrameW}px;`,
          `--asc-bdg-img-frame-c:${imgFrameC};`,
          (b.fixed_width_px != null) ? `--asc-bdg-fixed-w:${b.fixed_width_px}px;` : ``,
        ].join("");

        const iconOnly = !!b.icon_only || !String(label || "").trim();

        const dirClass = (b.style === "left_arrow" || b.style === "recycle_left")
          ? "flow-left"
          : (b.style === "right_arrow" || b.style === "recycle_right")
            ? "flow-right"
            : (b.style === "top_arrow")
              ? "flow-up"
              : (b.style === "bottom_arrow")
                ? "flow-down"
                : "";

        const vert = (b.style === "top_arrow" || b.style === "bottom_arrow");

        const spinDir = spin ? ((b.style === "recycle_left") ? "spinLeft" : "spinRight") : "";

        const cls = `asc-badge ${b.style} ${(b.fixed_width_px != null) ? "fixedW" : ""} ${iconOnly ? "iconOnly" : ""} ${flow ? "flowAnim" : ""} ${spin ? "recycleSpin" : ""} ${spinDir} ${dirClass} ${vert ? "vertTxt" : ""}`.trim();

        


// Badge symbols: Fan / Heatpump (renders an SVG symbol as the badge itself)
if (b.style === "fan" || b.style === "heatpump") {
  const stB = this.hass?.states?.[b.entity];
  const rawValB = stB ? stB.state : null;

  // Prefer badge intervals. If none exist, fall back to main card intervals.
  const itSym = it || this._intervalForEntityFallback(b.entity);
  const glassOnB = this._config.glass !== false;

  const hostId = `asc-bdg-sym-${this._instanceId}-${b.id}`;
  const mk = (b.style === "fan")
    ? this._badgeFanMarkup({ value: rawValB, interval: itSym, glassOn: glassOnB }, b)
    : this._badgeHeatpumpMarkup({ value: rawValB, interval: itSym, glassOn: glassOnB }, b);

  this._bdgSymPending[hostId] = mk || "";

  const symStyleVars = [
    `left:${b.x}%;`,
    `top:${b.y}%;`,
    (Number.isFinite(b.opacity) && clamp01(b.opacity) < 1) ? `opacity:${clamp01(b.opacity)};` : ``,
    `--asc-bdg-icoSize:${b.icon_size}px;`,
  ].join("");

  const symIconOnly = !!b.icon_only || !String(label || "").trim();
  const symCls = `asc-badge ${b.style} ${symIconOnly ? "iconOnly" : ""}`.trim();

  return html`
    <div class="${symCls}" style="${symStyleVars}" data-badge-id="${b.id}" @pointerdown=${(ev) => this._onBadgeDragStart(ev, b)} @click=${(ev) => this._onBadgeTap(ev, b)}>
      <div class="bdgSymHost" id="${hostId}"></div>
      ${(!symIconOnly) ? html`<div class="bTxt">${label}</div>` : ""}
    </div>
  `;
}

if (b.show_slider) {
  const meta = this._badgeSliderMeta(b);
  const isVert = (meta.orientation === "vertical");
  const showVal = (typeof b.slider_show_value === "boolean") ? b.slider_show_value : true;

  // Slider appearance (CSS vars)
  const sLen = Number.isFinite(b.slider_length) ? Math.max(40, Math.min(500, Number(b.slider_length))) : null;
  const sThk = Number.isFinite(b.slider_thickness) ? Math.max(2, Math.min(24, Number(b.slider_thickness))) : null;
  const sThumb = Number.isFinite(b.slider_thumb_size) ? Math.max(8, Math.min(48, Number(b.slider_thumb_size))) : null;
  const sThumbR = Number.isFinite(b.slider_thumb_radius) ? Math.max(0, Math.min(999, Number(b.slider_thumb_radius))) : null;
  const sTrackR = Number.isFinite(b.slider_track_radius) ? Math.max(0, Math.min(999, Number(b.slider_track_radius))) : null;
  const sThumbC = (b.slider_thumb_color && String(b.slider_thumb_color).trim()) ? String(b.slider_thumb_color).trim() : "";
  const sTrackC = (b.slider_track_color && String(b.slider_track_color).trim()) ? String(b.slider_track_color).trim() : "";

  // Wrap sizing so Length affects the visible slider (especially in horizontal mode)
  const wrapWH = (!isVert && sLen != null)
    ? Math.min(520, Math.max(140, sLen + (showVal ? 70 : 40) + ((b.show_icon && iconUse) ? 34 : 0)))
    : null;
  const wrapWV = (isVert)
    ? Math.min(220, Math.max(64, (sThumb != null ? sThumb : 18) + 46))
    : null;
  const wrapH = (isVert && sLen != null)
    ? Math.min(520, Math.max(140, sLen + (showVal ? 60 : 40) + 70))
    : null;

  const sliderVars = [
    sLen != null ? `--asc-sld-len:${sLen}px;` : "",
    sThk != null ? `--asc-sld-thk:${sThk}px;` : "",
    sThumb != null ? `--asc-sld-thumb:${sThumb}px;` : "",
    sThumbR != null ? `--asc-sld-thumb-r:${sThumbR}px;` : "",
    sTrackR != null ? `--asc-sld-track-r:${sTrackR}px;` : "",
    sThumbC ? `--asc-sld-thumb-c:${sThumbC};` : "",
    sTrackC ? `--asc-sld-track-c:${sTrackC};` : "",
    (wrapWH != null) ? `--asc-sld-wrap-w:${wrapWH}px;` : "",
    (wrapWV != null) ? `--asc-sld-wrap-w:${wrapWV}px;` : "",
    (wrapH != null) ? `--asc-sld-wrap-h:${wrapH}px;` : "",
  ].join("");

  const sliderStyle = styleVars + sliderVars;
  const sliderCls = `${cls} hasSlider ${isVert ? "vert" : ""}`.trim();

  const stop = (ev) => {
    try { ev?.stopPropagation?.(); } catch(e) {}
    try { ev?.stopImmediatePropagation?.(); } catch(e) {}
  };

  return html`
    <div class="${sliderCls}" style="${sliderStyle}" @pointerdown=${(ev) => this._onBadgeDragStart(ev, b)} @click=${(ev) => this._onBadgeTap(ev, b)}>
      <div class="bSliderWrap">
        ${(b.show_icon && iconUse) ? html`<ha-icon class="bIcon" .icon=${iconUse}></ha-icon>` : ""}
        <div class="bSliderMain">
          ${(!iconOnly) ? html`<div class="bTxt">${label}</div>` : ""}
          <input
            class="bSlider"
            type="range"
            min="${meta.min}"
            max="${meta.max}"
            step="${meta.step}"
            .value="${String(meta.value)}"
            @pointerdown=${stop}
            @mousedown=${stop}
            @touchstart=${stop}
            @click=${stop}
            @input=${(ev) => this._onBadgeSliderInput(ev, b)}
            @change=${(ev) => this._onBadgeSliderChange(ev, b)}
          />
        </div>
        ${showVal ? html`<div class="bSVal">${meta.displayValue}</div>` : ""}
      </div>
    </div>
  `;
}

return html`
  <div class="${cls}" style="${styleVars}" data-badge-id="${b.id}" @pointerdown=${(ev) => this._onBadgeDragStart(ev, b)} @click=${(ev) => this._onBadgeTap(ev, b)}>
            ${(recycle) ? html`
              ${(() => {
                const mid = `ascRec_${this._uid}_${idx}`;
                return html`<svg class="recycleIcon" viewBox="0 0 100 100" aria-hidden="true" style="color: var(--asc-bdg-shape-stroke);">
                  <defs>
                    <marker id="${mid}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,5 L0,10 Z" fill="currentColor"></path>
                    </marker>
                  </defs>
                  <!-- Two arc arrows with pointy heads (marker-end) -->
                  <path class="arc" d="M78 44 A34 34 0 0 0 44 22" marker-end="url(#${mid})"></path>
                  <path class="arc" d="M22 56 A34 34 0 0 0 56 78" marker-end="url(#${mid})"></path>
                </svg>`;
              })()}
            ` : ""}
            ${useImg ? html`<div class="bImgBox ${imgFrameOn ? "framed" : ""}">${imgUrl ? html`<img class="bImg" src="${imgUrl}" alt="" loading="lazy" />` : html`<div class="bImgPh">IMG</div>`}${imgTintOn && imgTintOpacity>0 ? html`<div class="bImgTint" style="background:${imgTintColor}; opacity:${clamp01(imgTintOpacity)};"></div>` : ""}</div>` : ((b.show_icon && iconUse) ? html`<ha-icon class="bIcon" .icon=${iconUse}></ha-icon>` : "")}
            ${(!iconOnly) ? html`<div class="bTxt">${label}</div>` : ""}
          </div>
        `;
      })}
    </div>
  `;
}

_drawScaleDom() {
  try {
    const sym = String(this._config?.symbol || "battery_liquid");
    let showScale = !!this._config?.show_scale;
    if (sym === "fan") showScale = false; // Fan never shows scale ticks
    const root = this.renderRoot;
    if (!root) return;

    const svgEl = root.querySelector("svg.sensor-svg");
    if (!svgEl) return;

    const layer = svgEl.querySelector("g.scale-layer");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!showScale) return;

    // --- Shapes used for placement ---
    const outerShape = svgEl.querySelector(".outer");      // overall outline (X placement)
    const scaleRef   = svgEl.querySelector(".scale-ref");  // fillable area (Y placement)

    let bboxOuter = null;
    let bboxRef = null;

    try { bboxOuter = outerShape?.getBBox?.() || null; } catch (_) { bboxOuter = null; }
    try { bboxRef   = scaleRef?.getBBox?.()   || null; } catch (_) { bboxRef = null; }

    const strokeWAttr = outerShape?.getAttribute?.("stroke-width");
    const strokeW = Number(strokeWAttr) || 3.2;

    // ---------- SCALE RANGE ----------
    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];

    const range = (maxS - minS) || 1;

    // ---------- Y placement (fillable area preferred) ----------
    const topY    = bboxRef ? bboxRef.y : 26;
    const bottomY = bboxRef ? (bboxRef.y + bboxRef.height) : 208;
    const usable  = bottomY - topY;

    const majorStep = 10;
    const minorStep = 2;

    const posY = (v) => {
      const t = clamp01((v - minS) / range);
      return topY + (1 - t) * usable;
    };

    const start = Math.ceil(minS / minorStep) * minorStep;
    const end   = Math.floor(maxS / minorStep) * minorStep;
    const symNow = String(this._config?.symbol || "battery_liquid");

    // default
    let pad = 18;                 // distance from outline
    let extraSafetyGap = -10;     // your current setting

    if (symNow === "tank") pad = 8;
    if (symNow === "ibc_tank") pad = 8;
    if (symNow === "water_level_segments") pad = 8;  

    const leftEdge = bboxOuter ? (bboxOuter.x - strokeW / 2) : 40;
    let x2 = leftEdge - pad;  // tick end (nearest outline)
    let xMajor1 = x2 - 14;    // major tick start
    let xMinor1 = x2 - 8;     // minor tick start
    let xLabel  = xMajor1 - 8; // label anchor (end)
    const allowOutsideLeft = (symNow === "water_level_segments");
    const maxLabelText = String(Math.round(maxS));
    const minLabelText = String(Math.round(minS));
    const widestLabel = (maxLabelText.length > minLabelText.length) ? maxLabelText : minLabelText;
    const estLabelWidth = widestLabel.length * 7 + 6;
    const vb = svgEl.viewBox?.baseVal;
    const vbLeft = (vb && Number.isFinite(vb.x)) ? vb.x : 0;
    const MIN_SAFE_LEFT = vbLeft + 2; // <-- viktig skillnad
    const minAllowedXLabel = MIN_SAFE_LEFT + estLabelWidth + extraSafetyGap;


    if (!allowOutsideLeft && xLabel < minAllowedXLabel) {
    const dx = minAllowedXLabel - xLabel;
    x2 += dx;
    xMajor1 += dx;
    xMinor1 += dx;
    xLabel += dx;
    }


    // (Optional) hard clamp so ticks never go negative even if bbox weird:
    if (!allowOutsideLeft && x2 < 10) {
    const dx = 10 - x2;
    x2 += dx; xMajor1 += dx; xMinor1 += dx; xLabel += dx;
    }


    const NS = "http://www.w3.org/2000/svg";

    // ---------- Color mode ----------
    const mode = String(this._config.scale_color_mode || "per_interval");
    const currentValue = this._getStateValue(this._config.entity);
    const activeInterval = (currentValue == null) ? null : normalizeInterval(this._findIntervalForValue(currentValue));
    const activeScaleColor = normalizeHex(activeInterval?.scale_color, "#ffffff");

    const tickColorFor = (tickValue) => {
      if (mode === "active_interval") return activeScaleColor;
      const itTick = normalizeInterval(this._findIntervalForValue(tickValue));
      return normalizeHex(itTick?.scale_color, "#ffffff");
    };

    // ---------- Draw ticks ----------
    for (let v = start; v <= end + 1e-9; v += minorStep) {
      const y = posY(v);
      const isMajor = Math.abs(v / majorStep - Math.round(v / majorStep)) < 1e-9;
      const c = tickColorFor(v);

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(isMajor ? xMajor1 : xMinor1));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke", c);
      line.setAttribute("stroke-opacity", String(isMajor ? 0.92 : 0.55));
      line.setAttribute("stroke-width", String(isMajor ? 2.8 : 1.6));
      line.setAttribute("stroke-linecap", "round");
      layer.appendChild(line);

      if (isMajor) {
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", String(xLabel));
        text.setAttribute("y", String(y + 4));
        text.setAttribute("fill", c);
        text.setAttribute("fill-opacity", "0.90");
        text.setAttribute("font-size", "12");
        text.setAttribute("font-weight", "900");
        text.setAttribute("text-anchor", "end");
        text.textContent = String(v);
        layer.appendChild(text);
      }
    }
  } catch (e) {
    console.warn("Andy Sensor Card: scale DOM draw failed", e);
  }
}

  render() {
    if (!this._config || !this.hass) return html``;

    const isPreview = (() => {
      try { return String(this.getAttribute?.("data-asc-preview") || "") === "1"; } catch (_) { return false; }
    })();

    const baseSym = String(this._config.symbol || "battery_liquid");
    const sym = (this._config.industrial_look && ["battery_liquid","battery_segments","battery_splitted_segments","water_level_segments"].includes(baseSym))
      ? `${baseSym}_modern`
      : baseSym;

    let value1 = this._getStateValue(this._config.entity);
    const rawState1 = this._getRawState(this._config.entity);

    // For Gate / Garage door / Blind: allow non-numeric states like "opening"/"closing"
    // to be treated as valid (so the card doesn't show "Entity not available").
    if (value1 === null && rawState1 != null && (sym === "garage_door" || sym === "gate" || sym === "blind")) {
      const rs = String(rawState1).trim();
      const rsl = rs.toLowerCase();
      if (rs !== "" && rsl !== "unknown" && rsl !== "unavailable") {
        value1 = rs; // keep as string so it can be displayed as-is
      }
    }
    const value2 = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") || sym === "battery_splitted_segments_modern")
      ? this._getStateValue(this._config.entity2)
      : null;

    const name = this._config.name ?? "Sensor";
    const unit = this._getUnit();

    const missing =
      (value1 === null) ||
      ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") && value2 === null);

    if (missing) {
      return html`
        <ha-card>
          <div class="wrap">
              <div class="sub">Entity not available</div>
          </div>
        </ha-card>
      `;
    }

    const decimals = Number(this._config.decimals ?? 0);

    const shown1 = fmtNum(value1, decimals) ?? String(value1);
    const shown2 = (value2 === null) ? null : (fmtNum(value2, decimals) ?? String(value2));

    const unitText = unit ? String(unit) : "";
    const unitStr = unitText ? ((unitText === "%") ? "%" : ` ${unitText}`) : "";

    // Charging (Battery + Battery Splitted)
    const charge1 = this._chargingSuffix(this._config.charging_state_entity, this._config.charging_power_entity);
    const charge2 = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern"))
      ? this._chargingSuffix(this._config.charging_state_entity2, this._config.charging_power_entity2)
      : { str: "", html: "" };

    // Text versions for <value> templating (includes unit + charging, even if Value position is "Hide")
    const templValue1Plain = `${shown1}${unitStr}`;
    const templValue2Plain = (shown2 == null) ? "" : `${shown2}${unitStr}`;

    const templValue1 = `${shown1}${unitStr}${charge1.str}`;
    const templValue2 = (shown2 == null) ? "" : `${shown2}${unitStr}${charge2.str}`;

    // HTML versions for rendering values inside the card (unit rendered separately as span)
    const shownCombined = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") && shown2 != null)
      ? `${shown1} / ${shown2}`
      : shown1;

    const isHorizontal = (this._config.orientation === "horizontal");

    const isImageFull = (baseSym === "image") && !!this._config.image_full_card;
    const splitHorizontal = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern")) && isHorizontal;

    const vp = String(this._config.value_position || "top_right");
    const showAnyValue = (vp !== "hide");
    const showHeaderValue = showAnyValue && (vp === "top_left" || vp === "top_right" || vp === "top_center");
    const showBottomValue = showAnyValue && (vp === "bottom_left" || vp === "bottom_right" || vp === "bottom_center");
    const showInsideValue = showAnyValue && (vp === "inside");

    const valueStyle = (this._config.value_font_size && Number(this._config.value_font_size) > 0)
      ? `font-size:${Number(this._config.value_font_size)}px;`
      : "";

    const outlined = !!this._config.outline_value;
    const valueClass = `value${outlined ? " outlined" : ""}`;
    const splitValueClass = `split-value${outlined ? " outlined" : ""}`;

    const interval = normalizeInterval(this._findIntervalForStateOrValue((typeof value1 === "number") ? value1 : null, (rawState1 != null) ? String(rawState1).trim() : null, this._config.intervals));
    // Optional: interval "New value" template can override the displayed value text on the main card
    const intervalNewValueTpl = (interval && interval.new_value != null && String(interval.new_value).trim() !== "")
      ? String(interval.new_value)
      : "";
    const intervalNewValueText = intervalNewValueTpl
      ? this._applyEntityTemplate(this._config.entity, intervalNewValueTpl, { decimals, valueTextOverride: templValue1Plain })
      : "";
    const glassOn = this._config.glass !== false;

    const showStats = !!this._config.show_stats;
    const stats = this._stats || { min: null, avg: null, max: null, samples: 0 };

    const cardScale = Number(this._config.card_scale ?? 1);
    const gapMult = ((this._config.orientation === "horizontal") && ["tank","water_level_segments","ibc_tank"].includes(String(this._config.symbol||"")))
      ? 0.55 : 1;
    const edgePadPx = 10 * cardScale * gapMult;
    const nameFs = Number(this._config.name_font_size || 0);
    const nameVar = (Number.isFinite(nameFs) && nameFs > 0) ? `--asc-name-font-size:${nameFs}px;` : "";
    const nox = toNumberMaybe(this._config.name_offset_x) ?? 0;
    const noy = toNumberMaybe(this._config.name_offset_y) ?? 0;
    const vox = toNumberMaybe(this._config.value_offset_x) ?? 0;
    const voy = toNumberMaybe(this._config.value_offset_y) ?? 0;
    const scaleVarStyle = `--asc-scale:${cardScale};--asc-edge-pad:${edgePadPx}px;--asc-gap-mult:${gapMult};${nameVar}--asc-name-off-x:${nox}px;--asc-name-off-y:${noy}px;--asc-value-off-x:${vox}px;--asc-value-off-y:${voy}px;`;
    const statsPos = String(this._config.stats_position || "bottom_center");
    const tallSyms = new Set(["battery_liquid","battery_segments","battery_splitted_segments","gas_cylinder","silo"]);
    const statsPadPx = (showStats && statsPos.startsWith("bottom") && tallSyms.has(baseSym)) ? 0 : 10;
    const cw = toCssSize(this._config.card_width);
    const ch = toCssSize(this._config.card_height);
    const wrapStyle = `${scaleVarStyle}--asc-stats-pad:${statsPadPx}px;${ch ? `--asc-card-height:${ch};` : ""}`;

    const isImageSymbol = (baseSym === "image");
    const previewWrapStyle = (isPreview && isImageSymbol)
      ? `${wrapStyle}${cw ? `width:${cw};` : ""}${ch ? `height:${ch};` : ""}`
      : wrapStyle;

    const haCardStyle = (isPreview && isImageSymbol)
      ? `cursor:pointer;width:100%;overflow:hidden;`
      : `cursor:pointer;${cw ? `width:${cw};` : ""}${ch ? `height:${ch};` : ""}`;

    // Split entity names (friendly_name)
    const showSplitNames = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern")) && !!this._config.show_split_entity_names;
    const st1 = this.hass?.states?.[this._config.entity];
    const st2 = this.hass?.states?.[this._config.entity2];
    const lbl1 = (this._config.split_label1 != null && String(this._config.split_label1).trim() !== "")
      ? String(this._config.split_label1).trim()
      : "";
    const lbl2 = (this._config.split_label2 != null && String(this._config.split_label2).trim() !== "")
      ? String(this._config.split_label2).trim()
      : "";
    const baseFn1 = lbl1 || (st1?.attributes?.friendly_name ?? "");
    const baseFn2 = lbl2 || (st2?.attributes?.friendly_name ?? "");

    // Support <value> templating in split labels (Battery Splitted only)
    const fn1 = baseFn1 ? this._applyEntityTemplate(this._config.entity, baseFn1, { valueTextOverride: templValue1 }) : "";
    const fn2 = baseFn2 ? this._applyEntityTemplate(this._config.entity2, baseFn2, { valueTextOverride: templValue2 }) : "";

    const wrapClasses = `wrap ${isHorizontal ? "orient-horizontal" : "orient-vertical"}${isImageFull ? " image-full" : ""}${isImageSymbol ? " sym-image" : ""}`;

    const inner = html`
        <div class="${wrapClasses}" style="${previewWrapStyle}">
          ${isImageFull ? this._renderImageBackground() : ""}
          <div class="header ${vp} ${showHeaderValue && !splitHorizontal ? "" : "empty"}">
              ${(showHeaderValue && !splitHorizontal) ? html`
              <div class="${valueClass}" style="${valueStyle}">${intervalNewValueText ? intervalNewValueText : html`${shownCombined}${unit ? html`<span class="unit">${unit}</span>` : ""}${((sym !== "battery_splitted_segments" && sym !== "battery_splitted_segments_modern")) ? charge1.html : ""}`}</div>
            ` : ""}
          </div>

          ${this._renderNameOverlay(name)}

          ${this._renderTapConfirmLock()}

          ${isImageFull ? this._renderBadgesLayer(false) : ""}

          <div class="iconRow">
            <div class="iconWrap">
              <div class="symbolRotator ${isHorizontal ? "rot-h" : ""}">
                ${this._renderSymbol({ value: value1, value2, interval, glassOn, charging1: this._isOnLikeState(this._config.charging_state_entity), charging2: ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern")) ? this._isOnLikeState(this._config.charging_state_entity2) : false })}
                ${!isImageFull ? this._renderBadgesLayer(isHorizontal) : ""}
              </div>

              ${((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") && shown2 != null && isHorizontal && showAnyValue) ? html`
                <div class="split-values horizontal">
                  <div class="${splitValueClass} first" style="${valueStyle}">${shown1}${unit ? html`<span class="unit">${unit}</span>` : ""}${charge1.html}</div>
                  <div class="${splitValueClass} second" style="${valueStyle}">${shown2}${unit ? html`<span class="unit">${unit}</span>` : ""}${charge2.html}</div>
                </div>
              ` : ""}

              ${(showInsideValue && !splitHorizontal) ? html`
                <div class="${valueClass} inside" style="${valueStyle}">${intervalNewValueText ? intervalNewValueText : html`${shownCombined}${unit ? html`<span class="unit">${unit}</span>` : ""}${((sym !== "battery_splitted_segments" && sym !== "battery_splitted_segments_modern")) ? charge1.html : ""}`}</div>
              ` : ""}

              ${showSplitNames ? html`
                <div class="split-names ${isHorizontal ? "horizontal" : "vertical"}">
                  <div class="split-name name1">${fn1}</div>
                  <div class="split-name name2">${fn2}</div>
                </div>
              ` : ""}
            </div>
          </div>

          ${(showBottomValue && !splitHorizontal) ? html`
            <div class="bottom ${vp}">
              <div class="${valueClass}" style="${valueStyle}">${intervalNewValueText ? intervalNewValueText : html`${shownCombined}${unit ? html`<span class="unit">${unit}</span>` : ""}${((sym !== "battery_splitted_segments" && sym !== "battery_splitted_segments_modern")) ? charge1.html : ""}`}</div>
            </div>
          ` : ""}

          ${showStats ? this._renderStatsOverlay(stats, decimals, unit) : ""}
        </div>
    `;

    return html`
      <ha-card @click=${this._onMainTap} style="${haCardStyle}">
        ${(isPreview && isImageSymbol) ? html`<div class="asc-preview-scroll">${inner}</div>` : inner}
      </ha-card>
    `;
  }


  _drawSegmentsDom() {
    try {
      const sym = String(this._config?.symbol || "battery_liquid");
      if (sym !== "battery_segments" && sym !== "battery_segments_modern" && sym !== "battery_splitted_segments" && sym !== "battery_splitted_segments_modern" && sym !== "water_level_segments" && sym !== "water_level_segments_modern" && sym !== "silo") return;
const root = this.renderRoot;
      if (!root) return;

      const svgEl = root.querySelector("svg.sensor-svg");
      if (!svgEl) return;

      const layer = svgEl.querySelector("g.segments-layer");
      if (!layer) return;

      while (layer.firstChild) layer.removeChild(layer.firstChild);

      // Read values
      const vRaw1 = this._getStateValue(this._config.entity);
      if (vRaw1 == null) return;

      const vRaw2 = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") || sym === "battery_splitted_segments_modern") ? this._getStateValue(this._config.entity2) : null;
      if (((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") || sym === "battery_splitted_segments_modern") && vRaw2 == null) return;

      let minS = Number(this._config.min ?? 0);
      let maxS = Number(this._config.max ?? 100);
      if (!Number.isFinite(minS)) minS = 0;
      if (!Number.isFinite(maxS)) maxS = 100;
      if (maxS < minS) [minS, maxS] = [maxS, minS];

      const value1 = Number.isFinite(Number(vRaw1)) ? Number(vRaw1) : minS;
      const value2 = (vRaw2 == null) ? null : (Number.isFinite(Number(vRaw2)) ? Number(vRaw2) : minS);

      // Charging animation (Battery + Battery Splitted)
      const chargingOn1 = ((sym === "battery_segments" || sym === "battery_segments_modern") || (sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern"))
        ? this._isOnLikeState(this._config?.charging_state_entity)
        : false;
      const chargingOn2 = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern"))
        ? this._isOnLikeState(this._config?.charging_state_entity2)
        : false;

      // Intervals -> blocks (ignore the "to == min" helper interval if present)
      const intervals = intervalsSortedByTo(this._config.intervals).filter(it => Number(it.to) > minS);
      const blockCount = Math.max(1, intervals.length);

      const filledCountFor = (val) => {
        let filled = 0;
        for (let i = 0; i < intervals.length; i++) {
          if (val <= intervals[i].to) { filled = i + 1; break; }
          filled = i + 1;
        }
        if (val <= minS) filled = 0;
        return filled;
      };

      const filled1 = filledCountFor(value1);
      const filled2 = (value2 == null) ? null : filledCountFor(value2);

      const NS = "http://www.w3.org/2000/svg";

      // Geometry: use actual .scale-ref bbox for perfect fit (works for both symbols)
      const scaleRef = svgEl.querySelector(".scale-ref");
      let bb = null;
      try { bb = scaleRef?.getBBox?.() || null; } catch (_) { bb = null; }

      const IN_L = bb ? bb.x : 60;
      const IN_T = bb ? bb.y : 15;
      const IN_W = bb ? bb.width : 100;
      const IN_H = bb ? bb.height : 205;

      const gapDefault = 5;
      let GAP = Number(this._config?.segment_gap);
      if (!Number.isFinite(GAP) || GAP < 0) GAP = gapDefault;
      if (GAP > 40) GAP = 40;

      const totalGap = GAP * (blockCount + 1);
      const blockH = Math.max(10, (IN_H - totalGap) / blockCount);
      const blockW = IN_W;
      const blockX = IN_L;

      const mode = String(this._config.scale_color_mode || "per_interval");

      const activeIt1 = normalizeInterval(this._findIntervalForValue(value1));
      const activeFill1 = normalizeHex(activeIt1.color, "#22c55e");

      const activeIt2 = (value2 == null) ? null : normalizeInterval(this._findIntervalForValue(value2));
      const activeFill2 = normalizeHex(activeIt2?.color, "#22c55e");

      // Gradient support for segment symbols:
      // Use SVG <linearGradient> with gradientUnits="userSpaceOnUse" so the gradient spans across
      // the entire interval span (not restarted per segment).
      const defsClass = "andy-seg-defs";
      let defs = svgEl.querySelector(`defs.${defsClass}`);
      if (!defs) {
        defs = document.createElementNS(NS, "defs");
        defs.setAttribute("class", defsClass);
        svgEl.insertBefore(defs, svgEl.firstChild);
      }
      while (defs.firstChild) defs.removeChild(defs.firstChild);

      const yTopForIndex = (idx) => IN_T + (GAP * (idx + 1)) + (blockH * idx);
      const yBottomForIndex = (idx) => yTopForIndex(idx) + blockH;

      const mkGrad = (id, from, to, yTop, yBottom) => {
        const lg = document.createElementNS(NS, "linearGradient");
        lg.setAttribute("id", id);
        lg.setAttribute("gradientUnits", "userSpaceOnUse");
        lg.setAttribute("x1", "0");
        lg.setAttribute("x2", "0");
        // y increases downward in SVG: map "from" at bottom -> "to" at top (same as liquid battery)
        lg.setAttribute("y1", String(yBottom));
        lg.setAttribute("y2", String(yTop));

        const s0 = document.createElementNS(NS, "stop");
        s0.setAttribute("offset", "0%");
        s0.setAttribute("stop-color", from);

        const s1 = document.createElementNS(NS, "stop");
        s1.setAttribute("offset", "100%");
        s1.setAttribute("stop-color", to);

        lg.appendChild(s0);
        lg.appendChild(s1);
        defs.appendChild(lg);
      };

      const intervalGradIds = new Array(intervals.length).fill(null);
      let activeGrad1Id = null;
      let activeGrad2Id = null;

      if (mode === "per_interval") {
        for (let i = 0; i < intervals.length; i++) {
          const itN = normalizeInterval(intervals[i] || {});
          if (!itN.gradient?.enabled) continue;

          const cSolid = normalizeHex(itN.color, "#22c55e");
          const gFrom = normalizeHex(itN.gradient?.from, cSolid);
          const gTo = normalizeHex(itN.gradient?.to, gFrom);

          const gid = `segGrad_${this._instanceId}_${i}`;
          intervalGradIds[i] = gid;

          // Span is the segment(s) mapped to this interval index.
          const yTop = yTopForIndex(i);
          const yBottom = yBottomForIndex(i);
          mkGrad(gid, gFrom, gTo, yTop, yBottom);
        }
      } else if (mode === "active_interval") {
        // Side 1
        if (filled1 > 0 && activeIt1.gradient?.enabled) {
          const cSolid = normalizeHex(activeIt1.color, "#22c55e");
          const gFrom = normalizeHex(activeIt1.gradient?.from, cSolid);
          const gTo = normalizeHex(activeIt1.gradient?.to, gFrom);

          activeGrad1Id = `segActiveGrad_${this._instanceId}_1`;
          const yTop = yTopForIndex(0);
          const yBottom = yBottomForIndex(filled1 - 1);
          mkGrad(activeGrad1Id, gFrom, gTo, yTop, yBottom);
        }

        // Side 2 (split only)
        if (filled2 != null && filled2 > 0 && activeIt2?.gradient?.enabled) {
          const it2n = normalizeInterval(activeIt2);
          const cSolid = normalizeHex(it2n.color, "#22c55e");
          const gFrom = normalizeHex(it2n.gradient?.from, cSolid);
          const gTo = normalizeHex(it2n.gradient?.to, gFrom);

          activeGrad2Id = `segActiveGrad_${this._instanceId}_2`;
          const yTop = yTopForIndex(0);
          const yBottom = yBottomForIndex(filled2 - 1);
          mkGrad(activeGrad2Id, gFrom, gTo, yTop, yBottom);
        }
      }

      const fillForBlock = (i, side) => {
        const it = normalizeInterval(intervals[i] || intervals[intervals.length - 1] || {});

        if (mode === "active_interval") {
          const gid = (side === 2) ? activeGrad2Id : activeGrad1Id;
          if (gid) return `url(#${gid})`;
          return side === 2 ? activeFill2 : activeFill1;
        }

        const gid = intervalGradIds[i];
        if (gid) return `url(#${gid})`;
        return normalizeHex(it.color, "#22c55e");
      };;

      // Helper: create a “wave ribbon” path across the width
      function waveRibbonPath(x, yTop, w, h) {
        const amp = Math.max(3, Math.min(16, h * 0.15));

        const yMidTop = yTop + amp;
        const yMidBot = yTop + h - amp;

        const periods = 2;
        const step = w / periods;

        let d = `M ${x} ${yMidTop}`;
        for (let p = 0; p < periods; p++) {
          const x0 = x + p * step;
          const x1 = x0 + step / 2;
          const x2 = x0 + step;

          d += ` C ${x0 + step * 0.25} ${yMidTop - amp}, ${x1 - step * 0.25} ${yMidTop + amp}, ${x1} ${yMidTop}`;
          d += ` C ${x1 + step * 0.25} ${yMidTop - amp}, ${x2 - step * 0.25} ${yMidTop + amp}, ${x2} ${yMidTop}`;
        }

        d += ` L ${x + w} ${yMidBot}`;

        for (let p = periods - 1; p >= 0; p--) {
          const x2 = x + (p + 1) * step;
          const x1 = x2 - step / 2;
          const x0 = x2 - step;

          d += ` C ${x2 - step * 0.25} ${yMidBot + amp}, ${x1 + step * 0.25} ${yMidBot - amp}, ${x1} ${yMidBot}`;
          d += ` C ${x1 - step * 0.25} ${yMidBot + amp}, ${x0 + step * 0.25} ${yMidBot - amp}, ${x0} ${yMidBot}`;
        }

        d += " Z";
        return d;
      }

      const waveStrokeW = ((sym === "water_level_segments" || sym === "water_level_segments_modern") && GAP === 0) ? 0 : 1.2;

      for (let i = 0; i < blockCount; i++) {
        // bottom-up stacking
        const y = (IN_T + IN_H) - GAP - (i + 1) * blockH - i * GAP;

        if ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern") || sym === "battery_splitted_segments_modern") {
          const MID_GAP = 6;
          const halfW = Math.max(4, (blockW - MID_GAP) / 2);

          const xL = blockX;
          const xR = blockX + halfW + MID_GAP;

          const onL = i < filled1;
          const onR = (filled2 == null) ? false : (i < filled2);

          const rL = document.createElementNS(NS, "rect");
          rL.setAttribute("x", String(xL));
          rL.setAttribute("y", String(y));
          rL.setAttribute("width", String(halfW));
          rL.setAttribute("height", String(blockH));
          rL.setAttribute("rx", "6");
          rL.setAttribute("ry", "6");

          const fillL = onL ? fillForBlock(i, 1) : "rgba(255,255,255,0.08)";
          rL.setAttribute("fill", fillL);
          rL.setAttribute("stroke", "rgba(255,255,255,0.22)");
          rL.setAttribute("stroke-width", "1");
          rL.setAttribute("opacity", onL ? "0.98" : "0.45");
          if (onL && chargingOn1) {
            rL.setAttribute("class", "charging-seg");
            rL.setAttribute("style", `animation-delay:${(i * 0.12).toFixed(2)}s;`);
          }
          layer.appendChild(rL);

          const rR = document.createElementNS(NS, "rect");
          rR.setAttribute("x", String(xR));
          rR.setAttribute("y", String(y));
          rR.setAttribute("width", String(halfW));
          rR.setAttribute("height", String(blockH));
          rR.setAttribute("rx", "6");
          rR.setAttribute("ry", "6");

          const fillR = onR ? fillForBlock(i, 2) : "rgba(255,255,255,0.08)";
          rR.setAttribute("fill", fillR);
          rR.setAttribute("stroke", "rgba(255,255,255,0.22)");
          rR.setAttribute("stroke-width", "1");
          rR.setAttribute("opacity", onR ? "0.98" : "0.45");
          if (onR && chargingOn2) {
            rR.setAttribute("class", "charging-seg");
            rR.setAttribute("style", `animation-delay:${(i * 0.12).toFixed(2)}s;`);
          }
          layer.appendChild(rR);

          continue;
        }

        const isOn = i < filled1;

        if ((sym === "battery_segments" || sym === "battery_segments_modern") || sym === "battery_segments_modern") {
          const r = document.createElementNS(NS, "rect");
          r.setAttribute("x", String(blockX));
          r.setAttribute("y", String(y));
          r.setAttribute("width", String(blockW));
          r.setAttribute("height", String(blockH));
          r.setAttribute("rx", "6");
          r.setAttribute("ry", "6");

          const fill = isOn ? fillForBlock(i, 1) : "rgba(255,255,255,0.08)";
          r.setAttribute("fill", fill);
          r.setAttribute("stroke", "rgba(255,255,255,0.22)");
          r.setAttribute("stroke-width", "1");
          r.setAttribute("opacity", isOn ? "0.98" : "0.45");
          if (isOn && chargingOn1) {
            r.setAttribute("class", "charging-seg");
            r.setAttribute("style", `animation-delay:${(i * 0.12).toFixed(2)}s;`);
          }

          layer.appendChild(r);
        } else {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", waveRibbonPath(blockX, y, blockW, blockH));

          const fill = isOn ? fillForBlock(i, 1) : "rgba(255,255,255,0.08)";
          p.setAttribute("fill", fill);
          p.setAttribute("opacity", isOn ? "0.95" : "0.35");

          if (waveStrokeW > 0) {
            p.setAttribute("stroke", "rgba(255,255,255,0.22)");
            p.setAttribute("stroke-width", String(waveStrokeW));
          } else {
            p.setAttribute("stroke", "none");
          }

          layer.appendChild(p);
        }
      }
    } catch (e) {
      console.warn("Andy Sensor Card: segment DOM draw failed", e);
    }
  }


  _renderStatsRow(stats, decimals, unit) {
    const m = fmtNum(stats.min, decimals) ?? "—";
    const a = fmtNum(stats.avg, decimals) ?? "—";
    const x = fmtNum(stats.max, decimals) ?? "—";
    const u = unit || "";
    return html`
      <div class="statsRow">
        <span>Min: ${m}${u}</span>
        <span>Avg: ${a}${u}</span>
        <span>Max: ${x}${u}</span>
      </div>
    `;
  }

  _renderSymbol(opts) {
    const baseSym = String(this._config.symbol || "battery_liquid");

    const sym = (this._config.industrial_look && ["battery_liquid","battery_segments","battery_splitted_segments","water_level_segments"].includes(baseSym))
      ? `${baseSym}_modern`
      : baseSym;

    const frameTargets = ["ibc_tank", "gas_cylinder", "silo", "tank"];
    const frameStyle = (this._config.industrial_look && frameTargets.includes(baseSym))
      ? this._getIndustrialFrameStyle()
      : null;
    const o = frameStyle ? { ...opts, frameStyle } : opts;

    if (sym === "battery_liquid_modern") return this._batteryLiquidModernSvg(o);
    if (sym === "battery_segments_modern") return this._batterySegmentsModernSvg(o);
    if (sym === "battery_splitted_segments_modern") return this._batterySplittedSegmentsModernSvg(o);
    if (sym === "water_level_segments_modern") return this._waterLevelSegmentsModernSvg(o);
    if ((sym === "battery_segments" || sym === "battery_segments_modern")) return this._batterySegmentsSvg(o);
    if ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern")) return this._batterySplittedSegmentsSvg(o);
    if ((sym === "water_level_segments" || sym === "water_level_segments_modern")) return this._waterLevelSegmentsSvg(o);
    if (sym === "silo") return this._siloLiquidSvg(o);
    if (sym === "tank") return this._tankLiquidSvg(o); //v1.0.2
    if (sym === "ibc_tank") return this._ibcTankLiquidSvg(o); //v1.1.5
    if (sym === "fan") return this._fanSvg(o); //v1.2.1
    if (sym === "heatpump") return this._heatpumpSvg(o); //v1.5.6
    if (sym === "washing_machine") return this._washingMachineSvg(o); //v1.0.6
    if (sym === "tumble_dryer") return this._tumbleDryerSvg(o); //v1.0.6
    if (sym === "garage_door") return this._garageDoorSvg(o); //v1.6.15
    if (sym === "blind") return this._blindSvg(o); //v1.6.26
    if (sym === "gate") return this._gateSvg(o); //v1.6.30
    if (sym === "image") return this._imageSvg(o); //v1.6.38
    if (sym === "gas_cylinder") return this._gasCylinderLiquidSvg(o); //v1.0.2

    return this._batteryLiquidSvg(o);
  }

  // ---------------------------
  // Symbol: battery_liquid
  // ---------------------------
  _batteryLiquidSvg(opts) {
    const { value, interval, glassOn } = opts;

    const frame = opts?.frameStyle;
    const it = normalizeInterval(interval);
    const useGradient = !!it.gradient?.enabled;
    const cSolid = normalizeHex(it.color, "#22c55e");
    const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");
    const frameStroke = isLightHex(outline) ? "rgba(0,0,0,0.65)" : outline;
    const gFrom = normalizeHex(it.gradient?.from, cSolid);
    const gTo = normalizeHex(it.gradient?.to, gFrom);

    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];

    const range = (maxS - minS) || 1;
    const pScaled = clamp01((Number(value) - minS) / range);

    const SCALE_TOP = 26;
    const SCALE_BOTTOM = 208;

    let yTop = SCALE_TOP + (1 - pScaled) * (SCALE_BOTTOM - SCALE_TOP);
    yTop = Math.max(0, Math.min(220, yTop));

    const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");
    const tubeBg = glassOn ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)";

    const OUT_L = 50;
    const OUT_R = 170;
    const OUT_T = 18;
    const OUT_B = 220;
    const OUT_RX = 18;

    const IN_L = 58;
    const IN_R = 162;
    const IN_T = 26;
    const IN_B = 216;
    const IN_W = IN_R - IN_L;
    const IN_H = IN_B - IN_T;
    const IN_RX = 14;

    const CAP_W = 30;
    const CAP_H = 10;
    const CAP_X = (OUT_L + OUT_R) / 2 - CAP_W / 2;
    const CAP_Y = 6;
    const CAP_RX = 4;

    const liquidY = Math.max(IN_T, yTop);
    const liquidH = Math.max(0, IN_B - liquidY);

    // unique ids
    const gid = `${this._instanceId}_liq`;
    const gradId = `liquidGrad_${gid}`;
    const chargeGradId = `chargeSweepGrad_${gid}`;
    const sheenId = `glassSheen_${gid}`;
    const bandId = `glassBand_${gid}`;
    const blurId = `specBlur_${gid}`;
    const shadowId = `shadow_${gid}`;
    const clipId = `batteryInnerClip_${gid}`;

    return html`
      <svg class="sensor-svg${(opts?.charging1) ? " charging" : ""}" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Battery">
        <defs>
          <linearGradient id="${gradId}" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stop-color="${gFrom}"></stop>
            <stop offset="100%" stop-color="${gTo}"></stop>
          </linearGradient>

          <linearGradient id="${chargeGradId}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.00)"></stop>
            <stop offset="40%" stop-color="rgba(255,255,255,0.00)"></stop>
            <stop offset="50%" stop-color="rgba(255,255,255,0.92)"></stop>
            <stop offset="60%" stop-color="rgba(255,255,255,0.00)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0.00)"></stop>
          </linearGradient>

          <linearGradient id="${sheenId}" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="rgba(255,255,255,0.94)"></stop>
            <stop offset="35%" stop-color="rgba(255,255,255,0.22)"></stop>
            <stop offset="78%" stop-color="rgba(255,255,255,0.05)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0.52)"></stop>
          </linearGradient>

          <linearGradient id="${bandId}" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.00)"></stop>
            <stop offset="35%" stop-color="rgba(255,255,255,0.22)"></stop>
            <stop offset="55%" stop-color="rgba(255,255,255,0.06)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0.00)"></stop>
          </linearGradient>

          <filter id="${blurId}" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>

          <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(0,0,0,0.28)"/>
          </filter>

          <clipPath id="${clipId}">
            <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}" />
          </clipPath>
        </defs>

        <g>
          <rect
            x="${CAP_X}" y="${CAP_Y}" width="${CAP_W}" height="${CAP_H}"
            rx="${CAP_RX}" ry="${CAP_RX}"
            fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95"
            filter="url(#${shadowId})"
          />

          <rect class="outer"
            x="${OUT_L}" y="${OUT_T}" width="${OUT_R - OUT_L}" height="${OUT_B - OUT_T}"
            rx="${OUT_RX}" ry="${OUT_RX}"
            fill="${outerFill}"
            stroke="${outline}"
            stroke-width="3.2"
            opacity="0.95"
            filter="url(#${shadowId})"
          />
          
          <!-- Scale reference: EXACT fillable area (used for Y positioning) -->
          <rect class="scale-ref"
            x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="transparent" stroke="transparent"
          />
          <!-- Value inSymbol reference: -->          
         <rect class="value-ref" 
               x="0" 
               y="110"
               width="1"
               height="1"
          fill="transparent" />
          

          <g clip-path="url(#${clipId})">
            <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="${tubeBg}"></rect>

            <rect class="liquid"
              x="${IN_L}" y="${liquidY}" width="${IN_W}" height="${liquidH}"
              rx="${IN_RX}" ry="${IN_RX}"
              fill="${useGradient ? `url(#${gradId})` : cSolid}"
              opacity="0.98"
            ></rect>

            <rect class="charge-sheen"
              x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
              fill="url(#${chargeGradId})"
              opacity="0"
            ></rect>

            ${glassOn ? html`
              <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="url(#${sheenId})" opacity="0.95"></rect>
              <rect x="${IN_L - 10}" y="${IN_T - 20}" width="${IN_W + 20}" height="${IN_H + 40}"
                    fill="url(#${bandId})" opacity="0.78"
                    transform="rotate(-12 110 120)"></rect>
            ` : ""}
          </g>

          ${glassOn ? html`
            <path class="glass1"
              d="M${IN_L + 14} ${IN_T + 18} C${IN_L + 8} ${IN_T + 26} ${IN_L + 8} ${IN_T + 42} ${IN_L + 8} ${IN_T + 58} V${IN_B - 30}"
              fill="none" stroke="rgba(255,255,255,0.94)" stroke-width="14" stroke-linecap="round"
              opacity="0.98" filter="url(#${blurId})" />
            <path class="glass2"
              d="M${IN_L + 22} ${IN_T + 10} C${IN_L + 16} ${IN_T + 22} ${IN_L + 16} ${IN_T + 36} ${IN_L + 16} ${IN_T + 54} V${IN_T + 110}"
              fill="none" stroke="rgba(255,255,255,0.98)" stroke-width="5.0" stroke-linecap="round" opacity="0.98"/>
          ` : ""}

          <rect
            x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2"
          />
        </g>

        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
      </svg>
    `;
  }

  // ---------------------------
  // Symbol: battery_liquid_modern (same logic as battery_liquid, modern frame)
  // ---------------------------
  _batteryLiquidModernSvg(opts) {
    const { value, interval, glassOn } = opts;

    const frame = opts?.frameStyle;
    const it = normalizeInterval(interval);
    const useGradient = !!it.gradient?.enabled;
    const cSolid = normalizeHex(it.color, "#22c55e");
    const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");

    // Modern frame: slightly darker, double-stroke + subtle shadow
    const strokeDark = "rgba(0,0,0,0.75)";
    const strokeLite = "rgba(255,255,255,0.18)";
    const frameStroke = isLightHex(outline) ? strokeDark : outline;

    const gFrom = normalizeHex(it.gradient?.from, cSolid);
    const gTo = normalizeHex(it.gradient?.to, gFrom);

    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];

    const range = (maxS - minS) || 1;
    const pScaled = clamp01((Number(value) - minS) / range);

    const SCALE_TOP = 26;
    const SCALE_BOTTOM = 208;

    let yTop = SCALE_TOP + (1 - pScaled) * (SCALE_BOTTOM - SCALE_TOP);
    yTop = Math.max(0, Math.min(220, yTop));

    const outerFill = glassOn ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
    const tubeBg = glassOn ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)";

    const OUT_L = 50;
    const OUT_R = 170;
    const OUT_T = 18;
    const OUT_B = 220;
    const OUT_RX = 20;

    const IN_L = 58;
    const IN_R = 162;
    const IN_T = 26;
    const IN_B = 216;
    const IN_RX = 16;

    const CAP_W = 34;
    const CAP_H = 12;
    const CAP_X = (OUT_L + OUT_R) / 2 - CAP_W / 2;
    const CAP_Y = 5;
    const CAP_RX = 5;

    const liquidY = Math.max(IN_T, yTop);
    const liquidH = Math.max(0, IN_B - liquidY);

    // unique ids
    const gid = `${this._instanceId}_liqM`;
    const gradId = `liquidGrad_${gid}`;
    const chargeGradId = `chargeSweepGrad_${gid}`;
    const sheenId = `glassSheen_${gid}`;
    const bandId = `glassBand_${gid}`;
    const blurId = `specBlur_${gid}`;
    const shadowId = `shadow_${gid}`;
    const innerShadowId = `innerShadow_${gid}`;
    const clipId = `batteryInnerClip_${gid}`;

    return html`
      <svg class="sensor-svg${(opts?.charging1) ? " charging" : ""}" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Battery Modern">
        <defs>
          <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.55)"/>
          </filter>
          <filter id="${innerShadowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feOffset dx="0" dy="2"/>
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/>
          </filter>

          <linearGradient id="${gradId}" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
            <stop offset="100%" stop-color="${useGradient ? gTo : gFrom}" stop-opacity="0.98"></stop>
          </linearGradient>

          <!-- Charging sweep -->
          <linearGradient id="${chargeGradId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="rgba(255,255,255,0)"></stop>
            <stop offset="45%" stop-color="rgba(255,255,255,0.0)"></stop>
            <stop offset="55%" stop-color="rgba(255,255,255,0.70)"></stop>
            <stop offset="70%" stop-color="rgba(255,255,255,0.0)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"></stop>
          </linearGradient>

          <!-- Glass sheen -->
          <linearGradient id="${sheenId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="rgba(255,255,255,0.0)"></stop>
            <stop offset="25%" stop-color="rgba(255,255,255,0.12)"></stop>
            <stop offset="50%" stop-color="rgba(255,255,255,0.04)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0.0)"></stop>
          </linearGradient>

          <linearGradient id="${bandId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.18)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0.0)"></stop>
          </linearGradient>

          <filter id="${blurId}">
            <feGaussianBlur stdDeviation="1.4"></feGaussianBlur>
          </filter>

          <clipPath id="${clipId}">
            <rect x="${IN_L}" y="${IN_T}" width="${IN_R-IN_L}" height="${IN_B-IN_T}" rx="${IN_RX}" ry="${IN_RX}"></rect>
          </clipPath>
        </defs>

        <!-- Cap (modern) -->
        <g filter="url(#${shadowId})">
          <rect x="${CAP_X}" y="${CAP_Y}" width="${CAP_W}" height="${CAP_H}" rx="${CAP_RX}" ry="${CAP_RX}"
            fill="${outerFill}" stroke="${frameStroke}" stroke-width="3.0" opacity="0.98"></rect>
          <rect x="${CAP_X+1.2}" y="${CAP_Y+1.2}" width="${CAP_W-2.4}" height="${CAP_H-2.4}" rx="${Math.max(1, CAP_RX-1)}" ry="${Math.max(1, CAP_RX-1)}"
            fill="transparent" stroke="${strokeLite}" stroke-width="2.0" opacity="0.75"></rect>
        </g>

        <!-- Body (modern) -->
        <g filter="url(#${shadowId})">
          <rect x="${OUT_L}" y="${OUT_T}" width="${OUT_R-OUT_L}" height="${OUT_B-OUT_T}" rx="${OUT_RX}" ry="${OUT_RX}"
            fill="${outerFill}" stroke="${frameStroke}" stroke-width="3.0" opacity="0.98"></rect>
          <rect x="${OUT_L+1.4}" y="${OUT_T+1.4}" width="${OUT_R-OUT_L-2.8}" height="${OUT_B-OUT_T-2.8}" rx="${Math.max(1, OUT_RX-1.2)}" ry="${Math.max(1, OUT_RX-1.2)}"
            fill="transparent" stroke="${strokeLite}" stroke-width="2.0" opacity="0.70"></rect>
        </g>

        <!-- Inner cavity -->
        <rect x="${IN_L}" y="${IN_T}" width="${IN_R-IN_L}" height="${IN_B-IN_T}" rx="${IN_RX}" ry="${IN_RX}"
          fill="${tubeBg}" opacity="0.9" filter="url(#${innerShadowId})"></rect>

        <!-- Liquid -->
        <g clip-path="url(#${clipId})">
          <rect x="${IN_L}" y="${liquidY}" width="${IN_R-IN_L}" height="${liquidH}" rx="${IN_RX}" ry="${IN_RX}"
            fill="${useGradient ? `url(#${gradId})` : cSolid}" opacity="0.98"></rect>

          <!-- Charging sweep overlay -->
          ${opts?.charging1 ? html`
            <rect class="charge-sweep" x="${IN_L - (IN_R-IN_L)}" y="${IN_T}" width="${(IN_R-IN_L)*1.6}" height="${IN_B-IN_T}"
              fill="url(#${chargeGradId})" opacity="0.55">
              <animate attributeName="x" from="${IN_L-(IN_R-IN_L)*1.4}" to="${IN_R+(IN_R-IN_L)*0.2}" dur="1.4s" repeatCount="indefinite"></animate>
            </rect>
          ` : ""}

          <!-- Sheen -->
          ${glassOn ? html`
            <rect x="${IN_L}" y="${IN_T}" width="${IN_R-IN_L}" height="${IN_B-IN_T}"
              fill="url(#${sheenId})" opacity="0.85"></rect>
            <rect x="${IN_L}" y="${IN_T}" width="${IN_R-IN_L}" height="${(IN_B-IN_T)*0.28}"
              fill="url(#${bandId})" opacity="0.55" filter="url(#${blurId})"></rect>
          ` : ""}
        </g>

        <!-- Value inSymbol reference -->
        <rect class="value-ref" x="0" y="110" width="1" height="1" fill="transparent"></rect>

        <!-- Scale layer (DOM-populated) -->
        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
      </svg>
    `;
  }


  // ---------------------------
  // Symbol: battery_segments (intervals = blocks)
  // ---------------------------
  _batterySegmentsSvg(opts) {
    const { value, interval, glassOn } = opts;
    const frame = opts?.frameStyle;
    const itActive = normalizeInterval(interval);
    const outline = normalizeHex(itActive.outline, "#ffffff");

    const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");

    return html`
      <svg class="sensor-svg" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Battery segments">
        <!-- Cap -->
        <rect
          x="95" y="6" width="30" height="10"
          rx="4" ry="4"
          fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95"
        />

        <!-- Body -->
        <rect class="outer"
          x="50" y="18" width="120" height="202"
          rx="18" ry="18"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
        />
        
          <!-- Value inSymbol reference: -->          
         <rect class="value-ref" 
               x="0" 
               y="110"
               width="1"
               height="1"
          fill="transparent" />
        


        <!-- Segment blocks (DOM-populated) -->
        <g class="segments-layer" style="pointer-events:none;"></g>

        <!-- Scale layer (DOM-populated) -->
        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
      </svg>
    `;
  }
  
  // ---------------------------
  // Symbol: battery_segments_modern (modern frame, DOM-populated segments)
  // ---------------------------
  _batterySegmentsModernSvg(opts) {
    const { interval, glassOn } = opts;
    const itActive = normalizeInterval(interval);
    const outline = normalizeHex(itActive.outline, "#ffffff");

    const outerFill = glassOn ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
    const strokeDark = isLightHex(outline) ? "rgba(0,0,0,0.75)" : outline;
    const strokeLite = "rgba(255,255,255,0.18)";
    const shadowId = `${this._instanceId}_segM_shadow`;

    return html`
      <svg class="sensor-svg" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Battery segments Modern">
        <defs>
          <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.55)"/>
          </filter>
        </defs>

        <!-- Cap -->
        <g filter="url(#${shadowId})">
          <rect x="93" y="5" width="34" height="12" rx="5" ry="5"
            fill="${outerFill}" stroke="${strokeDark}" stroke-width="3.0" opacity="0.98"></rect>
          <rect x="94.4" y="6.4" width="31.2" height="9.2" rx="4" ry="4"
            fill="transparent" stroke="${strokeLite}" stroke-width="2.0" opacity="0.70"></rect>
        </g>

        <!-- Body -->
        <g filter="url(#${shadowId})">
          <rect class="outer" x="50" y="18" width="120" height="202" rx="20" ry="20"
            fill="${outerFill}" stroke="${strokeDark}" stroke-width="3.0" opacity="0.98"></rect>
          <rect x="51.4" y="19.4" width="117.2" height="199.2" rx="18" ry="18"
            fill="transparent" stroke="${strokeLite}" stroke-width="2.0" opacity="0.70"></rect>
        </g>

        <!-- Value inSymbol reference -->
        <rect class="value-ref" x="0" y="110" width="1" height="1" fill="transparent"></rect>

        <!-- Segment blocks (DOM-populated) -->
        <g class="segments-layer" style="pointer-events:none;"></g>

        <!-- Scale layer (DOM-populated) -->
        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
      </svg>
    `;
  }


  // ---------------------------
  // Symbol: battery_splitted_segments (intervals = blocks, split in middle for two entities)
  // ---------------------------
  _batterySplittedSegmentsSvg(opts) {
    const { interval, glassOn } = opts;
    const frame = opts?.frameStyle;
    const itActive = normalizeInterval(interval);
    const outline = normalizeHex(itActive.outline, "#ffffff");

    const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");
    const tubeBg = glassOn ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)";

    // Same outer as battery_segments, but include a .scale-ref so DOM segments can fit perfectly.
    const OUT_L = 50;
    const OUT_T = 18;
    const OUT_W = 120;
    const OUT_H = 202;
    const OUT_RX = 18;

    const IN_L = 60;
    const IN_T = 26;
    const IN_W = 100;
    const IN_H = 190;
    const IN_RX = 14;

    return html`
      <svg class="sensor-svg" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Battery split segments">
        <!-- Cap -->
        <rect
          x="95" y="6" width="30" height="10"
          rx="4" ry="4"
          fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95"
        />

        <!-- Body -->
        <rect class="outer"
          x="${OUT_L}" y="${OUT_T}" width="${OUT_W}" height="${OUT_H}"
          rx="${OUT_RX}" ry="${OUT_RX}"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
        />

        <!-- Scale reference: EXACT fillable area (used by _drawSegmentsDom) -->
        <rect class="scale-ref"
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="transparent" stroke="transparent"
        />

        <!-- Subtle inner background (behind split segments) -->
        <rect
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="${tubeBg}" opacity="0.65"
        />

        <!-- Value inSymbol reference -->
        <rect class="value-ref" x="0" y="110" width="1" height="1" fill="transparent" />

        <!-- Segment blocks (DOM-populated) -->
        <g class="segments-layer" style="pointer-events:none;"></g>

        <!-- Scale layer (DOM-populated) -->
        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
      </svg>
    `;
  }


  // ---------------------------
  // Symbol: tank (liquid)
  // ---------------------------
  _tankLiquidSvg(opts) {
  const { value, interval, glassOn } = opts;
  const frame = opts?.frameStyle;


  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");
  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const range = (maxS - minS) || 1;
  const pScaled = clamp01((Number(value) - minS) / range);

  const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");
  const tankBg   = frame?.innerBg ?? (glassOn ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)");

  const VB_W = 520;
  const VB_H = 180;

  const BODY_L  = 40;    
  const BODY_R  = 470; 
  const BODY_T  = 8;     
  const BODY_B  = 208;   
  const BODY_W  = BODY_R - BODY_L;
  const BODY_H  = BODY_B - BODY_T;
  const BODY_RX = 84; // 44;

  const IN_PAD_X = 10; //14
  const IN_PAD_T = 12;
  const IN_PAD_B = 12;

  const IN_L = BODY_L + IN_PAD_X;
  const IN_R = BODY_R - IN_PAD_X;
  const IN_T = BODY_T + IN_PAD_T;
  const IN_B = BODY_B - IN_PAD_B;
  const IN_W = IN_R - IN_L;
  const IN_H = IN_B - IN_T;
  const IN_RX = Math.max(12, BODY_RX - 12);

  const liquidH = Math.max(0, Math.min(IN_H, IN_H * pScaled));
  const liquidY = IN_T + (IN_H - liquidH);

  // LOCK / HANDLE (upp + överlapp med body)
  const HANDLE_W  = 92;
  const HANDLE_H  = 15;
  const HANDLE_X  = (BODY_L + BODY_R) / 2 - HANDLE_W / 2;
  const HANDLE_Y  = -8; 
  const HANDLE_RX = 0;

  //Ears
  const EAR_W  = 12;
  const EAR_H  = 15;
  const EAR_RX = 6;
  const EAR_Y  = 4;
  const EAR_LX = BODY_L +30;
  const EAR_RX2 = BODY_R - 30 - EAR_W; //BODY_R;// + 6;

  // Feets
  const FOOT_W  = 34;
  const FOOT_H  = 12;
  const FOOT_RX = 1;
  const FOOT_Y  = 210;
  const FOOT_LX = BODY_L + 66;
  const FOOT_RX3 = BODY_R - 66 - FOOT_W;

  // unique ids
  const gid = `${this._instanceId}_tank`;
  const gradId   = `tankGrad_${gid}`;
  const sheenId  = `tankSheen_${gid}`;
  const bandId   = `tankBand_${gid}`;
  const shadowId = `tankShadow_${gid}`;
  const clipId   = `tankInnerClip_${gid}`;
  const VB_PAD_L = 28; 


  return html`
    <svg class="sensor-svg" viewBox="${-VB_PAD_L} 0 ${VB_W + VB_PAD_L} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tank">    
      <defs>
        <linearGradient id="${gradId}" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stop-color="${gFrom}"></stop>
          <stop offset="100%" stop-color="${gTo}"></stop>
        </linearGradient>

        <linearGradient id="${sheenId}" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.80)"></stop>
          <stop offset="35%" stop-color="rgba(255,255,255,0.18)"></stop>
          <stop offset="78%" stop-color="rgba(255,255,255,0.05)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.38)"></stop>
        </linearGradient>

        <linearGradient id="${bandId}" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.00)"></stop>
          <stop offset="35%" stop-color="rgba(255,255,255,0.18)"></stop>
          <stop offset="55%" stop-color="rgba(255,255,255,0.06)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.00)"></stop>
        </linearGradient>

        <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(0,0,0,0.28)"/>
        </filter>

        <!-- Clip ONLY the inner tank body -->
        <clipPath id="${clipId}">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}" />
        </clipPath>
      </defs>

      <g>
        
          <!-- Scale reference: EXACT fillable area (used for Y positioning) -->
          <rect class="scale-ref"
            x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="transparent" stroke="transparent"
          />
          <!-- Value inSymbol reference: -->          
         <rect class="value-ref" 
               x="0" 
               y="90"
               width="1"
               height="1"
          fill="transparent" />
          
        
        
        <!-- Lock/handtag (sitter ihop) -->
        <rect x="${HANDLE_X}" y="${HANDLE_Y}" width="${HANDLE_W}" height="${HANDLE_H}"
              rx="${HANDLE_RX}" ry="${HANDLE_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95"
              filter="url(#${shadowId})" />

        <rect class="outer"
          x="${BODY_L}" y="${BODY_T}" width="${BODY_W}" height="${BODY_H}"
          rx="${BODY_RX}" ry="${BODY_RX}"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
          filter="url(#${shadowId})"
        />
        
        <!-- Ears -->
        <rect x="${EAR_LX}"  y="${EAR_Y}" width="${EAR_W}" height="${EAR_H}"
              rx="${EAR_RX}" ry="${EAR_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="1" />
        <rect x="${EAR_RX2}" y="${EAR_Y}" width="${EAR_W}" height="${EAR_H}"
              rx="${EAR_RX}" ry="${EAR_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="1" />
        

        <!-- Feets -->
        <rect x="${FOOT_LX}"  y="${FOOT_Y}" width="${FOOT_W}" height="${FOOT_H}"
              rx="${FOOT_RX}" ry="${FOOT_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95" />
        <rect x="${FOOT_RX3}" y="${FOOT_Y}" width="${FOOT_W}" height="${FOOT_H}"
              rx="${FOOT_RX}" ry="${FOOT_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95" />

        <!-- Fill area -->
        <g clip-path="url(#${clipId})">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="${tankBg}"></rect>

          <rect
            x="${IN_L}" y="${liquidY}" width="${IN_W}" height="${liquidH}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="${useGradient ? `url(#${gradId})` : cSolid}"
            opacity="0.98"
          ></rect>

          ${glassOn ? html`
            <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="url(#${sheenId})" opacity="0.55"></rect>
            <rect x="${IN_L - 12}" y="${IN_T - 22}" width="${IN_W + 24}" height="${IN_H + 44}"
                  fill="url(#${bandId})" opacity="0.30"
                  transform="rotate(-12 110 120)"></rect>
          ` : ""}
        </g>

        <!-- Inner border -->
        <rect
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2"
        />
      </g>

      <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
    </svg>
  `;
}

// ---------------------------
// Symbol: gate (sliding / hinged door)
// ---------------------------
_gateSvg(opts) {
  const { interval } = opts;

  // Size
  let w = Number(this._config.gate_width ?? 220);
  if (!Number.isFinite(w)) w = 220;
  w = Math.max(160, Math.min(420, w));

  const type = String(this._config.gate_type || "sliding");
  const side = String(this._config.gate_side || "left");

  const MARGIN = 16;
  const VB_W = w + MARGIN * 2;
  const VB_H = 230;

  const OPEN_X = MARGIN;
  const OPEN_Y = 46;
  const OPEN_W = w;
  const OPEN_H = 168;

  const POST_W = 10;
  const TOP_H = 14;

  // Color is driven by FIRST interval only (as requested)
  const its = Array.isArray(this._config?.intervals) ? this._config.intervals : [];
  const it0 = its && its.length ? normalizeInterval(its[0]) : normalizeInterval(interval);
  const useGradient = !!it0.gradient?.enabled;
  const solid = (it0 && it0.color) ? it0.color : "#9ca3af";
  const outline = (it0 && it0.outline) ? it0.outline : "#ffffff";

  const normalizeFillColor = (c, fallback = "#9ca3af") => {
    const t = (c == null) ? "" : String(c).trim();
    if (!t) return fallback;
    if (isHexColor(t)) return t;
    if (/^rgba?\(/i.test(t)) return t;
    if (/^hsla?\(/i.test(t)) return t;
    return fallback;
  };

  const cSolid = normalizeFillColor(solid, "#9ca3af");
  const gFrom = normalizeFillColor(it0.gradient?.from, cSolid);
  const gTo = normalizeFillColor(it0.gradient?.to, gFrom);

  const leafFill = useGradient
    ? `url(#gateGrad_${this._instanceId})`
    : cSolid;

  // Initial position from anim state (or compute)
  const tp = this._gateAnim && Number.isFinite(Number(this._gateAnim.p)) ? clamp01(this._gateAnim.p) : this._gateComputeTargetP();
  const pNow = clamp01(tp);

  const hingeX = (side === "right") ? (OPEN_X + OPEN_W) : OPEN_X;
  const hingeY = OPEN_Y + OPEN_H / 2;

  // Door-swing visual transform (initial) for Gate type = door
  const doorMaxAng = 70;
  const doorRad0 = (doorMaxAng * pNow) * (Math.PI / 180);
  const doorSx0 = Math.max(0.18, Math.cos(doorRad0));
  const doorSkew0 = (Math.sin(doorRad0) * 18) * (side === "right" ? -1 : 1);

  const svgMarkup = `
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gate">
      <defs>
        ${useGradient ? `
        <linearGradient id="gateGrad_${this._instanceId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${gFrom}"></stop>
          <stop offset="1" stop-color="${gTo}"></stop>
        </linearGradient>
        ` : ""}

        <clipPath id="gateOpen_${this._instanceId}">
          <rect x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" rx="0" ry="0"></rect>
        </clipPath>
      </defs>

      <!-- Posts only (no top frame) -->
      <g opacity="0.98">
        <rect x="${OPEN_X - POST_W}" y="${OPEN_Y}" width="${POST_W}" height="${OPEN_H}" fill="#d1d5db"></rect>
        <circle cx="${(OPEN_X - POST_W/2).toFixed(2)}" cy="${(OPEN_Y).toFixed(2)}" r="${(POST_W/2).toFixed(2)}" fill="#d1d5db"></circle>
        <rect x="${OPEN_X + OPEN_W}" y="${OPEN_Y}" width="${POST_W}" height="${OPEN_H}" fill="#d1d5db"></rect>
        <circle cx="${(OPEN_X + OPEN_W + POST_W/2).toFixed(2)}" cy="${(OPEN_Y).toFixed(2)}" r="${(POST_W/2).toFixed(2)}" fill="#d1d5db"></circle>
      </g>

      <!-- Post outlines only (no top frame) -->
      <rect x="${OPEN_X - POST_W}" y="${OPEN_Y}" width="${POST_W}" height="${OPEN_H}" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="2"></rect>
      <rect x="${OPEN_X + OPEN_W}" y="${OPEN_Y}" width="${POST_W}" height="${OPEN_H}" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="2"></rect>

      <!-- Background inside opening -->
      <g clip-path="url(#gateOpen_${this._instanceId})">
        <rect id="asc-gate-bg-${this._instanceId}" x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="rgba(0,0,0,0.25)" opacity="${(0.08 + 0.35 * pNow).toFixed(3)}"></rect>
        <rect x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="rgba(255,255,255,0.03)"></rect>
      </g>

      <!-- Gate leaf -->
      ${type === "door" ? `
        <g clip-path="url(#gateOpen_${this._instanceId})">
          <g id="asc-gate-doorleaf-${this._instanceId}" data-hx="${hingeX}" data-hy="${hingeY}"
             transform="translate(${hingeX.toFixed(2)} ${hingeY.toFixed(2)}) skewY(${doorSkew0.toFixed(2)}) scale(${doorSx0.toFixed(4)} 1) translate(${-hingeX.toFixed(2)} ${-hingeY.toFixed(2)})">
            <rect x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="${leafFill}" opacity="1"></rect>
            <rect x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="none" stroke="rgba(0,0,0,0.38)" stroke-width="2"></rect>

            <!-- "Door gate" bars (like your icon) -->
            ${(() => {
              const bars = 6;
              let s = "";
              for (let i = 0; i < bars; i++) {
                const xx = OPEN_X + 16 + (OPEN_W - 32) * (i / (bars - 1));
                s += `<rect x="${(xx - 5).toFixed(2)}" y="${(OPEN_Y + 18).toFixed(2)}" width="10" height="${(OPEN_H - 36).toFixed(2)}" fill="rgba(0,0,0,0.22)"></rect>`;
              }
              // Top/bottom rails
              s += `<rect x="${(OPEN_X + 10).toFixed(2)}" y="${(OPEN_Y + 16).toFixed(2)}" width="${(OPEN_W - 20).toFixed(2)}" height="10" fill="rgba(0,0,0,0.22)"></rect>`;
              s += `<rect x="${(OPEN_X + 10).toFixed(2)}" y="${(OPEN_Y + OPEN_H - 26).toFixed(2)}" width="${(OPEN_W - 20).toFixed(2)}" height="10" fill="rgba(0,0,0,0.22)"></rect>`;
              return s;
            })()}
          </g>
        </g>
      ` : `
        <g clip-path="url(#gateOpen_${this._instanceId})">
          <g id="asc-gate-slideleaf-${this._instanceId}" data-openw="${OPEN_W}" data-side="${side}"
             transform="translate(${((side === "right") ? (OPEN_W * pNow) : (-OPEN_W * pNow)).toFixed(2)} 0)">
            <rect x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="${leafFill}" opacity="1"></rect>
            <rect x="${OPEN_X}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="none" stroke="rgba(0,0,0,0.38)" stroke-width="2"></rect>
            ${(() => {
              // "Sliding gate" pickets + rails (like your icon)
              const pickets = 7;
              let s = "";
              for (let i = 0; i < pickets; i++) {
                const xx = OPEN_X + 18 + (OPEN_W - 36) * (i / (pickets - 1));
                s += `<rect x="${(xx - 5).toFixed(2)}" y="${(OPEN_Y + 22).toFixed(2)}" width="10" height="${(OPEN_H - 44).toFixed(2)}" fill="rgba(0,0,0,0.22)"></rect>`;
              }
              s += `<rect x="${(OPEN_X + 10).toFixed(2)}" y="${(OPEN_Y + 18).toFixed(2)}" width="${(OPEN_W - 20).toFixed(2)}" height="10" fill="rgba(0,0,0,0.22)"></rect>`;
              s += `<rect x="${(OPEN_X + 10).toFixed(2)}" y="${(OPEN_Y + OPEN_H - 28).toFixed(2)}" width="${(OPEN_W - 20).toFixed(2)}" height="10" fill="rgba(0,0,0,0.22)"></rect>`;
              return s;
            })()}
          </g>
        </g>
      `}
    </svg>
  `;

  this._gatePendingMarkup = svgMarkup;
  return html`<div class="asc-gate-dom" id="asc-gate-dom-${this._instanceId}"></div>`;
}

// ---------------------------
// Symbol: image
// ---------------------------
_resolveMediaSourceUrl(mediaId) {
  const id = String(mediaId || "").trim();
  if (!id || !this._hass?.callWS) return;

  if (this._mediaResolveCache?.has(id) || this._mediaResolvePending?.has(id)) return;

  try { this._mediaResolvePending.add(id); } catch (_) {}

  this._hass.callWS({ type: "media_source/resolve", media_content_id: id })
    .then((res) => {
      const u = (res && res.url) ? String(res.url) : "";
      const finalUrl = (u && typeof this._hass?.hassUrl === "function") ? this._hass.hassUrl(u) : u;
      if (finalUrl) {
        try { this._mediaResolveCache.set(id, finalUrl); } catch (_) {}
      }
    })
    .catch(() => {})
    .finally(() => {
      try { this._mediaResolvePending.delete(id); } catch (_) {}
      try { this.requestUpdate(); } catch (_) {}
    });
}

_getImageUrl() {
  // Priority:
  // 1) HA Media Browser id (media_source/resolve)
  // 2) image_url (direct URL/path)
  // 3) entity_picture attribute
  const src = String(this._config?.image_source || "url").trim().toLowerCase();
  let url = "";

  if (src === "media") {
    const mid = String(this._config?.image_media || "").trim();
    if (mid) {
      const cached = this._mediaResolveCache?.get(mid);
      if (cached) {
        url = cached;
      } else {
        // Kick off resolve async; placeholder until resolved
        this._resolveMediaSourceUrl(mid);
      }
    }
  }

  if (!url) {
    url = String(this._config?.image_url || "").trim();
  }

  if (!url) {
    try {
      const st = this._hass?.states?.[this._config?.entity];
      const ep = st?.attributes?.entity_picture;
      if (typeof ep === "string" && ep.trim()) url = ep.trim();
    } catch (_) {}
  }

  // Make absolute when possible
  if (url && url.startsWith("/") && typeof this._hass?.hassUrl === "function") {
    url = this._hass.hassUrl(url);
  }


  return url;
}

  _getBadgeImageUrl(b) {
    // Badge image URL: similar priority as card image
    if (!b) return "";
    const src = String(b.img_source || "url").trim().toLowerCase();
    let url = "";

    if (src === "media") {
      const mid = String(b.img_media || "").trim();
      if (mid) {
        const cached = this._mediaResolveCache?.get(mid);
        if (cached) url = cached;
        else this._resolveMediaSourceUrl(mid);
      }
    } else {
      url = String(b.img_url || "").trim();
    }

    if (url && url.startsWith("/") && typeof this._hass?.hassUrl === "function") {
      url = this._hass.hassUrl(url);
    }
    return url;
  }

_renderImageLayer({ background } = {}) {
  const url = this._getImageUrl();
  const fit = (String(this._config?.image_fit || "cover").toLowerCase() === "contain") ? "contain" : "cover";

  const baseOpacity = Number.isFinite(Number(this._config?.image_opacity)) ? Number(this._config.image_opacity) : 1;
  const tintOn = !!this._config?.image_tint;
  const tintColor = String(this._config?.image_tint_color || "#000000").trim() || "#000000";
  const tintOpacity = Number.isFinite(Number(this._config?.image_tint_opacity)) ? Number(this._config.image_tint_opacity) : 0;

  const hasNewDim = !!(this._config && Object.prototype.hasOwnProperty.call(this._config, "image_dim_off"));
  const dimOff = hasNewDim ? !!this._config.image_dim_off : !!this._config?.image_dim_when_off;
  const hasNewDimO = !!(this._config && Object.prototype.hasOwnProperty.call(this._config, "image_dim_off_opacity"));
  const dimFactorRaw = hasNewDimO ? this._config.image_dim_off_opacity : this._config?.image_dim_when_off_opacity;
  const dimFactor = Number.isFinite(Number(dimFactorRaw)) ? Number(dimFactorRaw) : 0.45;

  const isOn = this._isOnLikeState(this._config?.entity);

  let imgOpacity = clamp01(baseOpacity);
  let imgFilter = "none";
  if (dimOff && !isOn) {
    const df = clamp01(dimFactor);
    // Make dimming unmissable by also lowering opacity (filter alone can be subtle with some themes/backgrounds).
    imgOpacity = clamp01(imgOpacity * Math.max(0.05, df));
    imgFilter = `grayscale(1) brightness(${df})`;
  }
const radius = background ? 0 : clampInt(this._config?.image_radius ?? 0, 0, 48, 0);

  const frameOn = !!this._config?.image_frame;
  const frameW = clampInt(this._config?.image_frame_width ?? 2, 0, 10, 2);
  const frameC = String(this._config?.image_frame_color || "rgba(255,255,255,0.22)");

  const boxStyle = [
    `--asc-img-fit:${fit};`,
    `--asc-img-opacity:${imgOpacity};`,
    `--asc-img-filter:${imgFilter};`,
    `--asc-img-radius:${radius}px;`,
    `--asc-img-frame-w:${frameW}px;`,
    `--asc-img-frame-c:${frameC};`,
  ].join("");

  const cls = background ? "asc-image-bg" : "asc-image-box";
  const cls2 = frameOn ? " framed" : "";

  // Placeholder if nothing selected yet
  if (!url) {
    return html`
      <div class="${cls}${cls2} placeholder" style="${boxStyle}">
        <div class="phText">Select image</div>
      </div>
    `;
  }

  return html`
    <div class="${cls}${cls2}" style="${boxStyle}">
      <img class="asc-image" src="${url}" alt="" loading="lazy" />
      ${(dimOff && !isOn) ? html`<div class="asc-image-dim" style="opacity:${clamp01(1 - clamp01(dimFactor))};"></div>` : ""}
      ${tintOn && tintOpacity > 0 ? html`<div class="asc-image-tint" style="background:${tintColor}; opacity:${clamp01(tintOpacity)};"></div>` : ""}
    </div>
  `;
}

_imageSvg(opts) {
  // Symbol-box image (240x170). If full-card background is enabled, hide the centered image to avoid duplicates.
  if (!!this._config?.image_full_card) {
    return html`<div class="asc-image-box placeholder" style="opacity:0; pointer-events:none;"></div>`;
  }
  return this._renderImageLayer({ background: false });
}

_renderImageBackground() {
  // Full-card background image (behind everything).
  return this._renderImageLayer({ background: true });
}

// Symbol: gas_cylinder (liquid)
// ---------------------------

_ibcTankLiquidSvg(opts) {
  const { value, interval, glassOn, defsId } = opts;
  const frame = opts?.frameStyle;

  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");
  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const range = (maxS - minS) || 1;
  const pScaled = clamp01((Number(value) - minS) / range);

  // Styling
  const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.10)");
  const tankBg    = frame?.innerBg ?? (glassOn ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)");

  // Geometry: keep similar overall scale to other symbols, but make the tank "square-ish" and wider than battery.
  const VB_W = 260;
  const VB_H = 250;

  // Leave a slim space for scale on the left
  const BODY_T = 26;
  const BODY_W = 190;   // wider than battery (≈2x feel)
  const BODY_L = VB_W /2 - (BODY_W / 2)//44;
  const BODY_H = 190;   // square proportion
  const BODY_R = BODY_L + BODY_W;
  const BODY_B = BODY_T + BODY_H;

  // Inner "plastic tank" area (fillable)
  const IN_PAD = 7;
  const IN_L = BODY_L + IN_PAD;
  const IN_T = BODY_T + IN_PAD;
  const IN_W = BODY_W - IN_PAD * 2;
  const IN_H = BODY_H - IN_PAD * 2;
  const IN_R = IN_L + IN_W;
  const IN_B = IN_T + IN_H;
  const IN_RX = 12;

  const liquidH = Math.max(0, Math.min(IN_H, IN_H * pScaled));
  const liquidY = IN_T + (IN_H - liquidH);

  // Pallet/base
  const BASE_H = 22;
  const BASE_Y = BODY_B + 10;

  const uid = defsId || this._uid || String(Math.random()).slice(2);
  const gradId = `ibcGrad_${uid}`;
  const sheenId = `ibcSheen_${uid}`;
  const clipId = `ibcClip_${uid}`;

  const fillPaint = useGradient ? `url(#${gradId})` : cSolid;

  // Cage line styling (make it clearly visible vs theme backgrounds)
  const cageStroke = frame?.cageStroke ?? "rgba(255,255,255,0.34)";
  const cageStrokeStrong = frame?.cageStrokeStrong ?? "rgba(255,255,255,0.45)";

  return html`
    <svg class="sensor-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="IBC Tank">
      <defs>
        <linearGradient id="${gradId}" x1="${IN_L}" y1="${IN_B}" x2="${IN_L}" y2="${IN_T}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}"></stop>
          <stop offset="100%" stop-color="${gTo}"></stop>
        </linearGradient>

        <!-- Subtle charging sheen (only visible when .charging is applied) -->
        <linearGradient id="${sheenId}" x1="${IN_L}" y1="${IN_T}" x2="${IN_R}" y2="${IN_T}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="rgba(255,255,255,0)" />
          <stop offset="50%" stop-color="rgba(255,255,255,0.32)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>

        <!-- Clip ONLY the inner tank body (fillable area) -->
        <clipPath id="${clipId}">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}" />
        </clipPath>
      </defs>

      <g>
        <!-- Outer cage / frame -->
        <rect class="outer" x="${BODY_L}" y="${BODY_T}" width="${BODY_W}" height="${BODY_H}" rx="14" ry="14"
              fill="${outerFill}" stroke="${outline}" stroke-width="2" />


        <!-- The inner plastic container (background) -->
        <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}"
              fill="${tankBg}" stroke="rgba(255,255,255,0.18)" stroke-width="2" />

        <!-- Scale reference (Y extent for ticks) -->
        <rect class="scale-ref" x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="transparent" />

        <!-- Liquid fill -->
        <g clip-path="url(#${clipId})">
          <rect x="${IN_L}" y="${liquidY}" width="${IN_W}" height="${liquidH}" rx="${IN_RX}" ry="${IN_RX}" fill="${fillPaint}" opacity="0.98" />
          <!-- Charging sheen overlay -->
          <rect class="charge-sheen" x="${IN_L - 10}" y="${IN_T}" width="${IN_W + 20}" height="${IN_H}"
                fill="url(#${sheenId})" opacity="0.0" />
        </g>

        <!-- Cage grid lines (metal frame feel) -->
        <g stroke="${cageStroke}" stroke-width="2.5">
          ${[0.25,0.5,0.75].map(t => html`<line x1="${BODY_L + BODY_W*t}" y1="${BODY_T+8}" x2="${BODY_L + BODY_W*t}" y2="${BODY_B-8}" />`)}
          ${[0.33,0.66].map(t => html`<line x1="${BODY_L+8}" y1="${BODY_T + BODY_H*t}" x2="${BODY_R-8}" y2="${BODY_T + BODY_H*t}" />`)}
        </g>

        <!-- Top cap -->
        <g>
          <rect x="${BODY_L+BODY_W/2-23}" y="${BODY_T -16}" width="46" height="14" rx="2" ry="6"
                fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.30)" stroke-width="2" />
          <circle cx="${BODY_L+BODY_W/2 -5}" cy="${BASE_Y-35}" r="10" fill="rgba(255,255,255,0.28)" />
        </g>

        <!-- Bottom pallet/base -->
        <g>
          <rect x="${BODY_L+10}" y="${BASE_Y}" width="${BODY_W-20}" height="${BASE_H}" rx="4" ry="4"
                fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
          <g fill="rgba(0,0,0,0.32)">
            <rect x="${BODY_L+28}" y="${BASE_Y+5}" width="56" height="${BASE_H-10}" rx="6" />
            <rect x="${BODY_L+BODY_W/2-28}" y="${BASE_Y+5}" width="56" height="${BASE_H-10}" rx="6" />
            <rect x="${BODY_R-84}" y="${BASE_Y+5}" width="56" height="${BASE_H-10}" rx="6" />
          </g>
          <g fill="rgba(0,0,0,0.12)">          
            <rect x="${BODY_L}" y="${BODY_T +50 }" width="${BODY_W}" height="3" rx="0" />
            <rect x="${BODY_L}" y="${BODY_T +130 }" width="${BODY_W}" height="3" rx="0" />            
            
            <rect x="${BODY_L+53}" y="${BODY_T }" width="3" height=${BODY_H} rx="0" />
            <rect x="${BODY_L+130}" y="${BODY_T }" width="3" height=${BODY_H} rx="0" />
          </g>
        </g>
        </g>
      </svg>
    `;
}

  // ---------------------------
  // Symbol: fan (animated)
  // ---------------------------
_fanSvg(opts) {
  const framed = !!this._config.fan_show_frame;
  return this._fanBaseSvg(opts, framed);
}


// ---------------------------
// Symbol: heatpump (outdoor unit with fan)
// ---------------------------
_heatpumpSvg(opts) {
  // Uses the same DOM-injected SVG technique as the Fan symbol to ensure SVG namespace correctness in HA.
  const { value, interval, glassOn } = opts;

  const frame = opts?.frameStyle;
  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");

  // If outline is very light, use black with opacity instead (more readable).
  let frameStroke = outline;
  let frameStrokeOpacity = 1;
  if (isLightHex(outline)) { frameStroke = "#000000"; frameStrokeOpacity = 0.70; }

  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const raw = toNumberMaybe(value);
  const dir = (Number.isFinite(raw) && raw < 0) ? -1 : 1;

  let vPct = 0;
  if (Number.isFinite(raw)) {
    if (minS < 0 && maxS > 0) {
      const maxAbs = Math.max(Math.abs(minS), Math.abs(maxS)) || 1;
      vPct = clamp01(Math.abs(raw) / maxAbs);
    } else {
      const range = (maxS - minS) || 1;
      vPct = clamp01((raw - minS) / range);
    }
  }

  const windOpacity = clamp01((vPct - 0.55) / 0.45) * 0.75;
  const windDur = (vPct <= 0.55) ? 1.6 : (1.6 - clamp01((vPct - 0.55) / 0.45) * 0.9);
  const durSec = (vPct <= 0) ? 0 : Math.max(0.22, Math.min(3.2, 3.2 - Math.pow(vPct, 0.85) * 2.98));

  const uid = `${this._instanceId}_hp`;
  const gradId = `hpFanGrad_${uid}`;
  const ringId = `hpRingGrad_${uid}`;

  const fanFill = useGradient ? `url(#${gradId})` : cSolid;
  const ringFill = `url(#${ringId})`;

  // Heatpump outdoor unit geometry
  const VB_W = 340;
  const VB_H = 220;

  const BOX_X = 12;
  const BOX_Y = 20;
  const BOX_W = 316;
  const BOX_H = 200;
  const BOX_RX = 26;

  // Fan placement (left)
  const CX = 110;
  const CY = 122;
  const R = 56;
  const hubR = 15;
  const bladeCount = clampInt(this._config.fan_blade_count ?? 3, 2, 8, 3);
  const bladeLen = 40;
  const bladeWid = 16;

  // Right service panel
  const P_X = 210;
  const P_Y = 56;
  const P_W = 90;
  const P_H = 130;
  const P_RX = 16;

  // Make casing less see-through for symbol badges. Opacity slider still works on the container.
  const outerFillOpacity = glassOn ? 0.22 : 0.28;
  const innerFillOpacity = glassOn ? 0.18 : 0.24;

  let bladesSvg = "";
  for (let i = 0; i < bladeCount; i++) {
    const ang = (360 / bladeCount) * i;
    const op = [0.95, 0.72, 0.55][i % 3];
    bladesSvg += `
      <g transform="rotate(${ang} ${CX} ${CY})">
        <rect x="${CX - bladeWid / 2}" y="${CY - hubR - bladeLen}"
              width="${bladeWid}" height="${bladeLen}"
              rx="${Math.round(bladeWid / 2)}"
              fill="${fanFill}" fill-opacity="${op.toFixed(2)}"
              stroke="#000000" stroke-opacity="0.25" stroke-width="1.1"></rect>
        <rect x="${CX - (bladeWid / 2) + 2.0}" y="${CY - hubR - bladeLen + 2.0}"
              width="${Math.max(1, bladeWid - 4.0)}" height="${Math.max(1, bladeLen - 4.0)}"
              rx="${Math.round(Math.max(6, (bladeWid - 4.0) / 2))}"
              fill="#ffffff" fill-opacity="0.08"
              stroke="none"></rect>
      </g>
    `;
  }

  const anim = (durSec > 0)
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="${dir * 360} ${CX} ${CY}" dur="${durSec.toFixed(2)}s" repeatCount="indefinite"></animateTransform>`
    : "";

  this._fanPendingMarkup = `
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heatpump">
      <defs>
        <linearGradient id="${gradId}" x1="${CX - R}" y1="${CY - R}" x2="${CX + R}" y2="${CY + R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
          <stop offset="55%" stop-color="${gTo}" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="${gFrom}" stop-opacity="0.92"></stop>
        </linearGradient>

        <radialGradient id="${ringId}" cx="${CX}" cy="${CY}" r="${R + 18}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"></stop>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0.05"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22"></stop>
        </radialGradient>

        <filter id="hpBladeShadow_${uid}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.15" flood-color="#000000" flood-opacity="0.42"></feDropShadow>
        </filter>
      </defs>

      <g>
        <!-- Outer casing (scale uses this) -->
        <rect class="outer" x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" rx="${BOX_RX}"
              fill="#ffffff" fill-opacity="${outerFillOpacity.toFixed(3)}"
              stroke="#000000" stroke-opacity="0.35" stroke-width="6"></rect>
        <rect x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" rx="${BOX_RX}"
              fill="none" stroke="${frameStroke}" stroke-opacity="${frameStrokeOpacity.toFixed(2)}" stroke-width="3.2"></rect>

        <!-- Subtle inner shading -->
        <rect x="${BOX_X + 14}" y="${BOX_Y + 14}" width="${BOX_W - 28}" height="${BOX_H - 28}" rx="${Math.max(12, BOX_RX - 10)}"
              fill="#000000" fill-opacity="${innerFillOpacity.toFixed(3)}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"></rect>

        <!-- Service panel (right) -->
        <rect x="${P_X}" y="${P_Y}" width="${P_W}" height="${P_H}" rx="${P_RX}"
              fill="#ffffff" fill-opacity="0.05"
              stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"></rect>
        <rect x="${P_X + 18}" y="${P_Y + 10}" width="${P_W - 36}" height="10" rx="5"
              fill="#000000" fill-opacity="0.18"></rect>

        <!-- Scale reference for fit -->
        <rect class="scale-ref" x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" fill="transparent"></rect>
        <rect class="value-ref" x="0" y="${CY}" width="1" height="1" fill="transparent"></rect>

        <!-- Fan shroud -->
        <circle cx="${CX}" cy="${CY}" r="${R + 22}" fill="#000000" fill-opacity="0.20"></circle>
        <circle cx="${CX}" cy="${CY}" r="${R + 12}" fill="${ringFill}"></circle>
        <circle cx="${CX}" cy="${CY}" r="${R + 4}" fill="#000000" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.2"></circle>

        <!-- Rotor -->
        <g filter="url(#hpBladeShadow_${uid})">
          <g class="asc-fan-rotor" data-fan-rotor="1" data-cx="${CX}" data-cy="${CY}">
            ${anim}
            ${bladesSvg}
            <circle cx="${CX}" cy="${CY}" r="16" fill="#000000" fill-opacity="0.38"></circle>
            <circle cx="${CX}" cy="${CY}" r="11" fill="#ffffff" fill-opacity="0.10"></circle>
          </g>
        </g>

        <!-- Grill lines -->
        <g stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" stroke-linecap="round">
          <path d="M ${CX} ${CY - R - 4} L ${CX} ${CY + R + 4}"></path>
          <path d="M ${CX - R - 4} ${CY} L ${CX + R + 4} ${CY}"></path>
          <path d="M ${CX - 48} ${CY - 48} L ${CX + 48} ${CY + 48}"></path>
          <path d="M ${CX + 48} ${CY - 48} L ${CX - 48} ${CY + 48}"></path>
        </g>

        <!-- Wind overlay -->
        <g class="fan-wind" style="opacity:${windOpacity.toFixed(3)};">
          <g stroke="#ffffff" stroke-opacity="0.55" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-dasharray="10 14"
             style="animation-duration:${windDur.toFixed(2)}s;">
            <path d="M ${(CX - 86).toFixed(2)} ${(CY - 58).toFixed(2)} C ${(CX - 38).toFixed(2)} ${(CY - 72).toFixed(2)}, ${(CX - 12).toFixed(2)} ${(CY - 46).toFixed(2)}, ${(CX + 22).toFixed(2)} ${(CY - 56).toFixed(2)} C ${(CX + 50).toFixed(2)} ${(CY - 64).toFixed(2)}, ${(CX + 70).toFixed(2)} ${(CY - 58).toFixed(2)}, ${(CX + 86).toFixed(2)} ${(CY - 42).toFixed(2)}"></path>
            <path d="M ${(CX - 90).toFixed(2)} ${(CY - 8).toFixed(2)} C ${(CX - 44).toFixed(2)} ${(CY - 22).toFixed(2)}, ${(CX - 10).toFixed(2)} ${(CY - 6).toFixed(2)}, ${(CX + 16).toFixed(2)} ${(CY - 14).toFixed(2)} C ${(CX + 44).toFixed(2)} ${(CY - 24).toFixed(2)}, ${(CX + 66).toFixed(2)} ${(CY - 14).toFixed(2)}, ${(CX + 88).toFixed(2)} ${(CY - 2).toFixed(2)}"></path>
            <path d="M ${(CX - 82).toFixed(2)} ${(CY + 40).toFixed(2)} C ${(CX - 34).toFixed(2)} ${(CY + 28).toFixed(2)}, ${(CX - 6).toFixed(2)} ${(CY + 50).toFixed(2)}, ${(CX + 24).toFixed(2)} ${(CY + 40).toFixed(2)} C ${(CX + 50).toFixed(2)} ${(CY + 32).toFixed(2)}, ${(CX + 70).toFixed(2)} ${(CY + 38).toFixed(2)}, ${(CX + 84).toFixed(2)} ${(CY + 52).toFixed(2)}"></path>
          </g>
        </g>

        <!-- Feet -->
        <rect x="${BOX_X + 28}" y="${BOX_Y + BOX_H }" width="56" height="10" rx="4" fill="#000000" fill-opacity="0.28"></rect>
        <rect x="${BOX_X + BOX_W - 84}" y="${BOX_Y + BOX_H }" width="56" height="10" rx="4" fill="#000000" fill-opacity="0.28"></rect>

      </g>
    </svg>
  `;

  return html`<div class="asc-fan-dom" id="asc-fan-dom-${this._instanceId}"></div>`;
}


  
  // ---------------------------
  // Symbol: washing_machine
  // ---------------------------
  
_washingMachineSvg(opts) {
  const { value, interval, glassOn } = opts;

  const it = normalizeInterval(interval);

  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const cScale = normalizeHex(it.scale_color, "#22c55e");
  
  const outline = normalizeHex(it.outline, "#ffffff");

  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  // Determine "active/running"
  const raw = (value == null) ? "" : String(value).trim().toLowerCase();
  const isActive = (typeof value === "number")
    ? (Number.isFinite(value) ? value > 0 : false)
    : (raw !== "" && !["off","closed","idle","standby","paused","unknown","unavailable"].includes(raw));

  // Interval-driven speed: if interval.seconds is set, use it as one full rotation duration.
  let durSec = (it.seconds != null) ? Number(it.seconds) : null;
  if (!(Number.isFinite(durSec) && durSec > 0)) durSec = 2.2;
  durSec = Math.max(0.45, Math.min(8.0, durSec));

  const uid = `${this._instanceId}_wm`;
  const gradId = `wmDrumGrad_${uid}`;
  const ringId = `wmRingGrad_${uid}`;
  const drumFill = useGradient ? `url(#${gradId})` : cSolid;
  const ringFill = `url(#${ringId})`;

  const outerFill = glassOn ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
  const innerFill = glassOn ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.10)";
  const frameStroke = isLightHex(outline) ? "rgba(0,0,0,0.70)" : outline;

  const CX = 130, CY = 152;
  const DOOR_R = 60;
  const INNER_R = 46;

  const spinStyle = isActive ? `animation-duration:${durSec.toFixed(2)}s; transform-origin:${CX}px ${CY}px;` : `transform-origin:${CX}px ${CY}px;`;
  const clothesStyle = isActive ? `animation-duration:${Math.max(0.9, durSec*0.55).toFixed(2)}s; transform-origin:${CX}px ${CY}px;` : `transform-origin:${CX}px ${CY}px;`;

  return html`
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 260 260" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Washing machine">
      <defs>
        <linearGradient id="${gradId}" x1="${CX-INNER_R}" y1="${CY-INNER_R}" x2="${CX+INNER_R}" y2="${CY+INNER_R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
          <stop offset="55%" stop-color="${gTo}" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="${gFrom}" stop-opacity="0.92"></stop>
        </linearGradient>
        <radialGradient id="${ringId}" cx="${CX}" cy="${CY}" r="${DOOR_R+22}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"></stop>
          <stop offset="58%" stop-color="#ffffff" stop-opacity="0.06"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.35"></stop>
        </radialGradient>
      </defs>

      <!-- Body -->
      <rect x="38" y="26" width="184" height="210" rx="22" fill="rgba(255,255,255,0.08)" stroke="${frameStroke}" stroke-width="3"></rect>
      <rect x="52" y="42" width="156" height="36" rx="10" fill="rgba(0,0,0,0.20)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"></rect>

      <!-- Status diode (interval color) -->
      <circle cx="80" cy="60" r="6" fill="${cScale}" opacity="0.95"></circle>
      <circle cx="80" cy="60" r="10" fill="${cScale}" opacity="0.18"></circle>

      <!-- Door ring -->
      <circle cx="${CX}" cy="${CY}" r="${DOOR_R+12}" fill="${ringFill}" opacity="0.9"></circle>
      <circle cx="${CX}" cy="${CY}" r="${DOOR_R+4}" fill="${outerFill}" stroke="rgba(255,255,255,0.10)" stroke-width="2"></circle>

      <!-- Drum -->
      <circle cx="${CX}" cy="${CY}" r="${DOOR_R}" fill="${innerFill}" stroke="rgba(255,255,255,0.10)" stroke-width="2"></circle>
      <g class="${isActive ? "asc-wm-spin" : ""}" style="${spinStyle}">
        <circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="${drumFill}" opacity="0.86"></circle>
        <path d="M ${CX-INNER_R} ${CY} A ${INNER_R} ${INNER_R} 0 0 0 ${CX+INNER_R} ${CY}" fill="none" stroke="rgba(0,0,0,0.20)" stroke-width="5"></path>
        <path d="M ${CX} ${CY-INNER_R} A ${INNER_R} ${INNER_R} 0 0 1 ${CX} ${CY+INNER_R}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="4"></path>
      </g>

      <!-- Clothes blobs -->
      <g class="${isActive ? "asc-wm-clothes" : ""}" style="${clothesStyle}" opacity="0.95">
        <path d="M ${CX-18} ${CY-8} C ${CX-36} ${CY-28}, ${CX-42} ${CY-2}, ${CX-28} ${CY+10} C ${CX-10} ${CY+24}, ${CX-2} ${CY+6}, ${CX-8} ${CY-6} C ${CX-12} ${CY-16}, ${CX-10} ${CY-18}, ${CX-18} ${CY-8} Z" fill="#ffffff" fill-opacity="0.10"></path>
        <path d="M ${CX+14} ${CY-4} C ${CX+30} ${CY-20}, ${CX+44} ${CY-2}, ${CX+32} ${CY+14} C ${CX+18} ${CY+28}, ${CX+6} ${CY+18}, ${CX+10} ${CY+6} C ${CX+12} ${CY-2}, ${CX+8} ${CY-8}, ${CX+14} ${CY-4} Z" fill="#ffffff" fill-opacity="0.12"></path>
        <circle cx="${CX-22}" cy="${CY+26}" r="7.6" fill="#ffffff" fill-opacity="0.08"></circle>
        <circle cx="${CX+44}" cy="${CY+36}" r="3.6" fill="#ffffff" fill-opacity="0.10"></circle>
        <circle cx="${CX+30}" cy="${CY+48}" r="2.4" fill="#ffffff" fill-opacity="0.12"></circle>
      </g>

      <!-- Feet -->
      <rect x="62" y="232" width="36" height="10" rx="5" fill="rgba(0,0,0,0.35)"></rect>
      <rect x="162" y="232" width="36" height="10" rx="5" fill="rgba(0,0,0,0.35)"></rect>
    </svg>
  `;
}

// Symbol: tumble_dryer
  // ---------------------------
  
_tumbleDryerSvg(opts) {
  const { value, interval, glassOn } = opts;

  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#f59e0b");
  const cScale = normalizeHex(it.scale_color, "#22c55e");
  const outline = normalizeHex(it.outline, "#ffffff");

  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  const raw = (value == null) ? "" : String(value).trim().toLowerCase();
  const isActive = (typeof value === "number")
    ? (Number.isFinite(value) ? value > 0 : false)
    : (raw !== "" && !["off","closed","idle","standby","paused","unknown","unavailable"].includes(raw));

  let durSec = (it.seconds != null) ? Number(it.seconds) : null;
  if (!(Number.isFinite(durSec) && durSec > 0)) durSec = 2.0;
  durSec = Math.max(0.40, Math.min(7.0, durSec));

  const uid = `${this._instanceId}_td`;
  const gradId = `tdDrumGrad_${uid}`;
  const ringId = `tdRingGrad_${uid}`;

  const CX = 130, CY = 152;
  const DOOR_R = 60;
  const INNER_R = 46;

  const drumFill = useGradient ? `url(#${gradId})` : cSolid;
  const ringFill = `url(#${ringId})`;

  const outerFill = glassOn ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
  const innerFill = glassOn ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.10)";
  const frameStroke = isLightHex(outline) ? "rgba(0,0,0,0.70)" : outline;

  const spinStyle = isActive ? `animation-duration:${durSec.toFixed(2)}s; transform-origin:${CX}px ${CY}px;` : `transform-origin:${CX}px ${CY}px;`;
  const clothesStyle = isActive ? `animation-duration:${Math.max(0.85, durSec*0.50).toFixed(2)}s; transform-origin:${CX}px ${CY}px;` : `transform-origin:${CX}px ${CY}px;`;

  return html`
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 260 260" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tumble dryer">
      <defs>
        <linearGradient id="${gradId}" x1="${CX-INNER_R}" y1="${CY-INNER_R}" x2="${CX+INNER_R}" y2="${CY+INNER_R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
          <stop offset="55%" stop-color="${gTo}" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="${gFrom}" stop-opacity="0.90"></stop>
        </linearGradient>
        <radialGradient id="${ringId}" cx="${CX}" cy="${CY}" r="${DOOR_R+22}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"></stop>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0.05"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.38"></stop>
        </radialGradient>
      </defs>

      <!-- Body (slightly different panel) -->
      <rect x="38" y="26" width="184" height="210" rx="22" fill="rgba(255,255,255,0.07)" stroke="${frameStroke}" stroke-width="3"></rect>
      <rect x="52" y="42" width="156" height="28" rx="10" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"></rect>

      <!-- Status diode (interval outline + color) -->
      <circle cx="80" cy="56" r="6" fill="${cScale}" opacity="0.95"></circle>
      <circle cx="80" cy="56" r="10" fill="${cScale}" opacity="0.22"></circle>


      <!-- Heat waves indicator -->
      <path d="M 72 62 C 82 52, 92 72, 102 62 C 112 52, 122 72, 132 62" fill="none" stroke="${cSolid}" stroke-width="3" opacity="0.65"></path>
      <path d="M 72 74 C 82 64, 92 84, 102 74 C 112 64, 122 84, 132 74" fill="none" stroke="${cSolid}" stroke-width="3" opacity="0.35"></path>

      <!-- Door ring -->
      <circle cx="${CX}" cy="${CY}" r="${DOOR_R+12}" fill="${ringFill}" opacity="0.9"></circle>
      <circle cx="${CX}" cy="${CY}" r="${DOOR_R+4}" fill="${outerFill}" stroke="rgba(255,255,255,0.10)" stroke-width="2"></circle>

      <!-- Drum -->
      <circle cx="${CX}" cy="${CY}" r="${DOOR_R}" fill="${innerFill}" stroke="rgba(255,255,255,0.10)" stroke-width="2"></circle>
      <g class="${isActive ? "asc-wm-spin rev" : ""}" style="${spinStyle}">
        <circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="${drumFill}" opacity="0.84"></circle>
        <path d="M ${CX-INNER_R} ${CY} A ${INNER_R} ${INNER_R} 0 0 1 ${CX+INNER_R} ${CY}" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="5"></path>
        <path d="M ${CX} ${CY-INNER_R} A ${INNER_R} ${INNER_R} 0 0 0 ${CX} ${CY+INNER_R}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="4"></path>
      </g>

      <!-- Clothes blobs -->
      <g class="${isActive ? "asc-wm-clothes" : ""}" style="${clothesStyle}" opacity="0.95">
        <path d="M ${CX-16} ${CY-6} C ${CX-32} ${CY-24}, ${CX-40} ${CY-2}, ${CX-26} ${CY+10} C ${CX-12} ${CY+22}, ${CX-2} ${CY+10}, ${CX-8} ${CY} C ${CX-12} ${CY-10}, ${CX-8} ${CY-14}, ${CX-16} ${CY-6} Z" fill="#ffffff" fill-opacity="0.09"></path>
        <path d="M ${CX+16} ${CY-2} C ${CX+32} ${CY-18}, ${CX+40} ${CY+2}, ${CX+26} ${CY+14} C ${CX+12} ${CY+26}, ${CX+2} ${CY+14}, ${CX+8} ${CY+4} C ${CX+12} ${CY-4}, ${CX+10} ${CY-8}, ${CX+16} ${CY-2} Z" fill="#ffffff" fill-opacity="0.11"></path>
        <circle cx="${CX-18}" cy="${CY+24}" r="7.0" fill="#ffffff" fill-opacity="0.08"></circle>
        <circle cx="${CX+40}" cy="${CY+34}" r="3.4" fill="#ffffff" fill-opacity="0.10"></circle>
      </g>

      <!-- Feet -->
      <rect x="62" y="232" width="36" height="10" rx="5" fill="rgba(0,0,0,0.35)"></rect>
      <rect x="162" y="232" width="36" height="10" rx="5" fill="rgba(0,0,0,0.35)"></rect>
    </svg>
  `;
}

// Symbol: garage_door 
  // ---------------------------
  _garageDoorSvg(opts) {
    const { value, interval } = opts;

    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];

    const range = (maxS - minS) || 1;

    const type = String(this._config.garage_door_type || "single");
    const isDouble = (type === "double");

    let doorW = Number(this._config.garage_door_width ?? 200);
    if (!Number.isFinite(doorW)) doorW = 200;
    doorW = Math.max(120, Math.min(320, doorW));

    let gap = Number(this._config.garage_door_gap ?? 16);
    if (!Number.isFinite(gap)) gap = 16;
    gap = Math.max(0, Math.min(160, gap));

    const MARGIN = 10;

    // Viewbox width is based on door width (and optional double layout).
    const VB_W = isDouble ? (doorW * 2 + gap + MARGIN * 2) : (doorW + MARGIN * 2);
    const VB_H = 230;

    const OPEN_Y = 34;
    const OPEN_H = 186;

    const OPEN_X_1 = MARGIN;
    const OPEN_X_2 = MARGIN + doorW + gap;

    const OPEN_W = doorW;

    const TRIM = isDouble ? 3.6 : 4.2;
    const IN_Y = OPEN_Y + TRIM;
    const IN_H = OPEN_H - TRIM;

    const uidBase = `${this._instanceId}_gd`;

    const normalizeFillColor = (c, fallback = "#d9d9d9") => {
      const t = (c == null) ? "" : String(c).trim();
      if (!t) return fallback;
      if (isHexColor(t)) return t;
      if (/^rgba?\(/i.test(t)) return t;
      if (/^hsla?\(/i.test(t)) return t;
      return fallback;
    };

    const computePFromState = (entityId, fallbackRaw) => {
      try {
        if (entityId && this.hass?.states?.[entityId]) {
          const st = this.hass.states[entityId];
          const cp = st?.attributes?.current_position;
          let raw = null;
          if (cp != null && Number.isFinite(Number(cp))) raw = Number(cp);
          if (raw == null) raw = toNumberMaybe(st.state);
          if (raw == null || !Number.isFinite(Number(raw))) {
            const s = String(st.state ?? "").trim().toLowerCase();
            if (s === "open" || s === "opening") raw = maxS;
            else if (s === "closed" || s === "closing") raw = minS;
          }
          if (raw != null && Number.isFinite(Number(raw))) return clamp01((Number(raw) - minS) / range);
        }
      } catch (_) {}
      // Fallback (value passed in)
      const raw = toNumberMaybe(fallbackRaw);
      return (raw != null && Number.isFinite(Number(raw))) ? clamp01((Number(raw) - minS) / range) : 0;
    };

    // Lamp entities (back-compat: previous builds used entity2 for the garage lamp)
    const lamp1Id = String(this._config.garage_door_lamp_entity || this._config.entity2 || "").trim();
    const lamp2Id = String(this._config.garage_door_lamp_entity2 || "").trim();

    const door2Entity = String(this._config.garage_door_entity2 || "").trim();

    // Animation position (if active) else compute from state/value
    const p1Target = computePFromState(this._config.entity, value);
    const p2Target = isDouble ? computePFromState(door2Entity, value) : null;

    const p1 = (this._gdAnim?.doors?.[0] && Number.isFinite(this._gdAnim.doors[0].p))
      ? clamp01(this._gdAnim.doors[0].p)
      : p1Target;

    const p2 = (isDouble && this._gdAnim?.doors?.[1] && Number.isFinite(this._gdAnim.doors[1].p))
      ? clamp01(this._gdAnim.doors[1].p)
      : (isDouble ? (p2Target ?? p1Target) : null);

    const doorCount = isDouble ? 2 : 1;

    // Intervals -> panel count/colors (for the door)
    const allIts0 = (this._config?.intervals || []).slice();
    const hasNumericTo = allIts0.some(itx => Number.isFinite(Number(itx?.to)));
    const usableIts = hasNumericTo
      ? allIts0.slice().sort((a, b) => Number(a?.to) - Number(b?.to))
          .filter(itx => Number.isFinite(Number(itx?.to)) && Number(itx.to) > (minS + 1e-9))
          .slice(0, 12)
      : allIts0.filter(itx => (String(itx?.match || "").trim().length > 0) || !!itx?.color).slice(0, 12);

    const panels = Math.max(1, usableIts.length || 1);

    const buildDoor = (idx, openX, pNow, lampOn) => {
      const doorUid = `${uidBase}_${idx}`;
      const roomGradId = `gdRoom_${doorUid}`;
      const coneGradId = `gdCone_${doorUid}`;
      const clipId = `gdClip_${doorUid}`;
      const openClipId = `gdOpen_${doorUid}`;

      const IN_X = openX + TRIM;
      const IN_W = OPEN_W - TRIM * 2;

      const travel = IN_H;
      const initialTy = -clamp01(pNow) * travel;

      const roomVis = clamp01((clamp01(pNow) - 0.02) / 0.18);
      const lightVis = lampOn ? roomVis : 0;

      const panelH = IN_H / panels;

      let panelGradDefsStr = "";
      let panelRectsStr = "";
      let panelLinesStr = "";

      for (let i = 0; i < panels; i++) {
        const y = IN_Y + i * panelH;
        const h = (i === panels - 1) ? (IN_Y + IN_H - y) : panelH;

        const itN = (usableIts[i] || usableIts[usableIts.length - 1] || interval || {});
        const useGradient = !!(itN.gradient && itN.gradient.enabled);

        const solid = normalizeFillColor(itN.color, "#d9d9d9");
        const gFrom = normalizeFillColor(itN.gradient?.from, solid);
        const gTo = normalizeFillColor(itN.gradient?.to, gFrom);

        let fill = solid;
        if (useGradient) {
          const gid = `gdPGrad_${doorUid}_${i}`;
          panelGradDefsStr += `
            <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="${gFrom}"></stop>
              <stop offset="1" stop-color="${gTo}"></stop>
            </linearGradient>
          `;
          fill = `url(#${gid})`;
        }

        // Solid panels (no transparency)
        panelRectsStr += `<rect x="${IN_X}" y="${y.toFixed(2)}" width="${IN_W}" height="${h.toFixed(2)}" fill="${fill}" opacity="1"></rect>`;
        // Panel border
        panelRectsStr += `<rect x="${IN_X}" y="${y.toFixed(2)}" width="${IN_W}" height="${h.toFixed(2)}" fill="none" stroke="rgba(0,0,0,0.30)" stroke-width="1.3"></rect>`;

        if (i > 0) {
          // Strong separation between panels (no gaps)
          panelLinesStr += `<line x1="${(IN_X + 1.5).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(IN_X + IN_W - 1.5).toFixed(2)}" y2="${y.toFixed(2)}" stroke="rgba(0,0,0,0.55)" stroke-width="3.2" stroke-linecap="butt"></line>`;
          panelLinesStr += `<line x1="${(IN_X + 1.5).toFixed(2)}" y1="${(y + 1.4).toFixed(2)}" x2="${(IN_X + IN_W - 1.5).toFixed(2)}" y2="${(y + 1.4).toFixed(2)}" stroke="rgba(255,255,255,0.22)" stroke-width="1.1" stroke-linecap="butt"></line>`;
        }
      }

      let slatLinesStr = "";
      const slatCount = 10;
      for (let i = 1; i < slatCount; i++) {
        const yy = IN_Y + (i * IN_H) / slatCount;
        slatLinesStr += `<line x1="${(IN_X + 6).toFixed(2)}" y1="${yy.toFixed(2)}" x2="${(IN_X + IN_W - 6).toFixed(2)}" y2="${yy.toFixed(2)}" stroke="rgba(0,0,0,0.16)" stroke-width="1"></line>`;
      }

      const defs = `
        <linearGradient id="${roomGradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#111111"></stop>
          <stop offset="1" stop-color="#060606"></stop>
        </linearGradient>

        <radialGradient id="${coneGradId}" cx="50%" cy="0%" r="75%">
          <stop offset="0" stop-color="rgba(255, 214, 137, 0.95)"></stop>
          <stop offset="0.35" stop-color="rgba(255, 214, 137, 0.55)"></stop>
          <stop offset="1" stop-color="rgba(255, 214, 137, 0)"></stop>
        </radialGradient>

        ${panelGradDefsStr}

        <clipPath id="${clipId}">
          <rect x="${IN_X}" y="${IN_Y}" width="${IN_W}" height="${IN_H}" rx="0" ry="0"></rect>
        </clipPath>

        <clipPath id="${openClipId}">
          <rect id="asc-gd-openrect-${this._instanceId}-${idx}" x="${IN_X}" y="${(IN_Y + IN_H).toFixed(2)}" width="${IN_W}" height="0"
                data-iny="${IN_Y}" data-inh="${IN_H}" rx="0" ry="0"></rect>
        </clipPath>
      `;

      const markup = `
        <g data-asc-door="${idx}" class="asc-gd-door">
        <!-- Door frame trims -->
        <rect x="${openX}" y="${OPEN_Y}" width="${TRIM}" height="${OPEN_H}" fill="#cfcfcf" opacity="0.95"></rect>
        <rect x="${(openX + OPEN_W - TRIM).toFixed(2)}" y="${OPEN_Y}" width="${TRIM}" height="${OPEN_H}" fill="#cfcfcf" opacity="0.95"></rect>

        <!-- Frame outline (no bottom line) -->
        <path d="M ${openX} ${OPEN_Y + OPEN_H} L ${openX} ${OPEN_Y} L ${openX + OPEN_W} ${OPEN_Y} L ${openX + OPEN_W} ${OPEN_Y + OPEN_H}"
              fill="none" stroke="rgba(0,0,0,0.26)" stroke-width="2.6" stroke-linecap="butt"></path>

        <!-- Room revealed ONLY in opened area -->
        <g clip-path="url(#${openClipId})">
          <rect x="${IN_X}" y="${IN_Y}" width="${IN_W}" height="${IN_H}" fill="url(#${roomGradId})" opacity="${roomVis.toFixed(3)}"></rect>
        </g>

        <!-- Light cone (only in opened area) -->
        <g clip-path="url(#${openClipId})" opacity="${lightVis.toFixed(3)}">
          <circle cx="${(IN_X + IN_W / 2).toFixed(2)}" cy="${(IN_Y + 6).toFixed(2)}" r="10" fill="rgba(255, 214, 137, 0.35)"></circle>
          <circle cx="${(IN_X + IN_W / 2).toFixed(2)}" cy="${(IN_Y + 6).toFixed(2)}" r="5" fill="rgba(255, 214, 137, 0.75)"></circle>
          <polygon points="${(IN_X + IN_W / 2).toFixed(2)},${(IN_Y + 10).toFixed(2)} ${(IN_X + 10).toFixed(2)},${(IN_Y + IN_H - 4).toFixed(2)} ${(IN_X + IN_W - 10).toFixed(2)},${(IN_Y + IN_H - 4).toFixed(2)}"
                 fill="url(#${coneGradId})"></polygon>
          <rect x="${IN_X}" y="${IN_Y}" width="${IN_W}" height="${IN_H}" fill="rgba(255, 214, 137, 0.08)"></rect>
        </g>

        <!-- Door panels -->
        <g clip-path="url(#${clipId})">
          <g id="asc-gd-door-${this._instanceId}-${idx}" data-travel="${travel.toFixed(2)}" transform="translate(0 ${initialTy.toFixed(2)})">
            ${panelRectsStr}
            <rect x="${(IN_X + 1.5).toFixed(2)}" y="${(IN_Y + 1.5).toFixed(2)}" width="${(IN_W - 3).toFixed(2)}" height="${(IN_H - 3).toFixed(2)}" fill="rgba(255,255,255,0.06)"></rect>
            <rect x="${(IN_X + 1.5).toFixed(2)}" y="${(IN_Y + 1.5).toFixed(2)}" width="${(IN_W - 3).toFixed(2)}" height="${(IN_H - 3).toFixed(2)}" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="1.5"></rect>
            ${slatLinesStr}
            ${panelLinesStr}
          </g>
        </g>
        </g>
      `;

      return { defs, markup };
    };

    const lampOn1 = this._isOnLikeState(lamp1Id);
    const lampOn2 = isDouble ? this._isOnLikeState(lamp2Id) : false;

    const door1 = buildDoor(1, OPEN_X_1, p1, lampOn1);
    const door2 = isDouble ? buildDoor(2, OPEN_X_2, (p2 ?? p1), lampOn2) : null;

    const defsAll = `${door1.defs}${door2 ? door2.defs : ""}`;
    const markupAll = `${door1.markup}${door2 ? door2.markup : ""}`;

    const svgMarkup = `
      <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Garage door">
        <defs>
          ${defsAll}
        </defs>

        <rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="rgba(0,0,0,0.02)"></rect>

        ${markupAll}

        <!-- Top header strip across all doors -->
        <rect x="0" y="${OPEN_Y - 10}" width="${VB_W}" height="18" fill="#d6d6d6" opacity="0.96"></rect>
        <rect x="0" y="${OPEN_Y - 10}" width="${VB_W}" height="18" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="1.8"></rect>
      </svg>
    `;

    this._gdPendingMarkup = svgMarkup;
    return html`<div class="asc-gd-dom" id="asc-gd-dom-${this._instanceId}"></div>`;
  }
  // ---------------------------
  // Symbol: blind (window blind / persienn)
  // ---------------------------
  _blindSvg(opts) {
    const { value } = opts;

    let minS = Number(this._config.min ?? 0);
    let maxS = Number(this._config.max ?? 100);
    if (!Number.isFinite(minS)) minS = 0;
    if (!Number.isFinite(maxS)) maxS = 100;
    if (maxS < minS) [minS, maxS] = [maxS, minS];

    const range = (maxS - minS) || 1;

    // Reuse the same config fields as garage door (type/width/gap/entities/lamps)
    const type = String(this._config.garage_door_type || "single");
    const isDouble = (type === "double");

    let doorW = Number(this._config.garage_door_width ?? 200);
    if (!Number.isFinite(doorW)) doorW = 200;
    doorW = Math.max(120, Math.min(360, doorW));

    let gap = Number(this._config.garage_door_gap ?? 16);
    if (!Number.isFinite(gap)) gap = 16;
    gap = Math.max(0, Math.min(220, gap));

    const MARGIN = 10;

    const VB_W = isDouble ? (doorW * 2 + gap + MARGIN * 2) : (doorW + MARGIN * 2);
    const VB_H = 230;

    const OPEN_Y = 26;
    const OPEN_H = 196;

    const OPEN_X_1 = MARGIN;
    const OPEN_X_2 = MARGIN + doorW + gap;

    const OPEN_W = doorW;

    const TRIM = 5.2; // a bit more "window frame"
    const IN_Y = OPEN_Y + TRIM;
    const IN_H = OPEN_H - TRIM * 2;
    const uidBase = `${this._instanceId}_bd`;

    const normalizeFillColor = (c, fallback = "#d9d9d9") => {
      const t = (c == null) ? "" : String(c).trim();
      if (!t) return fallback;
      if (isHexColor(t)) return t;
      if (/^rgba?\(/i.test(t)) return t;
      if (/^hsla?\(/i.test(t)) return t;
      return fallback;
    };

    const computePFromState = (entityId, fallbackRaw) => {
      try {
        if (entityId && this.hass?.states?.[entityId]) {
          const st = this.hass.states[entityId];
          const cp = st?.attributes?.current_position;
          let raw = null;
          if (cp != null && Number.isFinite(Number(cp))) raw = Number(cp);
          if (raw == null) raw = toNumberMaybe(st.state);
          if (raw != null && Number.isFinite(Number(raw))) return clamp01((Number(raw) - minS) / range);
        }
      } catch (_) {}
      const raw = toNumberMaybe(fallbackRaw);
      return (raw != null && Number.isFinite(Number(raw))) ? clamp01((Number(raw) - minS) / range) : 0;
    };

    
    // --- Blind style: Window (front view window + venetian overlay) ---
    const blindStyleMode = String(this._config?.blind_style || "persienne").trim().toLowerCase();
    if (blindStyleMode === "window") {
      // NOTE: For Window style:
// - Main entity drives OPEN/CLOSED only (visual). It must NOT affect blind position.
// - Blind position is driven ONLY by blind_position_entity (and blind_position_entity2 for double).
const garageType = String(this._config?.garage_door_type || "single").trim().toLowerCase();
const isDouble = (garageType === "double");

const _winIsOpenFromId = (eid) => {
  const id = String(eid || "").trim();
  if (!id) return false;
  const st = this.hass?.states?.[id];
  const s = (st?.state == null) ? "" : String(st.state).trim().toLowerCase();
  return (s === "open" || s === "opening" || s === "on" || s === "true" || s === "tilted" || s === "ventilation");
};

const mainId1 = String(this._config?.entity || "").trim();
const mainId2 = String(this._config?.garage_door_entity2 || "").trim(); // reused key (Blind double)
const mainStateRaw1 = mainId1 ? (this.hass?.states?.[mainId1]?.state) : null;
const mainStateRaw2 = mainId2 ? (this.hass?.states?.[mainId2]?.state) : null;

const isOpen1 = _winIsOpenFromId(mainId1);
const isOpen2 = isDouble ? _winIsOpenFromId(mainId2 || mainId1) : false;

// Blind position entity drives venetian coverage (0..100, where 0 = fully up/open, 100 = fully down/closed)
      const _winPDownFromPosId = (eid) => {
  try {
    const id = String(eid || "").trim();
    if (!id || !this.hass?.states?.[id]) return 0;
    const st = this.hass.states[id];
    const dom = String(id).split(".")[0] || "";
    const cp = st?.attributes?.current_position;
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const toNum = (v) => {
      if (v == null) return null;
      const s0 = String(v).trim();
      if (!s0) return null;
      const m = s0.match(/-?\d+(?:[\.,]\d+)?/);
      const s = m ? m[0] : s0;
      const n = Number(String(s).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    if (cp != null) {
      const n = toNum(cp);
      if (n != null) {
        const pOpen = clamp01(n / 100); // HA cover: 0=closed, 100=open
        return (dom === "cover") ? (1 - pOpen) : pOpen;
      }
    }

    const nState = toNum(st.state);
    if (nState != null) {
      if (nState >= 0 && nState <= 1) return clamp01(nState);
      if (nState >= 0 && nState <= 100) return clamp01(nState / 100); // assume 0=up/open, 100=down/closed
    }

    const s = String(st.state ?? "").trim().toLowerCase();
    if (s === "open" || s === "opening" || s === "on" || s === "true") return 0;
    if (s === "closed" || s === "closing" || s === "off" || s === "false") return 1;
  } catch (_) {}
  return 0;
};

const posId1 = String(this._config?.blind_position_entity || "").trim();
const posId2 = String(this._config?.blind_position_entity2 || "").trim();

const pDown1 = _winPDownFromPosId(posId1);
const pDown2 = isDouble ? _winPDownFromPosId(posId2 || posId1) : 0;

const posPct1 = Math.round(pDown1 * 100);
const posPct2 = Math.round(pDown2 * 100);

// Lamp glow behind glass (optional)
const lamp1Id = String(this._config?.garage_door_lamp_entity || "").trim()
  || String(this._config?.entity2 || "").trim(); // legacy fallback
const lamp2Id = String(this._config?.garage_door_lamp_entity2 || "").trim();
const lampOn1 = this._isOnLikeState(lamp1Id);
const lampOn2 = isDouble ? this._isOnLikeState(lamp2Id || lamp1Id) : false;

// User-controlled window lamp glow opacity
let _wLampOp = Number(this._config?.window_lamp_opacity);
if (!Number.isFinite(_wLampOp)) _wLampOp = 0.5;
// Allow 0..100 as percent
if (_wLampOp > 1.0001) _wLampOp = _wLampOp / 100;
const windowLampOpacity = clamp01(_wLampOp);

// Colors:
      // - Main entity interval controls window frame accent (open/closed state)
      // - Position interval controls slat tint (0..100)
      const itMain1 = normalizeInterval(this._findIntervalForStateOrValue(null, (mainStateRaw1 == null ? null : String(mainStateRaw1).trim()), this._config?.intervals));
const itMain2 = isDouble
  ? normalizeInterval(this._findIntervalForStateOrValue(null, (mainStateRaw2 == null ? null : String(mainStateRaw2).trim()), this._config?.intervals))
  : itMain1;

// Frame uses interval fill; glass stays glass/transparent.
const frameFill1 = normalizeFillColor(itMain1.color || itMain1.fill, "rgba(245,245,245,1)");
const frameAccent1 = normalizeFillColor(itMain1.outline || itMain1.color, "rgba(0,0,0,0.26)");
const frameFill2 = normalizeFillColor((itMain2?.color || itMain2?.fill), frameFill1);
const frameAccent2 = normalizeFillColor((itMain2?.outline || itMain2?.color), frameAccent1);

const itPos1 = normalizeInterval(this._findIntervalForStateOrValue(posPct1, null, this._config?.intervals));
const slatTint1 = normalizeFillColor(itPos1.color, "#d8d8d8");

const itPos2 = isDouble
  ? normalizeInterval(this._findIntervalForStateOrValue(posPct2, null, this._config?.intervals))
  : itPos1;
const slatTint2 = normalizeFillColor(itPos2.color, "#d8d8d8");

// Geometry: reuse existing blind/garage layout constants

      const buildOne = (openX, openFlag, frameFill, frameAccent, slatTint, pDown, lampOn) => {
        const IN_X = openX + TRIM;
        const IN_W = OPEN_W - TRIM * 2;

        // Split into two panes
        const midX = IN_X + IN_W / 2;
        const panePad = 1.6;
        const paneW = (IN_W / 2) - panePad;

        // Glass rects
        const gY = IN_Y + 2.0;
        const gH = IN_H - 4.0;

        const leftX = IN_X + panePad;
        const rightX = midX + panePad * 0.5;

        // Blind coverage (from top down)
        const coverH = Math.max(0, Math.min(IN_H, pDown * IN_H));

        const clipId = `ascWinClip_${uidBase}_${openX}`;
        const glassGradId = `ascWinGlass_${uidBase}_${openX}`;
        const glassHiId = `ascWinGlassHi_${uidBase}_${openX}`;
        const glowGradId = `ascWinGlow_${uidBase}_${openX}`;
        const glowRadId = `ascWinGlowRad_${uidBase}_${openX}`;

        const defs = `
          <clipPath id="${clipId}">
            <rect x="${IN_X.toFixed(2)}" y="${IN_Y.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${coverH.toFixed(2)}"></rect>
          </clipPath>
          <linearGradient id="${glassGradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgba(200,232,255,0.12)"></stop>
            <stop offset="0.55" stop-color="rgba(170,215,250,0.06)"></stop>
            <stop offset="1" stop-color="rgba(120,190,240,0.10)"></stop>
          </linearGradient>
          <radialGradient id="${glassHiId}" cx="35%" cy="20%" r="70%">
            <stop offset="0" stop-color="rgba(255,255,255,0.14)"></stop>
            <stop offset="0.45" stop-color="rgba(255,255,255,0.05)"></stop>
            <stop offset="1" stop-color="rgba(255,255,255,0)"></stop>
          </radialGradient>
<linearGradient id="${glowGradId}" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="rgba(255,238,200,0.18)"></stop>
  <stop offset="0.40" stop-color="rgba(255,214,137,0.10)"></stop>
  <stop offset="1" stop-color="rgba(255,214,137,0)"></stop>
</linearGradient>
<radialGradient id="${glowRadId}" cx="50%" cy="10%" r="70%">
  <stop offset="0" stop-color="rgba(255,244,210,0.16)"></stop>
  <stop offset="0.55" stop-color="rgba(255,214,137,0.10)"></stop>
  <stop offset="1" stop-color="rgba(255,214,137,0)"></stop>
</radialGradient>
        `;

        // Glow (behind glass) - top-down like Garage room light (subtle)
const glowOpacity = lampOn ? windowLampOpacity : 0;
const glow = `
  <g opacity="${glowOpacity}">
    <rect x="${IN_X.toFixed(2)}" y="${IN_Y.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${IN_H.toFixed(2)}" fill="url(#${glowGradId})"></rect>
    <rect x="${IN_X.toFixed(2)}" y="${IN_Y.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${IN_H.toFixed(2)}" fill="url(#${glowRadId})"></rect>
  </g>
`;
// Venetian slats (only drawn inside cover clip; gaps are transparent so glow can be seen)
        const slatH = 7.0;
        const count = Math.max(10, Math.floor(IN_H / slatH));
        const x0 = IN_X + 3;
        const x1 = IN_X + IN_W - 3;

        let slats = "";
        for (let i = 0; i < count; i++) {
          const yy = IN_Y + i * (IN_H / count);
          const h = (IN_H / count);
          const gap = Math.max(1.6, h * 0.28);
          const slatFillH = Math.max(2.8, h - gap);
          const tilt = 1.15;
          slats += `
            <path d="M ${x0.toFixed(2)} ${yy.toFixed(2)}
                     L ${x1.toFixed(2)} ${(yy + tilt).toFixed(2)}
                     L ${x1.toFixed(2)} ${(yy + slatFillH).toFixed(2)}
                     L ${x0.toFixed(2)} ${(yy + slatFillH - tilt).toFixed(2)} Z"
                  fill="${slatTint}" opacity="0.38"></path>
            <line x1="${x0.toFixed(2)}" y1="${(yy + 1).toFixed(2)}" x2="${x1.toFixed(2)}" y2="${(yy + 1 + tilt).toFixed(2)}"
                  stroke="rgba(255,255,255,0.18)" stroke-width="1"></line>
            <line x1="${x0.toFixed(2)}" y1="${(yy + slatFillH - 1).toFixed(2)}" x2="${x1.toFixed(2)}" y2="${(yy + slatFillH - 1 + tilt).toFixed(2)}"
                  stroke="rgba(0,0,0,0.16)" stroke-width="1"></line>
          `;
        }

        // Open sash illusion (front view) — left pane opens "toward you"
        const sashClosed = `
          <rect x="${leftX.toFixed(2)}" y="${gY.toFixed(2)}" width="${paneW.toFixed(2)}" height="${gH.toFixed(2)}"
                fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.24)" stroke-width="2"></rect>
        `;

        const sashOpen = `
          <polygon points="
            ${(leftX - 2).toFixed(2)},${(gY + 2).toFixed(2)}
            ${(leftX + paneW - 10).toFixed(2)},${(gY + 10).toFixed(2)}
            ${(leftX + paneW - 10).toFixed(2)},${(gY + gH - 10).toFixed(2)}
            ${(leftX - 2).toFixed(2)},${(gY + gH - 2).toFixed(2)}"
            fill="rgba(255,255,255,0.06)" stroke="rgba(0,0,0,0.24)" stroke-width="2"></polygon>
          <polygon points="
            ${(leftX + paneW - 10).toFixed(2)},${(gY + 10).toFixed(2)}
            ${(leftX + paneW + 2).toFixed(2)},${(gY + 4).toFixed(2)}
            ${(leftX + paneW + 2).toFixed(2)},${(gY + gH - 4).toFixed(2)}
            ${(leftX + paneW - 10).toFixed(2)},${(gY + gH - 10).toFixed(2)}"
            fill="rgba(0,0,0,0.10)"></polygon>
        `;

        const markup = `
          <g>
            <!-- Outer frame (bars only so glass is never tinted by frame fill) -->
<rect x="${openX}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}"
      fill="none" stroke="${frameAccent}" stroke-width="2.2"></rect>

<!-- Frame bars -->
<rect x="${openX}" y="${OPEN_Y}" width="${OPEN_W}" height="12"
      fill="${frameFill}" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"></rect>
<rect x="${openX}" y="${(OPEN_Y + 12).toFixed(2)}" width="12" height="${(OPEN_H - 12).toFixed(2)}"
      fill="${frameFill}" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"></rect>
<rect x="${(openX + OPEN_W - 12).toFixed(2)}" y="${(OPEN_Y + 12).toFixed(2)}" width="12" height="${(OPEN_H - 12).toFixed(2)}"
      fill="${frameFill}" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"></rect>

<!-- Inner opening -->
<rect x="${(openX + 12).toFixed(2)}" y="${(OPEN_Y + 12).toFixed(2)}" width="${(OPEN_W - 24).toFixed(2)}" height="${(OPEN_H - 24).toFixed(2)}"
      fill="rgba(0,0,0,0.02)" stroke="rgba(0,0,0,0.20)" stroke-width="2.0"></rect>

<!-- Sill -->
<rect x="${(openX + 2).toFixed(2)}" y="${(OPEN_Y + OPEN_H - 20).toFixed(2)}" width="${(OPEN_W - 4).toFixed(2)}" height="22"
      fill="${frameFill}" opacity="0.92" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"></rect>

<!-- Glass area base (neutral, not interval-tinted) -->
<rect x="${IN_X.toFixed(2)}" y="${IN_Y.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${IN_H.toFixed(2)}"
      fill="rgba(18,28,40,0.05)"></rect>
            ${glow}
            <!-- Glass panes: transparent, with subtle glass tint + highlight so lamp glow can be seen -->
            <rect x="${leftX.toFixed(2)}" y="${gY.toFixed(2)}" width="${paneW.toFixed(2)}" height="${gH.toFixed(2)}"
                  fill="url(#${glassGradId})" opacity="0.18" stroke="rgba(0,0,0,0.12)" stroke-width="1"></rect>
            <rect x="${rightX.toFixed(2)}" y="${gY.toFixed(2)}" width="${paneW.toFixed(2)}" height="${gH.toFixed(2)}"
                  fill="url(#${glassGradId})" opacity="0.18" stroke="rgba(0,0,0,0.12)" stroke-width="1"></rect>
            <rect x="${leftX.toFixed(2)}" y="${gY.toFixed(2)}" width="${paneW.toFixed(2)}" height="${gH.toFixed(2)}" fill="url(#${glassHiId})"></rect>
            <rect x="${rightX.toFixed(2)}" y="${gY.toFixed(2)}" width="${paneW.toFixed(2)}" height="${gH.toFixed(2)}" fill="url(#${glassHiId})"></rect>
<!-- Center mullion -->
            <rect x="${(midX - 2.0).toFixed(2)}" y="${IN_Y.toFixed(2)}" width="4.0" height="${IN_H.toFixed(2)}"
                  fill="${frameFill}" opacity="0.90" stroke="rgba(0,0,0,0.14)" stroke-width="1"></rect>

            <!-- Sashes -->
            ${openFlag ? sashOpen : sashClosed}
            <rect x="${rightX.toFixed(2)}" y="${gY.toFixed(2)}" width="${paneW.toFixed(2)}" height="${gH.toFixed(2)}"
                  fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.24)" stroke-width="2"></rect>

            <!-- Handle (center, window-style) -->
            <g transform="translate(${(midX - 2).toFixed(2)} ${(IN_Y + IN_H*0.49).toFixed(2)}) rotate(-12)">
              <rect x="-2.2" y="-16" width="6.0" height="28" rx="2.2"
                    fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.25)" stroke-width="0.9"></rect>
              <rect x="1.6" y="-10" width="9.5" height="5.2" rx="2.2"
                    fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.22)" stroke-width="0.9"></rect>
              <circle cx="0.8" cy="-12.6" r="1.0" fill="rgba(0,0,0,0.18)"></circle>
            </g>

            <!-- Venetian blind (clip to coverage) -->
            <g clip-path="url(#${clipId})">
              ${slats}
            </g>

            <!-- Top rail -->
            <rect x="${IN_X.toFixed(2)}" y="${(IN_Y - 9).toFixed(2)}" width="${IN_W.toFixed(2)}" height="10"
                  fill="rgba(0,0,0,0.10)"></rect>
            <rect x="${IN_X.toFixed(2)}" y="${(IN_Y - 9).toFixed(2)}" width="${IN_W.toFixed(2)}" height="10"
                  fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1"></rect>
          </g>
        `;

        return { defs, markup };
      };

      const w1 = buildOne(OPEN_X_1, isOpen1, frameFill1, frameAccent1, slatTint1, pDown1, lampOn1);

      const w2 = isDouble
        ? buildOne(OPEN_X_2, isOpen2, frameFill2, frameAccent2, slatTint2, pDown2, lampOn2)
        : null;

      const svgMarkup = `
        <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Window Blind">
          <defs>
            ${w1.defs}
            ${w2 ? w2.defs : ""}
          </defs>
          ${w1.markup}
          ${w2 ? w2.markup : ""}
        </svg>
      `;

      this._gdPendingMarkup = svgMarkup;
      return html`<div class="asc-gd-dom" id="asc-gd-dom-${this._instanceId}"></div>`;
    }
// Targets (door 1 + optional door 2)
    const p1 = computePFromState(this._config?.entity, value);
    const e2 = isDouble ? String(this._config?.garage_door_entity2 || "").trim() : "";
    const p2 = (isDouble && e2) ? computePFromState(e2, value) : null;

    // Lamp entities (optional)
    const lamp1Id = String(this._config?.garage_door_lamp_entity || "").trim()
      || String(this._config?.entity2 || "").trim(); // legacy fallback
    const lamp2Id = String(this._config?.garage_door_lamp_entity2 || "").trim();

    const buildWindow = (idx, openX, p, lampOn) => {
      const IN_X = openX + TRIM;
      const IN_W = OPEN_W - TRIM * 2;

      const travel = IN_H;
      const initialTy = -clamp01(p) * travel;

      const roomGradId = `bdRoom_${uidBase}_${idx}`;
      const coneGradId = `bdCone_${uidBase}_${idx}`;
      const clipId = `bdClip_${uidBase}_${idx}`;
      const openClipId = `bdOpenClip_${uidBase}_${idx}`;

      // Visibility: only show behind when open
      const roomVis = clamp01(p) * 0.98;
      const lightVis = (lampOn ? 1 : 0) * clamp01(p);

      // Build segments from intervals: each interval becomes one solid/gradient panel
      const rawIntervals = intervalsSortedByTo(this._config?.intervals || []);
      const usable = rawIntervals.filter(it => Number.isFinite(Number(it.to)) && Number(it.to) > (minS + 1e-9));
      const caps = usable.slice(0, 12);

      const segments = [];
      let prevP = 0;
      for (const it of caps) {
        const pp = clamp01((Number(it.to) - minS) / range);
        if (pp <= prevP + 1e-6) continue;
        segments.push({ p0: prevP, p1: pp, it: normalizeInterval(it) });
        prevP = pp;
        if (pp >= 0.9999) break;
      }
      if (!segments.length || segments[segments.length - 1].p1 < 0.9999) {
        segments.push({ p0: prevP, p1: 1, it: normalizeInterval(rawIntervals[rawIntervals.length - 1] || {}) });
      }

      const panelGradDefs = [];
      const panelRects = [];
      const panelLines = [];

      for (let i = 0; i < segments.length; i++) {
        const sg = segments[i];
        const y0 = IN_Y + sg.p0 * IN_H;
        const y1 = IN_Y + sg.p1 * IN_H;
        const h = Math.max(1.5, y1 - y0);

        const it = sg.it || {};
        const useGrad = !!it.gradient?.enabled;
        const solid = normalizeFillColor(it.color, "#d8d8d8");
        const gFrom = normalizeFillColor(it.gradient?.from, solid);
        const gTo = normalizeFillColor(it.gradient?.to, gFrom);
        const gradId = `bdSegGrad_${uidBase}_${idx}_${i}`;

        if (useGrad) {
          panelGradDefs.push(`
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="${gFrom}"></stop>
              <stop offset="1" stop-color="${gTo}"></stop>
            </linearGradient>
          `);
        }

        panelRects.push(`
          <rect x="${IN_X.toFixed(2)}" y="${y0.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${h.toFixed(2)}"
                fill="${useGrad ? `url(#${gradId})` : solid}" opacity="1"></rect>
        `);

        // Separator line between panels (no gap)
        if (i > 0) {
          panelLines.push(`
            <line x1="${IN_X.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${(IN_X + IN_W).toFixed(2)}" y2="${y0.toFixed(2)}"
                  stroke="rgba(0,0,0,0.22)" stroke-width="1.6" shape-rendering="crispEdges"></line>
          `);
        }
      }

      const panelGradDefsStr = panelGradDefs.join("");
      const panelRectsStr = panelRects.join("");
      const panelLinesStr = panelLines.join("");

      // Slats overlay: Persienn (horizontal) vs Lamell (vertical)
      const blindStyle = String(this._config?.blind_style || "persienne").trim().toLowerCase();
      const isLamella = (blindStyle === "lamella" || blindStyle === "lamell");

      let slatLinesStr = "";
      if (isLamella) {
        // Vertical lamellas
        const lamCount = 10;
        const w = IN_W / lamCount;
        for (let i = 0; i < lamCount; i++) {
          const xx = IN_X + i * w;
          const shade = (i % 2 === 0) ? 0.10 : 0.16;
          slatLinesStr += `
            <rect x="${xx.toFixed(2)}" y="${IN_Y.toFixed(2)}" width="${Math.max(1, w).toFixed(2)}" height="${IN_H.toFixed(2)}"
                  fill="rgba(0,0,0,${shade.toFixed(2)})"></rect>
            <line x1="${xx.toFixed(2)}" y1="${IN_Y.toFixed(2)}" x2="${xx.toFixed(2)}" y2="${(IN_Y + IN_H).toFixed(2)}"
                  stroke="rgba(255,255,255,0.12)" stroke-width="1"></line>
          `;
        }
      } else {
        // Horizontal venetian persienne slats, slightly "3D"
        const slatH = 7;
        const count = Math.max(8, Math.floor(IN_H / slatH));
        const x0 = IN_X + 3;
        const x1 = IN_X + IN_W - 3;
        for (let i = 0; i < count; i++) {
          const yy = IN_Y + i * (IN_H / count);
          const h = IN_H / count;
          const tilt = 1.2; // small tilt for realism
          slatLinesStr += `
            <path d="M ${x0.toFixed(2)} ${yy.toFixed(2)}
                     L ${x1.toFixed(2)} ${(yy + tilt).toFixed(2)}
                     L ${x1.toFixed(2)} ${(yy + slatFillH).toFixed(2)}
                     L ${x0.toFixed(2)} ${(yy + slatFillH - tilt).toFixed(2)} Z"
                  fill="rgba(0,0,0,0.10)"></path>
            <line x1="${x0.toFixed(2)}" y1="${(yy + 1).toFixed(2)}" x2="${x1.toFixed(2)}" y2="${(yy + 1 + tilt).toFixed(2)}"
                  stroke="rgba(255,255,255,0.14)" stroke-width="1"></line>
            <line x1="${x0.toFixed(2)}" y1="${(yy + slatFillH - 1).toFixed(2)}" x2="${x1.toFixed(2)}" y2="${(yy + slatFillH - 1 + tilt).toFixed(2)}"
                  stroke="rgba(0,0,0,0.14)" stroke-width="1"></line>
          `;
        }
      }

      // Bottom rail (moves with the blind)
      const railH = 7;
      const railY = (IN_Y + IN_H - railH);

      const defs = `
        <linearGradient id="${roomGradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1a1a1a"></stop>
          <stop offset="1" stop-color="#050505"></stop>
        </linearGradient>

        <radialGradient id="${coneGradId}" cx="50%" cy="0%" r="85%">
          <stop offset="0" stop-color="rgba(255, 238, 200, 0.92)"></stop>
          <stop offset="0.40" stop-color="rgba(255, 238, 200, 0.48)"></stop>
          <stop offset="1" stop-color="rgba(255, 238, 200, 0)"></stop>
        </radialGradient>

        ${panelGradDefsStr}

        <clipPath id="${clipId}">
          <rect x="${IN_X}" y="${IN_Y}" width="${IN_W}" height="${IN_H}" rx="0" ry="0"></rect>
        </clipPath>

        <clipPath id="${openClipId}">
          <rect id="asc-gd-openrect-${this._instanceId}-${idx}" x="${IN_X}" y="${(IN_Y + IN_H).toFixed(2)}" width="${IN_W}" height="0"
                data-iny="${IN_Y}" data-inh="${IN_H}" rx="0" ry="0"></rect>
        </clipPath>
      `;

      const markup = `
        <g data-asc-door="${idx}" class="asc-bd-door">
        <!-- Window frame -->
        <rect x="${openX}" y="${OPEN_Y}" width="${OPEN_W}" height="${OPEN_H}" fill="rgba(255,255,255,0.03)"
              stroke="rgba(0,0,0,0.30)" stroke-width="2.4"></rect>
        <rect x="${(openX + 2).toFixed(2)}" y="${(OPEN_Y + 2).toFixed(2)}" width="${(OPEN_W - 4).toFixed(2)}" height="${(OPEN_H - 4).toFixed(2)}"
              fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"></rect>

        <!-- Outside/room revealed ONLY in opened area -->
        <g clip-path="url(#${openClipId})">
          <rect x="${IN_X}" y="${IN_Y}" width="${IN_W}" height="${IN_H}" fill="url(#${roomGradId})" opacity="${roomVis.toFixed(3)}"></rect>
        </g>

        <!-- Light cone (only in opened area) -->
        <g clip-path="url(#${openClipId})" opacity="${lightVis.toFixed(3)}">
          <circle cx="${(IN_X + IN_W / 2).toFixed(2)}" cy="${(IN_Y + 6).toFixed(2)}" r="9" fill="rgba(255, 238, 200, 0.28)"></circle>
          <circle cx="${(IN_X + IN_W / 2).toFixed(2)}" cy="${(IN_Y + 6).toFixed(2)}" r="4.5" fill="rgba(255, 238, 200, 0.70)"></circle>
          <polygon points="${(IN_X + IN_W / 2).toFixed(2)},${(IN_Y + 10).toFixed(2)} ${(IN_X + 10).toFixed(2)},${(IN_Y + IN_H - 6).toFixed(2)} ${(IN_X + IN_W - 10).toFixed(2)},${(IN_Y + IN_H - 6).toFixed(2)}"
                 fill="url(#${coneGradId})"></polygon>
        </g>

        <!-- Blind shade panels -->
        <g clip-path="url(#${clipId})">
          <g id="asc-gd-door-${this._instanceId}-${idx}" data-travel="${travel.toFixed(2)}" transform="translate(0 ${initialTy.toFixed(2)})">
            ${panelRectsStr}
            ${panelLinesStr}
            ${slatLinesStr}

            <!-- Slight highlight -->
            <rect x="${(IN_X + 1.0).toFixed(2)}" y="${(IN_Y + 1.0).toFixed(2)}" width="${(IN_W - 2.0).toFixed(2)}" height="${(IN_H - 2.0).toFixed(2)}"
                  fill="rgba(255,255,255,0.05)"></rect>

            <!-- Bottom rail -->
            <rect x="${IN_X.toFixed(2)}" y="${railY.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${railH}"
                  fill="rgba(0,0,0,0.12)"></rect>
            <rect x="${IN_X.toFixed(2)}" y="${railY.toFixed(2)}" width="${IN_W.toFixed(2)}" height="${railH}"
                  fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="1"></rect>

            <!-- Inner border -->
            <rect x="${(IN_X + 0.8).toFixed(2)}" y="${(IN_Y + 0.8).toFixed(2)}" width="${(IN_W - 1.6).toFixed(2)}" height="${(IN_H - 1.6).toFixed(2)}"
                  fill="none" stroke="rgba(0,0,0,0.24)" stroke-width="1.4"></rect>
          </g>
        </g>

        <!-- Headrail -->
        <rect x="${IN_X.toFixed(2)}" y="${(IN_Y - 9).toFixed(2)}" width="${IN_W.toFixed(2)}" height="10" fill="rgba(0,0,0,0.12)"></rect>
        <rect x="${IN_X.toFixed(2)}" y="${(IN_Y - 9).toFixed(2)}" width="${IN_W.toFixed(2)}" height="10" fill="none" stroke="rgba(0,0,0,0.20)" stroke-width="1"></rect>
        </g>
      `;

      return { defs, markup };
    };

    const lampOn1 = this._isOnLikeState(lamp1Id);
    const lampOn2 = isDouble ? this._isOnLikeState(lamp2Id) : false;

    const win1 = buildWindow(1, OPEN_X_1, p1, lampOn1);
    const win2 = isDouble ? buildWindow(2, OPEN_X_2, (p2 ?? p1), lampOn2) : null;

    const defsAll = `${win1.defs}${win2 ? win2.defs : ""}`;
    const markupAll = `${win1.markup}${win2 ? win2.markup : ""}`;

    const svgMarkup = `
      <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Blind">
        <defs>
          ${defsAll}
        </defs>

        <rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="rgba(0,0,0,0.02)"></rect>

        ${markupAll}
      </svg>
    `;

    this._gdPendingMarkup = svgMarkup;
    return html`<div class="asc-gd-dom" id="asc-gd-dom-${this._instanceId}"></div>`;
  }

_fanBaseSvg(opts, framed) {
  const { value, interval, glassOn } = opts;

  const frame = opts?.frameStyle;
  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");

  // Frame stroke: if outline is very light, use black with opacity instead (more readable).
  let frameStroke = outline;
  let frameStrokeOpacity = 1;
  if (isLightHex(outline)) { frameStroke = "#000000"; frameStrokeOpacity = 0.70; }

  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  // Robust numeric parse (handles "55 %", "-12,3 kW", etc.)
  const raw = toNumberMaybe(value);
  const dir = (Number.isFinite(raw) && raw < 0) ? -1 : 1;

  // Normalize speed percent (0..1)
  let vPct = 0;
  if (Number.isFinite(raw)) {
    if (minS < 0 && maxS > 0) {
      const maxAbs = Math.max(Math.abs(minS), Math.abs(maxS)) || 1;
      vPct = clamp01(Math.abs(raw) / maxAbs);
    } else {
      const range = (maxS - minS) || 1;
      vPct = clamp01((raw - minS) / range);
    }
  }

  // Wind overlay intensity (0..0.75) kicks in above ~55%
  const windOpacity = clamp01((vPct - 0.55) / 0.45) * 0.75;
  const windDur = (vPct <= 0.55) ? 1.6 : (1.6 - clamp01((vPct - 0.55) / 0.45) * 0.9);

  // Rotor spin duration (seconds). 0 => paused.
  const durSec = (vPct <= 0) ? 0 : Math.max(0.22, Math.min(3.2, 3.2 - Math.pow(vPct, 0.85) * 2.98));

  const uid = `${this._instanceId}_fan_${framed ? "f" : "n"}`;
  const gradId = `fanGrad_${uid}`;
  const ringId = `fanRingGrad_${uid}`;

  const fanFill = useGradient ? `url(#${gradId})` : cSolid;
  const ringFill = `url(#${ringId})`;

  // ViewBox + geometry (matches existing symbol sizing rules)
  const VB_W = 220;
  const VB_H = 230;

  const CX = 110;
  const CY = 115;
  const R = 62;
  const hubR = 16;

  // Blade geometry - rounded rectangles (clear in all themes)
  const bladeCount = clampInt(this._config.fan_blade_count ?? 3, 2, 8, 3);
  const bladeLen = 44;
  const bladeWid = 18;

  // Frame geometry (visible square housing)
  const FR_L = 18;
  const FR_T = 24;
  const FR_W = 184;
  const FR_H = 184;
  const FR_RX = 26;

  // Make casing less see-through for symbol badges. Opacity slider still works on the container.
  const outerFillOpacity = glassOn ? 0.22 : 0.28;
  const innerFillOpacity = glassOn ? 0.18 : 0.24;

  // Build blades as a single SVG string (keeps SVG namespace correct in HA)
  let bladesSvg = "";
  for (let i = 0; i < bladeCount; i++) {
    const ang = (360 / bladeCount) * i;
    const op = [0.95, 0.72, 0.55][i % 3];
    bladesSvg += `
      <g transform="rotate(${ang} ${CX} ${CY})">
        <rect x="${CX - bladeWid / 2}" y="${CY - hubR - bladeLen}"
              width="${bladeWid}" height="${bladeLen}"
              rx="${Math.round(bladeWid / 2)}"
              fill="${fanFill}" fill-opacity="${op.toFixed(2)}"
              stroke="#000000" stroke-opacity="0.25" stroke-width="1.1"></rect>
        <rect x="${CX - (bladeWid / 2) + 2.0}" y="${CY - hubR - bladeLen + 2.0}"
              width="${Math.max(1, bladeWid - 4.0)}" height="${Math.max(1, bladeLen - 4.0)}"
              rx="${Math.round(Math.max(6, (bladeWid - 4.0) / 2))}"
              fill="#ffffff" fill-opacity="0.08"
              stroke="none"></rect>
      </g>
    `;
  }

  const anim = (durSec > 0)
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="${dir * 360} ${CX} ${CY}" dur="${durSec.toFixed(2)}s" repeatCount="indefinite"></animateTransform>`
    : "";

  const frameSvg = framed ? `
    <g class="asc-fan-frame">
      <rect class=\"outer\" x=\"${FR_L}\" y=\"${FR_T}\" width=\"${FR_W}\" height=\"${FR_H}\" rx=\"${FR_RX}\"
            fill="#ffffff" fill-opacity="${outerFillOpacity.toFixed(3)}"
            stroke="#000000" stroke-opacity="0.35" stroke-width="6"></rect>
      <rect x="${FR_L}" y="${FR_T}" width="${FR_W}" height="${FR_H}" rx="${FR_RX}"
            fill="none"
            stroke="${frameStroke}" stroke-opacity="${frameStrokeOpacity.toFixed(2)}" stroke-width="3.2"></rect>

      <rect x="${FR_L + 18}" y="${FR_T + 18}" width="${FR_W - 36}" height="${FR_H - 36}" rx="${Math.max(10, FR_RX - 10)}"
            fill="#000000" fill-opacity="${innerFillOpacity.toFixed(3)}"
            stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"></rect>
    </g>
  ` : "";

  // Inject markup; _fanSyncAnimation() will set innerHTML on the host div after render.
  this._fanPendingMarkup = `
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Fan">
      <defs>
        <linearGradient id="${gradId}" x1="${CX - R}" y1="${CY - R}" x2="${CX + R}" y2="${CY + R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
          <stop offset="55%" stop-color="${gTo}" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="${gFrom}" stop-opacity="0.92"></stop>
        </linearGradient>

        <radialGradient id="${ringId}" cx="${CX}" cy="${CY}" r="${R + 18}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"></stop>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0.05"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22"></stop>
        </radialGradient>

        <filter id="fanBladeShadow_${uid}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.15" flood-color="#000000" flood-opacity="0.42"></feDropShadow>
        </filter>
      </defs>

      <g>
        <!-- Scale reference for fit -->
        <rect class="scale-ref" x="18" y="22" width="184" height="190" fill="transparent"></rect>

          <!-- Background disc -->
        <circle cx="${CX}" cy="${CY}" r="${R + 22}" fill="#000000" fill-opacity="0.20"></circle>

        <!-- Shroud / ring -->
        <circle cx="${CX}" cy="${CY}" r="${R + 12}" fill="${ringFill}"></circle>
        <circle cx="${CX}" cy="${CY}" r="${R + 4}" fill="#000000" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.2"></circle>

        <!-- Rotor -->
        <g filter="url(#fanBladeShadow_${uid})">
          <g class="asc-fan-rotor" data-fan-rotor="1" data-cx="${CX}" data-cy="${CY}">
            ${anim}
            ${bladesSvg}
            <circle cx="${CX}" cy="${CY}" r="16" fill="#000000" fill-opacity="0.38"></circle>
            <circle cx="${CX}" cy="${CY}" r="11" fill="#ffffff" fill-opacity="0.10"></circle>
</g>
        </g>

        <!-- Grill lines -->
        <g stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" stroke-linecap="round">
          <path d="M ${CX} ${CY - R - 4} L ${CX} ${CY + R + 4}"></path>
          <path d="M ${CX - R - 4} ${CY} L ${CX + R + 4} ${CY}"></path>
          <path d="M ${CX - 52} ${CY - 52} L ${CX + 52} ${CY + 52}"></path>
          <path d="M ${CX + 52} ${CY - 52} L ${CX - 52} ${CY + 52}"></path>
        </g>

        <!-- Wind overlay (only visible at higher speed) -->
        <g class="fan-wind" style="opacity:${windOpacity.toFixed(3)};">
          <g stroke="#ffffff" stroke-opacity="0.55" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-dasharray="10 14"
             style="animation-duration:${windDur.toFixed(2)}s;">
            <path d="M ${(CX - 92).toFixed(2)} ${(CY - 64).toFixed(2)} C ${(CX - 40).toFixed(2)} ${(CY - 78).toFixed(2)}, ${(CX - 12).toFixed(2)} ${(CY - 52).toFixed(2)}, ${(CX + 26).toFixed(2)} ${(CY - 62).toFixed(2)} C ${(CX + 56).toFixed(2)} ${(CY - 70).toFixed(2)}, ${(CX + 78).toFixed(2)} ${(CY - 64).toFixed(2)}, ${(CX + 96).toFixed(2)} ${(CY - 48).toFixed(2)}"></path>
            <path d="M ${(CX - 96).toFixed(2)} ${(CY - 10).toFixed(2)} C ${(CX - 46).toFixed(2)} ${(CY - 26).toFixed(2)}, ${(CX - 10).toFixed(2)} ${(CY - 6).toFixed(2)}, ${(CX + 18).toFixed(2)} ${(CY - 16).toFixed(2)} C ${(CX + 52).toFixed(2)} ${(CY - 28).toFixed(2)}, ${(CX + 74).toFixed(2)} ${(CY - 18).toFixed(2)}, ${(CX + 98).toFixed(2)} ${(CY - 4).toFixed(2)}"></path>
            <path d="M ${(CX - 88).toFixed(2)} ${(CY + 44).toFixed(2)} C ${(CX - 36).toFixed(2)} ${(CY + 30).toFixed(2)}, ${(CX - 6).toFixed(2)} ${(CY + 56).toFixed(2)}, ${(CX + 28).toFixed(2)} ${(CY + 44).toFixed(2)} C ${(CX + 56).toFixed(2)} ${(CY + 34).toFixed(2)}, ${(CX + 78).toFixed(2)} ${(CY + 40).toFixed(2)}, ${(CX + 94).toFixed(2)} ${(CY + 58).toFixed(2)}"></path>
          </g>
        </g>
      
      ${frameSvg}
      </g>
    </svg>
  `;

  return html`<div class="asc-fan-dom" id="asc-fan-dom-${this._instanceId}"></div>`;
}


// ---------------------------
// Badge Symbol: Fan / Heatpump (DOM-injected SVG, isolated from main symbol render)
// ---------------------------
_badgeFanMarkup(opts, badge) {
  const framed = !!badge?.fan_show_frame;
  // Clone of _fanBaseSvg but reading blade count/frame from badge instead of card config
  const { value, interval, glassOn } = opts;

  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = normalizeHex(it.outline, "#ffffff");

  let frameStroke = outline;
  let frameStrokeOpacity = 1;
  if (isLightHex(outline)) { frameStroke = "#000000"; frameStrokeOpacity = 0.70; }

  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const raw = toNumberMaybe(value);
  const dir = (Number.isFinite(raw) && raw < 0) ? -1 : 1;

  let vPct = 0;
  if (Number.isFinite(raw)) {
    if (minS < 0 && maxS > 0) {
      const maxAbs = Math.max(Math.abs(minS), Math.abs(maxS)) || 1;
      vPct = clamp01(Math.abs(raw) / maxAbs);
    } else {
      const range = (maxS - minS) || 1;
      vPct = clamp01((raw - minS) / range);
    }
  }

  const windOpacity = clamp01((vPct - 0.55) / 0.45) * 0.75;
  const windDur = (vPct <= 0.55) ? 1.6 : (1.6 - clamp01((vPct - 0.55) / 0.45) * 0.9);
  const durSec = (vPct <= 0) ? 0 : Math.max(0.22, Math.min(3.2, 3.2 - Math.pow(vPct, 0.85) * 2.98));

  const uid = `${this._instanceId}_bdg_${badge?.id || "x"}_fan_${framed ? "f" : "n"}`;
  const gradId = `fanGrad_${uid}`;
  const ringId = `fanRingGrad_${uid}`;

  const fanFill = useGradient ? `url(#${gradId})` : cSolid;
  const ringFill = `url(#${ringId})`;

  const VB_W = 220;
  const VB_H = 230;

  const CX = 110;
  const CY = 115;
  const R = 62;
  const hubR = 16;

  const bladeCount = clampInt(badge?.fan_blade_count ?? 3, 2, 8, 3);
  const bladeLen = 44;
  const bladeWid = 18;

  const FR_L = 18;
  const FR_T = 24;
  const FR_W = 184;
  const FR_H = 184;
  const FR_RX = 26;

  // Make casing less see-through for symbol badges. Opacity slider still works on the container.
  const outerFillOpacity = glassOn ? 0.22 : 0.28;
  const innerFillOpacity = glassOn ? 0.18 : 0.24;

  let bladesSvg = "";
  for (let i = 0; i < bladeCount; i++) {
    const ang = (360 / bladeCount) * i;
    const op = [0.95, 0.72, 0.55][i % 3];
    bladesSvg += `
      <g transform="rotate(${ang} ${CX} ${CY})">
        <rect x="${CX - bladeWid / 2}" y="${CY - hubR - bladeLen}"
              width="${bladeWid}" height="${bladeLen}"
              rx="${Math.round(bladeWid / 2)}"
              fill="${fanFill}" fill-opacity="${op.toFixed(2)}"
              stroke="#000000" stroke-opacity="0.25" stroke-width="1.1"></rect>
        <rect x="${CX - (bladeWid / 2) + 2.0}" y="${CY - hubR - bladeLen + 2.0}"
              width="${Math.max(1, bladeWid - 4.0)}" height="${Math.max(1, bladeLen - 4.0)}"
              rx="${Math.round(Math.max(6, (bladeWid - 4.0) / 2))}"
              fill="#ffffff" fill-opacity="0.8"
              stroke="none"></rect>
      </g>
    `;
  }

  const anim = (durSec > 0)
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="${dir * 360} ${CX} ${CY}" dur="${durSec.toFixed(2)}s" repeatCount="indefinite"></animateTransform>`
    : "";

  const frameSvg = framed ? `
    <g class="asc-fan-frame">
      <rect class="outer" x="${FR_L}" y="${FR_T}" width="${FR_W}" height="${FR_H}" rx="${FR_RX}"
            fill="#ffffff" fill-opacity="${outerFillOpacity.toFixed(3)}"
            stroke="#000000" stroke-opacity="0.35" stroke-width="6"></rect>
      <rect x="${FR_L}" y="${FR_T}" width="${FR_W}" height="${FR_H}" rx="${FR_RX}"
            fill="none"
            stroke="${frameStroke}" stroke-opacity="${frameStrokeOpacity.toFixed(2)}" stroke-width="3.2"></rect>

      <rect x="${FR_L + 18}" y="${FR_T + 18}" width="${FR_W - 36}" height="${FR_H - 36}" rx="${Math.max(10, FR_RX - 10)}"
            fill="#000000" fill-opacity="${innerFillOpacity.toFixed(3)}"
            stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"></rect>
    </g>
  ` : "";

  return `
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Fan badge">
      <defs>
        <linearGradient id="${gradId}" x1="${CX - R}" y1="${CY - R}" x2="${CX + R}" y2="${CY + R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
          <stop offset="55%" stop-color="${gTo}" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="${gFrom}" stop-opacity="0.92"></stop>
        </linearGradient>

        <radialGradient id="${ringId}" cx="${CX}" cy="${CY}" r="${R + 18}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"></stop>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0.05"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22"></stop>
        </radialGradient>

        <filter id="fanBladeShadow_${uid}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.15" flood-color="#000000" flood-opacity="0.42"></feDropShadow>
        </filter>
      </defs>

      <g>
        <rect class="scale-ref" x="18" y="22" width="184" height="190" fill="transparent"></rect>

        <circle cx="${CX}" cy="${CY}" r="${R + 22}" fill="#000000" fill-opacity="0.30"></circle>

        <circle cx="${CX}" cy="${CY}" r="${R + 12}" fill="${ringFill}"></circle>
        <circle cx="${CX}" cy="${CY}" r="${R + 4}" fill="#000000" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.2"></circle>

        <g filter="url(#fanBladeShadow_${uid})">
          <g class="asc-fan-rotor" data-cx="${CX}" data-cy="${CY}">
            ${anim}
            ${bladesSvg}
            <circle cx="${CX}" cy="${CY}" r="16" fill="#000000" fill-opacity="0.48"></circle>
            <circle cx="${CX}" cy="${CY}" r="11" fill="#ffffff" fill-opacity="0.20"></circle>
          </g>
        </g>

        <g stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" stroke-linecap="round">
          <path d="M ${CX} ${CY - R - 4} L ${CX} ${CY + R + 4}"></path>
          <path d="M ${CX - R - 4} ${CY} L ${CX + R + 4} ${CY}"></path>
          <path d="M ${CX - 52} ${CY - 52} L ${CX + 52} ${CY + 52}"></path>
          <path d="M ${CX + 52} ${CY - 52} L ${CX - 52} ${CY + 52}"></path>
        </g>

        <g class="fan-wind" style="opacity:${windOpacity.toFixed(3)};">
          <g stroke="#ffffff" stroke-opacity="0.55" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-dasharray="10 14"
             style="animation-duration:${windDur.toFixed(2)}s;">
            <path d="M ${(CX - 92).toFixed(2)} ${(CY - 64).toFixed(2)} C ${(CX - 40).toFixed(2)} ${(CY - 78).toFixed(2)}, ${(CX - 12).toFixed(2)} ${(CY - 52).toFixed(2)}, ${(CX + 26).toFixed(2)} ${(CY - 62).toFixed(2)} C ${(CX + 56).toFixed(2)} ${(CY - 70).toFixed(2)}, ${(CX + 78).toFixed(2)} ${(CY - 64).toFixed(2)}, ${(CX + 96).toFixed(2)} ${(CY - 48).toFixed(2)}"></path>
            <path d="M ${(CX - 96).toFixed(2)} ${(CY - 10).toFixed(2)} C ${(CX - 46).toFixed(2)} ${(CY - 26).toFixed(2)}, ${(CX - 10).toFixed(2)} ${(CY - 6).toFixed(2)}, ${(CX + 18).toFixed(2)} ${(CY - 16).toFixed(2)} C ${(CX + 52).toFixed(2)} ${(CY - 28).toFixed(2)}, ${(CX + 74).toFixed(2)} ${(CY - 18).toFixed(2)}, ${(CX + 98).toFixed(2)} ${(CY - 4).toFixed(2)}"></path>
            <path d="M ${(CX - 88).toFixed(2)} ${(CY + 44).toFixed(2)} C ${(CX - 36).toFixed(2)} ${(CY + 30).toFixed(2)}, ${(CX - 6).toFixed(2)} ${(CY + 56).toFixed(2)}, ${(CX + 28).toFixed(2)} ${(CY + 44).toFixed(2)} C ${(CX + 56).toFixed(2)} ${(CY + 34).toFixed(2)}, ${(CX + 78).toFixed(2)} ${(CY + 40).toFixed(2)}, ${(CX + 94).toFixed(2)} ${(CY + 58).toFixed(2)}"></path>
          </g>
        </g>

        ${frameSvg}
      </g>
    </svg>
  `;
}

_badgeHeatpumpMarkup(opts, badge) {
  // Full clone of _heatpumpSvg() but isolated for badges.
  // - Reads bladecount from badge (badge.fan_blade_count)
  // - Reads colors from badge interval (opts.interval)
  // - Does NOT touch main-card fan/heatpump DOM injection state
  const { value, interval, glassOn } = opts;

  const frame = opts?.frameStyle;
  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");

  // If outline is very light, use black with opacity instead (more readable).
  let frameStroke = outline;
  let frameStrokeOpacity = 1;
  if (isLightHex(outline)) { frameStroke = "#000000"; frameStrokeOpacity = 0.70; }

  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const raw = toNumberMaybe(value);
  const dir = (Number.isFinite(raw) && raw < 0) ? -1 : 1;

  let vPct = 0;
  if (Number.isFinite(raw)) {
    if (minS < 0 && maxS > 0) {
      const maxAbs = Math.max(Math.abs(minS), Math.abs(maxS)) || 1;
      vPct = clamp01(Math.abs(raw) / maxAbs);
    } else {
      const range = (maxS - minS) || 1;
      vPct = clamp01((raw - minS) / range);
    }
  }

  const windOpacity = clamp01((vPct - 0.55) / 0.45) * 0.75;
  const windDur = (vPct <= 0.55) ? 1.6 : (1.6 - clamp01((vPct - 0.55) / 0.45) * 0.9);
  const durSec = (vPct <= 0) ? 0 : Math.max(0.22, Math.min(3.2, 3.2 - Math.pow(vPct, 0.85) * 2.98));

  const uid = `${this._instanceId}_bdg_${badge?.id || "x"}_hp`;
  const gradId = `hpFanGrad_${uid}`;
  const ringId = `hpRingGrad_${uid}`;

  const fanFill = useGradient ? `url(#${gradId})` : cSolid;
  const ringFill = `url(#${ringId})`;

  // Heatpump outdoor unit geometry (same as main symbol)
  const VB_W = 340;
  const VB_H = 220;

  const BOX_X = 12;
  const BOX_Y = 20;
  const BOX_W = 316;
  const BOX_H = 200;
  const BOX_RX = 26;

  // Fan placement (left)
  const CX = 110;
  const CY = 122;
  const R = 56;
  const hubR = 15;
  const bladeCount = clampInt(badge?.fan_blade_count ?? 3, 2, 8, 3);
  const bladeLen = 40;
  const bladeWid = 16;

  // Right service panel
  const P_X = 210;
  const P_Y = 56;
  const P_W = 90;
  const P_H = 130;
  const P_RX = 16;

  // Make casing less see-through for symbol badges. Opacity slider still works on the container.
  const outerFillOpacity = glassOn ? 0.22 : 0.28;
  const innerFillOpacity = glassOn ? 0.18 : 0.24;

  let bladesSvg = "";
  for (let i = 0; i < bladeCount; i++) {
    const ang = (360 / bladeCount) * i;
    const op = [0.95, 0.72, 0.55][i % 3];
    bladesSvg += `
      <g transform="rotate(${ang} ${CX} ${CY})">
        <rect x="${CX - bladeWid / 2}" y="${CY - hubR - bladeLen}"
              width="${bladeWid}" height="${bladeLen}"
              rx="${Math.round(bladeWid / 2)}"
              fill="${fanFill}" fill-opacity="${op.toFixed(2)}"
              stroke="#000000" stroke-opacity="0.25" stroke-width="1.1"></rect>
        <rect x="${CX - (bladeWid / 2) + 2.0}" y="${CY - hubR - bladeLen + 2.0}"
              width="${Math.max(1, bladeWid - 4.0)}" height="${Math.max(1, bladeLen - 4.0)}"
              rx="${Math.round(Math.max(6, (bladeWid - 4.0) / 2))}"
              fill="#ffffff" fill-opacity="0.08"
              stroke="none"></rect>
      </g>
    `;
  }

  const anim = (durSec > 0)
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="${dir * 360} ${CX} ${CY}" dur="${durSec.toFixed(2)}s" repeatCount="indefinite"></animateTransform>`
    : "";

  return `
    <svg class="sensor-svg" width="100%" height="100%" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Heatpump">
      <defs>
        <linearGradient id="${gradId}" x1="${CX - R}" y1="${CY - R}" x2="${CX + R}" y2="${CY + R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gFrom}" stop-opacity="0.98"></stop>
          <stop offset="55%" stop-color="${gTo}" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="${gFrom}" stop-opacity="0.92"></stop>
        </linearGradient>

        <radialGradient id="${ringId}" cx="${CX}" cy="${CY}" r="${R + 18}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"></stop>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0.05"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22"></stop>
        </radialGradient>

        <filter id="hpBladeShadow_${uid}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.15" flood-color="#000000" flood-opacity="0.42"></feDropShadow>
        </filter>
      </defs>

      <g>
        <!-- Outer casing -->
        <rect class="outer" x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" rx="${BOX_RX}"
              fill="#ffffff" fill-opacity="${outerFillOpacity.toFixed(3)}"
              stroke="#000000" stroke-opacity="0.35" stroke-width="6"></rect>
        <rect x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" rx="${BOX_RX}"
              fill="none" stroke="${frameStroke}" stroke-opacity="${frameStrokeOpacity.toFixed(2)}" stroke-width="3.2"></rect>

        <!-- Inner shading -->
        <rect x="${BOX_X + 14}" y="${BOX_Y + 14}" width="${BOX_W - 28}" height="${BOX_H - 28}" rx="${Math.max(12, BOX_RX - 10)}"
              fill="#000000" fill-opacity="${innerFillOpacity.toFixed(3)}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"></rect>

        <!-- Service panel (right) -->
        <rect x="${P_X}" y="${P_Y}" width="${P_W}" height="${P_H}" rx="${P_RX}"
              fill="#ffffff" fill-opacity="0.05"
              stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"></rect>
        <rect x="${P_X + 18}" y="${P_Y + 10}" width="${P_W - 36}" height="10" rx="5"
              fill="#000000" fill-opacity="0.18"></rect>

        <!-- Scale refs -->
        <rect class="scale-ref" x="${BOX_X}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" fill="transparent"></rect>
        <rect class="value-ref" x="0" y="${CY}" width="1" height="1" fill="transparent"></rect>

        <!-- Fan shroud -->
        <circle cx="${CX}" cy="${CY}" r="${R + 22}" fill="#000000" fill-opacity="0.20"></circle>
        <circle cx="${CX}" cy="${CY}" r="${R + 12}" fill="${ringFill}"></circle>
        <circle cx="${CX}" cy="${CY}" r="${R + 4}" fill="#000000" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.2"></circle>

        <!-- Rotor -->
        <g filter="url(#hpBladeShadow_${uid})">
          <g class="asc-fan-rotor" data-fan-rotor="1" data-cx="${CX}" data-cy="${CY}">
            ${anim}
            ${bladesSvg}
            <circle cx="${CX}" cy="${CY}" r="16" fill="#000000" fill-opacity="0.38"></circle>
            <circle cx="${CX}" cy="${CY}" r="11" fill="#ffffff" fill-opacity="0.10"></circle>
          </g>
        </g>

        <!-- Grill lines -->
        <g stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" stroke-linecap="round">
          <path d="M ${CX} ${CY - R - 4} L ${CX} ${CY + R + 4}"></path>
          <path d="M ${CX - R - 4} ${CY} L ${CX + R + 4} ${CY}"></path>
          <path d="M ${CX - 48} ${CY - 48} L ${CX + 48} ${CY + 48}"></path>
          <path d="M ${CX + 48} ${CY - 48} L ${CX - 48} ${CY + 48}"></path>
        </g>

        <!-- Wind overlay -->
        <g class="fan-wind" style="opacity:${windOpacity.toFixed(3)};">
          <g stroke="#ffffff" stroke-opacity="0.55" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-dasharray="10 14"
             style="animation-duration:${windDur.toFixed(2)}s;">
            <path d="M ${(CX - 86).toFixed(2)} ${(CY - 58).toFixed(2)} C ${(CX - 38).toFixed(2)} ${(CY - 72).toFixed(2)}, ${(CX - 12).toFixed(2)} ${(CY - 46).toFixed(2)}, ${(CX + 22).toFixed(2)} ${(CY - 56).toFixed(2)} C ${(CX + 50).toFixed(2)} ${(CY - 64).toFixed(2)}, ${(CX + 70).toFixed(2)} ${(CY - 58).toFixed(2)}, ${(CX + 86).toFixed(2)} ${(CY - 42).toFixed(2)}"></path>
            <path d="M ${(CX - 90).toFixed(2)} ${(CY - 8).toFixed(2)} C ${(CX - 44).toFixed(2)} ${(CY - 22).toFixed(2)}, ${(CX - 10).toFixed(2)} ${(CY - 6).toFixed(2)}, ${(CX + 16).toFixed(2)} ${(CY - 14).toFixed(2)} C ${(CX + 44).toFixed(2)} ${(CY - 24).toFixed(2)}, ${(CX + 66).toFixed(2)} ${(CY - 14).toFixed(2)}, ${(CX + 88).toFixed(2)} ${(CY - 2).toFixed(2)}"></path>
            <path d="M ${(CX - 82).toFixed(2)} ${(CY + 40).toFixed(2)} C ${(CX - 34).toFixed(2)} ${(CY + 28).toFixed(2)}, ${(CX - 6).toFixed(2)} ${(CY + 50).toFixed(2)}, ${(CX + 24).toFixed(2)} ${(CY + 40).toFixed(2)} C ${(CX + 50).toFixed(2)} ${(CY + 32).toFixed(2)}, ${(CX + 70).toFixed(2)} ${(CY + 38).toFixed(2)}, ${(CX + 84).toFixed(2)} ${(CY + 52).toFixed(2)}"></path>
          </g>
        </g>

        <!-- Feet -->
        <rect x="${BOX_X + 28}" y="${BOX_Y + BOX_H }" width="56" height="10" rx="4" fill="#000000" fill-opacity="0.28"></rect>
        <rect x="${BOX_X + BOX_W - 84}" y="${BOX_Y + BOX_H }" width="56" height="10" rx="4" fill="#000000" fill-opacity="0.28"></rect>
      </g>
    </svg>
  `;
}

_gasCylinderLiquidSvg(opts) {
  const { value, interval, glassOn } = opts;
  const frame = opts?.frameStyle;


  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");
  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const range = (maxS - minS) || 1;
  const pScaled = clamp01((Number(value) - minS) / range);

  // Styling
  const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");
  const tubeBg    = frame?.innerBg ?? (glassOn ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)");

  // Geometry: viewBox matches battery for consistent sizing
  const VB_W = 220;
  const VB_H = 240;

  // "Body" (outer) - this is .outer so scale uses it
  const BODY_L = 52;
  const BODY_T = 50;
  const BODY_W = 116;
  const BODY_H = 178;
  const BODY_RX = 26;

  // Inner fill area (green-marked in your sketch)
  // Keep it inside the outline and *exclude* top handle + bottom foot area
  const IN_PAD_X = 10;
  const IN_PAD_T = 14;
  const IN_PAD_B = 14;

  const IN_L = BODY_L + IN_PAD_X;
  const IN_T = BODY_T + IN_PAD_T;
  const IN_W = BODY_W - IN_PAD_X * 2;
  const IN_H = BODY_H - IN_PAD_T - IN_PAD_B;
  const IN_RX = Math.max(14, BODY_RX - 10);

  // Liquid
  const liquidH = Math.max(0, Math.min(IN_H, IN_H * pScaled));
  const liquidY = IN_T + (IN_H - liquidH);

  // Top "cage" + valve (not filled)
  const TOP_BAR_W = 70;
  const TOP_BAR_H = 3;
  const TOP_BAR_X = (VB_W - TOP_BAR_W) / 2;
  const TOP_BAR_Y = 16;
  const TOP_BAR_RX = 2;

  const POST_W = 1;
  const POST_H = 28;
  const POST_Y = 20;
  const POST_LX = 86;
  const POST_RX = VB_W - 86 - POST_W;

  const VALVE_W = 20;
  const VALVE_H = 2;
  const VALVE_X = (VB_W - VALVE_W) / 2;
  const VALVE_Y = 30;
  const VALVE_RX = 2;

  // Bottom "foot" (not filled)
  const FOOT_W = 70;
  const FOOT_H = 8;
  const FOOT_X = (VB_W - FOOT_W) / 2;
  const FOOT_Y = 230;
  const FOOT_RX = 0;

  const RIB_H = 4;
  const RIB_RX = 0;
  const RIB_X = BODY_L + 8;
  const RIB_W = BODY_W - 16;

  const rib1Y = BODY_T + 44;   // top band
  const rib2Y = BODY_T + 100;  // mid band
  const rib3Y = BODY_T + 152;  // bottom band

  // unique ids
  const gid = `${this._instanceId}_gascyl`;
  const gradId  = `gasGrad_${gid}`;
  const sheenId = `gasSheen_${gid}`;
  const bandId  = `gasBand_${gid}`;
  const shadowId = `gasShadow_${gid}`;
  const clipId  = `gasInnerClip_${gid}`;

  return html`
    <svg class="sensor-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gas cylinder">
      <defs>
        <linearGradient id="${gradId}" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stop-color="${gFrom}"></stop>
          <stop offset="100%" stop-color="${gTo}"></stop>
        </linearGradient>

        <linearGradient id="${sheenId}" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.80)"></stop>
          <stop offset="35%" stop-color="rgba(255,255,255,0.18)"></stop>
          <stop offset="78%" stop-color="rgba(255,255,255,0.05)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.38)"></stop>
        </linearGradient>

        <linearGradient id="${bandId}" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.00)"></stop>
          <stop offset="35%" stop-color="rgba(255,255,255,0.18)"></stop>
          <stop offset="55%" stop-color="rgba(255,255,255,0.06)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.00)"></stop>
        </linearGradient>

        <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(0,0,0,0.28)"/>
        </filter>

        <clipPath id="${clipId}">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}" />
        </clipPath>
      </defs>

      <g>
        <!-- Top bar + posts + valve (not filled) -->
        <rect x="${TOP_BAR_X}" y="${TOP_BAR_Y}" width="${TOP_BAR_W}" height="${TOP_BAR_H}"
              rx="${TOP_BAR_RX}" ry="${TOP_BAR_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="3.0" opacity="0.45" />

        <rect x="${POST_LX}" y="${POST_Y}" width="${POST_W}" height="${POST_H}"
              rx="0" ry="6"
              fill="${outerFill}" stroke="${outline}" stroke-width="5.2" opacity="0.45" />
        <rect x="${POST_RX}" y="${POST_Y}" width="${POST_W}" height="${POST_H}"
              rx="0" ry="6"
              fill="${outerFill}" stroke="${outline}" stroke-width="5.2" opacity="0.45" />

        <rect x="${VALVE_X}" y="${VALVE_Y}" width="${VALVE_W}" height="${VALVE_H}"
              rx="${VALVE_RX}" ry="${VALVE_RX}"
              fill="${outerFill}" stroke="${outline}" stroke-width="8.2" opacity="0.45" />

          <!-- Scale reference: EXACT fillable area (used for Y positioning) -->
          <rect class="scale-ref"
            x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="transparent" stroke="transparent"
          />
          <!-- Value inSymbol reference: -->          
         <rect class="value-ref" 
               x="0" 
               y="130"
               width="1"
               height="1"
          fill="transparent" />
          

        <!-- Body (scale uses this bbox) -->
        <rect class="outer"
          x="${BODY_L}" y="${BODY_T}" width="${BODY_W}" height="${BODY_H}"
          rx="${BODY_RX}" ry="${BODY_RX}"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="2.2"
          opacity="0.95"
          filter="url(#${shadowId})"
        />

        <!-- Bottom foot (not filled) -->
        <rect x="${FOOT_X}" y="${FOOT_Y}" width="${FOOT_W}" height="${FOOT_H}"
              rx="${FOOT_RX}" ry="${FOOT_RX}"
              fill="${outerFill}" fill-opacity="1" stroke="${outline}" stroke-width="3" opacity="0,70" />

        <!-- Fill (clipped to inner area only) -->
        <g clip-path="url(#${clipId})">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="${tubeBg}"></rect>

          <rect
            x="${IN_L}" y="${liquidY}" width="${IN_W}" height="${liquidH}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="${useGradient ? `url(#${gradId})` : cSolid}"
            opacity="0.98"
          ></rect>

          ${glassOn ? html`
            <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="url(#${sheenId})" opacity="0.55"></rect>
            <rect x="${IN_L - 10}" y="${IN_T - 18}" width="${IN_W + 20}" height="${IN_H + 36}"
                  fill="url(#${bandId})" opacity="0.28"
                  transform="rotate(-10 110 120)"></rect>
          ` : ""}
        </g>

          <rect x="${RIB_X}" y="${rib1Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="rgba(0,0,0,0)" />
          <rect x="${RIB_X}" y="${rib1Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="${outerFill}"
                opacity="0.25"/>
          <rect x="${RIB_X}" y="${rib1Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="none"
                stroke="${outline}"
                stroke-width="4.0"
                opacity="0.20"/>

          <rect x="${RIB_X}" y="${rib2Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="rgba(0,0,0,0)" />
          <rect x="${RIB_X}" y="${rib2Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="${outerFill}"
                opacity="0.25"/>
          <rect x="${RIB_X}" y="${rib2Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="none"
                stroke="${outline}"
                stroke-width="4.0"
                opacity="0.20"/>

          <rect x="${RIB_X}" y="${rib3Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="rgba(0,0,0,0)" />
          <rect x="${RIB_X}" y="${rib3Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="${outerFill}"
                opacity="0.25"/>
          <rect x="${RIB_X}" y="${rib3Y}" width="${RIB_W}" height="${RIB_H}"
                rx="${RIB_RX}" ry="${RIB_RX}"
                fill="none"
                stroke="${outline}"
                stroke-width="4.0"
                opacity="0.20"/>
            


        <!-- Inner border -->
        <rect
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2"
        />
      </g>

      <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
    </svg>
  `;
}

  // ---------------------------
  // Symbol: water_level_segments_modern (modern frame, same segment DOM logic)
  // ---------------------------
  _waterLevelSegmentsModernSvg(opts) {
    const { interval, glassOn } = opts;
    const itActive = normalizeInterval(interval);
    const outline = normalizeHex(itActive.outline, "#ffffff");

    const outerFill = glassOn ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
    const strokeDark = isLightHex(outline) ? "rgba(0,0,0,0.75)" : outline;
    const strokeLite = "rgba(255,255,255,0.18)";
    const shadowId = `${this._instanceId}_waterM_shadow`;

    // Keep geometry identical to water_level_segments
    const OUT_L = 40;
    const OUT_T = 18;
    const OUT_W = 140;
    const OUT_H = 202;
    const OUT_RX = 20;

    const IN_PAD = 10;
    const IN_L = OUT_L + IN_PAD;
    const IN_T = OUT_T + IN_PAD;
    const IN_W = OUT_W - IN_PAD * 2;
    const IN_H = OUT_H - IN_PAD * 2;

    return html`
      <svg class="sensor-svg" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Water level Modern">
        <defs>
          <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.55)"/>
          </filter>
        </defs>

        <!-- Container (modern) -->
        <g filter="url(#${shadowId})">
          <rect class="outer"
            x="${OUT_L}" y="${OUT_T}" width="${OUT_W}" height="${OUT_H}"
            rx="${OUT_RX}" ry="${OUT_RX}"
            fill="${outerFill}"
            stroke="${strokeDark}"
            stroke-width="3.0"
            opacity="0.98"
          />
          <rect
            x="${OUT_L+1.4}" y="${OUT_T+1.4}" width="${OUT_W-2.8}" height="${OUT_H-2.8}"
            rx="${Math.max(1, OUT_RX-1.2)}" ry="${Math.max(1, OUT_RX-1.2)}"
            fill="transparent"
            stroke="${strokeLite}"
            stroke-width="2.0"
            opacity="0.70"
          />
        </g>

        <!-- Scale reference (used by _drawSegmentsDom) -->
        <rect class="scale-ref"
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          fill="transparent"
        />

        <!-- Segment blocks (DOM-populated) -->
        <g class="segments-layer" style="pointer-events:none;"></g>

        <!-- Scale layer (DOM-populated) -->
        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>

        <!-- Value inSymbol reference -->
        <rect class="value-ref" x="0" y="110" width="1" height="1" fill="transparent"></rect>
      </svg>
    `;
  }


// ---------------------------
// Symbol: silo (liquid/fill)
// ---------------------------
_siloLiquidSvg(opts) {
  const { value, interval, glassOn } = opts;
  const frame = opts?.frameStyle;


  const it = normalizeInterval(interval);
  const useGradient = !!it.gradient?.enabled;
  const cSolid = normalizeHex(it.color, "#22c55e");
  const outline = frame?.outline ?? normalizeHex(it.outline, "#ffffff");
  const gFrom = normalizeHex(it.gradient?.from, cSolid);
  const gTo   = normalizeHex(it.gradient?.to, gFrom);

  let minS = Number(this._config.min ?? 0);
  let maxS = Number(this._config.max ?? 100);
  if (!Number.isFinite(minS)) minS = 0;
  if (!Number.isFinite(maxS)) maxS = 100;
  if (maxS < minS) [minS, maxS] = [maxS, minS];

  const range = (maxS - minS) || 1;
  const pScaled = clamp01((Number(value) - minS) / range);

  const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");
  const innerBg   = frame?.innerBg ?? (glassOn ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)");

  // ViewBox
  const VB_W = 220;
  const VB_H = 260;

  // Main body (fillable part)
  const BODY_L = 55;
  const BODY_T = 44;
  const BODY_W = 110;
  const BODY_H = 128;
  const BODY_R = BODY_L + BODY_W;
  const BODY_B = BODY_T + BODY_H;

  // Roof
  const ROOF_TOP_Y  = 18;
  const ROOF_BASE_Y = BODY_T;
  const ROOF_MID_X  = (BODY_L + BODY_R) / 2;

  // Funnel (under body)
  const FUNNEL_TOP_Y = BODY_B;
  const FUNNEL_MID_Y = BODY_B + 28;
  const FUNNEL_BOT_Y = BODY_B + 52;

  // Legs + base
  const LEG_TOP_Y = BODY_T+BODY_H;
  const LEG_BOT_Y = VB_H - 13;
  const LEG_W = 8;
  const LEG_GAP = 80;
  const LEG_LX = ROOF_MID_X - LEG_GAP / 2 - LEG_W;
  const LEG_RX = ROOF_MID_X + LEG_GAP / 2;
  const BASE_Y = VB_H - 10;

  // Inner fill area (ONLY inside body)
  const IN_PAD = 10;
  const IN_L = BODY_L + IN_PAD;
  const IN_T = BODY_T + IN_PAD;
  const IN_W = BODY_W - IN_PAD * 2;
  const IN_H = BODY_H - IN_PAD * 2;
  const IN_RX = 10;

  const liquidH = Math.max(0, Math.min(IN_H, IN_H * pScaled));
  const liquidY = IN_T + (IN_H - liquidH);

  // unique ids
  const gid = `${this._instanceId}_silo`;
  const gradId   = `siloGrad_${gid}`;
  const shadowId = `siloShadow_${gid}`;
  const clipId   = `siloClip_${gid}`;

  return html`
    <svg class="sensor-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Silo">
      <defs>
        <linearGradient id="${gradId}" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stop-color="${gFrom}"></stop>
          <stop offset="100%" stop-color="${gTo}"></stop>
        </linearGradient>

        <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(0,0,0,0.28)"/>
        </filter>

        <clipPath id="${clipId}">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}" />
        </clipPath>
      </defs>

      <g>
        <!-- Roof -->
        <path
          d="M ${BODY_L} ${ROOF_BASE_Y}
             L ${ROOF_MID_X} ${ROOF_TOP_Y}
             L ${BODY_R} ${ROOF_BASE_Y}
             Z"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
          filter="url(#${shadowId})"
        ></path>

        <!-- Body -->
        <rect class="outer"
          x="${BODY_L}" y="${BODY_T}" width="${BODY_W}" height="${BODY_H}"
          rx="0" ry="10"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
          filter="url(#${shadowId})"
        />

        <!-- Funnel (under body) -->
        <path
          d="M ${BODY_L + 14} ${FUNNEL_TOP_Y}
             L ${ROOF_MID_X - 22} ${FUNNEL_MID_Y}
             L ${ROOF_MID_X - 12} ${FUNNEL_BOT_Y}
             L ${ROOF_MID_X + 12} ${FUNNEL_BOT_Y}
             L ${ROOF_MID_X + 22} ${FUNNEL_MID_Y}
             L ${BODY_R - 14} ${FUNNEL_TOP_Y}
             Z"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
        ></path>

        <!-- Legs -->
        <rect x="${LEG_LX}" y="${LEG_TOP_Y}" width="${LEG_W}" height="${LEG_BOT_Y - LEG_TOP_Y}"
          fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95" />
        <rect x="${LEG_RX}" y="${LEG_TOP_Y}" width="${LEG_W}" height="${LEG_BOT_Y - LEG_TOP_Y}"
          fill="${outerFill}" stroke="${outline}" stroke-width="3.2" opacity="0.95" />

        <!-- Base line -->
        <line x1="30" y1="${BASE_Y}" x2="${VB_W - 30}" y2="${BASE_Y}"
          stroke="${outline}" stroke-width="4" stroke-linecap="round" opacity="0.95"></line>

        <!-- Scale reference: EXACT fillable area -->
        <rect class="scale-ref"
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="transparent" stroke="transparent"
        />

        <!-- Value reference -->
        <rect class="value-ref" x="0" y="105" width="1" height="1" fill="transparent"></rect>

        <!-- Fill (clipped to inner body only) -->
        <g clip-path="url(#${clipId})">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" fill="${innerBg}"></rect>

          <rect
            x="${IN_L}" y="${liquidY}" width="${IN_W}" height="${liquidH}"
            rx="${IN_RX}" ry="${IN_RX}"
            fill="${useGradient ? `url(#${gradId})` : cSolid}"
            opacity="0.98"
          ></rect>
        </g>

        <!-- Inner border -->
        <rect
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2"
        />
      </g>

      <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
    </svg>
  `;
}


  // ---------------------------
  // Symbol: battery_splitted_segments_modern (modern frame, split segments for two entities)
  // ---------------------------
  _batterySplittedSegmentsModernSvg(opts) {
    const { interval, glassOn } = opts;
    const itActive = normalizeInterval(interval);
    const outline = normalizeHex(itActive.outline, "#ffffff");

    const outerFill = glassOn ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
    const tubeBg = glassOn ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)";
    const strokeDark = isLightHex(outline) ? "rgba(0,0,0,0.75)" : outline;
    const strokeLite = "rgba(255,255,255,0.18)";
    const shadowId = `${this._instanceId}_splitM_shadow`;

    // Same outer as battery_splitted_segments so DOM maths remains identical
    const OUT_L = 50;
    const OUT_T = 18;
    const OUT_W = 120;
    const OUT_H = 202;
    const OUT_RX = 20;

    const IN_PAD_X = 8;
    const IN_PAD_T = 10;
    const IN_PAD_B = 10;
    const IN_L = OUT_L + IN_PAD_X;
    const IN_T = OUT_T + IN_PAD_T;
    const IN_W = OUT_W - IN_PAD_X * 2;
    const IN_H = OUT_H - IN_PAD_T - IN_PAD_B;

    return html`
      <svg class="sensor-svg" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Battery split segments Modern">
        <defs>
          <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.55)"/>
          </filter>
        </defs>

        <!-- Cap -->
        <g filter="url(#${shadowId})">
          <rect x="93" y="5" width="34" height="12" rx="5" ry="5"
            fill="${outerFill}" stroke="${strokeDark}" stroke-width="3.0" opacity="0.98"></rect>
          <rect x="94.4" y="6.4" width="31.2" height="9.2" rx="4" ry="4"
            fill="transparent" stroke="${strokeLite}" stroke-width="2.0" opacity="0.70"></rect>
        </g>

        <!-- Body -->
        <g filter="url(#${shadowId})">
          <rect class="outer"
            x="${OUT_L}" y="${OUT_T}" width="${OUT_W}" height="${OUT_H}"
            rx="${OUT_RX}" ry="${OUT_RX}"
            fill="${outerFill}"
            stroke="${strokeDark}"
            stroke-width="3.0"
            opacity="0.98"
          />
          <rect
            x="${OUT_L+1.4}" y="${OUT_T+1.4}" width="${OUT_W-2.8}" height="${OUT_H-2.8}"
            rx="${Math.max(1, OUT_RX-1.2)}" ry="${Math.max(1, OUT_RX-1.2)}"
            fill="transparent"
            stroke="${strokeLite}"
            stroke-width="2.0"
            opacity="0.70"
          />
        </g>

        <!-- Inner cavity -->
        <rect
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="14" ry="14"
          fill="${tubeBg}" opacity="0.9"
        />

        <!-- Scale reference: EXACT fillable area (used by _drawSegmentsDom) -->
        <rect class="scale-ref"
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          fill="transparent"
        />

        <!-- Segment blocks (DOM-populated) -->
        <g class="segments-layer" style="pointer-events:none;"></g>

        <!-- Scale layer (DOM-populated) -->
        <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>

        <!-- Value inSymbol reference -->
        <rect class="value-ref" x="0" y="110" width="1" height="1" fill="transparent"></rect>
      </svg>
    `;
  }


// ---------------------------
// Symbol: water_level_segments (waves = blocks)
// ---------------------------
_waterLevelSegmentsSvg(opts) {
  const { interval, glassOn } = opts;
    const frame = opts?.frameStyle;
  const itActive = normalizeInterval(interval);
  const outline = normalizeHex(itActive.outline, "#ffffff");
  const outerFill = frame?.outerFill ?? (glassOn ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)");

  // Same "feel" as battery sizing so your card scaling remains consistent
  const OUT_L = 40;
  const OUT_T = 18;
  const OUT_W = 140;
  const OUT_H = 202;
  const OUT_RX = 18;

  const IN_PAD = 10;
  const IN_L = OUT_L + IN_PAD;
  const IN_T = OUT_T + IN_PAD;
  const IN_W = OUT_W - IN_PAD * 2;
  const IN_H = OUT_H - IN_PAD * 2;
  const IN_RX = 14;

  const gid = `${this._instanceId}_wlvseg`;
  const clipId = `wlvClip_${gid}`;
  const shadowId = `wlvShadow_${gid}`;

  return html`
    <svg class="sensor-svg" viewBox="0 0 220 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Water level waves">
      <defs>
        <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(0,0,0,0.28)"/>
        </filter>
        <clipPath id="${clipId}">
          <rect x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}" rx="${IN_RX}" ry="${IN_RX}" />
        </clipPath>
      </defs>

      <g>
        <!-- Outer -->
        <rect class="outer"
          x="${OUT_L}" y="${OUT_T}" width="${OUT_W}" height="${OUT_H}"
          rx="${OUT_RX}" ry="${OUT_RX}"
          fill="${outerFill}"
          stroke="${outline}"
          stroke-width="3.2"
          opacity="0.95"
          filter="url(#${shadowId})"
        />

        <!-- Scale reference: EXACT fillable area (Y positioning) -->
        <rect class="scale-ref"
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="transparent" stroke="transparent"
        />

        <!-- Value inSymbol reference -->
        <rect class="value-ref" x="0" y="110" width="1" height="1" fill="transparent"></rect>

        <!-- Waves (DOM-populated) clipped to inner area -->
        <g clip-path="url(#${clipId})">
          <g class="segments-layer" style="pointer-events:none;"></g>
        </g>

        <!-- Inner border -->
        <rect
          x="${IN_L}" y="${IN_T}" width="${IN_W}" height="${IN_H}"
          rx="${IN_RX}" ry="${IN_RX}"
          fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="2"
        />
      </g>

      <!-- Scale layer -->
      <g class="scale-layer" style="pointer-events:none;" shape-rendering="crispEdges"></g>
    </svg>
  `;
}

  static get styles() {
    return css`
      :host { display:block; }
      ha-card { border-radius: 18px; overflow: hidden; }
      :host([data-asc-preview="1"]) ha-card { height: 100% !important; max-height: 100% !important; overflow: auto !important; }

      .wrap { position: relative; padding: calc(16px * var(--asc-scale, 1)); height: 100%; box-sizing: border-box; }
      :host([data-asc-preview="1"]) .wrap { height: var(--asc-card-height, 100%); }

      .header { display:flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: calc(10px * var(--asc-scale, 1) * var(--asc-gap-mult, 1)); }
      .header.top_center { justify-content:center; text-align:center; flex-direction:column; align-items:center; }
      .header.top_left { justify-content:flex-start; text-align:left; }
      .header.top_right { justify-content:flex-end; text-align:right; }
      .header.empty { margin-bottom: 0; }

      .title { font-size: calc(var(--asc-name-font-size, 14px) * var(--asc-scale, 1)); opacity: 0.9; letter-spacing: 0.2px; }
      .nameOverlay{
        position:absolute;
        z-index: 6;
        pointer-events:none;
        font-size: calc(var(--asc-name-font-size, 14px) * var(--asc-scale, 1));
        opacity: 0.9;
        letter-spacing: 0.2px;
        font-weight: 700;
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .statsOverlay{
        position:absolute;
        z-index: 6;
        pointer-events:none;
        max-width: 100%;
        white-space: nowrap;
      }
      .pos-top_left{ top: var(--asc-edge-pad, 10px); left: var(--asc-edge-pad, 10px); text-align:left; }
      .pos-top_center{ top: var(--asc-edge-pad, 10px); left: 50%; transform: translateX(-50%); text-align:center; }
      .pos-top_right{ top: var(--asc-edge-pad, 10px); right: var(--asc-edge-pad, 10px); text-align:right; }
      .pos-bottom_left{ bottom: var(--asc-edge-pad, 10px); left: var(--asc-edge-pad, 10px); text-align:left; }
      .pos-bottom_center{ bottom: var(--asc-edge-pad, 10px); left: 50%; transform: translateX(-50%); text-align:center; }
      .pos-bottom_right{ bottom: var(--asc-edge-pad, 10px); right: var(--asc-edge-pad, 10px); text-align:right; }
.nameOverlay.pos-top_left{ transform: translate(var(--asc-name-off-x, 0px), var(--asc-name-off-y, 0px)); }
      .nameOverlay.pos-top_right{ transform: translate(var(--asc-name-off-x, 0px), var(--asc-name-off-y, 0px)); }
      .nameOverlay.pos-bottom_left{ transform: translate(var(--asc-name-off-x, 0px), var(--asc-name-off-y, 0px)); }
      .nameOverlay.pos-bottom_right{ transform: translate(var(--asc-name-off-x, 0px), var(--asc-name-off-y, 0px)); }
      .nameOverlay.pos-top_center{ transform: translateX(-50%) translate(var(--asc-name-off-x, 0px), var(--asc-name-off-y, 0px)); }
      .nameOverlay.pos-bottom_center{ transform: translateX(-50%) translate(var(--asc-name-off-x, 0px), var(--asc-name-off-y, 0px)); }

      /* Value offset applies to header/bottom/inside values */
      .header .value{ transform: translate(var(--asc-value-off-x, 0px), var(--asc-value-off-y, 0px)); display:inline-block; }
      .bottom .value{ transform: translate(var(--asc-value-off-x, 0px), var(--asc-value-off-y, 0px)); display:inline-block; }


/* Stats overlay can use its own edge padding (tuned per symbol) */
.statsOverlay.pos-top_left{ top: var(--asc-stats-pad, var(--asc-edge-pad, 10px)); }
.statsOverlay.pos-top_center{ top: var(--asc-stats-pad, var(--asc-edge-pad, 10px)); }
.statsOverlay.pos-top_right{ top: var(--asc-stats-pad, var(--asc-edge-pad, 10px)); }
.statsOverlay.pos-bottom_left{ bottom: var(--asc-stats-pad, var(--asc-edge-pad, 10px)); }
.statsOverlay.pos-bottom_center{ bottom: var(--asc-stats-pad, var(--asc-edge-pad, 10px)); }
.statsOverlay.pos-bottom_right{ bottom: var(--asc-stats-pad, var(--asc-edge-pad, 10px)); }

      .value { font-weight: 850; letter-spacing: 0.2px; font-size: clamp(calc(14px * var(--asc-scale, 1)), calc(4vw * var(--asc-scale, 1)), calc(22px * var(--asc-scale, 1))); line-height: 1.1; }
      .unit { font-size: calc(12px * var(--asc-scale, 1)); opacity: 0.75; margin-left: 4px; font-weight: 700; }

      .outlined {
        color: #fff;
        text-shadow:
          1px 0 0 rgba(0,0,0,0.95),
          -1px 0 0 rgba(0,0,0,0.95),
          0 1px 0 rgba(0,0,0,0.95),
          0 -1px 0 rgba(0,0,0,0.95),
          1px 1px 0 rgba(0,0,0,0.90),
          -1px 1px 0 rgba(0,0,0,0.90),
          1px -1px 0 rgba(0,0,0,0.90),
          -1px -1px 0 rgba(0,0,0,0.90),
          0 2px 10px rgba(0,0,0,0.55);
      }

      .charge {
        font-weight: 800;
        margin-left: 6px;
        opacity: 0.95;
      }

      /* Charging animations (Battery + Battery Splitted) */
      .sensor-svg.charging .charge-sheen {
        transform-box: fill-box;
        transform-origin: center;
        animation: ascChargeSweep 1.4s linear infinite;
        opacity: 0.35;
      }

      @keyframes ascChargeSweep {
        0%   { transform: translateY(120%); opacity: 0.0; }
        10%  { opacity: 0.25; }
        50%  { opacity: 0.45; }
        90%  { opacity: 0.25; }
        100% { transform: translateY(-120%); opacity: 0.0; }
      }

      .charging-seg {
        animation: ascChargePulse 1.15s ease-in-out infinite;
      }

      @keyframes ascChargePulse {
        0%,100% { opacity: 0.55; }
        50%     { opacity: 0.98; }
      }

      /* Fan (animated) */
      .fan-rotor{
        will-change: transform;
        transform-box: fill-box;
        transform-origin: 110px 115px; /* center of fan in viewBox */
        animation-name: ascFanSpin;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        animation-duration: var(--fan-dur, 1.2s);
        animation-play-state: running;
      }
      .fan-rotor.paused{ animation-play-state: paused; }
      .fan-rotor.rev{ animation-direction: reverse; }

      @keyframes ascFanSpin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }


      .fan-wind > g {
        animation-name: ascFanWind;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        animation-duration: 1.4s; /* overridden inline */
        will-change: stroke-dashoffset, opacity;
      }
      @keyframes ascFanWind {
        0%   { stroke-dashoffset: 36; opacity: 0.10; }
        30%  { opacity: 0.32; }
        70%  { opacity: 0.32; }
        100% { stroke-dashoffset: 0; opacity: 0.10; }
      }

      .iconRow { display:flex; justify-content:center; padding-top: calc(6px * var(--asc-scale, 1)); }
      .iconWrap { position: relative; display:flex; justify-content:center; align-items:center; }

      .symbolRotator { position: relative; display:flex; justify-content:center; align-items:center; }
      .symbolRotator.rot-h .sensor-svg { transform: rotate(90deg); transform-origin: 50% 50%; }

      .sensor-svg {
        width: calc(240px * var(--asc-scale, 1));
        height: calc(170px * var(--asc-scale, 1));
        display:block;
        overflow:visible;
      }

      /* Image symbol */
      .asc-image-box{
        position: relative;
        width: calc(240px * var(--asc-scale, 1));
        height: calc(170px * var(--asc-scale, 1));
        border-radius: var(--asc-img-radius, 0px);
        overflow: hidden;
      }
      .asc-image-bg{
        position:absolute;
        inset:0;
        z-index: 0;
        pointer-events:none;
        overflow:hidden;
      }
      .asc-image-box.framed,
      .asc-image-bg.framed{
        outline: var(--asc-img-frame-w, 2px) solid var(--asc-img-frame-c, rgba(255,255,255,0.22));
        outline-offset: 0;
      }
      .asc-image-box.placeholder,
      .asc-image-bg.placeholder{
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
        opacity: 0.7;
        background: rgba(0,0,0,0.18);
        backdrop-filter: blur(8px);
      }
      .asc-image-box .asc-image,
      .asc-image-bg .asc-image{
        width: 100%;
        height: 100%;
        object-fit: var(--asc-img-fit, cover);
        opacity: var(--asc-img-opacity, 1);
        filter: var(--asc-img-filter, none);
        display:block;
      }
            .asc-image-dim{
        position:absolute;
        inset:0;
        pointer-events:none;
        background: #000;
      }

.asc-image-tint{
        position:absolute;
        inset:0;
        pointer-events:none;
      }

      /* Ensure content overlays sit above full-card image background */
      .wrap.image-full > .header,
      .wrap.image-full > .iconRow,
      .wrap.image-full > .bottom{
        position: relative;
        z-index: 2;
      }

      /* --------------------------------------------------------------
       * HA Visual Editor quality-of-life (Image symbol only)
       * When the card is wider/taller than the preview pane, we want the
       * image/card itself to be scrollable inside the preview, so that
       * badge auto-pan (scrollIntoView) can keep the badge visible.
       * This is ONLY enabled for preview instances (data-asc-preview="1")
       * and ONLY when the selected symbol is "Image".
       * -------------------------------------------------------------- */
      :host([data-asc-preview="1"]) .asc-preview-scroll{
        display: block;
        width: 100%;
        max-width: 100%;
        max-height: min(560px, 70vh);
        overflow: auto;
        box-sizing: border-box;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
}
      :host([data-asc-preview="1"]) .asc-preview-scroll .wrap.sym-image{
        overflow: visible;
      }
      .wrap.image-full .nameOverlay,
      .wrap.image-full .statsOverlay{
        z-index: 6;
      }

      /* Badges overlay (global) */
      .asc-badges-layer{
        position:absolute;
        left:0;
        top:0;
        width: calc(240px * var(--asc-scale, 1));
        height: calc(170px * var(--asc-scale, 1));
        pointer-events:none;
        z-index: 6;
      }
      .wrap.image-full .asc-badges-layer{
        width: 100%;
        height: 100%;
      }
      /* Match horizontal symbol rotation (SVG is rotated; rotate badges the same) */
      .symbolRotator.rot-h .asc-badges-layer{
        transform: rotate(90deg);
        transform-origin: 50% 50%;
      }

      .asc-badge{
        position:absolute;
        transform: translate(-50%, -50%);
        display:inline-flex;
        flex-wrap: nowrap;
        align-items:center;
        gap:6px;
        width: max-content;
        white-space: nowrap;
        overflow: visible;
        padding: var(--asc-bdg-pad, 8px);
        border-radius: var(--asc-bdg-rad, 999px);
        font-size: var(--asc-bdg-fs, 12px);
        line-height: 1.15;
        box-sizing: border-box;
        color: var(--asc-bdg-txt, #fff);
        border: 1px solid var(--asc-bdg-brd, rgba(255,255,255,0.25));
        pointer-events:auto;
        user-select:none;
        -webkit-user-select:none;
        cursor:pointer;
      }

.asc-badge.dragging{cursor: grabbing;}
.asc-badge{cursor: grab;}
      .asc-badge.glass{
        background:
          linear-gradient(180deg,
            rgba(255,255,255,0.16),
            rgba(255,255,255,0.05) 35%,
            rgba(0,0,0,0.10)),
          var(--asc-bdg-bg, rgba(0,0,0,0.35));
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 10px 26px rgba(0,0,0,0.35);
      }
      .asc-badge.solid{
        background: var(--asc-bdg-bg, rgba(0,0,0,0.85));
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .asc-badge.outline{
        background: transparent;
        border-width: 2px;
        border-style: dashed;
        box-shadow: none;
      }
      .asc-badge.none{
        background: transparent;
        border: none;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }

/* Badge symbol styles (Fan / Heatpump) */
.asc-badge.fan,
.asc-badge.heatpump{
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  gap: 4px;
  flex-direction: column;
  align-items: center;
}
.asc-badge.fan{
  width: var(--asc-bdg-icoSize, 48px);
  height: var(--asc-bdg-icoSize, 48px);
}
.asc-badge.heatpump{
  width: calc(var(--asc-bdg-icoSize, 48px) * 1.4);
  height: var(--asc-bdg-icoSize, 48px);
}
.asc-badge.fan .bdgSymHost,
.asc-badge.heatpump .bdgSymHost{
  width: 100%;
  height: 100%;
  display:block;
}
.asc-badge.fan .bdgSymHost svg,
.asc-badge.heatpump .bdgSymHost svg{
  width: 100%;
  height: 100%;
  display:block;
  pointer-events:none;
}


.asc-badge.hasSlider{
  width: var(--asc-sld-wrap-w, 180px);
  max-width: 520px;
  cursor: default;
  gap: 8px;
  border-radius: var(--asc-bdg-rad, 14px);
  overflow: hidden;
}
.asc-badge.hasSlider .bSliderWrap{
  display:flex;
  align-items:center;
  gap:8px;
  width:100%;
}
.asc-badge.hasSlider .bSliderMain{
  display:flex;
  flex-direction:column;
  gap:6px;
  width:100%;
}
.asc-badge.hasSlider .bSlider{
  width: var(--asc-sld-len, 100%);
  height: var(--asc-sld-thk, 6px);
  accent-color: var(--asc-sld-thumb-c, var(--primary-color));
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}
.asc-badge.hasSlider.vert{
  width: var(--asc-sld-wrap-w, 74px);
  height: var(--asc-sld-wrap-h, 200px);
}
.asc-badge.hasSlider.vert .bSliderMain{
  height:100%;
  justify-content:space-between;
  position: relative;
}
.asc-badge.hasSlider.vert .bSlider{
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--asc-sld-len, 170px);
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: 50% 50%;
}
.asc-badge.hasSlider .bSVal{
  font-size: 11px;
  opacity: 0.9;
  min-width: 26px;
  text-align: right;
}

/* Slider theming (best-effort) */
.asc-badge.hasSlider .bSlider::-webkit-slider-runnable-track{
  height: var(--asc-sld-thk, 6px);
  border-radius: var(--asc-sld-track-r, 999px);
  background: var(--asc-sld-track-c, rgba(255,255,255,0.25));
}
.asc-badge.hasSlider .bSlider::-webkit-slider-thumb{
  -webkit-appearance: none;
  appearance: none;
  width: var(--asc-sld-thumb, 18px);
  height: var(--asc-sld-thumb, 18px);
  border-radius: var(--asc-sld-thumb-r, 999px);
  background: var(--asc-sld-thumb-c, #fff);
  border: 2px solid rgba(0,0,0,0.25);
  margin-top: calc((var(--asc-sld-thumb, 18px) - var(--asc-sld-thk, 6px)) / -2);
}
.asc-badge.hasSlider .bSlider::-moz-range-track{
  height: var(--asc-sld-thk, 6px);
  border-radius: var(--asc-sld-track-r, 999px);
  background: var(--asc-sld-track-c, rgba(255,255,255,0.25));
}
.asc-badge.hasSlider .bSlider::-moz-range-thumb{
  width: var(--asc-sld-thumb, 18px);
  height: var(--asc-sld-thumb, 18px);
  border-radius: var(--asc-sld-thumb-r, 999px);
  background: var(--asc-sld-thumb-c, #fff);
  border: 2px solid rgba(0,0,0,0.25);
}


      .asc-badge.left_arrow,
.asc-badge.right_arrow,
.asc-badge.top_arrow,
.asc-badge.bottom_arrow{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-radius: 0 !important;
  overflow: visible;
  /* arrow graphic is drawn with ::before */
  position: absolute;
}
.asc-badge.left_arrow::before,
.asc-badge.right_arrow::before,
.asc-badge.top_arrow::before,
.asc-badge.bottom_arrow::before{
  content: "";
  position:absolute;
  inset:0;
  background: var(--asc-bdg-shape, rgba(0,0,0,0.70));
  pointer-events:none;
  z-index: 0;
}
.asc-badge.left_arrow::before{ clip-path: polygon(0 50%, 14% 0, 14% 28%, 100% 28%, 100% 72%, 14% 72%, 14% 100%); }
.asc-badge.right_arrow::before{ clip-path: polygon(100% 50%, 86% 0, 86% 28%, 0 28%, 0 72%, 86% 72%, 86% 100%); }
.asc-badge.top_arrow::before{ clip-path: polygon(50% 0, 100% 18%, 72% 18%, 72% 100%, 28% 100%, 28% 18%, 0 18%); }
.asc-badge.bottom_arrow::before{ clip-path: polygon(50% 100%, 100% 82%, 72% 82%, 72% 0, 28% 0, 28% 82%, 0 82%); }

/* ensure text/icon is above the arrow graphic */
.asc-badge.left_arrow > *,
.asc-badge.right_arrow > *,
.asc-badge.top_arrow > *,
.asc-badge.bottom_arrow > *{
  position: relative;
  z-index: 1;
}

      .asc-badge.vertTxt .bTxt{ writing-mode: vertical-rl; transform: rotate(180deg); }
      .asc-badge.vertTxt{ gap: 4px; }

      .asc-badge.recycle_left,
.asc-badge.recycle_right{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-radius: 0 !important;

  padding: 0 !important;
  /* Let padding control overall size (bigger padding => bigger arrow) */
  width: calc(56px + (var(--asc-bdg-pad, 8px) * 2));
  height: calc(56px + (var(--asc-bdg-pad, 8px) * 2));
  justify-content: center;
  align-items: center;
  overflow: visible;
  position: absolute;
}

.asc-badge.recycle_left .bTxt,
.asc-badge.recycle_right .bTxt{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  pointer-events:none;
}

.asc-badge .recycleIcon{
  position:absolute;
  inset:0;
  width: 100%;
  height: 100%;
  pointer-events:none;
  opacity: 1;
  filter: none;
}

.asc-badge .recycleIcon .arc{
  fill: none;
  stroke: currentColor;
  stroke-width: 10;
  stroke-linecap: round;
  stroke-linejoin: round;
}


      /* Recycle animation: spin the recycle arrows (direction by style) */
      .asc-badge.recycleSpin .recycleIcon{
        animation: ascRecycleSpin 4.4s linear infinite;
        transform-origin: 50% 50%;
      }
      .asc-badge.recycleSpin.spinLeft .recycleIcon{
        animation-direction: reverse;
      }

      /* Flow animation overlay for arrows/recycle */
      .asc-badge.flowAnim{ position: absolute; }
      .asc-badge.flowAnim::after{
        content: "";
        position:absolute;
        inset:0;
        pointer-events:none;
        opacity: 0.35;
        background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.0) 0, rgba(255,255,255,0.0) 10px, rgba(255,255,255,0.35) 10px, rgba(255,255,255,0.35) 16px);
        background-size: 60px 100%;
        animation: ascFlowX 4.4s linear infinite;
      }
/* Clip flow overlay to arrow shape */
.asc-badge.left_arrow.flowAnim::after{ clip-path: polygon(0 50%, 14% 0, 14% 28%, 100% 28%, 100% 72%, 14% 72%, 14% 100%); }
.asc-badge.right_arrow.flowAnim::after{ clip-path: polygon(100% 50%, 86% 0, 86% 28%, 0 28%, 0 72%, 86% 72%, 86% 100%); }
.asc-badge.top_arrow.flowAnim::after{ clip-path: polygon(50% 0, 100% 18%, 72% 18%, 72% 100%, 28% 100%, 28% 18%, 0 18%); }
.asc-badge.bottom_arrow.flowAnim::after{ clip-path: polygon(50% 100%, 100% 82%, 72% 82%, 72% 0, 28% 0, 28% 82%, 0 82%); }

      .asc-badge.flowAnim.flow-left::after{ animation-name: ascFlowXLeft; }
      .asc-badge.flowAnim.flow-right::after{ animation-name: ascFlowX; }
      .asc-badge.flowAnim.flow-up::after{
        background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.0) 0, rgba(255,255,255,0.0) 10px, rgba(255,255,255,0.35) 10px, rgba(255,255,255,0.35) 16px);
        background-size: 100% 60px;
        animation-name: ascFlowYUp;
      }
      .asc-badge.flowAnim.flow-down::after{
        background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.0) 0, rgba(255,255,255,0.0) 10px, rgba(255,255,255,0.35) 10px, rgba(255,255,255,0.35) 16px);
        background-size: 100% 60px;
        animation-name: ascFlowY;
      }

      @keyframes ascFlowX{ from{ background-position: 0 0; } to{ background-position: 60px 0; } }
      @keyframes ascFlowXLeft{ from{ background-position: 60px 0; } to{ background-position: 0 0; } }
      @keyframes ascFlowY{ from{ background-position: 0 0; } to{ background-position: 0 60px; } }
      @keyframes ascFlowYUp{ from{ background-position: 0 60px; } to{ background-position: 0 0; } }
@keyframes ascRecycleSpin{ from{ transform: rotate(0deg);} to{ transform: rotate(360deg);} }
      .asc-badge.iconOnly{
        padding: calc(var(--asc-bdg-pad, 8px) - 2px);
      }
      .asc-badge .bIcon{
        --mdc-icon-size: var(--asc-bdg-icoSize, 18px);
        width: var(--asc-bdg-icoSize, 18px);
        height: var(--asc-bdg-icoSize, 18px);
        color: var(--asc-bdg-ico, currentColor);
        opacity: 0.98;
      }

      .asc-badge .bImgBox{
        width: var(--asc-bdg-icoSize, 18px);
        height: var(--asc-bdg-icoSize, 18px);
        position: relative;
        overflow: hidden;
        border-radius: var(--asc-bdg-img-radius, 8px);
        opacity: var(--asc-bdg-img-opacity, 1);
        filter: var(--asc-bdg-img-filter, none);
        flex: 0 0 auto;
      }
      .asc-badge .bImgBox.framed{
        box-shadow: 0 0 0 var(--asc-bdg-img-frame-w, 2px) var(--asc-bdg-img-frame-c, rgba(255,255,255,0.22)) inset;
      }
      .asc-badge .bImg{
        width: 100%;
        height: 100%;
        display:block;
        object-fit: var(--asc-bdg-img-fit, cover);
      }
      .asc-badge .bImgTint{
        position:absolute;
        inset:0;
        pointer-events:none;
      }
      .asc-badge .bImgPh{
        width:100%;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 10px;
        opacity: 0.75;
        background: rgba(255,255,255,0.06);
      }

      .asc-badge .bTxt{
        display:inline-flex;
        flex-wrap: nowrap;
        align-items:center;
        opacity: 0.98;
        min-width: 0; /* allow flex shrink */
        white-space: nowrap;
      }

      .asc-badge.fixedW{
        width: var(--asc-bdg-fixed-w, auto);
        max-width: var(--asc-bdg-fixed-w, none);
        justify-content: space-between;
      }
      .asc-badge.fixedW .bTxt{
        overflow: hidden;
        text-overflow: ellipsis;
      }




/* Fan DOM host must have explicit size (otherwise injected SVG can render at default 300x150) */
.asc-fan-dom{
  width: calc(240px * var(--asc-scale, 1));
  height: calc(170px * var(--asc-scale, 1));
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}
.asc-fan-dom > svg{
  width: 100%;
  height: 100%;
  display:block;
}

      .split-values{
        position:absolute;
        inset: 0;
        pointer-events:none;
        z-index: 4;
      }
      .split-value{
        position:absolute;
        font-weight: 850;
        font-size: clamp(calc(12px * var(--asc-scale, 1)), calc(3.5vw * var(--asc-scale, 1)), calc(18px * var(--asc-scale, 1)));
        line-height: 1.1;
        white-space: nowrap;
        transform: translate(-50%, -50%);
      }
      .split-values.vertical .split-value.first{ left: 33%; top: 50%; }
      .split-values.vertical .split-value.second{ left: 67%; top: 50%; }

      /* In horizontal, split halves become top/bottom after rotation */
      .split-values.horizontal .split-value.first{ left: 50%; top: 35%; }
      .split-values.horizontal .split-value.second{ left: 50%; top: 65%; }

      .value.inside {
        position: absolute;
        top: var(--asc-value-y, auto);
        left: 50%;
        transform: translateX(calc(-50% + var(--asc-value-off-x, 0px))) translateY(var(--asc-value-off-y, 0px));
        background: transparent;
        border: none;
        padding: 0;
        border-radius: 0;
        backdrop-filter: none;
        font-size: clamp(calc(12px * var(--asc-scale, 1)), calc(3.5vw * var(--asc-scale, 1)), calc(18px * var(--asc-scale, 1)));
        font-weight: 850;
        z-index: 4;
        text-shadow: 0 2px 8px rgba(0,0,0,0.55);
      }

      .split-names{
        position:absolute;
        inset: 0;
        pointer-events:none;
        z-index: 5;
        font-weight: 800;
        font-size: calc(11px * var(--asc-scale, 1));
        opacity: 0.85;
      }
      .split-names.horizontal .split-name{
        position:absolute;
        left: 50%;
        transform: translateX(calc(-50% + var(--asc-value-off-x, 0px))) translateY(var(--asc-value-off-y, 0px));
        max-width: 92%;
        text-align:center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .split-names.horizontal .name1{ top: 12%; }
      .split-names.horizontal .name2{ bottom: 12%; }

      .split-names.vertical .split-name{
        position:absolute;
        top: 50%;
        transform: translateY(-50%);
        max-height: 92%;
        text-align:center;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .split-names.vertical .name1{ left: 24%; }
      .split-names.vertical .name2{ right: 24%; }

      .bottom { margin-top: calc(10px * var(--asc-scale, 1) * var(--asc-gap-mult, 1)); display:flex; }
      .bottom.bottom_left { justify-content:flex-start; text-align:left; }
      .bottom.bottom_center { justify-content:center; text-align:center; }
      .bottom.bottom_right { justify-content:flex-end; text-align:right; }

      .statsRow {
        margin-top: calc(12px * var(--asc-scale, 1) * var(--asc-gap-mult, 1));
        width: 100%;
        display:flex;
        flex-wrap: wrap;
        justify-content:center;
        gap: calc(18px * var(--asc-scale, 1));
        font-size: calc(12px * var(--asc-scale, 1));
        opacity: 0.85;
        font-weight: 700;
      }

      .sub { opacity:0.7; font-size:12px; padding:4px 0 0; }
    
      .tapConfirmLock{
        position:absolute;
        z-index: 30;
        top: var(--asc-edge-pad, 10px);
        right: var(--asc-edge-pad, 10px);
        width: calc(34px * var(--asc-scale, 1));
        height: calc(34px * var(--asc-scale, 1));
        border-radius: 999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background: rgba(0,0,0,0.35);
        border: 1px solid rgba(255,255,255,0.20);
        box-shadow: 0 6px 18px rgba(0,0,0,0.25);
        cursor: pointer;
        pointer-events:auto;
        backdrop-filter: blur(6px);
      }
      .tapConfirmLock ha-icon{
        --mdc-icon-size: calc(18px * var(--asc-scale, 1));
        color: #fff;
      }



      /* Washing machine / Tumble dryer drum animation */
      .asc-wm-spin{
        animation-name: ascWmSpin;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        will-change: transform;
      }
      .asc-wm-spin.rev{ animation-direction: reverse; }

      .asc-wm-clothes{
        animation-name: ascWmClothes;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        will-change: transform;
      }

      @keyframes ascWmSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }

      @keyframes ascWmClothes {
        0%   { transform: rotate(0deg) translate(0px, 0px); }
        25%  { transform: rotate(6deg) translate(1px, -1px); }
        50%  { transform: rotate(0deg) translate(0px, 0px); }
        75%  { transform: rotate(-6deg) translate(-1px, 1px); }
        100% { transform: rotate(0deg) translate(0px, 0px); }
      }
`;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, AndySensorCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Andy Sensor Card",
  description: "Multi-symbol sensor card (battery liquid + battery segments + split battery + tanks + water level + fan). Intervals control colors and segment blocks. Unique SVG defs prevent gradient/clip collisions.",
});

/* =============================================================================
 * Editor (HTMLElement)
 * ============================================================================= */


const DEFAULTS = {
  name: "Sensor",
  entity: "",
  entity2: "",
  // Editor-only: allow dragging badges in preview (never active in normal view)
  badge_drag_enabled: false,
  // Charging (Battery + Battery Splitted)
  charging_state_entity: "",
  charging_power_entity: "",
  charging_state_entity2: "",
  charging_power_entity2: "",
  symbol: "battery_liquid",
  min: 0,
  max: 100,
  unit: "",
  decimals: 0,
  value_position: "top_right",
  value_font_size: 0,
      name_font_size: 0,
  glass: true,
  orientation: "vertical",
  fan_blade_count: 3,
  garage_door_type: "single",
  blind_style: "persienne",
  blind_position_entity: "",
  blind_position_entity2: "",
  image_source: "url",
  image_url: "",
  image_media: "",
  image_fit: "cover",
  image_full_card: false,
  image_opacity: 1,
  image_radius: 0,
  image_frame: false,
  image_frame_color: "rgba(255,255,255,0.22)",
  image_frame_width: 2,
  image_tint: false,
  image_tint_color: "#000000",
  image_tint_opacity: 0.0,
  image_dim_off: false,
  image_dim_off_opacity: 0.45,
  show_scale: false,
  scale_color_mode: "per_interval",
  show_stats: false,
  stats_hours: 24,
  //v1.0.2
  card_scale: 1,
      card_width: "",
      card_height: "",
      //v1.0.2    
  intervals: deepClone(DEFAULT_INTERVALS).map(normalizeInterval),
  badges: [],

};

class AndySensorCardEditor extends HTMLElement {
  setConfig(config) {
    const incomingRaw = { ...DEFAULTS, ...(config || {}) };
    if ("liquid_animation" in incomingRaw) delete incomingRaw.liquid_animation;

    incomingRaw.orientation = (String(incomingRaw.orientation) === "horizontal") ? "horizontal" : "vertical";
    incomingRaw.scale_color_mode = (String(incomingRaw.scale_color_mode) === "active_interval") ? "active_interval" : "per_interval";

    incomingRaw.badge_drag_enabled = !!incomingRaw.badge_drag_enabled;


    incomingRaw.fan_blade_count = clampInt(incomingRaw.fan_blade_count ?? 3, 2, 8, 3);
    const gdt = String(incomingRaw.garage_door_type || "single");
    incomingRaw.garage_door_type = (gdt === "double") ? "double" : "single";

    const sym = String(incomingRaw.symbol || "battery_liquid").trim().toLowerCase();
incomingRaw.symbol =
  (sym === "washing_machine") ? "washing_machine" :
  (sym === "tumble_dryer") ? "tumble_dryer" :
  (sym === "battery_segments") ? "battery_segments" :
  (sym === "battery_splitted_segments") ? "battery_splitted_segments" :
  (sym === "water_level_segments") ? "water_level_segments" :
  (sym === "silo") ? "silo" :
  (sym === "tank") ? "tank" :
  (sym === "ibc_tank") ? "ibc_tank" :
  (sym === "fan") ? "fan" :
  (sym === "heatpump") ? "heatpump" :
  (sym === "gas_cylinder") ? "gas_cylinder" :
  (sym === "garage_door") ? "garage_door" :
  (sym === "blind") ? "blind" :
  (sym === "gate") ? "gate" :
  (sym === "image") ? "image" :
  (sym === "battery_liquid_modern") ? "battery_liquid_modern" :
  (sym === "battery_segments_modern") ? "battery_segments_modern" :
  (sym === "battery_splitted_segments_modern") ? "battery_splitted_segments_modern" :
  (sym === "water_level_segments_modern") ? "water_level_segments_modern" :
  "battery_liquid";
    // Image options normalization
    if (typeof incomingRaw.image_source !== "string") incomingRaw.image_source = "url";
    incomingRaw.image_source = (String(incomingRaw.image_source).trim().toLowerCase() === "media") ? "media" : "url";

    if (typeof incomingRaw.image_url !== "string") incomingRaw.image_url = "";
    incomingRaw.image_url = String(incomingRaw.image_url || "").trim();

    if (typeof incomingRaw.image_media !== "string") incomingRaw.image_media = "";
    incomingRaw.image_media = String(incomingRaw.image_media || "").trim();

    const fit = String(incomingRaw.image_fit || "cover").trim().toLowerCase();
    incomingRaw.image_fit = (fit === "contain") ? "contain" : "cover";

    incomingRaw.image_full_card = !!incomingRaw.image_full_card;

    {
      let op = Number(incomingRaw.image_opacity ?? 1);
      if (!Number.isFinite(op)) op = 1;
      incomingRaw.image_opacity = Math.max(0, Math.min(1, op));
    }
    {
      let r = Number(incomingRaw.image_radius ?? 0);
      if (!Number.isFinite(r)) r = 0;
      incomingRaw.image_radius = Math.max(0, Math.min(48, r));
    }

    incomingRaw.image_frame = !!incomingRaw.image_frame;
    if (typeof incomingRaw.image_frame_color !== "string") incomingRaw.image_frame_color = "rgba(255,255,255,0.22)";
    incomingRaw.image_frame_color = String(incomingRaw.image_frame_color || "rgba(255,255,255,0.22)");
    {
      let fw = Number(incomingRaw.image_frame_width ?? 2);
      if (!Number.isFinite(fw)) fw = 2;
      incomingRaw.image_frame_width = Math.max(0, Math.min(10, fw));
    }

    incomingRaw.image_tint = !!incomingRaw.image_tint;
    if (typeof incomingRaw.image_tint_color !== "string") incomingRaw.image_tint_color = "#000000";
    incomingRaw.image_tint_color = String(incomingRaw.image_tint_color || "#000000").trim() || "#000000";
    {
      let to = Number(incomingRaw.image_tint_opacity ?? 0);
      if (!Number.isFinite(to)) to = 0;
      incomingRaw.image_tint_opacity = Math.max(0, Math.min(1, to));
    }

    incomingRaw.image_dim_off = !!incomingRaw.image_dim_off;
    {
      let doo = Number(incomingRaw.image_dim_off_opacity ?? 0.45);
      if (!Number.isFinite(doo)) doo = 0.45;
      incomingRaw.image_dim_off_opacity = Math.max(0, Math.min(1, doo));
    }



    if (!Array.isArray(incomingRaw.intervals) || incomingRaw.intervals.length === 0) incomingRaw.intervals = deepClone(DEFAULT_INTERVALS);
    incomingRaw.intervals = incomingRaw.intervals.map(normalizeInterval);
    if (!Array.isArray(incomingRaw.badges)) incomingRaw.badges = [];
    incomingRaw.badges = incomingRaw.badges.map(normalizeBadge);


    if (!Number.isFinite(Number(incomingRaw.min))) incomingRaw.min = 0;
    if (!Number.isFinite(Number(incomingRaw.max))) incomingRaw.max = 100;

    this._config = incomingRaw;
    this._buildOnce();
    this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    const isEditing = !!this._isEditing;

    // Keep entity pickers connected to hass, but skip full sync while typing.
    if (this._elEntity) this._elEntity.hass = this._hass;
    if (this._elEntity2) this._elEntity2.hass = this._hass;
    if (this._elImageMediaPicker) this._elImageMediaPicker.hass = this._hass;
    if (this._elImageMediaSelector) this._elImageMediaSelector.hass = this._hass;

    if (this._built && this._config && !isEditing) {
      try { this._sync(); } catch (e) {}
    }
  }

  _buildOnce() {
    if (this._built) return;
    this._built = true;

    

// Listen for drag events from the preview card (composed/bubbles out of shadow DOM).
// We only commit on drag-end to keep the editor stable while dragging.
if (!this._ascDragEndBound) {
  this._ascDragEndBound = (ev) => {
    try {
      const d = ev?.detail || {};
      const id = String(d.id || "");
      if (!id) return;
      if (!this._config || !Array.isArray(this._config.badges)) return;

      const x = Math.max(0, Math.min(100, Number(d.x)));
      const y = Math.max(0, Math.min(100, Number(d.y)));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const badges = this._config.badges.map(normalizeBadge);
      const idx = badges.findIndex(b => String(b.id) === id);
      if (idx < 0) return;

      badges[idx] = { ...badges[idx], x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };

      // If we're editing this badge, keep draft in sync
      if (this._badgeEditingId && String(this._badgeEditingId) === id && this._badgeDraft) {
        this._badgeDraft.x = badges[idx].x;
        this._badgeDraft.y = badges[idx].y;
      }

      this._commit("badges", badges);
    } catch (e) {}
  };
  window.addEventListener("asc-badge-drag-end", this._ascDragEndBound);
}
const stopBubble = (e) => {
      // Prevent HA/Lovelace from seeing these clicks as "outside" and closing popovers
      // (color picker / menus) or causing focus to jump.
      try { e.stopPropagation(); } catch (_) {}
      try { e.stopImmediatePropagation?.(); } catch (_) {}
    };

    const root = document.createElement("div");
    root.className = "form";

    // Robust focus tracking: focus can live inside shadow roots (ha-textfield),
    // so `document.activeElement` checks are not enough. We track focusin/out
    // at the editor root to decide if we may safely `_sync()`.
    this._isEditing = false;
    const markEditing = () => {
      this._isEditing = true;
      if (this._editBlurTimer) {
        clearTimeout(this._editBlurTimer);
        this._editBlurTimer = 0;
      }
    };
    const unmarkEditingSoon = () => {
      if (this._editBlurTimer) clearTimeout(this._editBlurTimer);
      this._editBlurTimer = setTimeout(() => {
        // If focus is still somewhere inside the editor, keep editing=true
        const ae = document.activeElement;
        const stillInside = !!(ae && (ae === this || this.contains(ae)));
        this._isEditing = stillInside;
      }, 150);
    };
    root.addEventListener("focusin", markEditing, true);
    root.addEventListener("focusout", unmarkEditingSoon, true);

    const mkText = (label, key, type = "text", placeholder = "") => {
      const tf = document.createElement("ha-textfield");
      tf.label = label;
      tf.type = type;
      tf.placeholder = placeholder;
      tf.configValue = key;
      tf.addEventListener("input", (e) => this._onChange(e));
      tf.addEventListener("change", (e) => this._onChange(e));
      tf.addEventListener("value-changed", (e) => this._onChange(e));
      return tf;
    };

    const mkColorText = (label, key, fallback = "#ffffff") => {
      const row = document.createElement("div");
      row.className = "colorRow";

      const tf = mkText(label, key, "text", fallback);
      // keep color input in sync with textfield
      const btn = document.createElement("input");
      btn.type = "color";
      btn.className = "colorBtn";

      const cur = normalizeHex(String((this._config || {})[key] ?? ""), fallback);
      try { btn.value = String(cur).slice(0, 7); } catch(e) {}

      btn.addEventListener("input", (e) => {
        stopBubble(e);
        const v = String(btn.value || fallback);
        tf.value = v;
        this._commit(key, v);
      });
      btn.addEventListener("click", stopBubble);

      tf.addEventListener("change", (e) => {
        stopBubble(e);
        const v = normalizeHex(String(tf.value || ""), fallback);
        tf.value = v;
        try { btn.value = v.slice(0, 7); } catch(_) {}
        this._commit(key, v);
      });
      tf.addEventListener("click", stopBubble);

      row.appendChild(tf);
      row.appendChild(btn);
      return row;
    };


    const mkSwitch = (label, key) => {
      const ff = document.createElement("ha-formfield");
      ff.label = label;
      const sw = document.createElement("ha-switch");
      sw.configValue = key;
      sw.addEventListener("change", (e) => this._onChange(e));
      sw.addEventListener("value-changed", (e) => this._onChange(e));
      ff.appendChild(sw);
      return { wrap: ff, sw };
    };

    const mkSelect = (label, key, options) => {
      const sel = document.createElement("ha-select");
      sel.label = label;
      sel.configValue = key;

      options.forEach(([value, text]) => {
        const item = document.createElement("mwc-list-item");
        item.value = value;
        item.innerText = text;
        sel.appendChild(item);
      });

      sel.addEventListener("click", stopBubble);
      sel.addEventListener("opened", (e) => {
        stopBubble(e);
        if (key === "symbol") {
          // Ensure the menu opens from the top so all options are easy to find.
          setTimeout(() => {
            try {
              const menu = sel.shadowRoot?.querySelector("mwc-menu") || sel.shadowRoot?.querySelector("ha-menu");
              const list = menu?.shadowRoot?.querySelector(".mdc-list") || menu?.shadowRoot?.querySelector("mwc-list") || menu?.querySelector("mwc-list") || menu;
              if (list && typeof list.scrollTop === "number") list.scrollTop = 0;
            } catch (_) {}
          }, 0);
        }
      });
      sel.addEventListener("closed", stopBubble);
      sel.addEventListener("keydown", stopBubble);

      sel.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        this._onChange(e);
      });

      sel.addEventListener("selected", (e) => {
        e.stopPropagation();
        if (sel.value) this._commit(key, sel.value);
      });

      return sel;
    };

    const mkEntityControl = (label, configValue) => {
      // Prefer HA's selector (works across HA versions). Fallback to ha-entity-picker.
      const hasSelector = !!customElements.get("ha-selector");
      if (hasSelector) {
        const sel = document.createElement("ha-selector");
        sel.label = label;
        sel.configValue = configValue;
        sel.selector = { entity: {} };
        sel.style.display = "block";
        sel.style.minHeight = "56px";
        sel.style.width = "100%";
        sel.addEventListener("value-changed", (e) => this._onChange(e));
        sel.addEventListener("click", stopBubble);
        return sel;
      }

      const ep = document.createElement("ha-entity-picker");
      ep.label = label;
      ep.allowCustomEntity = true;
      ep.configValue = configValue;
      ep.style.display = "block";
      ep.style.minHeight = "56px";
      ep.style.width = "100%";
      ep.addEventListener("value-changed", (e) => this._onChange(e));
      ep.addEventListener("click", stopBubble);
      return ep;
    };



    const cardTitle = document.createElement("div");
    cardTitle.className = "section-title badgesHeader";
    cardTitle.innerText = CARD_TAGLINE;
    root.appendChild(cardTitle);


    const vars = document.createElement("div");
    vars.className = "badgeVarsHelp";

    const rows = [
    `<code>&lt;value&gt;</code> formatted value (incl. unit)`,
    `<code>&lt;state&gt;</code> raw state`,
    `<code>&lt;name&gt;</code> friendly name`,
    `<code>&lt;unit&gt;</code> unit`,
    `<code>&lt;entity_id&gt;</code> entity id`,
    `<code>&lt;domain&gt;</code> entity domain`,
    `<code>&lt;last_changed&gt;</code> local time`,
    `<code>&lt;last_updated&gt;</code> local time`,
    `<code>&lt;last_changed_rel&gt;</code> relative time`,
    `<code>&lt;last_updated_rel&gt;</code> relative time`,
    `<code>&lt;last_changed_iso&gt;</code> ISO time`,
    `<code>&lt;last_updated_iso&gt;</code> ISO time`,
    `<code>&lt;attr:xxx&gt;</code> any attribute, e.g. <code>&lt;attr:temperature&gt;</code>`
    ].join("<br/>");

    vars.innerHTML = `
    <div class="badgeVarsTitle">Variables you can use in Labels with or without your own text</div>
    <div class="badgeVarsList">${rows}</div>
    <div class="badgeVarsExample"><b>Example:</b> Temperature: <code>&lt;value&gt;</code></div>
    `;
    root.appendChild(vars);
    

    


    this._elEntity = mkEntityControl("Main Entity", "entity");
    root.appendChild(this._elEntity);

    const entHint = document.createElement("div");
    entHint.className = "hint";
    entHint.innerText = "Tip: Switch/binary entities work too (on/true = 1, off/false = 0).";
    root.appendChild(entHint);

    this._elMainTap = mkSelect("Tap action (main entity)", "tap_action", [
      ["more-info", "More info"],
      ["toggle", "Toggle"],
      ["call-service", "Call service"],
      ["none", "None"],
    ]);
    root.appendChild(this._elMainTap);

    // Main tap: call-service UI (same behavior as Badges)
    const _svcDomainMain = (eid) => {
      const s = String(eid || "");
      const i = s.indexOf(".");
      return i > 0 ? s.slice(0, i) : "";
    };
    const _buildSvcItemsMain = (eid) => {
      const hassSvcs = (this._hass && this._hass.services) ? this._hass.services : null;
      const dom = _svcDomainMain(eid);
      const out = [];
      if (!hassSvcs) return out;
      if (dom && hassSvcs[dom]) {
        Object.keys(hassSvcs[dom]).sort().forEach((svc) => out.push({ value: `${dom}.${svc}`, label: `${dom}.${svc}` }));
      }
      return out;
    };
    this._rowMainSvc = document.createElement("div");
    this._rowMainSvc.className = "svcBox";
    this._rowMainSvc.style.display = "none";

    const svcRowMain = document.createElement("div");
    svcRowMain.className = "grid2";

    const ffPickMain = document.createElement("ha-formfield");
    ffPickMain.label = "Pick service from list";
    const swPickMain = document.createElement("ha-switch");
    // Default ON for discoverability
    swPickMain.checked = (this._config?.tap_action_service_picker ?? true);
    swPickMain.addEventListener("change", (e) => {
      e.stopPropagation();
      this._commit("tap_action_service_picker", !!swPickMain.checked);
      this._updateMainSvcVisibility?.();
    });
    ffPickMain.appendChild(swPickMain);
    svcRowMain.appendChild(ffPickMain);

    const svcPickerMain = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
    svcPickerMain.label = "Available services";
    svcPickerMain.style.width = "100%";
    svcPickerMain.addEventListener("click", stopBubble);

    const fillSvcPickerMain = () => {
      const items = _buildSvcItemsMain(this._config?.entity);
      const tag = svcPickerMain.tagName.toLowerCase();
      if (tag === "ha-combo-box") {
        svcPickerMain.items = items;
        svcPickerMain.itemLabelPath = "label";
        svcPickerMain.itemValuePath = "value";
        svcPickerMain.value = this._config?.tap_action_service || "";
      } else {
        while (svcPickerMain.firstChild) svcPickerMain.removeChild(svcPickerMain.firstChild);
        items.forEach(({ value, label }) => {
          const it = document.createElement("mwc-list-item");
          it.value = value;
          it.innerText = label;
          svcPickerMain.appendChild(it);
        });
        svcPickerMain.value = this._config?.tap_action_service || "";
      }
    };
    fillSvcPickerMain();

    svcPickerMain.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? svcPickerMain.value;
      this._commit("tap_action_service", String(v || ""));
      if (tfSvcMain) tfSvcMain.value = String(v || "");
    });
    svcRowMain.appendChild(svcPickerMain);
    this._rowMainSvc.appendChild(svcRowMain);

    const tfSvcMain = document.createElement("ha-textfield");
    tfSvcMain.label = "Service (domain.service)";
    tfSvcMain.value = this._config?.tap_action_service || "";
    tfSvcMain.addEventListener("input", (e) => {
      e.stopPropagation();
      this._commit("tap_action_service", tfSvcMain.value);
      try { svcPickerMain.value = tfSvcMain.value; } catch(e) {}
    });
    tfSvcMain.addEventListener("click", stopBubble);
    this._rowMainSvc.appendChild(tfSvcMain);

    const tfDataMain = document.createElement("ha-textfield");
    tfDataMain.label = "Service data (optional JSON)";
    tfDataMain.value = (typeof this._config?.tap_action_service_data === "string")
      ? this._config.tap_action_service_data
      : (this._config?.tap_action_service_data ? JSON.stringify(this._config.tap_action_service_data) : "");
    tfDataMain.addEventListener("input", (e) => {
      e.stopPropagation();
      this._commit("tap_action_service_data", tfDataMain.value);
    });
    tfDataMain.addEventListener("click", stopBubble);
    this._rowMainSvc.appendChild(tfDataMain);

    root.appendChild(this._rowMainSvc);

    this._updateMainSvcVisibility = () => {
      const act = String(this._config?.tap_action || "more-info");
      const isSvc = (act === "call-service");
      if (!this._rowMainSvc) return;
      this._rowMainSvc.style.display = isSvc ? "" : "none";
      // Hide manual input if picker ON (but keep in DOM for advanced users)
      const pickerOn = (this._config?.tap_action_service_picker ?? true);
      tfSvcMain.style.display = pickerOn ? "none" : "";
      svcPickerMain.style.display = pickerOn ? "" : "none";
    };


    // Safety confirm before opening (Gate/Garage/Blind)
    this._rowTapConfirmOpen = document.createElement("div");
    this._rowTapConfirmOpen.className = "grid2";
    this._rowTapConfirmOpen.style.display = "none";

    const ffConfirm = document.createElement("ha-formfield");
    ffConfirm.label = "Tap starts unlock (Gate/Garage/Blind)";
    this._swTapConfirmOpen = document.createElement("ha-switch");
    this._swTapConfirmOpen.configValue = "tap_confirm_open";
    this._swTapConfirmOpen.checked = !!this._config?.tap_confirm_open;
    this._swTapConfirmOpen.addEventListener("change", (e) => this._onChange(e));
    this._swTapConfirmOpen.addEventListener("value-changed", (e) => this._onChange(e));
    ffConfirm.appendChild(this._swTapConfirmOpen);

    this._tfTapConfirmOpenWindow = document.createElement("ha-textfield");
    this._tfTapConfirmOpenWindow.label = "Confirm state in (seconds)";
    this._tfTapConfirmOpenWindow.type = "number";
    this._tfTapConfirmOpenWindow.min = "1";
    this._tfTapConfirmOpenWindow.max = "60";
    this._tfTapConfirmOpenWindow.step = "1";
    this._tfTapConfirmOpenWindow.configValue = "tap_confirm_open_window";
    this._tfTapConfirmOpenWindow.value = String(this._config?.tap_confirm_open_window ?? 10);
    this._tfTapConfirmOpenWindow.addEventListener("input", (e) => this._onChange(e));
    this._tfTapConfirmOpenWindow.addEventListener("change", (e) => this._onChange(e));
    this._tfTapConfirmOpenWindow.addEventListener("click", stopBubble);

    this._rowTapConfirmOpen.appendChild(ffConfirm);
    this._rowTapConfirmOpen.appendChild(this._tfTapConfirmOpenWindow);

    this._tapConfirmHint = document.createElement("div");
    this._tapConfirmHint.className = "hint";
    this._tapConfirmHint.innerText = "When the entity is closed, the first tap shows a lock. Tap the lock within the time window to run the tap action.";
    this._tapConfirmHint.style.display = "none";

    root.appendChild(this._rowTapConfirmOpen);
    root.appendChild(this._tapConfirmHint);

    this._elEntity2 = mkEntityControl("Second Entity splitted symbol (Battery)", "entity2");
    root.appendChild(this._elEntity2);

    // Charging controls (Battery + Battery Splitted)
    this._elChargingState = mkEntityControl("Main Entity - Charging state entity (on/off) to show charging animation", "charging_state_entity");
    root.appendChild(this._elChargingState);

    this._elChargingPower = mkEntityControl("Main Entity - Charging power entity", "charging_power_entity");
    root.appendChild(this._elChargingPower);

    this._elChargingState2 = mkEntityControl("Second Entity - Charging state entity (on/off) to show charging animation", "charging_state_entity2");
    root.appendChild(this._elChargingState2);

    this._elChargingPower2 = mkEntityControl("Second Entity - Charging power entity", "charging_power_entity2");
    root.appendChild(this._elChargingPower2);


    // Split battery optional labels (only shown when split names are enabled)
    this._rowSplitLabels = document.createElement("div");
    this._rowSplitLabels.className = "grid2";
    this._elSplitLabel1 = mkText("Main entity label (optional) variable support", "split_label1");
    this._elSplitLabel2 = mkText("Second entity label (optional) variable support", "split_label2");
    this._rowSplitLabels.appendChild(this._elSplitLabel1);
    this._rowSplitLabels.appendChild(this._elSplitLabel2);
    root.appendChild(this._rowSplitLabels);


const rowSym = document.createElement("div");
    rowSym.className = "grid1";

    this._elSymbol = mkSelect("Symbol", "symbol", [
      ["battery_liquid", "Battery"],
      ["battery_segments", "Battery (segments)"],
      ["battery_splitted_segments", "Battery splitted (segments)"],
      ["water_level_segments", "Water level (waves/segments)"],
      ["silo", "Silo"],
      ["tank", "Tank"], //v1.0.2
      ["ibc_tank", "IBC Tank"], //v1.1.5
      ["fan", "Fan"], //v1.2.0
      ["heatpump", "Heatpump"], //v1.5.6
      ["washing_machine", "Washing machine"], //v1.0.6
      ["tumble_dryer", "Tumble dryer"], //v1.0.6
      ["garage_door", "Garage door"], //v1.6.15
      ["blind", "Blind"], //v1.6.26
      ["gate", "Gate"], //v1.6.30
      ["image", "Image"], //v1.6.38
      ["gas_cylinder", "Gas cylinder"], //v1.0.2
    ]);
    rowSym.appendChild(this._elSymbol);
    root.appendChild(rowSym);

    // Industrial look toggle (uses the Modern rendering where available)
    const rowIndustrial = document.createElement("div");
    rowIndustrial.className = "grid1";
    const ind = mkSwitch("Modern look", "industrial_look");
    this._swIndustrial = ind.sw;
    this._rowIndustrial = rowIndustrial;
    rowIndustrial.appendChild(ind.wrap);
    root.appendChild(rowIndustrial);

    const rowNamePos = document.createElement("div");
    rowNamePos.className = "grid2";
    this._elName = mkText("Name", "name");
    rowNamePos.appendChild(this._elName);

    this._elNamePos = mkSelect("Name position", "name_position", [
      ["top_left", "Top left"],
      ["top_center", "Top center"],
      ["top_right", "Top right"],
      ["bottom_left", "Bottom left"],
      ["bottom_center", "Bottom center"],
      ["bottom_right", "Bottom right"],
    ]);
    rowNamePos.appendChild(this._elNamePos);
    root.appendChild(rowNamePos);

    const rowStatsPos = document.createElement("div");
    rowStatsPos.className = "grid1";
    this._elStatsPos = mkSelect("Min/Avg/Max position", "stats_position", [
      ["top_left", "Top left"],
      ["top_center", "Top center"],
      ["top_right", "Top right"],
      ["bottom_left", "Bottom left"],
      ["bottom_center", "Bottom center"],
      ["bottom_right", "Bottom right"],
    ]);
    rowStatsPos.appendChild(this._elStatsPos);
    root.appendChild(rowStatsPos);

const row2 = document.createElement("div");
    row2.className = "grid2";
    this._elUnit = mkText("Unit (optional)", "unit", "text", "");
    this._elDecimals = mkText("Decimals", "decimals", "number", "0");
    row2.appendChild(this._elUnit);
    row2.appendChild(this._elDecimals);
    root.appendChild(row2);

    const row3 = document.createElement("div");
    row3.className = "grid3";
    this._elMin = mkText("Min (scale)", "min", "number");
    this._elMax = mkText("Max (scale)", "max", "number");
    this._elFont = mkText("Value font size (px) — 0 = auto", "value_font_size", "number", "0");
    row3.appendChild(this._elMin);
    row3.appendChild(this._elMax);
    row3.appendChild(this._elFont);
    root.appendChild(row3);

    const rowNameFont = document.createElement("div");
    rowNameFont.className = "grid2";
    this._elNameFont = mkText("Name font size (px) — 0 = auto", "name_font_size", "number", "0");
    rowNameFont.appendChild(this._elNameFont);
    // spacer to keep alignment
    const spacerNF = document.createElement("div");
    spacerNF.style.visibility = "hidden";
    rowNameFont.appendChild(spacerNF);
    root.appendChild(rowNameFont);

    //v1.0.2
    const rowScale = document.createElement("div");
    rowScale.className = "grid2";
    this._elCardScale = mkText("Card scale (0.2–4.0) — 1 = default", "card_scale", "text", "1");
    try { this._elCardScale.inputmode = "decimal"; } catch (_) {}
    try { this._elCardScale.type = "text"; } catch (_) {}
    rowScale.appendChild(this._elCardScale);
    this._elSegmentGap = mkText("Gap between segments (0–40)", "segment_gap", "number", "5");
    this._elSegmentGap.step = "1";
    rowScale.appendChild(this._elSegmentGap);
    root.appendChild(rowScale);

    const rowSize = document.createElement("div");
    rowSize.className = "grid2";
    this._elCardWidth = mkText("Card width (optional, e.g. 180px)", "card_width", "text", "");
    this._elCardHeight = mkText("Card height (optional, e.g. 220px)", "card_height", "text", "");
    rowSize.appendChild(this._elCardWidth);
    rowSize.appendChild(this._elCardHeight);
    root.appendChild(rowSize);

    //v1.0.2

    const rowVP = document.createElement("div");
    rowVP.className = "grid2";

    this._elValuePos = mkSelect("Value position", "value_position", [ 
      ["top_left", "Top left"],
      ["top_right", "Top right"],
      ["top_center", "Top center"],
      ["bottom_left", "Bottom left"],
      ["bottom_right", "Bottom right"],
      ["bottom_center", "Bottom center"],
      ["inside", "Inside icon"],
      ["hide", "Hide"],
    ]);
    rowVP.appendChild(this._elValuePos);

    const secTog = document.createElement("div");
    secTog.className = "toggles";

    const { wrap: swGlassWrap, sw: swGlass } = mkSwitch("Glass effect", "glass");
    this._swGlass = swGlass;

    const { wrap: swScaleWrap, sw: swScale } = mkSwitch("Show scale (ticks)", "show_scale");
    this._swScale = swScale;
    this._ffShowScale = swScaleWrap;

    const { wrap: swFanFrameWrap, sw: swFanFrame } = mkSwitch("Show frame (Fan)", "fan_show_frame");
    this._swFanFrame = swFanFrame;
    this._ffFanFrame = swFanFrameWrap;

    const { wrap: swStatsWrap, sw: swStats } = mkSwitch("Show Min/Avg/Max (history)", "show_stats");
    this._swStats = swStats;


    const { wrap: swOutlineWrap, sw: swOutline } = mkSwitch("Outline value", "outline_value");
    this._swOutline = swOutline;

    const { wrap: swSplitNamesWrap, sw: swSplitNames } = mkSwitch("Show entity names (split battery)", "show_split_entity_names");
    this._swSplitNames = swSplitNames;

    secTog.appendChild(swGlassWrap);
    secTog.appendChild(swScaleWrap);
    secTog.appendChild(swFanFrameWrap);
    secTog.appendChild(swStatsWrap);

    secTog.appendChild(swOutlineWrap);
    secTog.appendChild(swSplitNamesWrap);

    rowVP.appendChild(secTog);
    root.appendChild(rowVP);

    const rowOffsets = document.createElement("div");
    rowOffsets.className = "grid2";
    // Use number inputs here so users get spinner arrows (up/down) and easier negative adjustments.
    this._elNameOffsetX = mkText("Name offset X (px)", "name_offset_x", "text", "0");
    try { this._elNameOffsetX.type = "number"; this._elNameOffsetX.step = "1"; this._elNameOffsetX.min = "-999"; this._elNameOffsetX.max = "999"; } catch (_) {}
    this._elNameOffsetY = mkText("Name offset Y (px)", "name_offset_y", "text", "0");
    try { this._elNameOffsetY.type = "number"; this._elNameOffsetY.step = "1"; this._elNameOffsetY.min = "-999"; this._elNameOffsetY.max = "999"; } catch (_) {}
    rowOffsets.appendChild(this._elNameOffsetX);
    rowOffsets.appendChild(this._elNameOffsetY);
    root.appendChild(rowOffsets);

    const rowOffsets2 = document.createElement("div");
    rowOffsets2.className = "grid2";
    this._elValueOffsetX = mkText("Value offset X (px)", "value_offset_x", "text", "0");
    try { this._elValueOffsetX.type = "number"; this._elValueOffsetX.step = "1"; this._elValueOffsetX.min = "-999"; this._elValueOffsetX.max = "999"; } catch (_) {}
    this._elValueOffsetY = mkText("Value offset Y (px)", "value_offset_y", "text", "0");
    try { this._elValueOffsetY.type = "number"; this._elValueOffsetY.step = "1"; this._elValueOffsetY.min = "-999"; this._elValueOffsetY.max = "999"; } catch (_) {}
    rowOffsets2.appendChild(this._elValueOffsetX);
    rowOffsets2.appendChild(this._elValueOffsetY);
    root.appendChild(rowOffsets2);


    const rowOpt = document.createElement("div");
    rowOpt.className = "grid2";

    this._elOrientation = mkSelect("Orientation", "orientation", [
      ["vertical", "Vertical"],
      ["horizontal", "Horizontal"],
    ]);
    rowOpt.appendChild(this._elOrientation);

    this._elScaleMode = mkSelect("Scale color mode", "scale_color_mode", [
      ["per_interval", "Per interval"],
      ["active_interval", "Active interval"],
    ]);
    rowOpt.appendChild(this._elScaleMode);

    
    // Fan / Heatpump: blade count (integer)
    const rowBlade = document.createElement("div");
    rowBlade.className = "grid2";
    this._elFanBladeCount = mkText("Blade count", "fan_blade_count", "number", "3");
    try { this._elFanBladeCount.step = "1"; this._elFanBladeCount.min = "2"; this._elFanBladeCount.max = "8"; } catch(e) {}
    rowBlade.appendChild(this._elFanBladeCount);
    this._rowFanBlade = rowBlade;
    root.appendChild(rowBlade);

    // Garage door options
const rowGarage = document.createElement("div");
rowGarage.className = "grid3";
this._elGarageType = mkSelect("Door type", "garage_door_type", [
  ["single","Single"],
  ["double","Double"],
]);
this._elGarageWidth = mkText("Door width", "garage_door_width", "number", "200");
try { this._elGarageWidth.step = "1"; this._elGarageWidth.min = "120"; this._elGarageWidth.max = "320"; } catch(e) {}
this._elGarageGap = mkText("Gap between doors", "garage_door_gap", "number", "16");
try { this._elGarageGap.step = "1"; this._elGarageGap.min = "0"; this._elGarageGap.max = "160"; } catch(e) {}

rowGarage.appendChild(this._elGarageType);
rowGarage.appendChild(this._elGarageWidth);
rowGarage.appendChild(this._elGarageGap);
this._rowGarage = rowGarage;
root.appendChild(rowGarage);

// Garage door lamp (door 1)
const rowGarageLamp = document.createElement("div");
rowGarageLamp.className = "grid1";
this._elGarageLamp1 = mkEntityControl("First garage inside lamp entity", "garage_door_lamp_entity");
rowGarageLamp.appendChild(this._elGarageLamp1);
this._rowGarageLamp = rowGarageLamp;
root.appendChild(rowGarageLamp);

// Garage door 2 entities (only for double)
const rowGarage2 = document.createElement("div");
rowGarage2.className = "grid2";
this._elGarageDoor2 = mkEntityControl("Second garage door entity", "garage_door_entity2");
this._elGarageLamp2 = mkEntityControl("Second inside lamp entity", "garage_door_lamp_entity2");
rowGarage2.appendChild(this._elGarageDoor2);
rowGarage2.appendChild(this._elGarageLamp2);
this._rowGarage2 = rowGarage2;
root.appendChild(rowGarage2);

// Blind options (only when symbol is Blind)
const rowBlind = document.createElement("div");
rowBlind.className = "grid1";
this._elBlindStyle = mkSelect("Blind style", "blind_style", [
  ["persienne","Persienn"],
  ["lamella","Lamell"],
  ["window","Window"],
]);
rowBlind.appendChild(this._elBlindStyle);
this._rowBlind = rowBlind;
root.appendChild(rowBlind);




// Blind position entity (only when symbol is Blind AND style is Window)
const rowBlindPos = document.createElement("div");
rowBlindPos.className = "grid1";
this._elBlindPos = mkEntityControl("Blind position entity (0..100)", "blind_position_entity");
rowBlindPos.appendChild(this._elBlindPos);
this._rowBlindPos = rowBlindPos;
root.appendChild(rowBlindPos);



// Second blind position entity (only when Blind + Window + Double)
const rowBlindPos2 = document.createElement("div");
rowBlindPos2.className = "grid1";
this._elBlindPos2 = mkEntityControl("Second blind position entity (0..100)", "blind_position_entity2");
rowBlindPos2.appendChild(this._elBlindPos2);
this._rowBlindPos2 = rowBlindPos2;
root.appendChild(rowBlindPos2);

    // Window lamp opacity (only when Blind + Window)
    const rowWinLampOp = document.createElement("div");
    rowWinLampOp.className = "grid1";
    this._elWindowLampOpacity = mkText("Window lamp glow opacity (0..1)", "window_lamp_opacity", "number", "0.5");
    try { this._elWindowLampOpacity.step = "0.05"; this._elWindowLampOpacity.min = "0"; this._elWindowLampOpacity.max = "1"; } catch(e) {}
    rowWinLampOp.appendChild(this._elWindowLampOpacity);
    this._rowWinLampOp = rowWinLampOp;
    root.appendChild(rowWinLampOp);


// Gate options (only when symbol is Gate)
const rowGate = document.createElement("div");
rowGate.className = "grid3";
this._elGateType = mkSelect("Gate type", "gate_type", [
  ["sliding","Sliding"],
  ["door","Door"],
]);
this._elGateWidth = mkText("Width", "gate_width", "number", "220");
try { this._elGateWidth.step = "1"; this._elGateWidth.min = "160"; this._elGateWidth.max = "420"; } catch(e) {}
this._elGateSide = mkSelect("Left / Right", "gate_side", [
  ["left","Left"],
  ["right","Right"],
]);
rowGate.appendChild(this._elGateType);
rowGate.appendChild(this._elGateWidth);
rowGate.appendChild(this._elGateSide);
this._rowGate = rowGate;
root.appendChild(rowGate);


// Image options (only when symbol is Image)
const rowImage = document.createElement("div");
rowImage.className = "imageBlock";
rowImage.style.display = "none"; // hidden unless Symbol = Image

// Row 1: fit
const rowImg1 = document.createElement("div");
rowImg1.className = "grid1";
this._elImageFit = mkSelect("Image fit", "image_fit", [
  ["cover","Cover (fill)"],
  ["contain","Contain (show all)"],
]);
rowImg1.appendChild(this._elImageFit);
rowImage.appendChild(rowImg1);

// Row 2: url/path only
const rowImg2 = document.createElement("div");
rowImg2.className = "grid1";
this._elImageUrl = mkText("Image URL / path", "image_url");
try { this._elImageUrl.placeholder = "/local/my-image.png"; } catch(e) {}
rowImg2.appendChild(this._elImageUrl);
rowImage.appendChild(rowImg2);

// Row 3: layout + style
const rowImg3 = document.createElement("div");
rowImg3.className = "grid3";
this._elImageOpacity = mkText("Opacity (0-1)", "image_opacity", "number", "1");
try { this._elImageOpacity.step = "0.05"; this._elImageOpacity.min = "0"; this._elImageOpacity.max = "1"; } catch(e) {}
this._elImageRadius = mkText("Radius (px)", "image_radius", "number", "0");
try { this._elImageRadius.step = "1"; this._elImageRadius.min = "0"; this._elImageRadius.max = "48"; } catch(e) {}
const ffFull = mkSwitch("Full card background", "image_full_card");
this._swImageFull = ffFull.sw;

rowImg3.appendChild(this._elImageOpacity);
rowImg3.appendChild(this._elImageRadius);
rowImg3.appendChild(ffFull.wrap);
rowImage.appendChild(rowImg3);

// Row 4: tint + dim + frame
const rowImg4 = document.createElement("div");
rowImg4.className = "grid3";

const ffTint = mkSwitch("Tint overlay", "image_tint");
this._swImageTint = ffTint.sw;
this._elImageTintColorRow = mkColorText("Tint color", "image_tint_color", "#FFD37A");
this._elImageTintOpacity = mkText("Tint opacity (0-1)", "image_tint_opacity", "number", "0");
try { this._elImageTintOpacity.step = "0.05"; this._elImageTintOpacity.min = "0"; this._elImageTintOpacity.max = "1"; } catch(e) {}

const ffDim = mkSwitch("Dim when off", "image_dim_off");
this._swImageDim = ffDim.sw;
this._elImageDimOpacity = mkText("Dim factor (0-1)", "image_dim_off_opacity", "number", "0.45");
try { this._elImageDimOpacity.step = "0.05"; this._elImageDimOpacity.min = "0"; this._elImageDimOpacity.max = "1"; } catch(e) {}

const ffFrame = mkSwitch("Frame", "image_frame");
this._swImageFrame = ffFrame.sw;
this._elImageFrameColorRow = mkColorText("Frame color", "image_frame_color", "#ffffff");
this._elImageFrameWidth = mkText("Frame width", "image_frame_width", "number", "2");
try { this._elImageFrameWidth.step = "1"; this._elImageFrameWidth.min = "0"; this._elImageFrameWidth.max = "10"; } catch(e) {}

// Put switches first (nice UX)
rowImg4.appendChild(ffTint.wrap);
rowImg4.appendChild(ffDim.wrap);
rowImg4.appendChild(ffFrame.wrap);
rowImage.appendChild(rowImg4);

const rowImg5 = document.createElement("div");
rowImg5.className = "grid3";
rowImg5.appendChild(this._elImageTintColorRow);
rowImg5.appendChild(this._elImageTintOpacity);
rowImg5.appendChild(this._elImageDimOpacity);
rowImage.appendChild(rowImg5);

const rowImg6 = document.createElement("div");
rowImg6.className = "grid3";
rowImg6.appendChild(this._elImageFrameColorRow);
rowImg6.appendChild(this._elImageFrameWidth);
rowImage.appendChild(rowImg6);

// Visibility rules for extra image controls
const updateImageExtrasVisibility = () => {
  const cfg = this._config || {};
  const tintOn = !!cfg.image_tint;
  const dimOn = !!cfg.image_dim_off;
  const frameOn = !!cfg.image_frame;
  try { this._elImageTintColorRow.style.display = tintOn ? "" : "none"; } catch(e) {}
  try { this._elImageTintOpacity.style.display = tintOn ? "" : "none"; } catch(e) {}
  try { this._elImageDimOpacity.style.display = dimOn ? "" : "none"; } catch(e) {}
  try { this._elImageFrameColorRow.style.display = frameOn ? "" : "none"; } catch(e) {}
  try { this._elImageFrameWidth.style.display = frameOn ? "" : "none"; } catch(e) {}
};
try { this._swImageTint.addEventListener("change", () => setTimeout(updateImageExtrasVisibility, 0)); } catch(e) {}
try { this._swImageDim.addEventListener("change", () => setTimeout(updateImageExtrasVisibility, 0)); } catch(e) {}
try { this._swImageFrame.addEventListener("change", () => setTimeout(updateImageExtrasVisibility, 0)); } catch(e) {}
setTimeout(updateImageExtrasVisibility, 0);

this._rowImage = rowImage;
root.appendChild(rowImage);


root.appendChild(rowOpt);

    this._elStatsHours = mkText("Stats lookback hours", "stats_hours", "number", "24");
    root.appendChild(this._elStatsHours);

    // ---- intervals section ----
    const secInt = document.createElement("div");
    secInt.className = "section";
    const secTitle = document.createElement("div");
    secTitle.className = "section-title";
    secTitle.innerText = "Intervals (also used as segment blocks on Battery, garage door, blinds etc. For wash machine and tumble dryer use seconds field to set speed: quick=1 or lower, slow =3 or higher)";
    secInt.appendChild(secTitle);

    const head = document.createElement("div");
    head.className = "section-head";
    const btnAdd = document.createElement("button");
    btnAdd.setAttribute("unelevated", "");
    btnAdd.classList.add("haPrimary");
    btnAdd.innerText = "+ Add interval";
    btnAdd.addEventListener("click", (e) => { e.stopPropagation(); this._startAdd(); });
    head.appendChild(btnAdd);
    secInt.appendChild(head);

    this._intervalList = document.createElement("div");
    this._intervalList.className = "intervalList";
    secInt.appendChild(this._intervalList);

    this._draftBox = document.createElement("div");
    this._draftBox.className = "draft";
    secInt.appendChild(this._draftBox);

    root.appendChild(secInt);

    // ---- badges section ----
    const secBad = document.createElement("div");
    secBad.className = "section";
    const badTitle = document.createElement("div");
    badTitle.className = "section-title badgesHeader";
    badTitle.innerText = "Badges - Add multiple badges to display entity data";
    secBad.appendChild(badTitle);

    const badHead = document.createElement("div");
    badHead.className = "section-head";
    const btnBadAdd = document.createElement("button");
    btnBadAdd.setAttribute("unelevated", "");
    btnBadAdd.classList.add("haPrimary");
    btnBadAdd.innerText = "+ Add badge";
    btnBadAdd.addEventListener("click", (e) => { e.stopPropagation(); this._startAddBadge(); });
    badHead.appendChild(btnBadAdd);


// Drag & drop badges directly in the Preview (visual editor only).
const dragHint = document.createElement("div");
dragHint.className = "note";
dragHint.innerHTML = "💡 <b>Tip:</b> You can drag &amp; drop badges directly in the <b>Preview</b> to position them. This only works inside the visual editor preview.";
secBad.appendChild(dragHint);

secBad.appendChild(badHead);

    this._badgeList = document.createElement("div");
    this._badgeList.className = "badgeList";
    secBad.appendChild(this._badgeList);

    this._badgeDraftBox = document.createElement("div");
    this._badgeDraftBox.className = "draft";
    secBad.appendChild(this._badgeDraftBox);


    const varsHead = document.createElement("div");
    varsHead.className = "badgeVarsHelp";
    const varRow = [
    `<code>&lt;value&gt;</code> formatted value (incl. unit)`,
    `<code>&lt;state&gt;</code> raw state`,
    `<code>&lt;name&gt;</code> friendly name`,
    `<code>&lt;unit&gt;</code> unit`,
    `<code>&lt;entity_id&gt;</code> entity id`,
    `<code>&lt;domain&gt;</code> entity domain`,
    `<code>&lt;last_changed&gt;</code> local time`,
    `<code>&lt;last_updated&gt;</code> local time`,
    `<code>&lt;last_changed_rel&gt;</code> relative time`,
    `<code>&lt;last_updated_rel&gt;</code> relative time`,
    `<code>&lt;last_changed_iso&gt;</code> ISO time`,
    `<code>&lt;last_updated_iso&gt;</code> ISO time`,
    `<code>&lt;attr:xxx&gt;</code> any attribute, e.g. <code>&lt;attr:temperature&gt;</code>`
    ].join("<br/>");

varsHead.innerHTML = `
  <div class="badgeVarsTitle">Variables you can use in Labels with or without your own text</div>
  <div class="badgeVarsList">${varRow}</div>
  <div class="badgeVarsExample"><b>Example:</b> Temperature: <code>&lt;value&gt;</code></div>

  <div class="badgeSupport">
    <div class="badgeSupportTitle">☕ Support the project</div>
    <div class="badgeSupportText">
      I’m a Home Automation enthusiast who spends late nights building custom cards and tools for Home Assistant.
      If you enjoy my work or use any of my cards, your support helps me keep improving and maintaining everything.
    </div>

    <div class="badgeSupportActions">
      <a class="badgeSupportImgLink" href="https://www.buymeacoffee.com/AndyBonde" target="_blank" rel="noopener noreferrer" aria-label="Buy me a coffee">
        <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="140" alt="Buy me a coffee">
      </a>
    </div>
  </div>
`;

    secBad.appendChild(varsHead);



    root.appendChild(secBad);
    
    
    
    
    
    

    const style = document.createElement("style");
    style.textContent = `
      .form { display:flex; flex-direction:column; gap:12px; padding:8px 0; overflow: visible; }
      .note{ font-size: 12px; line-height: 1.35; opacity: 0.9; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.10);} 
      ha-entity-picker, ha-select, ha-textfield { display:block; width:100%; }
      ha-entity-picker { min-height: 56px; }

      .grid1 { display:grid; grid-template-columns: 1fr; gap:12px; }
      .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
      .grid3 { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; }
      .toggles { display:flex; flex-direction:column; gap:8px; justify-content:center; }
      .hint{ font-size: 12px; opacity: .7; margin-top: -6px; }

      .section { border-top:1px solid rgba(0,0,0,0.10); padding-top:10px; margin-top:6px; display:flex; flex-direction:column; gap:10px; }
      
      .badgeSupport{
  margin-top: 12px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.03);
}

.badgeSupportTitle{
  font-weight: 800;
  margin-bottom: 6px;
}

.badgeSupportText{
  opacity: 0.9;
  line-height: 1.35;
  font-size: 0.92em;
  margin-bottom: 10px;
}

.badgeSupportActions{
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.badgeSupportLink{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  font-weight: 800;
  text-decoration: none;

  background: var(--primary-color);
  color: #fff;
  border: 1px solid color-mix(in srgb, var(--primary-color) 70%, black);
}

.badgeSupportLink:hover{
  filter: brightness(1.05);
}

.badgeSupportImgLink img{
  display: block;
  height: 32px;       /* gör den “knappstor” */
  width: auto;
  border-radius: 10px;
}

      
      
      
      

      .section-title{
       background: color-mix(in srgb, var(--warning-color, #ff9800) 22%, transparent);
       padding: 8px 10px;
       border-radius: 12px;
       border: 1px solid color-mix(in srgb, var(--warning-color, #ff9800) 55%, transparent);
       font-weight: 800;
       opacity: 0.98;
       color: var(--primary-text-color);
      }



      .section-title.badgesHeader{
       background: color-mix(in srgb, var(--warning-color, #ff9800) 22%, transparent);
       padding: 8px 10px;
       border-radius: 12px;
       border: 1px solid color-mix(in srgb, var(--warning-color, #ff9800) 55%, transparent);
       font-weight: 800;
       opacity: 0.98;
       color: var(--primary-text-color);
      }

      
  
      .sectionTitle.intervalsHeader{
        background: color-mix(in srgb, var(--warning-color, #ff9800) 22%, transparent);        
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--warning-color, #ff9800) 55%, transparent);
        font-weight: 800;
        opacity: 0.98;
        margin-top: 10px;
      }
      .itWrap{
        display:flex;
        flex-direction:column;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }

      .badgeVarsHelp{
        margin-top: 10px;
        padding: 10px 12px;
        border: 1px dashed rgba(0,0,0,0.18);
        border-radius: 12px;
        background: rgba(0,0,0,0.03);
        font-size: 12px;
        line-height: 1.35;
      }
      .badgeVarsTitle{ font-weight: 800; margin-bottom: 6px; opacity: .95; }
      .badgeVarsList code{
        background: rgba(0,0,0,0.06);
        padding: 2px 6px;
        border-radius: 8px;
        display: inline-block;
        margin: 0 4px 6px 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
      }

      .section-head { display:flex; justify-content:flex-end; }

      .intervalList { display:flex; flex-direction:column; gap:10px; }
      .intervalItem { display:flex; align-items:center; gap:10px; padding:10px; border-radius:12px; border:1px solid rgba(0,0,0,0.12); }
            .badgeList { display:flex; flex-direction:column; gap:10px; }
      .badgeItem { display:flex; align-items:center; gap:10px; padding:10px; border-radius:12px; border:1px solid rgba(0,0,0,0.12); }
      .bdgPreview { width:18px; height:18px; border-radius:6px; border:1px solid rgba(0,0,0,0.18); background: rgba(0,0,0,0.10); display:flex; align-items:center; justify-content:center; }
      .bdgPreview ha-icon { --mdc-icon-size: 16px; opacity: 0.85; }

      .badge { width:14px; height:14px; border-radius:999px; border:1px solid rgba(0,0,0,0.25); }
      .itText { flex:1 1 auto; }
      .itTitle { font-weight:700; }
      .itSub { font-size:12px; opacity:.75; }

      .btns { display:flex; gap:8px; }

      /* Badge mini preview slot (right side of each badge row) */
      .badgeMiniSlot{ flex:0 0 auto; margin-left:auto; max-width: 140px; }

.badgeMiniPreview{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  max-width: 210px;
  overflow:hidden;
}
.badgeMiniPreview .asc-badge{
  position: relative !important;
  left: auto !important;
  top: auto !important;
  transform: none !important;
  pointer-events: none;
  max-width: 210px;
  overflow: hidden;
}
.badgeMiniPreview .asc-badge .bTxt{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.badgeNudgeWrap{
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 14px;
  background: rgba(0,0,0,0.02);
}
.badgeNudgeTitle{ font-weight: 800; margin-bottom: 8px; opacity: .95; }
.badgeNudgeGrid{
  display:grid;
  grid-template-columns: 40px 40px 40px;
  grid-template-rows: 40px 40px 40px;
  gap: 6px;
  align-items:center;
  justify-content:start;
}
.badgeNudgeBtn{
  width: 40px;
  height: 40px;
  border-radius: 14px;

  background: var(--primary-color);
  border: 1px solid color-mix(in srgb, var(--primary-color) 70%, black);
  color: #fff;

  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;

  transition: filter 120ms ease, transform 80ms ease;
}
.badgeNudgeBtn ha-icon{ --mdc-icon-size: 20px; opacity: 0.9; }
.badgeNudgeBtn:hover{
  filter: brightness(0.90);
}
.badgeNudgeMid{
  font-size: 12px;
  opacity: 0.75;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius: 12px;
  border: 1px dashed rgba(0,0,0,0.18);
  height: 40px;
}

      /* HA-style buttons (works regardless of HA frontend versions) */
      button{
        font-family: inherit;
        font-size: 14px;
        line-height: 1;
        background: transparent;
      }
      button
      .animRow{ margin-top: 10px; }
      .badgeIntervalsSec{ margin-top: 16px; padding: 10px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); }
      .badgeIntervalsHdr{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-weight: 700; margin-bottom: 10px; }
      .badgeIntervalsBody{ display:block; }
      .badgeIntervalsEmpty{ opacity: 0.7; font-size: 12px; padding: 6px 2px; }
      .badgeIntRow{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .badgeIntRow:last-child{ border-bottom:none; }
      .badgeIntLeft{ font-size: 12px; opacity: 0.95; }
      .badgeIntBtns{ display:flex; gap:8px; }
      .badgeIntEdit{ margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.10); }
      .badgeIntEditGrid{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .badgeIntEditActions{ display:flex; justify-content:flex-end; gap:10px; margin-top: 10px; }

      /* --- Image browser dialog (Media Source images) --- */
      .asc-imgbr-overlay{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 16px;
      }
      .asc-imgbr-dialog{
        width: min(760px, 96vw);
        max-height: min(720px, 92vh);
        background: rgba(24,24,24,0.98);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        box-shadow: 0 18px 48px rgba(0,0,0,0.5);
        display:flex;
        flex-direction:column;
        overflow:hidden;
      }
      .asc-imgbr-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.10);
      }
      .asc-imgbr-title{ font-weight: 800; }
      .asc-imgbr-right{ display:flex; gap: 10px; align-items:center; }
      .asc-imgbr-path{
        padding: 6px 14px 0 14px;
        font-size: 11px;
        opacity: 0.75;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .asc-imgbr-sub{
        display:flex;
        gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        align-items:center;
      }
      .asc-imgbr-search{
        flex:1;
        padding: 9px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(0,0,0,0.25);
        color: #fff;
        outline: none;
      }
      .asc-imgbr-btn{
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.08);
        color: #fff;
        cursor: pointer;
      }
      .asc-imgbr-btn:disabled{ opacity:0.5; cursor: default; }
      .asc-imgbr-list{
        overflow:auto;
        padding: 6px 0;
      }
      .asc-imgbr-item{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 10px 14px;
        cursor: pointer;
      }
      .asc-imgbr-item:hover{ background: rgba(255,255,255,0.06); }
      .asc-imgbr-item-left{ display:flex; align-items:center; gap: 10px; min-width: 0; }
      .asc-imgbr-ico{ width: 24px; text-align:center; opacity:0.9; }
      .asc-imgbr-name{ white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
      .asc-imgbr-empty{ padding: 14px; opacity: 0.75; }

.haPrimary{
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        border: none;
        border-radius: 8px;
        height: 36px;
        padding: 0 14px;
        cursor: pointer;
        font-weight: 700;
        box-sizing: border-box;
      }
      button.haPrimary:hover{ filter: brightness(1.06); }
      button.haPrimary:active{ filter: brightness(0.96); }
      button.haPrimary:disabled{ opacity: 0.6; cursor: default; }

      /* If mwc-button exists in older setups, keep its theming as well */
      mwc-button.haPrimary{
        --mdc-theme-primary: var(--primary-color);
        --mdc-theme-on-primary: var(--text-primary-color, #fff);
        --mdc-button-unelevated-fill-color: var(--primary-color);
        --mdc-button-unelevated-ink-color: var(--text-primary-color, #fff);
        --mdc-button-raised-fill-color: var(--primary-color);
        --mdc-button-raised-ink-color: var(--text-primary-color, #fff);
      }
.draft { display:none; padding:12px; border-radius:14px; border:1px solid rgba(0,0,0,0.14); background: rgba(0,0,0,0.02); }
      .draft.show { display:block; }
      .olddraftHead { display:flex; justify-content:space-between; align-items:center; font-weight:800; margin-bottom:10px; }
      
      .draftHead{
      display:flex;
    justify-content:space-between;
    align-items:center;
    font-weight:800;
    margin-bottom:10px;

    background: color-mix(in srgb, var(--warning-color, #ff9800) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning-color, #ff9800) 55%, transparent);
    border-radius: 12px;
    padding: 8px 10px;
    opacity: 0.98;
    color: var(--primary-text-color);
    }

      
      
      .draftGrid1 { display:grid; grid-template-columns: 1fr; gap:12px; }
      .draftGrid2 { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
      .draftGrid3 { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; }
      .draftActions { display:flex; justify-content:flex-end; gap:10px; margin-top:10px; }

      .colorRow { display:flex; align-items:flex-end; gap:10px; margin-top:10px; }
      .colorRow ha-textfield { flex: 1 1 auto; }
      .colorBtn{
        width: 44px;
        height: 38px;
        padding: 0;
        border: 0px solid rgba(0,0,0,0.25);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
      }
    `;

    this.innerHTML = "";
    this.appendChild(style);
    this.appendChild(root);

    this.addEventListener("click", stopBubble);
    this.addEventListener("mousedown", stopBubble);
    this.addEventListener("mouseup", stopBubble);
    this.addEventListener("pointerdown", stopBubble);
    this.addEventListener("pointerup", stopBubble);
    this.addEventListener("keydown", stopBubble);
  }

  _sync() {
    if (!this._hass || !this._config) return;

    const baseSym = String(this._config.symbol || "battery_liquid");

    // Safety: Image options should only be visible when Symbol = Image
    const baseSymLc = String(baseSym || "").trim().toLowerCase();
    try { if (this._rowImage) this._rowImage.style.display = (baseSymLc === "image") ? "" : "none"; } catch(e) {}

    this._elEntity.hass = this._hass;
    this._elEntity.value = this._config.entity || "";
    this._elEntity.style.display = "";

    try { this._updateMainSvcVisibility?.(); } catch(e) {}

    if (this._elEntity2) {
      this._elEntity2.hass = this._hass;
      this._elEntity2.value = this._config.entity2 || "";
      const show = (baseSym === "battery_splitted_segments");
      this._elEntity2.style.display = show ? "" : "none";
    }

    // Industrial look toggle (only for symbols that support it, not Fan/Heatpump)
    if (this._swIndustrial && this._rowIndustrial) {
      const supported = ["battery_liquid","battery_segments","battery_splitted_segments","water_level_segments"].includes(baseSym);
      const hide = (!supported || baseSym === "fan" || baseSym === "heatpump");
      this._rowIndustrial.style.display = hide ? "none" : "";
      this._swIndustrial.checked = !!this._config.industrial_look;
    
    // Fan/Heatpump blade count visibility
    if (this._rowFanBlade && this._elFanBladeCount) {
      const show = (baseSym === "fan" || baseSym === "heatpump");
      this._rowFanBlade.style.display = show ? "" : "none";
      // Keep it integer (no decimals)
      const bc = clampInt(this._config.fan_blade_count ?? 3, 2, 8, 3);
      this._elFanBladeCount.value = String(bc);
    }

    
// Garage door / Blind options visibility
const isBlind = (baseSym === "blind");
const isGarage = (baseSym === "garage_door" || baseSym === "blind");
const garageType = String(this._config.garage_door_type || "single");
const isGarageDouble = isGarage && (garageType === "double");

if (this._rowGarage && this._elGarageType && this._elGarageWidth && this._elGarageGap) {
  this._rowGarage.style.display = isGarage ? "" : "none";

  // Dynamic labels (Door vs Blind)
  this._elGarageType.label = isBlind ? "Blind type" : "Door type";
  this._elGarageWidth.label = isBlind ? "Blind width" : "Door width";

  this._elGarageType.value = garageType;
  this._elGarageWidth.value = String(this._config.garage_door_width ?? 200);
  this._elGarageGap.value = String(this._config.garage_door_gap ?? 16);

  // Gap only makes sense for double
  this._elGarageGap.style.display = isGarageDouble ? "" : "none";
}

if (this._rowGarageLamp && this._elGarageLamp1) {
  const blindStyle = String(this._config?.blind_style || "").trim().toLowerCase();
  const isBlindWindow = (isBlind && blindStyle === "window");
  this._rowGarageLamp.style.display = (isGarage || isBlindWindow) ? "" : "none";

  this._elGarageLamp1.label = isBlindWindow ? "First window inside lamp entity" : "First garage inside lamp entity";
  this._elGarageLamp1.hass = this._hass;
  this._elGarageLamp1.value = this._config.garage_door_lamp_entity || "";
}

if (this._rowGarage2 && this._elGarageDoor2 && this._elGarageLamp2) {
  const blindStyle = String(this._config?.blind_style || "").trim().toLowerCase();
  const isBlindWindow = (isBlind && blindStyle === "window");
  this._rowGarage2.style.display = isGarageDouble ? "" : "none";
  // Dynamic label (Door vs Blind)
  try {
    this._elGarageDoor2.label = isBlind ? "Second blind entity" : "Second garage door entity";
  } catch(e) {}
  try {
    this._elGarageLamp2.label = isBlindWindow ? "Second window inside lamp entity" : "Second inside lamp entity";
  } catch(e) {}
  this._elGarageDoor2.hass = this._hass;
  this._elGarageDoor2.value = this._config.garage_door_entity2 || "";
  this._elGarageLamp2.hass = this._hass;
  this._elGarageLamp2.value = this._config.garage_door_lamp_entity2 || "";
}


// Gate options visibility
const isGate = (baseSym === "gate");
if (this._rowGate && this._elGateType && this._elGateWidth && this._elGateSide) {
  this._rowGate.style.display = isGate ? "" : "none";
  this._elGateType.value = String(this._config.gate_type || "sliding");
  this._elGateWidth.value = String(this._config.gate_width ?? 220);
  this._elGateSide.value = String(this._config.gate_side || "left");
}

// Blind style visibility
if (this._rowBlind && this._elBlindStyle) {
  const showBlind = (baseSym === "blind");
  this._rowBlind.style.display = showBlind ? "" : "none";
  this._elBlindStyle.value = String(this._config.blind_style || "persienne");
}

// Blind position visibility (only for Window style)
if (this._rowBlindPos && this._elBlindPos) {
  const showBlind = (baseSym === "blind");
  const bs = String(this._config.blind_style || "persienne").trim().toLowerCase();
  this._rowBlindPos.style.display = (showBlind && bs === "window") ? "" : "none";
  this._elBlindPos.hass = this._hass;
  this._elBlindPos.value = String(this._config.blind_position_entity || "");


// Second blind position entity visibility (only for Window style + Double)
if (this._rowBlindPos2 && this._elBlindPos2) {
  const showBlind = (baseSym === "blind");
  const bs = String(this._config.blind_style || "persienne").trim().toLowerCase();
  const gt = String(this._config.garage_door_type || "single").trim().toLowerCase();
  const isDouble = (gt === "double");
  this._rowBlindPos2.style.display = (showBlind && bs === "window" && isDouble) ? "" : "none";
  this._elBlindPos2.hass = this._hass;
  this._elBlindPos2.value = String(this._config.blind_position_entity2 || "");
}


// Window lamp opacity visibility (only for Window style)
if (this._rowWinLampOp && this._elWindowLampOpacity) {
  const showBlind = (baseSym === "blind");
  const bs = String(this._config.blind_style || "persienne").trim().toLowerCase();
  this._rowWinLampOp.style.display = (showBlind && bs === "window") ? "" : "none";
  this._elWindowLampOpacity.value = String(this._config.window_lamp_opacity ?? 0.5);
}

}


// Tap confirm safety visibility (Gate/Garage/Blind)
if (this._rowTapConfirmOpen && this._swTapConfirmOpen && this._tfTapConfirmOpenWindow) {
  const showConfirm = (baseSym === "gate" || baseSym === "garage_door" || (baseSym === "blind" && String(this._config.blind_style || "persienne").trim().toLowerCase() !== "window"));
  this._rowTapConfirmOpen.style.display = showConfirm ? "" : "none";
  if (this._tapConfirmHint) this._tapConfirmHint.style.display = showConfirm ? "" : "none";

  this._swTapConfirmOpen.checked = !!this._config.tap_confirm_open;
  this._tfTapConfirmOpenWindow.value = String(this._config.tap_confirm_open_window ?? 10);
  // Only show seconds field when enabled
  this._tfTapConfirmOpenWindow.style.display = this._swTapConfirmOpen.checked ? "" : "none";
}

// Image options visibility
if (this._rowImage) {
  const showImg = (String(baseSym || "").trim().toLowerCase() === "image");
  this._rowImage.style.display = showImg ? "" : "none";

  if (showImg) {
    // Support both current and legacy keys; ensure field reflects YAML
    const urlVal =
      (this._config.image_url != null ? this._config.image_url :
       this._config.image_path != null ? this._config.image_path :
       this._config.image != null ? this._config.image : "");
    if (this._elImageFit) this._elImageFit.value = String(this._config.image_fit || "cover");
    if (this._elImageUrl) this._elImageUrl.value = String(urlVal || "");

    if (this._elImageOpacity) this._elImageOpacity.value = String(this._config.image_opacity ?? 1);
    if (this._elImageRadius) this._elImageRadius.value = String(this._config.image_radius ?? 0);

    if (this._swImageFull) this._swImageFull.checked = !!this._config.image_full_card;

    // Tint
    if (this._swImageTint) this._swImageTint.checked = !!this._config.image_tint;
    if (this._elImageTintColor) this._elImageTintColor.value = String(this._config.image_tint_color || "#000000");
    if (this._elImageTintOpacity) this._elImageTintOpacity.value = String(this._config.image_tint_opacity ?? 0);

    // Dim when off
    if (this._swImageDim) this._swImageDim.checked = !!this._config.image_dim_off;
    if (this._elImageDimOpacity) this._elImageDimOpacity.value = String((this._config.image_dim_off_opacity) ?? 0.45);

    // Frame
    if (this._swImageFrame) this._swImageFrame.checked = !!this._config.image_frame;
    if (this._elImageFrameColor) this._elImageFrameColor.value = String(this._config.image_frame_color || "rgba(255,255,255,0.22)");
    if (this._elImageFrameWidth) this._elImageFrameWidth.value = String(this._config.image_frame_width ?? 2);
  }
}


}


    // Charging controls visibility
    const sym = (this._config.industrial_look && ["battery_liquid","battery_segments","battery_splitted_segments","water_level_segments"].includes(baseSym))
      ? `${baseSym}_modern`
      : baseSym;
    const isBattery = (sym === "battery_liquid" || (sym === "battery_segments" || sym === "battery_segments_modern"));
    const isSplitBattery = ((sym === "battery_splitted_segments" || sym === "battery_splitted_segments_modern"));

    if (this._elChargingState) {
      this._elChargingState.hass = this._hass;
      this._elChargingState.value = this._config.charging_state_entity || "";
      this._elChargingState.style.display = (isBattery || isSplitBattery) ? "" : "none";
    }
    if (this._elChargingPower) {
      this._elChargingPower.hass = this._hass;
      this._elChargingPower.value = this._config.charging_power_entity || "";
      this._elChargingPower.style.display = (isBattery || isSplitBattery) ? "" : "none";
    }

    if (this._elChargingState2) {
      this._elChargingState2.hass = this._hass;
      this._elChargingState2.value = this._config.charging_state_entity2 || "";
      this._elChargingState2.style.display = isSplitBattery ? "" : "none";
    }
    if (this._elChargingPower2) {
      this._elChargingPower2.hass = this._hass;
      this._elChargingPower2.value = this._config.charging_power_entity2 || "";
      this._elChargingPower2.style.display = isSplitBattery ? "" : "none";
    }

this._elSymbol.value = this._config.symbol || "battery_liquid";
    this._elName.value = this._config.name || "";

    if (this._elMainTap) this._elMainTap.value = this._config.tap_action || "more-info";
    if (this._elNamePos) this._elNamePos.value = this._config.name_position || "top_left";
    if (this._elStatsPos) {
      this._elStatsPos.value = this._config.stats_position || "bottom_center";
      this._elStatsPos.style.display = this._config.show_stats ? "" : "none";
    }

    this._elUnit.value = this._config.unit || "";
    this._elDecimals.value = String(this._config.decimals ?? 0);

    this._elMin.value = String(this._config.min ?? 0);
    this._elMax.value = String(this._config.max ?? 100);
    this._elFont.value = String(this._config.value_font_size ?? 0);
    if (this._elNameFont) this._elNameFont.value = String(this._config.name_font_size ?? 0);
    //v1.0.2
    this._elCardScale.value = String(this._config.card_scale ?? 1);
    if (this._elNameOffsetX) this._elNameOffsetX.value = String(this._config.name_offset_x ?? 0);
    if (this._elNameOffsetY) this._elNameOffsetY.value = String(this._config.name_offset_y ?? 0);
    if (this._elValueOffsetX) this._elValueOffsetX.value = String(this._config.value_offset_x ?? 0);
    if (this._elValueOffsetY) this._elValueOffsetY.value = String(this._config.value_offset_y ?? 0);
    //v1.0.2

    if (this._elCardWidth) this._elCardWidth.value = this._config.card_width || "";
    if (this._elCardHeight) this._elCardHeight.value = this._config.card_height || "";

    this._elValuePos.value = this._config.value_position || "top_right";

    this._swGlass.checked = !!this._config.glass;
    this._swScale.checked = !!this._config.show_scale;
    if (this._swFanFrame) this._swFanFrame.checked = !!this._config.fan_show_frame;

    // Fan: show frame toggle instead of show_scale
    const symNow2 = String(this._config.symbol || "battery_liquid");
    const isFan = (symNow2 === "fan");
    if (this._ffShowScale) this._ffShowScale.style.display = isFan ? "none" : "";
    if (this._ffFanFrame) this._ffFanFrame.style.display = isFan ? "" : "none";
    this._swStats.checked = !!this._config.show_stats;

    if (this._swOutline) this._swOutline.checked = !!this._config.outline_value;

    const isSplit = (String(this._config.symbol || "battery_liquid") === "battery_splitted_segments" || String(this._config.symbol || "battery_liquid") === "battery_splitted_segments_modern");
    if (this._rowSplitLabels) {
      const showLbl = isSplit && !!this._config.show_split_entity_names;
      this._rowSplitLabels.style.display = showLbl ? "" : "none";
      if (this._elSplitLabel1) this._elSplitLabel1.value = this._config.split_label1 || "";
      if (this._elSplitLabel2) this._elSplitLabel2.value = this._config.split_label2 || "";
    }

    if (this._swSplitNames) {
      this._swSplitNames.checked = !!this._config.show_split_entity_names;
      // show only for split battery
      const ff = this._swSplitNames.closest("ha-formfield") || this._swSplitNames.parentElement;
      if (ff) ff.style.display = isSplit ? "" : "none";
    }

    this._elOrientation.value = this._config.orientation || "vertical";
    this._elScaleMode.value = this._config.scale_color_mode || "per_interval";

    // Segment gap only relevant for segment symbols
    if (this._elSegmentGap) {
      const symNow = String(this._config.symbol || "battery_liquid");
      const isSeg = (symNow === "battery_segments" || symNow === "battery_splitted_segments" || symNow === "water_level_segments" || symNow === "silo");
      this._elSegmentGap.style.display = isSeg ? "" : "none";
      this._elSegmentGap.value = String(this._config.segment_gap ?? "");
    }

    this._elStatsHours.style.display = this._config.show_stats ? "" : "none";
    this._elStatsHours.value = String(this._config.stats_hours ?? 24);

    this._renderIntervals();
    this._renderBadgesList();
    this._renderDraft();
  }

  _renderIntervals() {
    const list = this._intervalList;
    list.innerHTML = "";

    const intervals = (this._config.intervals || []).map(normalizeInterval).sort((a, b) => a.to - b.to);

    intervals.forEach((it) => {
      const row = document.createElement("div");
      row.className = "intervalItem";

      const badgeFill = document.createElement("div");
      badgeFill.className = "badge";
      badgeFill.style.background = it.gradient?.enabled ? `linear-gradient(${it.gradient.from}, ${it.gradient.to})` : it.color;

      const badgeOutline = document.createElement("div");
      badgeOutline.className = "badge";
      badgeOutline.style.background = it.outline;

      const badgeScale = document.createElement("div");
      badgeScale.className = "badge";
      badgeScale.style.background = it.scale_color || it.color;

      const text = document.createElement("div");
      text.className = "itText";
      const titleTxt = (it.match && String(it.match).trim()) ? `= ${String(it.match).trim()}` : `≤ ${it.to}`;
      const secTxt = (it.seconds != null && Number.isFinite(Number(it.seconds))) ? ` • Seconds: ${Number(it.seconds)}` : "";
      text.innerHTML = `
        <div class="itTitle">${titleTxt}</div>
        <div class="itSub">Fill: ${it.gradient?.enabled ? `${it.gradient.from} → ${it.gradient.to}` : it.color} • Outline: ${it.outline} • Scale: ${it.scale_color || it.color}${secTxt}</div>
      `;

      const btns = document.createElement("div");
      btns.className = "btns";

      const bEdit = document.createElement("button");
      bEdit.setAttribute("unelevated", "");
      bEdit.classList.add("haPrimary");
      bEdit.innerText = "Edit";
      bEdit.addEventListener("click", (e) => { e.stopPropagation(); this._startEdit(it.id); });

      const bDel = document.createElement("button");
      bDel.setAttribute("unelevated", "");
      bDel.classList.add("haPrimary");
      bDel.innerText = "Delete";
      bDel.addEventListener("click", (e) => { e.stopPropagation(); this._deleteInterval(it.id); });

      const bDup = document.createElement("button");
      bDup.setAttribute("unelevated", "");
      bDup.classList.add("haPrimary");
      bDup.innerText = "Duplicate";
      bDup.addEventListener("click", (e) => { e.stopPropagation(); this._duplicateInterval(it.id); });

      btns.appendChild(bEdit);
      btns.appendChild(bDel);
      btns.appendChild(bDup);

      const wrap = document.createElement("div");
      wrap.className = "itWrap";
      wrap.appendChild(text);
      wrap.appendChild(btns);

      row.appendChild(badgeFill);
      row.appendChild(badgeOutline);
      row.appendChild(badgeScale);
      row.appendChild(wrap);

      list.appendChild(row);
    });
  }

  _startAdd() {
    this._editingId = null;
    this._draft = normalizeInterval({
      id: uid("it"),
      to: 0,
      color: "#22c55e",
      outline: "#ffffff",
      scale_color: "#22c55e",
      gradient: { enabled: false, from: "#22c55e", to: "#22c55e" }
    });
    this._renderDraft(true);
  }

  _startEdit(id) {
    const it = (this._config.intervals || []).map(normalizeInterval).find(x => x.id === id);
    this._editingId = id;
    this._draft = normalizeInterval(deepClone(it || {}));
    this._renderDraft(true);
  }

  _deleteInterval(id) {
    const next = (this._config.intervals || []).map(normalizeInterval).filter((x) => x.id !== id);
    this._commit("intervals", next.map(normalizeInterval));
  }

  _duplicateInterval(id) {
    const cur = (this._config.intervals || []).map(normalizeInterval);
    const idx = cur.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const copy = normalizeInterval(deepClone(cur[idx]));
    copy.id = uid("it");
    cur.splice(idx + 1, 0, copy);
    this._commit("intervals", cur.map(normalizeInterval));
  }

  _closeDraft() {
    this._draft = null;
    this._editingId = null;
    this._renderDraft(false);
  }

  _saveDraft() {
    if (!this._draft) return;
    const d = normalizeInterval(this._draft);
    const cur = (this._config.intervals || []).map(normalizeInterval);

    const idx = cur.findIndex(x => x.id === d.id);
    if (idx === -1) cur.push(d);
    else cur[idx] = d;

    this._commit("intervals", cur.map(normalizeInterval));
    this._closeDraft();
  }

  _renderDraft(forceShow) {
    const box = this._draftBox;
    if (!this._draft) {
      box.classList.remove("show");
      box.innerHTML = "";
      return;
    }
    if (forceShow) box.classList.add("show");

    box.innerHTML = "";

    const head = document.createElement("div");
    head.className = "draftHead";
    head.innerHTML = `<div>${this._editingId == null ? "Add interval" : "Edit interval"}</div>`;
    const btnClose = document.createElement("button");
    btnClose.setAttribute("unelevated", "");
    btnClose.classList.add("haPrimary");
    btnClose.innerText = "Close";
    btnClose.addEventListener("click", (e) => { e.stopPropagation(); this._closeDraft(); });
    head.appendChild(btnClose);
    box.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "draftGrid2";

    const _symNow = String(this._config?.symbol || "");
    const showSeconds = (_symNow === "garage_door" || _symNow === "washing_machine" || _symNow === "tumble_dryer");

    // Optional static match (exact match, case-insensitive) for non-numeric states
    const tfMatch = document.createElement("ha-textfield");
    tfMatch.label = "Match value (optional)";
    tfMatch.placeholder = "e.g. on / off / open / closed / normal";
    tfMatch.value = String(this._draft.match ?? "");
    tfMatch.addEventListener("input", (e) => {
      e.stopPropagation();
      this._draft.match = String(tfMatch.value || "").trim();
    });
    grid.appendChild(tfMatch);

    // Numeric upper bound (default behaviour)
    const tfTo = document.createElement("ha-textfield");
    tfTo.type = "number";
    tfTo.label = "Up to value";
    tfTo.step = "0.1";
    tfTo.value = String(this._draft.to ?? 0);
    tfTo.addEventListener("input", (e) => { e.stopPropagation(); this._draft.to = parseFloat(tfTo.value); });
    grid.appendChild(tfTo);

    // New value (optional) -> overrides the displayed value on the main card when this interval is active
    const tfNewVal = document.createElement("ha-textfield");
    tfNewVal.label = "New value (optional) support variables. Replaces card value";
    tfNewVal.placeholder = "e.g. High temperature: <value>";
    tfNewVal.helperText = "If set, this replaces the value text shown on the card for this interval. Supports <value>, <state>, <name>, <unit>, <attr:xxx>, etc.";
    tfNewVal.persistentHelperText = true;
    tfNewVal.value = String(this._draft.new_value ?? "");
    tfNewVal.style.gridColumn = "1 / -1";
    tfNewVal.addEventListener("input", (e) => { e.stopPropagation(); this._draft.new_value = tfNewVal.value; });
    grid.appendChild(tfNewVal);

    // Per-section seconds (only shown for Garage door)
    if (showSeconds) {
      const tfSec = document.createElement("ha-textfield");
      tfSec.type = "number";
      tfSec.label = "Seconds to open this segment";
      tfSec.step = "0.1";
      tfSec.placeholder = "e.g. 2";
      tfSec.value = (this._draft.seconds == null) ? "" : String(this._draft.seconds);
      tfSec.addEventListener("input", (e) => {
        e.stopPropagation();
        const v = parseFloat(tfSec.value);
        this._draft.seconds = (Number.isFinite(v) && v > 0) ? v : null;
      });
      grid.appendChild(tfSec);
    }

    const ffGrad = document.createElement("ha-formfield");
    ffGrad.label = "Enable gradient";
    const swGrad = document.createElement("ha-switch");
    swGrad.checked = !!(this._draft.gradient && this._draft.gradient.enabled);
    swGrad.addEventListener("change", (e) => {
      e.stopPropagation();
      this._draft.gradient = this._draft.gradient || {};
      this._draft.gradient.enabled = !!swGrad.checked;
      this._renderDraft(true);
    });
    ffGrad.appendChild(swGrad);
    grid.appendChild(ffGrad);

    box.appendChild(grid);

    // Local bubble stopper for draft UI (prevents HA from closing popovers / stealing focus)
    const stopDraftBubble = (e) => {
      try { e.stopPropagation(); } catch (_) {}
      try { e.stopImmediatePropagation?.(); } catch (_) {}
    };

    const mkDraftColor = (label, getVal, setVal) => {
      const row = document.createElement("div");
      row.className = "colorRow";

      const tf = document.createElement("ha-textfield");
      tf.label = label;
      tf.placeholder = "#RRGGBB";
      tf.addEventListener("click", stopDraftBubble, true);
      tf.addEventListener("focusin", stopDraftBubble, true);

      const btn = document.createElement("input");
      btn.type = "color";
      btn.className = "colorBtn";
      // Without stopping these, HA/Lovelace may treat the click as "outside" and
      // close the native color picker or move focus away from the textfield.
      btn.addEventListener("mousedown", stopDraftBubble, true);
      btn.addEventListener("click", stopDraftBubble, true);

      const cur = normalizeHex(getVal(), "#ffffff");
      tf.value = cur.toUpperCase();
      btn.value = cur;

      tf.addEventListener("change", (e) => {
        e.stopPropagation();
        const n = normalizeHex(tf.value, cur).toUpperCase();
        tf.value = n;
        btn.value = n;
        setVal(n);
      });

      btn.addEventListener("input", (e) => {
        stopDraftBubble(e);
        const n = String(btn.value || cur).toUpperCase();
        tf.value = n;
        setVal(n);
      });

      row.appendChild(tf);
      row.appendChild(btn);
      return row;
    };

    box.appendChild(mkDraftColor("Fill color (HEX)", () => this._draft.color, (v) => { this._draft.color = v; }));
    box.appendChild(mkDraftColor("Outline color (HEX)", () => this._draft.outline, (v) => { this._draft.outline = v; }));
    box.appendChild(mkDraftColor("Scale color (HEX)", () => this._draft.scale_color, (v) => { this._draft.scale_color = v; }));

    if (this._draft.gradient?.enabled) {
      box.appendChild(mkDraftColor(
        "Gradient from (HEX)",
        () => this._draft.gradient?.from,
        (v) => { this._draft.gradient = this._draft.gradient || {}; this._draft.gradient.from = v; }
      ));
      box.appendChild(mkDraftColor(
        "Gradient to (HEX)",
        () => this._draft.gradient?.to,
        (v) => { this._draft.gradient = this._draft.gradient || {}; this._draft.gradient.to = v; }
      ));
    }


    const actions = document.createElement("div");
    actions.className = "draftActions";

    const btnCancel = document.createElement("button");
    btnCancel.setAttribute("unelevated", "");
    btnCancel.classList.add("haPrimary");
    btnCancel.innerText = "Cancel";
    btnCancel.addEventListener("click", (e) => { e.stopPropagation(); this._closeDraft(); });

    const btnSave = document.createElement("button");
    btnSave.setAttribute("unelevated", "");
    btnSave.classList.add("haPrimary");
    btnSave.innerText = "Save";
    btnSave.addEventListener("click", (e) => { e.stopPropagation(); this._saveDraft(); });

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    box.appendChild(actions);

      }  // =========================
  // Badges (global overlay)
  // =========================
  _renderBadgesList() {
    if (!this._badgeList) return;
    const list = this._badgeList;
    list.innerHTML = "";

    const items = Array.isArray(this._config?.badges) ? this._config.badges.map(normalizeBadge) : [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "itSub";
      empty.innerText = "No badges yet. Click + Add to create one.";
      list.appendChild(empty);
      return;
    }

    items.forEach((b) => {
      const row = document.createElement("div");
      row.className = "badgeItem";

      const prev = document.createElement("div");
      prev.className = "bdgPreview";
      if (b.icon) {
        const ic = document.createElement("ha-icon");
        ic.icon = b.icon;
        prev.appendChild(ic);
      } else {
        prev.innerText = "•";
      }
      row.appendChild(prev);

      const text = document.createElement("div");
      text.className = "itText";
      const title = document.createElement("div");
      title.className = "itTitle";
      title.innerText = (b.title || b.entity || "(no entity) - Must choose entity");
      const sub = document.createElement("div");
      sub.className = "itSub";
      sub.innerText = `${b.title ? `Entity: ${b.entity || '(none)'}  •  ` : ''}x:${Math.round(b.x)}  y:${Math.round(b.y)}  •  ${b.style}`;
      text.appendChild(title);
      text.appendChild(sub);
      row.appendChild(text);

      const btns = document.createElement("div");
      btns.className = "btns";

      const btnEdit = document.createElement("button");
      btnEdit.setAttribute("unelevated", "");
      btnEdit.classList.add("haPrimary");
      btnEdit.innerText = "Edit";
      btnEdit.addEventListener("click", (e) => { e.stopPropagation(); this._startEditBadge(b.id); });

      const btnDel = document.createElement("button");
      btnDel.setAttribute("unelevated", "");
      btnDel.classList.add("haPrimary");
      btnDel.innerText = "Delete";
      btnDel.addEventListener("click", (e) => { e.stopPropagation(); this._deleteBadge(b.id); });

      const btnDup = document.createElement("button");
      btnDup.setAttribute("unelevated", "");
      btnDup.classList.add("haPrimary");
      btnDup.innerText = "Duplicate";
      btnDup.addEventListener("click", (e) => { e.stopPropagation(); this._duplicateBadge(b.id); });

      btns.appendChild(btnEdit);
      btns.appendChild(btnDel);
      btns.appendChild(btnDup);

const mini = this._makeBadgeMiniPreviewEl(b);
if (mini) {
  mini.classList.add("badgeMiniSlot");
  row.appendChild(mini);
}

      // Buttons under title/sub (easier to scan)
      text.appendChild(btns);

      list.appendChild(row);
    });
  }


_suggestBadgeTitle(entityId) {
  try {
    const id = String(entityId || "").trim();
    if (!id || !id.includes(".")) return "";
    const st = this._hass?.states?.[id];
    const domain = id.split(".")[0] || "";
    const dc = String(st?.attributes?.device_class || "").trim();

    const dcMap = {
      battery: "Batteri",
      temperature: "Temperatur",
      humidity: "Fukt",
      power: "Effekt",
      energy: "Energi",
      voltage: "Spänning",
      current: "Ström",
      pressure: "Tryck",
      illuminance: "Ljus",
      motion: "Rörelse",
      door: "Dörr",
      window: "Fönster",
      opening: "Öppning",
      connectivity: "Uppkoppling",
      signal_strength: "Signal",
    };

    let base = dcMap[dc] || "";
    const fname = String(st?.attributes?.friendly_name || "");
    const hay = (id + " " + fname).toLowerCase();
    if (!base) {
      if (hay.includes("battery") || hay.includes("batt") || hay.includes("batteri")) base = "Batteri";
      else if (hay.includes("temp") || hay.includes("temperatur")) base = "Temperatur";
      else if (hay.includes("humidity") || hay.includes("fukt")) base = "Fukt";
      else if (hay.includes("power") || hay.includes("effekt") || hay.includes("watt")) base = "Effekt";
      else if (hay.includes("energy") || hay.includes("energi") || hay.includes("kwh")) base = "Energi";
    }
    if (!base) {
      base = domain ? (domain.charAt(0).toUpperCase() + domain.slice(1)) : "Badge";
    }
    return `${base} sensor`;
  } catch (e) {
    return "";
  }
}



  _findHuiDialogEditCard() {
    try {
      // First try standard closest (works when we are in light DOM)
      const c = this.closest?.("hui-dialog-edit-card");
      if (c) return c;
    } catch (e) {}

    // Fallback: walk up across shadow roots
    let el = this;
    for (let i = 0; i < 25; i++) {
      if (!el) break;
      try {
        if (el.tagName && String(el.tagName).toLowerCase() === "hui-dialog-edit-card") return el;
      } catch (e) {}
      const root = el.getRootNode?.();
      el = el.parentNode || root?.host || null;
    }
    return null;
  }

  _deepQueryAll(root, selector, out = []) {
    try {
      if (!root) return out;
      const node = root instanceof ShadowRoot ? root : (root.getRootNode ? root.getRootNode() : root);
      const base = (root instanceof ShadowRoot) ? root : root;
      try {
        base.querySelectorAll?.(selector)?.forEach((el) => out.push(el));
      } catch (e) {}

      // Walk all elements and dive into shadow roots
      const all = [];
      try { base.querySelectorAll?.("*")?.forEach((el) => all.push(el)); } catch (e) {}
      for (const el of all) {
        try {
          if (el.shadowRoot) this._deepQueryAll(el.shadowRoot, selector, out);
        } catch (e) {}
      }
    } catch (e) {}
    return out;
  }

  _findPreviewCardElement() {
    try {
      const dlg = this._findHuiDialogEditCard();
      if (!dlg) return null;

      // Prefer the card in the preview area (NOT the editor)
      const matches = this._deepQueryAll(dlg, CARD_TAG, []);
      if (!matches || !matches.length) return null;

      // Pick the first card that isn't this editor and has a shadowRoot with ha-card
      for (const el of matches) {
        if (!el || el === this) continue;
        const sr = el.shadowRoot;
        if (sr && sr.querySelector && sr.querySelector("ha-card")) return el;
      }
      // Fallback: first match
      return matches[0] || null;
    } catch (e) {
      return null;
    }
  }

_panPreviewToBadge(badge) {
  try {
    const b = normalizeBadge(badge || {});
    if (!b.id) return;
    this._scheduleCenterBadgePreview(b);
  } catch (e) {}
}

  _unmountBadgeNudgeControls() {
    try {
      if (this._badgeNudgeHost && this._badgeNudgeHost.parentElement) {
        this._badgeNudgeHost.parentElement.removeChild(this._badgeNudgeHost);
      }
    } catch (e) {}
    this._badgeNudgeHost = null;
    this._badgeNudgeEl = null;
  }

  _mountBadgeNudgeControls(nudgeWrapEl) {
    // Remove any previous mount
    this._unmountBadgeNudgeControls();

    // Safe fallback: ensure the controls always end up visible somewhere
    const fallback = () => {
      try {
        if (this._badgeDraftBox && !nudgeWrapEl.isConnected) this._badgeDraftBox.appendChild(nudgeWrapEl);
      } catch (e) {}
      this._badgeNudgeEl = nudgeWrapEl;
    };

    const dlg = this._findHuiDialogEditCard();
    const dlgSr = dlg?.shadowRoot || null;
    if (!dlgSr) {
      fallback();
      return;
    }

    // Inject styles (scoped to the dialog shadow root)
    let st = dlgSr.getElementById?.("asc-badge-nudge-style");
    if (!st) {
      st = document.createElement("style");
      st.id = "asc-badge-nudge-style";
      st.textContent = `
        #asc-badge-nudge-host{
          display:flex;
          justify-content:center;
          padding: 10px 0 0 0;
        }
        #asc-badge-nudge-host .badgeNudgeWrap{
          width: fit-content;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(0,0,0,0.04);
        }
        #asc-badge-nudge-host .badgeNudgeTitle{
          font-weight: 800;
          text-align: center;
          font-size: 12px;
          opacity: .85;
          margin-bottom: 8px;
        }
        #asc-badge-nudge-host .badgeNudgeGrid{
          display:grid;
          grid-template-columns: 38px 38px 38px;
          grid-template-rows: 38px 38px 38px;
          gap: 8px;
          align-items:center;
          justify-items:center;
        }
        #asc-badge-nudge-host .badgeNudgeBtn{
          width: 38px;
          height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.16);
          background: var(--card-background-color, rgba(255,255,255,0.7));
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
        }
        #asc-badge-nudge-host .badgeNudgeBtn:hover{
          background: var(--card-background-color, rgba(255,255,255,0.95));
        }
        #asc-badge-nudge-host .badgeNudgeBtn ha-icon{
          --mdc-icon-size: 20px;
          opacity: .9;
        }
        #asc-badge-nudge-host .badgeNudgeMid{
          font-weight: 800;
          font-size: 12px;
          opacity: .8;
          user-select: none;
        }
      `;
      try { dlgSr.appendChild(st); } catch (e) {}
    }

    // Find preview element and insert the host directly UNDER it (in the right pane)
    // Home Assistant's editor dialog structure has varied over time, so we search a few shadow roots.
    const roots = [dlgSr];
    try {
      const haDlg = dlgSr.querySelector?.("ha-dialog");
      if (haDlg && haDlg.shadowRoot) roots.push(haDlg.shadowRoot);
    } catch (e) {}
    try {
      const haModal = dlgSr.querySelector?.("ha-modal-dialog");
      if (haModal && haModal.shadowRoot) roots.push(haModal.shadowRoot);
    } catch (e) {}

    let previewEl = null;
    let container = null;
    for (const r of roots) {
      try {
        const p = r?.querySelector?.("hui-card-preview");
        if (p) {
          previewEl = p;
          container = p.closest?.(".preview") || p.parentElement || null;
          break;
        }
      } catch (e) {}
    }

    if (!previewEl || !container) {
      fallback();
      return;
    }

    const host = document.createElement("div");
    host.id = "asc-badge-nudge-host";
    host.appendChild(nudgeWrapEl);

    try {
      // Insert right after the preview element
      if (previewEl.nextSibling) container.insertBefore(host, previewEl.nextSibling);
      else container.appendChild(host);
    } catch (e) {
      try { container.appendChild(host); } catch (e2) {}
    }

    // If something went wrong and we still don't have it connected, fall back to left panel
    if (!host.isConnected) {
      try { host.remove?.(); } catch (e) {}
      fallback();
      return;
    }

    this._badgeNudgeHost = host;
    this._badgeNudgeEl = nudgeWrapEl;
  }

_makeBadgeMiniPreviewEl(badge) {
  // Mini preview for the badge list:
  // Must be self-contained (no reliance on card CSS), but should reflect style/colors/icon/text.
  try {
    const b = normalizeBadge(badge || {});
    const wrap = document.createElement("div");
    wrap.className = "badgeMiniPreview";

    // Local template helper (editor cannot rely on the card instance methods)
    const badgeValueText = (entityId, decimals) => {
      const st = this._hass?.states?.[entityId];
      if (!st) return entityId ? "<value>" : "";
      const raw = st.state;
      const unit = String(st.attributes?.unit_of_measurement || "");
      const num = toNumberMaybe(raw);
      let txt = "";
      if (Number.isFinite(num)) {
        const dec = (decimals == null || decimals === "") ? 0 : Number(decimals);
        const d = Number.isFinite(dec) ? Math.max(0, Math.min(6, dec)) : 0;
        txt = fmtNumLocale(num, d, this._hass?.locale?.language);
      } else {
        txt = String(raw);
      }
      if (unit) txt = `${txt} ${unit}`.trim();
      return txt;
    };

    const fmtIsoLocal = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      const locale = this._hass?.locale?.language || "sv-SE";
      return d.toLocaleString(locale);
    };
    const fmtIsoRelative = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      const t = d.getTime();
      if (Number.isNaN(t)) return "";
      const diffMs = Date.now() - t;
      const absMs = Math.abs(diffMs);
      const sec = Math.round(absMs / 1000);
      const min = Math.round(sec / 60);
      const hr = Math.round(min / 60);
      const day = Math.round(hr / 24);
      let s = "";
      if (sec < 60) s = `${sec}s`;
      else if (min < 60) s = `${min}m`;
      else if (hr < 48) s = `${hr}h`;
      else s = `${day}d`;
      return diffMs >= 0 ? `${s} ago` : `in ${s}`;
    };
    const applyTpl = (entityId, template, opts = {}) => {
      if (template == null) return "";
      const s = String(template);
      if (!s.includes("<")) return s;

      const st = entityId ? this._hass?.states?.[entityId] : null;

      const valueTxt = (opts.valueTextOverride != null)
        ? String(opts.valueTextOverride)
        : badgeValueText(entityId, opts.decimals);

      const stateTxt = st ? String(st.state ?? "") : "—";
      const unitTxt  = st ? String(st.attributes?.unit_of_measurement ?? "") : "";
      const nameTxt  = st ? String(st.attributes?.friendly_name ?? entityId ?? "") : String(entityId ?? "");
      const idTxt    = String(entityId ?? "");
      const domainTxt = idTxt.includes(".") ? idTxt.split(".", 1)[0] : "";
      const lcIso = st ? String(st.last_changed ?? "") : "";
      const luIso = st ? String(st.last_updated ?? "") : "";

      let out = s;

      // Attributes: <attr:foo>
      out = out.replace(/<attr:([a-zA-Z0-9_]+)>/gi, (_, key) => {
        if (!st) return "";
        const v = st.attributes?.[key];
        if (v == null) return "";
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
        try { return JSON.stringify(v); } catch (e) { return String(v); }
      });

      // Simple tokens
      out = out.replace(/<value>/gi, valueTxt);
      out = out.replace(/<state>/gi, stateTxt);
      out = out.replace(/<name>/gi, nameTxt);
      out = out.replace(/<unit>/gi, unitTxt);
      out = out.replace(/<entity_id>/gi, idTxt);
      out = out.replace(/<domain>/gi, domainTxt);

      out = out.replace(/<last_changed_rel>/gi, fmtIsoRelative(lcIso));
      out = out.replace(/<last_updated_rel>/gi, fmtIsoRelative(luIso));
      out = out.replace(/<last_changed_iso>/gi, lcIso);
      out = out.replace(/<last_updated_iso>/gi, luIso);
      out = out.replace(/<last_changed>/gi, fmtIsoLocal(lcIso));
      out = out.replace(/<last_updated>/gi, fmtIsoLocal(luIso));

      return out;
    };

    // --- helpers ---
    const clamp01 = (v) => Math.max(0, Math.min(1, Number(v)));
    const intervalBg = (it) => {
      if (!it) return null;
      const g = it.gradient;
      if (g && g.enabled && g.from && g.to) return `linear-gradient(90deg, ${g.from}, ${g.to})`;
      return it.color || null;
    };

    const findInterval = (entityId, intervals) => {
      if (!entityId || !Array.isArray(intervals) || !intervals.length) return null;
      const st = this._hass?.states?.[entityId];
      if (!st) return null;

      const rawS = String(st.state ?? "").trim();
      const rawSL = rawS.toLowerCase();

      // Static match first
      for (const it0 of intervals) {
        const it = normalizeInterval(it0);
        const m = String(it.match || "").trim();
        if (m && rawSL === m.toLowerCase()) return it;
      }

      // Numeric threshold
      let v = toNumberMaybe(st.state);
      if (!Number.isFinite(v)) {
        const onLike = (rawSL === "on" || rawSL === "true" || rawSL === "1" || rawSL === "charging" || rawSL === "yes" || rawSL === "open" || rawSL === "home" || rawSL === "playing");
        v = onLike ? 1 : 0;
      }
      for (const it0 of intervals) {
        const it = normalizeInterval(it0);
        if (Number(v) <= Number(it.to)) return it;
      }
      return normalizeInterval(intervals[intervals.length - 1]);
    };

    const iconColorFromState = (entityId) => {
      const st = this._hass?.states?.[entityId];
      if (!st) return null;
      const num = toNumberMaybe(st.state);
      if (Number.isFinite(num)) return (num > 0) ? "#EFC701" : null;
      const s = String(st.state || "").trim().toLowerCase();
      const onLike = (s === "on" || s === "true" || s === "1" || s === "charging" || s === "yes" || s === "open" || s === "home" || s === "playing");
      return onLike ? "#EFC701" : null;
    };

    const it = findInterval(b.entity, b.intervals);
    const baseValueTxt = badgeValueText(b.entity, b.decimals);

    // value override for <value> (interval)
    const valueTxt = (it && it.new_value != null && String(it.new_value).trim() !== "")
      ? applyTpl(b.entity, String(it.new_value), { decimals: b.decimals, valueTextOverride: baseValueTxt })
      : baseValueTxt;

    const label = applyTpl(b.entity, (b.label ?? "<value>"), { decimals: b.decimals, valueTextOverride: valueTxt });

    // icon override (interval)
    const iconUse = (it && it.icon != null && String(it.icon).trim() !== "")
      ? String(it.icon).trim()
      : String(b.icon || "").trim();

    // --- resolve colors similar to the card ---
    const itBg = intervalBg(it);
    const itStroke = (it && (it.outline || it.color)) ? (it.outline || it.color) : null;
    const itSolid = (it && it.color) ? it.color : null;

    let bg = b.bg_color || "rgba(0,0,0,0.65)";
    let brd = b.border_color || "rgba(255,255,255,0.18)";
    let txt = b.text_color || "#ffffff";

    // Apply interval overrides depending on style
    const style = String(b.style || "solid");
    if (it) {
      if (style === "none") {
        txt = itSolid || txt;
        bg = "transparent";
        brd = "transparent";
      } else if (style === "outline") {
        brd = itStroke || brd;
        bg = "transparent";
      } else {
        bg = itBg || itSolid || bg;
        brd = itStroke || brd;
      }
    } else {
      if (style === "none") { bg = "transparent"; brd = "transparent"; }
      if (style === "outline") { bg = "transparent"; }
    }

    // Icon color rules
    const iconColor = (it && it.icon_color && String(it.icon_color).trim())
      ? String(it.icon_color).trim()
      : (it ? txt : ((b.icon_color_by_state) ? (iconColorFromState(b.entity) || txt) : txt));

    const op = Number.isFinite(Number(b.opacity)) ? clamp01(Number(b.opacity)) : 1;

    // --- build compact pill ---
    const pill = document.createElement("div");
    pill.setAttribute("style", [
      "display:inline-flex",
      "align-items:center",
      "gap:6px",
      "max-width:120px",
      "padding:4px 8px",
      "border-radius:8px",
      `background:${bg}`,
      `border:1px solid ${brd}`,
      `color:${txt}`,
      "font-size:12px",
      "line-height:1",
      "box-sizing:border-box",
      (op < 1) ? `opacity:${op}` : ""
    ].join(";"));

    const showIcon = (typeof b.show_icon === "boolean") ? b.show_icon : true;
    const iconOnly = !!b.icon_only || !String(label || "").trim();

    if (showIcon && iconUse) {
      const ic = document.createElement("ha-icon");
      ic.setAttribute("icon", iconUse);
      ic.setAttribute("style", [
        `color:${iconColor}`,
        `--mdc-icon-size:${Number(b.icon_size) || 18}px`,
        "flex:0 0 auto"
      ].join(";"));
      pill.appendChild(ic);
    }

    if (!iconOnly) {
      const t = document.createElement("div");
      t.textContent = String(label || "");
      t.setAttribute("style", [
        "white-space:nowrap",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "max-width:90px"
      ].join(";"));
      pill.appendChild(t);
    }

    wrap.appendChild(pill);
    return wrap;
  } catch (e) {
    return null;
  }
}


  _startAddBadge() {
    this._badgeBackup = deepClone(Array.isArray(this._config?.badges) ? this._config.badges : []);
    this._badgeEditingId = null;
    this._badgeDraft = normalizeBadge({
      id: uid("bdg"),
      entity: "",
      x: 0,
      y: 50,
      opacity: 1,
      icon: "",
      show_icon: true,
      icon_only: false,
      label: "<value>",
      style: "glass",
      bg_color: "#000000",
      text_color: "#ffffff",
      border_color: "#ffffff",
      padding: 8,
      radius: 12,
      font_size: 12,
      icon_size: 18,
      fixed_width_px: null,
      decimals: null,
      tap_action: { action: "more-info", service: "", service_data: null },
    });
    this._badgeIntervalDraft = null;
    this._badgeIntervalEditingId = null;
    // Live preview: add/move badge immediately while editing (Cancel will revert)
    this._applyBadgeDraftPreview();
    this._renderBadgeDraft(true);
  }

  _startEditBadge(id) {
    this._badgeBackup = deepClone(Array.isArray(this._config?.badges) ? this._config.badges : []);
    const cur = Array.isArray(this._config?.badges) ? this._config.badges.map(normalizeBadge) : [];
    const found = cur.find(x => x.id === id);
    this._badgeEditingId = id;
    this._badgeDraft = normalizeBadge(deepClone(found || {}));
    this._badgeIntervalDraft = null;
    this._badgeIntervalEditingId = null;
    this._applyBadgeDraftPreview();
    this._renderBadgeDraft(true);
  }

  _deleteBadge(id) {
    const next = (this._config.badges || []).map(normalizeBadge).filter((x) => x.id !== id);
    this._commit("badges", next.map(normalizeBadge));
  }
  
_toNum(v, fallback = 0) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}  

  _duplicateBadge(id) {
    const cur = (this._config.badges || []).map(normalizeBadge);
    const idx = cur.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const copy = normalizeBadge(deepClone(cur[idx]));
    copy.id = uid("bdg");
    // Nudge so it doesn't land exactly on top of original
    copy.x = (Number(copy.x) || 0) + 5;
    copy.y = (Number(copy.y) || 0) + 5;
    cur.splice(idx + 1, 0, copy);
    this._commit("badges", cur.map(normalizeBadge));
  }

  _closeBadgeDraft() {
    this._badgeDraft = null;
    this._badgeEditingId = null;
    this._unmountBadgeNudgeControls();
    if (this._badgeDraftBox) {
      this._badgeDraftBox.classList.remove("show");
      this._badgeDraftBox.innerHTML = "";
    }
    this._badgeBackup = null;
  }

_cancelBadgeDraft() {
  // Revert any live preview changes made during editing
  if (this._badgeBackup) {
    this._commit("badges", (this._badgeBackup || []).map(normalizeBadge));
  }
  this._closeBadgeDraft();
}

_applyBadgeDraftPreview() {
  if (!this._badgeDraft) return;
  const base = Array.isArray(this._badgeBackup) ? deepClone(this._badgeBackup) : deepClone(Array.isArray(this._config?.badges) ? this._config.badges : []);
  const d = normalizeBadge(this._badgeDraft);
  const idx = base.map(normalizeBadge).findIndex(x => x.id === d.id);
  if (idx === -1) base.push(d);
  else base[idx] = d;
  this._commit("badges", base.map(normalizeBadge));
  // Auto-pan the preview (ha-card scroll) so the badge stays in view when it moves off-screen.
  // This avoids manual horizontal scrolling when the preview image/card is larger than the viewport.
  try { this._panPreviewToBadge(d); } catch (e) {}
}

  _saveBadgeDraft() {
    if (!this._badgeDraft) return;
    const d = normalizeBadge(this._badgeDraft);
    const cur = (this._config.badges || []).map(normalizeBadge);

    const idx = cur.findIndex(x => x.id === d.id);
    if (idx === -1) cur.push(d);
    else cur[idx] = d;

    this._commit("badges", cur.map(normalizeBadge));
    this._closeBadgeDraft();
  }

  _renderBadgeDraft(forceShow) {
    const box = this._badgeDraftBox;
    if (!box) return;

    if (!this._badgeDraft) {
      box.classList.remove("show");
      box.innerHTML = "";
      return;
    }
    if (forceShow) box.classList.add("show");

    box.innerHTML = "";

    const head = document.createElement("div");
    head.className = "draftHead";
    head.innerHTML = `<div>${this._badgeEditingId == null ? "Badge details (new)" : "Badge details (edit)"}</div>`;
    const btnClose = document.createElement("button");
    btnClose.setAttribute("unelevated", "");
    btnClose.classList.add("haPrimary");
    btnClose.innerText = "Close";
    btnClose.addEventListener("click", (e) => { e.stopPropagation(); this._cancelBadgeDraft(); });
    head.appendChild(btnClose);
    box.appendChild(head);


let tfTitle = null;

// Entity on its own row
const ent = document.createElement("ha-entity-picker");
ent.label = "Badge entity";
ent.allowCustomEntity = true;
ent.value = this._badgeDraft.entity || "";
ent.addEventListener("value-changed", (e) => {
  e.stopPropagation();
  this._badgeDraft.entity = e.detail?.value || "";
  // Live preview: show/hide badge instantly when selecting entity
  this._applyBadgeDraftPreview();
// Auto-suggest a badge title when creating a new badge (only if title is empty).
// This is just a suggestion; the user can rename it anytime.
if (this._badgeDraft && (!this._badgeDraft.title || String(this._badgeDraft.title).trim() === "")) {
  const suggested = this._suggestBadgeTitle(this._badgeDraft.entity);
  if (suggested) {
    this._badgeDraft.title = suggested;
    if (tfTitle) tfTitle.value = suggested;
    this._renderBadgesList();
  }
}
});
ent.addEventListener("click", (e) => e.stopPropagation());
if (this._hass) ent.hass = this._hass;
box.appendChild(ent);

tfTitle = document.createElement("ha-textfield");
tfTitle.label = "Badge title (optional)";
tfTitle.helperText = "Shown in the badge list (helps you keep track).";
tfTitle.value = this._badgeDraft.title || "";
tfTitle.addEventListener("input", (e) => {
  e.stopPropagation();
  this._badgeDraft.title = tfTitle.value || "";
  // Live update list label
  this._renderBadgesList();
});
tfTitle.addEventListener("click", (e) => e.stopPropagation());
box.appendChild(tfTitle);

// Label + Icon on one row
const rowLI = document.createElement("div");
rowLI.className = "draftGrid2";

const tfLabel = document.createElement("ha-textfield");
tfLabel.label = "Label and variables";
tfLabel.helperText = "Use variables listed below, e.g. <value>, <name>, <last_changed_rel>, <attr:xxx>.";
tfLabel.persistentHelperText = true;
tfLabel.value = String(this._badgeDraft.label ?? "<value>");
tfLabel.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.label = tfLabel.value; this._applyBadgeDraftPreview(); updateAnimVisibility(); });
rowLI.appendChild(tfLabel);

let iconEl = null;
if (customElements.get("ha-icon-picker")) {
  iconEl = document.createElement("ha-icon-picker");
  iconEl.label = "Icon";
  iconEl.value = this._badgeDraft.icon || "";
  iconEl.addEventListener("value-changed", (e) => { e.stopPropagation(); this._badgeDraft.icon = e.detail?.value || ""; this._applyBadgeDraftPreview(); updateAnimVisibility(); });
  if (this._hass) iconEl.hass = this._hass;
} else {
  iconEl = document.createElement("ha-textfield");
  iconEl.label = "Icon (mdi:...)";
  iconEl.value = this._badgeDraft.icon || "";
  iconEl.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.icon = iconEl.value; this._applyBadgeDraftPreview(); updateAnimVisibility(); });
}
rowLI.appendChild(iconEl);

box.appendChild(rowLI);



// X/Y on one row (percent of card). Negative allowed.
const rowXY = document.createElement("div");
rowXY.className = "draftGrid2";

const tfX = document.createElement("ha-textfield");
tfX.type = "number";
tfX.label = "Position X (%)";
tfX.step = "1";
tfX.helperText = "Horizontal position as % of the card. 0–100 is inside. Negative allowed.";
tfX.persistentHelperText = true;
tfX.value = String(this._badgeDraft.x ?? 0);
tfX.addEventListener("input", (e) => {
  e.stopPropagation();
  //this._badgeDraft.x = Number(tfX.value);
  this._badgeDraft.y = this._toNum(tfX.value, 0);
  this._applyBadgeDraftPreview(); // move instantly
});
rowXY.appendChild(tfX);

const tfY = document.createElement("ha-textfield");
tfY.type = "number";
tfY.label = "Position Y (%)";
tfY.step = "1";
tfY.helperText = "Vertical position as % of the card. 0–100 is inside. Negative allowed.";
tfY.persistentHelperText = true;
tfY.value = String(this._badgeDraft.y ?? 0);
tfY.addEventListener("input", (e) => {
  e.stopPropagation();
  this._badgeDraft.y = this._toNum(tfY.value, 0);
  //this._badgeDraft.y = Number(tfY.value);
  this._applyBadgeDraftPreview(); // move instantly
});
rowXY.appendChild(tfY);

box.appendChild(rowXY);

const nudgeWrap = document.createElement("div");
nudgeWrap.className = "badgeNudgeWrap";

const nudgeTitle = document.createElement("div");
nudgeTitle.className = "badgeNudgeTitle";
nudgeTitle.innerText = "Badge position X, Y control";
nudgeWrap.appendChild(nudgeTitle);

const nudgeGrid = document.createElement("div");
nudgeGrid.className = "badgeNudgeGrid";

const mkNudgeBtn = (icon, label, dx, dy) => {
  const btn = document.createElement("button");
  btn.className = "badgeNudgeBtn";
  btn.setAttribute("unelevated", "");
  btn.setAttribute("aria-label", label);
  const ic = document.createElement("ha-icon");
  ic.setAttribute("icon", icon);
  btn.appendChild(ic);
  
  //2026-02-05 Added exception handler if something goes wrong while clicking / moving badge
  btn.addEventListener("click", (e) => {
  try {
    e.stopPropagation();
    e.preventDefault();

    if (!this._badgeDraft) return;

    const x0 = this._toNum(this._badgeDraft.x, 0);
    const y0 = this._toNum(this._badgeDraft.y, 0);

    const x1 = x0 + dx;
    const y1 = y0 + dy;

    this._badgeDraft.x = x1;
    this._badgeDraft.y = y1;

    if (tfX) tfX.value = String(x1);
    if (tfY) tfY.value = String(y1);

    this._applyBadgeDraftPreview?.();
    this._renderBadgesList?.();
  } catch (err) {
    console.warn("ASC: badge nudge click failed", err);
  }
  });
  
  
  /* No exception handler
  
  /*
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!this._badgeDraft) return;
    const x0 = Number(this._badgeDraft.x ?? 0);
    const y0 = Number(this._badgeDraft.y ?? 0);
    this._badgeDraft.x = x0 + dx;
    this._badgeDraft.y = y0 + dy;
    tfX.value = String(this._badgeDraft.x);
    tfY.value = String(this._badgeDraft.y);
    this._applyBadgeDraftPreview();
    this._renderBadgesList();
  });*/
  return btn;
};

// Layout: 3x3 grid (up in the middle, left/right in the center row, down in the middle)
nudgeGrid.appendChild(document.createElement("div"));
nudgeGrid.appendChild(mkNudgeBtn("mdi:arrow-up", "Move up", 0, -1));
nudgeGrid.appendChild(document.createElement("div"));

nudgeGrid.appendChild(mkNudgeBtn("mdi:arrow-left", "Move left", -1, 0));
const mid = document.createElement("div");
mid.className = "badgeNudgeMid";
mid.innerText = "1%";
nudgeGrid.appendChild(mid);
nudgeGrid.appendChild(mkNudgeBtn("mdi:arrow-right", "Move right", 1, 0));

nudgeGrid.appendChild(document.createElement("div"));
nudgeGrid.appendChild(mkNudgeBtn("mdi:arrow-down", "Move down", 0, 1));
nudgeGrid.appendChild(document.createElement("div"));

nudgeWrap.appendChild(nudgeGrid);

// Mount nudge controls under the HA preview (right pane) when possible.
this._mountBadgeNudgeControls(nudgeWrap);




    const trow = document.createElement("div");
    trow.className = "draftGrid2";

    const ffShowIcon = document.createElement("ha-formfield");
    ffShowIcon.label = "Show icon";
    const swShowIcon = document.createElement("ha-switch");
    swShowIcon.checked = !!this._badgeDraft.show_icon;
    swShowIcon.addEventListener("change", (e) => { e.stopPropagation(); this._badgeDraft.show_icon = !!swShowIcon.checked; this._applyBadgeDraftPreview(); updateAnimVisibility(); });
    ffShowIcon.appendChild(swShowIcon);
    trow.appendChild(ffShowIcon);

    const ffIconClr = document.createElement("ha-formfield");
    ffIconClr.label = "Change icon color based on <state>";
    const swIconClr = document.createElement("ha-switch");
    swIconClr.checked = !!this._badgeDraft.icon_color_by_state;
    swIconClr.addEventListener("change", (e) => { e.stopPropagation(); this._badgeDraft.icon_color_by_state = !!swIconClr.checked; this._applyBadgeDraftPreview(); updateAnimVisibility(); });
    ffIconClr.appendChild(swIconClr);
    trow.appendChild(ffIconClr);

    box.appendChild(trow);

    // Badge image (optional)
    const imgSec = document.createElement("div");
    imgSec.className = "badgeImgSec";

    const imgTop = document.createElement("div");
    imgTop.className = "draftGrid2";

    const ffUseImg = document.createElement("ha-formfield");
    ffUseImg.label = "Use image (instead of icon)";
    const swUseImg = document.createElement("ha-switch");
    swUseImg.checked = !!this._badgeDraft.use_image;
    swUseImg.addEventListener("change", (e) => {
      e.stopPropagation();
      this._badgeDraft.use_image = !!swUseImg.checked;
      updateBadgeImgVisibility();
      this._applyBadgeDraftPreview();
      this._renderBadgesList();
    });
    ffUseImg.appendChild(swUseImg);
    imgTop.appendChild(ffUseImg);
    
const ffShowSlider = document.createElement("ha-formfield");
ffShowSlider.label = "Show slider";
const swShowSlider = document.createElement("ha-switch");
swShowSlider.checked = !!this._badgeDraft.show_slider;
swShowSlider.addEventListener("change", (e) => {
  e.stopPropagation();
  this._badgeDraft.show_slider = !!swShowSlider.checked;
  this._applyBadgeDraftPreview();
  setTimeout(updateSliderBoxVisibility, 0);
});
ffShowSlider.appendChild(swShowSlider);
imgTop.appendChild(ffShowSlider);
    
    
    
    
    
    

    // Image URL (optional)
imgSec.appendChild(imgTop);

const rowUrl = document.createElement("div");
rowUrl.className = "draftGrid1";

const tfImgUrl = document.createElement("ha-textfield");
tfImgUrl.label = "Image URL / path";
tfImgUrl.placeholder = "/local/my.png or https://...";
tfImgUrl.value = this._badgeDraft.img_url || "";
tfImgUrl.addEventListener("input", (e) => {
  e.stopPropagation();
  this._badgeDraft.img_url = tfImgUrl.value || "";
  this._applyBadgeDraftPreview();
});
tfImgUrl.addEventListener("click", stopBubble);
rowUrl.appendChild(tfImgUrl);

imgSec.appendChild(rowUrl);

const rowFit = document.createElement("div");
    rowFit.className = "draftGrid2";

    const cbFit = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
    cbFit.label = "Image fit";
    const fitItems = [{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }];
    if (cbFit.tagName.toLowerCase() === "ha-combo-box") {
      cbFit.items = fitItems;
      cbFit.itemLabelPath = "label";
      cbFit.itemValuePath = "value";
      cbFit.value = this._badgeDraft.img_fit || "cover";
      cbFit.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbFit.value;
        this._badgeDraft.img_fit = String(v || "cover");
        this._applyBadgeDraftPreview();
      });
    } else {
      fitItems.forEach(({value,label}) => {
        const it = document.createElement("mwc-list-item");
        it.value = value;
        it.innerText = label;
        cbFit.appendChild(it);
      });
      cbFit.value = this._badgeDraft.img_fit || "cover";
      cbFit.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbFit.value;
        this._badgeDraft.img_fit = String(v || "cover");
        this._applyBadgeDraftPreview();
      });
    }
    rowFit.appendChild(cbFit);

    imgSec.appendChild(rowFit);

    const rowImgNums = document.createElement("div");
    rowImgNums.className = "draftGrid2";

    const tfImgOpacity = document.createElement("ha-textfield");
    tfImgOpacity.type = "number";
    tfImgOpacity.label = "Image opacity (0-1)";
    tfImgOpacity.step = "0.05";
    tfImgOpacity.value = (this._badgeDraft.img_opacity == null) ? "1" : String(this._badgeDraft.img_opacity);
    tfImgOpacity.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = parseFloat(tfImgOpacity.value);
      this._badgeDraft.img_opacity = Number.isFinite(v) ? v : 1;
      this._applyBadgeDraftPreview();
    });
    rowImgNums.appendChild(tfImgOpacity);

    const tfImgRadius = document.createElement("ha-textfield");
    tfImgRadius.type = "number";
    tfImgRadius.label = "Image radius";
    tfImgRadius.step = "1";
    tfImgRadius.value = (this._badgeDraft.img_radius == null) ? "8" : String(this._badgeDraft.img_radius);
    tfImgRadius.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = parseFloat(tfImgRadius.value);
      this._badgeDraft.img_radius = Number.isFinite(v) ? v : 8;
      this._applyBadgeDraftPreview();
    });
    rowImgNums.appendChild(tfImgRadius);

    imgSec.appendChild(rowImgNums);

    const rowImgTog = document.createElement("div");
    rowImgTog.className = "draftGrid2";

    const ffTint = document.createElement("ha-formfield");
    ffTint.label = "Tint overlay";
    const swTint = document.createElement("ha-switch");
    swTint.checked = !!this._badgeDraft.img_tint;
    swTint.addEventListener("change", (e) => {
      e.stopPropagation();
      this._badgeDraft.img_tint = !!swTint.checked;
      updateBadgeImgVisibility();
      this._applyBadgeDraftPreview();
    });
    ffTint.appendChild(swTint);
    rowImgTog.appendChild(ffTint);

    const ffFrame = document.createElement("ha-formfield");
    ffFrame.label = "Frame";
    const swFrame = document.createElement("ha-switch");
    swFrame.checked = !!this._badgeDraft.img_frame;
    swFrame.addEventListener("change", (e) => {
      e.stopPropagation();
      this._badgeDraft.img_frame = !!swFrame.checked;
      updateBadgeImgVisibility();
      this._applyBadgeDraftPreview();
    });
    ffFrame.appendChild(swFrame);
    rowImgTog.appendChild(ffFrame);

    imgSec.appendChild(rowImgTog);

    const rowTintFrame = document.createElement("div");
    rowTintFrame.className = "draftGrid2";

    const tfTintColor = document.createElement("ha-textfield");
    tfTintColor.label = "Tint color";
    tfTintColor.placeholder = "#000000";
    tfTintColor.value = this._badgeDraft.img_tint_color || "#000000";
    tfTintColor.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.img_tint_color = tfTintColor.value; tintPick.value = normalizeHex(tfTintColor.value || "#000000", "#000000").slice(0,7); this._applyBadgeDraftPreview(); });
    tfTintColor.addEventListener("click", stopBubble);
    rowTintFrame.appendChild(tfTintColor);

    const tintPick = document.createElement("input");
    tintPick.type = "color";
    tintPick.className = "colorBtn";
    try { tintPick.value = normalizeHex(String(tfTintColor.value || ""), "#000000").slice(0,7); } catch(_) { tintPick.value = "#000000"; }
    tintPick.addEventListener("input", (e) => { e.stopPropagation(); tfTintColor.value = tintPick.value; this._badgeDraft.img_tint_color = tfTintColor.value; this._applyBadgeDraftPreview(); });
    rowTintFrame.appendChild(tintPick);

    const tfTintOp = document.createElement("ha-textfield");
    tfTintOp.type = "number";
    tfTintOp.label = "Tint opacity (0-1)";
    tfTintOp.step = "0.05";
    tfTintOp.value = (this._badgeDraft.img_tint_opacity == null) ? "0" : String(this._badgeDraft.img_tint_opacity);
    tfTintOp.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfTintOp.value); this._badgeDraft.img_tint_opacity = Number.isFinite(v)?v:0; this._applyBadgeDraftPreview(); });
    rowTintFrame.appendChild(tfTintOp);

    const tfFrameColor = document.createElement("ha-textfield");
    tfFrameColor.label = "Frame color";
    tfFrameColor.placeholder = "rgba(...) or #RRGGBB";
    tfFrameColor.value = this._badgeDraft.img_frame_color || "rgba(255,255,255,0.22)";
    tfFrameColor.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.img_frame_color = tfFrameColor.value; framePick.value = normalizeHex(tfFrameColor.value || "#ffffff", "#ffffff").slice(0,7); this._applyBadgeDraftPreview(); });
    tfFrameColor.addEventListener("click", stopBubble);
    rowTintFrame.appendChild(tfFrameColor);

    const framePick = document.createElement("input");
    framePick.type = "color";
    framePick.className = "colorBtn";
    try { framePick.value = normalizeHex(String(tfFrameColor.value || ""), "#ffffff").slice(0,7); } catch(_) { framePick.value = "#ffffff"; }
    framePick.addEventListener("input", (e) => { e.stopPropagation(); tfFrameColor.value = framePick.value; this._badgeDraft.img_frame_color = tfFrameColor.value; this._applyBadgeDraftPreview(); });
    rowTintFrame.appendChild(framePick);

    const tfFrameW = document.createElement("ha-textfield");
    tfFrameW.type = "number";
    tfFrameW.label = "Frame width";
    tfFrameW.step = "1";
    tfFrameW.value = (this._badgeDraft.img_frame_width == null) ? "2" : String(this._badgeDraft.img_frame_width);
    tfFrameW.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfFrameW.value); this._badgeDraft.img_frame_width = Number.isFinite(v)?v:2; this._applyBadgeDraftPreview(); });
    rowTintFrame.appendChild(tfFrameW);

    imgSec.appendChild(rowTintFrame);

    const rowDim = document.createElement("div");
    rowDim.className = "draftGrid2";

    const ffDimB = document.createElement("ha-formfield");
    ffDimB.label = "Dim when off";
    const swDimB = document.createElement("ha-switch");
    swDimB.checked = !!this._badgeDraft.img_dim_when_off;
    swDimB.addEventListener("change", (e) => {
      e.stopPropagation();
      this._badgeDraft.img_dim_when_off = !!swDimB.checked;
      updateBadgeImgVisibility();
      this._applyBadgeDraftPreview();
    });
    ffDimB.appendChild(swDimB);
    rowDim.appendChild(ffDimB);

    const tfDimFac = document.createElement("ha-textfield");
    tfDimFac.type = "number";
    tfDimFac.label = "Dim factor (0-1)";
    tfDimFac.step = "0.05";
    tfDimFac.value = (this._badgeDraft.img_dim_when_off_opacity == null) ? "0.45" : String(this._badgeDraft.img_dim_when_off_opacity);
    tfDimFac.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = parseFloat(tfDimFac.value);
      this._badgeDraft.img_dim_when_off_opacity = Number.isFinite(v) ? v : 0.45;
      this._applyBadgeDraftPreview();
    });
    rowDim.appendChild(tfDimFac);

    imgSec.appendChild(rowDim);

    const updateBadgeImgVisibility = () => {
      const on = !!this._badgeDraft.use_image;
      imgSec.style.display = "block";
      // Keep the toggle row visible; only hide the extra settings when off
      rowUrl.style.display = on ? "" : "none";
      rowFit.style.display = on ? "" : "none";
      rowImgNums.style.display = on ? "" : "none";
      rowImgTog.style.display = on ? "" : "none";
      rowTintFrame.style.display = on ? "" : "none";
      rowDim.style.display = on ? "" : "none";

      const tintOn = !!this._badgeDraft.img_tint;
      tfTintColor.style.display = (on && tintOn) ? "" : "none";
      tintPick.style.display = (on && tintOn) ? "" : "none";
      tfTintOp.style.display = (on && tintOn) ? "" : "none";

      const frameOn = !!this._badgeDraft.img_frame;
      tfFrameColor.style.display = (on && frameOn) ? "" : "none";
      framePick.style.display = (on && frameOn) ? "" : "none";
      tfFrameW.style.display = (on && frameOn) ? "" : "none";

      const dimOn = !!this._badgeDraft.img_dim_when_off;
      tfDimFac.style.display = (on && dimOn) ? "" : "none";
    };

    box.appendChild(imgSec);
    updateBadgeImgVisibility();



const grid2 = document.createElement("div");
grid2.className = "draftGrid1";

const cbStyle = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
cbStyle.label = "Badge style";
if (cbStyle.tagName.toLowerCase() === "ha-combo-box") {
  cbStyle.items = [
    { value: "glass", label: "Glass" },
    { value: "solid", label: "Solid" },
    { value: "outline", label: "Outline" },
    { value: "none", label: "None" },
    { value: "left_arrow", label: "Left arrow" },
    { value: "right_arrow", label: "Right arrow" },
    { value: "top_arrow", label: "Top arrow" },
    { value: "bottom_arrow", label: "Bottom arrow" },
    { value: "recycle_left", label: "Recycle arrow left" },
    { value: "recycle_right", label: "Recycle arrow right" },
    { value: "fan", label: "Fan (symbol)" },
    { value: "heatpump", label: "Heatpump (symbol)" },
  ];
  cbStyle.itemLabelPath = "label";
  cbStyle.itemValuePath = "value";
  cbStyle.value = this._badgeDraft.style || "glass";
  cbStyle.addEventListener("value-changed", (e) => { e.stopPropagation(); const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbStyle.value; this._badgeDraft.style = String(v || "glass"); this._applyBadgeDraftPreview(); updateAnimVisibility(); });
} else {
  [["glass","Glass"],["solid","Solid"],["outline","Outline"],["none","None"],["left_arrow","Left arrow"],["right_arrow","Right arrow"],["top_arrow","Top arrow"],["bottom_arrow","Bottom arrow"],["recycle_left","Recycle arrow left"],["recycle_right","Recycle arrow right"],["fan","Fan (symbol)"],["heatpump","Heatpump (symbol)"]].forEach(([v,t]) => {
    const it = document.createElement("mwc-list-item");
    it.value = v;
    it.innerText = t;
    cbStyle.appendChild(it);
  });
  cbStyle.value = this._badgeDraft.style || "glass";
  cbStyle.addEventListener("value-changed", (e) => { e.stopPropagation(); const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbStyle.value; this._badgeDraft.style = String(v || "glass"); this._applyBadgeDraftPreview(); updateAnimVisibility(); });
}
grid2.appendChild(cbStyle);


const cbAct = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
cbAct.label = "Tap action";
const actItems = [
  { value: "more-info", label: "More info" },
  { value: "toggle", label: "Toggle" },
  { value: "call-service", label: "Call service" },
  { value: "none", label: "None" },
    ];
if (cbAct.tagName.toLowerCase() === "ha-combo-box") {
  cbAct.items = actItems;
  cbAct.itemLabelPath = "label";
  cbAct.itemValuePath = "value";
  cbAct.value = this._badgeDraft.tap_action?.action || "more-info";
} else {
  actItems.forEach(({value,label}) => {
    const it = document.createElement("mwc-list-item");
    it.value = value;
    it.innerText = label;
    cbAct.appendChild(it);
  });
  cbAct.value = this._badgeDraft.tap_action?.action || "more-info";
}
grid2.appendChild(cbAct);


box.appendChild(grid2);

// Fan/Heatpump badge settings (only visible when Badge style = Fan/Heatpump)
const fanBadgeBox = document.createElement("div");
fanBadgeBox.className = "fanBadgeBox";

const tfBlade = document.createElement("ha-textfield");
tfBlade.type = "number";
tfBlade.label = "Blade count (Fan/Heatpump)";
tfBlade.min = "2";
tfBlade.max = "8";
tfBlade.step = "1";
tfBlade.value = String(this._badgeDraft.fan_blade_count ?? 3);
tfBlade.addEventListener("input", (e) => {
  e.stopPropagation();
  const v = parseInt(tfBlade.value, 10);
  this._badgeDraft.fan_blade_count = clampInt(v, 2, 8, 3);
  this._applyBadgeDraftPreview();
});
fanBadgeBox.appendChild(tfBlade);

const ffFanFrame = document.createElement("ha-formfield");
ffFanFrame.label = "Show frame (Fan only)";
const swFanFrame = document.createElement("ha-switch");
swFanFrame.checked = !!this._badgeDraft.fan_show_frame;
swFanFrame.addEventListener("change", (e) => {
  e.stopPropagation();
  this._badgeDraft.fan_show_frame = !!swFanFrame.checked;
  this._applyBadgeDraftPreview();
});
ffFanFrame.appendChild(swFanFrame);
fanBadgeBox.appendChild(ffFanFrame);

const updateFanBadgeVisibility = () => {
  const s = String(this._badgeDraft.style || "glass");
  const on = (s === "fan" || s === "heatpump");
  fanBadgeBox.style.display = on ? "" : "none";
  ffFanFrame.style.display = (s === "fan") ? "" : "none";
};

try { cbStyle.addEventListener("value-changed", () => setTimeout(updateFanBadgeVisibility, 0)); } catch(e) {}
box.appendChild(fanBadgeBox);
updateFanBadgeVisibility();


// Slider settings (shown when Show slider = ON)
let sliderBox = null;
const updateSliderBoxVisibility = () => {
  try {
    if (!sliderBox) return;
    const show = !!this._badgeDraft.show_slider;
    sliderBox.style.display = show ? "" : "none";
  } catch(e) {}
};
try { cbStyle.addEventListener("value-changed", () => setTimeout(updateSliderBoxVisibility, 0)); } catch(e) {}

sliderBox = document.createElement("div");
sliderBox.className = "sliderBox";
sliderBox.innerHTML = `<div class="sectionTitle">Slider settings</div>`;

const sRow1 = document.createElement("div");
sRow1.className = "draftGrid2";

const cbOrient = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
cbOrient.label = "Orientation";
const orientItems = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];
if (cbOrient.tagName.toLowerCase() === "ha-combo-box") {
  cbOrient.items = orientItems;
  cbOrient.itemLabelPath = "label";
  cbOrient.itemValuePath = "value";
  cbOrient.value = this._badgeDraft.slider_orientation || "horizontal";
  cbOrient.addEventListener("value-changed", (e) => {
    e.stopPropagation();
    const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbOrient.value;
    this._badgeDraft.slider_orientation = String(v || "horizontal");
    this._applyBadgeDraftPreview();
  });
} else {
  orientItems.forEach(({value,label}) => {
    const it = document.createElement("mwc-list-item");
    it.value = value;
    it.innerText = label;
    cbOrient.appendChild(it);
  });
  cbOrient.value = this._badgeDraft.slider_orientation || "horizontal";
  cbOrient.addEventListener("value-changed", (e) => {
    e.stopPropagation();
    const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbOrient.value;
    this._badgeDraft.slider_orientation = String(v || "horizontal");
    this._applyBadgeDraftPreview();
  });
}
sRow1.appendChild(cbOrient);

const cbUpd = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
cbUpd.label = "Update mode";
const updItems = [
  { value: "release", label: "On release" },
  { value: "live", label: "Live (while dragging)" },
];
if (cbUpd.tagName.toLowerCase() === "ha-combo-box") {
  cbUpd.items = updItems;
  cbUpd.itemLabelPath = "label";
  cbUpd.itemValuePath = "value";
  cbUpd.value = this._badgeDraft.slider_update || "release";
  cbUpd.addEventListener("value-changed", (e) => {
    e.stopPropagation();
    const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbUpd.value;
    this._badgeDraft.slider_update = String(v || "release");
    this._applyBadgeDraftPreview();
  });
} else {
  updItems.forEach(({value,label}) => {
    const it = document.createElement("mwc-list-item");
    it.value = value;
    it.innerText = label;
    cbUpd.appendChild(it);
  });
  cbUpd.value = this._badgeDraft.slider_update || "release";
  cbUpd.addEventListener("value-changed", (e) => {
    e.stopPropagation();
    const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbUpd.value;
    this._badgeDraft.slider_update = String(v || "release");
    this._applyBadgeDraftPreview();
  });
}
sRow1.appendChild(cbUpd);

sliderBox.appendChild(sRow1);

const sRow2 = document.createElement("div");
sRow2.className = "draftGrid2";

const ffShowVal = document.createElement("ha-formfield");
ffShowVal.label = "Show value";
const swShowVal = document.createElement("ha-switch");
swShowVal.checked = (typeof this._badgeDraft.slider_show_value === "boolean") ? this._badgeDraft.slider_show_value : true;
swShowVal.addEventListener("change", (e) => { e.stopPropagation(); this._badgeDraft.slider_show_value = !!swShowVal.checked; this._applyBadgeDraftPreview(); });
ffShowVal.appendChild(swShowVal);
sRow2.appendChild(ffShowVal);

sliderBox.appendChild(sRow2);

const sRow3 = document.createElement("div");
sRow3.className = "draftGrid3";

const tfSMin = document.createElement("ha-textfield");
tfSMin.type = "number";
tfSMin.label = "Min (optional)";
tfSMin.placeholder = "auto";
tfSMin.value = (this._badgeDraft.slider_min == null) ? "" : String(this._badgeDraft.slider_min);
tfSMin.addEventListener("input", (e) => { e.stopPropagation(); const v = parseFloat(tfSMin.value); this._badgeDraft.slider_min = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow3.appendChild(tfSMin);

const tfSMax = document.createElement("ha-textfield");
tfSMax.type = "number";
tfSMax.label = "Max (optional)";
tfSMax.placeholder = "auto";
tfSMax.value = (this._badgeDraft.slider_max == null) ? "" : String(this._badgeDraft.slider_max);
tfSMax.addEventListener("input", (e) => { e.stopPropagation(); const v = parseFloat(tfSMax.value); this._badgeDraft.slider_max = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow3.appendChild(tfSMax);

const tfSStep = document.createElement("ha-textfield");
tfSStep.type = "number";
tfSStep.label = "Step (optional)";
tfSStep.placeholder = "auto";
tfSStep.value = (this._badgeDraft.slider_step == null) ? "" : String(this._badgeDraft.slider_step);
tfSStep.addEventListener("input", (e) => { e.stopPropagation(); const v = parseFloat(tfSStep.value); this._badgeDraft.slider_step = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow3.appendChild(tfSStep);

sliderBox.appendChild(sRow3);

// --- Slider appearance ---
const sRow4 = document.createElement("div");
sRow4.className = "draftGrid3";

const tfLen = document.createElement("ha-textfield");
tfLen.type = "number";
tfLen.label = "Length (px)";
tfLen.placeholder = "auto";
tfLen.value = (this._badgeDraft.slider_length == null) ? "" : String(this._badgeDraft.slider_length);
tfLen.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfLen.value); this._badgeDraft.slider_length = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow4.appendChild(tfLen);

const tfThk = document.createElement("ha-textfield");
tfThk.type = "number";
tfThk.label = "Track thickness (px)";
tfThk.placeholder = "6";
tfThk.value = (this._badgeDraft.slider_thickness == null) ? "" : String(this._badgeDraft.slider_thickness);
tfThk.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfThk.value); this._badgeDraft.slider_thickness = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow4.appendChild(tfThk);

const tfThumb = document.createElement("ha-textfield");
tfThumb.type = "number";
tfThumb.label = "Thumb size (px)";
tfThumb.placeholder = "18";
tfThumb.value = (this._badgeDraft.slider_thumb_size == null) ? "" : String(this._badgeDraft.slider_thumb_size);
tfThumb.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfThumb.value); this._badgeDraft.slider_thumb_size = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow4.appendChild(tfThumb);

sliderBox.appendChild(sRow4);

const sRow5 = document.createElement("div");
sRow5.className = "draftGrid3";

const tfThumbCol = document.createElement("ha-textfield");
tfThumbCol.label = "Thumb color";
tfThumbCol.placeholder = "#FFFFFF";
tfThumbCol.value = this._badgeDraft.slider_thumb_color || "";
tfThumbCol.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.slider_thumb_color = tfThumbCol.value; this._applyBadgeDraftPreview(); });
sRow5.appendChild(tfThumbCol);

const thumbPick = document.createElement("input");
thumbPick.type = "color";
thumbPick.className = "colorBtn";
try { thumbPick.value = normalizeHex(String(tfThumbCol.value || ""), "#ffffff").slice(0,7); } catch(_) { thumbPick.value = "#ffffff"; }
thumbPick.addEventListener("input", (e) => { e.stopPropagation(); tfThumbCol.value = thumbPick.value; this._badgeDraft.slider_thumb_color = tfThumbCol.value; this._applyBadgeDraftPreview(); });
sRow5.appendChild(thumbPick);

const tfThumbRad = document.createElement("ha-textfield");
tfThumbRad.type = "number";
tfThumbRad.label = "Thumb radius (px)";
tfThumbRad.placeholder = "999";
tfThumbRad.value = (this._badgeDraft.slider_thumb_radius == null) ? "" : String(this._badgeDraft.slider_thumb_radius);
tfThumbRad.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfThumbRad.value); this._badgeDraft.slider_thumb_radius = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow5.appendChild(tfThumbRad);

sliderBox.appendChild(sRow5);

const sRow6 = document.createElement("div");
sRow6.className = "draftGrid3";

const tfTrackCol = document.createElement("ha-textfield");
tfTrackCol.label = "Track color";
tfTrackCol.placeholder = "rgba(...) or #RRGGBB";
tfTrackCol.value = this._badgeDraft.slider_track_color || "";
tfTrackCol.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.slider_track_color = tfTrackCol.value; this._applyBadgeDraftPreview(); });
sRow6.appendChild(tfTrackCol);

const trackPick = document.createElement("input");
trackPick.type = "color";
trackPick.className = "colorBtn";
try { trackPick.value = normalizeHex(String(tfTrackCol.value || ""), "#ffffff").slice(0,7); } catch(_) { trackPick.value = "#ffffff"; }
trackPick.addEventListener("input", (e) => { e.stopPropagation(); tfTrackCol.value = trackPick.value; this._badgeDraft.slider_track_color = tfTrackCol.value; this._applyBadgeDraftPreview(); });
sRow6.appendChild(trackPick);

const tfTrackRad = document.createElement("ha-textfield");
tfTrackRad.type = "number";
tfTrackRad.label = "Track radius (px)";
tfTrackRad.placeholder = "999";
tfTrackRad.value = (this._badgeDraft.slider_track_radius == null) ? "" : String(this._badgeDraft.slider_track_radius);
tfTrackRad.addEventListener("input", (e) => { e.stopPropagation(); const v=parseFloat(tfTrackRad.value); this._badgeDraft.slider_track_radius = Number.isFinite(v) ? v : null; this._applyBadgeDraftPreview(); });
sRow6.appendChild(tfTrackRad);

sliderBox.appendChild(sRow6);

box.appendChild(sliderBox);
updateSliderBoxVisibility();
setTimeout(updateSliderBoxVisibility, 0);

// Badge animation (for arrow/recycle styles)
const animRow = document.createElement("div");
animRow.className = "animRow";
const ffAnim = document.createElement("ha-formfield");
ffAnim.label = "Badge animation (flow)";
const swAnim = document.createElement("ha-switch");
swAnim.checked = !!this._badgeDraft.arrow_animation;
swAnim.addEventListener("change", (e) => {
  e.stopPropagation();
  this._badgeDraft.arrow_animation = !!swAnim.checked;
  this._applyBadgeDraftPreview();
});
ffAnim.appendChild(swAnim);
animRow.appendChild(ffAnim);
box.appendChild(animRow);

const isArrowOrRecycle = (s) => (s === "left_arrow" || s === "right_arrow" || s === "top_arrow" || s === "bottom_arrow" || s === "recycle_left" || s === "recycle_right");
const updateAnimVisibility = () => {
  animRow.style.display = isArrowOrRecycle(String(this._badgeDraft.style || "glass")) ? "block" : "none";
};
updateAnimVisibility();


// Call-service details (shown/hidden without re-render to avoid focus issues)
const svcBox = document.createElement("div");
svcBox.className = "svcBox";

// Helper: build available services list (prefer services for the badge entity's domain)
const _svcDomain = (eid) => {
  const s = String(eid || "");
  const i = s.indexOf(".");
  return (i > 0) ? s.slice(0, i) : "";
};
const _buildSvcItems = (eid) => {
  const hassSvcs = (this._hass && this._hass.services) ? this._hass.services : null;
  const dom = _svcDomain(eid);
  const out = [];
  if (!hassSvcs) return out;

  if (dom && hassSvcs[dom]) {
    Object.keys(hassSvcs[dom]).sort().forEach((svc) => {
      out.push({ value: `${dom}.${svc}`, label: `${dom}.${svc}` });
    });
    // Add a few common fallbacks (if they exist in this HA instance)
    ["homeassistant.turn_on","homeassistant.turn_off","homeassistant.toggle"].forEach((s) => {
      const d = s.split(".")[0], n = s.split(".")[1];
      if (hassSvcs[d] && hassSvcs[d][n]) out.push({ value: s, label: s });
    });
    return out;
  }

  // Fallback: all services (can be long, but better than nothing)
  Object.keys(hassSvcs).sort().forEach((d) => {
    Object.keys(hassSvcs[d] || {}).sort().forEach((svc) => {
      out.push({ value: `${d}.${svc}`, label: `${d}.${svc}` });
    });
  });
  return out;
};

// Picker row (optional) - helps users discover services for the selected entity
const svcRow = document.createElement("div");
svcRow.className = "grid2";

const ffPick = document.createElement("ha-formfield");
ffPick.label = "Pick service from list";
const swPick = document.createElement("ha-switch");
swPick.checked = (this._badgeDraft.tap_action?.service_picker ?? true);
swPick.addEventListener("change", (e) => {
  e.stopPropagation();
  this._badgeDraft.tap_action = this._badgeDraft.tap_action || {};
  this._badgeDraft.tap_action.service_picker = !!swPick.checked;
  updateSvcPickerVisibility();
  this._applyBadgeDraftPreview();
});
ffPick.appendChild(swPick);
svcRow.appendChild(ffPick);

const svcPicker = document.createElement(customElements.get("ha-combo-box") ? "ha-combo-box" : "ha-select");
svcPicker.label = "Available services";
svcPicker.style.width = "100%";
svcPicker.addEventListener("click", stopBubble);

const _fillSvcPicker = () => {
  const items = _buildSvcItems(this._badgeDraft.entity);
  const tag = svcPicker.tagName.toLowerCase();
  if (tag === "ha-combo-box") {
    svcPicker.items = items;
    svcPicker.itemLabelPath = "label";
    svcPicker.itemValuePath = "value";
    svcPicker.value = this._badgeDraft.tap_action?.service || "";
  } else {
    while (svcPicker.firstChild) svcPicker.removeChild(svcPicker.firstChild);
    items.forEach(({ value, label }) => {
      const it = document.createElement("mwc-list-item");
      it.value = value;
      it.innerText = label;
      svcPicker.appendChild(it);
    });
    svcPicker.value = this._badgeDraft.tap_action?.service || "";
  }
};
_fillSvcPicker();

svcPicker.addEventListener("value-changed", (e) => {
  e.stopPropagation();
  const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? svcPicker.value;
  this._badgeDraft.tap_action = this._badgeDraft.tap_action || {};
  this._badgeDraft.tap_action.service = String(v || "");
  // Keep manual field in sync
  if (tfSvc) tfSvc.value = this._badgeDraft.tap_action.service || "";
  this._applyBadgeDraftPreview();
});
svcRow.appendChild(svcPicker);
svcBox.appendChild(svcRow);

// Manual service input
const tfSvc = document.createElement("ha-textfield");
tfSvc.label = "Service (domain.service)";
tfSvc.value = this._badgeDraft.tap_action?.service || "";
tfSvc.addEventListener("input", (e) => {
  e.stopPropagation();
  this._badgeDraft.tap_action = this._badgeDraft.tap_action || {};
  this._badgeDraft.tap_action.service = tfSvc.value;
  // Keep picker in sync
  try { svcPicker.value = tfSvc.value; } catch(e) {}
  this._applyBadgeDraftPreview();
});
tfSvc.addEventListener("click", stopBubble);
svcBox.appendChild(tfSvc);

// Service data
const tfData = document.createElement("ha-textfield");
tfData.label = "Service data (optional JSON)";
tfData.value = (typeof this._badgeDraft.tap_action?.service_data === "string")
  ? this._badgeDraft.tap_action.service_data
  : (this._badgeDraft.tap_action?.service_data ? JSON.stringify(this._badgeDraft.tap_action.service_data) : "");
tfData.addEventListener("input", (e) => {
  e.stopPropagation();
  this._badgeDraft.tap_action = this._badgeDraft.tap_action || {};
  this._badgeDraft.tap_action.service_data = tfData.value;
  this._applyBadgeDraftPreview();
});
tfData.addEventListener("click", stopBubble);
svcBox.appendChild(tfData);

// Help text
const svcHelp = document.createElement("div");
svcHelp.className = "svcHelp";
svcHelp.textContent = "Tip: Use the picker to see services available for the badge entity. Service data is JSON, e.g. {\"entity_id\":\"...\",\"volume_level\":0.3}.";
svcBox.appendChild(svcHelp);

const updateSvcPickerVisibility = () => {
  const usePicker = (this._badgeDraft.tap_action?.service_picker ?? true);
  svcPicker.style.display = usePicker ? "" : "none";
  ffPick.style.display = "";
  tfSvc.style.display = usePicker ? "none" : "";
  // Refresh list if entity changed while editor is open
  if (usePicker) _fillSvcPicker();
};

const updateSvcVisibility = () => {
  const a = (this._badgeDraft.tap_action?.action || "more-info");
  svcBox.style.display = (a === "call-service") ? "block" : "none";
  if (a === "call-service") updateSvcPickerVisibility();
};

cbAct.addEventListener("value-changed", (e) => {
  e.stopPropagation();
  const v = (e.detail && (e.detail.value ?? e.detail)) ?? e.target?.value ?? cbAct.value;
  if (v != null) cbAct.value = v;
  this._badgeDraft.tap_action = this._badgeDraft.tap_action || {};
  this._badgeDraft.tap_action.action = String(v || "more-info");
  updateSvcVisibility();
  this._applyBadgeDraftPreview();
});

updateSvcVisibility();
box.appendChild(svcBox);

    const grid3 = document.createElement("div");
    grid3.className = "grid3";

    const tfPad = document.createElement("ha-textfield");
    tfPad.type = "number";
    tfPad.label = "Padding (px)";
    tfPad.step = "1";
    tfPad.value = String(this._badgeDraft.padding ?? 8);
    tfPad.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.padding = Number(tfPad.value); this._applyBadgeDraftPreview(); updateAnimVisibility(); });
    grid3.appendChild(tfPad);

    const tfRad = document.createElement("ha-textfield");
    tfRad.type = "number";
    tfRad.label = "Radius (px)";
    tfRad.step = "1";
    tfRad.value = String(this._badgeDraft.radius ?? 12);
    tfRad.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.radius = Number(tfRad.value); this._applyBadgeDraftPreview(); updateAnimVisibility(); });
    grid3.appendChild(tfRad);

    const tfFs = document.createElement("ha-textfield");
    tfFs.type = "number";
    tfFs.label = "Font size (px)";
    tfFs.step = "1";
    tfFs.value = String(this._badgeDraft.font_size ?? 12);
    tfFs.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.font_size = Number(tfFs.value); this._applyBadgeDraftPreview(); updateAnimVisibility(); });
    grid3.appendChild(tfFs);

    const tfIco = document.createElement("ha-textfield");
    tfIco.type = "number";
    tfIco.label = "Icon size (px)";
    tfIco.step = "1";
    tfIco.value = String(this._badgeDraft.icon_size ?? 18);
    tfIco.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft.icon_size = Number(tfIco.value); this._applyBadgeDraftPreview(); updateAnimVisibility(); });
    grid3.appendChild(tfIco);

    const tfFixW = document.createElement("ha-textfield");
    tfFixW.type = "number";
    tfFixW.label = "Fixed width (px, optional)";
    tfFixW.step = "1";
    tfFixW.value = (this._badgeDraft.fixed_width_px == null) ? "" : String(this._badgeDraft.fixed_width_px);
    tfFixW.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = parseFloat(tfFixW.value);
      this._badgeDraft.fixed_width_px = Number.isFinite(v) && v > 0 ? Math.max(20, Math.min(400, Math.round(v))) : null;
      this._applyBadgeDraftPreview();
    });
    grid3.appendChild(tfFixW);

    box.appendChild(grid3);

    const tfDec = document.createElement("ha-textfield");
    tfDec.type = "number";
    tfDec.label = "Decimals (optional)";
    tfDec.step = "1";
    tfDec.value = (this._badgeDraft.decimals == null) ? "" : String(this._badgeDraft.decimals);
    tfDec.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = tfDec.value;
      this._badgeDraft.decimals = (v === "") ? null : Number(v);
      this._applyBadgeDraftPreview();
    });
    box.appendChild(tfDec);

    
const mkBadgeColor = (label, key, fallback) => {
  const row = document.createElement("div");
  row.className = "colorRow";

  const tf = document.createElement("ha-textfield");
  tf.label = label;
  tf.value = String(this._badgeDraft[key] ?? "");
  tf.addEventListener("input", (e) => { e.stopPropagation(); this._badgeDraft[key] = tf.value; this._applyBadgeDraftPreview(); updateAnimVisibility(); });

  const btn = document.createElement("input");
  btn.type = "color";
  btn.className = "colorBtn";  

  const cur = String(this._badgeDraft[key] ?? "").trim();
  let alpha = "";
  let base = normalizeHex(cur, fallback);
  if (/^#[0-9a-fA-F]{8}$/.test(cur)) {
    alpha = cur.slice(7, 9);
    base = cur.slice(0, 7);
  } else if (/^#[0-9a-fA-F]{8}$/.test(base)) {
    alpha = base.slice(7, 9);
    base = base.slice(0, 7);
  }
  // input[type=color] expects 6-digit hex
  btn.value = normalizeHex(base, fallback).slice(0, 7);

  btn.addEventListener("input", (e) => {
    e.stopPropagation();
    const next = String(btn.value || fallback).trim();
    const merged = alpha ? (next + alpha) : next;
    tf.value = merged;
    this._badgeDraft[key] = merged;
    this._applyBadgeDraftPreview();
  });

  row.appendChild(tf);
  row.appendChild(btn);
  return row;
};

box.appendChild(mkBadgeColor("Background color", "bg_color", "#000000"));
box.appendChild(mkBadgeColor("Text color", "text_color", "#ffffff"));
box.appendChild(mkBadgeColor("Border color", "border_color", "#ffffff"));

// Opacity (optional)
const tfOp = document.createElement("ha-textfield");
tfOp.type = "number";
tfOp.step = "0.05";
tfOp.label = "Opacity (optional)";
tfOp.helperText = "0 = fully transparent, 1 = fully opaque. Leave empty for 1.";
tfOp.persistentHelperText = true;
const opCur = Number(this._badgeDraft.opacity);
tfOp.value = (!Number.isFinite(opCur) || opCur >= 1) ? "" : String(clamp01(opCur));
tfOp.addEventListener("input", (e) => {
  e.stopPropagation();
  const v = String(tfOp.value || "").trim();
  if (v === "") this._badgeDraft.opacity = 1;
  else {
    const n = Number(v);
    this._badgeDraft.opacity = Number.isFinite(n) ? clamp01(n) : 1;
  }
  this._applyBadgeDraftPreview();
});
box.appendChild(tfOp);


// Badge color intervals (optional, per badge)
// If added, these override the badge background/border (and icon color if enabled) based on the badge entity state.
const intSec = document.createElement("div");
intSec.className = "badgeIntervalsSec";

const intHdr = document.createElement("div");
intHdr.className = "badgeIntervalsHdr";

const intTitle = document.createElement("div");
intTitle.innerText = "Badge color intervals (optional)";
intHdr.appendChild(intTitle);

const btnAddInt = document.createElement("button");
btnAddInt.setAttribute("unelevated", "");
btnAddInt.classList.add("haPrimary");
btnAddInt.innerText = "+ Add interval";
intHdr.appendChild(btnAddInt);

intSec.appendChild(intHdr);

const mkIntColor = (label, getVal, setVal, fallback) => {
  const row = document.createElement("div");
  row.className = "colorRow";

  const tf = document.createElement("ha-textfield");
  tf.label = label;

  const btn = document.createElement("input");
  btn.type = "color";
  btn.className = "colorBtn";

  const cur = normalizeHex(getVal(), fallback || "#00ff00");
  tf.value = String(cur).toUpperCase();
  btn.value = String(cur).slice(0, 7);

  tf.addEventListener("change", (e) => {
    e.stopPropagation();
    const n = normalizeHex(tf.value, cur).toUpperCase();
    tf.value = n;
    btn.value = n.slice(0, 7);
    setVal(n);
    this._applyBadgeDraftPreview();
  });

  btn.addEventListener("input", (e) => {
    e.stopPropagation();
    const n = String(btn.value || cur).toUpperCase();
    tf.value = n;
    setVal(n);
    this._applyBadgeDraftPreview();
  });

  row.appendChild(tf);
  row.appendChild(btn);
  return row;
};

const renderBadgeIntervals = () => {
  const old = intSec.querySelector(".badgeIntervalsBody");
  if (old) old.remove();

  const body = document.createElement("div");
  body.className = "badgeIntervalsBody";

  const list = document.createElement("div");
  list.className = "badgeIntervalsList";

  const arr = Array.isArray(this._badgeDraft.intervals) ? this._badgeDraft.intervals.slice().map(normalizeInterval) : [];
  arr.sort((a, b) => Number(a.to) - Number(b.to));

  if (!arr.length) {
    const empty = document.createElement("div");
    empty.className = "badgeIntervalsEmpty";
    empty.innerText = "No badge intervals. Add intervals to control the badge color by the badge entity value.";
    list.appendChild(empty);
  } else {
    arr.forEach((it) => {
      const row = document.createElement("div");
      row.className = "badgeIntRow";

      const left = document.createElement("div");
      left.className = "badgeIntLeft";
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      const titleTxt = (it.match && String(it.match).trim()) ? `= ${String(it.match).trim()}` : `≤ ${it.to}`;
      const sw = document.createElement("span");
      sw.style.display = "inline-block";
      sw.style.width = "18px";
      sw.style.height = "18px";
      sw.style.borderRadius = "4px";
      sw.style.border = "1px solid rgba(255,255,255,0.35)";
      sw.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.35)";
      const col = (it.gradient && it.gradient.enabled) ? `linear-gradient(90deg, ${it.gradient.from || it.color || "#999"}, ${it.gradient.to || it.color || "#999"})` : (it.color || "#999");
      sw.style.background = col;
      const txt = document.createElement("span");
      txt.textContent = `${titleTxt}  →  ${it.color || ""}`;
      left.appendChild(sw);
      left.appendChild(txt);

      const btns = document.createElement("div");
      btns.className = "badgeIntBtns";

      const btnE = document.createElement("button");
      btnE.setAttribute("unelevated", "");
      btnE.classList.add("haPrimary");
      btnE.innerText = "Edit";
      btnE.addEventListener("click", (e) => {
        e.stopPropagation();
        this._badgeIntervalEditingId = it.id;
        this._badgeIntervalDraft = deepClone(it);
        renderBadgeIntervals();
      });

      const btnD = document.createElement("button");
      btnD.setAttribute("unelevated", "");
      btnD.classList.add("haPrimary");
      btnD.innerText = "Delete";
      btnD.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = (Array.isArray(this._badgeDraft.intervals) ? this._badgeDraft.intervals : []).filter((x) => (x && x.id) !== it.id);
        this._badgeDraft.intervals = next;
        this._applyBadgeDraftPreview();
        renderBadgeIntervals();
      });

      const btnDup = document.createElement("button");
      btnDup.setAttribute("unelevated", "");
      btnDup.classList.add("haPrimary");
      btnDup.innerText = "Duplicate";
      btnDup.addEventListener("click", (e) => {
        e.stopPropagation();
        const arr0 = Array.isArray(this._badgeDraft.intervals) ? this._badgeDraft.intervals : [];
        const idx0 = arr0.findIndex((x) => (x && x.id) === it.id);
        if (idx0 === -1) return;
        const copy = deepClone(it);
        copy.id = uid("it");
        const next = arr0.slice();
        next.splice(idx0 + 1, 0, copy);
        this._badgeDraft.intervals = next;
        this._applyBadgeDraftPreview();
        renderBadgeIntervals();
      });

      btns.appendChild(btnE);
      btns.appendChild(btnD);
      btns.appendChild(btnDup);

      // Buttons under text (cleaner list)
      left.appendChild(btns);

      row.appendChild(left);
      list.appendChild(row);
    });
  }

  body.appendChild(list);

  if (this._badgeIntervalDraft) {
    const draft = normalizeInterval(this._badgeIntervalDraft);

    const editBox = document.createElement("div");
    editBox.className = "badgeIntEdit";

    const g = document.createElement("div");
    g.className = "badgeIntEditGrid";

    const tfMatch2 = document.createElement("ha-textfield");
    tfMatch2.label = "Match value (optional)";
    tfMatch2.placeholder = "e.g. on / off / open";
    tfMatch2.value = String(draft.match ?? "");
    tfMatch2.addEventListener("input", (e) => {
      e.stopPropagation();
      draft.match = String(tfMatch2.value || "").trim();
      this._badgeIntervalDraft = draft;
      this._applyBadgeDraftPreview();
    });
    g.appendChild(tfMatch2);

    const tfTo2 = document.createElement("ha-textfield");
    tfTo2.type = "number";
    tfTo2.step = "0.1";
    tfTo2.label = "Upper bound (≤)";
    tfTo2.value = String(draft.to);
    tfTo2.addEventListener("input", (e) => {
      e.stopPropagation();
      draft.to = Number(tfTo2.value);
      this._badgeIntervalDraft = draft;
      this._applyBadgeDraftPreview();
    });
    g.appendChild(tfTo2);

    const ffGrad2 = document.createElement("ha-formfield");
    ffGrad2.label = "Enable gradient";
    const swGrad2 = document.createElement("ha-switch");
    swGrad2.checked = !!(draft.gradient && draft.gradient.enabled);
    swGrad2.addEventListener("change", (e) => {
      e.stopPropagation();
      draft.gradient = draft.gradient || {};
      draft.gradient.enabled = !!swGrad2.checked;
      this._badgeIntervalDraft = draft;
      this._applyBadgeDraftPreview();
      renderBadgeIntervals();
    });
    ffGrad2.appendChild(swGrad2);
    g.appendChild(ffGrad2);

    editBox.appendChild(g);

    const tfNewVal2 = document.createElement("ha-textfield");
    tfNewVal2.label = "New value (optional) support variables. Replaces badge value";
    tfNewVal2.placeholder = "e.g. Temperature: <value>";
    tfNewVal2.helperText = "Overrides the value that <value> expands to for this badge while this interval is active. Supports <value>, <state>, <name>, <unit>, <attr:xxx>, etc.";
    tfNewVal2.persistentHelperText = true;
    tfNewVal2.value = String(draft.new_value ?? "");
    tfNewVal2.addEventListener("input", (e) => {
      e.stopPropagation();
      draft.new_value = tfNewVal2.value;
      this._badgeIntervalDraft = draft;
      this._applyBadgeDraftPreview();
    });
    editBox.appendChild(tfNewVal2);

    // Optional icon override for this badge interval
    let itIconEl2 = null;
    if (customElements.get("ha-icon-picker")) {
      itIconEl2 = document.createElement("ha-icon-picker");
      itIconEl2.label = "New icon (optional)";
      itIconEl2.helperText = "If set, overrides the badge icon while this interval is active.";
      itIconEl2.persistentHelperText = true;
      itIconEl2.value = String(draft.icon || "");
      itIconEl2.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        draft.icon = e.detail?.value || "";
        this._badgeIntervalDraft = draft;
        this._applyBadgeDraftPreview();
      });
      if (this._hass) itIconEl2.hass = this._hass;
    } else {
      itIconEl2 = document.createElement("ha-textfield");
      itIconEl2.label = "Icon (optional) (mdi:...)";
      itIconEl2.helperText = "If set, overrides the badge icon while this interval is active.";
      itIconEl2.persistentHelperText = true;
      itIconEl2.value = String(draft.icon || "");
      itIconEl2.addEventListener("input", (e) => {
        e.stopPropagation();
        draft.icon = itIconEl2.value || "";
        this._badgeIntervalDraft = draft;
        this._applyBadgeDraftPreview();
      });
    }
    editBox.appendChild(itIconEl2);

    // Optional icon color override for this badge interval
    const mkOptColor = (label, key, fallback) => {
      const row = document.createElement("div");
      row.className = "colorRow";

      const tf = document.createElement("ha-textfield");
      tf.label = label;
      tf.placeholder = "(optional)";
      tf.value = String(draft[key] ?? "");

      const btn = document.createElement("input");
      btn.type = "color";
      btn.className = "colorBtn";
      btn.value = normalizeHex(tf.value || fallback, fallback).slice(0, 7);

      tf.addEventListener("change", (e) => {
        e.stopPropagation();
        const v = String(tf.value || "").trim();
        if (!v) {
          draft[key] = "";
        } else {
          const n = normalizeHex(v, fallback).toUpperCase();
          tf.value = n;
          draft[key] = n;
          btn.value = n.slice(0, 7);
        }
        this._badgeIntervalDraft = draft;
        this._applyBadgeDraftPreview();
      });

      btn.addEventListener("input", (e) => {
        e.stopPropagation();
        const n = String(btn.value || fallback).toUpperCase();
        tf.value = n;
        draft[key] = n;
        this._badgeIntervalDraft = draft;
        this._applyBadgeDraftPreview();
      });

      row.appendChild(tf);
      row.appendChild(btn);
      return row;
    };

    editBox.appendChild(mkOptColor("Icon color (optional)", "icon_color", "#FFFFFF"));

    // Colors
    editBox.appendChild(mkIntColor("Fill color (HEX)", () => draft.color, (v) => { draft.color = v; this._badgeIntervalDraft = draft; }, "#00ff00"));
    editBox.appendChild(mkIntColor("Border color (HEX)", () => (draft.outline || draft.color), (v) => { draft.outline = v; this._badgeIntervalDraft = draft; }, "#00ff00"));

    if (draft.gradient?.enabled) {
      editBox.appendChild(mkIntColor(
        "Gradient from (HEX)",
        () => draft.gradient?.from,
        (v) => { draft.gradient = draft.gradient || {}; draft.gradient.from = v; this._badgeIntervalDraft = draft; },
        draft.color || "#00ff00"
      ));
      editBox.appendChild(mkIntColor(
        "Gradient to (HEX)",
        () => draft.gradient?.to,
        (v) => { draft.gradient = draft.gradient || {}; draft.gradient.to = v; this._badgeIntervalDraft = draft; },
        draft.color || "#00ff00"
      ));
    }

    const a = document.createElement("div");
    a.className = "badgeIntEditActions";

    const btnC = document.createElement("button");
    btnC.setAttribute("unelevated", "");
    btnC.classList.add("haPrimary");
    btnC.innerText = "Cancel";
    btnC.addEventListener("click", (e) => {
      e.stopPropagation();
      this._badgeIntervalDraft = null;
      this._badgeIntervalEditingId = null;
      renderBadgeIntervals();
    });

    const btnS = document.createElement("button");
    btnS.setAttribute("unelevated", "");
    btnS.classList.add("haPrimary");
    btnS.innerText = "Save interval";
    btnS.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = Array.isArray(this._badgeDraft.intervals) ? this._badgeDraft.intervals.slice() : [];
      const id = draft.id || uid("bint");
      draft.id = id;
      // Ensure outline exists if user didn't set it
      if (!draft.outline) draft.outline = draft.color;
      const idx = cur.findIndex((x) => (x && x.id) === id);
      if (idx >= 0) cur[idx] = draft;
      else cur.push(draft);
      this._badgeDraft.intervals = cur.map(normalizeInterval);
      this._badgeIntervalDraft = null;
      this._badgeIntervalEditingId = null;
      this._applyBadgeDraftPreview();
      renderBadgeIntervals();
    });

    a.appendChild(btnC);
    a.appendChild(btnS);
    editBox.appendChild(a);

    body.appendChild(editBox);
  }

  intSec.appendChild(body);
};

btnAddInt.addEventListener("click", (e) => {
  e.stopPropagation();
  this._badgeIntervalEditingId = null;
  this._badgeIntervalDraft = normalizeInterval({
    id: uid("bint"),
    to: 0,
    color: "#00ff00",
    outline: "#00ff00",
    gradient: { enabled: false, from: "#00ff00", to: "#ff0000" },
  });
  renderBadgeIntervals();
});

renderBadgeIntervals();
box.appendChild(intSec);




    const actions = document.createElement("div");
    actions.className = "draftActions";

    const btnCancel = document.createElement("button");
    btnCancel.setAttribute("unelevated", "");
    btnCancel.classList.add("haPrimary");
    btnCancel.innerText = "Cancel";
    btnCancel.addEventListener("click", (e) => { e.stopPropagation(); this._cancelBadgeDraft(); });

    const btnSave = document.createElement("button");
    btnSave.setAttribute("unelevated", "");
    btnSave.classList.add("haPrimary");
    btnSave.innerText = "Save";
    btnSave.addEventListener("click", (e) => { e.stopPropagation(); this._saveBadgeDraft(); });

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    box.appendChild(actions);
  }

  // --- Badge placement helper: center badge in HA visual preview (useful when the preview is scrollable) ---
  _scheduleCenterBadgePreview(badgeOrObj) {
    // Keep the latest request and run once next frame.
    try { this._centerPreviewReq = badgeOrObj; } catch (_) {}
    try { cancelAnimationFrame(this._centerPreviewRaf); } catch (_) {}
    this._centerPreviewRaf = requestAnimationFrame(() => {
      try { this._centerBadgePreviewNow(this._centerPreviewReq); } catch (_) {}
    });
  }


_centerBadgePreviewNow(badgeOrObj) {
  try {
    if (!badgeOrObj) return false;

    const badgeObj = (typeof badgeOrObj === "object") ? normalizeBadge(badgeOrObj) : null;
    const badgeId = badgeObj?.id ? String(badgeObj.id) : String(badgeOrObj || "");
    if (!badgeId) return false;

    // Deep-search for preview instances of the card. HA often renders previews inside shadow roots.
    const allCards = this._deepQueryAll(document.body, CARD_TAG, []);
    const previewCards = (allCards || []).filter((c) => {
      try { return c && c.getAttribute && c.getAttribute("data-asc-preview") === "1"; } catch (_) { return false; }
    });

    if (!previewCards.length) return false;

    // Pick the most likely preview card (largest visible area)
    let best = null;
    let bestArea = 0;
    for (const c of previewCards) {
      try {
        const r = c.getBoundingClientRect?.();
        const area = (r && r.width && r.height) ? (r.width * r.height) : 0;
        if (area > bestArea) { best = c; bestArea = area; }
      } catch (_) {}
    }
    const card = best || previewCards[0];
    const sr = card?.shadowRoot;
    if (!sr) return false;

    const sc = sr.querySelector?.(".asc-preview-scroll");
    // Only pan inside the preview scroll container (Image preview). Never scroll the whole editor dialog.
    if (!sc || typeof sc.scrollTo !== "function") return false;

    // If Lit recreated the preview scroll container at (0,0), restore last known scroll immediately
    // to avoid the visible jump to the far-left before panning to the badge.
    try {
      const wantL = (card._ascPrevScroll?.left || 0);
      const wantT = (card._ascPrevScroll?.top || 0);
      if ((wantL || wantT) && (sc.scrollLeft === 0 && sc.scrollTop === 0)) {
        sc.scrollLeft = wantL;
        sc.scrollTop = wantT;
      }
    } catch (_) {}

    // Compute the target center position WITHOUT scrollIntoView (which scrolls the whole editor).
    // Prefer using badge x/y (percentage) to avoid blink/jump from layout timing.
    let centerX = null;
    let centerY = null;

    const sw = sc.scrollWidth || 0;
    const sh = sc.scrollHeight || 0;

    // If scroll metrics aren't ready yet (common while an image is loading), retry without
    // forcing the container back to (0,0). This prevents the "jump to far-left then back".
    if (sw < 10 || sh < 10) {
      this._centerPreviewRetries = (this._centerPreviewRetries || 0) + 1;
      if (this._centerPreviewRetries < 12) {
        try { cancelAnimationFrame(this._centerPreviewRaf2); } catch (_) {}
        this._centerPreviewRaf2 = requestAnimationFrame(() => {
          try { this._centerBadgePreviewNow(badgeObj || badgeId); } catch (_) {}
        });
        return true;
      }
      this._centerPreviewRetries = 0;
      return false;
    }

    if (badgeObj && badgeObj.x != null && badgeObj.y != null) {
      const xN = toNumberMaybe(badgeObj.x);
      const yN = toNumberMaybe(badgeObj.y);
      if (xN != null && yN != null) {
        const xPct = clamp(xN, 0, 100) / 100;
        const yPct = clamp(yN, 0, 100) / 100;
        centerX = xPct * sw;
        centerY = yPct * sh;
      }
    }

    // Fallback: measure the actual badge element if we cannot use x/y
    if (centerX == null || centerY == null) {
      const el = sr.querySelector?.(`[data-badge-id="${badgeId}"]`);
      if (!el) return false;

      const cr = sc.getBoundingClientRect();
      const er = el.getBoundingClientRect();

      centerX = (er.left - cr.left) + sc.scrollLeft + (er.width / 2);
      centerY = (er.top - cr.top) + sc.scrollTop + (er.height / 2);
    }

    const targetLeft = centerX - (sc.clientWidth / 2);
    const targetTop = centerY - (sc.clientHeight / 2);

    const maxLeft = Math.max(0, sw - sc.clientWidth);
    const maxTop = Math.max(0, sh - sc.clientHeight);

    // If nothing is scrollable, don't touch scroll position.
    if (maxLeft <= 0 && maxTop <= 0) return true;

    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    // Avoid the "blink" where the preview jumps to (0,0) before the image/content has expanded
    // to its final scrollWidth/scrollHeight (e.g., image not loaded yet). If the container
    // isn't scrollable yet but the target would require scrolling, retry shortly without
    // changing the current scroll position.
    const notReadyX = (sw <= (sc.clientWidth + 2)) && (targetLeft > 1);
    const notReadyY = (sh <= (sc.clientHeight + 2)) && (targetTop > 1);
    if (notReadyX || notReadyY) {
      this._centerPreviewRetries = (this._centerPreviewRetries || 0) + 1;
      if (this._centerPreviewRetries < 12) {
        try { cancelAnimationFrame(this._centerPreviewRaf2); } catch (_) {}
        this._centerPreviewRaf2 = requestAnimationFrame(() => {
          try { this._centerBadgePreviewNow(badgeObj || badgeId); } catch (_) {}
        });
        return true;
      }
      this._centerPreviewRetries = 0;
      return false;
    }
    this._centerPreviewRetries = 0;

    const nextLeft = clamp(targetLeft, 0, maxLeft);
    const nextTop = clamp(targetTop, 0, maxTop);

    // Persist the intended scroll position immediately so Lit re-renders don't bounce back to 0,0.
    try { card._ascPrevScroll = { left: nextLeft, top: nextTop }; } catch (_) {}

    sc.scrollTo({
      left: nextLeft,
      top: nextTop,
      behavior: reduce ? "auto" : "smooth",
    });

    return true;
  } catch (_) {}
  return false;
}


  _commit(key, value) {
    const next = { ...(this._config || DEFAULTS), [key]: value };
    this._config = next;

    // Update editor UI immediately (visibility/labels) without waiting for host re-render
    if (this._built && this._hass) {
      try { this._sync(); } catch (e) {}
    }

    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: next },
      bubbles: true,
      composed: true,
    }));
  }

  _eventValue(ev, target) {
    if (ev && ev.detail && typeof ev.detail.value !== "undefined") return ev.detail.value;
    return target.value;
  }

  _onChange(ev) {
    const target = ev.target;
    const key = target.configValue || target.dataset?.configValue;
    if (!key) return;

    // Special: when switching Symbol to Gate / Garage door / Blind, default Max (scale) to 1 (if still on the default 0..100)
    if (key === "symbol") {
      let value = this._eventValue(ev, target);
      const oldSym = String(this._config?.symbol || "").trim().toLowerCase();
      const newSym = String(value || "").trim().toLowerCase();

      this._commit("symbol", newSym);

      const isSpecialNew = (newSym === "gate" || newSym === "garage_door" || newSym === "blind");
      const isSpecialOld = (oldSym === "gate" || oldSym === "garage_door" || oldSym === "blind");

      if (isSpecialNew && !isSpecialOld) {
        const curMin = Number(this._config?.min);
        const curMax = Number(this._config?.max);
        const minOk = (!Number.isFinite(curMin) || Math.abs(curMin - 0) < 1e-9);
        const maxOk = (!Number.isFinite(curMax) || Math.abs(curMax - 100) < 1e-9);

        if (minOk && maxOk) {
          this._commit("min", 0);
          this._commit("max", 1);
          try { if (this._elMin) this._elMin.value = "0"; } catch (_) {}
          try { if (this._elMax) this._elMax.value = "1"; } catch (_) {}
        }
      }
      return;
    }

    if (typeof target.checked !== "undefined") {
      if (key === "image_frame") {
        // no-op, keep as-is
      }
      return this._commit(key, target.checked);
}

    let value = this._eventValue(ev, target);
//v1.0.2
    if (key === "min" || key === "max" || key === "value_font_size" || key === "name_font_size" || key === "stats_hours" || key === "card_scale" || key === "segment_gap" || key === "name_offset_x" || key === "name_offset_y" || key === "value_offset_x" || key === "value_offset_y") {
      const raw = String(value ?? "").trim();

      // Allow typing negative/decimal values without the editor forcing "0" mid-input.
      // Home Assistant textfields may emit value-changed on each keystroke.
      if (raw === "-" || raw === "+" || raw === "-," || raw === "-." || raw === "+," || raw === "+.") {
        return;
      }
      if (/^[-+]?\d+[\.,]$/.test(raw)) {
        // Trailing decimal separator while user is still typing
        return;
      }

      if (raw === "") value = 0;
      else {
        const n = toNumberMaybe(raw);
        value = Number.isFinite(n) ? n : Number(raw);
        if (!Number.isFinite(value)) value = 0;
      }
      return this._commit(key, value);
    }
    if (key === "decimals") {
      value = value === "" ? 0 : Number(value);
      if (!Number.isFinite(value)) value = 0;
      return this._commit(key, value);
    }

    return this._commit(key, value);
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, AndySensorCardEditor);
}
