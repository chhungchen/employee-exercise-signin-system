# 🚀 Render.com 部署遷移到個人 Google 空間 SOP

## 📋 遷移概述

本指南將協助您將現有的 Render.com 部署從 SQLite 遷移到個人 Google Sheets + Drive，並保留所有現有資料。

## ⚠️ 重要注意事項

- **資料備份**: 遷移前請務必備份現有資料
- **服務中斷**: 遷移過程中服務會暫時中斷
- **建議時間**: 選擇使用量較低的時段進行遷移

---

## 📝 完整 SOP 步驟

### 階段一：準備工作（本地環境）

#### 1.1 備份現有資料
```bash
# 1. 從 Render.com 下載現有資料庫
# 透過管理員後台匯出 CSV 或使用 check-data 指令

# 2. 本地備份（如果有本地資料庫）
cp database/exercise_signin.db database/exercise_signin.db.backup
```

#### 1.2 確認程式碼已更新
```bash
# 確認您的本地程式碼已包含個人 Google 功能
git status
git log --oneline -5

# 如果需要，提交最新變更
git add .
git commit -m "feat: 新增個人 Google 整合功能"
git push origin main
```

### 階段二：Google Cloud Console 設定

#### 2.1 建立 Google 專案
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案：`員工簽到系統-Production`
3. 記錄專案 ID

#### 2.2 啟用必要 API
```bash
# 在 Google Cloud Console 中啟用
- Google Sheets API
- Google Drive API
```

#### 2.3 建立 OAuth 2.0 憑證
1. 前往「API 和服務」→「憑證」
2. 建立 OAuth 用戶端 ID（網頁應用程式）
3. **重要**: 設定正確的重導向 URI：
   ```
   https://your-app-name.onrender.com/auth/google/callback
   ```
4. 下載憑證資訊：
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### 階段三：本地測試環境設定

#### 3.1 設定本地環境變數
```bash
# 編輯 .env 檔案
USE_GOOGLE_SERVICES=true
USE_PERSONAL_GOOGLE=true
GOOGLE_CLIENT_ID=你的用戶端ID.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的用戶端密鑰
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

#### 3.2 本地授權測試
```bash
# 1. 本地授權
npm run setup-google-personal

# 2. 測試連線
npm run test-google-personal

# 3. 啟動本地服務測試
npm run dev
```

#### 3.3 資料遷移（本地測試）
```bash
# 如果有現有 SQLite 資料需要遷移
npm run migrate-to-google
```

### 階段四：Render.com 重新部署

#### 4.1 更新 Render.com 環境變數

登入 Render.com Dashboard，前往您的服務設定，更新環境變數：

```bash
# 基本設定
NODE_ENV=production
USE_GOOGLE_SERVICES=true
USE_PERSONAL_GOOGLE=true

# Google OAuth 設定
GOOGLE_CLIENT_ID=你的用戶端ID.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的用戶端密鑰
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback

# Token 設定（初次部署時留空，系統會自動設定）
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
GOOGLE_TOKEN_SCOPE=https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file

# Google 資源 ID（初次部署時留空，系統會自動建立）
GOOGLE_SPREADSHEET_ID=
GOOGLE_DRIVE_FOLDER_ID=

# 安全設定
DEFAULT_ADMIN_PASSWORD=你的安全密碼
JWT_SECRET=你的JWT密鑰

# 其他設定
TZ=Asia/Taipei
LOCALE=zh-TW
```

#### 4.2 觸發重新部署
```bash
# 推送程式碼變更觸發自動部署
git push origin main

# 或在 Render.com Dashboard 手動觸發部署
```

### 階段五：線上授權設定

#### 5.1 查看部署日誌
在 Render.com Dashboard 查看部署日誌，確認服務啟動成功。

#### 5.2 線上 Google 授權
```bash
# 方法一：透過瀏覽器直接訪問
https://your-app-name.onrender.com/auth/google

# 方法二：透過管理員後台
https://your-app-name.onrender.com/admin
# 如果出現 Google 授權提示，點擊授權連結
```

#### 5.3 完成授權流程
1. 選擇您的 Google 帳戶
2. 授權應用程式存取 Google Sheets 和 Drive
3. 授權完成後會自動返回應用程式

### 階段六：資料遷移和驗證

#### 6.1 檢查 Google 資源建立
授權完成後，系統會自動建立：
- Google Sheets：`員工運動社團活動簽到系統`
- Google Drive 資料夾：`員工簽到照片`

#### 6.2 遷移現有資料
如果您有現有資料需要遷移：

```bash
# 方法一：透過 CSV 匯入
# 1. 從舊系統匯出 CSV
# 2. 手動匯入到新建立的 Google Sheets

# 方法二：使用遷移腳本（如果有本地資料）
# 在本地環境執行遷移後，資料會自動同步到雲端
```

#### 6.3 系統功能驗證
測試以下功能是否正常：
- ✅ 員工簽到功能
- ✅ 照片上傳到 Google Drive
- ✅ 管理員後台登入
- ✅ 資料查看和匯出
- ✅ 簽到記錄顯示

### 階段七：最終確認和清理

#### 7.1 確認環境變數
在 Render.com 檢查自動設定的環境變數：
```bash
GOOGLE_SPREADSHEET_ID=自動產生的試算表ID
GOOGLE_DRIVE_FOLDER_ID=自動產生的資料夾ID
```

#### 7.2 測試完整流程
1. 進行一次完整的簽到測試
2. 檢查資料是否正確儲存到 Google Sheets
3. 檢查照片是否正確上傳到 Google Drive
4. 測試管理員後台功能

#### 7.3 更新 DNS 和 OAuth 設定（如需要）
如果您使用自訂網域，請確認：
- Google Cloud Console 中的重導向 URI 正確
- DNS 設定指向正確的 Render.com URL

---

## 🚨 故障排除

### 常見問題和解決方案

#### 問題 1：授權失敗
```bash
# 檢查項目：
- 重導向 URI 是否正確設定
- Google Client ID 和 Secret 是否正確
- 是否已啟用必要的 API
```

#### 問題 2：試算表建立失敗
```bash
# 解決方案：
- 檢查 Google Sheets API 是否已啟用
- 確認授權範圍是否包含 spreadsheets
- 檢查網路連線
```

#### 問題 3：照片上傳失敗
```bash
# 解決方案：
- 檢查 Google Drive API 是否已啟用
- 確認授權範圍是否包含 drive.file
- 檢查檔案大小限制
```

#### 問題 4：Token 過期
```bash
# Render.com 環境中的解決方案：
# Token 會自動更新，如果失敗：
# 1. 檢查環境變數設定
# 2. 重新觸發部署
# 3. 重新進行授權流程
```

---

## 📊 遷移後的優勢

### ✅ 成本節省
- 無需額外的資料庫服務費用
- 使用 Google 的 15GB 免費空間

### ✅ 資料可視性
- 直接在 Google Sheets 查看資料
- 即時資料同步和分析

### ✅ 備份和安全
- Google 自動備份資料
- 企業級安全保護

### ✅ 擴充性
- 輕鬆擴展到更多功能
- 整合其他 Google Workspace 工具

---

## 📞 支援和聯絡

如果遇到任何問題：
1. 檢查 Render.com 的部署日誌
2. 參考 `GOOGLE_PERSONAL_SETUP.md` 詳細說明
3. 確認 Google Cloud Console 設定
4. 檢查環境變數配置

**預估完成時間**: 1-2 小時（依資料量而定）
**建議操作時間**: 非營業時間或低使用量時段

🎉 **祝您遷移順利！**