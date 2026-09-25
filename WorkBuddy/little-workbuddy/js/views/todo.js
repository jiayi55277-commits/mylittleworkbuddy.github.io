/* =====================================================================
 * todo.js — 今日 To-Do
 * 增删改查、优先级、勾选完成、完成进度，完成时小庆祝。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  let editingId = null; // 当前正在编辑的任务 id（null=新增模式）

  const PRIO_LABEL = { high: '高', medium: '中', low: '低' };

  function render(container) {
    const d = App.Storage.getData();
    const todos = d.todos;
    const doneN = todos.filter(t => t.done).length;

    const card = App.card({},
      App.sectionHead('✅', '今日 To-Do', todos.length ? doneN + '/' + todos.length + ' 完成' : '')
    );

    // 进度条
    if (todos.length) {
      const pct = Math.round(doneN / todos.length * 100);
      card.appendChild(App.el('div', { class: 'todo-progress' },
        App.el('span', { class: 'todo-progress__text' }, '今日进度：' + doneN + ' / ' + todos.length + ' 完成'),
        App.el('div', { class: 'progress', style: { flex: '1' } },
          App.el('div', { class: 'progress__bar', style: { width: pct + '%' } })
        )
      ));
    }

    // 添加/编辑输入区
    const editingTask = editingId ? todos.find(t => t.id === editingId) : null;
    const input = App.el('input', {
      class: 'input', type: 'text', placeholder: '想做什么呢？写下来吧 🌷',
      onkeydown: (e) => { if (e.key === 'Enter') submit(); }
    });
    if (editingTask) input.value = editingTask.text;
    let curPrio = editingTask ? editingTask.priority : 'medium';

    const picker = App.el('div', { class: 'prio-picker' });
    ['high', 'medium', 'low'].forEach(p => {
      const b = App.el('button', {
        class: 'prio-btn' + (p === curPrio ? ' is-on' : ''), dataset: { prio: p },
        onclick: function () {
          curPrio = p;
          picker.querySelectorAll('.prio-btn').forEach(x => x.classList.toggle('is-on', x.dataset.prio === p));
        }
      }, PRIO_LABEL[p]);
      picker.appendChild(b);
    });

    function submit() {
      const text = input.value.trim();
      if (!text) return;
      if (editingId) {
        const t = d.todos.find(t => t.id === editingId);
        if (t) { t.text = text; t.priority = curPrio; }
        editingId = null;
        App.toast('已更新任务 ✏️');
      } else {
        d.todos.push({ id: App.Storage.uid(), text: text, priority: curPrio, done: false, createdAt: Date.now() });
        App.toast('任务加好啦 ✅');
      }
      App.Storage.save();
      App.refresh();
    }

    card.appendChild(App.el('div', { class: 'todo-add' },
      input,
      picker,
      App.el('button', { class: 'btn btn--primary', onclick: submit }, editingId ? '💾 保存' : '➕ 添加')
    ));

    if (editingTask) setTimeout(() => { input.focus(); input.select(); }, 50);

    // 列表
    const list = App.el('div', { class: 'todo-list' });
    // 排序：未完成在前，高优先级在前
    const sorted = todos.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

    if (!sorted.length) {
      list.appendChild(App.emptyHint('还没有任务，加一个开始今天吧 🌱'));
    } else {
      sorted.forEach(t => {
        const check = App.el('button', {
          class: 'todo-check' + (t.done ? ' is-checked' : ''),
          onclick: () => toggle(t.id)
        }, '✓');
        const item = App.el('div', { class: 'todo-item' + (t.done ? ' is-done' : '') },
          check,
          App.el('span', { class: 'prio prio--' + t.priority }, PRIO_LABEL[t.priority]),
          App.el('span', { class: 'todo-item__text', onclick: () => editTask(t.id) }, App.esc(t.text)),
          App.el('div', { class: 'todo-item__actions' },
            App.el('button', { class: 'btn btn--ghost btn--icon', title: '编辑', onclick: () => editTask(t.id) }, '✏️'),
            App.el('button', { class: 'btn btn--ghost btn--icon', title: '删除', onclick: () => remove(t.id) }, '🗑️')
          )
        );
        list.appendChild(item);
      });
    }
    card.appendChild(list);
    container.appendChild(card);
  }

  function toggle(id) {
    const d = App.Storage.getData();
    const t = d.todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneDate = t.done ? App.Storage.today() : '';   // 供周/月统计使用
    App.Storage.save();
    // 全部完成时庆祝
    const allDone = d.todos.length && d.todos.every(x => x.done);
    if (t.done && allDone) {
      App.celebrate('今日 To-Do 全部完成！太棒啦 🎉');
    } else if (t.done) {
      App.toast('完成一项！🌷', { celebrate: true });
    }
    App.refresh();
  }

  function editTask(id) {
    editingId = id;
    App.refresh();
  }

  function remove(id) {
    const d = App.Storage.getData();
    d.todos = d.todos.filter(x => x.id !== id);
    App.Storage.save();
    App.toast('已删除 🗑️');
    App.refresh();
  }

  App.registerView({ id: 'todo', name: 'To-Do', shortName: '待办', icon: '✅', render: render });
})(window);
