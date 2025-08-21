const express = require('express');
const router = express.Router();
const multer = require('multer');
const moment = require('moment');
const personalDatabase = require('../database/personal-google-database');
const personalGoogleServices = require('../services/personal-google-services');

// 生成唯一編碼
const generateUniqueCode = (prefix) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}${timestamp}${random}`;
};

// 設定 multer 使用記憶體儲存（因為要上傳到 Google Drive）
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB (降低至2MB以減少郵件大小)
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案'), false);
        }
    },
    // 確保正確處理 UTF-8 編碼
    encoding: 'utf8'
});

// 檢查授權狀態的中間件
const checkAuth = async (req, res, next) => {
    try {
        const authStatus = await personalGoogleServices.checkAuthStatus();
        if (!authStatus.authorized) {
            return res.status(401).json({ 
                error: '需要 Google 授權', 
                authUrl: personalGoogleServices.getAuthUrl(),
                authRequired: true 
            });
        }
        next();
    } catch (error) {
        console.error('檢查授權狀態錯誤:', error);
        res.status(500).json({ error: '授權檢查失敗' });
    }
};

// 員工簽到
router.post('/signin', upload.single('photo'), async (req, res) => {
    let signinData;
    if (req.file) {
        try {
            signinData = JSON.parse(req.body.data);
        } catch (error) {
            return res.status(400).json({ error: '資料格式錯誤' });
        }
    } else {
        signinData = req.body;
    }

    const {
        employeeId, name, department, activityType, location, activityDateTime, signatureData
    } = signinData;

    // 驗證必填欄位
    if (!employeeId || !name || !department || !activityType || !location || !activityDateTime) {
        return res.status(400).json({ error: '請填寫所有必填欄位' });
    }

    if (!req.file) {
        return res.status(400).json({ error: '請上傳照片作為簽到證明' });
    }

    try {
        // 初始化服務
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ 
                error: '系統需要授權才能處理簽到', 
                message: '請聯繫管理員完成系統授權設定',
                authRequired: true 
            });
        }

        await personalGoogleServices.ensureSpreadsheetExists();

        // 檢查員工是否存在，不存在則新增
        let employee = await personalDatabase.getEmployeeById(employeeId);
        if (!employee) {
            employee = await personalDatabase.createEmployee({
                employee_id: employeeId,
                name: name,
                department: department,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
            });
        }

        // 檢查活動是否已存在，不存在則新增
        let activity = await personalDatabase.getActivityByDetails(activityType, location, activityDateTime);
        if (!activity) {
            const activityCode = generateUniqueCode('ACT');
            activity = await personalDatabase.createActivity({
                activity_code: activityCode,
                activity_type: activityType,
                location: location,
                activity_datetime: activityDateTime,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
            });
        }

        // 檢查是否已經簽到過
        const existingSignin = await personalDatabase.getSigninByEmployeeAndActivity(employeeId, activity.activity_code);
        if (existingSignin) {
            return res.status(400).json({ error: '您已經簽到過了' });
        }

        // 上傳照片到 Google Drive
        let photoUrl = null;
        if (req.file) {
            try {
                // 生成檔名
                const timestamp = Date.now();
                const ext = req.file.originalname.split('.').pop();
                const fileName = `signin_${employeeId}_${timestamp}.${ext}`;

                // 上傳到 Google Drive
                const driveFile = await personalGoogleServices.uploadPhoto(
                    req.file.buffer,
                    fileName,
                    req.file.mimetype
                );

                photoUrl = driveFile.url;
                
                console.log(`✅ 照片已上傳到 Google Drive: ${fileName}`);
            } catch (uploadError) {
                console.error('照片上傳失敗:', uploadError);
                console.error('照片上傳錯誤詳情:', {
                    message: uploadError.message,
                    code: uploadError.code,
                    status: uploadError.status,
                    stack: uploadError.stack
                });
                return res.status(500).json({ 
                    error: '照片上傳失敗，請稍後再試',
                    debug: {
                        message: uploadError.message,
                        code: uploadError.code,
                        driveFolder: process.env.GOOGLE_DRIVE_FOLDER_ID ? 'SET' : 'NOT_SET'
                    },
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 建立簽到記錄
        const signinCode = generateUniqueCode('SIGN');
        const newSignin = await personalDatabase.createSignin({
            signin_code: signinCode,
            employee_id: employeeId,
            activity_code: activity.activity_code,
            signin_type: '準時簽到',
            notes: '',
            photo_url: photoUrl,
            signature_data: signatureData || '',
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });

        res.json({
            message: '簽到成功！',
            signinCode,
            name: name,
            activity: {
                type: activityType,
                location,
                dateTime: moment(activityDateTime).format('YYYY-MM-DD HH:mm')
            }
        });

    } catch (error) {
        console.error('簽到錯誤:', error);
        console.error('錯誤堆疊:', error.stack);
        res.status(500).json({ 
            error: '簽到失敗，請稍後再試',
            debug: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// 取得活動列表
router.get('/activities', checkAuth, async (req, res) => {
    try {
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const activities = await personalDatabase.getAllActivities();
        
        // 按時間排序
        const sortedActivities = activities.sort((a, b) => 
            moment(b.activity_datetime).valueOf() - moment(a.activity_datetime).valueOf()
        );

        res.json(sortedActivities);
    } catch (error) {
        console.error('取得活動列表錯誤:', error);
        res.status(500).json({ error: '取得活動列表失敗' });
    }
});

// 取得簽到統計
router.get('/statistics', checkAuth, async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const stats = await personalDatabase.getStatistics({
            startDate,
            endDate,
            department
        });

        res.json(stats);
    } catch (error) {
        console.error('取得統計資料錯誤:', error);
        res.status(500).json({ error: '取得統計資料失敗' });
    }
});

// 檢查授權狀態
router.get('/auth-status', async (req, res) => {
    try {
        const authStatus = await personalGoogleServices.checkAuthStatus();
        res.json(authStatus);
    } catch (error) {
        console.error('檢查授權狀態錯誤:', error);
        res.status(500).json({ error: '檢查授權狀態失敗' });
    }
});

// 診斷環境變數狀態 (僅用於偵錯)
router.get('/debug-env', async (req, res) => {
    try {
        const envStatus = {
            USE_GOOGLE_SERVICES: process.env.USE_GOOGLE_SERVICES,
            USE_PERSONAL_GOOGLE: process.env.USE_PERSONAL_GOOGLE,
            hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            hasGoogleRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
            hasGoogleAccessToken: !!process.env.GOOGLE_ACCESS_TOKEN,
            hasGoogleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
            hasSpreadsheetId: !!process.env.GOOGLE_SPREADSHEET_ID,
            hasDriveFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
            redirectUri: process.env.GOOGLE_REDIRECT_URI
        };
        res.json(envStatus);
    } catch (error) {
        console.error('檢查環境變數錯誤:', error);
        res.status(500).json({ error: '檢查環境變數失敗' });
    }
});

module.exports = router;