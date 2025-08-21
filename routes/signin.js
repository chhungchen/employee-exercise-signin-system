const express = require('express');
const router = express.Router();
const db = require('../database/database'); // Now using the Google Sheets database module
const moment = require('moment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 設定照片上傳 (這部分保持不變，因為我們需要先將檔案暫存到本地)
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
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案'));
        }
    }
});

// 員工簽到 (已重構為使用 Google Sheets API)
router.post('/signin', upload.single('photo'), async (req, res) => {
    try {
        // 1. 驗證輸入
        if (!req.body.data) {
            return res.status(400).json({ error: '缺少簽到資料' });
        }
        if (!req.file) {
            return res.status(400).json({ error: '請上傳照片作為簽到證明' });
        }

        const signinData = JSON.parse(req.body.data);
        const {
            employeeId,
            name,
            department,
            activityType,
            location,
            activityDateTime,
            signatureData
        } = signinData;

        if (!employeeId || !name || !department || !activityType || !location || !activityDateTime) {
            return res.status(400).json({ error: '請填寫所有必填欄位' });
        }

        // 2. 上傳照片到 Google Drive
        const photoUrl = await db.uploadPhoto(req.file);
        if (!photoUrl) {
            throw new Error('照片上傳失敗，無法取得 URL');
        }

        // 3. 尋找或建立員工
        let employee = await db.getEmployeeById(employeeId);
        if (!employee) {
            employee = await db.createEmployee({
                employee_id: employeeId,
                name: name,
                department: department
            });
        }

        // 4. 尋找或建立活動
        let activity = await db.getActivityByDetails(activityType, location, activityDateTime);
        if (!activity) {
            const activityCode = `ACT-${Date.now()}`;
            activity = await db.createActivity({
                activity_code: activityCode,
                activity_type: activityType,
                location: location,
                activity_datetime: activityDateTime
            });
        }

        // 5. 檢查是否已經簽到過
        const existingSignin = await db.getSigninByEmployeeAndActivity(employee.employee_id, activity.id);
        if (existingSignin) {
            return res.status(400).json({ error: '您已經對此活動簽到過了' });
        }

        // 6. 建立簽到記錄
        const signinCode = `SIGN-${Date.now()}`;
        const newSignin = await db.createSignin({
            signin_code: signinCode,
            employee_id: employee.employee_id,
            activity_id: activity.id,
            signin_type: '準時簽到',
            notes: '',
            photo_url: photoUrl, // 使用 Google Drive 的 URL
            signature_data: signatureData || ''
        });

        // 7. 回傳成功訊息
        res.json({
            message: '簽到成功！資料已寫入 Google Sheets。',
            signinCode: newSignin.signin_code,
            name: employee.name,
            signinTime: newSignin.signin_time,
            activity: {
                type: activity.activity_type,
                location: activity.location,
                dateTime: moment(activity.activity_datetime).format('YYYY-MM-DD HH:mm')
            },
            photoUrl: photoUrl
        });

    } catch (error) {
        console.error('簽到錯誤:', error);
        res.status(500).json({ error: '簽到失敗，伺服器內部錯誤' });
    }
});

// TODO: 下一步需重構以下路由，使其也從 Google Sheets 讀取資料
// 取得活動列表 (仍在使用舊的 SQLite 邏輯)
router.get('/activities', async (req, res) => {
    try {
        const activities = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM activities ORDER BY activity_datetime DESC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        res.json(activities);
    } catch (error) {
        console.error('取得活動列表錯誤:', error);
        res.status(500).json({ error: '取得活動列表失敗' });
    }
});

// 取得簽到統計 (仍在使用舊的 SQLite 邏輯)
router.get('/statistics', async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        let whereClause = 'WHERE 1=1';
        let params = [];

        if (startDate && endDate) {
            whereClause += ' AND DATE(a.activity_datetime) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (department) {
            whereClause += ' AND e.department = ?';
            params.push(department);
        }

        const statistics = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    a.activity_type,
                    a.location,
                    a.activity_datetime,
                    s.employee_id,
                    e.name,
                    e.department,
                    COUNT(s.id) as signin_count,
                    GROUP_CONCAT(e.name) as participants
                FROM activities a
                LEFT JOIN signins s ON a.id = s.activity_id
                LEFT JOIN employees e ON s.employee_id = e.employee_id
                ${whereClause}
                GROUP BY a.id, s.employee_id
                ORDER BY a.activity_datetime DESC
            `, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(statistics);
    } catch (error) {
        console.error('取得統計資料錯誤:', error);
        res.status(500).json({ error: '取得統計資料失敗' });
    }
});

module.exports = router;