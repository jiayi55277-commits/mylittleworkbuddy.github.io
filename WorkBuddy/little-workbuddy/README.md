# 🌷 My Little WorkBuddy

一个温柔的个人工作台 PWA —— 待办、日程、专注、学习、习惯、心情、笔记、AI 助手、食物热量、目标旅程、进度回顾。

## 🚀 在笔记本上打开

### 方式一：用启动脚本（最简单）

| 系统 | 操作 |
|---|---|
| **Mac** | 双击 `start.sh`，或在终端运行 `bash start.sh` |
| **Windows** | 双击 `start.bat` |

脚本会自动启动本地服务器并打开浏览器，看到 🌷 图标就成功了。

> 需要 Python 环境。Mac 自带；Windows 用户如未安装，去 https://www.python.org/downloads/ 下载安装（勾选 Add to PATH）。

### 方式二：手动命令

```bash
# 进入项目文件夹
cd little-workbuddy

# 启动服务器
python3 -m http.server 8080      # Mac/Linux
python -m http.server 8080        # Windows

# 然后浏览器打开 http://localhost:8080
```

---

## 📱 安装到手机主屏幕

PWA 需要通过 **HTTPS 或 localhost** 才能安装。两种方式：

### 方式 A：部署到公网（推荐，手机随时可用）

把整个文件夹上传到任意静态托管服务（免费）：

- [Vercel](https://vercel.com) — 拖拽文件夹即可
- [Netlify](https://www.netlify.com) — 拖拽到 Drop 区域
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Pages](https://pages.github.com)

部署后拿到一个 `https://xxx.vercel.app` 网址，用手机打开：

- **iPhone (Safari)**：打开网址 → 底部分享按钮 → 添加到主屏幕
- **Android (Chrome)**：打开网址 → 菜单 → 添加到主屏幕 / 安装应用

### 方式 B：笔记本当服务器，手机连同一个 WiFi

1. 笔记本运行 `start.sh`（或 `python3 -m http.server 8080`）
2. 查笔记本 IP：Mac 终端 `ipconfig getifaddr en0`；Windows `ipconfig` 看 IPv4
3. 手机浏览器打开 `http://笔记本IP:8080`（如 `http://192.168.1.5:8080`）

> ⚠️ 这种方式能浏览和用本地数据，但 PWA 安装到主屏需要 HTTPS，所以「添加主屏幕」可能不可用。要完整 PWA 体验用方式 A。

---

## ✨ 功能一览

| 视图 | 用途 |
|---|---|
| 🏠 首页 | 今日概览 + 每日一句 + AI 小助手入口 |
| ✅ 待办 | 任务清单，可标完成 |
| 📅 日程 | 安排今天的事 |
| ⏱️ 专注 | 番茄钟计时 |
| 📚 学习 | 记录学习时长和主题 |
| 🌱 习惯 | 每日习惯打卡 |
| 😊 心情 | 记录今天心情 |
| 📝 笔记 | 随手记东西 |
| 🍱 食物 | 拍照识别食物 + 估算卡路里（需配 AI） |
| 🎯 目标 | 月度目标 → 里程碑 → 旅程 → 反思 |
| 📊 进度 | 周/月度回顾，自动从数据汇总 |
| 🌷 小成就 | 记录每一个小胜利 |
| 🤖 AI 助手 | 聊天式个人助手，读取你的真实数据 |

## 🤖 AI 配置（可选）

Buddy AI、食物识别、每日一句、进度反思都内置了本地模式 —— **不配 API 也能用**，会基于你的真实数据给出回答。

想用真正的 LLM（聊天更智能、能识别食物图片）：

1. 打开 🤖 AI 助手 → 右上角 ⚙️ 设置
2. 填入 OpenAI 兼容的 API：
   - **Endpoint**：如 `https://api.openai.com/v1`
   - **API Key**：你的 key
   - **Model**：如 `gpt-4o-mini`（食物识别需要 vision 模型，如 `gpt-4o`）

支持任何 OpenAI 兼容服务：OpenAI / DeepSeek / Moonshot / 本地 Ollama 等。

---

## 💾 数据

所有数据存在浏览器的 localStorage 里，不上传任何服务器。换设备/清浏览器缓存数据会丢失，请留意。
