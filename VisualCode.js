/* VisualCode.js
   Class-based teaching UI library
   Version: 4.4.4  (adds PlotBoxAndWhiskers(min,q1,median,q3,max, position="bottom"))
   Exported global: VisualCode

   Highlights:
   - Factories (id-first): CreateLabel(id, text), CreateTextBox(id, value), CreateButton(id, text),
     CreateScrollBar(id, opts), CreateDropDown(id, items, value), CreateRadioList(id, items, value), CreateImage(id, src, opts)
   - Generic Create(tag, { id, title, attrs, props, style, defaultEvent })
   - Titles: control.Title = "..."
   - CSS via Proxy: control.width = "300px", control.color = "blue", or control.Style("prop","val") / control.Style = {...}
   - Layout: Layout.Add(...).NewLine()  ← rows now stack regardless of Auto-Flow
   - Auto-wiring by convention: define functions like id_event() or _id_event()
   - Helpers: SetPageTitle, SetPageColor, GetValue, SetValue, SetStyle, RewireAll
   - Math helpers (TI-84 style quartiles) + MessageBox() modal (selectable text)
   - Auto-Flow — controls appear immediately on creation; later Layout organizes them
*/

(() => {
  "use strict";

  // ---------- base styles ----------
  const styles = {
    line: "display:flex;justify-content:center;align-items:center;gap:12px;margin:10px 0;",
    fieldWrap: "display:flex;flex-direction:column;align-items:flex-start;gap:6px;",
    title: "font:600 0.95rem system-ui, sans-serif;text-align:left;",
    label: "width:100%;text-align:center;font:600 1.5rem system-ui, sans-serif;",
    button: "padding:10px 16px;font:1rem system-ui, sans-serif;cursor:pointer;",
    textbox: "width:min(90%,520px);padding:10px;font:1rem system-ui, sans-serif;",
    range: "width:min(90%,520px);",
    select: "font:1rem system-ui, sans-serif;padding:8px;",
    radioWrap: "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;",
    radioLabel: "font:1rem system-ui, sans-serif;display:flex;align-items:center;gap:6px;",
    image: "max-width:90%;height:auto;display:block;"
  };

  // ---------- layout manager ----------
  class LayoutManager {
    constructor(root) {
      const parent = root || document.body;

      // Dedicated block host so rows stack even if parent is flex (Auto-Flow)
      const host = document.createElement("div");
      host.style.display = "block";
      host.style.width = "100%";

      parent.appendChild(host);

      this.root = host;
      this.currentLine = null;
    }
    ensureLine() {
      if (!this.currentLine) {
        const row = document.createElement("div");
        row.setAttribute("style", styles.line);
        // Make each row take full width within the host
        row.style.width = "100%";
        this.root.appendChild(row);
        this.currentLine = row;
      }
      return this.currentLine;
    }
    Add(control) { this.ensureLine().appendChild(control._node()); return this; }
    NewLine() { this.currentLine = null; this.ensureLine(); return this; }
  }

  // ---------- utilities ----------
  function applyStyle(el, s) {
    if (!s) return;
    if (typeof s === "string") el.style.cssText += ";" + s;
    else if (typeof s === "object") Object.assign(el.style, s);
  }
  function toArray(val) {
    if (Array.isArray(val)) return val;
    if (val == null) return [];
    return String(val).split(",").map(x => x.trim()).filter(Boolean);
  }
  function supportsEvent(el, evtName) { return ("on" + evtName) in el; }
  function escapeRegexLiteral(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // --- Auto-Flow (show controls as they’re created) ---
  const __flow = {
    enabled: true,
    root: (document.getElementById("app") || document.body),
    styleApplied: false
  };
  function __applyFlowStyleOnce() {
    if (__flow.styleApplied || !__flow.root) return;
    __flow.root.style.display = "flex";
    __flow.root.style.flexWrap = "wrap";
    __flow.root.style.justifyContent = "center";
    __flow.root.style.alignItems = "center";
    __flow.root.style.gap = "12px";
    __flow.root.style.margin = "10px 0";
    __flow.styleApplied = true;
  }
  function __maybeFlowAppend(control) {
    if (!control) return;
    if (__flow.enabled && __flow.root) {
      __applyFlowStyleOnce();
      __flow.root.appendChild(control._node()); // initial placement; Layout can move it later
    }
  }
  function SetAutoFlow(on = true) { __flow.enabled = !!on; }
  function SetAutoFlowRoot(elOrId) {
    const el = (typeof elOrId === "string") ? document.getElementById(elOrId) : elOrId;
    if (el) { __flow.root = el; __flow.styleApplied = false; }
  }

  // Dedup: element -> Map(event -> Set(handlerName))
  const wiredMap = new WeakMap();
  function recordWired(el, evt, name) {
    let m = wiredMap.get(el); if (!m) { m = new Map(); wiredMap.set(el, m); }
    let s = m.get(evt); if (!s) { s = new Set(); m.set(evt, s); }
    s.add(name);
  }
  function hasWired(el, evt, name) {
    const m = wiredMap.get(el); if (!m) return false;
    const s = m.get(evt); if (!s) return false;
    return s.has(name);
  }

  // Default-event helper (legacy-style convenience)
  function autoWireDefault(el, id, defaultEvent) {
    if (!id || !defaultEvent) return;
    const name = id + "_" + defaultEvent;
    const fn = window[name];
    if (typeof fn === "function" && supportsEvent(el, defaultEvent) && !hasWired(el, defaultEvent, name)) {
      el.addEventListener(defaultEvent, fn);
      recordWired(el, defaultEvent, name);
    }
  }

  // Generic convention auto-wiring: id_event() or _id_event()
  function autoWireAllByConvention(el, id) {
    if (!id) return;
    const idRe = escapeRegexLiteral(String(id));
    const re = new RegExp(`^_?${idRe}_(.+)$`); // capture event after "<id>_"
    const names = Object.getOwnPropertyNames(window);
    for (const name of names) {
      const fn = window[name];
      if (typeof fn !== "function") continue;
      const m = name.match(re);
      if (!m) continue;
      const evt = m[1];
      if (!evt || !supportsEvent(el, evt)) continue;
      if (hasWired(el, evt, name)) continue;
      el.addEventListener(evt, fn);
      recordWired(el, evt, name);
    }
  }
  function RewireAll() {
    document.querySelectorAll("[id]").forEach(el => autoWireAllByConvention(el, el.id));
  }

  // ---------- base Control (Proxy forwards unknown props to CSS styles) ----------
  class Control {
    constructor(el, defaultEvent = null) {
      this.el = el;
      this._defaultEvent = defaultEvent;
      this._id = ""; this._title = "";
      this._wrap = null; this._titleEl = null;

      // Reserved names for control API (NOT styles)
      const reserved = new Set([
        "el","_defaultEvent","_id","_title","_wrap","_titleEl",
        "Id","Title","Text","Value","Items","Min","Max","Step","Src","Alt",
        "Style","on","_node"
      ]);

      // Return a Proxy so unknown properties map to el.style[prop]
      return new Proxy(this, {
        get: (target, prop, recv) => {
          if (typeof prop !== "string") return Reflect.get(target, prop, recv);
          if (prop in target || reserved.has(prop)) return Reflect.get(target, prop, recv);
          if (target.el && target.el.style && prop in target.el.style) return target.el.style[prop];
          return Reflect.get(target, prop, recv);
        },
        set: (target, prop, value, recv) => {
          if (typeof prop !== "string") return Reflect.set(target, prop, value, recv);
          if (prop in target || reserved.has(prop)) return Reflect.set(target, prop, value, recv);
          if (target.el && target.el.style && prop in target.el.style) { target.el.style[prop] = value; return true; }
          if (target.el && target.el.style) { try { target.el.style[prop] = value; return true; } catch {} }
          return Reflect.set(target, prop, value, recv); // fallback
        }
      });
    }

    // identity
    set Id(v) {
      this._id = v || "";
      if (this.el) this.el.id = this._id;
      autoWireDefault(this.el, this._id, this._defaultEvent);
      autoWireAllByConvention(this.el, this._id);
    }
    get Id() { return this._id; }

    // title above control (replaces element in place if already in DOM)
    set Title(t) {
      this._title = t || "";

      if (!this._wrap) {
        // Remember current DOM position (for Auto-Flow cases)
        const parent = this.el.parentNode;
        const next   = this.el.nextSibling;

        // Build wrapper + label
        this._wrap = document.createElement("div");
        this._wrap.setAttribute("style", styles.fieldWrap);

        this._titleEl = document.createElement("label");
        this._titleEl.setAttribute("style", styles.title);

        // Assemble wrapper (moves el inside)
        this._wrap.appendChild(this._titleEl);
        this._wrap.appendChild(this.el);

        // If the input was already in the DOM (Auto-Flow), replace it in-place
        if (parent) {
          parent.insertBefore(this._wrap, next);
        }

        if (this._id) this._titleEl.htmlFor = this._id;
      }

      this._titleEl.textContent = this._title;
    }
    get Title() { return this._title; }

    // styling helpers
    set Style(s) { applyStyle(this.el, s); }
    Style(propOrBulk, val) { if (val === undefined) applyStyle(this.el, propOrBulk); else this.el.style[propOrBulk] = val; return this; }

    // events
    on(event, handler) { this.el.addEventListener(event, handler); return this; }

    // node to place in layout
    _node() { return this._wrap || this.el; }
  }

  // ---------- specific controls ----------
  class Label extends Control {
    constructor(text = "") { const el = document.createElement("div"); el.setAttribute("style", styles.label); el.textContent = text; super(el, null); }
    set Text(v) { this.el.textContent = v ?? ""; } get Text() { return this.el.textContent; }
  }
  class Button extends Control {
    constructor(text = "Button") { const el = document.createElement("button"); el.setAttribute("style", styles.button); el.textContent = text; super(el, "click"); }
    set Text(v) { this.el.textContent = v ?? ""; } get Text() { return this.el.textContent; }
  }
  class TextBox extends Control {
    constructor(value = "") { const el = document.createElement("input"); el.type = "text"; el.setAttribute("style", styles.textbox); el.value = value ?? ""; super(el, "input"); }
    set Placeholder(p) { this.el.placeholder = p ?? ""; } set Value(v) { this.el.value = v ?? ""; } get Value() { return this.el.value; }
  }
  class ScrollBar extends Control {
    constructor({ min = 0, max = 100, step = 1, value = min } = {}) {
      const el = document.createElement("input"); el.type = "range"; el.setAttribute("style", styles.range);
      el.min = min; el.max = max; el.step = step; el.value = value; super(el, "input");
    }
    set Min(v){ this.el.min = v; } set Max(v){ this.el.max = v; } set Step(v){ this.el.step = v; }
    set Value(v){ this.el.value = v; } get Value(){ return this.el.value; }
  }
  class DropDown extends Control {
    constructor(items = [], value = null) { const el = document.createElement("select"); el.setAttribute("style", styles.select); super(el, "change"); this.Items = items; if (value != null) this.Value = value; }
    set Items(items){ const arr = toArray(items); this.el.innerHTML = ""; arr.forEach(opt => { const o = document.createElement("option"); o.value = opt; o.textContent = opt; this.el.appendChild(o); }); }
    set Value(v){ this.el.value = v; } get Value(){ return this.el.value; }
  }
  class RadioList extends Control {
    constructor(items = [], value = null) {
      const wrap = document.createElement("div"); wrap.setAttribute("style", styles.radioWrap);
      super(wrap, "change"); this._name = "radio_" + Math.random().toString(36).slice(2);
      this.Items = items; if (value != null) this.Value = value;
      this.el.addEventListener("change", () => autoWireAllByConvention(this.el, this._id), { once: true });
    }
    set Items(items){ const arr = toArray(items); this.el.innerHTML = ""; arr.forEach(opt => { const lab = document.createElement("label"); lab.setAttribute("style", styles.radioLabel); const r = document.createElement("input"); r.type = "radio"; r.name = this._name; r.value = opt; lab.appendChild(r); lab.appendChild(document.createTextNode(opt)); this.el.appendChild(lab); }); }
    set Value(v){ const r = this.el.querySelector(`input[type="radio"][value="${CSS.escape(String(v))}"]`); if (r) r.checked = true; }
    get Value(){ const r = this.el.querySelector('input[type="radio"]:checked'); return r ? r.value : null; }
  }
  class ImageCtrl extends Control {
    constructor(src = "", { alt = "", widthPct, heightPct } = {}) {
      const img = document.createElement("img"); img.setAttribute("style", styles.image);
      img.src = src || ""; img.alt = alt || ""; if (widthPct != null) img.style.width = `${widthPct}%`; if (heightPct != null) img.style.height = `${heightPct}%`;
      super(img, "click");
    }
    set Src(v){ this.el.src = v ?? ""; } get Src(){ return this.el.src; } set Alt(v){ this.el.alt = v ?? ""; }
  }

  // ---------- generic control ----------
  class GenericControl extends Control {
    constructor(tagName = "div", { defaultEvent = null, attrs = {}, props = {}, style = null, title = null, id = null } = {}) {
      const el = document.createElement(tagName);
      super(el, defaultEvent);
      if (attrs && typeof attrs === "object") for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
      if (props && typeof props === "object") for (const [k, v] of Object.entries(props)) { try { el[k] = v; } catch {} }
      if (style) this.Style(style);
      if (title) this.Title = title;
      if (id) this.Id = id; // triggers auto-wiring
    }
  }
  function guessDefaultEventFor(tag, attrs = {}) {
    const t = String(tag).toLowerCase();
    if (t === "button") return "click";
    if (t === "input") {
      const type = String(attrs.type || "").toLowerCase();
      if (["range", "text", "number", "search", "email", "url", "password"].includes(type)) return "input";
      if (["checkbox", "radio"].includes(type)) return "change";
    }
    if (t === "select") return "change";
    if (t === "img") return "click";
    return null;
  }

  // ---------- factories (id-first) ----------
  function CreateLabel(id, text = "") {
    const c = new Label(text);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }
  function CreateButton(id, text = "Button") {
    const c = new Button(text);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }
  function CreateTextBox(id, value = "") {
    const c = new TextBox(value);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }
  function CreateScrollBar(id, opts = {}) {
    const c = new ScrollBar(opts);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }
  function CreateDropDown(id, items = [], value = null) {
    const c = new DropDown(items, value);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }
  function CreateRadioList(id, items = [], value = null) {
    const c = new RadioList(items, value);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }
  function CreateImage(id, src = "", opts = {}) {
    const c = new ImageCtrl(src, opts);
    if (id) c.Id = id;
    __maybeFlowAppend(c);
    return c;
  }

  // Generic factory: Create(tag, { id, title, attrs, props, style, defaultEvent })
  function Create(tagOrType, options = {}) {
    const defaultEvent = options.defaultEvent ?? guessDefaultEventFor(tagOrType, options.attrs);
    const c = new GenericControl(tagOrType, { ...options, defaultEvent });
    __maybeFlowAppend(c);
    return c;
  }

  // ---------- page helpers ----------
  function SetPageTitle(t){ document.title = t || ""; }
  function SetPageColor(c){ document.body.style.backgroundColor = c || ""; }

  // ---------- generic get/set by id ----------
  function SetValue(id, value) {
    const el = document.getElementById(id); if (!el) return;
    if (el.tagName === "DIV" && el.querySelector('input[type="radio"]')) {
      const r = el.querySelector(`input[type="radio"][value="${CSS.escape(String(value))}"]`); if (r) r.checked = true; return;
    }
    if (el.tagName === "DIV") { el.textContent = value; return; }
    if ("value" in el) { el.value = value; return; }
    el.textContent = value;
  }
  function GetValue(id) {
    const el = document.getElementById(id); if (!el) return null;
    if (el.tagName === "DIV" && el.querySelector('input[type="radio"]')) {
      const r = el.querySelector('input[type="radio"]:checked'); return r ? r.value : null;
    }
    if ("value" in el) return el.value;
    return el.textContent;
  }
  function SetStyle(id, property, value) {
    const el = document.getElementById(id); if (!el || typeof property !== "string") return;
    el.style[property] = value;
  }

  // =======================
  // Math Utility Functions (TI-84 style for quartiles)
  // =======================
  function __vc_parseNumberList(str) {
    return String(str)
      .split(",")
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
  }

  function FindMean(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    const sum = nums.reduce((a,b)=>a+b,0);
    return sum / nums.length;
  }
  function FindRange(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    return nums[nums.length-1] - nums[0];
  }
  function FindMinimum(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    return nums[0];
  }
  function FindMaximum(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    return nums[nums.length-1];
  }
  function FindMedian(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    const n = nums.length, mid = Math.floor(n/2);
    return (n % 2 === 0) ? (nums[mid-1] + nums[mid]) / 2 : nums[mid];
  }
  // TI-84 quartiles: when n is odd, exclude the median from both halves.
  function FindQ1(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    const n = nums.length, mid = Math.floor(n/2);
    const lower = nums.slice(0, mid);
    return FindMedian(lower.join(","));
  }
  function FindQ3(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return null;
    const n = nums.length, mid = Math.floor(n/2);
    const upper = (n % 2 === 0) ? nums.slice(mid) : nums.slice(mid+1);
    return FindMedian(upper.join(","));
  }
  // Mode(s): return array of values with highest frequency; ["none"] if no mode.
  function FindMode(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return ["none"];
    const freq = new Map();
    for (const x of nums) freq.set(x, (freq.get(x) || 0) + 1);
    let maxF = 0;
    for (const f of freq.values()) if (f > maxF) maxF = f;
    if (maxF <= 1) return ["none"];   // no repeats → no mode
    const modes = [];
    for (const [x,f] of freq.entries()) if (f === maxF) modes.push(x);
    modes.sort((a,b)=>a-b);
    return modes;
  }

// =======================
// Box & Whiskers (simple) — labels for all five values
// =======================
// PlotBoxAndWhiskers(min, q1, median, q3, max, position="bottom")
// Renders an SVG box plot at the top or bottom of the page/app, with built-in validation.
function PlotBoxAndWhiskers(min, q1, median, q3, max, position = "bottom") {
  const vals = [min, q1, median, q3, max].map(v => Number(v));

  // Validation (student-friendly)
  if (vals.some(v => !Number.isFinite(v))) {
    MessageBox("Please enter numeric values for Min, Q1, Median, Q3, and Max.");
    return null;
  }
  const [vmin, vq1, vmed, vq3, vmax] = vals;
  if (!(vmin <= vq1 && vq1 <= vmed && vmed <= vq3 && vq3 <= vmax)) {
    MessageBox("Values must satisfy: Min ≤ Q1 ≤ Median ≤ Q3 ≤ Max.");
    return null;
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const width = 520, height = 170, pad = 50;
  const parent = document.getElementById("app") || document.body;

  // Create/choose container
  const id = (position === "top") ? "vc-boxplot-top" : "vc-boxplot-bottom";
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement("div");
    host.id = id;
    host.style.cssText = "width:100%;display:flex;justify-content:center;margin:12px 0;";
    if (position === "top") parent.insertBefore(host, parent.firstChild);
    else parent.appendChild(host);
  }
  host.innerHTML = "";

  // SVG + scaling
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  host.appendChild(svg);

  const y = height / 2 - 10;
  const baselineY = y + 35;
  const range = Math.max(1e-9, vmax - vmin);  // avoid divide-by-zero
  const scaleX = (width - 2 * pad) / range;
  const X = v => pad + (v - vmin) * scaleX;

  // helpers
  const line = (x1, y1, x2, y2, stroke="black", sw=1) => {
    const l = document.createElementNS(svgNS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", stroke); l.setAttribute("stroke-width", sw);
    svg.appendChild(l);
  };
  const rect = (x, y0, w, h, fill="#cce5ff", stroke="black") => {
    const r = document.createElementNS(svgNS, "rect");
    r.setAttribute("x", x); r.setAttribute("y", y0);
    r.setAttribute("width", Math.max(0, w)); r.setAttribute("height", h);
    r.setAttribute("fill", fill); r.setAttribute("stroke", stroke);
    svg.appendChild(r);
  };
  const text = (x, y0, t, size=10, anchor="middle", fontWeight="normal") => {
    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", x); tx.setAttribute("y", y0);
    tx.setAttribute("text-anchor", anchor);
    tx.setAttribute("font-size", size + "px");
    if (fontWeight !== "normal") tx.setAttribute("font-weight", fontWeight);
    tx.textContent = t;
    svg.appendChild(tx);
  };

  // whisker line + caps
  line(X(vmin), y, X(vmax), y);
  line(X(vmin), y - 10, X(vmin), y + 10);
  line(X(vmax), y - 10, X(vmax), y + 10);

  // IQR box + median
  rect(X(vq1), y - 18, X(vq3) - X(vq1), 36);
  line(X(vmed), y - 18, X(vmed), y + 18, "black", 2);

  // baseline
  line(pad, baselineY, width - pad, baselineY);

  // Five labeled ticks along the number line
  const labels = [
    { x: X(vmin),  text: `Min=${vmin}` },
    { x: X(vq1),   text: `Q1=${vq1}` },
    { x: X(vmed),  text: `Med=${vmed}`, bold: true },
    { x: X(vq3),   text: `Q3=${vq3}` },
    { x: X(vmax),  text: `Max=${vmax}` }
  ];
  for (const { x, text: t, bold } of labels) {
    // small tick
    line(x, baselineY - 5, x, baselineY + 5);
    // label under the tick
    text(x, baselineY + 18, t, 10, "middle", bold ? "700" : "normal");
  }

  return { host, svg };
}

  // =======================
  // UI MessageBox (modal) — no Clipboard API, selectable text
  // =======================
  // Usage:
  // v.MessageBox("Hello!");
  // v.MessageBox("Copy with Ctrl/Cmd+C", { title:"Info", okText:"Close", selectAllOnOpen:true });
  function MessageBox(message, options = {}) {
    const {
      title = "Message",
      okText = "OK",
      selectAllOnOpen = false, // if true, selects the message text on open
      closeOnOverlay = true    // click outside to close
    } = options;

    // Overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.38);
      display:flex; align-items:center; justify-content:center; z-index:9999;
    `;

    // Dialog
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.style.cssText = `
      background:#fff; color:#111; max-width:min(90vw, 520px);
      width:min(90vw, 520px); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.25);
      padding:16px 16px 12px; font:14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    `;

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = `font-weight:700; font-size:16px; margin-bottom:8px;`;

    const msg = document.createElement("div");
    msg.textContent = String(message ?? "");
    msg.style.cssText = `
      white-space: pre-wrap; user-select:text; -webkit-user-select:text;
      line-height:1.4; margin:6px 0 12px;
    `;

    const bar = document.createElement("div");
    bar.style.cssText = `display:flex; justify-content:flex-end; gap:8px;`;

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.textContent = okText;
    btnOk.style.cssText = `
      padding:8px 14px; border-radius:10px; border:1px solid #0a7;
      background:#0a7; color:#fff; cursor:pointer;
    `;

    bar.appendChild(btnOk);
    dlg.appendChild(h);
    dlg.appendChild(msg);
    dlg.appendChild(bar);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);

    const prev = document.activeElement;
    setTimeout(() => {
      btnOk.focus();
      if (selectAllOnOpen) {
        try {
          const r = document.createRange();
          r.selectNodeContents(msg);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        } catch {}
      }
    }, 0);

    function cleanup() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (prev && typeof prev.focus === "function") prev.focus();
      document.removeEventListener("keydown", onKey);
      if (closeOnOverlay) overlay.removeEventListener("click", onOverlay);
      btnOk.removeEventListener("click", onOk);
    }

    let resolver;
    const onOk = () => { cleanup(); resolver(); };
    const onOverlay = (e) => { if (e.target === overlay) onOk(); };
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") onOk(); };

    if (closeOnOverlay) overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);
    btnOk.addEventListener("click", onOk);

    return new Promise(res => { resolver = res; });
  }

  // ---------- export ----------
  const Layout = new LayoutManager(document.getElementById("app") || document.body);

  const API = Object.freeze({
    // layout
    Layout, NewLine: () => Layout.NewLine(), Add: c => Layout.Add(c),
    // factories (specific, id-first)
    CreateLabel, CreateButton, CreateTextBox, CreateScrollBar, CreateDropDown, CreateRadioList, CreateImage,
    // factory (generic)
    Create,
    // helpers
    SetPageTitle, SetPageColor, GetValue, SetValue, SetStyle,
    SetAutoFlow, SetAutoFlowRoot,
    // math
    FindMean, FindRange, FindMinimum, FindQ1, FindMedian, FindQ3, FindMaximum, FindMode,
    // charts
    PlotBoxAndWhiskers,
    // UI
    MessageBox,
    // wiring
    RewireAll,
    __version: "4.4.4"
  });

  Object.defineProperty(window, "VisualCode", { value: API, writable: false, configurable: false });
  try { console.log("VisualCode loaded:", API.__version); } catch {}
})();




