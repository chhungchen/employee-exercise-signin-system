const cron = require('node-cron');
const personalGoogleServices = require('./personal-google-services');
const emailService = require('./email-service');

/**
 * Google OAuth2 Token 監控服務
 * 定期檢查 token 健康狀態，提供預警通知
 */
class TokenMonitor {
    constructor() {
        this.monitorJobs = [];
        this.isEnabled = process.env.USE_PERSONAL_GOOGLE === 'true';
        this.alertEmails = process.env.TOKEN_ALERT_EMAILS?.split(',') || [];
        this.stats = {
            lastCheckTime: null,
            totalChecks: 0,
            failedChecks: 0,
            consecutiveFailures: 0,
            tokenAge: null,
            lastRefreshTime: null,
            healthScore: 100
        };
    }

    /**
     * 初始化監控服務
     */
    initialize() {
        if (!this.isEnabled) {
            console.log('📊 Token 監控服務僅在個人 Google 模式下啟用');
            return;
        }

        console.log('🔍 初始化 Token 監控服務...');
        this.setupMonitoringSchedules();
        
        // 啟動時立即執行一次檢查
        setTimeout(() => this.performHealthCheck(), 5000);
        
        console.log('✅ Token 監控服務初始化完成');
    }

    /**
     * 設定監控排程
     */
    setupMonitoringSchedules() {
        // 每小時檢查 token 健康狀態
        const hourlyCheck = cron.schedule('0 * * * *', async () => {
            await this.performHealthCheck();
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        // 每日早上 8:00 進行深度檢查
        const dailyDeepCheck = cron.schedule('0 8 * * *', async () => {
            await this.performDeepHealthCheck();
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        // 每週一早上 9:00 發送健康報告
        const weeklyReport = cron.schedule('0 9 * * 1', async () => {
            await this.sendWeeklyReport();
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        this.monitorJobs = [hourlyCheck, dailyDeepCheck, weeklyReport];

        console.log('📅 Token 監控排程已設定:');
        console.log('   - 每小時健康檢查');
        console.log('   - 每日 08:00 深度檢查');
        console.log('   - 每週一 09:00 健康報告');
    }

    /**
     * 執行基本健康檢查
     */
    async performHealthCheck() {
        const checkTime = new Date();
        console.log(`🔍 [${checkTime.toLocaleString('zh-TW')}] 執行 Token 健康檢查...`);

        try {
            this.stats.totalChecks++;
            this.stats.lastCheckTime = checkTime;

            // 檢查 Google Services 初始化狀態
            const isInitialized = await personalGoogleServices.initialize();
            
            if (!isInitialized) {
                throw new Error('Google Services 初始化失敗');
            }

            // 測試基本 API 呼叫
            await this.testBasicAPIAccess();
            
            // 重置失敗計數
            this.stats.consecutiveFailures = 0;
            this.stats.healthScore = Math.min(100, this.stats.healthScore + 5);
            
            console.log(`✅ Token 健康檢查通過 (健康分數: ${this.stats.healthScore}%)`);
            
        } catch (error) {
            this.stats.failedChecks++;
            this.stats.consecutiveFailures++;
            this.stats.healthScore = Math.max(0, this.stats.healthScore - 10);
            
            console.error(`❌ Token 健康檢查失敗:`, error.message);
            
            // 連續失敗時發送警告
            if (this.stats.consecutiveFailures >= 3) {
                await this.sendFailureAlert(error);
            }
        }
    }

    /**
     * 執行深度健康檢查
     */
    async performDeepHealthCheck() {
        console.log('🔬 執行 Token 深度健康檢查...');
        
        const checkResults = [];
        let overallSuccess = true;
        
        try {
            // 基本健康檢查
            try {
                await this.performHealthCheck();
                checkResults.push('✅ 基本健康檢查');
            } catch (error) {
                checkResults.push(`❌ 基本健康檢查: ${error.message}`);
                overallSuccess = false;
            }
            
            // 檢查 token 年齡
            try {
                await this.checkTokenAge();
                checkResults.push('✅ Token 年齡檢查');
            } catch (error) {
                checkResults.push(`⚠️ Token 年齡檢查: ${error.message}`);
            }
            
            // 檢查 API 權限範圍
            try {
                await this.checkAPIPermissions();
                checkResults.push('✅ API 權限檢查');
            } catch (error) {
                checkResults.push(`⚠️ API 權限檢查: ${error.message}`);
            }
            
            // 檢查 Google Sheets 存取
            try {
                await this.checkSheetsAccess();
                checkResults.push('✅ Google Sheets 存取');
            } catch (error) {
                checkResults.push(`⚠️ Google Sheets 存取: ${error.message}`);
            }
            
            // 檢查 Google Drive 存取
            try {
                await this.checkDriveAccess();
                checkResults.push('✅ Google Drive 存取');
            } catch (error) {
                checkResults.push(`⚠️ Google Drive 存取: ${error.message}`);
            }
            
            console.log('📋 深度檢查結果:');
            checkResults.forEach(result => console.log(`  ${result}`));
            
            if (overallSuccess) {
                console.log('✅ Token 深度健康檢查完成');
            } else {
                console.log('⚠️ Token 深度健康檢查部分項目失敗，但系統仍可運作');
            }
            
        } catch (error) {
            console.error('❌ Token 深度健康檢查嚴重失敗:', error.message);
            // 只在嚴重錯誤時發送警告，避免過多通知
            if (overallSuccess === false) {
                await this.sendDeepCheckFailureAlert(error);
            }
        }
    }

    /**
     * 測試基本 API 存取
     */
    async testBasicAPIAccess() {
        try {
            // 檢查必要的環境變數
            if (!process.env.GOOGLE_SPREADSHEET_ID) {
                console.log('⚠️ 尚未設定 Google Spreadsheet ID，跳過 API 測試');
                return;
            }

            // 簡單的 API 呼叫測試
            await personalGoogleServices.sheets.spreadsheets.get({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                fields: 'properties.title'
            });
            
            console.log('✅ Google Sheets API 存取正常');
            
        } catch (error) {
            // 處理特定的 OAuth 錯誤
            if (error.message && error.message.includes('invalid_grant')) {
                console.log('⚠️ Token 可能過期或無效，建議重新授權');
                throw new Error('Token 認證失敗，可能需要重新授權');
            } else if (error.code === 401) {
                console.log('⚠️ API 認證失敗，檢查 Token 狀態');
                throw new Error('API 認證失敗');
            } else if (error.code === 403) {
                console.log('⚠️ API 權限不足或配額超限');
                throw new Error('API 權限不足');
            } else {
                console.log('⚠️ API 測試失敗:', error.message);
                throw error;
            }
        }
    }

    /**
     * 檢查 token 年齡
     */
    async checkTokenAge() {
        // 從 oauth2Client 取得 credentials
        const credentials = personalGoogleServices.oauth2Client?.credentials;
        if (credentials && credentials.refresh_token) {
            // 估算 token 年齡（基於環境變數或上次更新時間）
            const tokenCreatedTime = process.env.GOOGLE_TOKEN_CREATED_TIME;
            if (tokenCreatedTime) {
                const ageInDays = (Date.now() - parseInt(tokenCreatedTime)) / (1000 * 60 * 60 * 24);
                this.stats.tokenAge = Math.floor(ageInDays);
                
                // 如果 token 超過 150 天，發送預警
                if (ageInDays > 150) {
                    await this.sendTokenAgeWarning(ageInDays);
                }
            }
        }
    }

    /**
     * 檢查 API 權限範圍
     */
    async checkAPIPermissions() {
        const requiredScopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ];
        
        // 檢查目前的權限範圍
        const credentials = personalGoogleServices.oauth2Client?.credentials;
        const scope = credentials?.scope || process.env.GOOGLE_TOKEN_SCOPE || '';
        
        if (scope) {
            const currentScopes = scope.split(' ');
            const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope));
            
            if (missingScopes.length > 0) {
                throw new Error(`缺少必要權限: ${missingScopes.join(', ')}`);
            }
        }
    }

    /**
     * 檢查 Google Sheets 存取
     */
    async checkSheetsAccess() {
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        if (!spreadsheetId) {
            throw new Error('GOOGLE_SPREADSHEET_ID 環境變數未設定');
        }

        // 嘗試讀取試算表
        await personalGoogleServices.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'employees!A1:B1'
        });
    }

    /**
     * 檢查 Google Drive 存取
     */
    async checkDriveAccess() {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            throw new Error('GOOGLE_DRIVE_FOLDER_ID 環境變數未設定');
        }

        // 嘗試列出資料夾內容
        await personalGoogleServices.drive.files.list({
            q: `'${folderId}' in parents`,
            pageSize: 1
        });
    }

    /**
     * 發送失敗警告
     */
    async sendFailureAlert(error) {
        if (this.alertEmails.length === 0) {
            console.log('⚠️ 無警告收件人設定，跳過發送警告郵件');
            return;
        }

        console.log(`📧 發送 Token 失敗警告 (連續失敗 ${this.stats.consecutiveFailures} 次)`);

        const subject = `🚨 Google OAuth2 Token 健康檢查失敗警告`;
        const htmlContent = this.generateFailureAlertEmail(error);

        try {
            for (const email of this.alertEmails) {
                await emailService.sendEmail(email.trim(), subject, htmlContent);
            }
            console.log('✅ 失敗警告郵件發送成功');
        } catch (emailError) {
            console.error('❌ 警告郵件發送失敗:', emailError.message);
        }
    }

    /**
     * 發送深度檢查失敗警告
     */
    async sendDeepCheckFailureAlert(error) {
        if (this.alertEmails.length === 0) return;

        const subject = `🔬 Google Token 深度檢查失敗通知`;
        const htmlContent = this.generateDeepCheckFailureEmail(error);

        try {
            for (const email of this.alertEmails) {
                await emailService.sendEmail(email.trim(), subject, htmlContent);
            }
        } catch (emailError) {
            console.error('❌ 深度檢查警告郵件發送失敗:', emailError.message);
        }
    }

    /**
     * 發送 token 年齡警告
     */
    async sendTokenAgeWarning(ageInDays) {
        if (this.alertEmails.length === 0) return;

        console.log(`⏰ Token 年齡警告: ${ageInDays} 天`);

        const subject = `⏰ Google OAuth2 Token 年齡警告`;
        const htmlContent = this.generateTokenAgeWarningEmail(ageInDays);

        try {
            for (const email of this.alertEmails) {
                await emailService.sendEmail(email.trim(), subject, htmlContent);
            }
        } catch (emailError) {
            console.error('❌ Token 年齡警告郵件發送失敗:', emailError.message);
        }
    }

    /**
     * 發送週報
     */
    async sendWeeklyReport() {
        if (this.alertEmails.length === 0) return;

        console.log('📊 發送 Token 監控週報');

        const subject = `📊 Google OAuth2 Token 監控週報`;
        const htmlContent = this.generateWeeklyReportEmail();

        try {
            for (const email of this.alertEmails) {
                await emailService.sendEmail(email.trim(), subject, htmlContent);
            }
            console.log('✅ Token 監控週報發送成功');
        } catch (emailError) {
            console.error('❌ 週報發送失敗:', emailError.message);
        }
    }

    /**
     * 生成失敗警告郵件內容
     */
    generateFailureAlertEmail(error) {
        const taiwanTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <title>Google OAuth2 Token 健康檢查失敗警告</title>
            <style>
                body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .alert { background: #ff6b6b; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
                .stats { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .action { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="alert">
                    <h1>🚨 Google OAuth2 Token 健康檢查失敗</h1>
                    <p>員工運動簽到系統檢測到 Token 異常</p>
                </div>
                
                <div class="stats">
                    <h3>📊 錯誤詳情</h3>
                    <p><strong>錯誤訊息:</strong> ${error.message}</p>
                    <p><strong>發生時間:</strong> ${taiwanTime}</p>
                    <p><strong>連續失敗次數:</strong> ${this.stats.consecutiveFailures}</p>
                    <p><strong>健康分數:</strong> ${this.stats.healthScore}%</p>
                </div>
                
                <div class="action">
                    <h3>🔧 建議處理方式</h3>
                    <ol>
                        <li>立即檢查 <a href="https://employee-exercise-signin-system.onrender.com/token-helper">Token Helper</a></li>
                        <li>重新授權 Google 服務</li>
                        <li>檢查環境變數設定</li>
                        <li>驗證系統功能正常</li>
                    </ol>
                </div>
                
                <p style="text-align: center; color: #666; font-size: 12px;">
                    此警告由員工運動簽到系統自動發送<br>
                    監控時間: ${taiwanTime}
                </p>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * 生成深度檢查失敗郵件內容
     */
    generateDeepCheckFailureEmail(error) {
        const taiwanTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <title>Google Token 深度檢查失敗通知</title>
            <style>
                body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .alert { background: #ff9800; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
                .details { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="alert">
                    <h1>🔬 Google Token 深度檢查失敗</h1>
                    <p>系統進行深度檢查時發現問題</p>
                </div>
                
                <div class="details">
                    <h3>📋 檢查結果</h3>
                    <p><strong>錯誤:</strong> ${error.message}</p>
                    <p><strong>檢查時間:</strong> ${taiwanTime}</p>
                    <p><strong>Token 年齡:</strong> ${this.stats.tokenAge || '未知'} 天</p>
                </div>
                
                <p style="text-align: center;">
                    建議立即檢查系統狀態並進行必要的維護
                </p>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * 生成 token 年齡警告郵件
     */
    generateTokenAgeWarningEmail(ageInDays) {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <title>Google OAuth2 Token 年齡警告</title>
            <style>
                body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .warning { background: #ffc107; color: #856404; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="warning">
                    <h1>⏰ Google OAuth2 Token 年齡警告</h1>
                    <p>您的 Google OAuth2 Token 已使用 <strong>${Math.floor(ageInDays)} 天</strong></p>
                    <p>建議考慮重新授權以確保系統穩定性</p>
                </div>
                
                <h3>📋 建議操作</h3>
                <ul>
                    <li>定期檢查 Token 狀態</li>
                    <li>如系統出現異常，立即重新授權</li>
                    <li>考慮設定更短的檢查週期</li>
                </ul>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * 生成週報郵件內容
     */
    generateWeeklyReportEmail() {
        const taiwanTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        const successRate = this.stats.totalChecks > 0 
            ? (((this.stats.totalChecks - this.stats.failedChecks) / this.stats.totalChecks) * 100).toFixed(2)
            : '100';
        
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <title>Google OAuth2 Token 監控週報</title>
            <style>
                body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                .stat-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; flex: 1; margin: 0 5px; }
                .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Google OAuth2 Token 監控週報</h1>
                    <p>員工運動簽到系統健康狀況</p>
                </div>
                
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-number">${this.stats.healthScore}%</div>
                        <div>健康分數</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${successRate}%</div>
                        <div>成功率</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${this.stats.totalChecks}</div>
                        <div>總檢查次數</div>
                    </div>
                </div>
                
                <h3>📋 系統狀態摘要</h3>
                <ul>
                    <li><strong>上次檢查時間:</strong> ${this.stats.lastCheckTime?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) || '未知'}</li>
                    <li><strong>失敗檢查次數:</strong> ${this.stats.failedChecks}</li>
                    <li><strong>連續失敗次數:</strong> ${this.stats.consecutiveFailures}</li>
                    <li><strong>Token 年齡:</strong> ${this.stats.tokenAge || '未知'} 天</li>
                </ul>
                
                <p style="text-align: center; color: #666; font-size: 12px;">
                    報告生成時間: ${taiwanTime}
                </p>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * 取得監控統計
     */
    getStats() {
        return {
            ...this.stats,
            isEnabled: this.isEnabled,
            alertEmails: this.alertEmails.length,
            nextCheckTime: this.getNextCheckTime()
        };
    }

    /**
     * 取得下次檢查時間
     */
    getNextCheckTime() {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        return nextHour.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    }

    /**
     * 手動觸發健康檢查
     */
    async manualHealthCheck() {
        console.log('🔍 手動觸發 Token 健康檢查...');
        await this.performHealthCheck();
        return this.getStats();
    }

    /**
     * 停止監控服務
     */
    stop() {
        this.monitorJobs.forEach(job => {
            job.stop();
            job.destroy();
        });
        this.monitorJobs = [];
        console.log('⏹️ Token 監控服務已停止');
    }
}

// 建立單例實例
const tokenMonitor = new TokenMonitor();

module.exports = tokenMonitor;