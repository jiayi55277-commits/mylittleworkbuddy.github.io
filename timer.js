/* =====================================================================
 * timer.js — 专注计时器（番茄钟）
 * 25 分钟专注 / 5 分钟休息，开始·暂停·重置，记录今日 session。
 * 计时状态保存在模块级变量，跨视图导航期间不丢失（持续到完成或重置）。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const FOCUS_MIN = 25;
  const BREAK_MIN = 5;
  const RING_R = 104;
  const RING_C = 2 * Math.PI * RING_R; // 周长

  // 模块级状态
  const state = {
    mode: 'focus',      // 'focus' | 'break'
    total: FOCUS_MIN * 60,
    remaining: FOCUS_MIN * 60,
    running: false
  };
  let intervalId = null;

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function tick() {
    state.remaining--;
    if (state.remaining <= 0) {
      state.remaining = 0;
      state.running = false;
      clearInterval(intervalId);
      intervalId = null;
      onComplete();
    }
    paint();
  }

  function onComplete() {
    if (state.mode === 'focus') {
      // 记录一个专注 session
      const d = App.Storage.getData();
      d.focus.sessionsToday = (d.focus.sessionsToday || 0) + 1;
      d.focus.totalSessions = (d.focus.totalSessions || 0) + 1;
      d.focus.lastSessionDate = App.Storage.today();
      if (!d.focus.log) d.focus.log = [];
      d.focus.log.push({ date: App.Storage.today(), ts: Date.now() });   // 供周/月统计
      App.Storage.save();
      App.celebrate('一个专注番茄完成啦！休息一下 ☕');
      // 自动切到休息模式（不自动开始，等用户点）
      switchMode('break', false);
    } else {
      App.toast('休息结束，回来继续专注吧 🌷', { celebrate: true });
      switchMode('focus', false);
    }
    App.refresh();
  }

  function start() {
    if (state.running) return;
    state.running = true;
    intervalId = setInterval(tick, 1000);
    paintControls();
  }

  function pause() {
    state.running = false;
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    paintControls();
  }

  function reset() {
    state.running = false;
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    state.remaining = state.total;
    paint();
    paintControls();
  }

  function switchMode(mode, autostart) {
    state.mode = mode;
    state.total = (mode === 'focus' ? FOCUS_MIN : BREAK_MIN) * 60;
    state.remaining = state.total;
    state.running = false;
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (autostart) start();
    paint();
    paintControls();
  }

  // 更新时间与环（仅在视图挂载时有效）
  function paint() {
    const timeEl = document.getElementById('timer-time');
    const ring = document.getElementById('timer-ring-fg');
    const modeEl = document.getElementById('timer-mode');
    if (timeEl) timeEl.textContent = fmt(state.remaining);
    if (modeEl) modeEl.textContent = state.mode === 'focus' ? '专注中 🐍' : '休息中 ☕';
    if (ring) {
      const pct = state.total ? state.remaining / state.total : 0;
      // 剩余时间 → 环逐渐变空（从满到空）
      ring.style.strokeDashoffset = String(RING_C * (1 - pct));
    }
  }

  // 更新按钮状态
  function paintControls() {
    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    if (startBtn) startBtn.disabled = state.running;
    if (pauseBtn) pauseBtn.disabled = !state.running;
  }

  function render(container) {
    const d = App.Storage.getData();

    const card = App.card({},
      App.sectionHead('⏱️', '专注计时器', '番茄工作法 · 25 分钟专注 + 5 分钟休息')
    );

    // 模式切换
    const modes = App.el('div', { class: 'timer-modes' },
      App.el('button', { class: 'btn' + (state.mode === 'focus' ? ' is-active' : ''), onclick: () => switchMode('focus', false) }, '🐍 专注 25'),
      App.el('button', { class: 'btn' + (state.mode === 'break' ? ' is-active' : ''), onclick: () => switchMode('break', false) }, '☕ 休息 5')
    );

    // 环 + 时间（SVG 用 innerHTML 解析，确保命名空间正确）
    const svgStr =
      '<svg width="240" height="240" viewBox="0 0 240 240">' +
      '<defs><linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#a98be6"/><stop offset="100%" stop-color="#8f6fc9"/></linearGradient></defs>' +
      '<circle class="timer-ring__bg" cx="120" cy="120" r="' + RING_R + '"/>' +
      '<circle class="timer-ring__fg" id="timer-ring-fg" cx="120" cy="120" r="' + RING_R + '" stroke-dasharray="' + RING_C + '"/>' +
      '</svg>';
    const ring = App.el('div', { class: 'timer-ring', html: svgStr },
      App.el('div', { class: 'timer-display' },
        App.el('div', { class: 'timer-display__time', id: 'timer-time' }, fmt(state.remaining)),
        App.el('div', { class: 'timer-display__mode', id: 'timer-mode' }, state.mode === 'focus' ? '专注中 🐍' : '休息中 ☕')
      )
    );

    // 控制按钮
    const controls = App.el('div', { class: 'timer-controls' },
      App.el('button', { class: 'btn btn--primary', id: 'timer-start', onclick: start, disabled: state.running }, '▶ 开始'),
      App.el('button', { class: 'btn', id: 'timer-pause', onclick: pause, disabled: !state.running }, '⏸ 暂停'),
      App.el('button', { class: 'btn btn--ghost', onclick: reset }, '↻ 重置')
    );

    // session 统计
    const sessionInfo = App.el('div', { class: 'timer-session' },
      '今天完成 ', App.el('b', {}, String(d.focus.sessionsToday || 0)), ' 个专注番茄 · 累计 ', App.el('b', {}, String(d.focus.totalSessions || 0)), ' 个'
    );

    card.appendChild(modes);
    card.appendChild(ring);
    card.appendChild(controls);
    card.appendChild(sessionInfo);
    container.appendChild(card);

    // 挂载后立即画一次环（因为 dasharray 是动态计算的）
    requestAnimationFrame(() => { paint(); paintControls(); });
  }

  App.registerView({ id: 'timer', name: '专注', shortName: '专注', icon: '⏱️', render: render });
})(window);
