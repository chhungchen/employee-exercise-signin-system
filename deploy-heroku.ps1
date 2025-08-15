# 員工運動社團活動簽到系統 - Heroku 部署腳本

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  員工運動社團活動簽到系統 - Heroku部署" -ForegroundColor Blue  
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# 檢查必要工具
function Test-Command($command) {
    try {
        if (Get-Command $command -ErrorAction Stop) {
            return $true
        }
    }
    catch {
        return $false
    }
}

Write-Host "🔍 檢查環境..." -ForegroundColor Yellow

if (!(Test-Command "git")) {
    Write-Host "❌ 錯誤: 請先安裝 Git" -ForegroundColor Red
    Write-Host "請訪問: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "按 Enter 鍵結束"
    exit 1
}

if (!(Test-Command "node")) {
    Write-Host "❌ 錯誤: 請先安裝 Node.js" -ForegroundColor Red
    Write-Host "請訪問: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按 Enter 鍵結束"
    exit 1
}

Write-Host "✅ Git 和 Node.js 已安裝" -ForegroundColor Green

# 安裝 Heroku CLI（如果未安裝）
if (!(Test-Command "heroku")) {
    Write-Host "📦 正在安裝 Heroku CLI..." -ForegroundColor Yellow
    try {
        npm install -g heroku
        Write-Host "✅ Heroku CLI 安裝完成" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Heroku CLI 安裝失敗" -ForegroundColor Red
        Write-Host "請手動安裝: https://devcenter.heroku.com/articles/heroku-cli" -ForegroundColor Yellow
        Read-Host "按 Enter 鍵結束"
        exit 1
    }
}

Write-Host "✅ 環境檢查完成" -ForegroundColor Green
Write-Host ""

# 準備 Git
Write-Host "🔧 準備部署..." -ForegroundColor Yellow

if (!(Test-Path ".git")) {
    Write-Host "📝 初始化 Git 倉庫..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
}

Write-Host "🌐 登入 Heroku..." -ForegroundColor Yellow
Write-Host "請在瀏覽器中完成登入..." -ForegroundColor Cyan
heroku login

# 創建應用
Write-Host ""
Write-Host "📱 創建 Heroku 應用..." -ForegroundColor Yellow
$appName = Read-Host "請輸入應用名稱（留空則自動生成）"

try {
    if ([string]::IsNullOrWhiteSpace($appName)) {
        $result = heroku create
    } else {
        $result = heroku create $appName
    }
    
    Write-Host "✅ 應用創建成功" -ForegroundColor Green
}
catch {
    Write-Host "❌ 創建應用失敗，可能應用名稱已存在" -ForegroundColor Red
    Read-Host "按 Enter 鍵結束"
    exit 1
}

# 設定環境變數
Write-Host ""
Write-Host "⚙️ 設定環境變數..." -ForegroundColor Yellow
heroku config:set NODE_ENV=production
$jwtSecret = -join ((1..32) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
heroku config:set JWT_SECRET=$jwtSecret

# 部署
Write-Host ""
Write-Host "🚀 開始部署..." -ForegroundColor Yellow
git add .
git commit -m "Deploy to Heroku" 2>$null
$deployResult = git push heroku main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 部署成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 您的應用已上線！正在開啟..." -ForegroundColor Cyan
    heroku open
    
    Write-Host ""
    Write-Host "📋 有用的指令:" -ForegroundColor Yellow
    Write-Host "  查看日誌: heroku logs --tail" -ForegroundColor White
    Write-Host "  重啟應用: heroku restart" -ForegroundColor White
    Write-Host "  開啟應用: heroku open" -ForegroundColor White
    Write-Host "  本地測試: npm run dev" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🔑 管理員登入資訊:" -ForegroundColor Yellow
    Write-Host "  帳號: admin" -ForegroundColor White
    Write-Host "  密碼: admin123" -ForegroundColor White
    Write-Host "  管理頁面: [您的應用網址]/admin" -ForegroundColor White
    
    Write-Host ""
    Write-Host "✅ 部署完成！" -ForegroundColor Green
    
} else {
    Write-Host "❌ 部署失敗，請檢查錯誤訊息" -ForegroundColor Red
}

Read-Host "按 Enter 鍵結束"