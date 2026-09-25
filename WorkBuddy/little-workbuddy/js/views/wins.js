/* =====================================================================
 * wins.js — 我的小小成就 ✨
 * 记录最近完成的小事情，鼓励自己，不竞争不排名。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const QUICK = [
    '今天完成 Python 学习',
    '完成所有 To-Do',
    '学习了 1 小时',
    '完成运动',
    '看完一本书',
    '早睡啦',
    '喝了足够的水',
    '保持专注'
  ];

  function render(container) {
    const d = App.Storage.getData();

    const card = App.card({},
      App.sectionHead('✨', '我的小小成就', '每一点小进步都值得被记住 🌷')
    );

    // 快速添加按钮
    const quickRow = App.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' } });
    QUICK.forEach(q => {
      quickRow.appendChild(App.el('button', { class: 'btn btn--sm', onclick: () => add(q) }, '＋ ' + q));
    });
    card.appendChild(quickRow);

    // 自定义输入
    const input = App.el('input', { class: 'input', placeholder: '或写一件你今天做到的小事…', onkeydown: (e) => { if (e.key === 'Enter') add(input.value); } });
    card.appendChild(App.el('div', { class: 'win-add' },
      input,
      App.el('button', { class: 'btn btn--primary', onclick: () => add(input.value) }, '✨ 记一笔')
    ));

    // 列表（按日期倒序）
    const list = App.el('div', { class: 'win-list' });
    const wins = d.wins.slice().sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
    if (!wins.length) {
      list.appendChild(App.el('div', { class: 'empty-hint' }, '还没有记录成就，你今天做到的每一件小事都算 ✨'));
    } else {
      wins.forEach((w, idx) => {
        list.appendChild(App.el('div', { class: 'win-item' },
          App.el('span', { class: 'win-item__icon' }, idx === 0 ? '🌟' : '✨'),
          App.el('span', { class: 'win-item__text' }, App.esc(w.text)),
          App.el('span', { class: 'win-item__date' }, w.date.slice(5).replace('-', '/')),
          App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => remove(w.id) }, '🗑️')
        ));
      });
    }
    card.appendChild(list);

    // 总计
    card.appendChild(App.el('div', { style: { textAlign: 'center', marginTop: '18px', color: 'var(--text-soft)', fontSize: '13px' } },
      '你已经累计记录了 ', App.el('b', { style: { color: 'var(--primary)', fontSize: '17px' } }, String(wins.length)), ' 个小小成就 ✨'
    ));

    container.appendChild(card);
  }

  function add(text) {
    text = (text || '').trim();
    if (!text) { App.toast('写一件做到的小事吧 🌷'); return; }
    const d = App.Storage.getData();
    d.wins.push({ id: App.Storage.uid(), text: text, date: App.Storage.today() });
    App.Storage.save();
    App.celebrate('又多了一个小成就！✨');
    App.refresh();
  }

  function remove(id) {
    const d = App.Storage.getData();
    d.wins = d.wins.filter(w => w.id !== id);
    App.Storage.save();
    App.toast('已移除 🗑️');
    App.refresh();
  }

  App.registerView({ id: 'wins', name: '成就', shortName: '成就', icon: '✨', render: render });
})(window);
