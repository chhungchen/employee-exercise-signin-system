# Render 部署標準作業程序 (SOP)

## 🚀 第一部分：Render 平台部署

### 步驟 1：準備工作
1. 確認 GitHub Repository: `https://github.com/chhungchen/employee-exercise-signin-system`
2. 準備一個 Gmail 測試帳號（用於 SMTP 服務）
3. 準備 Google 帳號（用於 Sheets 和 Drive 服務）

### 步驟 2：連接 Render 服務
1. **訪問 Render**：
   - 前往 https://render.com
   - 使用 GitHub 帳號登入或註冊新帳號

2. **建立新服務**：
   - 點擊右上角 "New +" 按鈕
   - 選擇 "Web Service"

3. **連接 Repository**：
   - 在 "Connect a repository" 畫面中
   - 找到 `chhungchen/employee-exercise-signin-system`
   - 點擊 "Connect"

### 步驟 3：基本配置設定
填入以下資訊：
```
Name: employee-exercise-signin
Environment: Node
Region: Singapore (SEA) 或最近的區域
Branch: master
Build Command: npm install
Start Command: npm start
Plan: Free (可後續升級)
```

### 步驟 4：環境變數設定
在 "Environment Variables" 區域新增以下變數：

#### 基本設定：
```
NODE_ENV=production
USE_PERSONAL_GOOGLE=true
USE_GOOGLE_SERVICES=true
DEFAULT_ADMIN_PASSWORD=SportSys2025@Secure
```

#### JWT 設定：
```
JWT_SECRET=employee-signin-super-secret-key-2025
```

#### Google 服務設定（先留空，稍後填入）：
```
GOOGLE_CLIENT_ID=待填入
GOOGLE_CLIENT_SECRET=待填入  
GOOGLE_REDIRECT_URI=待填入
GOOGLE_SPREADSHEET_ID=待填入
GOOGLE_DRIVE_FOLDER_ID=待填入
```

#### SMTP 設定（企業郵件伺服器）：
```
SMTP_HOST=ex2016.jih-sun.com.tw
SMTP_PORT=587
SMTP_USER=Jameschen@inftfinance.com.tw
SMTP_PASS=企業郵件密碼
SMTP_FROM=Jameschen@inftfinance.com.tw
```

### 步驟 5：部署應用程式
1. 點擊 "Create Web Service"
2. 等待首次部署完成（約 2-5 分鐘）
3. 記下您的應用程式 URL：`https://your-app-name.onrender.com`

---

## 📋 第二部分：Google Cloud Console 設定 SOP

### 步驟 1：建立 Google Cloud 專案
1. **訪問 Google Cloud Console**：
   - 前往 https://console.cloud.google.com
   - 使用您的 Google 帳號登入

2. **建立新專案**：
   - 點擊上方專案選擇器
   - 點擊 "新增專案"
   - 專案名稱：`employee-signin-system`
   - 點擊 "建立"

### 步驟 2：啟用 API 服務
1. **啟用 Google Sheets API**：
   - 左側選單 → "API 和服務" → "程式庫"
   - 搜尋 "Google Sheets API"
   - 點擊進入並點擊 "啟用"

2. **啟用 Google Drive API**：
   - 同樣在程式庫中搜尋 "Google Drive API"
   - 點擊進入並點擊 "啟用"

### 步驟 3：建立 OAuth 2.0 憑證
1. **前往憑證頁面**：
   - 左側選單 → "API 和服務" → "憑證"

2. **設定 OAuth 同意畫面**：
   - 點擊 "OAuth 同意畫面"
   - 選擇 "外部" 用戶類型
   - 填入應用程式資訊：
     ```
     應用程式名稱: 員工運動簽到系統
     用戶支援電子郵件: 您的 Gmail
     開發人員聯絡資訊: 您的 Gmail
     ```
   - 點擊 "儲存並繼續"
   - 範圍設定保持預設，點擊 "儲存並繼續"
   - 測試使用者新增您的 Gmail，點擊 "儲存並繼續"

3. **建立 OAuth 2.0 客戶端 ID**：
   - 回到 "憑證" 頁面
   - 點擊 "建立憑證" → "OAuth 2.0 客戶端 ID"
   - 應用程式類型選擇 "網路應用程式"
   - 名稱：`Employee Signin OAuth Client`
   - **已授權的重新導向 URI** 新增：
     ```
     https://your-app-name.onrender.com/auth/google/callback
     ```
     ⚠️ 請將 `your-app-name` 替換為實際的 Render 應用程式名稱
   - 點擊 "建立"

4. **記錄憑證資訊**：
   - 複製 "客戶端 ID" 和 "客戶端密鑰"
   - 安全保存這些資訊

### 步驟 4：建立測試用 Google Sheets 和 Drive 資料夾
1. **建立 Google Sheets**：
   - 前往 https://sheets.google.com
   - 建立新的試算表
   - 命名為 "員工簽到系統資料庫"
   - 複製 URL 中的 ID（在 /d/ 和 /edit 之間的字串）

2. **建立 Google Drive 資料夾**：
   - 前往 https://drive.google.com
   - 建立新資料夾 "員工簽到照片"
   - 右鍵點擊資料夾 → "分享"
   - 設定為 "知道連結的任何人" 都可檢視
   - 複製資料夾 ID（URL 中 /folders/ 後面的字串）

---

## 🔑 第三部分：Gmail SMTP 設定 SOP

### 步驟 1：準備 Gmail 帳號
1. 使用測試用的 Gmail 帳號
2. 前往 Google 帳戶安全性設定

### 步驟 2：啟用兩步驟驗證
1. 前往 https://myaccount.google.com/security
2. 點擊 "兩步驟驗證"
3. 按照指示完成設定

### 步驟 3：建立應用程式密碼
1. 在安全性頁面找到 "應用程式密碼"
2. 點擊 "應用程式密碼"
3. 選擇 "郵件" 和 "其他 (自訂名稱)"
4. 輸入名稱：`Employee Signin System`
5. 點擊 "產生"
6. **記下 16 位數的應用程式密碼**（這就是 SMTP_PASS）

---

## ⚙️ 第四部分：更新 Render 環境變數

回到 Render Dashboard，更新環境變數：

### 更新 Google 設定：
```
GOOGLE_CLIENT_ID=您的客戶端ID
GOOGLE_CLIENT_SECRET=您的客戶端密鑰
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback
GOOGLE_SPREADSHEET_ID=您的試算表ID
GOOGLE_DRIVE_FOLDER_ID=您的Drive資料夾ID
```

### 更新 SMTP 設定：
```
SMTP_HOST=ex2016.jih-sun.com.tw
SMTP_PORT=587
SMTP_USER=Jameschen@inftfinance.com.tw
SMTP_PASS=企業郵件密碼
SMTP_FROM=Jameschen@inftfinance.com.tw
```

### 重新部署
1. 點擊 "Manual Deploy" → "Deploy latest commit"
2. 等待重新部署完成

---

## 🎯 第五部分：首次授權和測試

### 步驟 1：Google 授權
1. **前往授權頁面**：
   - 訪問 `https://your-app-name.onrender.com/auth/google`

2. **完成授權流程**：
   - 選擇您的 Google 帳號
   - 點擊 "允許" 同意權限要求
   - 看到 "Google 授權完成!" 訊息表示成功

### 步驟 2：測試應用程式功能
1. **健康檢查**：
   - 訪問 `https://your-app-name.onrender.com/api/health`
   - 應該看到 `{"status":"OK",...}` 回應

2. **首頁測試**：
   - 訪問 `https://your-app-name.onrender.com`
   - 確認簽到表單正常顯示

3. **管理員登入測試**：
   - 訪問 `https://your-app-name.onrender.com/admin`
   - 帳號：`admin`
   - 密碼：`SportSys2025@Secure`
   - 確認能成功登入並看到統計資料

4. **郵件功能測試**：
   - 在管理員後台點擊 "每日資料匯出"
   - 選擇郵件寄送並輸入測試信箱
   - 確認能收到郵件

---

## 🚨 故障排除

### 常見問題及解決方案：

1. **部署失敗**：
   - 檢查 Render Logs 頁面查看錯誤訊息
   - 確認所有環境變數都已正確設定

2. **Google 授權失敗**：
   - 檢查 `GOOGLE_REDIRECT_URI` 是否正確
   - 確認 OAuth 憑證中的重新導向 URI 設定正確

3. **資料庫連接失敗**：
   - 確認 `GOOGLE_SPREADSHEET_ID` 和 `GOOGLE_DRIVE_FOLDER_ID` 正確
   - 檢查 Google Sheets 和 Drive 權限設定

4. **郵件寄送失敗**：
   - 確認 Gmail 兩步驟驗證已啟用
   - 檢查應用程式密碼是否正確
   - 確認 SMTP 設定無誤

### 檢查日誌：
- Render Dashboard → 您的服務 → "Logs" 分頁
- 查看即時日誌輸出找出問題

---

## ✅ 完成檢查清單

- [ ] Render 服務已建立並部署成功
- [ ] Google Cloud Console 專案已建立
- [ ] Google Sheets API 和 Drive API 已啟用  
- [ ] OAuth 2.0 憑證已建立
- [ ] 測試用 Sheets 和 Drive 資料夾已建立
- [ ] Gmail 應用程式密碼已建立
- [ ] 所有環境變數已在 Render 中設定
- [ ] Google 授權已完成
- [ ] 應用程式所有功能測試通過

完成以上所有步驟後，您的員工運動簽到系統就成功部署到 Render 並可正常使用了！