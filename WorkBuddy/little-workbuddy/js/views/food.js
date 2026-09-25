/* =====================================================================
 * food.js — 🍱 Food & Calories
 * 拍照/上传 → AI 识别食物并「估算」卡路里范围（非绝对值）→ 可编辑 → 加入当日 Food Log。
 * 每日按餐次展示，统计今日/本周估算热量与记录天数。
 *
 * ⚠️ 热量始终标记为「估算值」，AI 识别仅作参考，不等于真实营养数据。
 *    真正的图片识别需要连接支持视觉的 AI（如 GPT-4o），
 *    未配置时进入手动填写流程。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const MEALS = [
    { id: 'breakfast', icon: '🌅', label: '早餐' },
    { id: 'lunch', icon: '🍱', label: '午餐' },
    { id: 'snack', icon: '🍎', label: '加餐' },
    { id: 'dinner', icon: '🌙', label: '晚餐' }
  ];
  const MEAL_MAP = {}; MEALS.forEach(m => MEAL_MAP[m.id] = m);

  function todayLog() {
    const d = App.Storage.getData();
    const today = App.Storage.today();
    if (!d.food.log[today]) d.food.log[today] = [];
    return d.food.log[today];
  }

  function render(container) {
    const d = App.Storage.getData();
    const today = App.Storage.today();
    const log = todayLog();

    // ---- 识别 / 添加卡片 ----
    const addCard = App.card({}, App.sectionHead('📸', '识别食物', '上传一张照片，AI 估算卡路里范围'));

    // 文件输入
    const fileInput = App.el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
    addCard.appendChild(fileInput);

    const configured = App.AI.isConfigured();
    const uploadArea = App.el('div', { class: 'food-upload' },
      App.el('div', { class: 'food-upload__icon' }, '🍱'),
      App.el('div', { class: 'food-upload__text' }, configured ? '点这里拍照或选一张食物照片' : '点这里上传照片（未配置 AI，将进入手动填写）'),
      App.el('div', { class: 'food-upload__sub' }, '也可以直接手动添加')
    );
    uploadArea.style.cursor = 'pointer';
    uploadArea.addEventListener('click', () => fileInput.click());
    addCard.appendChild(uploadArea);

    // 预览/识别结果区
    const resultZone = App.el('div', { id: 'food-result-zone' });
    addCard.appendChild(resultZone);

    // 手动添加按钮
    addCard.appendChild(App.el('div', { style: { marginTop: '10px' } },
      App.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => manualForm(resultZone) }, '✍️ 手动添加食物')
    ));

    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => analyzeAndEdit(resultZone, reader.result, f.name);
      reader.readAsDataURL(f);
      fileInput.value = '';
    });

    container.appendChild(addCard);

    // ---- 今日 Food Log ----
    const logCard = App.card({},
      App.sectionHead('🍽️', 'Today\'s Food', App.Storage.today())
    );

    let dayTotal = 0;
    MEALS.forEach(m => {
      const items = log.filter(x => x.meal === m.id);
      const mealCal = items.reduce((s, x) => s + ((x.calMin + x.calMax) / 2), 0);
      dayTotal += mealCal;
      const mealHead = App.el('div', { class: 'meal-head' },
        App.el('span', { class: 'meal-head__icon' }, m.icon),
        App.el('span', { class: 'meal-head__label' }, m.label),
        items.length ? App.el('span', { class: 'meal-head__cal' }, '估算 ' + Math.round(mealCal) + ' kcal') : null
      );
      logCard.appendChild(mealHead);
      const mealList = App.el('div', { class: 'meal-list' });
      if (!items.length) {
        mealList.appendChild(App.el('div', { class: 'empty-hint', style: { padding: '8px 0' } }, '— 还没有记录 —'));
      } else {
        items.forEach(it => mealList.appendChild(foodItemRow(it)));
      }
      logCard.appendChild(mealList);
    });

    // 今日总计
    logCard.appendChild(App.el('div', { class: 'food-day-total' },
      '今日估算热量：约 ',
      App.el('b', {}, Math.round(dayTotal) + ' kcal'),
      App.el('span', { class: 'food-disclaim' }, '（估算值，仅供参考）')
    ));
    container.appendChild(logCard);

    // ---- 统计 ----
    container.appendChild(statsCard());

    // 免责声明
    container.appendChild(App.el('div', { class: 'food-disclaimer' },
      '🌷 热量来自照片识别的粗略估算，实际会因份量、烹饪方式、食材差异而不同。仅作日常参考，不作为营养或医疗建议。'
    ));
  }

  /* ---- 单条食物行 ---- */
  function foodItemRow(it) {
    const row = App.el('div', { class: 'food-item' });
    if (it.photo) {
      const img = App.el('img', { class: 'food-item__photo', src: it.photo, alt: it.name });
      row.appendChild(img);
    } else {
      row.appendChild(App.el('div', { class: 'food-item__photo food-item__photo--ph' }, '🍽️'));
    }
    row.appendChild(App.el('div', { class: 'food-item__body' },
      App.el('div', { class: 'food-item__name' }, App.esc(it.name)),
      App.el('div', { class: 'food-item__meta' }, App.esc(it.portion || '') + (it.time ? ' · ' + it.time : '')),
      App.el('div', { class: 'food-item__cal' }, '估算 ' + (it.calMin || 0) + '–' + (it.calMax || 0) + ' kcal')
    ));
    row.appendChild(App.el('div', { class: 'food-item__actions' },
      App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => editItem(it) }, '✏️'),
      App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => deleteItem(it.id) }, '🗑️')
    ));
    return row;
  }

  /* ---- 上传后分析 + 可编辑表单 ---- */
  async function analyzeAndEdit(zone, dataUrl, fname) {
    App.clear(zone);
    zone.appendChild(App.el('div', { class: 'food-analyze' },
      App.el('img', { class: 'food-analyze__img', src: dataUrl, alt: '预览' }),
      App.el('div', { class: 'food-analyze__status' }, '🔍 AI 正在识别食物…')
    ));

    const configured = App.AI.isConfigured();
    if (!configured) {
      zone.appendChild(App.el('div', { class: 'food-notice' },
        '尚未配置 AI 接口，无法自动识别。需要连接支持视觉的 AI（如 GPT-4o）才能识别食物。现在请手动填写 🌷'
      ));
      manualForm(zone, dataUrl);
      return;
    }

    const res = await App.AI.analyzeFoodImage(dataUrl);
    if (res.error) {
      zone.appendChild(App.el('div', { class: 'food-notice food-notice--warn' },
        '识别遇到问题：' + App.esc(res.error) + '。可以手动填写 🌷'));
      manualForm(zone, dataUrl);
      return;
    }
    if (res.needConfig) {
      manualForm(zone, dataUrl);
      return;
    }
    // 用 AI 结果预填可编辑表单
    editForm(zone, {
      photo: dataUrl,
      meal: guessMeal(),
      items: (res.items || []).map(it => ({
        name: it.name || '', portion: it.portion || '',
        calMin: it.calMin || 0, calMax: it.calMax || 0
      })),
      note: res.note || '',
      confidence: res.confidence || ''
    });
  }

  function guessMeal() {
    const h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 14) return 'lunch';
    if (h < 17) return 'snack';
    return 'dinner';
  }

  /* ---- 手动添加表单（单条） ---- */
  function manualForm(zone, photo) {
    editForm(zone, {
      photo: photo || '',
      meal: guessMeal(),
      items: [{ name: '', portion: '', calMin: 0, calMax: 0 }],
      note: '', confidence: ''
    });
  }

  /* ---- 可编辑确认表单 ---- */
  function editForm(zone, state) {
    App.clear(zone);

    if (state.photo) {
      zone.appendChild(App.el('img', { class: 'food-analyze__img food-analyze__img--sm', src: state.photo, alt: '预览' }));
    }

    // 餐次选择
    const mealPicker = App.el('div', { class: 'meal-picker' });
    MEALS.forEach(m => {
      const b = App.el('button', {
        class: 'meal-pick' + (state.meal === m.id ? ' is-on' : ''),
        dataset: { meal: m.id },
        onclick: function () {
          state.meal = m.id;
          mealPicker.querySelectorAll('.meal-pick').forEach(x => x.classList.toggle('is-on', x.dataset.meal === m.id));
        }
      }, App.el('span', {}, m.icon), App.el('span', {}, m.label));
      mealPicker.appendChild(b);
    });
    zone.appendChild(mealPicker);

    // 多条食材可编辑
    const itemsZone = App.el('div', { class: 'food-edit-items' });
    function renderItems() {
      App.clear(itemsZone);
      state.items.forEach((it, idx) => {
        const row = App.el('div', { class: 'food-edit-row' });
        row.appendChild(App.el('input', {
          class: 'input', placeholder: '食物名称，如 鸡肉饭', value: it.name || '',
          oninput: function () { it.name = this.value; }
        }));
        row.appendChild(App.el('input', {
          class: 'input food-edit-portion', placeholder: '份量，如 鸡肉 120g', value: it.portion || '',
          oninput: function () { it.portion = this.value; }
        }));
        const calIn = App.el('div', { class: 'food-edit-cal' },
          App.el('input', {
            class: 'input food-cal-input', type: 'number', min: '0', placeholder: 'min', value: it.calMin || 0,
            oninput: function () { it.calMin = parseInt(this.value, 10) || 0; }
          }),
          App.el('span', {}, '–'),
          App.el('input', {
            class: 'input food-cal-input', type: 'number', min: '0', placeholder: 'max', value: it.calMax || 0,
            oninput: function () { it.calMax = parseInt(this.value, 10) || 0; }
          }),
          App.el('span', { class: 'food-edit-cal-label' }, 'kcal')
        );
        row.appendChild(calIn);
        if (state.items.length > 1) {
          row.appendChild(App.el('button', { class: 'btn btn--ghost btn--icon', onclick: () => { state.items.splice(idx, 1); renderItems(); } }, '✕'));
        }
        itemsZone.appendChild(row);
      });
      // 合计
      const totMin = state.items.reduce((s, x) => s + (x.calMin || 0), 0);
      const totMax = state.items.reduce((s, x) => s + (x.calMax || 0), 0);
      itemsZone.appendChild(App.el('div', { class: 'food-edit-total' },
        '估算合计：' + totMin + '–' + totMax + ' kcal（估算值）'
      ));
    }
    renderItems();
    zone.appendChild(itemsZone);

    zone.appendChild(App.el('div', { class: 'food-edit-actions' },
      App.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => { state.items.push({ name: '', portion: '', calMin: 0, calMax: 0 }); renderItems(); } }, '➕ 加一项食材'),
      App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => confirmAdd(state) }, '✓ 确认加入今日记录')
    ));

    if (state.note || state.confidence) {
      zone.appendChild(App.el('div', { class: 'food-ai-note' },
        state.confidence ? 'AI 置信度：' + state.confidence + '。' : '',
        App.esc(state.note || 'AI 估算仅供参考，可自行修改份量与热量。')
      ));
    }
  }

  function confirmAdd(state) {
    // 至少要有一项有名称
    const valid = state.items.filter(x => (x.name || '').trim());
    if (!valid.length) { App.toast('至少填一项食物名称 🌷'); return; }
    const log = todayLog();
    const time = new Date().toTimeString().slice(0, 5);
    valid.forEach(it => {
      log.push({
        id: App.Storage.uid(),
        meal: state.meal,
        name: it.name.trim(),
        portion: it.portion || '',
        calMin: it.calMax || it.calMin || 0,
        calMax: it.calMax || it.calMin || 0,
        time: time,
        photo: state.photo || ''
      });
    });
    App.Storage.save();
    App.toast('已加入今日 Food Log 🍱');
    App.refresh();
  }

  function editItem(it) {
    // 用现有数据进入编辑表单 → 确认后替换
    const zone = document.getElementById('food-result-zone');
    if (!zone) return;
    const state = {
      photo: it.photo || '',
      meal: it.meal,
      items: [{ name: it.name, portion: it.portion, calMin: it.calMin, calMax: it.calMax }],
      note: '', confidence: ''
    };
    App.clear(zone);
    zone.appendChild(App.el('div', { class: 'food-notice' }, '编辑「' + it.name + '」，确认后会更新这条记录'));
    editForm(zone, state);
    // 改写确认按钮行为：替换而非新增
    zone.querySelector('.btn--primary').onclick = () => {
      const v = state.items.filter(x => (x.name || '').trim());
      if (!v.length) { App.toast('至少填一项 🌷'); return; }
      it.name = v[0].name.trim();
      it.portion = v[0].portion;
      it.calMin = v[0].calMin; it.calMax = v[0].calMax;
      it.meal = state.meal;
      if (state.photo) it.photo = state.photo;
      App.Storage.save();
      App.toast('已更新 🍱');
      App.refresh();
    };
  }

  function deleteItem(id) {
    const log = todayLog();
    const i = log.findIndex(x => x.id === id);
    if (i >= 0) {
      log.splice(i, 1);
      App.Storage.save();
      App.toast('已删除 🗑️');
      App.refresh();
    }
  }

  /* ---- 统计卡片 + 周图表 ---- */
  function statsCard() {
    const d = App.Storage.getData();
    const S = App.Storage;
    const week = S.weekDates();
    const today = S.today();

    let daysLogged = 0, weekSum = 0;
    const bars = week.map(dd => {
      const arr = (d.food.log[dd] || []);
      const avg = arr.length ? arr.reduce((s, x) => s + ((x.calMin + x.calMax) / 2), 0) : 0;
      if (arr.length) { daysLogged++; weekSum += avg; }
      return { date: dd, avg: Math.round(avg), logged: !!arr.length, isToday: dd === today };
    });
    const weekAvg = daysLogged ? Math.round(weekSum / daysLogged) : 0;
    const todayCal = ((d.food.log[today] || []).reduce((s, x) => s + ((x.calMin + x.calMax) / 2), 0)) | 0;
    const maxBar = Math.max(800, ...bars.map(b => b.avg));

    const card = App.card({}, App.sectionHead('📊', '饮食统计', '估算值，仅供参考'));
    card.appendChild(App.el('div', { class: 'food-stats' },
      statBox(todayCal, '今日估算 kcal'),
      statBox(weekAvg, '本周日均 kcal'),
      statBox(daysLogged, '本周记录天数')
    ));

    // 周柱状图
    const WD = ['一','二','三','四','五','六','日'];
    const chart = App.el('div', { class: 'food-chart' });
    bars.forEach((b, wi) => {
      const h = Math.round((b.avg / maxBar) * 100);
      const col = App.el('div', { class: 'food-chart__col' },
        App.el('div', { class: 'food-chart__bar-wrap' },
          App.el('div', { class: 'food-chart__bar' + (b.isToday ? ' is-today' : ''), style: { height: (b.logged ? Math.max(6, h) : 4) + '%' } }),
          b.logged ? App.el('div', { class: 'food-chart__val' }, String(b.avg)) : null
        ),
        App.el('div', { class: 'food-chart__day' }, b.isToday ? '今' : '周' + WD[wi])
      );
      chart.appendChild(col);
    });
    card.appendChild(chart);
    return card;
  }

  function statBox(num, label) {
    return App.el('div', { class: 'food-stat' },
      App.el('div', { class: 'food-stat__num' }, String(num)),
      App.el('div', { class: 'food-stat__label' }, label)
    );
  }

  App.registerView({ id: 'food', name: '食物', shortName: '食物', icon: '🍱', render: render });
})(window);
