/* =====================================================================
 * progress.js — 📊 My Progress
 * 自动从已有数据计算每周/每月总结，加上 Buddy AI 反思。
 * 不让用户手动输入，全部来自 To-Do / Focus / Learning / Habit / Mood / Food / Wins。
 * 没有数据时显示 "No data yet 🌱"。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  let mode = 'week';            // 'week' | 'month'
  let monthCursor = null;       // { year, month } 默认当月

  function fmtMin(min) {
    min = Math.round(min || 0);
    if (!min) return '0 分';
    if (min < 60) return min + ' 分';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }

  function curMonth() {
    if (!monthCursor) { const n = new Date(); monthCursor = { year: n.getFullYear(), month: n.getMonth() }; }
    return monthCursor;
  }

  function render(container) {
    // ---- 顶部切换 + 月份选择 ----
    const toolbar = App.el('div', { class: 'progress-toolbar' });
    const seg = App.el('div', { class: 'seg' });
    const wBtn = App.el('button', { class: 'seg__btn' + (mode === 'week' ? ' is-on' : ''), onclick: () => { mode = 'week'; App.refresh(); } }, '🌱 每周');
    const mBtn = App.el('button', { class: 'seg__btn' + (mode === 'month' ? ' is-on' : ''), onclick: () => { mode = 'month'; App.refresh(); } }, '📅 每月');
    seg.appendChild(wBtn); seg.appendChild(mBtn);
    toolbar.appendChild(seg);

    // 日期导航
    const nav = App.el('div', { class: 'progress-nav' });
    if (mode === 'month') {
      const cm = curMonth();
      const label = App.Storage.monthLabel(cm.year, cm.month);
      nav.appendChild(App.el('button', { class: 'btn btn--ghost btn--icon', onclick: prevMonth }, '‹'));
      nav.appendChild(App.el('span', { class: 'progress-nav__label' }, label));
      nav.appendChild(App.el('button', { class: 'btn btn--ghost btn--icon', onclick: nextMonth }, '›'));
      nav.appendChild(App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: '8px' }, onclick: resetMonth }, '回到本月'));
    } else {
      nav.appendChild(App.el('span', { class: 'progress-nav__label' }, '本周 · ' + App.Storage.mondayOf() + ' 起'));
    }
    toolbar.appendChild(nav);
    container.appendChild(toolbar);

    if (mode === 'week') renderWeek(container);
    else renderMonth(container);
  }

  function prevMonth() { const c = curMonth(); c.month--; if (c.month < 0) { c.month = 11; c.year--; } App.refresh(); }
  function nextMonth() { const c = curMonth(); c.month++; if (c.month > 11) { c.month = 0; c.year++; } App.refresh(); }
  function resetMonth() { const n = new Date(); monthCursor = { year: n.getFullYear(), month: n.getMonth() }; App.refresh(); }

  /* ===================== 每周 ===================== */
  function renderWeek(container) {
    const s = App.AI.computeWeekStats(App.Storage.mondayOf());
    const hasData = s.todosTotal || s.focusSessions || s.learnMinutes || s.habitRates.some(h => h.done) || s.moodList.some(m => m.mood) || s.foodDaysLogged || s.wins.length;

    if (!hasData) {
      container.appendChild(App.card({}, App.emptyHint('本周还没有数据 🌱\n从一件小事开始记录吧～')));
      return;
    }

    // ✅ 任务
    container.appendChild(metricCard('✅', 'Weekly Tasks',
      App.el('div', { class: 'progress-big' }, s.todosDone + ' / ' + s.todosTotal + ' 个任务',
        App.el('span', { class: 'progress-big__sub' }, '完成率 ' + s.completionRate + '%')),
      progressBar(s.completionRate),
      s.todosDoneItems.length ? App.el('div', { class: 'progress-list' }, '已完成：', s.todosDoneItems.map(t => '· ' + t).join('\n')) : null
    ));

    // ⏱️ 专注
    container.appendChild(metricCard('⏱️', 'Focus Time',
      App.el('div', { class: 'progress-big' }, fmtMin(s.focusMinutes),
        App.el('span', { class: 'progress-big__sub' }, s.focusSessions + ' 次 Focus Session')),
      null
    ));

    // 🐍 学习
    container.appendChild(metricCard('🐍', 'Python',
      App.el('div', { class: 'progress-big' }, fmtMin(s.learnMinutes),
        App.el('span', { class: 'progress-big__sub' }, '学习了 ' + s.learnDays + ' 天')),
      s.topicsDone.length ? App.el('div', { class: 'progress-list' }, '完成主题：', s.topicsDone.join('、')) : null
    ));

    // 🌱 习惯
    container.appendChild(metricCard('🌱', 'Habit',
      ...s.habitRates.map(h => App.el('div', { class: 'habit-rate-row' },
        App.el('span', { class: 'habit-rate-row__name' }, h.name),
        App.el('div', { class: 'progress', style: { flex: '1' } }, App.el('div', { class: 'progress__bar', style: { width: h.rate + '%' } })),
        App.el('span', { class: 'habit-rate-row__num' }, h.done + '/' + h.total)
      ))
    ));

    // ☁️ 心情日历
    container.appendChild(metricCard('☁️', '本周心情',
      App.el('div', { class: 'mood-calendar' },
        s.moodList.map((m, i) => App.el('div', { class: 'mood-cal__cell' + (m.mood ? '' : ' is-empty') },
          App.el('div', { class: 'mood-cal__emoji' }, m.emoji),
          App.el('div', { class: 'mood-cal__label' }, '周' + '一二三四五六日'[i])
        ))
      ),
      moodSummary(s.moodCounts)
    ));

    // 🍱 饮食
    if (s.foodDaysLogged) {
      container.appendChild(metricCard('🍱', 'Food',
        App.el('div', { class: 'progress-big' }, '约 ' + s.foodAvgCal + ' kcal',
          App.el('span', { class: 'progress-big__sub' }, '本周日均（估算）')),
        App.el('div', { class: 'progress-sub' }, '记录了 ' + s.foodDaysLogged + ' 天 · 估算值仅供参考')
      ));
    }

    // ✨ 本周小成就
    if (s.wins.length) {
      container.appendChild(metricCard('✨', '本周小成就',
        App.el('div', { class: 'wins-mini' }, s.wins.map(w => App.el('div', { class: 'wins-mini__item' }, '✨ ' + App.esc(w.text))))
      ));
    }

    // 🤖 Buddy 周反思
    container.appendChild(reflectionCard('week', { monday: App.Storage.mondayOf() }));
  }

  /* ===================== 每月 ===================== */
  function renderMonth(container) {
    const c = curMonth();
    const s = App.AI.computeMonthStats(c.year, c.month);
    const hasData = s.todosTotal || s.focusSessions || s.learnMinutes || s.habitRates.some(h => h.done) || Object.keys(s.moodCounts).length || s.foodDaysLogged || s.wins.length;

    if (!hasData) {
      container.appendChild(App.card({}, App.emptyHint(s.monthLabel + ' 还没有数据 🌱\n时间会慢慢填满这一页的～')));
      return;
    }

    container.appendChild(App.el('div', { class: 'progress-month-head' }, s.monthLabel));

    // 📈 Monthly Overview
    container.appendChild(metricCard('📈', 'Monthly Overview',
      App.el('div', { class: 'overview-grid' },
        ovBox(s.todosDone + '/' + s.todosTotal, '完成任务', '率 ' + s.completionRate + '%'),
        ovBox(fmtMin(s.focusMinutes), '专注时间', s.focusSessions + ' 次'),
        ovBox(fmtMin(s.learnMinutes), 'Python 学习', s.learnDays + ' 天'),
        ovBox(s.wins.length, '小成就', '本月记录')
      )
    ));

    // 🌱 Habit 完成率
    container.appendChild(metricCard('🌱', 'Habit 本月',
      ...s.habitRates.map(h => App.el('div', { class: 'habit-rate-row' },
        App.el('span', { class: 'habit-rate-row__name' }, h.name),
        App.el('div', { class: 'progress', style: { flex: '1' } }, App.el('div', { class: 'progress__bar', style: { width: h.rate + '%' } })),
        App.el('span', { class: 'habit-rate-row__num' }, h.done + '/' + h.total)
      ))
    ));

    // ☁️ Mood 概览
    container.appendChild(metricCard('☁️', 'Mood 本月',
      moodSummary(s.moodCounts)
    ));

    // 🍱 Food
    if (s.foodDaysLogged) {
      container.appendChild(metricCard('🍱', 'Food 本月',
        App.el('div', { class: 'progress-big' }, '约 ' + s.foodAvgCal + ' kcal',
          App.el('span', { class: 'progress-big__sub' }, '日均估算')),
        App.el('div', { class: 'progress-sub' }, '记录了 ' + s.foodDaysLogged + ' 天 · 估算值')
      ));
    }

    // 📊 Monthly Trends（按周）
    if (s.weeklyTrend && s.weeklyTrend.length) {
      container.appendChild(metricCard('📊', 'Monthly Trends',
        trendChart(s.weeklyTrend)
      ));
    }

    // 🏆 Monthly Little Wins 自动发现
    const autoWins = detectMonthlyWins(s);
    if (autoWins.length) {
      container.appendChild(metricCard('🏆', 'Monthly Little Wins',
        App.el('div', { class: 'wins-mini' }, autoWins.map(w => App.el('div', { class: 'wins-mini__item' }, '✨ ' + w)))
      ));
    }

    // 🤖 Buddy 月反思
    container.appendChild(reflectionCard('month', { year: c.year, month: c.month }));
  }

  function detectMonthlyWins(s) {
    const out = [];
    if (s.learnDays >= 7) out.push('连续学习 Python ' + s.learnDays + ' 天');
    if (s.todosDone >= 10) out.push('完成 ' + s.todosDone + ' 个任务');
    if (s.focusMinutes >= 600) out.push('专注超过 ' + Math.round(s.focusMinutes / 60) + ' 小时');
    (s.habitRates || []).forEach(h => { if (h.done >= 20) out.push('坚持「' + h.name + '」' + h.done + ' 天'); });
    (s.habitRates || []).forEach(h => { if (h.rate >= 90 && h.total >= 28) out.push('「' + h.name + '」几乎全勤 🌷'); });
    return out.slice(0, 6);
  }

  /* ===================== 反思卡片 ===================== */
  function reflectionCard(scope, ref) {
    const card = App.card({ id: 'reflection-card' },
      App.sectionHead('🤖', scope === 'month' ? 'Buddy\'s Monthly Reflection' : 'Buddy\'s Weekly Reflection', '根据你的真实数据生成')
    );
    const body = App.el('div', { class: 'ai-reflection', id: 'ai-reflection-body' });
    card.appendChild(body);

    // 先放本地反思（即时、免费、基于真实数据）
    const local = App.AI.generateReflection.length ? null : null; // placeholder
    renderReflection(body, scope, ref, true);

    // 配置了 API 时，提供「让 AI 写一段」按钮
    const actions = App.el('div', { class: 'reflection-actions' });
    if (App.AI.isConfigured()) {
      actions.appendChild(App.el('button', {
        class: 'btn btn--primary btn--sm',
        id: 'gen-reflection-btn',
        onclick: () => genReflection(body, scope, ref)
      }, '✨ 让 AI 写一段'));
    } else {
      actions.appendChild(App.el('div', { class: 'food-notice', style: { marginBottom: '0' } }, '当前是本地反思（基于真实数据）。配置 AI 后可获得更丰富的版本。'));
    }
    card.appendChild(actions);
    return card;
  }

  function renderReflection(body, scope, ref, useLocal) {
    App.clear(body);
    if (useLocal) {
      // 本地反思是同步的
      const s = scope === 'month' ? App.AI.computeMonthStats(ref.year, ref.month) : App.AI.computeWeekStats(ref.monday);
      const txt = App.AI._localBuddy ? null : null;
      // 直接调用 generateReflection 的本地路径：用一个不触发 API 的方式
      // 这里通过临时清空 config 来走本地分支 —— 太 hack，改为直接内联本地反思
      body.appendChild(App.el('div', { class: 'ai-reflection__text', html: App.esc(localReflectionText(scope, s)).replace(/\n/g, '<br>') }));
    }
  }

  async function genReflection(body, scope, ref) {
    const btn = document.getElementById('gen-reflection-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Buddy 正在写…'; }
    App.clear(body);
    body.appendChild(App.el('div', { class: 'ai-msg__bubble ai-msg__bubble--loading' }, '正在根据你的数据写一段… 🌷'));
    try {
      const txt = await App.AI.generateReflection(scope, ref);
      App.clear(body);
      body.appendChild(App.el('div', { class: 'ai-reflection__text', html: App.esc(txt).replace(/\n/g, '<br>') }));
    } catch (e) {
      App.clear(body);
      body.appendChild(App.el('div', { class: 'ai-reflection__text' }, '生成失败：' + (e.message || '') + ' 🌷'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 写一段'; }
    }
  }

  // 本地反思文本（与 ai.js 的 localReflection 一致，但同步可用）
  function localReflectionText(scope, s) {
    const period = scope === 'month' ? s.monthLabel : '这周';
    const parts = [];
    if (s.todosTotal) parts.push(period + '你完成了 ' + s.todosDone + '/' + s.todosTotal + ' 个任务（完成率 ' + s.completionRate + '%）');
    if (s.focusSessions) parts.push('专注了 ' + s.focusSessions + ' 个番茄（约 ' + fmtMin(s.focusMinutes) + '）');
    if (s.learnMinutes) parts.push('学习 Python 约 ' + fmtMin(s.learnMinutes) + (s.learnDays ? '，学了 ' + s.learnDays + ' 天' : ''));
    if (s.topicsDone && s.topicsDone.length) parts.push('完成的主题：' + s.topicsDone.join('、'));
    if (s.habitRates && s.habitRates.length) {
      const best = s.habitRates.slice().sort((a, b) => b.rate - a.rate)[0];
      if (best && best.done) parts.push('坚持得最好的是「' + best.name + '」，' + best.done + '/' + best.total + ' 天');
    }
    if (s.wins && s.wins.length) parts.push('还记录了 ' + s.wins.length + ' 个小小成就 ✨');
    let out = parts.length ? parts.join('；') + '。' : (period + '还没有记录数据，没关系，从今天开始一点点积累就好 🌱');
    out += '\n\n你一直在按自己的节奏前进，这本身就很了不起。下个周期也慢慢来 🌷';
    return out;
  }

  /* ===================== 小组件 ===================== */
  function metricCard(icon, title, ...children) {
    return App.card({},
      App.sectionHead(icon, title),
      ...children
    );
  }

  function progressBar(pct) {
    return App.el('div', { class: 'progress', style: { marginTop: '10px' } },
      App.el('div', { class: 'progress__bar', style: { width: pct + '%' } }));
  }

  function ovBox(num, label, sub) {
    return App.el('div', { class: 'ov-box' },
      App.el('div', { class: 'ov-box__num' }, String(num)),
      App.el('div', { class: 'ov-box__label' }, label),
      sub ? App.el('div', { class: 'ov-box__sub' }, sub) : null
    );
  }

  function moodSummary(counts) {
    const EMOJI = { bad: '😭', meh2: '😕', mid: '😐', good: '🙂', great: '🥰' };
    const order = ['great', 'good', 'mid', 'meh2', 'bad'];
    const has = order.filter(k => counts[k]);
    if (!has.length) return App.el('div', { class: 'progress-sub' }, '还没有心情记录 ☁️');
    return App.el('div', { class: 'mood-summary' },
      has.map(k => App.el('span', { class: 'mood-summary__item' }, EMOJI[k] + ' ×' + counts[k]))
    );
  }

  function trendChart(trend) {
    const maxFocus = Math.max(1, ...trend.map(t => t.focusMinutes));
    const maxLearn = Math.max(1, ...trend.map(t => t.learnMinutes));
    const wrap = App.el('div', { class: 'trend-chart' });
    const legends = App.el('div', { class: 'trend-legend' },
      App.el('span', {}, '⏱️ 专注'), App.el('span', {}, '🐍 学习')
    );
    wrap.appendChild(legends);
    const grid = App.el('div', { class: 'trend-grid' });
    trend.forEach(t => {
      const col = App.el('div', { class: 'trend-col' },
        App.el('div', { class: 'trend-col__bars' },
          App.el('div', { class: 'trend-bar trend-bar--focus', style: { height: Math.max(4, (t.focusMinutes / maxFocus) * 100) + '%' } }),
          App.el('div', { class: 'trend-bar trend-bar--learn', style: { height: Math.max(4, (t.learnMinutes / maxLearn) * 100) + '%' } })
        ),
        App.el('div', { class: 'trend-col__label' }, 'W' + (trend.indexOf(t) + 1))
      );
      grid.appendChild(col);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  App.registerView({ id: 'progress', name: 'My Progress', shortName: '进度', icon: '📊', render: render });
})(window);
