// ==UserScript==
// @name         Endowus Goal Summer
// @namespace    https://github.com/sfdye/endowus-goal-summer
// @version      1.0.0
// @description  Select goals (portfolios) on the Endowus dashboard, filter by category, and see their combined value.
// @author       sfdye
// @license      MIT
// @homepageURL  https://github.com/sfdye/endowus-goal-summer
// @supportURL   https://github.com/sfdye/endowus-goal-summer/issues
// @match        https://app.sg.endowus.com/dashboard*
// @icon         https://app.sg.endowus.com/favicon.ico
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/sfdye/endowus-goal-summer/main/endowus-goal-summer.user.js
// @updateURL    https://raw.githubusercontent.com/sfdye/endowus-goal-summer/main/endowus-goal-summer.user.js
// ==/UserScript==

(function () {
  'use strict';

  // --- Config -------------------------------------------------------------
  // Goal cards on the dashboard. Selectors derived from the live DOM:
  //   card:  div.border-solid.p-24r.elevation-s.group
  //   value: div.body-l-strong.text-default whose text is "S$1,234.56"
  //   name:  first non-empty text node inside the card
  const CARD_SELECTOR = 'div.border-solid.p-24r.elevation-s.group';
  const VALUE_SELECTOR = 'div.body-l-strong.text-default';
  const CURRENCY_RE = /S\$[\d,]+\.\d{2}/;
  const STORAGE_KEY = 'endowus-goal-summer-selected';
  const FILTER_KEY = 'endowus-goal-summer-filter';

  // Section headers on the dashboard that a card can live under.
  const CATEGORIES = ['Investments', 'Cash Management'];
  const FILTERS = ['All', ...CATEGORIES];

  const parseAmount = (t) => parseFloat(t.replace(/[^\d.]/g, '')) || 0;
  const fmt = (n) =>
    'S$' + n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const loadSelected = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch {
      return new Set();
    }
  };
  const saveSelected = (set) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));

  // Determine which section ("Investments" / "Cash Management") a card belongs
  // to by walking up until an ancestor's text contains exactly one category label.
  function categoryOf(card) {
    let node = card;
    for (let i = 0; i < 8 && node.parentElement; i++) {
      node = node.parentElement;
      const txt = node.textContent;
      const hits = CATEGORIES.filter((c) => txt.includes(c));
      if (hits.length === 1) return hits[0];
    }
    return 'Other';
  }

  // --- Scrape goals -------------------------------------------------------
  function readGoals() {
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    const goals = [];
    for (const card of cards) {
      const valueEl = Array.from(card.querySelectorAll(VALUE_SELECTOR)).find(
        (el) => el.children.length === 0 && CURRENCY_RE.test(el.textContent)
      );
      if (!valueEl) continue;

      let name = '';
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        if (t) {
          name = t;
          break;
        }
      }
      if (!name) continue;
      goals.push({ name, value: parseAmount(valueEl.textContent), category: categoryOf(card) });
    }
    return goals;
  }

  // --- UI -----------------------------------------------------------------
  const selected = loadSelected();
  let activeFilter = localStorage.getItem(FILTER_KEY) || 'All';
  if (!FILTERS.includes(activeFilter)) activeFilter = 'All';
  let panel, listEl, totalEl, countEl, tabsEl;

  const inFilter = (g) => activeFilter === 'All' || g.category === activeFilter;

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'egs-panel';
    panel.innerHTML = `
      <div id="egs-header">
        <span id="egs-title">Goal Summer</span>
        <div>
          <button id="egs-all" title="Select all shown">all</button>
          <button id="egs-none" title="Clear shown">none</button>
          <button id="egs-min" title="Minimize">–</button>
        </div>
      </div>
      <div id="egs-body">
        <div id="egs-tabs"></div>
        <div id="egs-list"></div>
        <div id="egs-footer">
          <span id="egs-count">0 selected</span>
          <span id="egs-total">S$0.00</span>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #egs-panel { position: fixed; bottom: 20px; right: 20px; width: 300px; z-index: 999999;
        background: #fff; color: #1a1a1a; border: 1px solid #d0d0d0; border-radius: 10px;
        box-shadow: 0 6px 24px rgba(0,0,0,.18); font: 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif; }
      @media (prefers-color-scheme: dark) {
        #egs-panel { background: #1e1e1e; color: #eee; border-color: #3a3a3a; }
        #egs-panel button { color: #ddd; }
        #egs-footer { border-color: #3a3a3a; }
      }
      #egs-header { display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; cursor: move; border-bottom: 1px solid rgba(128,128,128,.25); }
      #egs-title { font-weight: 600; }
      #egs-header button { background: transparent; border: none; cursor: pointer; font-size: 12px;
        padding: 2px 6px; border-radius: 4px; }
      #egs-header button:hover { background: rgba(128,128,128,.2); }
      #egs-tabs { display: flex; gap: 4px; padding: 8px 12px 0; }
      #egs-tabs button { flex: 1; background: transparent; border: 1px solid rgba(128,128,128,.35);
        color: inherit; cursor: pointer; font-size: 11px; padding: 4px 6px; border-radius: 6px; white-space: nowrap; }
      #egs-tabs button:hover { background: rgba(128,128,128,.15); }
      #egs-tabs button.egs-active { background: #0a7f3f; border-color: #0a7f3f; color: #fff; }
      #egs-list { max-height: 300px; overflow-y: auto; padding: 6px 12px; }
      #egs-list label { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
      #egs-list .egs-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #egs-list .egs-val { font-variant-numeric: tabular-nums; opacity: .8; }
      #egs-list .egs-group { display: flex; justify-content: space-between; align-items: baseline;
        margin: 10px 0 2px; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; opacity: .6; }
      #egs-list .egs-group:first-child { margin-top: 2px; }
      #egs-list .egs-group .egs-subtotal { font-variant-numeric: tabular-nums; }
      #egs-footer { display: flex; justify-content: space-between; align-items: center;
        padding: 10px 12px; border-top: 1px solid rgba(128,128,128,.25); font-weight: 600; }
      #egs-total { font-size: 15px; color: #0a7f3f; }
      #egs-panel.egs-collapsed #egs-body { display: none; }`;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    listEl = panel.querySelector('#egs-list');
    totalEl = panel.querySelector('#egs-total');
    countEl = panel.querySelector('#egs-count');
    tabsEl = panel.querySelector('#egs-tabs');

    for (const f of FILTERS) {
      const btn = document.createElement('button');
      btn.textContent = f;
      btn.dataset.filter = f;
      btn.onclick = () => {
        activeFilter = f;
        localStorage.setItem(FILTER_KEY, f);
        render();
      };
      tabsEl.appendChild(btn);
    }

    // "all"/"none" act only on the goals currently shown by the active filter.
    panel.querySelector('#egs-all').onclick = () => {
      readGoals().filter(inFilter).forEach((g) => selected.add(g.name));
      saveSelected(selected);
      render();
    };
    panel.querySelector('#egs-none').onclick = () => {
      readGoals().filter(inFilter).forEach((g) => selected.delete(g.name));
      saveSelected(selected);
      render();
    };
    panel.querySelector('#egs-min').onclick = () =>
      panel.classList.toggle('egs-collapsed');

    makeDraggable(panel, panel.querySelector('#egs-header'));
  }

  function render() {
    const goals = readGoals().filter(inFilter);
    listEl.innerHTML = '';

    // Highlight the active filter tab.
    tabsEl.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('egs-active', b.dataset.filter === activeFilter)
    );

    // Group goals by category, preserving dashboard order.
    const order = [];
    const groups = new Map();
    for (const g of goals) {
      if (!groups.has(g.category)) {
        groups.set(g.category, []);
        order.push(g.category);
      }
      groups.get(g.category).push(g);
    }

    let total = 0;
    let count = 0;

    const addRow = (g) => {
      const isSel = selected.has(g.name);
      if (isSel) {
        total += g.value;
        count++;
      }
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" ${isSel ? 'checked' : ''}>
        <span class="egs-name" title="${g.name.replace(/"/g, '&quot;')}">${g.name}</span>
        <span class="egs-val">${fmt(g.value)}</span>`;
      label.querySelector('input').onchange = (e) => {
        if (e.target.checked) selected.add(g.name);
        else selected.delete(g.name);
        saveSelected(selected);
        render();
      };
      listEl.appendChild(label);
    };

    // Show a group header + selected-subtotal only when more than one
    // category is visible (i.e. the "All" filter).
    const showHeaders = order.length > 1;
    for (const cat of order) {
      const items = groups.get(cat);
      if (showHeaders) {
        const subtotal = items
          .filter((g) => selected.has(g.name))
          .reduce((s, g) => s + g.value, 0);
        const head = document.createElement('div');
        head.className = 'egs-group';
        head.innerHTML = `<span>${cat}</span><span class="egs-subtotal">${fmt(subtotal)}</span>`;
        listEl.appendChild(head);
      }
      items.forEach(addRow);
    }

    totalEl.textContent = fmt(total);
    countEl.textContent = `${count} selected`;
  }

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = ox + (e.clientX - sx) + 'px';
      el.style.top = oy + (e.clientY - sy) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => (dragging = false));
  }

  // --- Init & keep in sync with SPA re-renders ---------------------------
  function init() {
    if (document.getElementById('egs-panel')) return;
    if (readGoals().length === 0) return; // dashboard not ready yet
    buildPanel();
    render();

    // The dashboard is a SPA; re-scrape when the goal list changes.
    const mo = new MutationObserver(() => {
      if (!document.body.contains(panel)) return;
      clearTimeout(init._t);
      init._t = setTimeout(render, 400);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Wait for goal cards to appear (async data load).
  const ready = setInterval(() => {
    if (readGoals().length > 0) {
      clearInterval(ready);
      init();
    }
  }, 500);
  setTimeout(() => clearInterval(ready), 30000);
})();
