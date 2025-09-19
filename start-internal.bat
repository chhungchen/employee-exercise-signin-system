@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo.
echo =====================================================
echo    內網輔助郵件伺服器 - 啟動腳本
echo =====================================================
echo.

REM 設定內網環境變數
set NODE_ENV=internal
set FORCE_INTERNAL_SMTP=true
set INTERNAL_PORT=3001

REM 載入企業SMTP配置（從mail.env）
if exist mail.env (
    echo 📋 載入企業SMTP配置...
    for /f "usebackq tokens=1,2 delims==" %%a in ("mail.env") do (
        if "%%a"=="INTERNAL_SMTP_HOST" set INTERNAL_SMTP_HOST=%%b
        if "%%a"=="INTERNAL_SMTP_FROM" set INTERNAL_SMTP_FROM=%%b
    )
    echo ✅ 企業SMTP配置已載入
) else (
    echo ⚠️ mail.env 檔案不存在，使用預設設定
    set INTERNAL_SMTP_HOST=ex2016.jih-sun.com.tw
    set INTERNAL_SMTP_FROM=system@company.local
)

REM 檢查Node.js是否安裝
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤: 未安裝 Node.js
    echo 請先安裝 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM 檢查依賴模組
if not exist node_modules (
    echo 📦 安裝依賴模組...
    npm install
    if errorlevel 1 (
        echo ❌ 依賴模組安裝失敗
        pause
        exit /b 1
    )
)

REM 檢查PM2是否已安裝
npx pm2 --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤: PM2未安裝或不可用
    echo 請執行: npm install
    pause
    exit /b 1
)

echo.
echo 🚀 啟動內網輔助郵件伺服器...
echo.
echo 配置資訊:
echo - 端口: %INTERNAL_PORT%
echo - SMTP主機: %INTERNAL_SMTP_HOST%
echo - 發件人: %INTERNAL_SMTP_FROM%
echo - 環境: %NODE_ENV%
echo.

REM 停止已存在的PM2進程（如果有的話）
echo 🔄 檢查並停止現有進程...
npx pm2 stop internal-email-server >nul 2>&1
npx pm2 delete internal-email-server >nul 2>&1

REM 等待進程完全釋放端口
echo ⏳ 等待端口釋放...
timeout /t 3 >nul

REM 精確檢查127.0.0.1:3001端口是否被佔用
netstat -an | findstr "127.0.0.1:3001" >nul
if not errorlevel 1 (
    echo ⚠️ 警告: 本地端口 127.0.0.1:3001 仍被佔用
    echo 🔍 嘗試查找佔用進程...

    REM 查找佔用端口的進程
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:3001" ^| findstr "LISTENING"') do (
        set OCCUPY_PID=%%a
    )

    if defined OCCUPY_PID (
        echo 📊 佔用進程ID: !OCCUPY_PID!
        tasklist /fi "PID eq !OCCUPY_PID!" /fo table
        echo.
        echo 💡 建議解決方案:
        echo 1. 執行 stop-internal.bat 停止相關服務
        echo 2. 或手動終止進程: taskkill /PID !OCCUPY_PID! /F
        echo 3. 或重啟電腦釋放所有端口
    ) else (
        echo ❓ 無法識別佔用端口的進程
    )

    pause
    exit /b 1
)

REM 額外檢查是否有其他包含3001的端口被誤判
echo 🔍 檢查端口狀態...
netstat -an | findstr "3001" | findstr /v "127.0.0.1:3001"
if not errorlevel 1 (
    echo ℹ️ 發現其他包含3001的端口（非衝突）:
    netstat -an | findstr "3001" | findstr /v "127.0.0.1:3001"
    echo ✅ 這些端口不會影響內網伺服器啟動
    echo.
)

REM 使用PM2啟動內網伺服器
echo 🚀 使用PM2啟動內網輔助伺服器...
npx pm2 start ecosystem.config.js --env internal

REM 檢查啟動狀態
timeout /t 3 >nul
npx pm2 list | findstr "internal-email-server" >nul
if errorlevel 1 (
    echo ❌ PM2啟動失敗
    npx pm2 logs internal-email-server --lines 10
    pause
    exit /b 1
)

echo.
echo ✅ 內網輔助郵件伺服器已成功啟動
echo 📱 管理介面: http://localhost:%INTERNAL_PORT%/admin/internal-email
echo 🔧 系統狀態: http://localhost:%INTERNAL_PORT%/api/internal/status
echo 📊 PM2監控: npx pm2 monit
echo 📋 檢查狀態: npx pm2 list
echo 📄 查看日誌: npx pm2 logs internal-email-server
echo.
echo 💡 使用 stop-internal.bat 停止伺服器
echo 💡 或執行: npx pm2 stop internal-email-server
echo.
pause