/* VisualCode.js
   Class-based teaching UI library
   Version: 3.1.0  (Proxy-based Control to forward unknown props to CSS styles)
   Exported global: VisualCode

   Highlights:
   - Create controls as objects (Label, Button, TextBox, ScrollBar, DropDown, RadioList, Image)
   - Generic Create(tag, options) for any HTML element (attrs, props, style, title, id)
   - Simple properties: Text, Title, Id, Value, Items, etc. (PascalCase = library features)
   - Natural CSS usage via Proxy: txt.width = "300px", btn.backgroundColor = "black", lbl.fontSize = "20px"
   - Also supports Style helpers: ctrl.Style("prop","val") and ctrl.Style = { ... } or "css: v;"
   - Line-by-line layout: Layout.Add(...), Layout.NewLine()
   - Convention auto-wiring: id_event() or _id_event() attaches if element supports that event
   - Helpers: SetPageTitle, SetPageColor, GetValue, SetValue, SetStyle, RewireAll
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
    constructor(root) { this.root = root || document.body; this.currentLine = null; }
    ensureLine() {
      if (!this.currentLine) {
        const row = document.createElement("div");
        row.setAttribute("style", styles.line);
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

    // title above control
    set Title(t) {
      this._title = t || "";
      if (!this._wrap) {
        this._wrap = document.createElement("div");
        this._wrap.setAttribute("style", styles.fieldWrap);
        this._titleEl = document.createElement("label");
        this._titleEl.setAttribute("style", styles.title);
        this._wrap.appendChild(this._titleEl);
        this._wrap.appendChild(this.el);
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

  // ---------- factories ----------
  function CreateLabel(text){ return new Label(text); }
  function CreateButton(text){ return new Button(text); }
  function CreateTextBox(value){ return new TextBox(value); }
  function CreateScrollBar(opts){ return new ScrollBar(opts); }
  function CreateDropDown(items, value){ return new DropDown(items, value); }
  function CreateRadioList(items, value){ return new RadioList(items, value); }
  function CreateImage(src, opts){ return new ImageCtrl(src, opts); }
  // Generic
  function Create(tagOrType, options = {}) {
    const defaultEvent = options.defaultEvent ?? guessDefaultEventFor(tagOrType, options.attrs);
    return new GenericControl(tagOrType, { ...options, defaultEvent });
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

  // ---------- export ----------
  const Layout = new LayoutManager(document.getElementById("app") || document.body);

  const API = Object.freeze({
    // layout
    Layout, NewLine: () => Layout.NewLine(), Add: c => Layout.Add(c),
    // factories (specific)
    CreateLabel, CreateButton, CreateTextBox, CreateScrollBar, CreateDropDown, CreateRadioList, CreateImage,
    // factory (generic)
    Create,
    // helpers
    SetPageTitle, SetPageColor, GetValue, SetValue, SetStyle,
    // wiring
    RewireAll,
    __version: "3.1.0"
  });

  Object.defineProperty(window, "VisualCode", { value: API, writable: false, configurable: false });
  try { console.log("VisualCode loaded:", API.__version); } catch {}
})();
