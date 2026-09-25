/* =====================================================================
 * learning.js — 我的学习旅程 🐍
 * 当前目标、今天学习时长、本周学习时长、已完成主题、总体进度（手动更新）。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  function fmtMin(min) {
    if (min < 60) return min + ' 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }

  function render(container) {
    const d = App.Storage.getData();
    const L = d.learning;

    const card = App.card({},
      App.sectionHead('🐍', '我的学习旅程', '一点一点，慢慢变强')
    );

    // 当前目标
    card.appendChild(App.el('div', { class: 'learn-goal' }, '🎯 当前目标：', App.el('span', { style: { color: 'var(--primary)' } }, App.esc(L.goal))));

    // 学习时长统计
    card.appendChild(App.el('div', { class: 'learn-stats' },
      statCard(fmtMin(L.todayMinutes || 0), '今天学习了'),
      statCard(fmtMin(L.weekMinutes || 0), '本周学习'),
      statCard(L.topics.filter(t => t.done).length + ' / ' + L.topics.length, '已完成主题')
    ));

    // 快速加时长按钮
    card.appendChild(App.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' } },
      [15, 25, 30, 60].map(m => App.el('button', { class: 'btn btn--sm', onclick: () => addMinutes(m) }, '+' + m + ' 分钟')),
      App.el('button', { class: 'btn btn--sm btn--ghost', onclick: resetToday }, '今日归零')
    ));

    // 总体进度（滑块手动更新）
    card.appendChild(App.el('div', { class: 'learn-progress-wrap' },
      App.el('div', { class: 'learn-progress-head' },
        App.el('span', {}, '🐍 Python Progress'),
        App.el('span', { id: 'learn-pct', style: { color: 'var(--primary)' } }, L.progress + '%')
      ),
      App.el('div', { class: 'range-row' },
        (() => {
          const r = App.el('input', {
            class: 'range', type: 'range', min: '0', max: '100', step: '1', value: String(L.progress),
            oninput: function () {
              L.progress = parseInt(this.value, 10);
              document.getElementById('learn-pct').textContent = L.progress + '%';
              document.getElementById('learn-bar').style.width = L.progress + '%';
              App.Storage.save();
            }
          });
          return r;
        })()
      ),
      App.el('div', { class: 'progress', style: { marginTop: '12px' } },
        App.el('div', { class: 'progress__bar', id: 'learn-bar', style: { width: L.progress + '%' } })
      )
    ));

    // 主题清单
    card.appendChild(App.el('div', { class: 'section-head', style: { marginTop: '8px' } },
      App.el('span', { class: 'section-head__icon' }, '📚'),
      App.el('span', { class: 'section-head__title', style: { fontSize: '14px' } }, '已完成的学习主题')
    ));

    const topicInput = App.el('input', { class: 'input', placeholder: '加一个学习主题，比如「变量与数据类型」', onkeydown: (e) => { if (e.key === 'Enter') addTopic(topicInput.value); } });
    card.appendChild(App.el('div', { class: 'todo-add', style: { marginBottom: '12px' } },
      topicInput,
      App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => addTopic(topicInput.value) }, '➕ 添加主题')
    ));

    const topics = App.el('div', { class: 'learn-topics' });
    if (!L.topics.length) {
      topics.appendChild(App.emptyHint('还没有添加主题，学完一个就加一个吧 🌱'));
    } else {
      L.topics.forEach(t => {
        topics.appendChild(App.el('div', { class: 'topic-item' + (t.done ? ' is-done' : '') },
          App.el('button', { class: 'topic-check' + (t.done ? ' is-on' : ''), onclick: () => toggleTopic(t.id) }, '✓'),
          App.el('span', { class: 'topic-item__name', onclick: () => toggleTopic(t.id) }, App.esc(t.name)),
          App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => removeTopic(t.id) }, '🗑️')
        ));
      });
    }
    card.appendChild(topics);
    container.appendChild(card);
  }

  function statCard(num, label) {
    return App.el('div', { class: 'learn-stat' },
      App.el('div', { class: 'learn-stat__num' }, num),
      App.el('div', { class: 'learn-stat__label' }, label)
    );
  }

  function addMinutes(m) {
    const d = App.Storage.getData();
    d.learning.todayMinutes = (d.learning.todayMinutes || 0) + m;
    d.learning.weekMinutes = (d.learning.weekMinutes || 0) + m;
    d.learning._lastDate = App.Storage.today();
    d.learning.weekStart = App.Storage.mondayOf();
    if (!d.learning.log) d.learning.log = [];
    d.learning.log.push({ date: App.Storage.today(), minutes: m });   // 供周/月统计
    App.Storage.save();
    App.toast('记录了 ' + m + ' 分钟 🐍');
    App.refresh();
  }

  function resetToday() {
    const d = App.Storage.getData();
    d.learning.todayMinutes = 0;
    App.Storage.save();
    App.toast('今日学习时长已清零 🌱');
    App.refresh();
  }

  function addTopic(rawName) {
    const name = (rawName || '').trim();
    if (!name) { App.toast('写个主题名字吧 🌷'); return; }
    const d = App.Storage.getData();
    d.learning.topics.push({ id: App.Storage.uid(), name: name, done: false });
    App.Storage.save();
    App.toast('主题加好啦 📚');
    App.refresh();
  }

  function toggleTopic(id) {
    const d = App.Storage.getData();
    const t = d.learning.topics.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneDate = t.done ? App.Storage.today() : '';   // 供周/月统计
    App.Storage.save();
    if (t.done) App.toast('又学完一个主题！🌷', { celebrate: true });
    App.refresh();
  }

  function removeTopic(id) {
    const d = App.Storage.getData();
    d.learning.topics = d.learning.topics.filter(x => x.id !== id);
    App.Storage.save();
    App.toast('已删除 🗑️');
    App.refresh();
  }

  App.registerView({ id: 'learning', name: '学习', shortName: '学习', icon: '🐍', render: render });
})(window);
