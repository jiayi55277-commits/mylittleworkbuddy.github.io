/* =====================================================================
 * ui.js — 共享 UI 工具：toast、彩屑庆祝、DOM helper
 * ===================================================================== */

(function (global) {
  'use strict';

  const App = global.App = global.App || {};

  // 视图注册表（必须在各 view 模块加载前就绪，故放在 ui.js）
  App.views = App.views || {};
  App.registerView = function (view) { App.views[view.id] = view; };

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === 'dataset') {
          for (const dk in attrs[k]) node.dataset[dk] = attrs[k][dk];
        } else if (k === 'style' && typeof attrs[k] === 'object') {
          Object.assign(node.style, attrs[k]);
        } else if (attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    children.flat().forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  App.el = el;

  // 清空容器
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  App.clear = clear;

  // 转义文本，防注入
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  App.esc = esc;

  /* ---------- Toast 提示 ---------- */
  function toast(msg, opts) {
    opts = opts || {};
    const host = document.getElementById('toast-host');
    if (!host) return;
    const t = el('div', { class: 'toast' + (opts.celebrate ? ' toast--celebrate' : '') }, msg);
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, opts.duration || 1800);
  }
  App.toast = toast;

  /* ---------- 彩屑庆祝 ---------- */
  const CONFETTI_COLORS = ['#a98be6', '#8f6fc9', '#b894d6', '#c9a0dc', '#d4c5f9', '#9ee5c4'];
  function confetti(count) {
    const host = document.getElementById('confetti-host');
    if (!host) return;
    const n = count || 28;
    for (let i = 0; i < n; i++) {
      const piece = el('div', { class: 'confetti-piece' });
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      piece.style.animationDuration = (1 + Math.random() * 0.6) + 's';
      piece.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      host.appendChild(piece);
      setTimeout(() => piece.remove(), 2000);
    }
  }
  App.confetti = confetti;

  // 庆祝 toast + 彩屑的组合
  function celebrate(msg) {
    confetti();
    toast(msg || '太棒啦！✨', { celebrate: true, duration: 2000 });
  }
  App.celebrate = celebrate;

  /* ---------- 卡片快速构造 ---------- */
  function card(opts, ...children) {
    const cls = 'card' + (opts && opts.hover ? ' card--hover' : '');
    const node = el('div', { class: cls });
    if (opts && opts.id) node.id = opts.id;
    if (opts && opts.dataset) for (const k in opts.dataset) node.dataset[k] = opts.dataset[k];
    children.flat().forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  App.card = card;

  function sectionHead(icon, title, sub) {
    return el('div', { class: 'section-head' },
      el('span', { class: 'section-head__icon' }, icon),
      el('span', { class: 'section-head__title' }, title),
      sub ? el('span', { class: 'section-head__sub' }, sub) : null
    );
  }
  App.sectionHead = sectionHead;

  function emptyHint(text) {
    return el('div', { class: 'empty-hint' }, text);
  }
  App.emptyHint = emptyHint;
})(window);
