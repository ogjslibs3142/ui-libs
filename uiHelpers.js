// uiHelpers.js (unminified)
// Beginner-friendly UI helper library for simple web apps (works great in editor.p5js.org)
//
// Goals:
// - Ultra-simple visual layout: line-by-line, horizontally centered.
// - Intuitive control creation: UI.Create(type, id, text, options?)
// - Clear separation of Visual (Create) vs. Behavior (On / auto-wired default handlers).
// - Upward compatible API with optional features.
//
// Features included:
// - Controls: Label, NewLine, Button, TextBox, DropDown, RadioList, ScrollBar (range), Image
// - Default-event *auto-wiring*: if <id>_<defaultEvent>() exists, it will be attached automatically
//   e.g., Button → click → function btnSayHello_click(){ ... }
//         TextBox → input → function txtName_input(){ ... }
//         ScrollBar → input → function vol_input(){ ... }   (fires continuously while sliding)
//         DropDown/RadioList → change → function ddlCity_change(){ ... }
//         Image → click → function logo_click(){ ... }
// - Helpers: UI.On, UI.SetValue, UI.GetValue, UI.SetPageTitle, UI.SetPageColor, UI.SetAutoWire
// - Title label (left-aligned) above any control via options.title
// - Sizing via options.width / options.height (numbers = px, or CSS string)
// - NEW: options.style = { any standard CSS } applied to the control (overrides width/height if present)
//        options.titleStyle / options.wrapperStyle for styling the title label or its wrapper
//
// Usage example:
//   UI.Create("Label", "lblTitle", "The RGB Colors Mixer App");
//   UI.Create("ScrollBar", "hsbBlue", "", {
//     title: "Blue (0–255):",
//     min: 0, max: 255, value: 128,
//     width: "260px",
//     style: { width: "340px", accentColor: "blue", marginTop: "6px" } // 'style' wins if both set
//   });
//
//   function hsbBlue_input(){ /* runs automatically on slide */ }
//
// Notes:
// - Keep helpers loaded BEFORE student code (sketch.js).
// - This file is safe to host on GitHub Pages and reference via <script src="...">.

(() => {
  // ====== Configuration / State =====================================================
  const app = document.getElementById("app") || document.body;
  let currentLine = null;
  let AUTO_WIRE_DEFAULT_EVENTS = true; // Toggle via UI.SetAutoWire(false) for advanced lessons

  // Default event name per control type (lowercase)
  const DEFAULT_EVENTS = {
    button: "click",
    textbox: "input",
    dropdown: "change",
    radiolist: "change",
    scrollbar: "input", // fires continuously while sliding
    image: "click",
    label: null,
    newline: null
  };

  // ====== Styles ===================================================================
  const styles = {
    line: "display:flex;justify-content:center;align-items:center;gap:12px;margin:10px 0;",
    label: "width:100%;text-align:center;font:600 1.5rem system-ui, sans-serif;",
    button: "padding:10px 16px;font:1rem system-ui, sans-serif;cursor:pointer;",
    textbox: "width:min(90%,520px);padding:10px;font:1rem system-ui, sans-serif;",
    select: "font:1rem system-ui, sans-serif;padding:8px;",
    radioWrap: "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;",
    radioLabel: "font:1rem system-ui, sans-serif;display:flex;align-items:center;gap:6px;",
    range: "width:min(90%,520px);",
    image: "max-width:90%;height:auto;display:block;",

    // Field stack used when options.title is present
    fieldWrap: "display:flex;flex-direction:column;align-items:flex-start;gap:6px;",
    title: "font:600 0.95rem system-ui, sans-serif;text-align:left;"
  };

  // ====== Utilities ================================================================
  function newLine() {
    const row = document.createElement("div");
    row.setAttribute("style", styles.line);
    app.appendChild(row);
    currentLine = row;
  }

  function ensureLine() {
    if (!currentLine) newLine();
    return currentLine;
  }

  function toArray(x) {
    if (Array.isArray(x)) return x;
    if (x == null) return [];
    return String(x).split(",").map(s => s.trim()).filter(Boolean);
  }

  // Attach default handler if a function named <id>_<event> exists
  function tryAutoWire(el, id, typeLower) {
    if (!AUTO_WIRE_DEFAULT_EVENTS) return;
    const evt = DEFAULT_EVENTS[typeLower];
    if (!evt || !id) return;

    const handlerName = `${id}_${evt}`; // e.g., btnSayHello_click
    const fn = window[handlerName];
    if (typeof fn === "function") {
      el.addEventListener(evt, fn);
      el.dataset.autowired = "true";
    }
  }

  function applyInlineStyle(target, style) {
    if (!target || style == null) return;
    if (typeof style === "string") {
      target.style.cssText += ";" + style;
    } else if (typeof style === "object") {
      Object.assign(target.style, style);
    }
  }

  // Apply width/height then arbitrary CSS via options.style (style takes precedence)
  function applySize(el, options = {}) {
    const { width, height, style } = options;
    if (width != null)  el.style.width  = typeof width  === "number" ? `${width}px`  : String(width);
    if (height != null) el.style.height = typeof height === "number" ? `${height}px` : String(height);
    if (style && typeof style === "object") {
      Object.assign(el.style, style); // style.* overrides width/height if both present
    }
  }

  // Wrap a control with a titled container (label above control) when options.title is provided.
  // Returns { controlEl, wrap } if a wrapper was created, otherwise returns controlEl directly.
  function wrapWithOptionalTitle(controlEl, id, options = {}) {
    const titleText = options.title;
    if (!titleText) return controlEl;

    const wrap = document.createElement("div");
    wrap.setAttribute("style", styles.fieldWrap);
    applyInlineStyle(wrap, options.wrapperStyle);  // optional wrapper CSS

    const lab = document.createElement("label");
    lab.setAttribute("style", styles.title);
    lab.textContent = String(titleText);
    if (id) lab.htmlFor = id; // accessibility: associates label with control
    applyInlineStyle(lab, options.titleStyle);     // optional title CSS

    wrap.appendChild(lab);
    wrap.appendChild(controlEl);

    return { controlEl, wrap };
  }

  // ====== Core API =================================================================
  // Create(type, id, text, options?)  <-- 'options' is optional (upward compatible)
  function Create(type, id = "", text = "", options = {}) {
    const t = String(type || "").toLowerCase();

    // Layout control
    if (t === "newline") {
      newLine();
      return null;
    }

    // Visual controls
    if (t === "label") {
      newLine(); // labels get their own centered row
      const el = document.createElement("div");
      if (id) el.id = id;
      el.textContent = text || "";
      el.setAttribute("style", styles.label);
      applySize(el, options);
      currentLine.appendChild(el);
      return el;
    }

    if (t === "button") {
      const el = document.createElement("button");
      if (id) el.id = id;
      el.textContent = text || "Button";
      el.setAttribute("style", styles.button);
      applySize(el, options);

      const line = ensureLine();
      const wrapped = wrapWithOptionalTitle(el, id, options);
      if (wrapped.wrap) line.appendChild(wrapped.wrap); else line.appendChild(el);

      tryAutoWire(el, id, t); // default 'click' → btnId_click()
      return el;
    }

    if (t === "textbox") {
      const el = document.createElement("input");
      el.type = options.type || "text";
      if (id) el.id = id;
      el.setAttribute("style", styles.textbox);
      if (options.placeholder) el.placeholder = options.placeholder;
      if (options.value != null) el.value = options.value;
      applySize(el, options);

      const line = ensureLine();
      const wrapped = wrapWithOptionalTitle(el, id, options);
      if (wrapped.wrap) line.appendChild(wrapped.wrap); else line.appendChild(el);

      tryAutoWire(el, id, t); // default 'input' → txtId_input()
      return el;
    }

    if (t === "dropdown") {
      const sel = document.createElement("select");
      if (id) sel.id = id;
      sel.setAttribute("style", styles.select);

      // Items can be provided as array or comma-separated string via 'text'
      const opts = toArray(text);
      opts.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });

      if (options.value != null) sel.value = options.value;
      applySize(sel, options);

      const line = ensureLine();
      const wrapped = wrapWithOptionalTitle(sel, id, options);
      if (wrapped.wrap) line.appendChild(wrapped.wrap); else line.appendChild(sel);

      tryAutoWire(sel, id, t); // default 'change' → ddlId_change()
      return sel;
    }

    if (t === "radiolist") {
      const wrapGroup = document.createElement("div");
      if (id) wrapGroup.id = id;
      wrapGroup.setAttribute("style", styles.radioWrap);

      const opts = toArray(text);
      opts.forEach((opt, i) => {
        const lab = document.createElement("label");
        lab.setAttribute("style", styles.radioLabel);
        const r = document.createElement("input");
        r.type = "radio";
        r.name = id || "radio";
        r.value = opt;
        if (options.value === opt || (options.value == null && i === 0)) r.checked = true;
        lab.appendChild(r);
        lab.appendChild(document.createTextNode(opt));
        wrapGroup.appendChild(lab);
      });

      applySize(wrapGroup, options);

      const line = ensureLine();
      const wrapped = wrapWithOptionalTitle(wrapGroup, id, options);
      if (wrapped.wrap) line.appendChild(wrapped.wrap); else line.appendChild(wrapGroup);

      // Default 'change' auto-wired on the container id
      tryAutoWire(wrapGroup, id, t);
      return wrapGroup;
    }

    if (t === "scrollbar") {
      const input = document.createElement("input");
      input.type = "range";
      if (id) input.id = id;
      input.min = options.min ?? 0;
      input.max = options.max ?? 100;
      input.step = options.step ?? 1;
      input.value = options.value ?? input.min;
      input.setAttribute("style", styles.range);
      applySize(input, options);

      const line = ensureLine();
      const wrapped = wrapWithOptionalTitle(input, id, options);
      if (wrapped.wrap) line.appendChild(wrapped.wrap); else line.appendChild(input);

      tryAutoWire(input, id, t); // default 'input' → vol_input()
      return input;
    }

    if (t === "image") {
      const img = document.createElement("img");
      if (id) img.id = id;
      img.src = text || "";
      img.alt = options.alt ?? id ?? "image";
      img.setAttribute("style", styles.image);
      if (options.widthPct)  img.style.width  = `${options.widthPct}%`;
      if (options.heightPct) img.style.height = `${options.heightPct}%`;
      applySize(img, options);

      const line = ensureLine();
      const wrapped = wrapWithOptionalTitle(img, id, options);
      if (wrapped.wrap) line.appendChild(wrapped.wrap); else line.appendChild(img);

      tryAutoWire(img, id, t); // default 'click' → imgId_click()
      return img;
    }

    console.warn(`UI.Create: Unknown type "${type}"`);
    return null;
  }

  // Attach an event handler (manual wiring still supported)
  function On(id, event, handler) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`UI.On: element #${id} not found`);
      return;
    }
    el.addEventListener(event, handler);
  }

  // Set value/text
  function SetValue(id, value) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`UI.SetValue: element #${id} not found`);
      return;
    }
    // Label created via 'Label' type uses DIV, change its textContent
    if (el.tagName === "DIV") {
      el.textContent = value;
      return;
    }
    // Inputs/selects have a 'value' property; others fall back to textContent
    if ("value" in el) el.value = value;
    else el.textContent = value;
  }

  // Get value/text (useful for radios/dropdowns/textboxes/scrollbars)
  function GetValue(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;

    // RadioList container: find checked input
    if (el.tagName === "DIV" && el.querySelector('input[type="radio"]')) {
      const checked = el.querySelector('input[type="radio"]:checked');
      return checked ? checked.value : undefined;
    }

    if (el.tagName === "SELECT" || el.tagName === "INPUT") return el.value;
    return el.textContent;
  }

  // Set the browser page/tab title
  function SetPageTitle(text) {
    document.title = text || "";
  }

  // Set page background color
  function SetPageColor(color) {
    document.body.style.backgroundColor = color || "";
  }

  // Toggle default-event auto-wiring
  function SetAutoWire(flag) {
    AUTO_WIRE_DEFAULT_EVENTS = !!flag;
  }

  // NEW: Set a single CSS style property on an element
  function SetStyle(id, property, value) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`UI.SetStyle: element #${id} not found`);
      return;
    }
    if (typeof property !== "string") {
      console.warn(`UI.SetStyle: property must be a string`);
      return;
    }
    el.style[property] = value;
  }

  // ====== Export API (read-only) ====================================================
  const API = Object.freeze({
    Create, On, SetValue, GetValue, SetPageTitle, SetPageColor, SetAutoWire, SetStyle,
    __version: "1.3.1"
  });

  Object.defineProperty(window, "UI", { value: API, writable: false, configurable: false });

  // Helpful console note so you can confirm which version loaded in p5.js console
  try { console.log("uiHelpers loaded:", API.__version); } catch {}
})();
