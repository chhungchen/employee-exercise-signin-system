# 📋 部署注意事項 (Deployment Notes)

## 🔄 雙版本庫管理

### 🏗️ 版本庫配置

#### 內部版本庫 (主要開發)
```
Remote: azure
URL: http://inft-ads/DefaultCollection_2/Risk_Management/_git/Employee_Exercise_Sign
用途: 日常開發、版本控制、內部協作
作者: GA0382 <jameschen@inftfinance.com.tw>
內容: 包含完整的內部資訊和配置
```

#### 外部版本庫 (公開展示)
```
Remote: origin  
URL: https://github.com/chhungchen/employee-exercise-signin-system.git
用途: 功能性更新展示、公開參考、Render 部署
作者: System <system@company.local>
推送條件: 僅程式功能性變更，移除敏感資訊
```

### 🔒 作者資訊管理

#### **內部 Azure DevOps**
- **顯示**: 個人資訊 (`GA0382 <jameschen@inftfinance.com.tw>`)
- **目的**: 內部追蹤和協作識別
- **權限**: 內部團隊可見

#### **外部 GitHub** 
- **顯示**: 匿名資訊 (`System <system@company.local>`)
- **目的**: 保護個人隱私，統一對外形象
- **權限**: 公開可見

### 📋 提交規範

#### 內部版本庫提交
```bash
git config user.name "GA0382"
git config user.email "jameschen@inftfinance.com.tw"
git commit -m "內部開發訊息 - 可包含詳細內容"
```

#### 外部版本庫提交
```bash
git config user.name "System"
git config user.email "system@company.local"  
git commit -m "功能性更新 - 清理版本描述"
```

## 🚀 Render 部署流程

### 1. 環境變數設定
在 Render Dashboard → Environment 頁面設定以下變數：

#### 基本設定
```bash
NODE_ENV=production
PORT=10000
TZ=Asia/Taipei
```

#### Google 服務設定
```bash
USE_GOOGLE_SERVICES=true
USE_PERSONAL_GOOGLE=true
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=your-redirect-uri
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

#### 主要 SMTP 設定 (Gmail)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-digit-app-password
EMAIL_FROM=your-gmail@gmail.com
```

#### 備援 SMTP 設定 (SendGrid)
```bash
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
```

#### 安全設定
```bash
JWT_SECRET=your-jwt-secret-key
DEFAULT_ADMIN_PASSWORD=your-admin-password
```

### 2. 部署驗證檢查清單

#### ✅ 部署前檢查
- [ ] 所有環境變數已設定
- [ ] Gmail 應用程式密碼已生成 (16位)
- [ ] Google OAuth 授權已完成
- [ ] SendGrid 帳號已設定 (可選)

#### ✅ 部署後驗證
- [ ] 訪問 `https://your-app.onrender.com/api/health` 確認服務運行
- [ ] 訪問 `https://your-app.onrender.com/ping` 確認連線正常
- [ ] 登入管理介面 `/admin` 測試功能
- [ ] 執行 SMTP 診斷 `/api/admin/diagnose-smtp`
- [ ] 測試所有 SMTP 提供者 `/api/admin/test-smtp-providers`

### 3. 多重 SMTP 架構特色

#### 🎯 提供者優先級
1. **Gmail SMTP** (priority: 1) - 主要選擇
2. **SendGrid SMTP** (priority: 2) - 雲端備援
3. **Custom SMTP** (priority: 3) - 自定義服務
4. **Company Internal SMTP** (priority: 4) - 內部服務 (僅本地)

#### 🔄 自動故障切換
- 偵測提供者失敗時自動切換
- 15秒連線超時保護
- 每個提供者重試 2 次
- 智慧恢復機制

#### 📊 監控和管理
- 即時服務狀態監控
- 健康檢查定期執行
- 手動提供者切換
- 詳細錯誤診斷

### 4. 故障排除

#### Gmail SMTP 連線超時
```bash
# 解決方案 1: 檢查應用程式密碼
Gmail 帳號 → 安全性 → 2步驟驗證 → 應用程式密碼

# 解決方案 2: 啟用備援服務
設定 SENDGRID_API_KEY 環境變數

# 解決方案 3: 重新部署取得新 IP
Render Dashboard → Manual Deploy
```

#### 服務初始化失敗
```bash
# 檢查環境變數
curl https://your-app.onrender.com/api/admin/diagnose-smtp

# 查看服務狀態
curl https://your-app.onrender.com/api/admin/smtp-status

# 測試所有提供者
curl -X POST https://your-app.onrender.com/api/admin/test-smtp-providers
```

## 📝 版本控制流程

### 🔄 標準更新流程
1. **內部開發階段**
   ```bash
   # 設定內部作者資訊
   git config user.name "GA0382"
   git config user.email "jameschen@inftfinance.com.tw"
   
   # 在內部版本庫進行開發
   git add .
   git commit -m "feat: 詳細的內部開發說明"
   git push azure main
   ```

2. **外部部署階段**
   ```bash
   # 切換到外部作者資訊
   git config user.name "System"
   git config user.email "system@company.local"
   
   # 清理敏感資訊後推送到外部版本庫
   git push origin github-clean:main --force
   ```

3. **自動觸發 Render 部署**

### 🚨 緊急修復流程
1. **快速修復**
   ```bash
   # 直接在 github-clean 分支修復
   git checkout github-clean
   git config user.name "System"
   git config user.email "system@company.local"
   git commit -m "fix: 緊急修復描述"
   ```

2. **同步到兩個版本庫**
   ```bash
   # 推送到內部版本庫（保持完整記錄）
   git push azure github-clean:main --force
   
   # 推送到外部版本庫（觸發部署）
   git push origin github-clean:main --force
   ```

3. **驗證部署成功**

### ⚠️ 重要提醒
- **內部提交**: 可包含詳細的技術細節和內部相關資訊
- **外部提交**: 僅包含功能性描述，避免內部敏感資訊
- **作者切換**: 每次推送前務必確認 git 作者設定正確
- **敏感資訊**: 環境變數、內部 URL、個人資訊等不得出現在外部版本庫

---

> 📅 **最後更新**: 2025-09-12  
> 🤖 **Generated with [Claude Code](https://claude.ai/code)**