@echo off
echo ========================================
echo   員工運動社團活動簽到系統 - Heroku部署
echo ========================================
echo.

REM 檢查是否安裝了 Git
git --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ 錯誤: 請先安裝 Git
    echo 請訪問: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM 檢查是否安裝了 Node.js
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ 錯誤: 請先安裝 Node.js
    echo 請訪問: https://nodejs.org/
    pause
    exit /b 1
)

REM 檢查是否安裝了 Heroku CLI
heroku --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ 錯誤: 請先安裝 Heroku CLI
    echo 請訪問: https://devcenter.heroku.com/articles/heroku-cli
    echo 或執行: npm install -g heroku
    pause
    exit /b 1
)

echo ✅ 環境檢查完成
echo.

echo 🔧 準備部署...

REM 初始化 Git（如果尚未初始化）
if not exist .git (
    echo 📝 初始化 Git 倉庫...
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
)

echo 🌐 登入 Heroku...
heroku login

REM 創建 Heroku 應用
echo.
echo 📱 創建 Heroku 應用...
echo 請輸入應用名稱（留空則自動生成）:
set /p APP_NAME="應用名稱: "

if "%APP_NAME%"=="" (
    heroku create
) else (
    heroku create %APP_NAME%
)

if %ERRORLEVEL% neq 0 (
    echo ❌ 創建應用失敗，可能應用名稱已存在
    pause
    exit /b 1
)

echo.
echo ⚙️ 設定環境變數...
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%

echo.
echo 🚀 開始部署...
git add .
git commit -m "Deploy to Heroku" 2>nul
git push heroku main

if %ERRORLEVEL% neq 0 (
    echo ❌ 部署失敗，請檢查錯誤訊息
    pause
    exit /b 1
)

echo.
echo 🎉 部署成功！
echo.
echo 📱 您的應用已上線！
heroku open
echo.
echo 📋 有用的指令:
echo   查看日誌: heroku logs --tail
echo   重啟應用: heroku restart
echo   開啟應用: heroku open
echo   本地測試: npm run dev
echo.
echo 🔑 管理員登入資訊:
echo   帳號: admin
echo   密碼: [請參考環境變數設定]
echo   管理頁面: [您的應用網址]/admin
echo.
echo ✅ 部署完成！按任意鍵結束...
pause