// uiHelpers.js
// Minimal UI helper library for beginner-friendly apps
// - All controls render line-by-line, horizontally centered.
// - Upward compatible: existing code using UI.Create/On/SetValue still works.
// - Features: options param, default-event auto-wiring, GetValue, SetPageTitle, SetPageColor.
// - NEW: options.title -> renders a left-aligned label above the control (except Label/NewLine).

(() => {
  // ====== Configuration / State =====================================================
  const app = document.getElementById("app") || document.body;
  let currentLine = null;
  let AUTO_WIRE_DEFAULT_EVENTS = true; // can be toggled via UI.SetAutoWire(false)

  // Default event name per control type (lowercase type names)
  const DEFAULT_EVENTS = {
    button: "click",
    textbox: "input",
    dropdown: "change",
    radiolist: "change",
    scrollbar: "input",
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

    // NEW for titled fields:
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

  // Apply width/height from options; accepts numbers (px) or CSS strings
  function applySize(el, options = {}) {
    const { width, height } = options;
    if (width != null)  el.style.width  = typeof width  === "number" ? `${width}px`  : String(width);
    if (height != null) el.style.height = typeof height === "number" ? `${height}px` : String(height);
  }

  // NEW: Wrap a control with a titled container (label above control) when options.title is provided.
  // Returns { controlEl, wrap } if a wrapper was created, otherwise returns controlEl directly.
  function wrapWithOptionalTitle(controlEl, id, options = {}) {
    const titleText = options.title;
    if (!titleText) return controlEl; // no wrapper needed, preserve old behavior

    const wrap = document.createElement("div");
    wrap.setAttribute("style", styles.fieldWrap);

    const lab = document.createElement("label");
    lab.setAttribute("style", styles.title);
    lab.textContent = String(titleText);
    if (id) lab.htmlFor = id; // accessibility

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
    if (el.tagName === "DIV") {
      el.textContent = value;
      return;
    }
    if ("value" in el) el.value = value;
    else el.textContent = value;
  }

  // Get value/text (useful for radios/dropdowns/textboxes)
  function GetValue(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;

    // RadioList container
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

  // Set page background color (optional helper)
  function SetPageColor(color) {
    document.body.style.backgroundColor = color || "";
  }

  // Toggle default-event auto-wiring
  function SetAutoWire(flag) {
    AUTO_WIRE_DEFAULT_EVENTS = !!flag;
  }

  // ====== Export API (read-only) ====================================================
  const API = Object.freeze({
    Create, On, SetValue, GetValue, SetPageTitle, SetPageColor, SetAutoWire
  });
  Object.defineProperty(window, "UI", { value: API, writable: false, configurable: false });
})();

