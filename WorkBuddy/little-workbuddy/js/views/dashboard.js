/* =====================================================================
 * dashboard.js — 首页 Dashboard
 * 显示问候、日期、每日鼓励，以及各模块的概览统计。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const ENCOURAGES = [
    '今天也要一点一点变好呀 🌷',
    '不用很厉害，慢慢来就好 🌱',
    '把今天过好，就是对未来最好的交代 ✨',
    '专注当下的每一小步，都是在变强 🐍',
    '今天的你，已经比昨天多知道一点点啦 ☁️',
    '慢慢来，比较快 🍃',
    '再难的事情，拆成小步就不可怕啦 🌷',
    '休息也是变好的一部分，记得喝水哦 💧',
    '完成比完美更重要，开始就是一半 🌱',
    '你认真生活的样子，超可爱的 ✨'
  ];

  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pickEncourage() {
    const d = App.Storage.today();
    // 用日期做种子，保证同一天鼓励句稳定
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
    return ENCOURAGES[h % ENCOURAGES.length];
  }

  function fmtDate() {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return m + ' 月 ' + day + ' 日 · ' + WEEKDAYS[d.getDay()];
  }

  function hour() {
    const h = new Date().getHours();
    if (h < 6) return '夜深啦';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 22) return '晚上好';
    return '夜深啦';
  }

  App.registerView({
    id: 'dashboard',
    name: '首页',
    shortName: '首页',
    icon: '🏠',
    render: function (container) {
      // ---- Hero ----
      const hero = App.el('div', { class: 'hero' },
        App.el('div', { class: 'hero__greeting' }, 'Hi！' + hour() + ' 🌷'),
        App.el('div', { class: 'hero__date' }, '📅 ' + fmtDate()),
        App.el('div', { class: 'hero__encourage' }, pickEncourage())
      );
      container.appendChild(hero);

      // ---- 今日一句话 🌷 ----
      container.appendChild(dailyMessageCard());

      // ---- 概览统计 ----
      const d = App.Storage.getData();
      const grid = App.el('div', { class: 'grid grid-2' });

      // To-Do 进度
      const todos = d.todos;
      const doneN = todos.filter(t => t.done).length;
      grid.appendChild(summaryCard({
        icon: '✅', color: 'var(--mint-soft)', iconBg: 'var(--mint)',
        num: doneN + '/' + todos.length, label: '今日 To-Do',
        extra: todos.length ? App.el('div', { class: 'progress', style: { marginTop: '10px' } },
          App.el('div', { class: 'progress__bar', style: { width: (todos.length ? doneN / todos.length * 100 : 0) + '%' } })) : null,
        go: 'todo'
      }));

      // 专注 session
      grid.appendChild(summaryCard({
        icon: '⏱️', color: 'var(--sky-soft)', iconBg: 'var(--sky)',
        num: d.focus.sessionsToday + ' 个', label: '今日专注番茄',
        extra: App.el('div', { class: 'timer-session' }, '累计 ' + d.focus.totalSessions + ' 个'),
        go: 'timer'
      }));

      // Python 进度
      grid.appendChild(summaryCard({
        icon: '🐍', color: 'var(--mint-soft)', iconBg: 'var(--mint)',
        num: d.learning.progress + '%', label: d.learning.goal,
        extra: App.el('div', { class: 'progress', style: { marginTop: '10px' } },
          App.el('div', { class: 'progress__bar', style: { width: d.learning.progress + '%' } })),
        go: 'learning'
      }));

      // 今日心情
      const todayMood = (d.mood.history.filter(m => m.date === App.Storage.today())[0]) || null;
      const moodMap = { bad: ['😭', '很差'], meh2: ['😕', '不太好'], mid: ['😐', '普通'], good: ['🙂', '不错'], great: ['🥰', '很开心'] };
      const mk = todayMood ? todayMood.mood : null;
      grid.appendChild(summaryCard({
        icon: '☁️', color: 'var(--pink-soft)', iconBg: 'var(--pink)',
        num: mk ? moodMap[mk][0] : '—', label: '今日心情' + (mk ? '· ' + moodMap[mk][1] : ''),
        extra: App.el('div', { style: { fontSize: '12px', color: 'var(--text-soft)', marginTop: '2px' } }, mk ? '点击记录新的心情' : '还没记录今天的心情'),
        go: 'mood'
      }));

      // 今日习惯完成度
      const todayHabits = (d.habits.days[App.Storage.today()]) || {};
      const habitN = d.habits.habits.length;
      const habitDone = d.habits.habits.filter(h => todayHabits[h]).length;
      grid.appendChild(summaryCard({
        icon: '🌱', color: 'var(--peach-soft)', iconBg: 'var(--peach)',
        num: habitDone + '/' + habitN, label: '今日习惯',
        extra: App.el('div', { class: 'progress', style: { marginTop: '10px' } },
          App.el('div', { class: 'progress__bar', style: { width: (habitN ? habitDone / habitN * 100 : 0) + '%' } })),
        go: 'habit'
      }));

      // 快速笔记数 + 小成就数
      grid.appendChild(summaryCard({
        icon: '📝', color: 'var(--lavender)', iconBg: 'var(--primary)',
        num: d.notes.length + ' 条', label: '我的小笔记',
        extra: App.el('div', { style: { fontSize: '12px', color: 'var(--text-soft)' } }, '✨ ' + d.wins.length + ' 个小小成就'),
        go: 'notes'
      }));

      container.appendChild(grid);

      // ---- Buddy AI 迷你助手 ----
      container.appendChild(buddyMiniWidget());

      // ---- 今日时间表预览 ----
      const todaySched = d.schedule.slice().sort((a, b) => a.time.localeCompare(b.time)).slice(0, 4);
      const schedChildren = todaySched.length
        ? todaySched.map(s => App.el('div', { class: 'sched-item' },
            App.el('span', { class: 'sched-item__time' }, s.time),
            App.el('span', { class: 'sched-item__act' }, App.esc(s.activity)),
            App.el('span', { class: 'cat-tag cat-' + (s.category || 'learn') }, catLabel(s.category))
          ))
        : [App.emptyHint('今天还没有安排，去加几件事吧 🌷')];

      const schedCard = App.card({ hover: true },
        App.sectionHead('🗓️', '今日时间表'),
        App.el('div', { class: 'sched-list' }, schedChildren),
        App.el('div', { style: { marginTop: '14px' } },
          App.el('button', { class: 'btn btn--sm', onclick: () => App.navigate('schedule') }, '查看完整时间表 →')
        )
      );
      container.appendChild(schedCard);
    }
  });

  // 概览小卡片
  function summaryCard(opts) {
    const c = App.card({ hover: true, dataset: {} });
    c.style.cursor = 'pointer';
    c.addEventListener('click', () => App.navigate(opts.go));
    c.appendChild(App.el('div', { class: 'stat' },
      App.el('div', { class: 'stat__icon', style: { background: opts.iconBg } }, opts.icon),
      App.el('div', {},
        App.el('div', { class: 'stat__num' }, opts.num),
        App.el('div', { class: 'stat__label' }, opts.label)
      )
    ));
    if (opts.extra) c.appendChild(opts.extra);
    return c;
  }

  function catLabel(cat) {
    const map = { learn: '📚 学习', work: '💻 工作', eat: '🍜 吃饭', grow: '🌱 自我提升', rest: '☕ 休息', move: '🏃 运动' };
    return map[cat] || '📚 学习';
  }

  /* =====================================================================
   * 🌷 Today's Little Message
   * 每天一句话：本地根据 Mood/Habit/To-Do 状态挑选；配置 AI 后异步生成更个性版。
   * 可 ❤️ 收藏，可查看历史收藏。
   * ===================================================================== */
  function dailyMessageCard() {
    const d = App.Storage.getData();
    const today = App.Storage.today();
    const dm = d.dailyMessage;

    // 跨天重新生成（本地即时 + 异步 AI）
    if (dm.lastDate !== today) {
      dm.current = App.AI._localDailyMessage();
      dm.lastDate = today;
      App.Storage.save();
      if (App.AI.isConfigured()) {
        App.AI.generateDailyMessage().then(txt => {
          if (txt && dm.lastDate === today) {
            dm.current = txt;
            App.Storage.save();
            const node = document.getElementById('daily-msg-text');
            if (node) node.textContent = txt;
          }
        }).catch(() => {});
      }
    }

    const isFav = dm.favorites.some(f => f.text === dm.current);
    const card = App.el('div', { class: 'card daily-msg' },
      App.el('div', { class: 'daily-msg__head' },
        App.el('span', { class: 'section-head__icon' }, '🌷'),
        App.el('span', { class: 'daily-msg__title' }, "Today's Little Message"),
        App.el('button', { class: 'daily-msg__fav' + (isFav ? ' is-on' : ''), title: '收藏这句话', onclick: toggleFavMsg }, isFav ? '❤️' : '🤍')
      ),
      App.el('div', { class: 'daily-msg__text', id: 'daily-msg-text' }, dm.current || '今天也要一点一点变好呀 🌷'),
      App.el('div', { class: 'daily-msg__foot' },
        dm.favorites.length
          ? '已收藏 ' + dm.favorites.length + ' 句'
          : '点击 ❤️ 收藏喜欢的句子'
      )
    );
    if (dm.favorites.length) {
      const list = App.el('div', { class: 'daily-msg__favs' }, dm.favorites.slice(-3).reverse().map(f =>
        App.el('div', { class: 'daily-msg__fav-item' }, '❤️ ' + App.esc(f.text))
      ));
      card.appendChild(list);
    }
    return card;
  }

  function toggleFavMsg() {
    const d = App.Storage.getData();
    const dm = d.dailyMessage;
    const i = dm.favorites.findIndex(f => f.text === dm.current);
    if (i >= 0) { dm.favorites.splice(i, 1); App.toast('已取消收藏'); }
    else { dm.favorites.push({ text: dm.current, date: App.Storage.today() }); App.toast('收藏好啦 ❤️'); }
    App.Storage.save();
    App.refresh();
  }

  /* =====================================================================
   * 🤖 Buddy AI 迷你助手（首页小卡片）
   * ===================================================================== */
  function buddyMiniWidget() {
    const msgs = App.AI.getMessages();
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    const configured = App.AI.isConfigured();

    const card = App.el('div', { class: 'card buddy-mini' },
      App.el('div', { class: 'buddy-mini__head' },
        App.el('span', { class: 'buddy-mini__avatar' }, '🤖'),
        App.el('div', {},
          App.el('div', { class: 'buddy-mini__name' }, 'Buddy AI'),
          App.el('div', { class: 'buddy-mini__status' }, configured ? '已连接 · 了解你的日常' : '本地模式 · 基于你的数据')
        ),
        App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: 'auto' }, onclick: () => App.navigate('buddyai') }, '打开 →')
      ),
      App.el('div', { class: 'buddy-mini__preview' },
        last
          ? App.esc((last.content || '').slice(0, 120)) + (last.content.length > 120 ? '…' : '')
          : '想让我帮你安排今天、整理任务，还是总结一下这周？🌷'
      ),
      App.el('div', { class: 'buddy-mini__quick' },
        App.el('button', { class: 'ai-quick__btn', onclick: () => App.navigate('buddyai') }, '✨', App.el('span', {}, '规划今天')),
        App.el('button', { class: 'ai-quick__btn', onclick: () => App.navigate('buddyai') }, '📚', App.el('span', {}, '帮我学习')),
        App.el('button', { class: 'ai-quick__btn', onclick: () => App.navigate('buddyai') }, '✅', App.el('span', {}, '整理任务')),
        App.el('button', { class: 'ai-quick__btn', onclick: () => App.navigate('buddyai') }, '🌙', App.el('span', {}, '安排今晚'))
      )
    );
    return card;
  }
})(window);
