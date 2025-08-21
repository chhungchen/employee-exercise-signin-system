const express = require('express');
const router = express.Router();
const multer = require('multer');
const moment = require('moment');
const googleDatabase = require('../database/google-database');
const googleServices = require('../services/google-services');

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
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案'), false);
        }
    }
});

// 壓縮圖片函數
function compressImage(buffer, quality = 0.8) {
    // 這裡可以使用 sharp 或其他圖片處理庫來壓縮
    // 暫時直接回傳原 buffer
    return buffer;
}

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
        // 初始化 Google Database
        await googleDatabase.initialize();

        // 檢查員工是否存在，不存在則新增
        let employee = await googleDatabase.getEmployeeById(employeeId);
        if (!employee) {
            employee = await googleDatabase.createEmployee({
                employee_id: employeeId,
                name: name,
                department: department
            });
        }

        // 檢查活動是否已存在，不存在則新增
        let activity = await googleDatabase.getActivityByDetails(activityType, location, activityDateTime);
        if (!activity) {
            const activityCode = generateUniqueCode('ACT');
            activity = await googleDatabase.createActivity({
                activity_code: activityCode,
                activity_type: activityType,
                location: location,
                activity_datetime: activityDateTime
            });
        }

        // 檢查是否已經簽到過
        const existingSignin = await googleDatabase.getSigninByEmployeeAndActivity(employeeId, activity.id);
        if (existingSignin) {
            return res.status(400).json({ error: '您已經簽到過了' });
        }

        // 上傳照片到 Google Drive
        let photoUrl = null;
        if (req.file) {
            try {
                // 壓縮圖片
                const compressedBuffer = compressImage(req.file.buffer);
                
                // 生成檔名
                const timestamp = Date.now();
                const ext = req.file.originalname.split('.').pop();
                const fileName = `signin_${employeeId}_${timestamp}.${ext}`;

                // 上傳到 Google Drive
                const driveFile = await googleServices.uploadPhoto(
                    compressedBuffer,
                    fileName,
                    req.file.mimetype
                );

                // 使用可直接存取的連結
                photoUrl = `https://drive.google.com/uc?id=${driveFile.id}`;
                
                console.log(`✅ 照片已上傳到 Google Drive: ${fileName}`);
            } catch (uploadError) {
                console.error('照片上傳失敗:', uploadError);
                return res.status(500).json({ error: '照片上傳失敗，請稍後再試' });
            }
        }

        // 建立簽到記錄
        const signinCode = generateUniqueCode('SIGN');
        const newSignin = await googleDatabase.createSignin({
            signin_code: signinCode,
            employee_id: employeeId,
            activity_id: activity.id,
            signin_type: '準時簽到',
            notes: '',
            photo_url: photoUrl,
            signature_data: signatureData || ''
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
        res.status(500).json({ error: '簽到失敗，請稍後再試' });
    }
});

// 取得活動列表
router.get('/activities', async (req, res) => {
    try {
        await googleDatabase.initialize();
        const activities = await googleDatabase.getAllActivities();
        
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
router.get('/statistics', async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        await googleDatabase.initialize();
        const stats = await googleDatabase.getStatistics({
            startDate,
            endDate,
            department
        });

        // 處理統計資料，組合員工和活動資訊
        const statistics = stats.filteredSignins.map(signin => {
            const employee = stats.employees.find(e => e.employee_id === signin.employee_id);
            const activity = stats.activities.find(a => a.id == signin.activity_id);

            return {
                activity_type: activity?.activity_type || '',
                location: activity?.location || '',
                activity_datetime: activity?.activity_datetime || '',
                employee_id: signin.employee_id,
                name: employee?.name || '',
                department: employee?.department || '',
                signin_count: 1,
                participants: employee?.name || ''
            };
        });

        res.json(statistics);
    } catch (error) {
        console.error('取得統計資料錯誤:', error);
        res.status(500).json({ error: '取得統計資料失敗' });
    }
});

module.exports = router;