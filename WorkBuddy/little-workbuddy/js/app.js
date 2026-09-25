/* =====================================================================
 * app.js — 主程序：导航路由、跨天/跨周数据归零、视图调度
 * 各 view 模块在加载时通过 App.registerView 注册自己。
 * ===================================================================== */

(function (global) {
  'use strict';

  const App = global.App = global.App || {};
  App._current = null;

  // 完整导航顺序（registerView 已在 ui.js 中定义，各 view 模块加载时注册）
  const NAV_ORDER = ['dashboard', 'buddyai', 'todo', 'schedule', 'timer', 'learning', 'habit', 'mood', 'notes', 'food', 'goals', 'progress', 'wins'];

  // 移动端底部 tabbar 上的 4 个主入口 + "更多"
  const TAB_IDS = ['dashboard', 'todo', 'buddyai', 'timer'];
  const MORE_ID = 'more';

  // 支持 ?view=xxx 直接跳到某个视图（用于 PWA shortcuts）
  function initialView() {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      if (v && App.views[v]) return v;
    } catch (e) {}
    try {
      const saved = sessionStorage.getItem('mlwb_view');
      if (saved && App.views[saved]) return saved;
    } catch (e) {}
    return 'dashboard';
  }

  /* ---------- 跨天 / 跨周清理 ---------- */
  function rollOver() {
    const d = App.Storage.getData();
    const today = App.Storage.today();
    const monday = App.Storage.mondayOf();

    if (d.focus.lastSessionDate !== today) {
      d.focus.sessionsToday = 0;
      d.focus.lastSessionDate = today;
    }
    if (d.learning.weekStart !== monday) {
      d.learning.weekMinutes = 0;
      d.learning.weekStart = monday;
    }
    if (d.learning._lastDate !== today) {
      d.learning.todayMinutes = 0;
      d.learning._lastDate = today;
    }
    App.Storage.save();
  }

  /* ---------- 构建桌面端侧栏 ---------- */
  function buildSidebar() {
    const navMain = document.getElementById('nav-main');
    if (!navMain) return;
    App.clear(navMain);
    NAV_ORDER.forEach(id => {
      const v = App.views[id];
      if (!v) return;
      const btn = App.el('button', {
        class: 'nav-item', dataset: { view: id },
        onclick: () => App.navigate(id)
      },
        App.el('span', { class: 'nav-item__icon' }, v.icon),
        App.el('span', {}, v.name)
      );
      navMain.appendChild(btn);
    });
  }

  /* ---------- 构建底部 tabbar ---------- */
  function buildTabbar() {
    const tabbar = document.getElementById('tabbar');
    if (!tabbar) return;
    App.clear(tabbar);

    const tabs = TAB_IDS.concat([MORE_ID]);
    tabs.forEach(id => {
      const isMore = id === MORE_ID;
      const v = isMore ? null : App.views[id];
      if (!isMore && !v) return;

      const btn = App.el('button', {
        class: 'tabbar__btn', dataset: { tab: id },
        'aria-label': isMore ? '更多视图' : (v.shortName || v.name)
      },
        App.el('span', { class: 'tabbar__icon' }, isMore ? '🗂️' : v.icon),
        App.el('span', { class: 'tabbar__label' }, isMore ? '更多' : (v.shortName || v.name))
      );
      if (isMore) btn.id = 'tabbar-more';
      btn.addEventListener('click', () => {
        if (isMore) openMoreSheet();
        else App.navigate(id);
      });
      tabbar.appendChild(btn);
    });
  }

  function buildMoreGrid() {
    const grid = document.getElementById('more-grid');
    if (!grid) return;
    App.clear(grid);
    NAV_ORDER.forEach(id => {
      const v = App.views[id];
      if (!v) return;
      const tile = App.el('button', {
        class: 'more-tile', dataset: { view: id },
        onclick: () => { closeMoreSheet(); App.navigate(id); }
      },
        App.el('span', { class: 'more-tile__icon' }, v.icon),
        App.el('span', { class: 'more-tile__label' }, v.name)
      );
      grid.appendChild(tile);
    });
  }

  function openMoreSheet() {
    const sheet = document.getElementById('more-sheet');
    if (!sheet) return;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('is-open'));
  }
  function closeMoreSheet() {
    const sheet = document.getElementById('more-sheet');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    setTimeout(() => { sheet.hidden = true; }, 280);
  }

  /* ---------- 路由 ---------- */
  App.navigate = function (viewId) {
    const container = document.getElementById('view-container');
    App.clear(container);
    const view = App.views[viewId] || App.views.dashboard;

    // 桌面侧栏高亮
    document.querySelectorAll('#nav-main .nav-item').forEach(n => {
      n.classList.toggle('is-active', n.dataset.view === view.id);
    });
    // 底部 tabbar 高亮（如果当前视图不在 4 个主 tab 内，则高亮"更多"）
    document.querySelectorAll('.tabbar__btn').forEach(n => {
      const t = n.dataset.tab;
      const isMain = TAB_IDS.indexOf(view.id) >= 0;
      n.classList.toggle('is-active', t === view.id || (!isMain && t === MORE_ID));
    });

    const wrap = App.el('div', { class: 'view' });
    container.appendChild(wrap);

    try {
      view.render(wrap);
    } catch (e) {
      console.error('视图渲染失败：', view.id, e);
      wrap.appendChild(App.el('p', { class: 'empty-hint' }, '这个小桌面暂时打不开了，刷新试试看 🌷'));
    }

    App._current = view.id;
    try { sessionStorage.setItem('mlwb_view', view.id); } catch (e) {}

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------- 启动 ---------- */
  function start() {
    App.Storage.load();
    rollOver();
    buildSidebar();
    buildTabbar();
    buildMoreGrid();

    document.getElementById('more-close').addEventListener('click', closeMoreSheet);
    document.getElementById('more-scrim').addEventListener('click', closeMoreSheet);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMoreSheet();
    });

    // 顶部菜单按钮 → 打开更多面板（移动端）
    document.getElementById('menu-btn').addEventListener('click', openMoreSheet);

    App.navigate(initialView());
  }

  document.addEventListener('DOMContentLoaded', start);

  App.refresh = function () {
    if (App._current) App.navigate(App._current);
  };
})(window);