// uiHelpers.js
// Minimal UI helper library for beginner-friendly apps
// All controls are created line-by-line, horizontally centered.

(() => {
  const app = document.getElementById("app") || document.body;
  let currentLine = null;

  const styles = {
    line: "display:flex;justify-content:center;align-items:center;gap:12px;margin:10px 0;",
    label: "width:100%;text-align:center;font:600 1.5rem system-ui, sans-serif;",
    button: "padding:10px 16px;font:1rem system-ui, sans-serif;cursor:pointer;",
    textbox: "width:min(90%,520px);padding:10px;font:1rem system-ui, sans-serif;"
  };

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

  // Create a visual control
  function Create(type, id = "", text = "") {
    const t = String(type || "").toLowerCase();

    if (t === "newline") {
      newLine();
      return null;
    }

    if (t === "label") {
      newLine(); // labels always start a fresh line
      const el = document.createElement("div");
      el.id = id;
      el.textContent = text;
      el.setAttribute("style", styles.label);
      currentLine.appendChild(el);
      return el;
    }

    if (t === "button") {
      const el = document.createElement("button");
      el.id = id;
      el.textContent = text || "Button";
      el.setAttribute("style", styles.button);
      ensureLine().appendChild(el);
      return el;
    }

    if (t === "textbox") {
      const el = document.createElement("input");
      el.type = "text";
      el.id = id;
      el.setAttribute("style", styles.textbox);
      ensureLine().appendChild(el);
      return el;
    }

    console.warn(`UI.Create: Unknown type "${type}"`);
    return null;
  }

  // Attach an event handler
  function On(id, event, handler) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`UI.On: element #${id} not found`);
      return;
    }
    el.addEventListener(event, handler);
  }

  // Set the value/text of a control
  function SetValue(id, value) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`UI.SetValue: element #${id} not found`);
      return;
    }
    if ("value" in el) el.value = value;
    else el.textContent = value;
  }

  // Set the browser page/tab title
  function SetPageTitle(text) {
    document.title = text || "";
  }

  // Export as read-only namespace
  const API = Object.freeze({ Create, On, SetValue, SetPageTitle });
  Object.defineProperty(window, "UI", { value: API, writable: false, configurable: false });
})();
