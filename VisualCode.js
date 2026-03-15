/* VisualCode.js
   Class-based teaching UI library
   Version: 4.4.14  (MessageBox Copy button; SD Step-2 long lines)
   Exported global: VisualCode
   This New version includes QuizCode
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
  const round = (x, d = 2) => Number.isFinite(x) ? Number(x.toFixed(d)) : x;

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
      __flow.root.appendChild(control._node());
    }
  }
  function SetAutoFlow(on = true) { __flow.enabled = !!on; }
  function SetAutoFlowRoot(elOrId) {
    const el = (typeof elOrId === "string") ? document.getElementById(elOrId) : elOrId;
    if (el) { __flow.root = el; __flow.styleApplied = false; }
  }

  // Dedup wiring
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

  // Default-event helper
  function autoWireDefault(el, id, defaultEvent) {
    if (!id || !defaultEvent) return;
    const name = id + "_" + defaultEvent;
    const fn = window[name];
    if (typeof fn === "function" && supportsEvent(el, defaultEvent) && !hasWired(el, defaultEvent, name)) {
      el.addEventListener(defaultEvent, fn);
      recordWired(el, defaultEvent, name);
    }
  }

  // id_event() or _id_event()
  function autoWireAllByConvention(el, id) {
    if (!id) return;
    const idRe = escapeRegexLiteral(String(id));
    const re = new RegExp(`^_?${idRe}_(.+)$`);
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

      const reserved = new Set([
        "el","_defaultEvent","_id","_title","_wrap","_titleEl",
        "Id","Title","Text","Value","Items","Min","Max","Step","Src","Alt",
        "Style","on","_node"
      ]);

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
          return Reflect.set(target, prop, value, recv);
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

    // title (preserves position if already in DOM)
    set Title(t) {
      this._title = t || "";

      if (!this._wrap) {
        const parent = this.el.parentNode;
        const next   = this.el.nextSibling;

        this._wrap = document.createElement("div");
        this._wrap.setAttribute("style", styles.fieldWrap);

        this._titleEl = document.createElement("label");
        this._titleEl.setAttribute("style", styles.title);

        this._wrap.appendChild(this._titleEl);
        this._wrap.appendChild(this.el);

        if (parent) parent.insertBefore(this._wrap, next);
        if (this._id) this._titleEl.htmlFor = this._id;
      }

      this._titleEl.textContent = this._title;
    }
    get Title() { return this._title; }

    // styling
    set Style(s) { applyStyle(this.el, s); }
    Style(propOrBulk, val) { if (val === undefined) applyStyle(this.el, propOrBulk); else this.el.style[propOrBulk] = val; return this; }

    // events
    on(event, handler) { this.el.addEventListener(event, handler); return this; }

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
      if (id) this.Id = id;
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
  function CreateLabel(id, text = "") { const c = new Label(text); if (id) c.Id = id; __maybeFlowAppend(c); return c; }
  function CreateButton(id, text = "Button") { const c = new Button(text); if (id) c.Id = id; __maybeFlowAppend(c); return c; }
  function CreateTextBox(id, value = "") { const c = new TextBox(value); if (id) c.Id = id; __maybeFlowAppend(c); return c; }
  function CreateScrollBar(id, opts = {}) { const c = new ScrollBar(opts); if (id) c.Id = id; __maybeFlowAppend(c); return c; }
  function CreateDropDown(id, items = [], value = null) { const c = new DropDown(items, value); if (id) c.Id = id; __maybeFlowAppend(c); return c; }
  function CreateRadioList(id, items = [], value = null) { const c = new RadioList(items, value); if (id) c.Id = id; __maybeFlowAppend(c); return c; }
  function CreateImage(id, src = "", opts = {}) { const c = new ImageCtrl(src, opts); if (id) c.Id = id; __maybeFlowAppend(c); return c; }

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
  // Math utilities
  // =======================
  function __vc_parseNumberList(str) {
    return String(str)
      .split(",")
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
  }
  function FindMean(str) { const nums = __vc_parseNumberList(str); if (!nums.length) return null; return nums.reduce((a,b)=>a+b,0) / nums.length; }
  function FindRange(str) { const nums = __vc_parseNumberList(str); if (!nums.length) return null; return nums[nums.length-1] - nums[0]; }
  function FindMinimum(str) { const nums = __vc_parseNumberList(str); if (!nums.length) return null; return nums[0]; }
  function FindMaximum(str) { const nums = __vc_parseNumberList(str); if (!nums.length) return null; return nums[nums.length-1]; }
  function FindMedian(str) {
    const nums = __vc_parseNumberList(str); if (!nums.length) return null;
    const n = nums.length, mid = Math.floor(n/2);
    return (n % 2 === 0) ? (nums[mid-1] + nums[mid]) / 2 : nums[mid];
  }
  function FindQ1(str) {
    const nums = __vc_parseNumberList(str); if (!nums.length) return null;
    const mid = Math.floor(nums.length/2);
    const lower = nums.slice(0, mid);
    return FindMedian(lower.join(","));
  }
  function FindQ3(str) {
    const nums = __vc_parseNumberList(str); if (!nums.length) return null;
    const n = nums.length, mid = Math.floor(n/2);
    const upper = (n % 2 === 0) ? nums.slice(mid) : nums.slice(mid+1);
    return FindMedian(upper.join(","));
  }
  function FindMode(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) return ["none"];
    const freq = new Map();
    for (const x of nums) freq.set(x, (freq.get(x) || 0) + 1);
    let maxF = 0; for (const f of freq.values()) if (f > maxF) maxF = f;
    if (maxF <= 1) return ["none"];
    const modes = [];
    for (const [x,f] of freq.entries()) if (f === maxF) modes.push(x);
    modes.sort((a,b)=>a-b);
    return modes;
  }

  // ---- Population Standard Deviation with detailed Step 2 ----
  function FindStandardDeviation(str) {
    const nums = __vc_parseNumberList(str);
    if (!nums.length) { MessageBox("Please enter at least one number."); return null; }

    const n = nums.length;
    const sum = nums.reduce((a,b)=>a+b,0);
    const mean = sum / n;

    const details = nums.map(x => {
      const diff = x - mean;
      const sq = diff * diff;
      return `(${round(x,2)} − ${round(mean,2)})² = (${round(diff,2)})² = ${round(sq,2)}`;
    }).join("\n");

    const sqDevs = nums.map(x => (x - mean) ** 2);
    const varSum = sqDevs.reduce((a,b)=>a+b,0);
    const variance = varSum / n;
    const sd = Math.sqrt(variance);

    const numsLine = nums.join(" + ");
    const sep = "—".repeat(Math.min(60, Math.max(20, numsLine.length)));
    const msg =
`Step 1. Mean = (${nums.join(" + ")}) / ${n} = ${round(mean, 2)}

Step 2. For each value, subtract the mean and square the result
${details}

Step 3. Find the mean of all the numbers from Step 2
(${round(varSum, 2)} ÷ ${n}) = ${round(variance, 2)}

Step 4. Calculate the square root of the result from Step 3
Standard Deviation = SQRT(${round(variance, 2)}) = ${round(sd, 2)}`;


    MessageBox(msg, { title: "Standard Deviation (Population)", selectAllOnOpen: true });
    return sd;
  }

  // =======================
  // Box & Whiskers plotting
  // =======================
  function PlotBoxAndWhiskers(min, q1, median, q3, max, position = "bottom") {
    const vals = [min, q1, median, q3, max].map(v => Number(v));
    if (vals.some(v => !Number.isFinite(v))) { MessageBox("Please enter numeric values for Min, Q1, Median, Q3, and Max."); return null; }
    const [vmin, vq1, vmed, vq3, vmax] = vals;
    if (!(vmin <= vq1 && vq1 <= vmed && vmed <= vq3 && vq3 <= vmax)) { MessageBox("Values must satisfy: Min ≤ Q1 ≤ Median ≤ Q3 ≤ Max."); return null; }

    const svgNS = "http://www.w3.org/2000/svg";
    const width = 520, height = 170, pad = 50;
    const parent = document.getElementById("app") || document.body;

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

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    host.appendChild(svg);

    const y = height / 2 - 10;
    const baselineY = y + 35;
    const range = Math.max(1e-9, vmax - vmin);
    const scaleX = (width - 2 * pad) / range;
    const X = v => pad + (v - vmin) * scaleX;

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

    line(X(vmin), y, X(vmax), y);
    line(X(vmin), y - 10, X(vmin), y + 10);
    line(X(vmax), y - 10, X(vmax), y + 10);

    rect(X(vq1), y - 18, X(vq3) - X(vq1), 36);
    line(X(vmed), y - 18, X(vmed), y + 18, "black", 2);

    line(pad, baselineY, width - pad, baselineY);

    const labels = [
      { x: X(vmin),  text: `Min=${vmin}` },
      { x: X(vq1),   text: `Q1=${vq1}` },
      { x: X(vmed),  text: `Med=${vmed}`, bold: true },
      { x: X(vq3),   text: `Q3=${vq3}` },
      { x: X(vmax),  text: `Max=${vmax}` }
    ];
    for (const { x, text: t, bold } of labels) {
      line(x, baselineY - 5, x, baselineY + 5);
      text(x, baselineY + 18, t, 10, "middle", bold ? "700" : "normal");
    }

    return { host, svg };
  }

  // =======================
  // AnalyzeData
  // =======================
  function AnalyzeData(mean, range, mode, min, q1, median, q3, max) {
    const M  = Number(mean);
    const R  = Number(range);
    const mn = Number(min);
    const Q1 = Number(q1);
    const Md = Number(median);
    const Q3 = Number(q3);
    const mx = Number(max);

    let modes = [];
    if (Array.isArray(mode)) modes = mode;
    else if (mode == null || String(mode).toLowerCase() === "none") modes = ["none"];
    else {
      const s = String(mode).trim();
      if (s.toLowerCase() === "none" || s === "") modes = ["none"];
      else modes = s.split(",").map(x => Number(x.trim())).filter(x => Number.isFinite(x));
      if (!modes.length) modes = ["none"];
    }

    if (![M,R,mn,Q1,Md,Q3,mx].every(Number.isFinite)) {
      return { error: "AnalyzeData: numeric inputs required.", text: "Invalid inputs.", report: "Invalid inputs." };
    }

    const IQR = Q3 - Q1;
    const leftWhisker  = Q1 - mn;
    const rightWhisker = mx - Q3;

    const eps = Math.max(1e-9, 0.05 * (mx - mn));

    let symmetry;
    if (Math.abs(M - Md) <= eps) symmetry = "fairly symmetrical";
    else if (M > Md) symmetry = "skewed right";
    else symmetry = "skewed left";

    const modeConclusion = (modes.length === 1 && modes[0] === "none")
      ? "No mode (no value repeats)."
      : `Most common value(s): ${modes.join(", ")}.`;

    let rangeConclusion = `Range = ${R}. `;
    rangeConclusion += R < IQR ? "Overall spread is narrow."
                     : R > 2 * IQR ? "Overall spread is wide."
                     : "Overall spread is moderate.";

    let iqrConclusion = `IQR = ${IQR}. `;
    iqrConclusion += IQR < 0.5*(mx-mn) ? "Middle 50% is fairly consistent."
                   : IQR > 0.7*(mx-mn) ? "Middle 50% is varied (spread out)."
                   : "Middle 50% shows moderate spread.";

    const dL = Math.abs(Md - Q1);
    const dR = Math.abs(Q3 - Md);
    let medianSide;
    if (Math.abs(dL - dR) <= eps) medianSide = "Median is centered between Q1 and Q3.";
    else if (dL < dR) medianSide = "Median is closer to Q1 → more data on the higher side.";
    else medianSide = "Median is closer to Q3 → more data on the lower side.";

    let whiskerSkew;
    if (Math.abs(leftWhisker - rightWhisker) <= eps) whiskerSkew = "Whiskers are balanced (no strong skew).";
    else if (leftWhisker > rightWhisker) whiskerSkew = "Left whisker longer → skewed left.";
    else whiskerSkew = "Right whisker longer → skewed right.";

    const text =
`• Mean vs Median: ${symmetry}.
• Mode: ${modeConclusion}
• ${rangeConclusion}
• ${iqrConclusion}
• ${medianSide}
• ${whiskerSkew}`;

    const report =
`Mean = ${M}
Range = ${R}
Mode  = ${(Array.isArray(modes) ? modes.join(", ") : String(modes))}
Min   = ${mn}
Q1    = ${Q1}
Median= ${Md}
Q3    = ${Q3}
Max   = ${mx}

Analysis:
${text}`;

    return {
      mean: M, range: R, mode: modes, min: mn, q1: Q1, median: Md, q3: Q3, max: mx,
      IQR, leftWhisker, rightWhisker,
      symmetry, modeConclusion, rangeConclusion, iqrConclusion, medianSide, whiskerSkew,
      text, report
    };
  }

  // =======================
  // MessageBox (with Copy button; non-scroll for now)
  // =======================
  function MessageBox(message, options = {}) {
    const {
      title = "Message",
      okText = "OK",
      selectAllOnOpen = false,
      closeOnOverlay = true
    } = options;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.38);
      display:flex; align-items:center; justify-content:center; z-index:9999;
    `;

    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.style.cssText = `
      background:#fff; color:#111; max-width:min(90vw, 560px);
      width:min(90vw, 560px); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.25);
      padding:12px 12px 10px; font:14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    `;

    // Top bar with Copy on the left, title on the right
    const top = document.createElement("div");
    top.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;";

    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.textContent = "Copy";
    btnCopy.style.cssText = `
      padding:6px 10px; border-radius:10px; border:1px solid #999; background:#f5f5f5; cursor:pointer;
    `;

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = `font-weight:700; font-size:16px;`;

    top.appendChild(btnCopy);
    top.appendChild(h);

    const msg = document.createElement("div");
    msg.textContent = String(message ?? "");
    msg.style.cssText = `
      white-space: pre-wrap; user-select:text; -webkit-user-select:text;
      line-height:1.4; margin:8px 0 12px;
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
    dlg.appendChild(top);
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

    // Copy behavior (with graceful fallback)
    btnCopy.addEventListener("click", async () => {
      const text = msg.textContent || "";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          btnCopy.textContent = "Copied!";
          setTimeout(() => (btnCopy.textContent = "Copy"), 900);
        } else {
          // Fallback: select text so user can press Ctrl/Cmd+C
          const r = document.createRange();
          r.selectNodeContents(msg);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        }
      } catch {
        const r = document.createRange();
        r.selectNodeContents(msg);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
    });

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
    // factories
    CreateLabel, CreateButton, CreateTextBox, CreateScrollBar, CreateDropDown, CreateRadioList, CreateImage,
    Create,
    // helpers
    SetPageTitle, SetPageColor, GetValue, SetValue, SetStyle,
    SetAutoFlow, SetAutoFlowRoot,
    // math
    FindMean, FindRange, FindMinimum, FindQ1, FindMedian, FindQ3, FindMaximum, FindMode,
    FindStandardDeviation,
    AnalyzeData,
    // charts
    PlotBoxAndWhiskers,
    // UI
    MessageBox,
    // wiring
    RewireAll,
    __version: "4.4.14"
  });

  Object.defineProperty(window, "VisualCode", { value: API, writable: false, configurable: false });
  try { console.log("VisualCode loaded:", API.__version); } catch {}
})();



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ======================================================
// QuizCode API
// ------------------------------------------------------
// Separate quiz API that can live below the VisualCode
// section in the same .js file.
//
// Coder writes:
//
// var q = QuizCode;
// var quiz = new q.ProjectileQuiz("quiz1");
// quiz.Title = "Projectile Quiz";
// quiz.CorrectAnswers = ["B","D","A","C"];
// quiz.Start();
//
// ======================================================

const QUIZ_API = {};

// ======================================================
// QuizCode.ProjectileQuiz
// ------------------------------------------------------
// Minimal API quiz engine using projectile motion.
// ======================================================

QUIZ_API.ProjectileQuiz = function(id)
{
    var self = this;

    // --------------------------------------------------
    // PUBLIC PROPERTIES (coder can set)
    // --------------------------------------------------

    this.Id = id;

    this.Title = "Projectile Quiz";

    this.Instructions =
    "Choose the answer you believe is correct.\n" +
    "Enter a launch angle until you hit that target.";

    this.CorrectAnswers = [];

    // Physics parameters

    this.RangeFactor = 40;
    this.HitTolerance = 2;

    // Visual parameters

    this.Width = 700;
    this.Height = 320;

    // --------------------------------------------------
    // INTERNAL STATE
    // --------------------------------------------------

    this.CurrentQuestionIndex = 0;
    this.StudentChoice = "";
    this.TryCount = 0;

    this.AcademicScore = 0;
    this.AccuracyScore = 0;

    this.TargetDistances = {};

    var LastHit = "";
    var LastRange = 0;
    var QuestionAnswered = false;

    // --------------------------------------------------
    // INTERNAL CONTROLS
    // --------------------------------------------------

    var lblTitle;
    var lblInstructions;

    var ddlAnswer;
    var txtAngle;

    var btnLaunch;
    var btnNext;

    var lblQuestion;

    var svg;

    // --------------------------------------------------
    // CREATE UI
    // --------------------------------------------------

    this.CreateUI = function()
    {
        var v = VisualCode;

        lblTitle = v.CreateLabel(self.Id + "_title");
        lblTitle.Text = self.Title;

        ////lblInstructions = v.CreateLabel(self.Id + "_instructions");
        ////lblInstructions.Text = self.Instructions;

        //lblQuestion = v.CreateLabel(self.Id + "_question");
        //lblQuestion.Text = "Answer to Question #1:";

        ddlAnswer = v.CreateDropDown(self.Id + "_answer", ["A","B","C","D"]);
        ddlAnswer.Title = "Q1";

        txtAngle = v.CreateTextBox(self.Id + "_angle");
        txtAngle.Title = "Angle";

        btnLaunch = v.CreateButton(self.Id + "_launch");
        btnLaunch.Text = "Launch";

        btnNext = v.CreateButton(self.Id + "_next");
        btnNext.Text = "Next";

        v.Layout.Add(lblTitle);
        v.Layout.NewLine();

        //v.Layout.Add(lblInstructions);
        //v.Layout.NewLine();

        //v.Layout.Add(lblQuestion);
        v.Layout.Add(ddlAnswer);
        v.Layout.Add(txtAngle);
        v.Layout.NewLine();

        v.Layout.Add(btnLaunch);
        v.Layout.Add(btnNext);

        btnLaunch.Click = function()
        {
            self.Launch();
        };

        btnNext.Click = function()
        {
            self.NextQuestion();
        };

        // Create SVG drawing area

        svg = document.createElementNS("http://www.w3.org/2000/svg","svg");

        svg.setAttribute("width", self.Width);
        svg.setAttribute("height", self.Height);

        svg.style.border = "1px solid #999";
        svg.style.marginTop = "20px";
        svg.style.background = "#f9fbff";

       document.body.appendChild(svg);
       VisualCode.RewireAll();
    };

    // --------------------------------------------------
    // TARGET GENERATION
    // --------------------------------------------------

    this.GenerateTargets = function(index)
    {
        var base = 10 + index * 2;

        return {
            A: base,
            B: base + 6,
            C: base + 12,
            D: base + 18
        };
    };

    // --------------------------------------------------
    // DRAW HELPERS
    // --------------------------------------------------

    function clearSVG()
    {
        while(svg.firstChild)
            svg.removeChild(svg.firstChild);
    }

    function drawLine(x1, y1, x2, y2, color)
    {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);

        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "2");

        svg.appendChild(line);
    }

    function drawCircle(x, y, r, color)
    {
        var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");

        c.setAttribute("cx", x);
        c.setAttribute("cy", y);
        c.setAttribute("r", r);

        c.setAttribute("fill", color);
        c.setAttribute("stroke", "black");

        svg.appendChild(c);
    }

    function drawText(x, y, text)
    {
        var t = document.createElementNS("http://www.w3.org/2000/svg", "text");

        t.setAttribute("x", x);
        t.setAttribute("y", y);

        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "16");

        t.textContent = text;

        svg.appendChild(t);
    }

    function drawLandingPoint(range, color)
    {
        var groundY = 250;
        var launchX = 60;
        var scale = 18;

        var x = launchX + range * scale;

        drawCircle(x, groundY - 8, 8, color);
    }

    // --------------------------------------------------
    // DRAW SCENE
    // --------------------------------------------------

    this.DrawScene = function()
    {
        clearSVG();

        var groundY = 250;
        var launchX = 60;
        var scale = 18;

        drawLine(20, groundY, self.Width - 20, groundY, "#333");

        drawCircle(launchX, groundY, 10, "#666");

        var letters = ["A", "B", "C", "D"];

        for(var i = 0; i < 4; i++)
        {
            var letter = letters[i];
            var dist = self.TargetDistances[letter];

            var x = launchX + dist * scale;

            drawCircle(x, 220, 18, "#ffe9b3");

            drawText(x, 225, letter);
        }
    };

    // --------------------------------------------------
    // DETERMINE HIT
    // --------------------------------------------------

    this.GetHit = function(range)
    {
        if(Math.abs(range - self.TargetDistances.A) <= self.HitTolerance) return "A";
        if(Math.abs(range - self.TargetDistances.B) <= self.HitTolerance) return "B";
        if(Math.abs(range - self.TargetDistances.C) <= self.HitTolerance) return "C";
        if(Math.abs(range - self.TargetDistances.D) <= self.HitTolerance) return "D";

        return "";
    };

    // --------------------------------------------------
    // ACCURACY SCORING
    // --------------------------------------------------

    this.GetAccuracyPoints = function(tries)
    {
        if(tries == 1) return 3;
        if(tries == 2) return 2;
        if(tries == 3) return 1;

        return 0;
    };

    // --------------------------------------------------
    // LAUNCH
    // --------------------------------------------------

    this.Launch = function()
    {
        alert("Launch clicked");
       
        if(QuestionAnswered == true)
        {
            VisualCode.MessageBox("This question is already completed. Click Next.");
            return;
        }

        self.StudentChoice = ddlAnswer.Value;

        var angle = parseFloat(txtAngle.Value);

        if(isNaN(angle))
        {
            VisualCode.MessageBox("Enter a valid angle.");
            return;
        }

        self.TryCount++;

        var range =
            self.RangeFactor *
            Math.sin(2 * angle * Math.PI / 180);

        LastRange = range;
        LastHit = self.GetHit(range);

        self.DrawScene();

        if(LastHit == "")
        {
            drawLandingPoint(range, "red");
            VisualCode.MessageBox("Missed all targets.");
            return;
        }

        if(LastHit != self.StudentChoice)
        {
            drawLandingPoint(range, "orange");
            VisualCode.MessageBox("You hit " + LastHit + ", not " + self.StudentChoice + ".");
            return;
        }

        drawLandingPoint(range, "green");

        var correct =
            self.StudentChoice ==
            self.CorrectAnswers[self.CurrentQuestionIndex];

        if(correct)
            self.AcademicScore++;

        self.AccuracyScore +=
            self.GetAccuracyPoints(self.TryCount);

        QuestionAnswered = true;

        VisualCode.MessageBox(
            correct
            ? "Correct!"
            : "Incorrect. Correct answer: " +
              self.CorrectAnswers[self.CurrentQuestionIndex]
        );
    };

    // --------------------------------------------------
    // NEXT QUESTION
    // --------------------------------------------------

    this.NextQuestion = function()
    {
        if(QuestionAnswered == false)
        {
            VisualCode.MessageBox("Complete this question first.");
            return;
        }

        self.CurrentQuestionIndex++;

        if(self.CurrentQuestionIndex >= self.CorrectAnswers.length)
        {
            VisualCode.MessageBox(
                "Quiz finished\n\n" +
                "Academic Score: " + self.AcademicScore +
                " / " + self.CorrectAnswers.length +
                "\nAccuracy Score: " + self.AccuracyScore
            );

            return;
        }

        self.LoadQuestion(self.CurrentQuestionIndex);
    };

    // --------------------------------------------------
    // LOAD QUESTION
    // --------------------------------------------------

    this.LoadQuestion = function(index)
    {
        /////lblQuestion.Text = "Answer to Question #" + (index + 1) + ":";
        ddlAnswer.Title = "Q" + (index + 1);

        self.TryCount = 0;

        LastHit = "";
        LastRange = 0;
        QuestionAnswered = false;

        self.TargetDistances =
            self.GenerateTargets(index);

        self.DrawScene();
    };

    // --------------------------------------------------
    // START QUIZ
    // --------------------------------------------------

    this.Start = function()
    {
        self.CreateUI();

        self.CurrentQuestionIndex = 0;

        self.LoadQuestion(0);
    };
};

// ======================================================
// EXPORT QUIZ API
// ======================================================

Object.assign(QUIZ_API, {
    __version: "1.0.0"
});

Object.defineProperty(window, "QuizCode", {
    value: QUIZ_API,
    writable: false,
    configurable: false
});

try { console.log("QuizCode loaded:", QUIZ_API.__version); } catch {}




