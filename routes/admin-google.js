const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const googleDatabase = require('../database/google-database');
const googleServices = require('../services/google-services');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT 驗證中間件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '需要登入權限' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '無效的token' });
        }
        req.user = user;
        next();
    });
};

// 管理員登入
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '請輸入帳號和密碼' });
        }

        await googleDatabase.initialize();
        const admin = await googleDatabase.getAdminByUsername(username);

        if (!admin) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        const token = jwt.sign(
            { username: admin.username, id: admin.id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: '登入成功',
            token,
            user: {
                username: admin.username,
                id: admin.id
            }
        });

    } catch (error) {
        console.error('登入錯誤:', error);
        res.status(500).json({ error: '登入失敗，請稍後再試' });
    }
});

// 取得後台儀表板資料
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        await googleDatabase.initialize();
        
        // 取得統計資料
        const stats = await googleDatabase.getStatistics();
        
        // 取得所有簽到記錄的完整資料
        const allSignins = await googleDatabase.getFullSigninData();

        // 計算部門統計
        const departmentStats = {};
        allSignins.forEach(signin => {
            const dept = signin.department || '未設定';
            departmentStats[dept] = (departmentStats[dept] || 0) + 1;
        });

        // 計算活動類型統計
        const activityTypeStats = {};
        allSignins.forEach(signin => {
            const type = signin.activity_type || '未設定';
            activityTypeStats[type] = (activityTypeStats[type] || 0) + 1;
        });

        res.json({
            totalStats: stats.totalStats,
            departmentStats: Object.entries(departmentStats).map(([name, count]) => ({ name, count })),
            activityTypeStats: Object.entries(activityTypeStats).map(([name, count]) => ({ name, count })),
            allSignins
        });

    } catch (error) {
        console.error('取得儀表板資料錯誤:', error);
        res.status(500).json({ error: '取得儀表板資料失敗' });
    }
});

// 刪除簽到記錄
router.delete('/signins/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await googleDatabase.initialize();
        
        // 取得簽到記錄以獲取照片資訊
        const signin = await googleDatabase.getSigninById(id);
        if (!signin) {
            return res.status(404).json({ error: '找不到該簽到記錄' });
        }

        // 如果有照片，從 Google Drive 刪除
        if (signin.photo_url) {
            try {
                // 從 URL 中提取 file ID
                const match = signin.photo_url.match(/id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    await googleServices.deletePhoto(match[1]);
                    console.log('✅ 已從 Google Drive 刪除照片');
                }
            } catch (photoError) {
                console.warn('⚠️ 刪除照片時發生錯誤:', photoError);
                // 繼續執行，不中斷刪除簽到記錄的流程
            }
        }

        // 刪除簽到記錄
        const deleted = await googleDatabase.deleteSignin(id);
        if (deleted) {
            res.json({ message: '簽到記錄刪除成功' });
        } else {
            res.status(404).json({ error: '找不到該簽到記錄' });
        }

    } catch (error) {
        console.error('刪除簽到記錄錯誤:', error);
        res.status(500).json({ error: '刪除簽到記錄失敗' });
    }
});

// 匯出簽到記錄（CSV格式）
router.get('/export/signins', authenticateToken, async (req, res) => {
    try {
        await googleDatabase.initialize();
        const allSignins = await googleDatabase.getFullSigninData();

        // 準備 CSV 資料
        const csvData = allSignins.map(signin => ({
            '簽到代碼': signin.signin_code,
            '員工編號': signin.employee_id,
            '姓名': signin.name,
            '部門': signin.department,
            '運動項目': signin.activity_type,
            '地點': signin.location,
            '活動日期時間': signin.activity_datetime,
            '照片狀態': signin.photo_path ? '有照片' : '無照片',
            '簽名狀態': signin.signature_data ? '有簽名' : '無簽名'
        }));

        // 產生CSV內容
        const headers = Object.keys(csvData[0] || {});
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => 
                headers.map(header => 
                    `"${String(row[header] || '').replace(/"/g, '""')}"`
                ).join(',')
            )
        ].join('\n');

        // 設定響應標頭
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=signin-records-${timestamp}.csv`);
        
        // 添加UTF-8 BOM以確保Excel正確顯示中文
        res.write('\uFEFF');
        res.end(csvContent);

    } catch (error) {
        console.error('匯出簽到記錄錯誤:', error);
        res.status(500).json({ error: '匯出簽到記錄失敗' });
    }
});

module.exports = router;