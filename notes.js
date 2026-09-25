/* =====================================================================
 * notes.js — 快速笔记
 * 临时想法 / Idea / Reminder / 学习笔记 / 想做的事。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  function render(container) {
    const d = App.Storage.getData();

    const card = App.card({},
      App.sectionHead('📝', '快速笔记', '想到什么就写下来 🌷')
    );

    const input = App.el('textarea', { class: 'textarea', placeholder: '临时想到的事、Idea、Reminder、学习笔记、想做的事…', onkeydown: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(input.value); } });
    card.appendChild(App.el('div', { class: 'note-input' },
      input,
      App.el('button', { class: 'btn btn--primary', onclick: () => add(input.value) }, '➕ 保存')
    ));

    const list = App.el('div', { class: 'note-list' });
    const notes = d.notes.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (!notes.length) {
      list.appendChild(App.emptyHint('还没有笔记，写点什么吧 🌱'));
    } else {
      notes.forEach(n => {
        list.appendChild(App.el('div', { class: 'note-item' },
          App.el('div', { class: 'note-item__body' }, App.esc(n.text)),
          App.el('span', { class: 'note-item__time' }, fmtTime(n.createdAt)),
          App.el('button', { class: 'btn btn--ghost btn--icon', title: '删除', onclick: () => remove(n.id) }, '🗑️')
        ));
      });
    }
    card.appendChild(list);
    container.appendChild(card);
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const m = d.getMonth() + 1, day = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    return m + '/' + day + ' ' + hh + ':' + mm;
  }

  function add(text) {
    text = (text || '').trim();
    if (!text) { App.toast('写点什么再保存吧 🌷'); return; }
    const d = App.Storage.getData();
    d.notes.push({ id: App.Storage.uid(), text: text, createdAt: Date.now() });
    App.Storage.save();
    App.toast('笔记保存好啦 📝');
    App.refresh();
  }

  function remove(id) {
    const d = App.Storage.getData();
    d.notes = d.notes.filter(n => n.id !== id);
    App.Storage.save();
    App.toast('已删除 🗑️');
    App.refresh();
  }

  App.registerView({ id: 'notes', name: '笔记', shortName: '笔记', icon: '📝', render: render });
})(window);
