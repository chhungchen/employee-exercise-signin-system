# SMTP 郵件設定指南

## ⚠️ 企業防火牆限制說明

由於企業防火牆設定限制，Render 外部伺服器無法連接到企業內部的 Exchange 伺服器 (`ex2016.jih-sun.com.tw`)，因此改用 Gmail SMTP 服務。

## 📧 Gmail SMTP 配置 (建議使用)

### 當前建議的郵件設定

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=測試用Gmail帳號
SMTP_PASS=Gmail應用程式密碼
SMTP_FROM=測試用Gmail帳號
```

## 🔧 Render 環境變數設定

在 Render Dashboard 的 "Environment" 分頁中設定：

### Gmail SMTP 服務配置：
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=您的Gmail帳號@gmail.com
SMTP_PASS=Gmail應用程式密碼
SMTP_FROM=您的Gmail帳號@gmail.com
```

## 📝 Gmail SMTP 設定步驟

### 步驟 1：準備 Gmail 帳號
1. 準備一個 Gmail 帳號作為系統郵件寄送用途
2. 建議使用專用的測試帳號而非個人帳號

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
6. **記下 16 位數的應用程式密碼**

### Gmail SMTP 設定參數：
- **SMTP 伺服器**: smtp.gmail.com
- **埠號**: 587 (STARTTLS)
- **加密**: STARTTLS
- **身份驗證**: 需要

## 🔍 測試 SMTP 連線

部署後可透過以下方式測試：

1. **管理員後台測試**：
   - 登入 `https://your-app.onrender.com/admin`
   - 進入 "每日資料匯出" 功能
   - 選擇郵件寄送並輸入測試信箱
   - 確認能成功寄送郵件

2. **檢查 Render 日誌**：
   - 在 Render Dashboard → Logs
   - 查看 SMTP 連線和寄送狀態

## 🚨 常見問題排除

### 問題 1：SMTP 認證失敗
**原因**：密碼錯誤或帳號被鎖定
**解決**：
- 確認企業郵件帳號密碼正確
- 檢查帳號是否需要解鎖
- 聯絡 IT 部門確認 SMTP 權限

### 問題 2：連線逾時
**原因**：防火牆或網路設定阻擋
**解決**：
- 確認 Render 伺服器可存取企業 SMTP
- 檢查防火牆設定是否允許外部連線
- 嘗試不同的 SMTP 埠號 (587/465)

### 問題 3：郵件被退回
**原因**：寄件者驗證或 SPF 記錄問題
**解決**：
- 確認 `SMTP_FROM` 與 `SMTP_USER` 一致
- 檢查企業郵件的 SPF 記錄設定
- 聯絡 IT 部門確認外發郵件設定

## 📋 部署檢查清單

在部署時請確認：

- [ ] 企業郵件帳號可正常登入
- [ ] SMTP 伺服器地址正確無誤
- [ ] 企業防火牆允許 SMTP 連線
- [ ] IT 部門已知此應用程式會使用該郵件帳號
- [ ] 測試郵件寄送功能正常

## 🔐 安全建議

1. **專用服務帳號**：
   - 建議使用專用的系統郵件帳號
   - 避免使用個人郵件帳號

2. **密碼管理**：
   - 使用強密碼
   - 定期更換密碼
   - 密碼不要包含在代碼中

3. **權限控制**：
   - 限制郵件帳號只能寄送郵件
   - 不要給予不必要的權限

## 📞 聯絡資訊

如有 SMTP 設定問題，請聯絡：
- IT 部門協助企業郵件伺服器設定
- 系統管理員協助應用程式配置