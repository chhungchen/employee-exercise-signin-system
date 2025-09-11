const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const personalGoogleServices = require('./personal-google-services');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
    }

    // 初始化郵件服務
    async initialize() {
        console.log('🔧 初始化郵件服務...');
        
        // 取得 SMTP 配置
        const smtpConfig = this.getSMTPConfig();
        if (!smtpConfig) {
            return false;
        }

        // 嘗試建立連線，最多重試 3 次
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 嘗試連線到 SMTP 伺服器 (第 ${attempt}/${maxRetries} 次): ${smtpConfig.host}:${smtpConfig.port}`);
                
                // 建立 SMTP 傳輸器配置
                const transportConfig = {
                    host: smtpConfig.host,
                    port: parseInt(smtpConfig.port),
                    secure: smtpConfig.port == 465, // true for 465, false for other ports
                    tls: {
                        rejectUnauthorized: false // 接受自簽憑證
                    },
                    // 連線超時設定
                    connectionTimeout: 15000, // 15 秒連線超時
                    greetingTimeout: 10000,   // 10 秒問候超時
                    socketTimeout: 30000,     // 30 秒 socket 超時
                    // 連線池設定
                    pool: true,
                    maxConnections: 5,
                    maxMessages: 100,
                    // 調試模式 (開發環境)
                    debug: process.env.NODE_ENV === 'development'
                };

                // 只有需要認證時才加入 auth 設定
                if (smtpConfig.requiresAuth && smtpConfig.user && smtpConfig.pass) {
                    transportConfig.auth = {
                        user: smtpConfig.user,
                        pass: smtpConfig.pass
                    };
                }

                this.transporter = nodemailer.createTransport(transportConfig);

                // 驗證連線，設定超時
                const verifyPromise = this.transporter.verify();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('SMTP 驗證超時')), 20000);
                });
                
                await Promise.race([verifyPromise, timeoutPromise]);
                
                this.initialized = true;
                console.log(`✅ 郵件服務初始化成功 (${smtpConfig.host}:${smtpConfig.port})`);
                console.log(`📧 寄件者: ${smtpConfig.from}`);
                return true;

            } catch (error) {
                console.error(`❌ 第 ${attempt} 次連線失敗:`, error.message);
                
                // 提供詳細的錯誤診斷
                this.diagnoseError(error, smtpConfig);
                
                // 最後一次重試失敗
                if (attempt === maxRetries) {
                    console.error('💀 所有重試都失敗，郵件服務初始化失敗');
                    return false;
                }
                
                // 等待後重試
                const retryDelay = attempt * 2000; // 遞增延遲: 2s, 4s
                console.log(`⏳ ${retryDelay/1000} 秒後重試...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
        return false;
    }

    // 取得 SMTP 配置
    getSMTPConfig() {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT || 587;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;

        // 檢查必要配置
        if (!smtpHost) {
            console.error('❌ 缺少 SMTP_HOST 環境變數');
            this.showConfigurationHelp();
            return null;
        }

        if (!smtpUser || !smtpPass) {
            // 檢查是否為匿名 SMTP（公司內部）
            if (smtpHost.includes('jih-sun.com.tw') && smtpPort == 25) {
                console.log('🏢 偵測到公司內部 SMTP，使用匿名認證模式');
                return {
                    host: smtpHost,
                    port: smtpPort,
                    user: '',
                    pass: '',
                    from: emailFrom,
                    requiresAuth: false
                };
            } else {
                console.error('❌ 缺少 SMTP 認證資訊 (SMTP_USER/SMTP_PASS)');
                this.showConfigurationHelp();
                return null;
            }
        }

        return {
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            pass: smtpPass,
            from: emailFrom,
            requiresAuth: true
        };
    }

    // 錯誤診斷
    diagnoseError(error, config) {
        const errorCode = error.code || error.errno;
        const errorMessage = error.message || '';

        console.log('🔍 錯誤診斷:');
        console.log(`   錯誤代碼: ${errorCode}`);
        console.log(`   錯誤訊息: ${errorMessage}`);
        console.log(`   SMTP 主機: ${config.host}:${config.port}`);

        if (errorCode === 'EAUTH') {
            console.log('💡 認證失敗 - 可能原因:');
            console.log('   - Gmail 應用程式密碼錯誤或過期');
            console.log('   - 帳號未啟用兩步驟驗證');
            console.log('   - 使用一般密碼而非應用程式密碼');
        } else if (errorCode === 'ECONNREFUSED') {
            console.log('💡 連線被拒絕 - 可能原因:');
            console.log('   - SMTP 主機或連接埠錯誤');
            console.log('   - 防火牆阻擋連線');
            console.log('   - SMTP 服務未啟動');
        } else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
            console.log('💡 連線超時 - 可能原因:');
            console.log('   - 網路連線不穩定');
            console.log('   - SMTP 伺服器回應緩慢');
            console.log('   - 雲端環境無法存取內部網路');
            if (config.host.includes('jih-sun.com.tw')) {
                console.log('   ⚠️ 公司內部 SMTP 無法從雲端環境存取');
                console.log('   💡 建議: 在生產環境使用 Gmail SMTP');
            }
        } else if (errorCode === 'ENOTFOUND') {
            console.log('💡 DNS 解析失敗 - 可能原因:');
            console.log('   - SMTP 主機名稱錯誤');
            console.log('   - DNS 伺服器無法解析主機名稱');
        }
    }

    // 顯示配置說明
    showConfigurationHelp() {
        console.log('💡 SMTP 配置說明:');
        console.log('');
        console.log('📧 Gmail SMTP (建議用於生產環境):');
        console.log('   SMTP_HOST=smtp.gmail.com');
        console.log('   SMTP_PORT=587');
        console.log('   SMTP_USER=your-email@gmail.com');
        console.log('   SMTP_PASS=your-16-digit-app-password');
        console.log('   EMAIL_FROM=your-email@gmail.com');
        console.log('');
        console.log('🏢 公司內部 SMTP (僅限本地環境):');
        console.log('   SMTP_HOST=ex2016.jih-sun.com.tw');
        console.log('   SMTP_PORT=25');
        console.log('   SMTP_USER=匿名驗證不用輸入');
        console.log('   SMTP_PASS=匿名驗證不用輸入');
        console.log('   EMAIL_FROM=your-name@inftfinance.com.tw');
    }

    // 發送郵件
    async sendEmail(to, subject, htmlContent, attachments = []) {
        if (!this.initialized || !this.transporter) {
            throw new Error('郵件服務未初始化或配置不完整');
        }

        const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
        
        const mailOptions = {
            from: `"員工運動系統" <${fromEmail}>`,
            to: to,
            subject: subject,
            html: htmlContent,
            attachments: attachments
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ 郵件發送成功: ${info.messageId}`);
            console.log(`📧 收件人: ${to}`);
            console.log(`📄 主旨: ${subject}`);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            console.error('❌ 郵件發送失敗:', error);
            throw error;
        }
    }

    // 發送報告郵件
    async sendReport(to, reportData, format) {
        const { startDate, endDate, data, total } = reportData;
        
        // 生成郵件主旨
        const subject = `員工運動簽到報告 (${startDate} ~ ${endDate})`;
        
        // 生成郵件內容
        const htmlContent = this.generateReportEmailContent(startDate, endDate, data, total, format);
        
        // 準備附件
        const attachments = [];
        
        if (format === 'csv') {
            const csvContent = this.generateCSV(data);
            attachments.push({
                filename: `運動簽到報告_${startDate}_${endDate}.csv`,
                content: csvContent,
                contentType: 'text/csv; charset=utf-8'
            });
        } else if (format === 'html') {
            const htmlReport = this.generateHTMLReport(data);
            attachments.push({
                filename: `運動簽到報告_${startDate}_${endDate}.html`,
                content: htmlReport,
                contentType: 'text/html; charset=utf-8'
            });
        } else if (format === 'zip') {
            console.log('🗜️ 開始生成包含照片的完整備份 ZIP...');
            const zipBuffer = await this.generateZipWithPhotos(data, startDate, endDate);
            attachments.push({
                filename: `運動簽到完整備份_${startDate}_${endDate}.zip`,
                content: zipBuffer,
                contentType: 'application/zip'
            });
        }

        return await this.sendEmail(to, subject, htmlContent, attachments);
    }

    // 生成郵件內容
    generateReportEmailContent(startDate, endDate, data, total, format) {
        const formatNames = {
            'csv': 'CSV 檔案',
            'excel': 'Excel 檔案', 
            'html': 'HTML 網頁檢視',
            'zip': '完整備份 (含照片)'
        };

        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>員工運動簽到報告</title>
            <style>
                body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
                .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                .stat-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; flex: 1; margin: 0 5px; }
                .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
                .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
                .attachment-info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .attachment-info h4 { margin: 0 0 10px 0; color: #1976d2; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>員工運動簽到報告</h1>
                    <p>報告期間：${startDate} ~ ${endDate}</p>
                </div>
                <div class="content">
                    <h3>📊 統計摘要</h3>
                    <div class="stats">
                        <div class="stat-item">
                            <div class="stat-number">${total}</div>
                            <div class="stat-label">總簽到數</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${new Set(data.map(d => d.employee_id)).size}</div>
                            <div class="stat-label">參與員工</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${new Set(data.map(d => d.department)).size}</div>
                            <div class="stat-label">參與部門</div>
                        </div>
                    </div>

                    <div class="attachment-info">
                        <h4>📎 附件說明</h4>
                        <p>本郵件包含 <strong>${formatNames[format]}</strong> 格式的詳細報告</p>
                        <p>請下載附件檔案以查看完整的簽到記錄資料</p>
                    </div>

                    <h3>📋 最新簽到記錄</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">員工姓名</th>
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">部門</th>
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">運動類型</th>
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">簽到時間</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.slice(0, 5).map(item => `
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.department}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.activity_type}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${new Date(item.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</td>
                                </tr>
                            `).join('')}
                            ${data.length > 5 ? `
                                <tr>
                                    <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #666;">
                                        ... 還有 ${data.length - 5} 筆記錄，請查看附件以獲取完整資料
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>

                    <div class="footer">
                        <p>此郵件由員工運動社團活動管理系統自動發送</p>
                        <p>發送時間：${new Date().toLocaleString('zh-TW')}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // 生成 CSV 內容
    generateCSV(data) {
        const headers = ['簽到代碼', '員工編號', '姓名', '部門', '運動項目', '地點', '活動時間', '簽到時間', '照片連結', '電子簽名'];
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(item => {
            const row = [
                item.signin_code || '',
                item.employee_id || '',
                item.name || '',
                item.department || '',
                item.activity_type || '',
                item.location || '',
                item.activity_datetime || '',
                item.created_at ? new Date(item.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '',
                item.photo_path || '',
                item.signature_data ? '有簽名' : '無簽名'
            ];
            csvContent += row.map(field => `"${field}"`).join(',') + '\n';
        });
        
        return csvContent;
    }

    // 生成 HTML 報告
    generateHTMLReport(data) {
        // 這裡可以重用之前的 generateAdminDashboardHTML 函數
        // 為了簡化，這裡返回基本的 HTML 格式
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <title>員工運動簽到記錄報告</title>
            <style>
                body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
                th { background: #f5f5f5; font-weight: bold; }
                tr:nth-child(even) { background: #f9f9f9; }
                h1 { color: #333; }
            </style>
        </head>
        <body>
            <h1>員工運動簽到記錄報告</h1>
            <p>生成時間：${new Date().toLocaleString('zh-TW')}</p>
            <p>記錄總數：${data.length} 筆</p>
            
            <table>
                <thead>
                    <tr>
                        <th>員工編號</th>
                        <th>姓名</th>
                        <th>部門</th>
                        <th>運動類型</th>
                        <th>地點</th>
                        <th>簽到時間</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>${item.employee_id}</td>
                            <td>${item.name}</td>
                            <td>${item.department}</td>
                            <td>${item.activity_type}</td>
                            <td>${item.location}</td>
                            <td>${item.created_at ? new Date(item.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;
    }

    // 生成包含照片和簽名的 ZIP 檔案
    async generateZipWithPhotos(data, startDate, endDate) {
        try {
            const zip = new JSZip();
            
            console.log(`📦 郵件服務：開始生成包含實際檔案的 ZIP，共 ${data.length} 筆記錄`);
            
            // 添加 CSV 檔案
            const csvData = this.generateCSV(data);
            zip.file('簽到記錄.csv', csvData);
            
            // 添加 Excel 檔案
            const excelData = this.generateExcel(data);
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
                    const fileId = this.extractFileIdFromUrl(item.photo_path);
                    if (fileId) {
                        console.log(`📸 郵件服務：正在下載照片 ${i + 1}/${data.length}: ${item.name}`);
                        const photoBuffer = await this.downloadFileFromGoogleDrive(fileId);
                        
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
                
                // 處理簽名檔案
                if (item.signature_data) {
                    try {
                        const signatureFileName = `${safeFileName}_簽名.png`;
                        const signatureBuffer = Buffer.from(item.signature_data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                        signaturesFolder.file(signatureFileName, signatureBuffer);
                        signatureCount++;
                        downloadResults.push(`✅ 簽名: ${item.name} (${item.employee_id})`);
                    } catch (error) {
                        console.error(`❌ 簽名處理失敗 ${item.name}:`, error);
                        downloadResults.push(`❌ 簽名處理失敗: ${item.name} (${item.employee_id})`);
                    }
                }
            }
            
            // 添加下載結果報告
            const downloadReport = `
員工運動簽到完整備份
==========================================

生成時間：${new Date().toLocaleString('zh-TW')}
報告期間：${startDate} ~ ${endDate}
記錄總數：${data.length} 筆
照片檔案：${photoCount} 個
簽名檔案：${signatureCount} 個

下載結果：
${downloadResults.join('\n')}

檔案結構：
├── 簽到記錄.csv          (CSV 格式數據)
├── 簽到記錄.xlsx         (Excel 格式數據)
├── 照片檔案/             (所有員工照片)
└── 簽名檔案/             (所有電子簽名)

注意事項：
- 照片檔案名稱格式：員工編號_姓名_照片.jpg
- 簽名檔案名稱格式：員工編號_姓名_簽名.png
- 檔案名稱中的特殊字元已替換為底線
            `;
            
            zip.file('下載結果報告.txt', downloadReport);
            
            console.log(`✅ 郵件服務：ZIP 生成完成：${photoCount} 個照片，${signatureCount} 個簽名`);
            
            // 生成並返回 ZIP buffer
            return await zip.generateAsync({ type: 'nodebuffer' });
            
        } catch (error) {
            console.error('❌ 郵件服務：ZIP 生成失敗:', error);
            throw error;
        }
    }

    // 輔助函數：從 Google Drive 下載檔案
    async downloadFileFromGoogleDrive(fileId) {
        try {
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
            
            return Buffer.from(response.data);
            
        } catch (error) {
            console.error(`❌ 郵件服務：下載檔案失敗 ${fileId}:`, error.message);
            return null;
        }
    }

    // 輔助函數：從照片 URL 提取檔案 ID
    extractFileIdFromUrl(url) {
        if (!url) return null;
        
        const patterns = [
            /\/d\/([a-zA-Z0-9-_]+)/,
            /id=([a-zA-Z0-9-_]+)/,
            /([a-zA-Z0-9-_]{25,})/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    // 生成 Excel 檔案
    generateExcel(data) {
        const headers = ['簽到代碼', '員工編號', '姓名', '部門', '運動項目', '地點', '活動時間', '簽到時間', '照片連結', '電子簽名'];
        
        const worksheetData = [headers];
        data.forEach(item => {
            worksheetData.push([
                item.signin_code || '',
                item.employee_id || '',
                item.name || '',
                item.department || '',
                item.activity_type || '',
                item.location || '',
                item.activity_datetime || '',
                item.created_at ? new Date(item.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '',
                item.photo_path || '',
                item.signature_data ? '有簽名' : '無簽名'
            ]);
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '簽到記錄');
        
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    // 檢查服務狀態
    isConfigured() {
        return this.initialized && this.transporter !== null;
    }
}

module.exports = new EmailService();