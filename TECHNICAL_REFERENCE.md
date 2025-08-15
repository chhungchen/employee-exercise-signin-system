# 技術實作參考文件

## 🔧 核心技術實作細節

### 1. 檔案上傳處理

#### Multer 設定 (SQLite 模式)
```javascript
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/photos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `signin_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案'), false);
        }
    }
});
```

#### Google Drive 上傳 (Google 模式)
```javascript
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案'), false);
        }
    }
});

// 上傳到 Google Drive
async uploadPhoto(fileBuffer, fileName, mimeType) {
    const response = await this.drive.files.create({
        resource: {
            name: fileName,
            parents: this.driveFolder ? [this.driveFolder] : undefined
        },
        media: {
            mimeType: mimeType,
            body: fileBuffer
        },
        fields: 'id,name,webViewLink,webContentLink'
    });

    // 設定檔案為公開可讀取
    await this.drive.permissions.create({
        fileId: response.data.id,
        resource: { role: 'reader', type: 'anyone' }
    });

    return response.data;
}
```

### 2. 電子簽名實作

#### Canvas 初始化
```javascript
function initializeSignature() {
    signatureCanvas = document.getElementById('signatureCanvas');
    signatureCtx = signatureCanvas.getContext('2d');
    
    // 設定畫布尺寸
    function resizeCanvas() {
        const rect = signatureCanvas.getBoundingClientRect();
        signatureCanvas.width = rect.width;
        signatureCanvas.height = rect.height;
        
        // 設定畫筆樣式
        signatureCtx.strokeStyle = '#000';
        signatureCtx.lineWidth = 2;
        signatureCtx.lineCap = 'round';
        signatureCtx.lineJoin = 'round';
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}
```

#### 觸控事件處理
```javascript
// 滑鼠/觸控事件
signatureCanvas.addEventListener('mousedown', startDrawing);
signatureCanvas.addEventListener('mousemove', draw);
signatureCanvas.addEventListener('mouseup', stopDrawing);
signatureCanvas.addEventListener('touchstart', handleTouch);
signatureCanvas.addEventListener('touchmove', handleTouch);
signatureCanvas.addEventListener('touchend', stopDrawing);

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                     e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}
```

#### 簽名驗證
```javascript
function hasSignature() {
    try {
        if (!signatureCanvas || signatureCanvas.width === 0 || signatureCanvas.height === 0) {
            resizeCanvas();
            return false;
        }

        const imageData = signatureCtx.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height);
        const data = imageData.data;
        
        // 計算非透明像素數量
        let pixelCount = 0;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) pixelCount++; // Alpha > 0
        }
        
        return pixelCount >= 50; // 至少50個像素才算有效簽名
    } catch (error) {
        console.error('檢查簽名時發生錯誤:', error);
        initializeSignature();
        return false;
    }
}
```

### 3. Google Sheets API 整合

#### 認證設定
```javascript
async initialize() {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
        
        this.auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        
        return true;
    } catch (error) {
        console.error('❌ Google Services 初始化失敗:', error);
        return false;
    }
}
```

#### 資料操作
```javascript
// 讀取資料
async readData(sheetName, range = '') {
    const fullRange = range ? `${sheetName}!${range}` : `${sheetName}`;
    const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: fullRange
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    // 將資料轉換為物件陣列
    const headers = rows[0];
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    });
}

// 新增資料
async insertData(sheetName, data) {
    const headerResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!1:1`
    });

    const headers = headerResponse.data.values[0] || [];
    const values = headers.map(header => data[header] || '');

    await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'RAW',
        resource: { values: [values] }
    });
}
```

### 4. JWT 認證中間件

```javascript
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '需要登入權限' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token 已過期，請重新登入' });
            }
            return res.status(403).json({ error: '無效的token' });
        }
        req.user = user;
        next();
    });
};
```

### 5. 密碼加密處理

```javascript
// 註冊時加密密碼
const hashedPassword = await bcrypt.hash(password, 10);

// 登入時驗證密碼
const isValidPassword = await bcrypt.compare(password, storedHashedPassword);

// 產生 JWT Token
const token = jwt.sign(
    { username: admin.username, id: admin.id },
    JWT_SECRET,
    { expiresIn: '24h' }
);
```

### 6. 前端圖片處理

#### 圖片預覽
```javascript
function displayPhotoPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        photoPreview.innerHTML = `
            <img src="${e.target.result}" alt="預覽照片" style="max-width: 100%; max-height: 200px;">
            <p>檔案名稱: ${file.name}</p>
            <p>檔案大小: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
        `;
        
        removePhotoBtn.style.display = 'inline-block';
        selectPhotoBtn.textContent = '重新選擇';
    };
    reader.readAsDataURL(file);
}
```

#### 圖片壓縮 (概念)
```javascript
function compressImage(file, maxSizeKB = 500) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // 計算壓縮比例
            const maxWidth = 1200;
            const maxHeight = 1200;
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 繪製並壓縮
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(resolve, 'image/jpeg', 0.8);
        };
        
        img.src = URL.createObjectURL(file);
    });
}
```

### 7. 響應式設計實作

#### CSS 媒體查詢
```css
/* 基礎樣式 - 桌面版 */
.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

/* 平板版 */
@media (max-width: 768px) {
    .container {
        max-width: none;
        margin: 0 10px;
        padding: 15px;
    }
    
    .form-row {
        flex-direction: column;
    }
    
    .photo-controls {
        flex-direction: column;
        gap: 10px;
    }
}

/* 手機版 */
@media (max-width: 480px) {
    .container {
        margin: 0 5px;
        padding: 10px;
    }
    
    .btn {
        min-height: 48px; /* 觸控友善的按鈕高度 */
        font-size: 1rem;
    }
    
    .signature-canvas {
        height: 180px; /* 手機版增加簽名區域高度 */
    }
    
    input, select, textarea {
        min-height: 44px; /* 觸控友善的輸入框高度 */
        font-size: 16px; /* 防止 iOS 自動縮放 */
    }
}
```

#### JavaScript 響應式處理
```javascript
// 偵測設備類型
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 動態調整簽名畫布
function adjustCanvasForMobile() {
    if (isMobileDevice()) {
        signatureCanvas.style.height = '180px';
        // 增加觸控靈敏度
        signatureCanvas.style.touchAction = 'none';
    }
}

// 視窗大小改變時重新調整
window.addEventListener('resize', function() {
    resizeCanvas();
    adjustCanvasForMobile();
});
```

### 8. 安全性實作

#### CSP (Content Security Policy)
```javascript
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https://drive.google.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
        }
    }
}));
```

#### 輸入驗證
```javascript
// 後端驗證
function validateSigninData(data) {
    const { employeeId, name, department, activityType, location, activityDateTime } = data;
    
    const errors = [];
    
    if (!employeeId || employeeId.trim().length === 0) {
        errors.push('員工編號不能為空');
    }
    
    if (!name || name.trim().length === 0) {
        errors.push('姓名不能為空');
    }
    
    if (!department || department.trim().length === 0) {
        errors.push('部門不能為空');
    }
    
    // 驗證日期格式
    if (!moment(activityDateTime).isValid()) {
        errors.push('活動日期時間格式不正確');
    }
    
    return errors;
}

// 前端驗證
function validateForm() {
    const employeeId = document.getElementById('employeeId').value.trim();
    const name = document.getElementById('name').value.trim();
    
    if (!employeeId) {
        showError('請輸入員工編號');
        return false;
    }
    
    if (employeeId.length < 3) {
        showError('員工編號至少需要3個字元');
        return false;
    }
    
    return true;
}
```

### 9. 錯誤處理機制

#### 全域錯誤處理
```javascript
// Express 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '檔案大小超過限制 (10MB)' });
    }
    
    if (err.message.includes('只允許上傳圖片檔案')) {
        return res.status(400).json({ error: '只允許上傳圖片檔案' });
    }
    
    res.status(500).json({ error: '內部伺服器錯誤' });
});

// 未捕獲例外處理
process.on('uncaughtException', (error) => {
    console.error('未捕獲的例外:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
});
```

#### 前端錯誤處理
```javascript
// 全域錯誤處理
window.addEventListener('error', function(e) {
    console.error('JavaScript 錯誤:', e.error);
    showErrorMessage('發生未預期的錯誤，請重新整理頁面');
});

// Promise 錯誤處理
window.addEventListener('unhandledrejection', function(e) {
    console.error('未處理的 Promise 錯誤:', e.reason);
    e.preventDefault();
});

// API 錯誤處理
async function handleApiError(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status} 錯誤`;
        throw new Error(errorMessage);
    }
    return response;
}
```

### 10. 效能優化

#### 前端優化
```javascript
// 防抖函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 即時驗證使用防抖
const debouncedValidation = debounce(validateField, 300);
document.getElementById('employeeId').addEventListener('input', debouncedValidation);

// 圖片懶載入
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}
```

#### 後端優化
```javascript
// 快取機制
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10分鐘快取

app.get('/api/statistics', (req, res) => {
    const cacheKey = `stats_${JSON.stringify(req.query)}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
        return res.json(cachedData);
    }
    
    // 查詢資料庫...
    const data = getStatisticsFromDB(req.query);
    cache.set(cacheKey, data);
    res.json(data);
});

// 資料庫連線池
const sqlite3 = require('sqlite3').verbose();
const pool = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

// 預備語句
const insertSigninStmt = pool.prepare(`
    INSERT INTO signins (signin_code, employee_id, activity_id, signin_type, notes, photo_path, signature_data) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);
```

---

**此文件提供了系統核心技術的詳細實作參考，適合開發者進行程式碼維護和功能擴展時使用。**