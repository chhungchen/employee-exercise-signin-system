#!/bin/bash

echo "🔨 開始 Render.com 建置流程..."

# 設定環境變數
export NODE_ENV=production

# 清理和安裝依賴
echo "📦 安裝依賴..."
npm ci --production=false

# 重新建置 SQLite3 (針對 Linux)
echo "🔧 重新建置 SQLite3..."
npm rebuild sqlite3

# 初始化資料庫
echo "🗄️ 初始化資料庫..."
npm run init-db

echo "✅ 建置完成！"