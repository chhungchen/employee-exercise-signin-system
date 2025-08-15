# Render 部署指南

## 快速部署步驟

### 1. 連接到 Render
1. 訪問 [Render](https://render.com) 並登入/註冊
2. 點擊 "New +" → "Web Service"
3. 連接到 GitHub repository: `https://github.com/chhungchen/employee-exercise-signin-system`
4. 選擇 `master` 分支

### 2. 基本設定
- **Name**: `employee-exercise-signin`
- **Environment**: `Node`
- **Region**: 選擇最近的區域
- **Branch**: `master`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 3. 環境變數配置

#### 必要的環境變數：
```
NODE_ENV=production
USE_PERSONAL_GOOGLE=true
USE_GOOGLE_SERVICES=true
JWT_SECRET=[自動生成]
DEFAULT_ADMIN_PASSWORD=SportSys2025@Secure
```

#### Google 服務配置：
```
GOOGLE_CLIENT_ID=[從 Google Cloud Console 獲取]
GOOGLE_CLIENT_SECRET=[從 Google Cloud Console 獲取]
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback
GOOGLE_SPREADSHEET_ID=[測試用 Google Sheets ID]
GOOGLE_DRIVE_FOLDER_ID=[測試用 Google Drive 資料夾 ID]
```

#### SMTP 郵件服務配置：
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[測試用 Gmail 帳號]
SMTP_PASS=[Gmail 應用程式密碼]
SMTP_FROM=[寄件者信箱]
```

### 4. Google Cloud Console 設定

#### OAuth 2.0 客戶端設定：
1. 到 [Google Cloud Console](https://console.cloud.google.com)
2. 建立新專案或選擇現有專案
3. 啟用 Google Sheets API 和 Google Drive API
4. 建立 OAuth 2.0 客戶端 ID
5. 授權重新導向 URI 設定為：
   ```
   https://your-app-name.onrender.com/auth/google/callback
   ```

### 5. 測試帳號資料

#### 管理員登入資訊：
- 帳號：`admin`
- 密碼：`SportSys2025@Secure`

#### 訪問點：
- 應用程式首頁：`https://your-app-name.onrender.com`
- 管理員後台：`https://your-app-name.onrender.com/admin`
- 健康檢查：`https://your-app-name.onrender.com/api/health`

### 6. 部署後設定

1. **授權 Google 服務**：
   - 訪問 `https://your-app-name.onrender.com/auth/google`
   - 完成 Google 授權流程

2. **測試功能**：
   - 員工簽到功能
   - 管理員登入和統計
   - 郵件寄送功能

### 7. 安全注意事項

- 所有敏感資料都已排除在 git repository 外
- 使用測試帳號進行部署
- 生產環境請更換所有密碼和憑證
- 定期檢查環境變數設定

### 8. 故障排除

#### 常見問題：
1. **Google 授權失敗**：檢查 REDIRECT_URI 設定
2. **資料庫連接失敗**：確認 Google Sheets ID 正確
3. **郵件寄送失敗**：檢查 SMTP 設定和應用程式密碼

#### 日誌檢查：
- Render Dashboard → 你的服務 → Logs 頁面
- 查看啟動和運行時錯誤