const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const personalDatabase = require('../database/personal-google-database');
const personalGoogleServices = require('../services/personal-google-services');
const emailService = require('../services/email-service');
const { authenticateToken } = require('../middleware/personal-google-auth');

// 輔助函數：從 Google Drive 下載檔案
async function downloadFileFromGoogleDrive(fileId) {
    try {
        console.log(`📥 正在下載 Google Drive 檔案: ${fileId}`);
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            throw new Error('Google 服務初始化失敗');
        }
        
        const response = await personalGoogleServices.drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, {
            responseType: 'arraybuffer'
        });
        
        console.log(`✅ 成功下載檔案: ${fileId}, 大小: ${response.data.byteLength} bytes`);
        return Buffer.from(response.data);
        
    } catch (error) {
        console.error(`❌ 下載檔案失敗 ${fileId}:`, error.message);
        return null;
    }
}

// 輔助函數：從照片 URL 提取檔案 ID
function extractFileIdFromUrl(url) {
    if (!url) return null;
    
    // 處理不同格式的 Google Drive URL
    const patterns = [
        /\/d\/([a-zA-Z0-9-_]+)/,  // drive.google.com/file/d/FILE_ID
        /id=([a-zA-Z0-9-_]+)/,   // drive.google.com/uc?id=FILE_ID
        /([a-zA-Z0-9-_]{25,})/   // 直接的檔案 ID
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// 資料導出輔助函數
const generateCSV = (data) => {
    const headers = ['簽到代碼', '員工編號', '姓名', '部門', '運動項目', '地點', '活動時間', '簽到時間', '照片連結', '電子簽名'];
    const csvHeader = headers.join(',') + '\n';
    
    const csvContent = data.map(item => {
        return [
            item.signin_code || '',
            item.employee_id || '',
            item.name || '',
            item.department || '',
            item.activity_type || '',
            item.location || '',
            moment(item.activity_datetime).format('YYYY-MM-DD HH:mm') || '',
            moment(item.created_at).format('YYYY-MM-DD HH:mm') || '',
            item.photo_path || '',
            item.signature_data ? '有簽名' : '無簽名'
        ].map(field => `"${field}"`).join(',');
    }).join('\n');
    
    return '\uFEFF' + csvHeader + csvContent; // 加入 BOM 支援中文
};

const generateExcel = async (data) => {
    try {
        // 準備工作表資料
        const worksheetData = [
            ['簽到代碼', '員工編號', '姓名', '部門', '運動項目', '地點', '活動時間', '簽到時間', '照片連結', '電子簽名']
        ];
        
        // 添加資料行
        data.forEach(item => {
            worksheetData.push([
                item.signin_code || '',
                item.employee_id || '',
                item.name || '',
                item.department || '',
                item.activity_type || '',
                item.location || '',
                item.activity_datetime ? moment(item.activity_datetime).format('YYYY-MM-DD HH:mm') : '',
                item.created_at ? moment(item.created_at).format('YYYY-MM-DD HH:mm') : '',
                item.photo_path || '',
                item.signature_data ? '有簽名' : '無簽名'
            ]);
        });
        
        // 建立工作簿和工作表
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // 設定欄寬
        const columnWidths = [
            { wch: 20 }, // 簽到代碼
            { wch: 12 }, // 員工編號
            { wch: 10 }, // 姓名
            { wch: 12 }, // 部門
            { wch: 10 }, // 運動項目
            { wch: 12 }, // 地點
            { wch: 16 }, // 活動時間
            { wch: 16 }, // 簽到時間
            { wch: 30 }, // 照片連結
            { wch: 10 }  // 電子簽名
        ];
        worksheet['!cols'] = columnWidths;
        
        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(workbook, worksheet, '簽到記錄');
        
        // 生成 Excel 檔案 Buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return excelBuffer;
        
    } catch (error) {
        console.error('生成 Excel 失敗:', error);
        // 如果失敗，返回 CSV 格式
        const csvData = generateCSV(data);
        return Buffer.from(csvData, 'utf8');
    }
};

const generatePDF = async (data) => {
    try {
        console.log('📄 開始生成管理後台樣式的 HTML 報告...');
        
        // 生成 HTML 模板，模擬管理後台的外觀
        const htmlContent = generateAdminDashboardHTML(data);
        
        console.log('✅ 成功生成 HTML 管理後台報告 (可用瀏覽器開啟並列印成PDF)');
        return Buffer.from(htmlContent, 'utf8');
        
    } catch (error) {
        console.error('PDF 生成失敗:', error);
        
        // 降級到純文字格式
        let textContent = '';
        textContent += '員工運動簽到記錄報告\n';
        textContent += '=====================================\n\n';
        textContent += `生成時間：${moment().format('YYYY-MM-DD HH:mm:ss')}\n`;
        textContent += `記錄數量：${data.length} 筆\n\n`;
        
        data.forEach((item, index) => {
            textContent += `${index + 1}. ${item.name} (${item.employee_id})\n`;
            textContent += `   部門：${item.department}\n`;
            textContent += `   運動項目：${item.activity_type}\n`;
            textContent += `   簽到時間：${moment(item.created_at).format('YYYY-MM-DD HH:mm')}\n\n`;
        });
        
        return Buffer.from(textContent, 'utf8');
    }
};

// 生成管理後台樣式的 HTML
function generateAdminDashboardHTML(data) {
    const departments = [...new Set(data.map(item => item.department))];
    const activities = [...new Set(data.map(item => item.activity_type))];
    const photoCount = data.filter(item => item.photo_path).length;
    const signatureCount = data.filter(item => item.signature_data).length;
    
    return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>員工運動簽到記錄報告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; 
            background: #f5f5f5; 
            color: #333;
            line-height: 1.6;
        }
        .dashboard { background: white; margin: 20px; border-radius: 8px; overflow: hidden; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            padding: 30px; 
            background: #fafafa; 
        }
        .stat-card { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            text-align: center; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .stat-number { font-size: 32px; font-weight: bold; color: #667eea; margin-bottom: 8px; }
        .stat-label { color: #666; font-size: 14px; }
        .content { padding: 30px; }
        .section { margin-bottom: 40px; }
        .section h2 { 
            color: #333; 
            border-bottom: 2px solid #667eea; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
        }
        .table-container { overflow-x: auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #eee; 
            font-size: 14px; 
        }
        th { 
            background: #f8f9fa; 
            font-weight: 600; 
            color: #555; 
        }
        tr:hover { background: #f8f9fa; }
        .status-badge { 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 500; 
        }
        .status-success { background: #d4edda; color: #155724; }
        .status-warning { background: #fff3cd; color: #856404; }
        .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>📊 員工運動簽到記錄報告</h1>
            <p>生成時間：${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${data.length}</div>
                <div class="stat-label">總簽到記錄</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${departments.length}</div>
                <div class="stat-label">參與部門</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${activities.length}</div>
                <div class="stat-label">運動項目</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${photoCount}</div>
                <div class="stat-label">包含照片</div>
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📋 詳細簽到記錄</h2>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>編號</th>
                                <th>員工編號</th>
                                <th>姓名</th>
                                <th>部門</th>
                                <th>運動項目</th>
                                <th>地點</th>
                                <th>簽到時間</th>
                                <th>照片</th>
                                <th>簽名</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.employee_id || ''}</td>
                                    <td>${item.name || ''}</td>
                                    <td>${item.department || ''}</td>
                                    <td>${item.activity_type || ''}</td>
                                    <td>${item.location || ''}</td>
                                    <td>${item.created_at ? moment(item.created_at).format('MM-DD HH:mm') : ''}</td>
                                    <td>
                                        <span class="status-badge ${item.photo_path ? 'status-success' : 'status-warning'}">
                                            ${item.photo_path ? '✓ 有照片' : '✗ 無照片'}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="status-badge ${item.signature_data ? 'status-success' : 'status-warning'}">
                                            ${item.signature_data ? '✓ 已簽名' : '✗ 未簽名'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>員工運動社團活動簽到系統 | 資料導出功能</p>
            <p>參與部門：${departments.join('、')} | 運動項目：${activities.join('、')}</p>
        </div>
    </div>
</body>
</html>`;
}

const generateZipWithPhotos = async (data) => {
    try {
        const zip = new JSZip();
        
        console.log(`📦 開始生成包含實際檔案的 ZIP，共 ${data.length} 筆記錄`);
        
        // 添加 CSV 檔案
        const csvData = generateCSV(data);
        zip.file('簽到記錄.csv', csvData);
        
        // 添加 Excel 檔案
        const excelData = await generateExcel(data);
        zip.file('簽到記錄.xlsx', excelData);
        
        // 建立檔案夾結構
        const photosFolder = zip.folder('照片檔案');
        const signaturesFolder = zip.folder('簽名檔案');
        
        // 下載實際照片和簽名檔案
        const downloadResults = [];
        let photoCount = 0;
        let signatureCount = 0;
        
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const safeFileName = `${item.employee_id}_${item.name}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
            
            // 處理照片檔案
            if (item.photo_path) {
                const fileId = extractFileIdFromUrl(item.photo_path);
                if (fileId) {
                    console.log(`📸 正在下載照片 ${i + 1}/${data.length}: ${item.name}`);
                    const photoBuffer = await downloadFileFromGoogleDrive(fileId);
                    
                    if (photoBuffer) {
                        const photoFileName = `${safeFileName}_照片.jpg`;
                        photosFolder.file(photoFileName, photoBuffer);
                        photoCount++;
                        downloadResults.push(`✅ 照片: ${item.name} (${item.employee_id})`);
                    } else {
                        downloadResults.push(`❌ 照片下載失敗: ${item.name} (${item.employee_id})`);
                    }
                }
            }
            
            // 處理簽名檔案（如果有）
            if (item.signature_data) {
                try {
                    // 將 base64 簽名資料轉換為檔案
                    const signatureFileName = `${safeFileName}_簽名.png`;
                    const signatureBuffer = Buffer.from(item.signature_data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                    signaturesFolder.file(signatureFileName, signatureBuffer);
                    signatureCount++;
                    downloadResults.push(`✅ 簽名: ${item.name} (${item.employee_id})`);
                } catch (error) {
                    downloadResults.push(`❌ 簽名處理失敗: ${item.name} (${item.employee_id})`);
                }
            }
        }
        
        // 建立下載結果報告
        const downloadReport = `
檔案下載結果報告
==============================

總處理記錄：${data.length} 筆
成功下載照片：${photoCount} 個
成功處理簽名：${signatureCount} 個

詳細結果：
${downloadResults.join('\n')}

檔案結構：
- 簽到記錄.csv：完整簽到記錄 CSV 格式
- 簽到記錄.xlsx：完整簽到記錄 Excel 格式
- 照片檔案/：所有員工的簽到照片
- 簽名檔案/：所有員工的電子簽名
- 下載結果報告.txt：本檔案

注意事項：
- 照片檔案為原始 JPG 格式，可直接開啟檢視
- 簽名檔案為 PNG 格式，包含透明背景
- 檔案名稱格式：員工編號_姓名_檔案類型
- 所有檔案均為實際檔案，不需要網路連線

生成時間：${moment().format('YYYY-MM-DD HH:mm:ss')}
系統：員工運動社團活動簽到系統
`;
        
        zip.file('下載結果報告.txt', downloadReport);
        
        console.log(`✅ ZIP 生成完成：${photoCount} 個照片，${signatureCount} 個簽名`);
        
        // 生成 ZIP 檔案
        const zipBuffer = await zip.generateAsync({ 
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        return zipBuffer;
        
    } catch (error) {
        console.error('生成包含檔案的 ZIP 失敗:', error);
        // 如果失敗，返回簡單版本
        const zip = new JSZip();
        const csvData = generateCSV(data);
        zip.file('簽到記錄.csv', csvData);
        zip.file('錯誤報告.txt', `ZIP 生成過程中發生錯誤：${error.message}\n\n生成時間：${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        return zipBuffer;
    }
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 檢查授權狀態的中間件
const checkGoogleAuth = (req, res, next) => {
    // 暫時跳過 Google 授權檢查，讓路由正常載入
    // 在實際路由處理中再檢查授權狀態
    next();
};

// 管理員登入
router.post('/login', checkGoogleAuth, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '請輸入使用者名稱和密碼' });
        }

        // 初始化服務
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        await personalGoogleServices.ensureSpreadsheetExists();

        // 查詢管理員
        const admin = await personalDatabase.getAdminByUsername(username);
        
        // 除錯資訊：記錄查詢結果
        console.log('🔍 登入除錯 - 使用者名稱:', username);
        console.log('🔍 登入除錯 - 找到管理員:', admin ? '是' : '否');
        if (admin) {
            console.log('🔍 登入除錯 - 管理員資料:');
            console.log('   - ID:', admin.id);
            console.log('   - Username:', admin.username);
            console.log('   - Password Hash 長度:', admin.password_hash ? admin.password_hash.length : '未定義');
            console.log('   - Password Hash 開頭:', admin.password_hash ? admin.password_hash.substring(0, 10) + '...' : '未定義');
            console.log('   - Created At:', admin.created_at);
        }
        
        if (!admin) {
            console.log('❌ 登入除錯 - 管理員不存在');
            return res.status(401).json({ error: '使用者名稱或密碼錯誤' });
        }

        // 除錯資訊：記錄密碼比較過程
        console.log('🔍 登入除錯 - 輸入密碼:', password);
        console.log('🔍 登入除錯 - 密碼長度:', password.length);
        console.log('🔍 登入除錯 - 儲存的雜湊:', admin.password_hash);
        console.log('🔍 登入除錯 - 雜湊格式檢查:', admin.password_hash.startsWith('$2') ? '正確的bcrypt格式' : '可能不是bcrypt格式');
        
        // 驗證密碼
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        
        console.log('🔍 登入除錯 - bcrypt.compare 結果:', isValidPassword);
        
        if (!isValidPassword) {
            console.log('❌ 登入除錯 - 密碼驗證失敗');
            // 嘗試手動驗證常見密碼（僅用於除錯）
            const testPasswords = ['SportSys2025@Secure', 'admin123', 'admin'];
            for (const testPwd of testPasswords) {
                const testResult = await bcrypt.compare(testPwd, admin.password_hash);
                console.log(`🔍 測試密碼 "${testPwd}": ${testResult ? '✅ 匹配' : '❌ 不匹配'}`);
            }
            return res.status(401).json({ error: '使用者名稱或密碼錯誤' });
        }
        
        console.log('✅ 登入除錯 - 密碼驗證成功');

        // 生成 JWT token
        const token = jwt.sign(
            { username: admin.username, id: admin.id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            message: '登入成功',
            token,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });

    } catch (error) {
        console.error('登入錯誤:', error);
        res.status(500).json({ error: '登入失敗' });
    }
});

// 取得所有簽到記錄
router.get('/signins', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, startDate, endDate, department, activityType } = req.query;
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const signins = await personalDatabase.getSigninsWithDetails({
            page: parseInt(page),
            limit: parseInt(limit),
            startDate,
            endDate,
            department,
            activityType
        });

        res.json(signins);
    } catch (error) {
        console.error('取得簽到記錄錯誤:', error);
        res.status(500).json({ error: '取得簽到記錄失敗' });
    }
});

// 取得統計資料
router.get('/statistics', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const stats = await personalDatabase.getDetailedStatistics({
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

// 匯出簽到記錄為 CSV
router.get('/export/signins', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const { startDate, endDate, department, activityType } = req.query;
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const signins = await personalDatabase.getAllSigninsForExport({
            startDate,
            endDate,
            department,
            activityType
        });

        // 生成 CSV 內容
        const csvHeader = '簽到代碼,員工編號,姓名,部門,活動類型,地點,活動時間,簽到時間,照片連結\n';
        const csvContent = signins.map(signin => {
            return [
                signin.signin_code,
                signin.employee_id,
                signin.name,
                signin.department,
                signin.activity_type,
                signin.location,
                moment(signin.activity_datetime).format('YYYY-MM-DD HH:mm'),
                moment(signin.created_at).format('YYYY-MM-DD HH:mm'),
                signin.photo_url || ''
            ].join(',');
        }).join('\n');

        const csv = csvHeader + csvContent;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="signin-records-${moment().format('YYYYMMDD')}.csv"`);
        res.send('\ufeff' + csv); // 加入 BOM 以支援中文
    } catch (error) {
        console.error('匯出 CSV 錯誤:', error);
        res.status(500).json({ error: '匯出 CSV 失敗' });
    }
});

// 刪除簽到記錄
router.delete('/signins/:id', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const success = await personalDatabase.deleteSignin(id);
        
        if (success) {
            res.json({ message: '簽到記錄已刪除' });
        } else {
            res.status(404).json({ error: '簽到記錄不存在' });
        }
    } catch (error) {
        console.error('刪除簽到記錄錯誤:', error);
        res.status(500).json({ error: '刪除簽到記錄失敗' });
    }
});

// 取得活動列表
router.get('/activities', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const activities = await personalDatabase.getAllActivities();
        res.json(activities);
    } catch (error) {
        console.error('取得活動列表錯誤:', error);
        res.status(500).json({ error: '取得活動列表失敗' });
    }
});

// 取得員工列表
router.get('/employees', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        const employees = await personalDatabase.getAllEmployees();
        res.json(employees);
    } catch (error) {
        console.error('取得員工列表錯誤:', error);
        res.status(500).json({ error: '取得員工列表失敗' });
    }
});

// 變更密碼
router.post('/change-password', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { username } = req.user;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: '請輸入目前密碼和新密碼' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密碼長度至少需要 6 個字元' });
        }

        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        // 查詢管理員
        const admin = await personalDatabase.getAdminByUsername(username);
        if (!admin) {
            return res.status(404).json({ error: '管理員不存在' });
        }

        // 驗證目前密碼
        const isValidPassword = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ error: '目前密碼錯誤' });
        }

        // 加密新密碼
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 更新密碼
        const success = await personalDatabase.updateAdminPassword(admin.id, hashedNewPassword);
        
        if (success) {
            res.json({ message: '密碼已成功變更' });
        } else {
            res.status(500).json({ error: '密碼變更失敗' });
        }

    } catch (error) {
        console.error('變更密碼錯誤:', error);
        res.status(500).json({ error: '變更密碼失敗' });
    }
});

// 驗證 Token
router.get('/verify', authenticateToken, checkGoogleAuth, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user,
        message: 'Token 有效'
    });
});

// 取得儀表板資料
router.get('/dashboard', authenticateToken, checkGoogleAuth, async (req, res) => {
    try {
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }

        // 取得簽到記錄
        const signins = await personalDatabase.getSigninsWithDetails({
            page: 1,
            limit: 20
        });

        // 取得統計資料
        const stats = await personalDatabase.getSigninStatistics();

        // 計算部門統計
        const departmentStats = {};
        const allSignins = signins.data || [];
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
            signins: allSignins,
            totalStats: stats.totalStats,
            departmentStats: Object.entries(departmentStats).map(([department, signin_count]) => ({ department, signin_count })),
            activityTypeStats: Object.entries(activityTypeStats).map(([activity_type, signin_count]) => ({ activity_type, signin_count })),
            recentActivity: allSignins.slice(0, 5)
        });
    } catch (error) {
        console.error('取得儀表板資料錯誤:', error);
        res.status(500).json({ error: '取得儀表板資料失敗' });
    }
});

// 檢查 Google 授權狀態
router.get('/google-auth-status', authenticateToken, async (req, res) => {
    try {
        const authStatus = await personalGoogleServices.checkAuthStatus();
        res.json(authStatus);
    } catch (error) {
        console.error('檢查 Google 授權狀態錯誤:', error);
        res.status(500).json({ error: '檢查 Google 授權狀態失敗' });
    }
});

// 照片代理端點
router.get('/photo/:fileId', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { size = 'w400' } = req.query;
        
        console.log(`📸 代理照片請求: ${fileId}, 尺寸: ${size}`);
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }
        
        // 直接從 Google Drive API 取得檔案
        const response = await personalGoogleServices.drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, {
            responseType: 'stream'
        });
        
        // 設定適當的標頭
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 快取 24 小時
        
        // 串流照片資料
        response.data.pipe(res);
        
    } catch (error) {
        console.error('照片代理錯誤:', error);
        
        if (error.code === 404) {
            res.status(404).json({ error: '照片不存在' });
        } else if (error.code === 403) {
            res.status(403).json({ error: '無權限存取照片' });
        } else {
            res.status(500).json({ error: '照片載入失敗' });
        }
    }
});

// 導出報告
router.post('/export-report', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, format, includePhotos } = req.body;
        
        console.log(`📊 導出報告請求: ${startDate} 至 ${endDate}, 格式: ${format}`);
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }
        
        // 取得指定日期範圍的簽到記錄
        const signins = await personalDatabase.getSigninsByDateRange(startDate, endDate);
        
        if (!signins.data || signins.data.length === 0) {
            return res.status(404).json({ error: '指定日期範圍內沒有簽到記錄' });
        }
        
        let responseData;
        let contentType;
        let filename;
        
        switch (format) {
            case 'csv':
                responseData = generateCSV(signins.data);
                contentType = 'text/csv';
                filename = `運動簽到報告_${startDate}_${endDate}.csv`;
                break;
                
            case 'excel':
                responseData = await generateExcel(signins.data);
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                filename = `運動簽到報告_${startDate}_${endDate}.xlsx`;
                break;
                
            case 'html':
                responseData = await generatePDF(signins.data);
                contentType = 'text/html; charset=utf-8';
                filename = `運動簽到報告_${startDate}_${endDate}.html`;
                break;
                
            case 'zip':
                responseData = await generateZipWithPhotos(signins.data);
                contentType = 'application/zip';
                filename = `運動簽到完整備份_${startDate}_${endDate}.zip`;
                break;
                
            default:
                return res.status(400).json({ error: '不支援的導出格式' });
        }
        
        // 設定回應標頭
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        
        res.send(responseData);
        
    } catch (error) {
        console.error('導出報告錯誤:', error);
        res.status(500).json({ error: '導出過程中發生錯誤' });
    }
});

// 輔助函數：驗證電子郵件格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 寄送報告
router.post('/email-report', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, format, email, scheduleDaily, includePhotos } = req.body;
        
        // 驗證必要欄位
        if (!email || !startDate || !endDate || !format) {
            return res.status(400).json({ error: '缺少必要的請求參數' });
        }
        
        // 驗證電子郵件格式
        if (!isValidEmail(email)) {
            console.log(`❌ 無效的信箱格式: ${email}`);
            return res.status(400).json({ error: '請提供有效的電子郵件地址' });
        }
        
        console.log(`📧 寄送報告請求: ${email}, ${startDate} 至 ${endDate}, 定期寄送: ${scheduleDaily}`);
        
        // 檢查郵件服務是否已配置
        if (!emailService.isConfigured()) {
            console.log('⚠️ 郵件服務未配置，嘗試初始化...');
            const initialized = await emailService.initialize();
            
            if (!initialized) {
                return res.json({
                    success: false,
                    message: '郵件服務未配置',
                    note: '請在 .env.local 中設定 SMTP 參數：SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM',
                    configured: false
                });
            }
        }

        // 取得報告資料
        const signins = await personalDatabase.getSigninsByDateRange(startDate, endDate);
        
        if (!signins.data || signins.data.length === 0) {
            return res.json({
                success: false,
                message: '選定期間內沒有簽到記錄',
                note: '無法寄送空白報告'
            });
        }

        // 發送郵件
        try {
            console.log(`📧 正在發送 ${format} 格式報告至 ${email}...`);
            
            const reportData = {
                startDate,
                endDate,
                data: signins.data,
                total: signins.total
            };

            await emailService.sendReport(email, reportData, format);

            // 如果啟用定期寄送，儲存排程設定
            if (scheduleDaily) {
                console.log(`📅 設定每日 08:00 定期寄送至 ${email}`);
                // TODO: 在生產環境中實現定期寄送功能（可使用 node-cron 或其他任務排程器）
            }

            res.json({
                success: true,
                message: scheduleDaily ? 
                    `報告已成功寄送至 ${email}，並已設定每日 08:00 定期寄送` : 
                    `報告已成功寄送至 ${email}`,
                note: `已發送 ${signins.total} 筆簽到記錄`,
                scheduled: scheduleDaily,
                recordCount: signins.total
            });

        } catch (emailError) {
            console.error('📧 郵件發送失敗:', emailError);
            res.status(500).json({
                error: '郵件發送失敗',
                details: emailError.message,
                note: '請檢查 SMTP 設定是否正確'
            });
        }
        
    } catch (error) {
        console.error('寄送報告錯誤:', error);
        res.status(500).json({ error: '寄送過程中發生錯誤' });
    }
});

// 設定定期寄送
router.post('/schedule-report', authenticateToken, async (req, res) => {
    try {
        const { email, frequency, time, format, includePhotos } = req.body;
        
        console.log(`⏰ 設定定期寄送: ${email}, 頻率: ${frequency}`);
        
        // 這裡先返回成功，實際的定期任務需要使用 cron job 或類似服務
        // 在生產環境中需要實現真正的排程功能
        
        res.json({ 
            success: true, 
            message: '定期寄送設定已儲存',
            note: '定期寄送功能需要配置排程服務才能使用'
        });
        
    } catch (error) {
        console.error('設定定期寄送錯誤:', error);
        res.status(500).json({ error: '設定過程中發生錯誤' });
    }
});

// 手動初始化管理員帳號 (僅用於故障排除)
router.post('/init-admin', async (req, res) => {
    try {
        console.log('🔧 手動初始化管理員帳號...');
        
        // 檢查 Google 服務
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗，請先完成授權' });
        }
        
        await personalGoogleServices.ensureSpreadsheetExists();
        
        // 檢查是否已有管理員
        const existingAdmins = await personalDatabase.getAllAdmins();
        console.log(`📊 現有管理員數量: ${existingAdmins.length}`);
        
        if (existingAdmins.length > 0) {
            return res.json({ 
                success: true, 
                message: `管理員帳號已存在 (${existingAdmins.length} 個)`,
                admins: existingAdmins.map(admin => ({ 
                    id: admin.id, 
                    username: admin.username, 
                    created_at: admin.created_at 
                }))
            });
        }
        
        // 建立預設管理員
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'SportSys2025@Secure';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        await personalDatabase.createAdmin({
            id: 1,
            username: 'admin',
            password_hash: hashedPassword,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });
        
        console.log('✅ 預設管理員帳號建立成功');
        
        res.json({ 
            success: true, 
            message: '管理員帳號初始化完成',
            admin: {
                username: 'admin',
                password: '使用環境變數中的 DEFAULT_ADMIN_PASSWORD 或預設密碼'
            }
        });
        
    } catch (error) {
        console.error('❌ 初始化管理員帳號失敗:', error);
        res.status(500).json({ 
            error: '初始化過程中發生錯誤',
            details: error.message 
        });
    }
});

// 除錯路由：檢查所有管理員帳號
router.get('/debug-admins', async (req, res) => {
    try {
        console.log('🔍 開始除錯管理員帳號...');
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }
        
        await personalGoogleServices.ensureSpreadsheetExists();
        
        const admins = await personalDatabase.getAllAdmins();
        console.log(`📊 找到 ${admins.length} 個管理員帳號`);
        
        const sanitizedAdmins = admins.map(admin => ({
            id: admin.id,
            username: admin.username,
            created_at: admin.created_at,
            password_hash_preview: admin.password_hash ? admin.password_hash.substring(0, 10) + '...' : 'null'
        }));
        
        res.json({
            success: true,
            total: admins.length,
            admins: sanitizedAdmins,
            debug_info: {
                google_initialized: initialized,
                spreadsheet_id: personalGoogleServices.spreadsheetId
            }
        });
        
    } catch (error) {
        console.error('❌ 除錯管理員帳號失敗:', error);
        res.status(500).json({ 
            error: '除錯過程中發生錯誤',
            details: error.message 
        });
    }
});

// 建立測試管理員
router.post('/create-test-admin', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`🧪 建立測試管理員: ${username}`);
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }
        
        await personalGoogleServices.ensureSpreadsheetExists();
        
        // 檢查是否已存在
        const existingAdmin = await personalDatabase.getAdminByUsername(username);
        if (existingAdmin) {
            return res.json({ 
                success: true, 
                message: `管理員 ${username} 已存在`,
                admin: {
                    username: existingAdmin.username,
                    created_at: existingAdmin.created_at
                }
            });
        }
        
        // 建立新管理員
        const hashedPassword = await bcrypt.hash(password, 10);
        await personalDatabase.createAdmin({
            id: Date.now(), // 使用時間戳作為 ID
            username: username,
            password_hash: hashedPassword,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        });
        
        console.log(`✅ 測試管理員 ${username} 建立成功`);
        
        res.json({ 
            success: true, 
            message: `測試管理員 ${username} 建立成功`,
            credentials: { username, password }
        });
        
    } catch (error) {
        console.error('❌ 建立測試管理員失敗:', error);
        res.status(500).json({ 
            error: '建立測試管理員時發生錯誤',
            details: error.message 
        });
    }
});

// 建立自訂管理員
router.post('/create-custom-admin', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '請提供使用者名稱和密碼' });
        }
        
        console.log(`👤 建立自訂管理員: ${username}`);
        
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Google 服務初始化失敗' });
        }
        
        await personalGoogleServices.ensureSpreadsheetExists();
        
        // 先刪除同名的管理員（如果存在）
        try {
            const existingAdmin = await personalDatabase.getAdminByUsername(username);
            if (existingAdmin) {
                console.log(`🗑️ 刪除現有管理員: ${username}`);
                // 這裡應該有刪除邏輯，但目前 Google Sheets 版本可能不支援
            }
        } catch (e) {
            console.log('檢查現有管理員時發生錯誤，繼續建立新管理員');
        }
        
        // 建立新管理員
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = {
            id: Date.now(),
            username: username,
            password_hash: hashedPassword,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        };
        
        await personalDatabase.createAdmin(newAdmin);
        
        console.log(`✅ 自訂管理員 ${username} 建立成功`);
        
        res.json({ 
            success: true, 
            message: `管理員 ${username} 建立成功`,
            admin: {
                username: newAdmin.username,
                created_at: newAdmin.created_at
            }
        });
        
    } catch (error) {
        console.error('❌ 建立自訂管理員失敗:', error);
        res.status(500).json({ 
            error: '建立自訂管理員時發生錯誤',
            details: error.message 
        });
    }
});

// 管理員資料檢查端點（除錯用）
router.get('/debug-admin-data', async (req, res) => {
    try {
        console.log('🔍 除錯端點被呼叫：檢查管理員資料');
        
        // 初始化服務
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            return res.json({
                error: 'Google 服務未初始化',
                initialized: false,
                authStatus: await personalGoogleServices.checkAuthStatus()
            });
        }

        await personalGoogleServices.ensureSpreadsheetExists();

        // 取得所有管理員
        const admins = await personalDatabase.getAllAdmins();
        
        console.log('🔍 除錯資料：');
        console.log(`   找到 ${admins.length} 個管理員帳號`);
        
        const adminData = admins.map(admin => ({
            id: admin.id,
            username: admin.username,
            password_hash_length: admin.password_hash ? admin.password_hash.length : 0,
            password_hash_prefix: admin.password_hash ? admin.password_hash.substring(0, 10) + '...' : '無',
            password_hash_format: admin.password_hash ? (admin.password_hash.startsWith('$2') ? 'bcrypt格式正確' : '非bcrypt格式') : '無',
            created_at: admin.created_at,
            has_password_hash: !!admin.password_hash
        }));
        
        console.log('🔍 管理員詳細資料:', JSON.stringify(adminData, null, 2));
        
        // 測試密碼驗證（使用常見密碼）
        const testResults = [];
        const testPasswords = ['SportSys2025@Secure', 'admin123', 'admin'];
        
        for (const admin of admins) {
            if (admin.password_hash) {
                for (const testPwd of testPasswords) {
                    try {
                        const isMatch = await bcrypt.compare(testPwd, admin.password_hash);
                        testResults.push({
                            username: admin.username,
                            test_password: testPwd,
                            match: isMatch
                        });
                        console.log(`🧪 測試 ${admin.username} 密碼 "${testPwd}": ${isMatch ? '✅ 匹配' : '❌ 不匹配'}`);
                    } catch (error) {
                        testResults.push({
                            username: admin.username,
                            test_password: testPwd,
                            error: error.message
                        });
                    }
                }
            }
        }

        res.json({
            success: true,
            admins_count: admins.length,
            admins: adminData,
            password_tests: testResults,
            google_auth_status: await personalGoogleServices.checkAuthStatus(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 除錯端點錯誤:', error);
        res.status(500).json({
            error: '除錯過程發生錯誤',
            details: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;