// 載入環境變數
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./database/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中間件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseSrc: ["'self'"],
            fontSrc: ["'self'", "https:", "data:"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"], // 允許 blob: URLs
            objectSrc: ["'none'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            upgradeInsecureRequests: [],
        },
    },
}));

// CORS設定
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
}));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分鐘
    max: 100, // 限制每個IP 15分鐘內最多100個請求
    message: {
        error: '請求過於頻繁，請稍後再試'
    }
});
app.use('/api/', limiter);

// 解析JSON請求體
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 防止 API 快取
app.use('/api/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// 靜態檔案服務
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// API路由
// 健康檢查端點
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 根據環境變數決定使用哪個路由
const useGoogleServices = process.env.USE_GOOGLE_SERVICES === 'true';
const usePersonalGoogle = process.env.USE_PERSONAL_GOOGLE === 'true';

if (useGoogleServices && usePersonalGoogle) {
    console.log('🔄 使用個人 Google 帳號 (Sheets & Drive) 作為資料儲存');
    // 載入個人 Google 授權路由
    app.use('/', require('./routes/personal-google-auth'));
    // 載入個人 Google 版本的資料路由
    app.use('/api', require('./routes/signin-personal-google'));
    app.use('/api/admin', require('./routes/admin-personal-google'));
} else if (useGoogleServices) {
    console.log('🔄 使用 Google Sheets & Drive 作為資料儲存');
    app.use('/api', require('./routes/signin-google'));
    app.use('/api/admin', require('./routes/admin-google'));
} else {
    console.log('🗄️ 使用 SQLite 作為資料儲存');
    app.use('/api', require('./routes/signin'));
    app.use('/api/admin', require('./routes/admin'));
}

// 首頁路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 後台管理路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// 404處理
app.use('*', (req, res) => {
    res.status(404).json({ error: '找不到請求的資源' });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    res.status(500).json({ error: '伺服器內部錯誤' });
});

// 啟動伺服器
const startServer = async () => {
    try {
        // 根據設定初始化不同的資料庫
        if (useGoogleServices && usePersonalGoogle) {
            // 初始化個人 Google 服務
            const personalGoogleServices = require('./services/personal-google-services');
            const personalDatabase = require('./database/personal-google-database');
            
            const initialized = await personalGoogleServices.initialize();
            if (initialized) {
                await personalGoogleServices.ensureSpreadsheetExists();
                await personalDatabase.initialize();
                console.log('✅ 個人 Google 服務初始化完成');
            } else {
                console.log('⚠️  個人 Google 服務需要授權，請訪問 /auth/google 進行授權');
            }
        } else if (useGoogleServices) {
            // 初始化 Google 服務帳號
            const googleServices = require('./services/google-services');
            await googleServices.initialize();
            console.log('✅ Google 服務初始化完成');
        } else {
            // 初始化 SQLite 資料庫
            await initDatabase();
            console.log('✅ SQLite 資料庫初始化完成');
        }

        // 啟動伺服器
        app.listen(PORT, () => {
            console.log(`🚀 伺服器已啟動在 http://localhost:${PORT}`);
            console.log(`📱 簽到表單: http://localhost:${PORT}`);
            console.log(`🔧 後台管理: http://localhost:${PORT}/admin`);
            console.log(`📊 API文檔: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ 伺服器啟動失敗:', error);
        process.exit(1);
    }
};

startServer(); // trigger restart
