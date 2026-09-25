/* =====================================================================
 * storage.js — LocalStorage 数据持久化层
 * 负责 My Little WorkBuddy 所有数据的读写，带默认值与版本迁移。
 * 所有 view 模块只通过 App.Storage 读写数据，不直接碰 localStorage。
 * ===================================================================== */

(function (global) {
  'use strict';

  const KEY = 'mlwb_data_v1';

  // 默认数据骨架：首次使用或数据被清空时回退到这里
  const DEFAULT_DATA = {
    version: 2,
    todos: [],                 // { id, text, priority: high|medium|low, done, createdAt }
    schedule: [],              // { id, time: "HH:MM", activity, category }
    focus: {
      sessionsToday: 0,
      lastSessionDate: '',     // YYYY-MM-DD，用来跨天归零
      totalSessions: 0,
      // 记录每次 session 的时间，供 Progress 周期统计
      log: []                  // { date: 'YYYY-MM-DD', ts }
    },
    learning: {
      goal: '学习 Python',
      todayMinutes: 0,
      weekMinutes: 0,
      progress: 25,            // 0-100
      weekStart: '',           // 本周一日期，跨周归零
      topics: [],              // { id, name, done, doneDate }
      // 记录每次学习时长，供 Progress 统计
      log: []                  // { date, minutes }
    },
    habits: {
      habits: ['🐍 学 Python', '📖 阅读', '💧 喝足够的水', '🏃 运动', '🛏️ 早一点睡觉'],
      // days: { 'YYYY-MM-DD': { '🐍 学 Python': true, ... } }
      days: {}
    },
    mood: {
      // history: [{ date: 'YYYY-MM-DD', mood, note }]
      history: []
    },
    notes: [],                 // { id, text, createdAt }
    wins: [],                  // { id, text, date: 'YYYY-MM-DD' }

    /* ---------- v2 新增 ---------- */
    // Buddy AI 配置与对话
    ai: {
      config: {
        provider: 'openai',          // openai 兼容接口
        endpoint: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini'
      },
      messages: []                   // { role: 'user'|'assistant', content, ts }
    },
    // 食物与卡路里（估算值）
    food: {
      // log: { 'YYYY-MM-DD': [ { id, meal, name, portion, calMin, calMax, time, photo } ] }
      log: {}
    },
    // 每日一句话
    dailyMessage: {
      lastDate: '',                  // 上次生成日期
      current: '',                  // 当天显示的一句话
      favorites: []                 // { text, date }
    },
    // 目标与旅程
    goals: {
      monthly: [],                  // 活跃目标
      archive: []                   // 已完成归档
      // 目标结构:
      // { id, title, reason, deadline, priority, status: notstarted|inprogress|completed|paused,
      //   createdAt, completedAt,
      //   milestones: [ { id, name, done, doneDate } ],
      //   journey: [ { id, date, what, step, time, problems, learned, mood, next, photo } ],
      //   weeklyFocus: { 'YYYY-MM-DD(周一)': [ milestoneId,... ] },
      //   reflection: { whatLearned, hardest, nextStep, aiSummary, aiSummaryDate } }
    }
  };

  function Storage() {
    this._cache = null;
  }

  Storage.prototype.load = function () {
    if (this._cache) return this._cache;
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      console.warn('localStorage 不可用，数据将无法持久化', e);
    }
    if (!raw) {
      this._cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
      this.save();
      return this._cache;
    }
    try {
      const parsed = JSON.parse(raw);
      // 合并默认值，防止旧数据缺字段
      this._cache = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
      // 深层合并 learning / focus / habits / mood / ai / food / goals / dailyMessage
      this._cache.learning = Object.assign({}, DEFAULT_DATA.learning, parsed.learning || {});
      this._cache.focus = Object.assign({}, DEFAULT_DATA.focus, parsed.focus || {});
      this._cache.habits = Object.assign({}, DEFAULT_DATA.habits, parsed.habits || {});
      this._cache.mood = Object.assign({}, DEFAULT_DATA.mood, parsed.mood || {});
      this._cache.ai = Object.assign({}, DEFAULT_DATA.ai, parsed.ai || {});
      if (parsed.ai && parsed.ai.config) {
        this._cache.ai.config = Object.assign({}, DEFAULT_DATA.ai.config, parsed.ai.config);
      }
      this._cache.food = Object.assign({}, DEFAULT_DATA.food, parsed.food || {});
      this._cache.goals = Object.assign({}, DEFAULT_DATA.goals, parsed.goals || {});
      this._cache.dailyMessage = Object.assign({}, DEFAULT_DATA.dailyMessage, parsed.dailyMessage || {});
    } catch (e) {
      console.warn('数据解析失败，回退到默认值', e);
      this._cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    return this._cache;
  };

  Storage.prototype.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(this._cache));
    } catch (e) {
      console.warn('保存失败', e);
    }
  };

  // 便捷读写：getData() 拿到完整对象引用，改完调用 save()
  Storage.prototype.getData = function () {
    if (!this._cache) this.load();
    return this._cache;
  };

  // 工具：生成唯一 id
  Storage.prototype.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  // 工具：当前日期 YYYY-MM-DD
  Storage.prototype.today = function () {
    const d = new Date();
    return this.formatDate(d);
  };

  Storage.prototype.formatDate = function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };

  // 计算本周一日期（以周一为一周起点）
  Storage.prototype.mondayOf = function (date) {
    const d = date ? new Date(date) : new Date();
    const day = d.getDay(); // 0=周日 1=周一 ... 6=周六
    const diff = (day === 0 ? -6 : 1 - day); // 回到周一
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return this.formatDate(d);
  };

  // 偏移若干天的日期字符串
  Storage.prototype.dateOffset = function (days, from) {
    const d = from ? new Date(from + 'T00:00:00') : new Date();
    d.setDate(d.getDate() + days);
    return this.formatDate(d);
  };

  // 某周一到周日的 7 个日期
  Storage.prototype.weekDates = function (monday) {
    const start = new Date((monday || this.mondayOf()) + 'T00:00:00');
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start);
      dd.setDate(start.getDate() + i);
      arr.push(this.formatDate(dd));
    }
    return arr;
  };

  // 某月的所有日期字符串 { dates:[], y, m }
  Storage.prototype.monthDates = function (year, month0) {
    const y = year || new Date().getFullYear();
    const m = (month0 != null) ? month0 : new Date().getMonth();
    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < days; i++) {
      const dd = new Date(y, m, i + 1);
      arr.push(this.formatDate(dd));
    }
    return { dates: arr, year: y, month: m };
  };

  // 月份标签，如 "2026 年 9 月"
  Storage.prototype.monthLabel = function (year, month0) {
    const y = year || new Date().getFullYear();
    const m = (month0 != null) ? month0 : new Date().getMonth();
    return y + ' 年 ' + (m + 1) + ' 月';
  };

  // 解析 YYYY-MM-DD 为 Date
  Storage.prototype.parseDate = function (str) {
    return new Date(str + 'T00:00:00');
  };

  global.App = global.App || {};
  global.App.Storage = new Storage();
})(window);
