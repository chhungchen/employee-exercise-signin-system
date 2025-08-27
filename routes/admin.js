const express = require('express');
const router = express.Router();
const { db } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

// 管理員登入
router.post('/login', require('../middleware/auth').authenticateAdmin);

// 取得後台儀表板資料
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        // 取得總統計資料
        const totalStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM employees) as total_employees,
                    (SELECT COUNT(*) FROM activities) as total_activities,
                    (SELECT COUNT(*) FROM signins) as total_signins
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 取得部門統計
        const departmentStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    e.department,
                    COUNT(DISTINCT e.id) as employee_count,
                    COUNT(s.id) as signin_count
                FROM employees e
                LEFT JOIN signins s ON e.employee_id = s.employee_id
                GROUP BY e.department
                ORDER BY signin_count DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 取得運動項目統計
        const activityTypeStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    a.activity_type,
                    COUNT(DISTINCT a.id) as activity_count,
                    COUNT(s.id) as signin_count
                FROM activities a
                LEFT JOIN signins s ON a.id = s.activity_id
                GROUP BY a.activity_type
                ORDER BY signin_count DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 取得所有簽到記錄
        const allSignins = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    s.id,
                    s.signin_code,
                    s.employee_id,
                    e.name,
                    e.department,
                    a.id as activity_id,
                    a.activity_type,
                    a.location,
                    a.activity_datetime,
                    s.notes,
                    s.photo_path,
                    s.signature_data
                FROM signins s
                JOIN employees e ON s.employee_id = e.employee_id
                JOIN activities a ON s.activity_id = a.id
                ORDER BY a.activity_datetime DESC, s.id DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            totalStats,
            departmentStats,
            activityTypeStats,
            allSignins
        });

    } catch (error) {
        console.error('取得儀表板資料錯誤:', error);
        res.status(500).json({ error: '取得儀表板資料失敗' });
    }
});

// 取得員工列表
router.get('/employees', authenticateToken, async (req, res) => {
    try {
        const employees = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    e.*,
                    COUNT(s.id) as signin_count
                FROM employees e
                LEFT JOIN signins s ON e.employee_id = s.employee_id
                GROUP BY e.id
                ORDER BY e.created_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(employees);
    } catch (error) {
        console.error('取得員工列表錯誤:', error);
        res.status(500).json({ error: '取得員工列表失敗' });
    }
});

// 新增員工
router.post('/employees', authenticateToken, async (req, res) => {
    const { employeeId, name, department } = req.body;

    if (!employeeId || !name || !department) {
        return res.status(400).json({ error: '請填寫所有必填欄位' });
    }

    try {
        // 檢查員工編號是否已存在
        const existingEmployee = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM employees WHERE employee_id = ?',
                [employeeId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existingEmployee) {
            return res.status(400).json({ error: '員工編號已存在' });
        }

        // 新增員工
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO employees (employee_id, name, department) VALUES (?, ?, ?)',
                [employeeId, name, department],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        res.json({
            message: '員工新增成功',
            id: result
        });

    } catch (error) {
        console.error('新增員工錯誤:', error);
        res.status(500).json({ error: '新增員工失敗' });
    }
});

// 取得活動列表（管理員版）
router.get('/activities', authenticateToken, async (req, res) => {
    try {
        const activities = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    a.*,
                    COUNT(s.id) as signin_count,
                    GROUP_CONCAT(e.name) as participants
                FROM activities a
                LEFT JOIN signins s ON a.id = s.activity_id
                LEFT JOIN employees e ON s.employee_id = e.employee_id
                GROUP BY a.id
                ORDER BY a.activity_datetime DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(activities);
    } catch (error) {
        console.error('取得活動列表錯誤:', error);
        res.status(500).json({ error: '取得活動列表失敗' });
    }
});

// 刪除活動
router.delete('/activities/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        // 先刪除相關的簽到記錄
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM signins WHERE activity_id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 刪除活動
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM activities WHERE id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ message: '活動刪除成功' });

    } catch (error) {
        console.error('刪除活動錯誤:', error);
        res.status(500).json({ error: '刪除活動失敗' });
    }
});

// 修改簽到記錄
router.put('/signins/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { employee_id, name, department, activity_id, activity_type, location, activity_datetime, notes } = req.body;

        // 更新員工資料
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE employees 
                SET name = ?, department = ? 
                WHERE employee_id = ?
            `, [name, department, employee_id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        // 更新活動資料
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE activities 
                SET activity_type = ?, location = ?, activity_datetime = ? 
                WHERE id = ?
            `, [activity_type, location, activity_datetime, activity_id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        // 更新簽到記錄
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE signins 
                SET notes = ? 
                WHERE id = ?
            `, [notes, id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        res.json({ message: '簽到記錄修改成功' });

    } catch (error) {
        console.error('修改簽到記錄錯誤:', error);
        res.status(500).json({ error: '修改簽到記錄失敗' });
    }
});

// 匯出簽到記錄（CSV格式）
router.get('/export/signins', authenticateToken, async (req, res) => {
    try {
        const signins = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    s.signin_code as '簽到代碼',
                    s.employee_id as '員工編號',
                    e.name as '姓名',
                    e.department as '部門',
                    a.activity_type as '運動項目',
                    a.location as '地點',
                    a.activity_datetime as '活動日期時間',
                    CASE WHEN s.photo_path IS NOT NULL THEN '有照片' ELSE '無照片' END as '照片狀態',
                    CASE WHEN s.signature_data IS NOT NULL THEN '有簽名' ELSE '無簽名' END as '簽名狀態'
                FROM signins s
                JOIN employees e ON s.employee_id = e.employee_id
                JOIN activities a ON s.activity_id = a.id
                ORDER BY a.activity_datetime DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 產生CSV內容
        const headers = Object.keys(signins[0] || {});
        const csvContent = [
            headers.join(','),
            ...signins.map(row => 
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

// 刪除簽到記錄
router.delete('/signins/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 先取得簽到記錄以便刪除相關照片檔案
        const signin = await new Promise((resolve, reject) => {
            db.get('SELECT photo_path FROM signins WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!signin) {
            return res.status(404).json({ error: '簽到記錄不存在' });
        }

        // 刪除簽到記錄
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM signins WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        // 嘗試刪除照片檔案（如果存在）
        if (signin.photo_path) {
            const fs = require('fs');
            const path = require('path');
            const photoPath = path.join(__dirname, '..', signin.photo_path);
            try {
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            } catch (fileError) {
                console.warn('無法刪除照片檔案:', fileError.message);
            }
        }

        res.json({ message: '簽到記錄刪除成功' });

    } catch (error) {
        console.error('刪除簽到記錄錯誤:', error);
        res.status(500).json({ error: '刪除簽到記錄失敗' });
    }
});

module.exports = router; 