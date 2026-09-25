/* =====================================================================
 * ai.js — Buddy AI 智能层
 *
 * 这是一个「真正可连接 AI API」的结构，不是假的聊天界面。
 *  - 已配置 API key 时：调用 OpenAI 兼容的 chat/completions 接口
 *    （支持文本对话 + 视觉图片识别 + JSON 结构化输出）
 *  - 未配置时：进入 Local Buddy 本地兜底
 *    Local Buddy 会真实读取你的 WorkBuddy 数据来回答，
 *    不是随机罐头回复 —— 它会根据你的 To-Do / Schedule / Habit /
 *    Learning / Focus / Mood / Notes / Food / Goals 给出有依据的回应。
 *
 * 配置（provider / endpoint / apiKey / model）保存在 localStorage，
 * 仅在本机使用。请在 Buddy AI 页面的 ⚙️ 设置里填入。
 *
 * 兼容 OpenAI、兼容 OpenAI 格式的任意服务（DeepSeek、Moonshot、
 * 本地 Ollama 等），只要支持 /v1/chat/completions 即可。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const Storage = function () { return App.Storage; };

  /* ---------------- 配置 ---------------- */
  function getConfig() { return Storage().getData().ai.config; }
  function isConfigured() {
    const c = getConfig();
    return !!(c && c.apiKey && c.endpoint);
  }

  // 供 UI 调用：保存配置
  function saveConfig(cfg) {
    const c = getConfig();
    Object.assign(c, cfg || {});
    Storage().save();
  }
  // 清空对话历史
  function clearMessages() {
    Storage().getData().ai.messages = [];
    Storage().save();
  }
  function getMessages() { return Storage().getData().ai.messages; }
  function pushMessage(role, content) {
    const arr = Storage().getData().ai.messages;
    arr.push({ role: role, content: content, ts: Date.now() });
    // 限制历史长度，避免超出 token / 存储
    if (arr.length > 60) arr.splice(0, arr.length - 60);
    Storage().save();
  }

  /* ---------------- 上下文：把 WorkBuddy 数据整理给 AI ---------------- */
  // 这是让 AI 变成「个人助手」的关键 —— 它看到的不是空对话，而是你的真实数据。
  function buildContext() {
    const d = Storage().getData();
    const S = Storage();
    const today = S.today();
    const lines = [];

    lines.push('【今天是】' + today);

    // To-Do
    const todos = d.todos || [];
    const tDone = todos.filter(t => t.done);
    const tLeft = todos.filter(t => !t.done);
    lines.push('【今日 To-Do】共 ' + todos.length + ' 项，已完成 ' + tDone.length + ' 项。');
    if (tLeft.length) lines.push('  未完成：' + tLeft.map(t => (t.priority === 'high' ? '[高]' : t.priority === 'medium' ? '[中]' : '[低]') + t.text).join('；'));
    if (tDone.length) lines.push('  已完成：' + tDone.map(t => t.text).join('；'));

    // Schedule
    const sched = (d.schedule || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    lines.push('【今日时间表】' + (sched.length ? sched.map(s => s.time + ' ' + s.activity + '(' + (s.category || 'learn') + ')').join('；') : '（还没有安排）'));

    // Focus
    lines.push('【专注】今日 ' + (d.focus.sessionsToday || 0) + ' 个番茄，累计 ' + (d.focus.totalSessions || 0) + ' 个。');

    // Learning
    const L = d.learning || {};
    const topicsDone = (L.topics || []).filter(t => t.done).map(t => t.name);
    lines.push('【Python 学习】目标：' + L.goal + '；进度 ' + (L.progress || 0) + '%；今天 ' + (L.todayMinutes || 0) + ' 分钟；本周 ' + (L.weekMinutes || 0) + ' 分钟。');
    if (topicsDone.length) lines.push('  已完成主题：' + topicsDone.join('、'));

    // Habits
    const todayHab = (d.habits.days || {})[today] || {};
    const habList = d.habits.habits || [];
    lines.push('【今日习惯】' + habList.map(h => h + (todayHab[h] ? '✓' : '✗')).join(' '));

    // Mood
    const m = (d.mood.history || []).filter(x => x.date === today)[0];
    const moodLabel = { bad: '很差😭', meh2: '不太好😕', mid: '普通😐', good: '不错🙂', great: '很开心🥰' };
    lines.push('【今日心情】' + (m ? (moodLabel[m.mood] || m.mood) + (m.note ? '，记录：' + m.note : '') : '还没记录'));

    // Notes
    if (d.notes && d.notes.length) lines.push('【快速笔记】' + d.notes.slice(-5).map(n => n.text).join(' | '));

    // Food（今天）
    const foodToday = ((d.food.log || {})[today]) || [];
    if (foodToday.length) {
      const total = foodToday.reduce((s, f) => s + ((f.calMin + f.calMax) / 2), 0);
      lines.push('【今日饮食】记录 ' + foodToday.length + ' 项，估算约 ' + Math.round(total) + ' kcal（估算值）。');
    }

    // Goals
    const goals = (d.goals && d.goals.monthly) || [];
    if (goals.length) {
      lines.push('【当前目标】' + goals.map(g => {
        const ms = (g.milestones || []).filter(x => x.done).length + '/' + (g.milestones || []).length;
        return g.title + '(' + g.status + ',' + ms + ')';
      }).join('；'));
    }

    return lines.join('\n');
  }

  /* ---------------- 系统人设 ---------------- */
  const SYSTEM_PROMPT =
    '你是 Buddy AI，生活在「My Little WorkBuddy 🌷」个人工作台里的温柔小助手。' +
    '你会参考用户当前的真实数据（下方上下文）来回答，不要编造上下文里没有的数据。' +
    '语气要温柔、简洁、有鼓励感，像一个了解用户的个人朋友，而不是企业客服。' +
    '回答用用户的语言（用户用中文就用中文）。不要用大段 Markdown 标题，口语化即可。' +
    '如果用户让你安排计划或拆分任务，给出具体、可执行的小步骤。' +
    '不要给出医疗或心理诊断。';

  /* ---------------- 底层 API 调用 ---------------- */
  // messages: 标准 OpenAI messages 数组；opts: { json, temperature, maxTokens, vision }
  async function callAPI(messages, opts) {
    opts = opts || {};
    const c = getConfig();
    if (!isConfigured()) throw new Error('NOT_CONFIGURED');

    const body = {
      model: c.model || 'gpt-4o-mini',
      messages: messages,
      temperature: (opts.temperature != null) ? opts.temperature : 0.7,
      max_tokens: opts.maxTokens || 900
    };
    if (opts.json) body.response_format = { type: 'json_object' };

    const resp = await fetch(c.endpoint.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + c.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.text()).slice(0, 200); } catch (e) {}
      throw new Error('API 错误 ' + resp.status + (detail ? '：' + detail : ''));
    }
    const data = await resp.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('API 返回为空');
    return content.trim();
  }

  /* =====================================================================
   * Local Buddy —— 没有配置 API 时的真实数据兜底
   * 它会读取你的 WorkBuddy 数据，按意图给出有依据的回答。
   * ===================================================================== */
  function fmtMin(min) {
    min = Math.round(min || 0);
    if (min < 60) return min + ' 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }

  function localBuddy(text) {
    const d = Storage().getData();
    const S = Storage();
    const today = S.today();
    const t = (text || '').toLowerCase();

    const todos = d.todos || [];
    const left = todos.filter(x => !x.done);
    const done = todos.filter(x => x.done);
    const now = new Date();
    const hour = now.getHours();

    // 1) 还有什么没完成
    if (/没完成|还有什么|还没做|剩下|待办|left|未完成|还有啥/.test(t)) {
      if (!left.length) return '今天的任务都完成啦！给自己一个小奖励吧 🌷✨';
      const list = left.map(x => '• ' + x.text + (x.priority === 'high' ? '（高优先）' : '')).join('\n');
      return '今天还剩 ' + left.length + ' 项没完成：\n' + list + '\n\n要不要从最重要的一件开始？🌷';
    }

    // 2) 安排 / 计划
    if (/安排|计划|规划|plan|今晚|今天怎么|帮我安排/.test(t)) {
      if (!left.length) return '今天没有未完成的任务，可以轻松一下，或者加几件想做的事 🌱';
      const prio = left.slice().sort((a, b) => {
        const pr = { high: 0, medium: 1, low: 2 };
        return (pr[a.priority] || 1) - (pr[b.priority] || 1);
      });
      const top = prio[0];
      let plan = '我帮你按优先级排了一下：\n';
      prio.forEach((x, i) => { plan += (i + 1) + '. ' + x.text + (x.priority === 'high' ? ' ⭐' : '') + '\n'; });
      if (hour >= 20) plan += '\n已经晚上了，建议先把「' + top.text + '」做完，剩下的明天再说 🌙';
      else plan += '\n建议先从「' + top.text + '」开始，做完一件就是一小步 🌱';
      return plan;
    }

    // 3) 本周总结
    if (/总结|本周|这周|这周完成|week|review|回顾/.test(t)) {
      const stats = computeWeekStats(S.mondayOf());
      const parts = [];
      parts.push('这周你完成了 ' + stats.todosDone + '/' + stats.todosTotal + ' 个任务' + (stats.todosTotal ? '（完成率 ' + stats.completionRate + '%）' : '') + '。');
      parts.push('专注了 ' + stats.focusSessions + ' 个番茄' + (stats.focusSessions ? '，约 ' + fmtMin(stats.focusMinutes) : '') + '。');
      parts.push('学习 Python 约 ' + fmtMin(stats.learnMinutes) + (stats.learnDays ? '，学了 ' + stats.learnDays + ' 天' : '') + '。');
      if (stats.topicsDone.length) parts.push('完成的主题：' + stats.topicsDone.join('、') + '。');
      parts.push('习惯完成率：' + stats.habitRates.map(h => h.name + ' ' + h.done + '/' + h.total).join('，') + '。');
      parts.push('\n你一直在一点一点推进，这就很了不起啦 🌷 下周也慢慢来。');
      return parts.join('\n');
    }

    // 4) 拆分任务 / 学习 Python
    if (/拆|分解|分步骤|break|拆成|分成|计划学/.test(t) || /python|python/.test(t)) {
      if (/python|学/.test(t)) {
        return '我可以帮你把「学习 Python」拆成几个小步骤：\n' +
          '1. Variables 变量与数据类型\n2. If / Else 条件判断\n3. Loops 循环（for / while）\n4. Functions 函数\n5. Lists 列表\n6. Dictionaries 字典\n7. Mini Project 小项目\n\n每完成一个就打勾，慢慢来 🐍 （在「目标」页可以创建目标并拆分里程碑）';
      }
      // 通用拆分：拿第一个未完成任务拆
      const target = left[0];
      if (!target) return '今天没有待拆分的任务 🌷';
      return '把「' + target.text + '」拆成小步骤的话，可以先想想：\n• 它的第一步是什么？\n• 中间需要什么？\n• 怎样算完成？\n\n把第一步加进今天的 To-Do，先做 10 分钟试试 🌱';
    }

    // 5) 心情
    if (/心情|mood|状态不好|难过|累|低落|不好/.test(t)) {
      const m = (d.mood.history || []).filter(x => x.date === today)[0];
      if (m && (m.mood === 'bad' || m.mood === 'meh2')) {
        return '今天状态不太好也没关系 🌷 状态会起伏是很正常的事。可以挑一件最小、最简单的事做，做一点就是一点点。要不要先去休息或喝杯水？🌱';
      }
      if (m && m.mood === 'great') return '今天心情很好呀，趁状态不错，挑一件想推进的事做吧 ✨';
      return '心情会起起落落很正常 🌷 慢慢来，今天不用很厉害。';
    }

    // 6) 调整计划
    if (/调整|重新安排|reschedule|改计划|没完成怎么办/.test(t)) {
      if (!left.length) return '今天的任务都做完啦，不用调整 🌷';
      const top = left.slice().sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] || 1) - ({ high: 0, medium: 1, low: 2 }[b.priority] || 1))[0];
      return '没关系，计划本来就是用来调整的 🌷 建议今天只留最重要的「' + top.text + '」，其余的挪到明天。完成一件就是赢。';
    }

    // 兜底：用今日真实数据给一个温柔的回应
    const habToday = (d.habits.days || {})[today] || {};
    const habDone = (d.habits.habits || []).filter(h => habToday[h]).length;
    return '我在看你的小桌面 🌷 今天：任务 ' + done.length + '/' + todos.length + ' 完成、专注 ' + (d.focus.sessionsToday || 0) + ' 个、学习 ' + fmtMin(d.learning.todayMinutes || 0) + '、习惯 ' + habDone + '/' + (d.habits.habits || []).length + '。\n\n想让我帮你安排今天、整理任务、拆分学习目标，还是总结一下这周？直接说就好 🌱';
  }

  /* ---------------- 对话入口 ---------------- */
  // 返回 { text, source: 'api'|'local' }
  async function chat(userText) {
    pushMessage('user', userText);
    let reply, source;
    if (isConfigured()) {
      try {
        const history = getMessages().slice(-12).map(m => ({ role: m.role, content: m.content }));
        const messages = [
          { role: 'system', content: SYSTEM_PROMPT + '\n\n【用户的 WorkBuddy 数据】\n' + buildContext() }
        ].concat(history);
        reply = await callAPI(messages, { temperature: 0.7, maxTokens: 800 });
        source = 'api';
      } catch (e) {
        // API 失败时退回本地，并提示原因
        reply = localBuddy(userText) + '\n\n（AI 接口暂时连不上：' + (e.message || '') + '，这是本地兜底回答 🌷）';
        source = 'local-fallback';
      }
    } else {
      reply = localBuddy(userText);
      source = 'local';
    }
    pushMessage('assistant', reply);
    return { text: reply, source: source };
  }

  /* ---------------- 食物图片识别（视觉） ---------------- */
  // dataUrl: base64 data URL。返回结构化结果或 { needConfig: true }
  async function analyzeFoodImage(dataUrl) {
    if (!isConfigured()) return { needConfig: true };
    // 需要视觉模型（如 gpt-4o）。不是所有模型都支持图片，这里统一发视觉请求。
    const sys = 'You are a food recognition assistant. Identify the food in the image, estimate portion sizes (in grams) and calories as a RANGE (min-max). Always return JSON. Calorie estimates are approximate — never claim precision. Respond in the user\'s language (Chinese if ambiguous).';
    const user = {
      role: 'user',
      content: [
        { type: 'text', text: '请识别这张图片里的食物，估算每种食材的份量（克）和热量范围（千卡）。返回 JSON：{"items":[{"name":"","portion":"","calMin":0,"calMax":0}],"totalCalMin":0,"totalCalMax":0,"confidence":"low|medium|high","note":"简短说明这是估算值"}' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    };
    try {
      const raw = await callAPI([{ role: 'system', content: sys }, user], { json: true, temperature: 0.3, maxTokens: 700 });
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (e) {
        // 某些接口不遵守 response_format，尝试抽取 JSON 片段
        const m = raw.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }
      if (!parsed) return { error: '无法解析识别结果', raw: raw };
      return parsed;
    } catch (e) {
      return { error: e.message || '识别失败' };
    }
  }

  /* ---------------- 每日一句话 ---------------- */
  const MSG_GENTLE = [
    '状态不好的时候，慢一点也没关系。你已经很努力了。🌷',
    '今天不用很厉害，完成一点点就很好了。🌱',
    '休息也是前进的一部分。先喝杯水吧。💧',
    '不用跟别人比，你只需要比昨天的自己多走一小步。🌷'
  ];
  const MSG_OK = [
    '今天也一点一点在变好呀 🌷',
    '把今天过好，就是对未来最好的交代。✨',
    '慢慢来，比较快。🍃',
    '专注当下的每一小步，都是在变强。🌱'
  ];
  const MSG_CELEBRATE = [
    '今天完成了很多，给自己一个小奖励吧！✨',
    '认真生活的你，超可爱的 🌷',
    '今天的成就感，值得记下来。✨',
    '你又往前走了一步，真棒 🌱'
  ];
  const MSG_MORNING = [
    '新的一天，挑一件最小的事开始吧 🌱',
    '今天先从一件小任务开始，做完就是胜利。🌷',
    '早晨的能量最珍贵，先做最重要的一件 🌱'
  ];

  function pickLocal(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function localDailyMessage() {
    const d = Storage().getData();
    const S = Storage();
    const today = S.today();
    const todos = d.todos || [];
    const doneN = todos.filter(t => t.done).length;
    const totalN = todos.length;
    const m = (d.mood.history || []).filter(x => x.date === today)[0];
    const hour = new Date().getHours();
    const habToday = (d.habits.days || {})[today] || {};
    const habDone = (d.habits.habits || []).filter(h => habToday[h]).length;

    if (m && (m.mood === 'bad' || m.mood === 'meh2')) return pickLocal(MSG_GENTLE);
    if (totalN && doneN === totalN && totalN >= 2) return pickLocal(MSG_CELEBRATE);
    if (hour < 11 && doneN === 0) return pickLocal(MSG_MORNING);
    if (doneN >= Math.ceil(totalN / 2) && totalN) return pickLocal(MSG_CELEBRATE);
    if (m && m.mood === 'great') return pickLocal(MSG_CELEBRATE);
    return pickLocal(MSG_OK);
  }

  async function generateDailyMessage() {
    if (isConfigured()) {
      try {
        const sys = 'You are the gentle daily-message writer inside My Little WorkBuddy. Given the user\'s data, write ONE short encouraging sentence (under 25 words), in the user\'s language (Chinese). Tone: warm, never pressuring, slightly poetic. No quotes, no markdown. If mood is low, be gentle; if productive, celebrate softly.';
        const user = '【今日数据】\n' + buildContext() + '\n\n请只返回一句话。';
        const txt = await callAPI([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.85, maxTokens: 80 });
        return txt.replace(/^["'']+|["'']+$/g, '').trim();
      } catch (e) {
        return localDailyMessage();
      }
    }
    return localDailyMessage();
  }

  /* =====================================================================
   * 数据统计 —— Progress 页与 AI 反思共用
   * ===================================================================== */
  // 计算某一周（周一日期）的统计
  function computeWeekStats(monday) {
    const S = Storage();
    const d = S.getData();
    const days = S.weekDates(monday);

    // To-Do：按 doneDate 落在周内计数（兼容无 doneDate 的旧数据 → 不计入本周）
    const todos = d.todos || [];
    const inWeek = todos.filter(t => {
      if (!t.done) return false;
      const dd = t.doneDate || t.completedAt;
      if (!dd) return false;
      return days.indexOf(dd) >= 0;
    });
    const todosDone = inWeek.length;
    const todosTotal = todos.length; // 当前全部任务数（诚实呈现）
    const completionRate = todosTotal ? Math.round(todosDone / todosTotal * 100) : 0;

    // Focus：log 里 date 落在本周
    const flog = (d.focus.log || []).filter(x => days.indexOf(x.date) >= 0);
    const focusSessions = flog.length;
    const focusMinutes = focusSessions * 25;

    // Learning：log 里 date 落在本周
    const llog = (d.learning.log || []).filter(x => days.indexOf(x.date) >= 0);
    const learnMinutes = llog.reduce((s, x) => s + (x.minutes || 0), 0);
    const learnDaysSet = {};
    llog.forEach(x => learnDaysSet[x.date] = true);
    const learnDays = Object.keys(learnDaysSet).length;
    const topicsDone = (d.learning.topics || []).filter(t => t.done && days.indexOf(t.doneDate || '') >= 0).map(t => t.name);

    // Habits：每个习惯本周完成几天
    const habitRates = (d.habits.habits || []).map(h => {
      let c = 0;
      days.forEach(dd => { if ((d.habits.days[dd] || {})[h]) c++; });
      return { name: h, done: c, total: 7, rate: Math.round(c / 7 * 100) };
    });

    // Mood：本周每天
    const MOOD_EMOJI = { bad: '😭', meh2: '😕', mid: '😐', good: '🙂', great: '🥰' };
    const moodList = days.map(dd => {
      const r = (d.mood.history || []).filter(x => x.date === dd)[0];
      return r ? { date: dd, mood: r.mood, emoji: MOOD_EMOJI[r.mood] || '○', note: r.note || '' } : { date: dd, mood: null, emoji: '○' };
    });
    const moodCounts = {};
    moodList.forEach(x => { if (x.mood) moodCounts[x.mood] = (moodCounts[x.mood] || 0) + 1; });

    // Food
    let foodDaysLogged = 0, foodCalSum = 0;
    days.forEach(dd => {
      const arr = (d.food.log || {})[dd] || [];
      if (arr.length) { foodDaysLogged++; foodCalSum += arr.reduce((s, f) => s + ((f.calMin + f.calMax) / 2), 0); }
    });
    const foodAvgCal = foodDaysLogged ? Math.round(foodCalSum / foodDaysLogged) : 0;

    // Wins：本周记录的
    const wins = (d.wins || []).filter(w => days.indexOf(w.date) >= 0);

    return {
      scope: 'week', monday: monday, days: days,
      todosDone: todosDone, todosTotal: todosTotal, completionRate: completionRate,
      todosDoneItems: inWeek.map(t => t.text),
      focusSessions: focusSessions, focusMinutes: focusMinutes,
      learnMinutes: learnMinutes, learnDays: learnDays, topicsDone: topicsDone,
      habitRates: habitRates,
      moodList: moodList, moodCounts: moodCounts,
      foodDaysLogged: foodDaysLogged, foodAvgCal: foodAvgCal,
      wins: wins
    };
  }

  // 计算某月统计
  function computeMonthStats(year, month0) {
    const S = Storage();
    const d = S.getData();
    const md = S.monthDates(year, month0);
    const days = md.dates;

    const todos = d.todos || [];
    const todosDone = todos.filter(t => t.done && days.indexOf(t.doneDate || t.completedAt || '') >= 0).length;
    const todosTotal = todos.length;
    const completionRate = todosTotal ? Math.round(todosDone / todosTotal * 100) : 0;

    const flog = (d.focus.log || []).filter(x => days.indexOf(x.date) >= 0);
    const focusSessions = flog.length;
    const focusMinutes = focusSessions * 25;

    const llog = (d.learning.log || []).filter(x => days.indexOf(x.date) >= 0);
    const learnMinutes = llog.reduce((s, x) => s + (x.minutes || 0), 0);
    const learnDaysSet = {}; llog.forEach(x => learnDaysSet[x.date] = true);
    const learnDays = Object.keys(learnDaysSet).length;
    const topicsDone = (d.learning.topics || []).filter(t => t.done && days.indexOf(t.doneDate || '') >= 0).map(t => t.name);

    const habitRates = (d.habits.habits || []).map(h => {
      let c = 0; days.forEach(dd => { if ((d.habits.days[dd] || {})[h]) c++; });
      return { name: h, done: c, total: days.length, rate: Math.round(c / days.length * 100) };
    });

    const MOOD_EMOJI = { bad: '😭', meh2: '😕', mid: '😐', good: '🙂', great: '🥰' };
    const moodCounts = {};
    (d.mood.history || []).forEach(x => {
      if (days.indexOf(x.date) >= 0 && x.mood) moodCounts[x.mood] = (moodCounts[x.mood] || 0) + 1;
    });

    let foodDaysLogged = 0, foodCalSum = 0;
    days.forEach(dd => {
      const arr = (d.food.log || {})[dd] || [];
      if (arr.length) { foodDaysLogged++; foodCalSum += arr.reduce((s, f) => s + ((f.calMin + f.calMax) / 2), 0); }
    });
    const foodAvgCal = foodDaysLogged ? Math.round(foodCalSum / foodDaysLogged) : 0;

    const wins = (d.wins || []).filter(w => days.indexOf(w.date) >= 0);

    // 按周拆分的趋势
    const weeklyTrend = [];
    for (let i = 0; i < 6; i++) {
      const wMon = S.dateOffset(i * 7 - (i === 0 ? 0 : 0));
      // 简化：计算该周落在本月的天数；这里直接按自然周统计
    }
    // 月内每周趋势（基于 monday）
    const monthMondays = [];
    days.forEach(dd => {
      const mon = S.mondayOf(dd);
      if (monthMondays.indexOf(mon) < 0) monthMondays.push(mon);
    });
    const trend = monthMondays.map(mon => {
      const ws = computeWeekStats(mon);
      // 只算该周在本月内的天
      return { monday: mon, todosDone: ws.todosDone, focusMinutes: ws.focusMinutes, learnMinutes: ws.learnMinutes };
    });

    return {
      scope: 'month', year: md.year, month: md.month, monthLabel: S.monthLabel(md.year, md.month), days: days,
      todosDone: todosDone, todosTotal: todosTotal, completionRate: completionRate,
      focusSessions: focusSessions, focusMinutes: focusMinutes,
      learnMinutes: learnMinutes, learnDays: learnDays, topicsDone: topicsDone,
      habitRates: habitRates, moodCounts: moodCounts,
      foodDaysLogged: foodDaysLogged, foodAvgCal: foodAvgCal,
      wins: wins, weeklyTrend: trend
    };
  }

  /* ---------------- AI 周期反思 ---------------- */
  async function generateReflection(scope, ref) {
    const stats = scope === 'month' ? computeMonthStats(ref && ref.year, ref && ref.month) : computeWeekStats(ref && ref.monday);
    if (isConfigured()) {
      try {
        const sys = 'You are Buddy AI. Write a short, gentle, personal reflection based on the user\'s real data below. Be warm, specific, encouraging, never critical or pressuring. 3-5 sentences. In the user\'s language (Chinese). No markdown headers, no medical/nutrition diagnosis.';
        const user = '【周期】' + (scope === 'month' ? stats.monthLabel : '本周') + '\n【数据】\n' + JSON.stringify(stats) + '\n\n请写一小段反思。';
        return await callAPI([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.8, maxTokens: 400 });
      } catch (e) {
        return localReflection(scope, stats);
      }
    }
    return localReflection(scope, stats);
  }

  function localReflection(scope, s) {
    const parts = [];
    const period = scope === 'month' ? s.monthLabel : '这周';
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

  /* ---------------- AI 目标助手 ---------------- */
  // 把目标拆成若干周 / 若干里程碑
  async function breakDownGoal(title, weeks) {
    weeks = weeks || 4;
    if (isConfigured()) {
      try {
        const sys = 'You are a gentle goal-planning assistant. Break the user\'s goal into milestone steps. Return JSON: {"milestones":[{"name":"short step name"}]}. Steps should be concrete and small. In the user\'s language (Chinese if ambiguous).';
        const user = '目标：「' + title + '」\n请拆成大约 ' + weeks + ' 步。';
        const raw = await callAPI([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, temperature: 0.6, maxTokens: 500 });
        let parsed; try { parsed = JSON.parse(raw); } catch (e) { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
        if (parsed && parsed.milestones) return parsed.milestones.map(m => ({ name: m.name }));
      } catch (e) {}
    }
    // 本地模板拆分
    const templates = [
      ['了解基础概念', '练习最简单的例子', '完成一个小练习', '应用到实际场景', '总结与回顾'],
      ['第一步：入门', '第二步：熟悉', '第三步：练习', '第四步：小项目', '第五步：总结']
    ];
    return templates[Math.floor(Math.random() * templates.length)].map(n => ({ name: n }));
  }

  // 目标完成反思
  async function generateGoalReflection(goal) {
    const entries = goal.journey || [];
    const milestones = goal.milestones || [];
    const totalMin = entries.reduce((s, e) => s + (e.time || 0), 0);
    const daysSet = {}; entries.forEach(e => daysSet[e.date] = true);
    const days = Object.keys(daysSet).length;
    const summary = localGoalReflection(goal, entries, milestones, totalMin, days);
    if (!isConfigured()) return summary;
    try {
      const sys = 'You are Buddy AI. Based ONLY on the user\'s real journey entries, write a 2-4 sentence gentle completion reflection. Do not invent experiences not in the data. Warm, encouraging, Chinese.';
      const user = '目标：' + goal.title + '\n旅程记录：' + JSON.stringify(entries.slice(0, 20)) + '\n里程碑：' + milestones.map(m => m.name + (m.done ? '✓' : '')).join('、') + '\n请写一段完成反思。';
      return await callAPI([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.8, maxTokens: 400 });
    } catch (e) {
      return summary;
    }
  }

  function localGoalReflection(goal, entries, milestones, totalMin, days) {
    const msDone = milestones.filter(m => m.done).length;
    const parts = [];
    parts.push('你为「' + goal.title + '」记录了 ' + entries.length + ' 次旅程，跨越 ' + days + ' 天');
    if (totalMin) parts.push('花了约 ' + fmtMin(totalMin));
    if (milestones.length) parts.push('完成了 ' + msDone + '/' + milestones.length + ' 个里程碑');
    let out = parts.join('，') + '。';
    if (entries.length) {
      const learned = entries.map(e => e.learned).filter(Boolean).slice(0, 3);
      if (learned.length) out += '\n\n你在这个过程中学到了：' + learned.join('；') + '。';
    }
    out += '\n\n从开始到完成，你一步一步走过来了，这很了不起 🌷';
    return out;
  }

  /* ---------------- 暴露 ---------------- */
  App.AI = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    isConfigured: isConfigured,
    getMessages: getMessages,
    clearMessages: clearMessages,
    pushMessage: pushMessage,
    buildContext: buildContext,
    chat: chat,
    analyzeFoodImage: analyzeFoodImage,
    generateDailyMessage: generateDailyMessage,
    computeWeekStats: computeWeekStats,
    computeMonthStats: computeMonthStats,
    generateReflection: generateReflection,
    breakDownGoal: breakDownGoal,
    generateGoalReflection: generateGoalReflection,
    _localBuddy: localBuddy,
    _localDailyMessage: localDailyMessage
  };
})(window);
