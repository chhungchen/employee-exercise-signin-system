# 📱 員工運動社團活動簽到系統

一個現代化的員工運動社團簽到管理系統，支援手機簽到、照片上傳、電子簽名等功能。

## ✨ 功能特色

### 📱 員工簽到
- **手機友好界面** - 響應式設計，完美適配各種設備
- **照片上傳** - 支援拍照/選擇照片，自動壓縮
- **電子簽名** - 觸控簽名功能
- **即時驗證** - 表單驗證和錯誤提示
- **自動填入** - 當前日期時間自動填入

### 🔧 後台管理
- **簽到記錄管理** - 查看、搜尋、排序所有簽到記錄
- **統計報表** - 圖表化統計分析
- **CSV 匯出** - 支援中文的資料匯出
- **照片/簽名查看** - 點擊放大查看

### 🔒 安全性
- **JWT 身份驗證** - 安全的登入機制
- **資料加密** - 敏感資料加密存儲
- **CSP 安全策略** - 防止 XSS 攻擊
- **輸入驗證** - 前後端雙重驗證

## 🚀 快速開始

### 環境需求
- Node.js 16.0.0 或更高版本
- npm 8.0.0 或更高版本

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone <your-repo-url>
   cd employee-exercise-signin
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **初始化資料庫**
   ```bash
   npm run init-db
   ```

4. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

5. **訪問應用**
   - 📱 簽到表單：http://localhost:3000
   - 🔧 後台管理：http://localhost:3000/admin

## 📦 部署

### Render.com 部署（推薦）
1. Fork 此專案到您的 GitHub
2. 訪問 [render.com](https://render.com)
3. 創建新的 Web Service
4. 連接您的 GitHub 倉庫
5. 設定環境變數並部署

詳細部署指南請參考 [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

## 🛠️ 技術架構

- **後端**：Node.js + Express.js
- **資料庫**：SQLite3 / Google Sheets
- **雲端儲存**：Google Drive
- **身份驗證**：JWT + bcryptjs + Google OAuth 2.0
- **檔案上傳**：Multer
- **前端**：HTML5 + CSS3 + Vanilla JavaScript
- **安全**：Helmet + CORS + Rate Limiting

## 🔐 Google OAuth 整合

本系統整合 Google Sheets 與 Google Drive 作為資料儲存方案，使用 OAuth 2.0 進行安全授權。

### OAuth 設定狀態

- **授權模式**：正式版 (In Production)
- **Token 有效期**：長期有效（除非手動撤銷或 180 天未使用）
- **監控機制**：每小時自動健康檢查，異常時郵件通知

### 使用的 Google API

- **Google Sheets API**：儲存員工資料、活動記錄、簽到資料
- **Google Drive API**：儲存簽到照片與電子簽名檔案

### Token 監控

系統內建 Token 健康監控機制：
- 每小時自動檢查 Token 狀態
- 每日 08:00 執行深度健康檢查
- 每週一 09:00 發送健康報告
- Token 異常時自動發送警報郵件

詳細設定請參考本地文件（不包含於 Git 版本控制）

## 📋 API 端點

### 公開 API
- `GET /` - 簽到表單頁面
- `POST /api/signin` - 提交簽到
- `GET /api/activities` - 獲取活動列表
- `GET /api/statistics` - 獲取統計資料

### 管理 API（需要身份驗證）
- `POST /api/admin/login` - 管理員登入
- `GET /api/admin/dashboard` - 獲取儀表板資料
- `GET /api/admin/export/signins` - 匯出簽到記錄

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 支援

如有問題，請創建 Issue 或聯繫開發團隊。