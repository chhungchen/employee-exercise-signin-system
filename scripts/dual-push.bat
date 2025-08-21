@echo off
REM 雙重身份推送腳本 (Windows 版本)
REM 用途：推送到內部 Azure DevOps (個人資訊) 和外部 GitHub (匿名資訊)

title 雙重身份推送腳本
echo.
echo ================================
echo 🔄 雙重身份推送腳本
echo ================================

REM 檢查是否有未提交的變更
git status --porcelain > temp_status.txt
for /f %%i in (temp_status.txt) do (
    echo ❌ 錯誤：有未提交的變更，請先 commit
    del temp_status.txt
    pause
    exit /b 1
)
del temp_status.txt

REM 取得目前分支
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
echo 📍 目前分支: %CURRENT_BRANCH%

REM 確認要推送
set /p "confirm=是否要執行雙重推送？(y/N): "
if /i NOT "%confirm%"=="y" (
    echo ❌ 取消推送
    pause
    exit /b 0
)

echo.
echo ============================================
echo 📤 階段1: 推送到內部 Azure DevOps (個人資訊)
echo ============================================

REM 確保使用個人資訊
git config user.name "GA0382"
git config user.email "jameschen@inftfinance.com.tw"

REM 推送到 Azure DevOps
git push azure %CURRENT_BRANCH%:main
if errorlevel 1 (
    echo ❌ Azure DevOps 推送失敗
    pause
    exit /b 1
)
echo ✅ Azure DevOps 推送成功

echo.
echo ======================================
echo 📤 階段2: 推送到外部 GitHub (匿名資訊)
echo ======================================

echo ⚠️  注意：只有程式功能性更新才應推送到 GitHub
set /p "github_confirm=這是程式功能性更新嗎？(y/N): "
if /i "%github_confirm%"=="y" (
    REM 建立臨時分支用於匿名推送
    for /f %%i in ('powershell -command "Get-Date -UFormat %%s"') do set TIMESTAMP=%%i
    set TEMP_BRANCH=temp-github-push-%TIMESTAMP%
    git checkout -b %TEMP_BRANCH%
    
    REM 修改最後一個 commit 為匿名作者
    git config user.name "System"
    git config user.email "system@company.local"
    git commit --amend --reset-author --no-edit
    
    REM 推送到 GitHub
    git push origin %TEMP_BRANCH%:main --force
    if errorlevel 1 (
        echo ❌ GitHub 推送失敗
        git checkout %CURRENT_BRANCH%
        git branch -D %TEMP_BRANCH%
        pause
        exit /b 1
    )
    echo ✅ GitHub 推送成功 (匿名)
    
    REM 清理臨時分支
    git checkout %CURRENT_BRANCH%
    git branch -D %TEMP_BRANCH%
    
    REM 恢復個人資訊配置
    git config user.name "GA0382"
    git config user.email "jameschen@inftfinance.com.tw"
    
    echo ✅ 已恢復個人 git 配置
    set GITHUB_STATUS=個人資訊 (GA0382) / GitHub: 匿名資訊 (System)
) else (
    echo ⏭️  跳過 GitHub 推送
    set GITHUB_STATUS=個人資訊 (GA0382) / GitHub: 未更新
)

echo.
echo ======================
echo 🎯 雙重推送完成！
echo ======================
echo 📊 Azure DevOps: %GITHUB_STATUS%

pause