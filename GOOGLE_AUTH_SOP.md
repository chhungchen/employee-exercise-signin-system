# Google 服務授權標準作業程序

## 🎯 快速設定指南

### 第一步：Google Cloud Console 基本設定

1. **前往 Google Cloud Console**
   - 網址：https://console.cloud.google.com
   - 登入您的 Google 帳號

2. **建立專案**
   - 點擊專案選擇器 → "新增專案"
   - 專案名稱：`employee-signin-system`
   - 點擊 "建立"

3. **啟用必要的 API**
   - 左側選單 → "API 和服務" → "程式庫"
   - 搜尋並啟用：
     - ✅ Google Sheets API
     - ✅ Google Drive API

### 第二步：OAuth 2.0 設定

1. **設定 OAuth 同意畫面**
   - 左側選單 → "API 和服務" → "OAuth 同意畫面"
   - 選擇 "外部" → 填入基本資訊：
     ```
     應用程式名稱: 員工運動簽到系統
     用戶支援電子郵件: 您的email
     開發人員聯絡資訊: 您的email
     ```

2. **建立 OAuth 客戶端**
   - 左側選單 → "API 和服務" → "憑證"
   - 點擊 "建立憑證" → "OAuth 2.0 客戶端 ID"
   - 應用程式類型：網路應用程式
   - 已授權的重新導向 URI：
     ```
     https://your-render-app.onrender.com/auth/google/callback
     ```
   - **記下客戶端 ID 和客戶端密鑰**

### 第三步：建立測試資料

1. **Google Sheets**
   - 前往 https://sheets.google.com
   - 建立新試算表，命名為 "員工簽到資料庫"
   - 複製試算表 ID（URL 中 `/d/` 後面的字串）

2. **Google Drive 資料夾**
   - 前往 https://drive.google.com  
   - 建立資料夾 "簽到照片"
   - 分享設定為 "知道連結的任何人"
   - 複製資料夾 ID（URL 中 `/folders/` 後面的字串）

### 第四步：Gmail SMTP 設定

1. **啟用兩步驟驗證**
   - 前往 https://myaccount.google.com/security
   - 設定兩步驟驗證

2. **建立應用程式密碼**
   - 在安全性設定中找到 "應用程式密碼"
   - 選擇 "郵件" → "其他"
   - 名稱：`Employee Signin`
   - 記下 16 位數密碼

## 🔧 Render 環境變數設定

將以上取得的資訊填入 Render 環境變數：

```bash
# 基本設定
NODE_ENV=production
USE_PERSONAL_GOOGLE=true
USE_GOOGLE_SERVICES=true
DEFAULT_ADMIN_PASSWORD=SportSys2025@Secure
JWT_SECRET=your-secure-jwt-secret

# Google OAuth
GOOGLE_CLIENT_ID=從步驟2複製
GOOGLE_CLIENT_SECRET=從步驟2複製
GOOGLE_REDIRECT_URI=https://your-app.onrender.com/auth/google/callback

# Google 儲存
GOOGLE_SPREADSHEET_ID=從步驟3複製
GOOGLE_DRIVE_FOLDER_ID=從步驟3複製

# Gmail SMTP 郵件設定
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=您的Gmail帳號
SMTP_PASS=從步驟4複製的Gmail應用程式密碼
SMTP_FROM=您的Gmail帳號
```

## ✅ 授權流程

1. **部署完成後前往授權頁面**
   ```
   https://your-app.onrender.com/auth/google
   ```

2. **授權步驟**
   - 選擇 Google 帳號
   - 點擊 "允許" 同意權限
   - 看到 "授權完成" 訊息即成功

3. **測試功能**
   - 首頁：`https://your-app.onrender.com`
   - 管理員：`https://your-app.onrender.com/admin`
     - 帳號：`admin`
     - 密碼：`SportSys2025@Secure`

## 🚨 常見問題

**Q: 授權失敗 "redirect_uri_mismatch"**
A: 檢查 OAuth 客戶端的重新導向 URI 是否與 Render 應用程式 URL 一致

**Q: 無法存取 Google Sheets**  
A: 確認試算表 ID 正確且帳號有存取權限

**Q: 郵件寄送失敗**
A: 檢查 Gmail 應用程式密碼是否正確設定

**Q: 資料庫初始化失敗**
A: 檢查 Render 日誌，確認 Google APIs 權限已正確授權

完成以上步驟後，系統即可正常運作！