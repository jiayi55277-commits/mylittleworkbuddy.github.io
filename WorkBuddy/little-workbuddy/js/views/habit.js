/* =====================================================================
 * habit.js — 每周习惯追踪器
 * 默认 5 个习惯，周一到周日，每天可打勾。可增删自定义习惯。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
  // 本周 7 天日期（周一起）
  function weekDates() {
    const monday = App.Storage.mondayOf();
    const start = new Date(monday + 'T00:00:00');
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start);
      dd.setDate(start.getDate() + i);
      arr.push(App.Storage.formatDate(dd));
    }
    return arr;
  }

  function render(container) {
    const d = App.Storage.getData();
    const habits = d.habits.habits;
    const days = d.habits.days;
    const week = weekDates();
    const todayStr = App.Storage.today();
    const todayIdx = week.indexOf(todayStr);

    const card = App.card({},
      App.sectionHead('🌱', '每周习惯追踪', '坚持就是慢慢变好 🌷')
    );

    // 添加自定义习惯
    const habitInput = App.el('input', { class: 'input', placeholder: '加一个自己的小习惯', onkeydown: (e) => { if (e.key === 'Enter') addHabit(habitInput.value); } });
    card.appendChild(App.el('div', { class: 'todo-add', style: { marginBottom: '16px' } },
      habitInput,
      App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => addHabit(habitInput.value) }, '➕ 添加习惯')
    ));

    // 表格
    const tableWrap = App.el('div', { style: { overflowX: 'auto' } });
    const table = App.el('table', { class: 'habit-table' });

    // 表头
    const thead = App.el('thead', {});
    const headRow = App.el('tr', {}, App.el('th', {}, '习惯'));
    week.forEach((date, i) => {
      const th = App.el('th', {}, DAY_LABELS[i]);
      if (i === todayIdx) th.style.color = 'var(--primary)';
      headRow.appendChild(th);
    });
    headRow.appendChild(App.el('th', {}, ''));
    thead.appendChild(headRow);
    table.appendChild(thead);

    // 表体
    const tbody = App.el('tbody', {});
    if (!habits.length) {
      const r = App.el('tr', {});
      r.appendChild(App.el('td', { colspan: '9' }));
      tbody.appendChild(r);
    }
    habits.forEach(habit => {
      const tr = App.el('tr', {});
      const dayRecord = (days[todayStr] && days[todayStr][habit]) ? ' is-today' : '';
      tr.appendChild(App.el('td', {}, App.esc(habit)));
      week.forEach((date, i) => {
        const checked = days[date] && days[date][habit];
        const cell = App.el('td', { class: 'habit-cell' + (i === todayIdx ? ' is-today' : '') },
          App.el('div', { class: 'habit-check' + (checked ? ' is-on' : '') }, '✓')
        );
        cell.addEventListener('click', () => toggle(habit, date));
        tr.appendChild(cell);
      });
      // 删除按钮
      const delCell = App.el('td', {});
      delCell.appendChild(App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => removeHabit(habit) }, '🗑️'));
      tr.appendChild(delCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    card.appendChild(tableWrap);

    // 本周完成概览
    let weekDone = 0, weekTotal = habits.length * 7;
    habits.forEach(h => week.forEach(date => { if (days[date] && days[date][h]) weekDone++; }));
    if (weekTotal) {
      card.appendChild(App.el('div', { style: { marginTop: '16px' } },
        App.el('div', { class: 'learn-progress-head' },
          App.el('span', {}, '本周坚持度'),
          App.el('span', { style: { color: 'var(--primary)' } }, Math.round(weekDone / weekTotal * 100) + '%')
        ),
        App.el('div', { class: 'progress' },
          App.el('div', { class: 'progress__bar', style: { width: (weekDone / weekTotal * 100) + '%' } })
        )
      ));
    }

    container.appendChild(card);
  }

  function toggle(habit, date) {
    const d = App.Storage.getData();
    if (!d.habits.days[date]) d.habits.days[date] = {};
    d.habits.days[date][habit] = !d.habits.days[date][habit];
    App.Storage.save();
    // 今天全部完成则庆祝
    if (date === App.Storage.today()) {
      const today = d.habits.days[date];
      const all = d.habits.habits.every(h => today[h]);
      if (all && d.habits.habits.length) App.celebrate('今天的习惯全部完成啦！🌱');
    }
    App.refresh();
  }

  function addHabit(rawName) {
    const name = (rawName || '').trim();
    if (!name) { App.toast('写个习惯名字吧 🌷'); return; }
    const d = App.Storage.getData();
    if (d.habits.habits.indexOf(name) !== -1) { App.toast('这个习惯已经在了 🌱'); return; }
    d.habits.habits.push(name);
    App.Storage.save();
    App.toast('习惯加好啦 🌱');
    App.refresh();
  }

  function removeHabit(name) {
    const d = App.Storage.getData();
    d.habits.habits = d.habits.habits.filter(h => h !== name);
    // 顺便清理各天记录里的这个 key
    Object.keys(d.habits.days).forEach(date => { delete d.habits.days[date][name]; });
    App.Storage.save();
    App.toast('已移除习惯 🗑️');
    App.refresh();
  }

  App.registerView({ id: 'habit', name: '习惯', shortName: '习惯', icon: '🌱', render: render });
})(window);
