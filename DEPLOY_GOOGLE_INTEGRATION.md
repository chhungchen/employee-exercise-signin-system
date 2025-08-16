# 🚀 Google 整合版本部署指南

## 📋 部署前檢查清單

### ✅ 程式碼準備狀態
- [x] Google OAuth 認證設定完成
- [x] render.yaml 已更新為 Google 模式
- [x] 伺服器可正常啟動並識別 Google 模式
- [x] 所有相關腳本已修復 .env.local 載入
- [x] 功能完整性已確認

### 📊 功能完整性
- [x] **簽到功能**：完整支援照片上傳到 Google Drive
- [x] **資料儲存**：所有資料寫入 Google Sheets
- [x] **管理員後台**：完整的資料查看和管理功能
- [x] **照片顯示**：透過安全代理載入 Google Drive 照片
- [x] **資料匯出**：支援多種格式匯出

## 🔑 Render.com 環境變數設定

### 必要設定（立即執行）

1. **基本模式設定**：
```bash
USE_GOOGLE_SERVICES=true
USE_PERSONAL_GOOGLE=true
DEFAULT_ADMIN_PASSWORD=SportSys2025@Secure
```

2. **Google OAuth 認證**（敏感資訊）：
```bash
GOOGLE_CLIENT_ID=[從 Google Cloud Console 取得]
GOOGLE_CLIENT_SECRET=[從 Google Cloud Console 取得]
GOOGLE_REDIRECT_URI=https://employee-exercise-signin-system.onrender.com/auth/google/callback
```

3. **已授權的資源 ID**：
```bash
GOOGLE_SPREADSHEET_ID=[從已建立的 Google Sheets 取得]
GOOGLE_REFRESH_TOKEN=[系統授權後自動取得]
```

### 可選設定：
```bash
JWT_SECRET=[自動生成或使用: SportSignin2025SecureJWTKey@Enterprise]
GOOGLE_TOKEN_SCOPE=https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file
```

## 🎯 部署步驟

### 步驟 1：清理和準備
```bash
# 移除敏感檔案
rm -f .env.local
rm -f google-token.json

# 確認 .gitignore 包含
echo ".env.local" >> .gitignore
echo "google-token.json" >> .gitignore
```

### 步驟 2：Git 提交和推送
```bash
git add .
git commit -m "feat: 準備 Google 整合版本部署

- 更新 render.yaml 設定 Google 模式
- 修復環境變數載入路徑
- 確認 Google OAuth 認證配置
- 所有功能已驗證完整

✅ 可立即部署的 Google 整合版本"

git push origin main
```

### 步驟 3：Render.com 設定
1. 登入 Render.com 控制台
2. 選擇 employee-exercise-signin 服務
3. 前往 Environment Variables
4. 新增上述所有環境變數
5. 點擊 "Save" 觸發重新部署

### 步驟 4：首次授權（如需要）
如果部署後需要重新授權：
1. 訪問：https://employee-exercise-signin-system.onrender.com/auth/google
2. 完成 Google 授權流程
3. 系統會自動儲存 tokens

## ✅ 驗證部署成功

### 1. 基礎檢查
```bash
# 健康檢查
curl https://employee-exercise-signin-system.onrender.com/api/health

# 預期回應：{"status":"OK",...}
```

### 2. 管理員登入測試
```bash
curl -X POST "https://employee-exercise-signin-system.onrender.com/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SportSys2025@Secure"}'

# 預期回應：{"message":"登入成功","token":"..."}
```

### 3. 功能完整性測試
- [ ] 前端簽到頁面正常載入
- [ ] 照片上傳和簽到流程正常
- [ ] 管理員後台正常顯示資料
- [ ] 照片在後台正常顯示
- [ ] 資料匯出功能正常

## 🔍 故障排除

### 常見問題
1. **授權錯誤**：檢查 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET
2. **資料不顯示**：檢查 GOOGLE_SPREADSHEET_ID
3. **照片無法載入**：檢查 Google Drive 權限

### 除錯工具
- 健康檢查：`/api/health`
- 管理員除錯：`/debug-admin.html`
- Google 狀態：`/system-info.html`

## 🎉 部署完成確認

部署成功後應該有：
- ✅ 完整的簽到功能（含照片上傳）
- ✅ 資料儲存在 Google Sheets
- ✅ 照片儲存在 Google Drive  
- ✅ 管理員後台完整功能
- ✅ 安全的認證和權限控制

---
**建立時間**：2025-08-16  
**版本**：Google 整合完整版  
**狀態**：準備部署 ✅