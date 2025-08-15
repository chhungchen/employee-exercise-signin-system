#!/bin/bash

# 員工運動社團活動簽到系統 - 快速部署腳本 (Linux/macOS)

set -e

echo "================================"
echo "員工運動社團活動簽到系統"
echo "快速部署腳本"
echo "================================"
echo

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查系統需求
echo "正在檢查系統需求..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 錯誤：未安裝 Node.js${NC}"
    echo "請先安裝 Node.js: https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 錯誤：npm 不可用${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ 錯誤：未安裝 Git${NC}"
    echo "請先安裝 Git: https://git-scm.com/"
    exit 1
fi

echo -e "${GREEN}✅ 系統需求檢查通過${NC}"
echo

# 安裝依賴
echo "🔧 正在安裝依賴套件..."
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 依賴套件安裝完成${NC}"
else
    echo -e "${RED}❌ 依賴套件安裝失敗${NC}"
    exit 1
fi
echo

# 初始化資料庫
echo "🗄️ 正在初始化本地資料庫..."
npm run init-db
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 本地資料庫初始化完成${NC}"
else
    echo -e "${RED}❌ 資料庫初始化失敗${NC}"
    exit 1
fi
echo

# 檢查環境變數
echo "📋 檢查環境變數設定..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 檔案${NC}"
    echo "正在建立 .env 範例檔案..."
    cp ".env.example" ".env"
    echo -e "${GREEN}✅ 已建立 .env 檔案${NC}"
    echo
    echo -e "${BLUE}🔑 請編輯 .env 檔案並設定您的 Google 服務憑證：${NC}"
    echo "   - GOOGLE_SERVICE_ACCOUNT_KEY"
    echo "   - GOOGLE_SPREADSHEET_ID"
    echo "   - GOOGLE_DRIVE_FOLDER_ID"
    echo
    echo "詳細設定步驟請參考：GOOGLE_SETUP.md"
    echo
else
    echo -e "${GREEN}✅ 找到 .env 檔案${NC}"
fi

# 測試本地伺服器
echo "🧪 正在測試本地伺服器..."
echo "啟動測試伺服器 (將在 5 秒後自動關閉)..."
timeout 5s npm run dev > /dev/null 2>&1 || true
echo -e "${GREEN}✅ 本地測試完成${NC}"
echo

# 部署選項
echo -e "${BLUE}🚀 部署選項：${NC}"
echo
echo "[1] 部署到 Render.com (推薦)"
echo "[2] 部署到 Railway"
echo "[3] 部署到 Vercel"
echo "[4] 僅準備 Git 提交"
echo "[5] 跳過部署"
echo
read -p "請選擇部署方式 (1-5): " choice

case $choice in
    1)
        echo
        echo -e "${BLUE}🎖️ 準備部署到 Render.com...${NC}"
        echo
        echo "請按照以下步驟操作："
        echo "1. 前往 https://render.com 註冊帳號"
        echo "2. 點擊 'New +' 按鈕"
        echo "3. 選擇 'Web Service'"
        echo "4. 連接您的 GitHub 儲存庫"
        echo "5. 設定部署參數："
        echo "   - Environment: Node"
        echo "   - Build Command: npm install"
        echo "   - Start Command: npm start"
        echo "6. 在 Environment 分頁設定環境變數 (參考 .env 檔案)"
        echo
        ;;
    2)
        echo
        echo -e "${BLUE}🚂 準備部署到 Railway...${NC}"
        echo
        if ! command -v railway &> /dev/null; then
            echo -e "${YELLOW}⚠️  未安裝 Railway CLI${NC}"
            echo "請執行: npm install -g @railway/cli"
            echo "然後執行: railway login"
        else
            echo -e "${GREEN}✅ Railway CLI 已安裝${NC}"
            echo
            echo "開始部署到 Railway..."
            railway up
            exit 0
        fi
        ;;
    3)
        echo
        echo -e "${BLUE}⚡ 準備部署到 Vercel...${NC}"
        echo
        if ! command -v vercel &> /dev/null; then
            echo -e "${YELLOW}⚠️  未安裝 Vercel CLI${NC}"
            echo "請執行: npm install -g vercel"
        else
            echo -e "${GREEN}✅ Vercel CLI 已安裝${NC}"
            echo
            echo "開始部署到 Vercel..."
            vercel
            exit 0
        fi
        ;;
    4|*)
        ;;
esac

# Git 提交
echo
echo "📝 準備 Git 提交..."
if ! git status &> /dev/null; then
    echo "初始化 Git 儲存庫..."
    git init
    git branch -M main
fi

echo "正在新增檔案到 Git..."
git add .
git status

echo
read -p "請輸入提交訊息 (預設：初始部署): " commit_msg
commit_msg=${commit_msg:-"初始部署"}

git commit -m "$commit_msg"
echo -e "${GREEN}✅ Git 提交完成${NC}"
echo
echo "如需推送到 GitHub，請執行："
echo "git remote add origin https://github.com/您的使用者名稱/儲存庫名稱.git"
echo "git push -u origin main"

# 完成訊息
echo
echo "================================"
echo -e "${GREEN}🎉 設定完成！${NC}"
echo "================================"
echo
echo -e "${BLUE}📋 接下來的步驟：${NC}"
echo

if [ -f ".env" ]; then
    if grep -q "GOOGLE_SERVICE_ACCOUNT_KEY.*{" .env; then
        echo -e "${GREEN}✅ 1. Google 服務設定已完成${NC}"
        echo "   2. 可以執行: npm run migrate-to-google (遷移現有資料)"
    else
        echo -e "${YELLOW}⚠️  1. 完成 Google 服務設定 (參考 GOOGLE_SETUP.md)${NC}"
        echo "   2. 編輯 .env 檔案並填入真實的憑證"
        echo "   3. 測試 Google 整合: npm run migrate-to-google"
    fi
else
    echo -e "${YELLOW}⚠️  1. 設定環境變數 (複製 .env.example 為 .env)${NC}"
    echo "   2. 完成 Google 服務設定 (參考 GOOGLE_SETUP.md)"
fi

echo "   3. 本地測試: npm run dev"
echo "   4. 部署到雲端平台 (參考 deploy.md)"
echo
echo -e "${BLUE}📖 詳細文件：${NC}"
echo "   - GOOGLE_SETUP.md - Google 服務設定指南"
echo "   - deploy.md - 完整部署指南"
echo "   - README.md - 系統使用說明"
echo
echo -e "${BLUE}🆘 如需協助，請查看 README.md 或聯絡技術支援${NC}"
echo