/* =====================================================================
 * goals.js — 🎯 Goals & Journey
 * 目标 → 里程碑 → 任务 → 旅程记录 → 进度 → 反思 → 归档
 * 强调"陪我完成目标"的过程感，不是 KPI。
 * 数据保存在 localStorage（d.goals.monthly / d.goals.archive）。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  let openGoalId = null;       // 当前展开的目标，null = 列表
  let showArchive = false;

  const STATUS = {
    notstarted: { icon: '🌱', label: 'Not Started' },
    inprogress: { icon: '🌿', label: 'In Progress' },
    completed: { icon: '✨', label: 'Completed' },
    paused: { icon: '⏸️', label: 'Paused' }
  };

  function fmtMin(min) {
    min = Math.round(min || 0);
    if (!min) return '0 分';
    if (min < 60) return min + ' 分';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }

  function activeGoals() { return App.Storage.getData().goals.monthly; }
  function archiveGoals() { return App.Storage.getData().goals.archive; }
  function findGoal(id) {
    const d = App.Storage.getData();
    return d.goals.monthly.find(g => g.id === id) || d.goals.archive.find(g => g.id === id);
  }
  function goalProgress(g) {
    const ms = g.milestones || [];
    if (!ms.length) return 0;
    return Math.round(ms.filter(m => m.done).length / ms.length * 100);
  }
  function goalTotalMin(g) {
    return (g.journey || []).reduce((s, e) => s + (e.time || 0), 0);
  }

  function render(container) {
    if (openGoalId) {
      const g = findGoal(openGoalId);
      if (!g) { openGoalId = null; renderList(container); return; }
      renderDetail(container, g);
    } else {
      renderList(container);
    }
  }

  /* ===================== 列表 ===================== */
  function renderList(container) {
    const card = App.card({},
      App.sectionHead('🎯', 'Goals & Journey', '一点一点，走到想去的地方')
    );

    // 新建目标
    card.appendChild(App.el('button', { class: 'btn btn--primary btn--sm', style: { marginBottom: '14px' }, onclick: () => newGoalForm(card) }, '➕ 新建月目标'));

    const goals = activeGoals();
    if (!goals.length) {
      card.appendChild(App.emptyHint('还没有月目标 🌱\n想完成什么？先写下来，然后拆成小步骤就好～'));
    } else {
      goals.forEach(g => card.appendChild(goalListCard(g)));
    }

    // 归档
    const arch = archiveGoals();
    const archToggle = App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginTop: '8px' }, onclick: () => { showArchive = !showArchive; App.refresh(); } },
      showArchive ? '收起归档' : '🏆 查看归档（' + arch.length + '）');
    card.appendChild(archToggle);
    if (showArchive) {
      if (!arch.length) card.appendChild(App.el('div', { class: 'empty-hint', style: { padding: '10px 0' } }, '还没有完成的目标 🌱'));
      arch.forEach(g => card.appendChild(goalListCard(g, true)));
    }

    container.appendChild(card);
  }

  function goalListCard(g, isArch) {
    const st = STATUS[g.status] || STATUS.notstarted;
    const pct = goalProgress(g);
    const totalMin = goalTotalMin(g);
    const c = App.el('div', { class: 'goal-card' + (isArch ? ' is-arch' : '') });
    c.style.cursor = 'pointer';
    c.addEventListener('click', () => { openGoalId = g.id; App.refresh(); });
    c.appendChild(App.el('div', { class: 'goal-card__head' },
      App.el('span', { class: 'goal-card__title' }, App.esc(g.title)),
      App.el('span', { class: 'goal-status goal-status--' + g.status }, st.icon + ' ' + st.label)
    ));
    c.appendChild(App.el('div', { class: 'goal-card__meta' },
      g.deadline ? '📅 ' + g.deadline + ' · ' : '',
      (g.priority === 'high' ? '🔴 高' : g.priority === 'low' ? '🔵 低' : '🟡 中') + ' 优先 · ',
      (g.milestones || []).filter(m => m.done).length + '/' + (g.milestones || []).length + ' 里程碑 · ',
      (g.journey || []).length + ' 旅程 · ',
      fmtMin(totalMin)
    ));
    c.appendChild(App.el('div', { class: 'progress', style: { marginTop: '8px' } },
      App.el('div', { class: 'progress__bar', style: { width: pct + '%' } })));
    c.appendChild(App.el('div', { class: 'goal-card__pct' }, pct + '%'));
    return c;
  }

  function newGoalForm(card) {
    // 在列表上方插入一个表单（替换第一个 child 之后）
    const existing = document.getElementById('new-goal-form');
    if (existing) { existing.remove(); return; }
    const S = App.Storage;
    const titleIn = App.el('input', { class: 'input', placeholder: '目标名称，如「学会 Python 基础」' });
    const reasonIn = App.el('textarea', { class: 'textarea', placeholder: '为什么想完成？（可选，写下你的动机）', rows: '2' });
    const deadlineIn = App.el('input', { class: 'input', type: 'date', value: S.dateOffset(30) });
    let prio = 'medium';
    const prioPicker = App.el('div', { class: 'prio-picker' });
    [{ id: 'high', l: '🔴 高' }, { id: 'medium', l: '🟡 中' }, { id: 'low', l: '🔵 低' }].forEach(p => {
      const b = App.el('button', { class: 'prio-btn' + (p.id === prio ? ' is-on' : ''), dataset: { prio: p.id }, onclick: function () { prio = p.id; prioPicker.querySelectorAll('.prio-btn').forEach(x => x.classList.toggle('is-on', x.dataset.prio === p.id)); } }, p.l);
      prioPicker.appendChild(b);
    });
    const form = App.el('div', { class: 'card goal-new-form', id: 'new-goal-form' },
      App.el('div', { class: 'todo-add' }, titleIn),
      reasonIn,
      App.el('div', { class: 'todo-add' }, App.el('span', { style: { fontSize: '13px', color: 'var(--text-soft)' } }, '截止日期'), deadlineIn),
      prioPicker,
      App.el('div', { style: { marginTop: '10px' } },
        App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => createGoal(titleIn.value, reasonIn.value, deadlineIn.value, prio) }, '✓ 创建目标'),
        App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: '8px' }, onclick: () => { form.remove(); } }, '取消')
      )
    );
    card.insertBefore(form, card.children[1]);
  }

  function createGoal(title, reason, deadline, prio) {
    title = (title || '').trim();
    if (!title) { App.toast('写个目标名称吧 🌷'); return; }
    const d = App.Storage.getData();
    const g = {
      id: App.Storage.uid(), title: title, reason: reason.trim(), deadline: deadline,
      priority: prio, status: 'notstarted', createdAt: App.Storage.today(), completedAt: '',
      milestones: [], journey: [], weeklyFocus: {}, reflection: {}
    };
    d.goals.monthly.unshift(g);
    App.Storage.save();
    App.toast('目标创建好啦 🎯');
    openGoalId = g.id;
    App.refresh();
  }

  /* ===================== 详情 ===================== */
  function renderDetail(container, g) {
    const st = STATUS[g.status] || STATUS.notstarted;
    const pct = goalProgress(g);
    const totalMin = goalTotalMin(g);

    // 头部
    const head = App.card({},
      App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginBottom: '12px' }, onclick: () => { openGoalId = null; App.refresh(); } }, '‹ 返回目标列表'),
      App.el('div', { class: 'goal-detail__title' }, App.esc(g.title)),
      App.el('div', { class: 'goal-detail__status-row' },
        App.el('span', { class: 'goal-status goal-status--' + g.status }, st.icon + ' ' + st.label),
        (g.deadline ? App.el('span', { class: 'goal-detail__meta' }, '📅 ' + g.deadline) : null),
        App.el('span', { class: 'goal-detail__meta' }, (g.priority === 'high' ? '🔴 高' : g.priority === 'low' ? '🔵 低' : '🟡 中') + ' 优先')
      ),
      g.reason ? App.el('div', { class: 'goal-detail__reason' }, '🌷 为什么：', App.esc(g.reason)) : null
    );

    // 进度概览
    head.appendChild(App.el('div', { class: 'goal-overview' },
      ovStat(pct + '%', '完成进度'),
      ovStat((g.milestones || []).filter(m => m.done).length + '/' + (g.milestones || []).length, '里程碑'),
      ovStat((g.journey || []).length, '旅程记录'),
      ovStat(fmtMin(totalMin), '总时间')
    ));
    head.appendChild(App.el('div', { class: 'progress', style: { marginTop: '10px' } },
      App.el('div', { class: 'progress__bar', style: { width: pct + '%' } })));
    container.appendChild(head);

    // 里程碑
    container.appendChild(milestonesCard(g));

    // 本周重点
    container.appendChild(weeklyFocusCard(g));

    // 旅程
    container.appendChild(journeyCard(g));

    // 时间线
    container.appendChild(timelineCard(g));

    // 反思 / 完成
    container.appendChild(reflectionCardGoal(g));

    // 状态操作
    container.appendChild(statusActions(g));
  }

  function ovStat(num, label) {
    return App.el('div', { class: 'ov-box' },
      App.el('div', { class: 'ov-box__num' }, String(num)),
      App.el('div', { class: 'ov-box__label' }, label));
  }

  /* ---- 里程碑 ---- */
  function milestonesCard(g) {
    const card = App.card({},
      App.sectionHead('🧩', 'Milestones', '把目标拆成小步骤')
    );
    // AI 拆分
    card.appendChild(App.el('div', { style: { marginBottom: '12px' } },
      App.el('button', { class: 'btn btn--ghost btn--sm', id: 'goal-ai-breakdown', onclick: () => aiBreakdown(g) }, '🤖 让 AI 帮我拆分'),
      App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: '8px' }, onclick: () => addMilestonePrompt(g) }, '➕ 手动添加')
    ));
    const list = App.el('div', { class: 'milestone-list' });
    const ms = g.milestones || [];
    if (!ms.length) {
      list.appendChild(App.emptyHint('还没有拆分步骤 🌱\n让 AI 帮你拆，或手动加几个'));
    } else {
      ms.forEach(m => {
        const row = App.el('div', { class: 'milestone-item' + (m.done ? ' is-done' : '') },
          App.el('button', { class: 'topic-check' + (m.done ? ' is-on' : ''), onclick: () => toggleMilestone(g, m.id) }, '✓'),
          App.el('span', { class: 'milestone-item__name', onclick: () => toggleMilestone(g, m.id) }, App.esc(m.name)),
          App.el('div', { class: 'milestone-item__actions' },
            App.el('button', { class: 'btn btn--ghost btn--icon', title: '加入今日 To-Do', onclick: () => milestoneToTodo(g, m) }, '➕'),
            App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => removeMilestone(g, m.id) }, '🗑️')
          )
        );
        list.appendChild(row);
      });
    }
    card.appendChild(list);
    card.appendChild(App.el('div', { class: 'goal-card__pct' }, (ms.filter(m => m.done).length) + ' / ' + ms.length + ' completed · ' + pctOf(g) + '%'));
    return card;
  }
  function pctOf(g) { const ms = g.milestones || []; return ms.length ? Math.round(ms.filter(m => m.done).length / ms.length * 100) : 0; }

  function addMilestonePrompt(g) {
    const existing = document.getElementById('ms-add-form');
    if (existing) { existing.remove(); return; }
    const input = App.el('input', { class: 'input', placeholder: '步骤名称，如「Learn Loops」', onkeydown: (e) => { if (e.key === 'Enter') doAddMs(g, input.value); } });
    const form = App.el('div', { class: 'todo-add', id: 'ms-add-form', style: { marginTop: '8px' } },
      input,
      App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => doAddMs(g, input.value) }, '添加')
    );
    document.querySelector('.milestone-list').after(form);
    setTimeout(() => input.focus(), 50);
  }
  function doAddMs(g, name) {
    name = (name || '').trim();
    if (!name) { App.toast('写个步骤名 🌷'); return; }
    g.milestones = g.milestones || [];
    g.milestones.push({ id: App.Storage.uid(), name: name, done: false, doneDate: '' });
    if (g.status === 'notstarted') g.status = 'inprogress';
    App.Storage.save();
    App.toast('里程碑加好啦 🧩');
    App.refresh();
  }
  function toggleMilestone(g, id) {
    const m = (g.milestones || []).find(x => x.id === id);
    if (!m) return;
    m.done = !m.done;
    m.doneDate = m.done ? App.Storage.today() : '';
    if (g.status === 'notstarted') g.status = 'inprogress';
    App.Storage.save();
    App.refresh();
  }
  function removeMilestone(g, id) {
    g.milestones = (g.milestones || []).filter(x => x.id !== id);
    App.Storage.save();
    App.toast('已删除 🗑️');
    App.refresh();
  }
  function milestoneToTodo(g, m) {
    const d = App.Storage.getData();
    // 避免重复
    if (d.todos.some(t => t.text === m.name && !t.done)) { App.toast('已在今日任务里啦 🌷'); return; }
    d.todos.push({ id: App.Storage.uid(), text: m.name, priority: g.priority || 'medium', done: false, createdAt: Date.now(), doneDate: '' });
    App.Storage.save();
    App.toast('已加入今日 To-Do ➕');
  }

  async function aiBreakdown(g) {
    const btn = document.getElementById('goal-ai-breakdown');
    if (btn) { btn.disabled = true; btn.textContent = 'AI 拆分中…'; }
    try {
      const items = await App.AI.breakDownGoal(g.title, 4);
      if (items && items.length) {
        items.forEach(it => {
          if (!(g.milestones || []).some(m => m.name === it.name)) {
            g.milestones.push({ id: App.Storage.uid(), name: it.name, done: false, doneDate: '' });
          }
        });
        if (g.status === 'notstarted') g.status = 'inprogress';
        App.Storage.save();
        App.toast('AI 帮你拆好啦 🧩');
        App.refresh();
      } else {
        App.toast('AI 没返回步骤，试试手动添加 🌷');
      }
    } catch (e) {
      App.toast('拆分失败：' + (e.message || '') + ' 🌷');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🤖 让 AI 帮我拆分'; }
    }
  }

  /* ---- 本周重点 ---- */
  function weeklyFocusCard(g) {
    const week = App.Storage.mondayOf();
    g.weeklyFocus = g.weeklyFocus || {};
    const picks = g.weeklyFocus[week] || [];
    const card = App.card({},
      App.sectionHead('🗓️', '本周重点', '这周想推进哪些步骤？')
    );
    const ms = (g.milestones || []).filter(m => !m.done);
    if (!ms.length) {
      card.appendChild(App.emptyHint('所有里程碑都完成啦，或者还没拆步骤 🌱'));
      return card;
    }
    const list = App.el('div', { class: 'milestone-list' });
    ms.forEach(m => {
      const on = picks.indexOf(m.id) >= 0;
      const row = App.el('div', { class: 'milestone-item' + (on ? ' is-focus' : '') },
        App.el('button', { class: 'topic-check' + (on ? ' is-on' : ''), onclick: () => toggleWeeklyFocus(g, week, m.id) }, on ? '★' : '☆'),
        App.el('span', { class: 'milestone-item__name', onclick: () => toggleWeeklyFocus(g, week, m.id) }, App.esc(m.name))
      );
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }
  function toggleWeeklyFocus(g, week, msId) {
    g.weeklyFocus = g.weeklyFocus || {};
    const arr = g.weeklyFocus[week] || [];
    const i = arr.indexOf(msId);
    if (i >= 0) arr.splice(i, 1); else arr.push(msId);
    g.weeklyFocus[week] = arr;
    App.Storage.save();
    App.refresh();
  }

  /* ---- 旅程记录 ---- */
  function journeyCard(g) {
    const card = App.card({},
      App.sectionHead('🪜', 'My Journey', '记录完成目标的过程')
    );
    card.appendChild(App.el('button', { class: 'btn btn--primary btn--sm', style: { marginBottom: '14px' }, onclick: () => journeyForm(g, card) }, '➕ 记录一次旅程'));

    const entries = (g.journey || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!entries.length) {
      card.appendChild(App.emptyHint('还没有旅程记录 🌱\n学完一个步骤、做了一点事，都可以记下来'));
    } else {
      entries.forEach(e => card.appendChild(journeyEntryRow(g, e)));
    }
    return card;
  }

  function journeyEntryRow(g, e) {
    const MOOD_EMOJI = { bad: '😭', meh2: '😕', mid: '😐', good: '🙂', great: '🥰' };
    const row = App.el('div', { class: 'journey-entry' });
    if (e.photo) row.appendChild(App.el('img', { class: 'journey-entry__photo', src: e.photo, alt: '旅程照片' }));
    row.appendChild(App.el('div', { class: 'journey-entry__body' },
      App.el('div', { class: 'journey-entry__date' }, '📅 ' + (e.date || '') + (e.time ? ' · ' + e.time + ' 分钟' : '')),
      e.what ? App.el('div', { class: 'journey-entry__what' }, App.esc(e.what)) : null,
      e.step ? App.el('div', { class: 'journey-entry__line' }, '步骤：' + App.esc(e.step)) : null,
      e.problems ? App.el('div', { class: 'journey-entry__line journey-entry__line--prob' }, '问题：' + App.esc(e.problems)) : null,
      e.learned ? App.el('div', { class: 'journey-entry__line journey-entry__line--learn' }, '收获：' + App.esc(e.learned)) : null,
      e.next ? App.el('div', { class: 'journey-entry__line' }, '下一步：' + App.esc(e.next)) : null,
      e.mood ? App.el('div', { class: 'journey-entry__line' }, '心情：' + (MOOD_EMOJI[e.mood] || '○')) : null
    ));
    row.appendChild(App.el('div', { class: 'journey-entry__actions' },
      App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => journeyForm(g, null, e) }, '✏️'),
      App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => deleteJourney(g, e.id) }, '🗑️')
    ));
    return row;
  }

  function journeyForm(g, card, editing) {
    const existing = document.getElementById('journey-form');
    if (existing) { existing.remove(); return; }
    const S = App.Storage;
    const e = editing || { date: S.today(), what: '', step: '', time: '', problems: '', learned: '', mood: '', next: '', photo: '' };
    let photo = e.photo || '';
    const photoBox = App.el('div', { class: 'journey-photo-box' });

    const fileInput = App.el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { photo = r.result; renderPhotoPreview(photoBox, photo); };
      r.readAsDataURL(f);
      fileInput.value = '';
    });

    function renderPhotoPreview(box, p) {
      App.clear(box);
      if (p) {
        box.appendChild(App.el('img', { class: 'journey-photo-preview', src: p, alt: '预览' }));
      } else {
        box.appendChild(App.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => fileInput.click() }, '📷 添加照片（可选）'));
      }
    }
    renderPhotoPreview(photoBox, photo);

    const dateIn = App.el('input', { class: 'input', type: 'date', value: e.date });
    const whatIn = App.el('textarea', { class: 'textarea', placeholder: '今天做了什么？', rows: '2' }); whatIn.value = e.what;
    const stepIn = App.el('input', { class: 'input', placeholder: '完成了哪个步骤？' }); stepIn.value = e.step;
    const timeIn = App.el('input', { class: 'input', type: 'number', min: '0', placeholder: '花了多少分钟？' }); timeIn.value = e.time || '';
    const probIn = App.el('textarea', { class: 'textarea', placeholder: '遇到了什么问题？（可选）', rows: '2' }); probIn.value = e.problems;
    const learnIn = App.el('textarea', { class: 'textarea', placeholder: '学到了什么？（可选）', rows: '2' }); learnIn.value = e.learned;
    const nextIn = App.el('input', { class: 'input', placeholder: '下一步是什么？' }); nextIn.value = e.next;
    let mood = e.mood || '';
    const moodPicker = App.el('div', { class: 'prio-picker' });
    [['good', '🙂 不错'], ['mid', '😐 普通'], ['meh2', '😕 不好']].forEach(m => {
      const b = App.el('button', { class: 'prio-btn' + (mood === m[0] ? ' is-on' : ''), dataset: { m: m[0] }, onclick: function () { mood = m[0]; moodPicker.querySelectorAll('.prio-btn').forEach(x => x.classList.toggle('is-on', x.dataset.m === m[0])); } }, m[1]);
      moodPicker.appendChild(b);
    });

    const form = App.el('div', { class: 'card journey-form', id: 'journey-form' },
      App.el('div', { class: 'goal-form__title' }, editing ? '编辑旅程记录' : '新的旅程记录'),
      photoBox, fileInput,
      App.el('div', { class: 'goal-form__row' }, App.el('label', {}, '日期'), dateIn),
      whatIn, stepIn,
      App.el('div', { class: 'goal-form__row' }, App.el('label', {}, '花费时间（分钟）'), timeIn),
      probIn, learnIn, nextIn,
      App.el('div', {}, App.el('span', { style: { fontSize: '13px', color: 'var(--text-soft)' } }, '心情'), moodPicker),
      App.el('div', { style: { marginTop: '12px' } },
        App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => saveJourney(g, {
          date: dateIn.value, what: whatIn.value, step: stepIn.value,
          time: parseInt(timeIn.value, 10) || 0, problems: probIn.value,
          learned: learnIn.value, next: nextIn.value, mood: mood, photo: photo
        }, editing) }, '💾 保存'),
        App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: '8px' }, onclick: () => form.remove() }, '取消')
      )
    );
    card.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function saveJourney(g, data, editing) {
    if (!data.what.trim() && !data.step.trim()) { App.toast('写点什么吧 🌷'); return; }
    // 同步学习时长到 learning.log
    const g2 = g; // reference
    if (editing) {
      Object.assign(editing, data);
      // 如有学习时长变化，更新 learning 记录
      const oldMin = editing._oldMin || 0;
      adjustLearningTime(editing.date, data.time - oldMin);
      delete editing._oldMin;
    } else {
      g.journey = g.journey || [];
      g.journey.push(Object.assign({ id: App.Storage.uid() }, data));
      if (data.time) adjustLearningTime(data.date, data.time);
    }
    if (g.status === 'notstarted') g.status = 'inprogress';
    App.Storage.save();
    App.toast('旅程记录好啦 🪜');
    App.refresh();
  }
  // 调整 learning.log（旅程记录的时间也计入 Python 学习）
  function adjustLearningTime(date, deltaMin) {
    if (!deltaMin) return;
    const d = App.Storage.getData();
    if (!d.learning.log) d.learning.log = [];
    let entry = d.learning.log.find(x => x.date === date && x._goal);
    if (!entry) { entry = { date: date, minutes: 0, _goal: true }; d.learning.log.push(entry); }
    entry.minutes = Math.max(0, (entry.minutes || 0) + deltaMin);
  }

  function deleteJourney(g, id) {
    g.journey = (g.journey || []).filter(e => e.id !== id);
    App.Storage.save();
    App.toast('已删除 🗑️');
    App.refresh();
  }

  /* ---- 时间线 ---- */
  function timelineCard(g) {
    const card = App.card({},
      App.sectionHead('📖', 'Goal Journey Timeline', '你是怎么一步一步走到这里的')
    );
    // 合并：里程碑完成 + 旅程记录
    const events = [];
    (g.milestones || []).filter(m => m.done && m.doneDate).forEach(m => events.push({ date: m.doneDate, type: 'milestone', text: '完成步骤：' + m.name, icon: '✅' }));
    (g.journey || []).forEach(e => events.push({ date: e.date, type: 'journey', text: e.what || e.step || '记录', icon: '📝' }));
    events.push({ date: g.createdAt, type: 'create', text: '目标创建', icon: '🎯' });
    if (g.completedAt) events.push({ date: g.completedAt, type: 'complete', text: '目标完成！', icon: '✨' });
    events.sort((a, b) => a.date.localeCompare(b.date));

    if (!events.length) { card.appendChild(App.emptyHint('时间线会随着你的记录慢慢长出来 🌱')); return card; }
    const tl = App.el('div', { class: 'timeline' });
    events.forEach(ev => {
      tl.appendChild(App.el('div', { class: 'timeline__item' },
        App.el('div', { class: 'timeline__dot' }, ev.icon),
        App.el('div', { class: 'timeline__content' },
          App.el('div', { class: 'timeline__date' }, ev.date),
          App.el('div', { class: 'timeline__text' }, App.esc(ev.text))
        )
      ));
    });
    card.appendChild(tl);
    return card;
  }

  /* ---- 反思 / 完成 ---- */
  function reflectionCardGoal(g) {
    const card = App.card({},
      App.sectionHead('🌷', 'Goal Reflection', '完成后回望来时的路')
    );
    const r = g.reflection || {};
    if (g.status === 'completed' || g.completedAt) {
      // 已完成：展示反思
      if (r.whatLearned || r.hardest || r.nextStep || r.aiSummary) {
        card.appendChild(App.el('div', { class: 'goal-refl' },
          r.whatLearned ? App.el('div', { class: 'goal-refl__line' }, '✨ 我完成了什么 / 学到了：', App.el('br', {}), App.esc(r.whatLearned)) : null,
          r.hardest ? App.el('div', { class: 'goal-refl__line' }, '🌊 最困难的地方：', App.el('br', {}), App.esc(r.hardest)) : null,
          r.nextStep ? App.el('div', { class: 'goal-refl__line' }, '→ 下一步：', App.esc(r.nextStep)) : null
        ));
        if (r.aiSummary) {
          card.appendChild(App.el('div', { class: 'ai-reflection' },
            App.el('div', { class: 'ai-reflection__head' }, '🤖 Buddy 的总结'),
            App.el('div', { class: 'ai-reflection__text', html: App.esc(r.aiSummary).replace(/\n/g, '<br>') })
          ));
        }
        card.appendChild(App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginTop: '10px' }, onclick: () => reflectionForm(g, card) }, '✏️ 修改反思'));
        card.appendChild(App.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => aiGoalReflection(g) }, '🤖 重新生成 AI 总结'));
      } else {
        card.appendChild(App.el('div', { class: 'empty-hint', style: { padding: '14px 0' } }, '目标完成啦！写一段反思留念吧 ✨'));
        card.appendChild(App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => reflectionForm(g, card) }, '✍️ 写反思'));
      }
    } else {
      card.appendChild(App.el('div', { class: 'empty-hint', style: { padding: '14px 0' } }, '目标完成后，这里会出现反思页 🌷'));
      card.appendChild(App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => completeGoal(g, card) }, '✨ 标记为完成'));
    }
    return card;
  }

  function reflectionForm(g, card) {
    const existing = document.getElementById('goal-refl-form');
    if (existing) { existing.remove(); return; }
    const r = g.reflection || {};
    const learnIn = App.el('textarea', { class: 'textarea', placeholder: '我完成了什么？学到了什么？', rows: '3' }); learnIn.value = r.whatLearned || '';
    const hardIn = App.el('textarea', { class: 'textarea', placeholder: '最困难的地方是什么？', rows: '2' }); hardIn.value = r.hardest || '';
    const nextIn = App.el('input', { class: 'input', placeholder: '下一步想做什么？' }); nextIn.value = r.nextStep || '';
    const form = App.el('div', { class: 'card goal-form', id: 'goal-refl-form' },
      App.el('div', { class: 'goal-form__title' }, '✨ Goal Reflection'),
      learnIn, hardIn, nextIn,
      App.el('div', { style: { marginTop: '12px' } },
        App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => {
          g.reflection = g.reflection || {};
          g.reflection.whatLearned = learnIn.value.trim();
          g.reflection.hardest = hardIn.value.trim();
          g.reflection.nextStep = nextIn.value.trim();
          App.Storage.save();
          App.toast('反思保存好啦 🌷');
          App.refresh();
        } }, '💾 保存'),
        App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: '8px' }, onclick: () => form.remove() }, '取消')
      )
    );
    card.appendChild(form);
  }

  function completeGoal(g, card) {
    g.status = 'completed';
    g.completedAt = App.Storage.today();
    App.Storage.save();
    App.celebrate('目标完成啦！🎉');
    // 触发反思表单
    App.refresh();
    setTimeout(() => {
      const c = document.querySelector('.card');
      // reflectionForm 会在新渲染后基于当前 goal 调用
      const refreshedGoal = findGoal(g.id);
      if (refreshedGoal) {
        const cards = document.querySelectorAll('.card');
        cards.forEach(cc => { if (cc.querySelector && cc.querySelector('.goal-refl__line, .empty-hint')) { /* skip */ } });
      }
    }, 100);
  }

  async function aiGoalReflection(g) {
    App.toast('Buddy 正在根据旅程记录写总结… 🌷');
    try {
      const txt = await App.AI.generateGoalReflection(g);
      g.reflection = g.reflection || {};
      g.reflection.aiSummary = txt;
      g.reflection.aiSummaryDate = App.Storage.today();
      App.Storage.save();
      App.toast('AI 总结好啦 🤖');
      App.refresh();
    } catch (e) {
      App.toast('生成失败：' + (e.message || '') + ' 🌷');
    }
  }

  /* ---- 状态操作 ---- */
  function statusActions(g) {
    const card = App.card({}, App.sectionHead('⚙️', '目标状态'));
    const row = App.el('div', { class: 'goal-status-row' });
    Object.entries(STATUS).forEach(([id, st]) => {
      const b = App.el('button', {
        class: 'goal-status-pick' + (g.status === id ? ' is-on' : ''),
        onclick: () => {
          if (id === 'completed' && g.status !== 'completed') { completeGoal(g, card); return; }
          g.status = id;
          if (id !== 'completed') g.completedAt = '';
          App.Storage.save();
          App.refresh();
        }
      }, st.icon + ' ' + st.label);
      row.appendChild(b);
    });
    card.appendChild(row);
    // 归档按钮（已完成后）
    if (g.status === 'completed') {
      card.appendChild(App.el('div', { style: { marginTop: '12px' } },
        App.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => archiveGoal(g) }, '🏆 移到归档')
      ));
    }
    return card;
  }

  function archiveGoal(g) {
    const d = App.Storage.getData();
    d.goals.monthly = d.goals.monthly.filter(x => x.id !== g.id);
    d.goals.archive = d.goals.archive || [];
    d.goals.archive.unshift(g);
    App.Storage.save();
    openGoalId = null;
    App.toast('已归档 🏆');
    App.refresh();
  }

  App.registerView({ id: 'goals', name: '目标', shortName: '目标', icon: '🎯', render: render });
})(window);
