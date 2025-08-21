# 🔧 Render.com 環境變數設定範本

## 📋 複製貼上用範本

以下是完整的 Render.com 環境變數設定，請複製並依照您的實際情況修改：

### 🔑 必須修改的變數

```bash
# === Google OAuth 設定（必須填入）===
GOOGLE_CLIENT_ID=你的用戶端ID.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的用戶端密鑰
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback

# === 安全設定（建議修改）===
DEFAULT_ADMIN_PASSWORD=your_secure_password_here
JWT_SECRET=your_very_secure_random_string_here
```

### 📄 完整環境變數列表

```bash
# ===== 系統基本設定 =====
NODE_ENV=production
PORT=3000

# ===== Google 服務整合設定 =====
USE_GOOGLE_SERVICES=true
USE_PERSONAL_GOOGLE=true

# === 個人 Google 帳戶設定 ===
GOOGLE_CLIENT_ID=你的用戶端ID.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的用戶端密鑰
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback

# === 系統自動設定的 Token（請保持空白）===
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
GOOGLE_TOKEN_SCOPE=https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file

# === Google 資源 ID（系統自動設定，請保持空白）===
GOOGLE_SPREADSHEET_ID=
GOOGLE_DRIVE_FOLDER_ID=

# ===== 安全設定 =====
DEFAULT_ADMIN_PASSWORD=your_secure_password_here
JWT_SECRET=your_very_secure_random_string_here

# ===== 檔案上傳設定 =====
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# ===== CORS 設定 =====
CORS_ORIGIN=https://your-app-name.onrender.com

# ===== 速率限制設定 =====
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ===== 其他設定 =====
TZ=Asia/Taipei
LOCALE=zh-TW
DEBUG=false
LOG_LEVEL=info
```

## 🚀 Render.com 設定步驟

### 1. 登入 Render.com Dashboard

### 2. 前往您的服務設定
- 點擊您的服務名稱
- 選擇 "Environment" 標籤

### 3. 設定環境變數
**方法一：一個一個添加**
- 點擊 "Add Environment Variable"
- 輸入變數名稱和值

**方法二：批量匯入**
- 點擊 "Add from .env"
- 貼上完整的環境變數列表

### 4. 觸發重新部署
- 點擊 "Manual Deploy" → "Deploy latest commit"
- 或推送新的 commit 到 GitHub 觸發自動部署

## ⚠️ 重要提醒

### 🔐 必須手動設定的變數
```bash
GOOGLE_CLIENT_ID          # 從 Google Cloud Console 取得
GOOGLE_CLIENT_SECRET      # 從 Google Cloud Console 取得
GOOGLE_REDIRECT_URI       # 必須是 https://your-app-name.onrender.com/auth/google/callback
DEFAULT_ADMIN_PASSWORD    # 設定安全的管理員密碼
JWT_SECRET               # 設定複雜的隨機字串
```

### 🤖 系統自動設定的變數（請保持空白）
```bash
GOOGLE_ACCESS_TOKEN       # 授權後系統自動設定
GOOGLE_REFRESH_TOKEN      # 授權後系統自動設定
GOOGLE_SPREADSHEET_ID     # 系統自動建立試算表後設定
GOOGLE_DRIVE_FOLDER_ID    # 系統自動建立資料夾後設定
```

### 🌐 網域相關設定
請將 `your-app-name` 替換為您實際的 Render.com 應用程式名稱：
```bash
# 例如：如果您的 Render URL 是 https://employee-signin.onrender.com
GOOGLE_REDIRECT_URI=https://employee-signin.onrender.com/auth/google/callback
CORS_ORIGIN=https://employee-signin.onrender.com
```

## 🔍 驗證設定

部署完成後，您可以透過以下方式驗證設定：

### 1. 檢查部署日誌
```bash
# 在 Render.com Dashboard 查看 "Logs" 標籤
# 尋找以下訊息：
✅ 個人 Google 服務初始化完成
或
⚠️ 個人 Google 服務需要授權，請訪問 /auth/google 進行授權
```

### 2. 測試授權流程
```bash
# 訪問您的應用程式
https://your-app-name.onrender.com

# 如果出現授權提示，點擊授權連結
# 完成 Google 授權流程
```

### 3. 檢查 Google 資源建立
授權完成後，檢查您的 Google 帳戶：
- Google Sheets：應該會看到 "員工運動社團活動簽到系統" 試算表
- Google Drive：應該會看到 "員工簽到照片" 資料夾

## 🚨 常見錯誤和解決方案

### 錯誤 1：OAuth 重導向 URI 不匹配
```bash
# 確認 Google Cloud Console 中的重導向 URI 設定
# 必須完全匹配 Render.com 的 URL
```

### 錯誤 2：API 未啟用
```bash
# 在 Google Cloud Console 確認已啟用：
- Google Sheets API
- Google Drive API
```

### 錯誤 3：部署失敗
```bash
# 檢查環境變數格式是否正確
# 確認沒有多餘的空格或特殊字元
```

## 📋 檢查清單

在完成設定前，請確認：

- [ ] 已在 Google Cloud Console 建立 OAuth 憑證
- [ ] 已正確設定重導向 URI
- [ ] 已啟用 Google Sheets 和 Drive API
- [ ] 已在 Render.com 設定所有必要的環境變數
- [ ] 已觸發重新部署
- [ ] 已完成 Google 授權流程
- [ ] 已測試簽到功能正常運作

🎉 **設定完成後，您的系統就會使用個人 Google 空間來儲存所有資料！**