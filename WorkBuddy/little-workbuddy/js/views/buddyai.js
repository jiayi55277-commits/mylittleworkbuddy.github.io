/* =====================================================================
 * buddyai.js — 🤖 Buddy AI 个人助手
 * 真正可连接 AI API 的聊天界面；未配置时进入本地兜底（同样基于真实数据）。
 * 对话历史保存在 localStorage，配置（endpoint/key/model）也在本机。
 * ===================================================================== */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  const QUICK = [
    { icon: '✨', label: '帮我规划今天', text: '帮我规划一下今天剩下的时间' },
    { icon: '📚', label: '帮我学习', text: '帮我把学习 Python 拆成几个小任务' },
    { icon: '✅', label: '整理我的任务', text: '我今天还有什么事情没完成？' },
    { icon: '🌙', label: '帮安排今晚', text: '帮我安排今晚的时间' },
    { icon: '📊', label: '本周总结', text: '帮我总结一下这周完成了什么' },
    { icon: '🌷', label: '今天状态不好', text: '我今天状态不太好，可以帮我调整一下计划吗' }
  ];

  function render(container) {
    const card = App.card({}, App.sectionHead('🤖', 'Buddy AI', '了解你日常生活的个人小助手'));

    // 状态条 + 设置按钮
    const configured = App.AI.isConfigured();
    const statusBar = App.el('div', { class: 'ai-status' },
      App.el('span', { class: 'ai-badge ' + (configured ? 'is-api' : 'is-local') },
        configured ? '🟣 已连接 AI' : '🟢 本地模式'),
      App.el('span', { class: 'ai-status__hint' },
        configured ? '使用 ' + (App.AI.getConfig().model || '模型') : '未配置 API，使用基于真实数据的本地兜底'),
      App.el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: 'auto' }, onclick: toggleConfig }, '⚙️ 设置')
    );
    card.appendChild(statusBar);

    // 配置面板（默认隐藏）
    const configPanel = App.el('div', { class: 'ai-config', style: { display: 'none' } });
    buildConfigPanel(configPanel);
    card.appendChild(configPanel);

    // 对话窗口
    const chatBox = App.el('div', { class: 'ai-chat' });
    renderMessages(chatBox);
    card.appendChild(chatBox);

    // 快捷按钮
    const quickRow = App.el('div', { class: 'ai-quick' });
    QUICK.forEach(q => {
      quickRow.appendChild(App.el('button', {
        class: 'ai-quick__btn',
        onclick: () => send(q.text)
      }, App.el('span', {}, q.icon), App.el('span', {}, q.label)));
    });
    card.appendChild(quickRow);

    // 输入区
    const input = App.el('textarea', { class: 'textarea ai-input', placeholder: '跟 Buddy 说点什么… 按 Enter 发送，Shift+Enter 换行 🌷', rows: '2' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
    });
    card.appendChild(App.el('div', { class: 'ai-input-row' },
      input,
      App.el('button', { class: 'btn btn--primary', id: 'ai-send-btn', onclick: () => send(input.value) }, '发送 🌷')
    ));

    // 清空对话
    card.appendChild(App.el('div', { class: 'ai-foot' },
      App.el('button', { class: 'btn btn--ghost btn--sm', onclick: clearChat }, '清空对话')
    ));

    container.appendChild(card);
  }

  function renderMessages(box) {
    App.clear(box);
    const msgs = App.AI.getMessages();
    if (!msgs.length) {
      box.appendChild(App.el('div', { class: 'empty-hint' },
        '嗨～我是 Buddy 🌷 我能看到你的 To-Do、时间表、习惯、学习进度、心情和笔记。',
        App.el('br', {}),
        '想让我帮你安排今天、整理任务，还是总结一下这周？直接说，或点下面的快捷按钮 ✨'
      ));
      return;
    }
    msgs.forEach(m => {
      const mine = m.role === 'user';
      const bubble = App.el('div', { class: 'ai-msg ' + (mine ? 'is-mine' : 'is-buddy') },
        App.el('div', { class: 'ai-msg__bubble', html: App.esc(m.content).replace(/\n/g, '<br>') })
      );
      box.appendChild(bubble);
    });
    box.scrollTop = box.scrollHeight;
  }

  function toggleConfig() {
    const p = document.querySelector('.ai-config');
    if (p) p.style.display = (p.style.display === 'none' ? 'block' : 'none');
  }

  function buildConfigPanel(panel) {
    const c = App.AI.getConfig();
    const epIn = App.el('input', { class: 'input', value: c.endpoint || '', placeholder: 'https://api.openai.com/v1' });
    const keyIn = App.el('input', { class: 'input', type: 'password', value: c.apiKey || '', placeholder: 'sk-... 你的 API Key' });
    const modelIn = App.el('input', { class: 'input', value: c.model || '', placeholder: 'gpt-4o-mini（需支持视觉才能识别食物）' });

    panel.appendChild(App.el('div', { class: 'ai-config__hint' },
      '兼容 OpenAI 格式的任意服务：OpenAI / DeepSeek / Moonshot / 本地 Ollama 等。填好接口地址、Key 和模型名即可。',
      App.el('br', {}),
      'Key 仅保存在本机 localStorage，不会上传到任何第三方（除你填的接口外）。'
    ));
    panel.appendChild(App.el('div', { class: 'ai-config__row' },
      App.el('label', { class: 'ai-config__label' }, '接口地址'),
      epIn
    ));
    panel.appendChild(App.el('div', { class: 'ai-config__row' },
      App.el('label', { class: 'ai-config__label' }, 'API Key'),
      keyIn
    ));
    panel.appendChild(App.el('div', { class: 'ai-config__row' },
      App.el('label', { class: 'ai-config__label' }, '模型'),
      modelIn
    ));
    panel.appendChild(App.el('div', { class: 'ai-config__row' },
      App.el('button', { class: 'btn btn--primary btn--sm', onclick: () => {
        App.AI.saveConfig({ endpoint: epIn.value.trim(), apiKey: keyIn.value.trim(), model: modelIn.value.trim() });
        App.toast('设置已保存 🌷');
        App.refresh();
      } }, '💾 保存设置'),
      App.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => {
        App.AI.saveConfig({ apiKey: '' });
        App.toast('已清除 API Key');
        App.refresh();
      } }, '清除 Key')
    ));
  }

  async function send(text) {
    text = (text || '').trim();
    if (!text) return;
    const btn = document.getElementById('ai-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '思考中…'; }

    const box = document.querySelector('.ai-chat');
    // 显示用户消息（仅渲染，不入库 —— chat() 会负责入库）
    if (box) {
      const ub = App.el('div', { class: 'ai-msg is-mine' },
        App.el('div', { class: 'ai-msg__bubble', html: App.esc(text).replace(/\n/g, '<br>') }));
      box.appendChild(ub);
      const lb = App.el('div', { class: 'ai-msg is-buddy' },
        App.el('div', { class: 'ai-msg__bubble ai-msg__bubble--loading' }, '正在想想… 🌷'));
      box.appendChild(lb);
      box.scrollTop = box.scrollHeight;
    }

    try {
      const res = await App.AI.chat(text);   // chat 会入库 user + assistant
      if (box) {
        // 移除 loading，重新渲染完整对话（保证一致性）
        renderMessages(box);
      }
      const input = document.querySelector('.ai-input');
      if (input) input.value = '';
    } catch (e) {
      if (box) {
        const lbs = box.querySelector('.ai-msg__bubble--loading');
        if (lbs && lbs.parentElement) lbs.parentElement.remove();
        const eb = App.el('div', { class: 'ai-msg is-buddy' },
          App.el('div', { class: 'ai-msg__bubble' }, '出了点小问题：' + (e.message || '') + ' 🌷'));
        box.appendChild(eb);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '发送 🌷'; }
    }
  }

  function clearChat() {
    App.AI.clearMessages();
    App.toast('对话已清空 🌷');
    App.refresh();
  }

  App.registerView({ id: 'buddyai', name: 'Buddy AI', shortName: 'AI', icon: '🤖', render: render });
})(window);
