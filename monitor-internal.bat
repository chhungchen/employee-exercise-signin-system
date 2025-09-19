@echo off
chcp 65001 >nul
echo.
echo =====================================================
echo    內網輔助郵件伺服器 - PM2監控腳本
echo =====================================================
echo.

REM 檢查PM2是否已安裝
npx pm2 --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤: PM2未安裝或不可用
    echo 請執行: npm install
    pause
    exit /b 1
)

echo 📊 內網輔助伺服器 PM2 監控面板
echo.

:menu
echo =====================================================
echo 請選擇監控操作:
echo.
echo 1. 📋 查看進程列表 (pm2 list)
echo 2. 📊 即時監控儀表板 (pm2 monit)
echo 3. 📄 查看即時日誌 (pm2 logs)
echo 4. 📈 查看進程資訊 (pm2 show)
echo 5. 🔄 重啟服務 (pm2 restart)
echo 6. 🔃 重新載入配置 (pm2 reload)
echo 7. 🔍 檢查健康狀態
echo 8. 📊 資源使用統計
echo 9. 🧹 清理日誌
echo 0. 🚪 離開
echo.
set /p "choice=請輸入選項 (0-9): "

if "%choice%"=="1" goto :list
if "%choice%"=="2" goto :monit
if "%choice%"=="3" goto :logs
if "%choice%"=="4" goto :show
if "%choice%"=="5" goto :restart
if "%choice%"=="6" goto :reload
if "%choice%"=="7" goto :health
if "%choice%"=="8" goto :stats
if "%choice%"=="9" goto :cleanup
if "%choice%"=="0" goto :exit
echo ❌ 無效選項，請重新選擇
goto :menu

:list
echo.
echo 📋 PM2 進程列表:
echo =====================================================
npx pm2 list
echo.
pause
goto :menu

:monit
echo.
echo 📊 啟動 PM2 即時監控儀表板...
echo 💡 按 'q' 離開監控模式
echo =====================================================
npx pm2 monit
goto :menu

:logs
echo.
echo 📄 內網伺服器即時日誌 (按 Ctrl+C 停止):
echo =====================================================
npx pm2 logs internal-email-server --lines 50
goto :menu

:show
echo.
echo 📈 內網伺服器詳細資訊:
echo =====================================================
npx pm2 show internal-email-server
echo.
pause
goto :menu

:restart
echo.
echo 🔄 重啟內網輔助伺服器...
npx pm2 restart internal-email-server
if not errorlevel 1 (
    echo ✅ 服務重啟成功
) else (
    echo ❌ 服務重啟失敗
)
echo.
pause
goto :menu

:reload
echo.
echo 🔃 重新載入配置...
npx pm2 reload internal-email-server
if not errorlevel 1 (
    echo ✅ 配置重新載入成功
) else (
    echo ❌ 配置重新載入失敗
)
echo.
pause
goto :menu

:health
echo.
echo 🔍 檢查系統健康狀態:
echo =====================================================

REM 檢查PM2進程狀態
npx pm2 list | findstr "internal-email-server" | findstr "online" >nul
if not errorlevel 1 (
    echo ✅ PM2進程狀態: 運行中
) else (
    echo ❌ PM2進程狀態: 異常
)

REM 檢查端口3001
netstat -an | findstr ":3001" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo ✅ 端口3001: 正常監聽
) else (
    echo ❌ 端口3001: 未監聽
)

REM 檢查API健康狀態
echo 🌐 檢查API健康狀態...
curl -s http://localhost:3001/api/internal/status >nul 2>&1
if not errorlevel 1 (
    echo ✅ API狀態: 正常回應
) else (
    echo ❌ API狀態: 無回應
)

echo.
pause
goto :menu

:stats
echo.
echo 📊 資源使用統計:
echo =====================================================

REM PM2進程統計
npx pm2 show internal-email-server | findstr "memory\|cpu\|uptime\|restarts"

REM 系統資源統計
echo.
echo 💻 系統資源:
echo CPU使用率:
wmic cpu get loadpercentage /value | findstr "LoadPercentage"

echo 記憶體使用:
for /f "skip=1" %%p in ('wmic computersystem get TotalPhysicalMemory /value') do echo %%p
for /f "skip=1" %%p in ('wmic OS get FreePhysicalMemory /value') do echo %%p

echo.
pause
goto :menu

:cleanup
echo.
echo 🧹 清理日誌檔案...
echo =====================================================

npx pm2 flush internal-email-server
if not errorlevel 1 (
    echo ✅ PM2日誌已清理
) else (
    echo ❌ PM2日誌清理失敗
)

REM 清理本地日誌檔案
if exist logs\*.log (
    del logs\*.log
    echo ✅ 本地日誌檔案已清理
) else (
    echo ℹ️ 沒有本地日誌檔案需要清理
)

echo.
pause
goto :menu

:exit
echo.
echo 👋 監控面板已關閉
echo =====================================================
pause