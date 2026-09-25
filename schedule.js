/* =====================================================================
 * schedule.js — 今日时间表
 * 添加 时间 / 活动 / 分类，按时间排序展示时间线。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const CATS = [
    { id: 'learn', label: '📚 学习' },
    { id: 'work', label: '💻 工作' },
    { id: 'eat', label: '🍜 吃饭' },
    { id: 'grow', label: '🌱 自我提升' },
    { id: 'rest', label: '☕ 休息' },
    { id: 'move', label: '🏃 运动' }
  ];
  const CAT_MAP = {};
  CATS.forEach(c => CAT_MAP[c.id] = c.label);

  function render(container) {
    const d = App.Storage.getData();

    const card = App.card({},
      App.sectionHead('🗓️', '今日时间表', '把今天安排得舒服一点')
    );

    // 添加表单
    const timeInput = App.el('input', { class: 'input sched-time', type: 'time' });
    const actInput = App.el('input', { class: 'input sched-act', type: 'text', placeholder: '要做什么呢？', onkeydown: (e) => { if (e.key === 'Enter') add(); } });
    const catSel = App.el('select', { class: 'select' });
    CATS.forEach(c => catSel.appendChild(App.el('option', { value: c.id }, c.label)));

    function add() {
      const time = timeInput.value;
      const activity = actInput.value.trim();
      if (!time || !activity) { App.toast('填一下时间和活动吧 🌷'); return; }
      d.schedule.push({ id: App.Storage.uid(), time: time, activity: activity, category: catSel.value });
      App.Storage.save();
      App.toast('安排好啦 🗓️');
      App.refresh();
    }

    card.appendChild(App.el('div', { class: 'sched-add' },
      timeInput, actInput, catSel,
      App.el('button', { class: 'btn btn--primary', onclick: add }, '➕ 添加')
    ));

    // 列表（按时间排序）
    const list = App.el('div', { class: 'sched-list' });
    const sorted = d.schedule.slice().sort((a, b) => a.time.localeCompare(b.time));
    if (!sorted.length) {
      list.appendChild(App.emptyHint('今天的时间表还是空的，加几件事吧 🌷'));
    } else {
      sorted.forEach(s => {
        list.appendChild(App.el('div', { class: 'sched-item', style: { borderColor: catColor(s.category) } },
          App.el('span', { class: 'sched-item__time' }, s.time),
          App.el('span', { class: 'sched-item__act' }, App.esc(s.activity)),
          App.el('span', { class: 'cat-tag cat-' + s.category }, CAT_MAP[s.category] || s.category),
          App.el('button', { class: 'btn btn--ghost btn--icon', title: '删除', onclick: () => remove(s.id) }, '🗑️')
        ));
      });
    }
    card.appendChild(list);
    container.appendChild(card);
  }

  function remove(id) {
    const d = App.Storage.getData();
    d.schedule = d.schedule.filter(s => s.id !== id);
    App.Storage.save();
    App.toast('已移除 🗑️');
    App.refresh();
  }

  function catColor(cat) {
    const map = { learn: 'var(--sky)', work: 'var(--lavender)', eat: 'var(--peach)', grow: 'var(--mint)', rest: 'var(--yellow)', move: 'var(--pink)' };
    return map[cat] || 'var(--primary)';
  }

  App.registerView({ id: 'schedule', name: '时间表', shortName: '日程', icon: '🗓️', render: render });
})(window);
