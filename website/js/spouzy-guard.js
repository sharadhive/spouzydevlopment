/**
 * SPOUZY website guard (loaded on every page by spouzy-content.js)
 *   - right-click menu (with "Inspect" and "View page source") is switched off, except in form fields
 *   - the developer-tools, view-source and save-page keyboard shortcuts are switched off
 *     (F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S; Cmd+Option+I/J/C/U and Cmd+U/S on Mac)
 *   - inside areas marked .sp-protect (the FAQ page) text cannot be selected, copied, cut or dragged
 * Note: a browser always receives the page to show it, so this stops casual copying and inspecting;
 * it cannot stop a determined technical person (browser menus, extensions, saving the page).
 */
(function () {
  'use strict';
  if (window.__spouzyGuard) return;
  window.__spouzyGuard = true;

  var d = document;
  function closest(el, sel) {
    while (el && el.nodeType !== 1) el = el.parentNode;
    return el && el.closest ? el.closest(sel) : null;
  }
  function inField(el) { return !!closest(el, 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'); }
  function inProtected(el) { return !!closest(el, '.sp-protect'); }

  d.addEventListener('contextmenu', function (e) {
    if (!inField(e.target)) e.preventDefault();
  }, true);

  d.addEventListener('keydown', function (e) {
    var code = e.code || '';
    var key = (e.key || '').toLowerCase();
    var letter = /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : key;
    var ctrl = e.ctrlKey || e.metaKey;
    var block =
      key === 'f12' || e.keyCode === 123 ||
      (ctrl && e.shiftKey && 'ijck'.indexOf(letter) !== -1 && letter) ||    // developer tools / console / inspect
      (e.metaKey && e.altKey && 'ijcu'.indexOf(letter) !== -1 && letter) ||  // Mac developer tools / source
      (ctrl && !e.shiftKey && !e.altKey && (letter === 'u' || letter === 's')); // view source, save page
    if (block) { e.preventDefault(); e.stopPropagation(); return; }
    // Ctrl+A / Ctrl+C inside the protected FAQ area
    if (ctrl && (letter === 'c' || letter === 'x' || letter === 'a') && inProtected(e.target) && !inField(e.target)) e.preventDefault();
  }, true);

  ['copy', 'cut'].forEach(function (type) {
    d.addEventListener(type, function (e) {
      if (inField(e.target)) return;
      var sel = window.getSelection ? window.getSelection() : null;
      var node = sel && sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : e.target;
      if (inProtected(node) || inProtected(e.target)) {
        e.preventDefault();
        if (e.clipboardData) e.clipboardData.setData('text/plain', '');
      }
    }, true);
  });
  d.addEventListener('selectstart', function (e) { if (inProtected(e.target) && !inField(e.target)) e.preventDefault(); }, true);
  d.addEventListener('dragstart', function (e) {
    if (inProtected(e.target) || (e.target && e.target.tagName === 'IMG')) e.preventDefault();
  }, true);
})();
