#!/bin/bash
# WorkBuddy 启动脚本 (macOS / Linux)
# 双击此文件 或 在终端运行: bash start.sh

cd "$(dirname "$0")"

# 尝试用 python3，没有就用 python
if command -v python3 &>/dev/null; then
  PY=python3
elif command -v python &>/dev/null; then
  PY=python
else
  echo "❌ 没有找到 Python。请先安装：https://www.python.org/downloads/"
  read -p "按回车退出..."
  exit 1
fi

PORT=8080
echo "🌷 正在启动 WorkBuddy..."
echo "   地址: http://localhost:$PORT"
echo "   按 Ctrl+C 停止"
echo ""

# 1.5 秒后打开浏览器
( sleep 1.5 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null ) &

$PY -m http.server $PORT
