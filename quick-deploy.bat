@echo off
chcp 65001 > nul
echo ================================
echo 員工運動社團活動簽到系統
echo 快速部署腳本
echo ================================
echo.

echo 正在檢查系統需求...
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤：未安裝 Node.js
    echo 請先安裝 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

npm --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤：npm 不可用
    pause
    exit /b 1
)

git --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤：未安裝 Git
    echo 請先安裝 Git: https://git-scm.com/
    pause
    exit /b 1
)

echo ✅ 系統需求檢查通過
echo.

echo 🔧 正在安裝依賴套件...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 依賴套件安裝失敗
    pause
    exit /b 1
)
echo ✅ 依賴套件安裝完成
echo.

echo 🗄️ 正在初始化本地資料庫...
call npm run init-db
if %errorlevel% neq 0 (
    echo ❌ 資料庫初始化失敗
    pause
    exit /b 1
)
echo ✅ 本地資料庫初始化完成
echo.

echo 📋 檢查環境變數設定...
if not exist ".env" (
    echo ⚠️  未找到 .env 檔案
    echo 正在建立 .env 範例檔案...
    copy ".env.example" ".env" > nul
    echo ✅ 已建立 .env 檔案
    echo.
    echo 🔑 請編輯 .env 檔案並設定您的 Google 服務憑證：
    echo    - GOOGLE_SERVICE_ACCOUNT_KEY
    echo    - GOOGLE_SPREADSHEET_ID
    echo    - GOOGLE_DRIVE_FOLDER_ID
    echo.
    echo 詳細設定步驟請參考：GOOGLE_SETUP.md
    echo.
) else (
    echo ✅ 找到 .env 檔案
)

echo 🧪 正在測試本地伺服器...
echo 啟動測試伺服器 (將在 3 秒後自動關閉)...
timeout /t 3 > nul
start /min cmd /c "npm run dev & timeout /t 5 & taskkill /f /im node.exe"
timeout /t 7 > nul
echo ✅ 本地測試完成
echo.

echo 🚀 部署選項：
echo.
echo [1] 部署到 Render.com (推薦)
echo [2] 部署到 Railway
echo [3] 部署到 Vercel
echo [4] 僅準備 Git 提交
echo [5] 跳過部署
echo.
set /p choice="請選擇部署方式 (1-5): "

if "%choice%"=="1" goto deploy_render
if "%choice%"=="2" goto deploy_railway
if "%choice%"=="3" goto deploy_vercel
if "%choice%"=="4" goto git_commit
if "%choice%"=="5" goto skip_deploy
echo 無效選擇，跳過部署
goto skip_deploy

:deploy_render
echo.
echo 🎖️ 準備部署到 Render.com...
echo.
echo 請按照以下步驟操作：
echo 1. 前往 https://render.com 註冊帳號
echo 2. 點擊 "New +" 按鈕
echo 3. 選擇 "Web Service"
echo 4. 連接您的 GitHub 儲存庫
echo 5. 設定部署參數：
echo    - Environment: Node
echo    - Build Command: npm install
echo    - Start Command: npm start
echo 6. 在 Environment 分頁設定環境變數 (參考 .env 檔案)
echo.
goto git_commit

:deploy_railway
echo.
echo 🚂 準備部署到 Railway...
echo.
echo 正在檢查 Railway CLI...
railway --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  未安裝 Railway CLI
    echo 請執行: npm install -g @railway/cli
    echo 然後執行: railway login
    pause
    goto git_commit
)
echo ✅ Railway CLI 已安裝
echo.
echo 開始部署到 Railway...
railway up
goto end

:deploy_vercel
echo.
echo ⚡ 準備部署到 Vercel...
echo.
echo 正在檢查 Vercel CLI...
vercel --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  未安裝 Vercel CLI
    echo 請執行: npm install -g vercel
    pause
    goto git_commit
)
echo ✅ Vercel CLI 已安裝
echo.
echo 開始部署到 Vercel...
vercel
goto end

:git_commit
echo.
echo 📝 準備 Git 提交...
git status > nul 2>&1
if %errorlevel% neq 0 (
    echo 初始化 Git 儲存庫...
    git init
    git branch -M main
)

echo 正在新增檔案到 Git...
git add .
git status

echo.
set /p commit_msg="請輸入提交訊息 (預設：初始部署): "
if "%commit_msg%"=="" set commit_msg=初始部署

git commit -m "%commit_msg%"
echo ✅ Git 提交完成
echo.
echo 如需推送到 GitHub，請執行：
echo git remote add origin https://github.com/您的使用者名稱/儲存庫名稱.git
echo git push -u origin main
goto end

:skip_deploy
echo.
echo ⏭️ 跳過部署步驟

:end
echo.
echo ================================
echo 🎉 設定完成！
echo ================================
echo.
echo 📋 接下來的步驟：
echo.
if exist ".env" (
    findstr /C:"GOOGLE_SERVICE_ACCOUNT_KEY=" .env | findstr /C:"{" > nul
    if %errorlevel% neq 0 (
        echo ⚠️  1. 完成 Google 服務設定 (參考 GOOGLE_SETUP.md)
        echo    2. 編輯 .env 檔案並填入真實的憑證
        echo    3. 測試 Google 整合: npm run migrate-to-google
    ) else (
        echo ✅ 1. Google 服務設定已完成
        echo    2. 可以執行: npm run migrate-to-google (遷移現有資料)
    )
) else (
    echo ⚠️  1. 設定環境變數 (複製 .env.example 為 .env)
    echo    2. 完成 Google 服務設定 (參考 GOOGLE_SETUP.md)
)
echo    3. 本地測試: npm run dev
echo    4. 部署到雲端平台 (參考 deploy.md)
echo.
echo 📖 詳細文件：
echo    - GOOGLE_SETUP.md - Google 服務設定指南
echo    - deploy.md - 完整部署指南
echo    - README.md - 系統使用說明
echo.
echo 🆘 如需協助，請查看 README.md 或聯絡技術支援
echo.
pause