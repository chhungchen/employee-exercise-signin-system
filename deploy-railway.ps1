# 員工運動社團活動簽到系統 - Railway 部署腳本

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  員工運動社團活動簽到系統 - Railway部署" -ForegroundColor Blue  
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# 檢查 Railway CLI
try {
    $railwayVersion = railway --version
    Write-Host "✅ Railway CLI 已安裝: $railwayVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Railway CLI 未找到，正在安裝..." -ForegroundColor Red
    npm install -g @railway/cli
    Write-Host "✅ Railway CLI 安裝完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "🌐 登入 Railway..." -ForegroundColor Yellow
Write-Host "請在瀏覽器中完成登入..." -ForegroundColor Cyan

# 登入 Railway
railway login

Write-Host ""
Write-Host "📱 創建項目並部署..." -ForegroundColor Yellow

# 初始化項目並部署
railway link --new
railway deploy

Write-Host ""
Write-Host "⚙️ 設定環境變數..." -ForegroundColor Yellow
railway variables set NODE_ENV=production
$jwtSecret = -join ((1..32) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
railway variables set JWT_SECRET=$jwtSecret

Write-Host ""
Write-Host "🎉 部署完成！" -ForegroundColor Green

# 獲取域名
try {
    $domain = railway domain
    Write-Host ""
    Write-Host "📱 您的應用已上線！" -ForegroundColor Cyan
    Write-Host "🌐 網址: $domain" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 有用的指令:" -ForegroundColor Yellow
    Write-Host "  查看日誌: railway logs" -ForegroundColor White
    Write-Host "  重新部署: railway up" -ForegroundColor White
    Write-Host "  開啟應用: railway open" -ForegroundColor White
    Write-Host "  本地測試: npm run dev" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🔑 管理員登入資訊:" -ForegroundColor Yellow
    Write-Host "  帳號: admin" -ForegroundColor White
    Write-Host "  密碼: [請參考環境變數設定]" -ForegroundColor White
    Write-Host "  管理頁面: $domain/admin" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🚀 正在開啟應用..." -ForegroundColor Cyan
    Start-Process $domain
}
catch {
    Write-Host "⚠️ 無法自動獲取域名，請使用 'railway open' 開啟應用" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ 部署成功！" -ForegroundColor Green
Read-Host "按 Enter 鍵結束"