@echo off
chcp 65001 >nul
echo.
echo =====================================================
echo    內網輔助郵件伺服器 - 停止腳本
echo =====================================================
echo.

echo 🔍 檢查內網輔助伺服器狀態...

REM 檢查PM2是否已安裝
npx pm2 --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️ PM2未安裝，嘗試傳統方式停止...
    goto :traditional_stop
)

REM 檢查PM2進程是否存在
npx pm2 list | findstr "internal-email-server" >nul
if errorlevel 1 (
    echo ℹ️ PM2中未找到 internal-email-server 進程
    echo 🔍 檢查是否有直接啟動的Node.js進程...
    goto :traditional_stop
)

REM 使用PM2停止伺服器
echo 📴 使用PM2停止內網輔助郵件伺服器...
npx pm2 stop internal-email-server
if not errorlevel 1 (
    echo ✅ PM2進程已成功停止

    REM 詢問是否要刪除PM2進程
    echo.
    set /p "DELETE_PROCESS=是否要從PM2中刪除進程? (y/N): "
    if /i "%DELETE_PROCESS%"=="y" (
        npx pm2 delete internal-email-server
        echo ✅ PM2進程已刪除
    ) else (
        echo ℹ️ PM2進程已保留，可使用 'npx pm2 restart internal-email-server' 重啟
    )
) else (
    echo ❌ PM2停止失敗，嘗試強制停止...
    npx pm2 delete internal-email-server >nul 2>&1
)

goto :cleanup

:traditional_stop
REM 檢查端口3001是否有程序在執行
netstat -ano | findstr ":3001" >nul
if errorlevel 1 (
    echo ℹ️ 端口 3001 未被佔用，伺服器可能已經停止
    goto :cleanup
)

REM 找出佔用端口3001的進程ID
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
)

if defined PID (
    echo 🎯 找到內網伺服器進程 ID: %PID%

    REM 檢查是否為Node.js進程
    tasklist /fi "PID eq %PID%" | findstr "node.exe" >nul
    if not errorlevel 1 (
        echo 📴 正在停止內網輔助郵件伺服器...
        taskkill /PID %PID% /F >nul 2>&1
        if not errorlevel 1 (
            echo ✅ 內網輔助郵件伺服器已成功停止
        ) else (
            echo ❌ 停止伺服器時發生錯誤
        )
    ) else (
        echo ⚠️ 端口被非Node.js程序佔用，請手動處理
        echo 進程ID: %PID%
        tasklist /fi "PID eq %PID%"
    )
) else (
    echo ❌ 無法找到佔用端口的進程
)

:cleanup
echo.
echo 🧹 清理暫存檔案...

REM 清理PID檔案
if exist internal-server.pid (
    del internal-server.pid
    echo ✅ 已清理 PID 檔案
)

REM 清理日誌檔案（如果有的話）
if exist internal-server.log (
    del internal-server.log
    echo ✅ 已清理日誌檔案
)

echo.
echo 🔍 最終狀態檢查...
netstat -ano | findstr ":3001" >nul
if errorlevel 1 (
    echo ✅ 端口 3001 已釋放
    echo 📴 內網輔助郵件伺服器已完全停止
) else (
    echo ⚠️ 端口 3001 仍被佔用，可能需要手動處理
    echo.
    echo 佔用端口的進程:
    netstat -ano | findstr ":3001"
)

echo.
echo =====================================================
echo    停止腳本執行完成
echo =====================================================
pause