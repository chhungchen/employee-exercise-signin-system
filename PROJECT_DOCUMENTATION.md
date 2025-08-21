# 員工運動社團活動簽到系統 - 專案文件

## 📋 專案概述

### 專案名稱
員工運動社團活動簽到表系統 (Employee Exercise Sign-in System)

### 專案描述
一個支援手機簽到的員工運動社團活動管理系統，具備照片上傳、電子簽名、後台管理等功能。支援雙重儲存模式：本機 SQLite 或雲端 Google Sheets + Google Drive。

### 主要功能
- ✅ 員工運動活動簽到
- ✅ 照片上傳作為簽到證明
- ✅ 電子簽名確認
- ✅ 手機響應式設計
- ✅ 後台管理介面
- ✅ 資料統計與匯出
- ✅ 雙重儲存模式 (SQLite / Google Services)

## 🏗️ 技術架構

### 後端技術棧
- **Runtime**: Node.js (>= 16.0.0)
- **Framework**: Express.js 4.18.2
- **Database**: SQLite3 5.1.6 / Google Sheets API
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password**: bcryptjs 2.4.3
- **File Upload**: Multer 2.0.2
- **Date/Time**: Moment.js 2.29.4
- **Security**: Helmet 7.1.0, CORS 2.8.5, Rate Limiting
- **Google APIs**: googleapis (最新版)

### 前端技術棧
- **HTML5**: 語義化標籤、響應式設計
- **CSS3**: Flexbox、Grid、媒體查詢、動畫效果
- **JavaScript (ES6+)**: 原生 JavaScript、Canvas API、FileReader API
- **UI Components**: 自訂按鈕、表單、模態框
- **Icons**: Font Awesome 6.0.0

### 儲存架構
1. **本機模式 (SQLite)**
   - 資料庫檔案: `database/exercise_signin.db`
   - 照片儲存: `uploads/photos/`
   
2. **雲端模式 (Google Services)**
   - 資料儲存: Google Sheets
   - 照片儲存: Google Drive
   - 透過環境變數 `USE_GOOGLE_SERVICES=true` 切換

## 📁 專案結構

```
Employee Exercise SignNEW/
├── 📁 admin/                    # 後台管理介面
│   ├── index.html              # 管理員登入頁面
│   ├── 📁 css/
│   │   └── admin.css           # 後台樣式
│   └── 📁 js/
│       └── admin.js            # 後台邏輯
├── 📁 database/                # 資料庫相關
│   ├── database.js             # SQLite 資料庫設定
│   └── google-database.js      # Google Sheets 資料庫抽象層
├── 📁 deployment/              # 部署相關檔案
│   ├── Dockerfile              # Docker 容器設定
│   ├── docker-compose.yml      # Docker Compose 設定
│   ├── nginx.conf              # Nginx 反向代理設定
│   ├── deploy.sh               # 部署腳本
│   ├── env.production.example  # 生產環境變數範例
│   └── README.md               # 部署說明
├── 📁 middleware/              # 中間件
│   └── auth.js                 # JWT 認證中間件
├── 📁 public/                  # 前端資源
│   ├── index.html              # 主要簽到頁面
│   ├── 📁 css/
│   │   └── style.css           # 前端樣式
│   └── 📁 js/
│       └── app.js              # 前端邏輯
├── 📁 routes/                  # API 路由
│   ├── signin.js               # 簽到相關 API (SQLite 版)
│   ├── signin-google.js        # 簽到相關 API (Google 版)
│   ├── admin.js                # 管理員 API (SQLite 版)
│   └── admin-google.js         # 管理員 API (Google 版)
├── 📁 scripts/                 # 腳本工具
│   ├── init-database.js        # 資料庫初始化
│   ├── change-password.js      # 密碼變更 (SQLite 版)
│   ├── change-password-google.js # 密碼變更 (Google 版)
│   ├── check-data.js           # 資料診斷工具
│   └── migrate-to-google.js    # 資料遷移工具
├── 📁 services/                # 服務層
│   └── google-services.js      # Google APIs 整合服務
├── 📁 uploads/                 # 上傳檔案 (SQLite 模式)
│   └── 📁 photos/
│       └── .gitkeep
├── server.js                   # 主伺服器檔案
├── package.json                # 專案依賴設定
├── package-lock.json           # 依賴鎖定檔案
├── .gitignore                  # Git 忽略檔案
├── README.md                   # 專案說明
├── GOOGLE_SETUP.md             # Google 服務設定指南
├── SECURITY.md                 # 安全性說明
├── DEPLOY_GUIDE.md             # 部署指南
├── PROJECT_DOCUMENTATION.md   # 專案文件 (本檔案)
├── Procfile                    # Heroku 部署設定
├── vercel.json                 # Vercel 部署設定
├── railway.toml                # Railway 部署設定
├── render.yaml                 # Render.com 部署設定
├── app.json                    # Heroku 一鍵部署
├── .npmrc                      # npm 設定
├── build.sh                    # 自訂建置腳本
├── deploy-heroku.bat           # Windows Heroku 部署
└── deploy-heroku.ps1           # PowerShell Heroku 部署
```

## 🗄️ 資料庫設計

### SQLite 模式表格結構

#### 1. employees (員工表)
```sql
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,     -- 員工編號
    name TEXT NOT NULL,                   -- 姓名
    department TEXT NOT NULL,             -- 部門
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. activities (活動表)
```sql
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_code TEXT UNIQUE NOT NULL,   -- 活動代碼 (ACT+時間戳)
    activity_type TEXT NOT NULL,          -- 運動項目 (羽球/桌球/瑜珈/戶外活動/其他)
    location TEXT NOT NULL,               -- 地點
    activity_datetime DATETIME NOT NULL   -- 活動日期時間
);
```

#### 3. signins (簽到表)
```sql
CREATE TABLE signins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signin_code TEXT UNIQUE NOT NULL,     -- 簽到代碼 (SIGN+時間戳)
    employee_id TEXT NOT NULL,            -- 員工編號 (外鍵)
    activity_id INTEGER NOT NULL,         -- 活動ID (外鍵)
    signin_type TEXT DEFAULT '準時簽到',  -- 簽到類型
    notes TEXT,                           -- 備註
    photo_path TEXT,                      -- 照片路徑
    signature_data TEXT,                  -- 簽名資料 (Base64)
    signin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id),
    FOREIGN KEY (activity_id) REFERENCES activities (id)
);
```

#### 4. admins (管理員表)
```sql
CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,        -- 管理員帳號
    password TEXT NOT NULL,               -- 密碼 (bcrypt 加密)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Google Sheets 模式表格結構

Google Sheets 使用相同的欄位結構，但以工作表的形式儲存：
- **employees** 工作表
- **activities** 工作表  
- **signins** 工作表 (photo_path 改為 photo_url)
- **admins** 工作表

## 🔌 API 端點設計

### 公開 API (/api)

#### 簽到相關
- `POST /api/signin` - 員工簽到
  - 參數: employeeId, name, department, activityType, location, activityDateTime, signatureData
  - 檔案: photo (multipart/form-data)
  - 回傳: signinCode, name, activity

- `GET /api/activities` - 取得活動列表
  - 回傳: 所有活動資料 (按時間排序)

- `GET /api/statistics` - 取得統計資料
  - 參數: startDate, endDate, department (可選)
  - 回傳: 統計圖表資料

### 管理員 API (/api/admin) [需要 JWT 認證]

#### 認證
- `POST /api/admin/login` - 管理員登入
  - 參數: username, password
  - 回傳: JWT token, user info

#### 儀表板
- `GET /api/admin/dashboard` - 取得儀表板資料
  - 回傳: totalStats, departmentStats, activityTypeStats, allSignins

#### 資料管理
- `DELETE /api/admin/signins/:id` - 刪除簽到記錄
- `GET /api/admin/export/signins` - 匯出 CSV

### 系統 API
- `GET /api/health` - 健康檢查

## 🎨 前端設計

### 主要頁面

#### 1. 簽到頁面 (`public/index.html`)
**功能組件:**
- **表單區域**: 員工資訊、活動資訊輸入
- **照片上傳**: 支援拍照/選擇照片，自動壓縮至 0.5MB
- **電子簽名**: Canvas 簽名板，支援觸控
- **成功訊息**: 顯示簽到結果和後續操作

**響應式設計:**
- 桌面版: 寬度適中，左右置中
- 平板版: 調整間距和字體大小
- 手機版: 全寬顯示，優化觸控體驗

#### 2. 後台管理 (`admin/index.html`)
**功能模組:**
- **登入頁面**: 管理員認證
- **儀表板**: 統計數據和圖表
- **總覽**: 所有簽到記錄管理
- **統計報表**: 自訂統計分析

### CSS 架構

#### 全域樣式 (`public/css/style.css`)
```css
/* 基礎樣式 */
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #27ae60;
    --danger-color: #e74c3c;
    --warning-color: #f39c12;
}

/* 響應式斷點 */
@media (max-width: 768px) { /* 平板 */ }
@media (max-width: 480px) { /* 手機 */ }
```

#### 管理員樣式 (`admin/css/admin.css`)
- 深色主題設計
- 表格和圖表樣式
- 模態框和按鈕組件

### JavaScript 架構

#### 前端邏輯 (`public/js/app.js`)
**主要功能模組:**
```javascript
// 初始化
function initializeApp()
function setDefaultDateTime()

// 表單驗證
function validateForm()
function setupRealTimeValidation()

// 照片處理
function initializePhotoUpload()
function displayPhotoPreview()
function compressImage()

// 簽名功能
function initializeSignature()
function clearSignature()
function hasSignature()

// 提交處理
function submitForm()
function showSuccessMessage()
```

#### 後台邏輯 (`admin/js/admin.js`)
**主要功能模組:**
```javascript
// 認證管理
function login()
function logout()
function authenticateToken()

// 資料載入
function loadDashboardData()
function loadStatistics()

// 資料操作
function deleteSignin()
function exportSignins()
function sortSignins()

// 圖表渲染
function updateCharts()
function createSimpleChart()
```

## 🔒 安全性設計

### 認證與授權
- **JWT Token**: 24小時有效期
- **密碼加密**: bcryptjs 10 輪加密
- **路由保護**: 管理員 API 需要有效 token

### 安全中間件
```javascript
// Helmet - 安全標頭
app.use(helmet());

// CORS - 跨域請求控制
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
}));

// Rate Limiting - 請求頻率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分鐘
    max: 100 // 限制每個IP最多100個請求
});

// Cache Control - 防止 API 快取
app.use('/api/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});
```

### 檔案安全
- **上傳限制**: 僅允許圖片檔案
- **檔案大小**: 限制 10MB
- **路徑控制**: 避免路徑遍歷攻擊
- **.gitignore**: 排除敏感檔案

## 🌐 部署架構

### 支援的部署平台
1. **Render.com** (推薦) - 免費方案支援
2. **Railway** - 簡單部署流程
3. **Heroku** - 傳統雲端平台
4. **Vercel** - 前端優化平台
5. **Docker** - 容器化部署

### 環境變數設定

#### 基本設定
```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-key
DEFAULT_ADMIN_PASSWORD=請設定安全密碼
```

#### Google Services 設定
```bash
USE_GOOGLE_SERVICES=true
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
```

### Docker 部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🛠️ 開發工具與腳本

### NPM 腳本
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "init-db": "node scripts/init-database.js",
    "change-password": "node scripts/change-password.js",
    "change-password-google": "node scripts/change-password-google.js",
    "check-data": "node scripts/check-data.js",
    "migrate-to-google": "node scripts/migrate-to-google.js",
    "build": "npm run init-db",
    "deploy": "node deployment/cloud-deploy.sh"
  }
}
```

### 實用工具

#### 1. 資料庫初始化
```bash
npm run init-db
```
- 建立所有表格
- 新增預設管理員帳號

#### 2. 密碼管理
```bash
# SQLite 版本
npm run change-password

# Google Sheets 版本  
npm run change-password-google
```

#### 3. 資料診斷
```bash
npm run check-data
```
- 檢查資料完整性
- 顯示統計資訊
- 偵測重複或孤立資料

#### 4. 資料遷移
```bash
npm run migrate-to-google
```
- 將 SQLite 資料遷移至 Google Sheets
- 上傳本機照片至 Google Drive

## 📊 功能詳細說明

### 簽到流程
1. **員工資訊輸入**: 員工編號、姓名、部門
2. **活動資訊選擇**: 運動項目、地點、日期時間
3. **照片上傳**: 拍照或選擇照片作為簽到證明
4. **電子簽名**: Canvas 簽名確認
5. **資料提交**: 後端驗證並儲存
6. **成功回饋**: 顯示簽到代碼和詳細資訊

### 後台管理功能

#### 儀表板
- **統計卡片**: 總員工數、總活動數、總簽到數
- **圖表顯示**: 部門分布圓餅圖、活動類型長條圖
- **最新動態**: 最近簽到記錄列表

#### 資料管理
- **記錄查看**: 完整簽到記錄列表
- **照片檢視**: 點擊放大查看簽到照片
- **簽名檢視**: 點擊查看電子簽名
- **批次操作**: 選擇多筆記錄進行刪除
- **排序功能**: 按日期、姓名、部門排序
- **資料匯出**: CSV 格式匯出

#### 統計分析
- **時間篩選**: 自訂日期範圍
- **部門篩選**: 按部門統計
- **活動篩選**: 按運動項目統計
- **圖表展示**: 互動式統計圖表

### Google Services 整合

#### Google Sheets 功能
- **自動建表**: 首次使用自動建立試算表
- **即時同步**: 資料即時寫入 Google Sheets
- **協作編輯**: 支援多人同時查看和編輯
- **版本控制**: Google Sheets 內建版本歷史

#### Google Drive 功能
- **照片儲存**: 所有簽到照片儲存至指定資料夾
- **權限管理**: 自動設定檔案為公開可讀取
- **無限容量**: 相比本機儲存，容量更大
- **CDN 加速**: Google 全球 CDN 加速圖片載入

## 🔄 版本歷史與更新

### v1.0.0 - 基礎功能 (2024-12)
- ✅ 基本簽到表單
- ✅ SQLite 資料庫
- ✅ 照片上傳功能
- ✅ 電子簽名
- ✅ 後台管理

### v1.1.0 - UI/UX 改進 (2024-12)
- ✅ 手機響應式設計
- ✅ 照片壓縮功能
- ✅ 簽名體驗優化
- ✅ 成功頁面改進

### v1.2.0 - 功能強化 (2024-12)
- ✅ 資料快取解決方案
- ✅ 批次刪除功能
- ✅ 排序和篩選
- ✅ CSV 匯出功能
- ✅ 資料診斷工具

### v2.0.0 - Google 整合 (2025-01)
- ✅ Google Sheets 整合
- ✅ Google Drive 照片儲存
- ✅ 雙重模式支援
- ✅ 資料遷移工具
- ✅ 完整部署指南

## 🚀 未來規劃

### 短期目標 (1-3個月)
- [ ] 推播通知功能
- [ ] 二維碼簽到
- [ ] 活動排程管理
- [ ] 更多統計圖表

### 中期目標 (3-6個月)
- [ ] 多語言支援
- [ ] 主題切換功能
- [ ] API 版本控制
- [ ] 自動化測試

### 長期目標 (6個月以上)
- [ ] 微服務架構重構
- [ ] 機器學習分析
- [ ] 行動應用程式
- [ ] 企業級功能

## 🛡️ 疑難排解

### 常見問題

#### 1. 無法上傳照片
**可能原因:**
- 檔案過大 (>10MB)
- 格式不支援 (非圖片檔案)
- 網路連線問題

**解決方案:**
- 檢查檔案大小和格式
- 重新整理頁面再試
- 檢查網路連線狀態

#### 2. 簽名無法儲存
**可能原因:**
- 簽名區域為空白
- 瀏覽器不支援 Canvas
- JavaScript 被停用

**解決方案:**
- 確實在簽名區域畫上簽名
- 更新瀏覽器版本
- 啟用 JavaScript

#### 3. 後台無法登入
**可能原因:**
- 帳號密碼錯誤
- JWT Secret 未設定
- 資料庫連線問題

**解決方案:**
- 使用預設管理員帳號
- 檢查環境變數設定
- 重新初始化資料庫

#### 4. Google Services 無法連線
**可能原因:**
- Service Account 金鑰錯誤
- API 未啟用
- 權限設定問題

**解決方案:**
- 檢查 GOOGLE_SERVICE_ACCOUNT_KEY
- 確認已啟用相關 API
- 重新設定試算表權限

## 📞 技術支援

### 開發者資訊
- **專案維護**: AI Assistant (Claude Sonnet)
- **技術棧**: Node.js + Express + SQLite/Google APIs
- **授權協議**: MIT License

### 聯絡方式
- **GitHub Issues**: 回報問題和建議
- **技術文件**: 參考各 .md 檔案
- **部署支援**: 查看 DEPLOY_GUIDE.md

---

**最後更新**: 2025年1月
**文件版本**: v2.0.0
**專案狀態**: 穩定運行中 ✅