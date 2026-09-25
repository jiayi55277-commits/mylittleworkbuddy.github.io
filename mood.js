/* =====================================================================
 * mood.js — 心情记录
 * 5 档心情 + 一句心情记录，本周心情概览。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const MOODS = [
    { id: 'bad', emoji: '😭', label: '很差' },
    { id: 'meh2', emoji: '😕', label: '不太好' },
    { id: 'mid', emoji: '😐', label: '普通' },
    { id: 'good', emoji: '🙂', label: '不错' },
    { id: 'great', emoji: '🥰', label: '很开心' }
  ];
  const MOOD_MAP = {};
  MOODS.forEach(m => MOOD_MAP[m.id] = m);

  const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

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

  function getTodayMood() {
    const d = App.Storage.getData();
    return d.mood.history.filter(m => m.date === App.Storage.today())[0] || null;
  }

  function render(container) {
    const d = App.Storage.getData();
    const today = getTodayMood();
    const todayMoodId = today ? today.mood : null;

    const card = App.card({},
      App.sectionHead('☁️', '心情记录', '今天感觉怎么样？')
    );

    // 心情选择器
    const picker = App.el('div', { class: 'mood-picker' });
    MOODS.forEach(m => {
      const opt = App.el('div', { class: 'mood-opt' + (todayMoodId === m.id ? ' is-on' : '') },
        App.el('div', { class: 'mood-opt__emoji' }, m.emoji),
        App.el('div', { class: 'mood-opt__label' }, m.label)
      );
      opt.addEventListener('click', () => setMood(m.id));
      picker.appendChild(opt);
    });
    card.appendChild(picker);

    // 心情记录输入
    const noteInput = App.el('textarea', { class: 'textarea', placeholder: '写一句今天的心情吧… 不写也没关系 🌷' });
    if (today && today.note) noteInput.value = today.note;
    card.appendChild(App.el('div', { class: 'note-input' },
      noteInput,
      App.el('button', { class: 'btn btn--primary', onclick: () => saveNote(noteInput.value) }, '💾 保存心情')
    ));

    // 本周心情概览
    card.appendChild(App.el('div', { class: 'section-head', style: { marginTop: '10px' } },
      App.el('span', { class: 'section-head__icon' }, '📅'),
      App.el('span', { class: 'section-head__title', style: { fontSize: '14px' } }, '本周心情')
    ));

    const week = weekDates();
    const todayIdx = week.indexOf(App.Storage.today());
    const weekMoods = App.el('div', { class: 'mood-week' });
    week.forEach((date, i) => {
      const rec = d.mood.history.filter(m => m.date === date)[0];
      const m = rec ? MOOD_MAP[rec.mood] : null;
      const cell = App.el('div', { class: 'mood-day' + (m ? '' : ' mood-day--empty') + (i === todayIdx ? ' is-today' : '') },
        App.el('div', { class: 'mood-day__emoji' }, m ? m.emoji : '○'),
        App.el('div', { class: 'mood-day__label' }, (i === todayIdx ? '今天' : '周' + DAY_LABELS[i]))
      );
      weekMoods.appendChild(cell);
    });
    card.appendChild(weekMoods);

    container.appendChild(card);
  }

  function setMood(moodId) {
    const d = App.Storage.getData();
    const today = App.Storage.today();
    let rec = d.mood.history.filter(m => m.date === today)[0];
    if (rec) {
      rec.mood = moodId;
    } else {
      d.mood.history.push({ date: today, mood: moodId, note: '' });
    }
    App.Storage.save();
    App.toast('记录了今天的心情 ☁️');
    App.refresh();
  }

  function saveNote(note) {
    const d = App.Storage.getData();
    const today = App.Storage.today();
    let rec = d.mood.history.filter(m => m.date === today)[0];
    if (rec) {
      rec.note = note;
    } else {
      // 还没选心情就保存笔记 → 默认普通
      d.mood.history.push({ date: today, mood: 'mid', note: note });
    }
    App.Storage.save();
    App.toast('心情保存好啦 ☁️');
    App.refresh();
  }

  App.registerView({ id: 'mood', name: '心情', shortName: '心情', icon: '☁️', render: render });
})(window);
