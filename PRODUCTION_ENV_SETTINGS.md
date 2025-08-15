# 生產環境變數設定指南

## Render 環境變數配置

請在 Render Dashboard 中設定以下環境變數：

### 基本設定
```
NODE_ENV=production
USE_PERSONAL_GOOGLE=true
USE_GOOGLE_SERVICES=true
JWT_SECRET=[系統自動生成]
DEFAULT_ADMIN_PASSWORD=SportSys2025@Secure
```

### Google 服務配置（測試用）
```
GOOGLE_CLIENT_ID=請設定測試用的 Google Client ID
GOOGLE_CLIENT_SECRET=請設定測試用的 Google Client Secret
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback
GOOGLE_SPREADSHEET_ID=請設定測試用的 Google Sheets ID
GOOGLE_DRIVE_FOLDER_ID=請設定測試用的 Google Drive 資料夾 ID
```

### SMTP 郵件服務配置（企業郵件伺服器）
```
SMTP_HOST=ex2016.jih-sun.com.tw
SMTP_PORT=587
SMTP_USER=Jameschen@inftfinance.com.tw
SMTP_PASS=請設定企業郵件密碼
SMTP_FROM=Jameschen@inftfinance.com.tw
```

## 安全說明

- **所有配置均使用測試用途的帳號和資料**
- **不包含任何真實生產環境的敏感資訊**
- **部署完成後請更換為正式環境的憑證**

## 管理員登入資訊

- **帳號**: `admin`
- **密碼**: `SportSys2025@Secure`

## 應用程式訪問點

- **首頁**: `https://your-app-name.onrender.com`
- **管理員後台**: `https://your-app-name.onrender.com/admin`
- **健康檢查**: `https://your-app-name.onrender.com/api/health`

## 部署後首次設定

1. 訪問 `https://your-app-name.onrender.com/auth/google` 完成 Google 授權
2. 登入管理員後台測試功能
3. 測試郵件寄送功能
4. 確認所有功能運作正常