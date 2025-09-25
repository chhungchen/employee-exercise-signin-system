const cron = require('node-cron');
const moment = require('moment');

// 將多行信箱格式化為陣列
function parseEmailsFromText(emailText) {
    if (!emailText) return [];
    return emailText.split('\n').map(e => e.trim()).filter(e => e);
}

// 定期寄送管理器
class ScheduleManager {
    constructor() {
        this.jobs = new Map();
        this.settings = {
            enabled: false,
            email: '',
            time: '08:00',
            format: 'excel',
            includePhotos: false
        };
        this.personalGoogleServices = null;
        this.personalDatabase = null;
        this.emailService = null;
        this.deliveryTracking = {
            totalAttempts: 0,
            successCount: 0,
            failureCount: 0,
            lastSuccess: null,
            lastFailure: null
        };
    }

    // 設定相依服務
    setDependencies(personalGoogleServices, personalDatabase, emailService) {
        this.personalGoogleServices = personalGoogleServices;
        this.personalDatabase = personalDatabase;
        this.emailService = emailService;
    }

    // 設定排程
    async setSchedule(settings) {
        try {
            // 清除現有的排程
            await this.clearSchedule();
            
            if (!settings.enabled || !settings.email) {
                console.log('📅 定期寄送已停用');
                return { success: true, message: '定期寄送已停用' };
            }

            // 驗證時間格式 (HH:mm)
            const timeMatch = settings.time.match(/^(\d{2}):(\d{2})$/);
            if (!timeMatch) {
                throw new Error('時間格式錯誤，請使用 HH:mm 格式');
            }

            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);
            
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                throw new Error('時間範圍錯誤，小時應為 00-23，分鐘應為 00-59');
            }

            // 建立 cron 表達式 (分 時 * * *)
            const cronExpression = `${minute} ${hour} * * *`;
            
            console.log(`📅 設定定期寄送排程: ${cronExpression} (${settings.time})`);
            
            // 建立 cron 任務
            const job = cron.schedule(cronExpression, async () => {
                await this.executeDailyReport();
            }, {
                scheduled: true,
                timezone: 'Asia/Taipei'
            });

            this.jobs.set('daily-report', job);
            this.settings = { ...settings };

            // 儲存設定到 Google Sheets (持久化)
            await this.saveSettingsToSheets(settings);

            console.log(`✅ 定期寄送已設定：每日 ${settings.time} 寄送至 ${settings.email}`);
            return { 
                success: true, 
                message: `定期寄送已設定：每日 ${settings.time} 寄送至 ${settings.email}`,
                cronExpression,
                nextRun: this.getNextRunTime(cronExpression)
            };

        } catch (error) {
            console.error('❌ 設定定期寄送失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // 清除排程
    async clearSchedule() {
        this.jobs.forEach(job => {
            job.destroy();
        });
        this.jobs.clear();
        
        // 更新設定為停用狀態
        this.settings = {
            enabled: false,
            email: '',
            time: '08:00',
            format: 'excel',
            includePhotos: false
        };
        
        // 儲存停用狀態到 Sheets
        await this.saveSettingsToSheets(this.settings);
        
        console.log('🗑️ 已清除所有定期寄送排程');
    }

    // 執行每日報告
    async executeDailyReport() {
        try {
            console.log('📊 開始執行定期報告寄送...');

            if (!this.settings.enabled || !this.settings.email) {
                console.log('⚠️ 定期寄送未啟用或缺少收件人');
                return;
            }

            // 檢查郵件服務
            if (!this.emailService || !this.emailService.isConfigured()) {
                console.log('⚠️ 郵件服務未配置，嘗試初始化...');
                if (this.emailService) {
                    const initialized = await this.emailService.initialize();
                    if (!initialized) {
                        console.error('❌ 郵件服務初始化失敗，無法執行定期寄送');
                        return;
                    }
                } else {
                    console.error('❌ 郵件服務未設定，無法執行定期寄送');
                    return;
                }
            }

            // 計算日期範圍（昨天的資料）
            const today = moment();
            const yesterday = moment().subtract(1, 'day');
            const startDate = yesterday.format('YYYY-MM-DD');
            const endDate = yesterday.format('YYYY-MM-DD');

            console.log(`📅 取得 ${startDate} 的簽到記錄...`);

            // 取得資料
            if (!this.personalDatabase) {
                console.error('❌ 資料庫服務未設定，無法執行定期寄送');
                return;
            }

            const signins = await this.personalDatabase.getAllSigninsForExport({
                startDate: startDate + ' 00:00:00',
                endDate: endDate + ' 23:59:59'
            });

            if (!signins || signins.length === 0) {
                console.log(`📭 ${startDate} 沒有簽到記錄，跳過寄送`);
                return;
            }

            // 準備報告資料
            const reportData = {
                startDate,
                endDate,
                data: signins,
                total: signins.length
            };

            // 發送報告給多個收件者
            const emailArray = this.settings.emails || parseEmailsFromText(this.settings.email);

            let successCount = 0;
            let failedCount = 0;
            let lastError = null;

            for (const recipientEmail of emailArray) {
                try {
                    this.deliveryTracking.totalAttempts++;
                    await this.emailService.sendReport(recipientEmail, reportData, this.settings.format);
                    successCount++;
                    this.deliveryTracking.successCount++;
                    this.deliveryTracking.lastSuccess = new Date();
                    console.log(`✅ 定期報告已發送至 ${recipientEmail}`);
                } catch (sendError) {
                    failedCount++;
                    this.deliveryTracking.failureCount++;
                    this.deliveryTracking.lastFailure = new Date();
                    lastError = sendError;
                    console.error(`❌ 寄送失敗至 ${recipientEmail}:`, sendError.message);
                }
            }

            // 如果有失敗，發送通知給 Jameschen@inftfinance.com.tw
            if (failedCount > 0 && lastError) {
                await this.sendFailureNotification(lastError, {
                    scheduledTime: this.settings.time,
                    recipient: emailArray.join(', '),
                    timestamp: new Date(),
                    successCount,
                    failedCount,
                    totalRecipients: emailArray.length
                });
            }

            console.log(`✅ 定期報告完成: ${signins.length} 筆記錄，成功寄送至 ${successCount}/${emailArray.length} 個收件者`);

        } catch (error) {
            console.error('❌ 執行定期報告失敗:', error);

            // 發送系統性失敗通知
            await this.sendFailureNotification(error, {
                scheduledTime: this.settings.time,
                recipient: this.settings.email || '未設定',
                timestamp: new Date(),
                isSystemFailure: true
            });
        }
    }

    // 測試寄送
    async testReport() {
        try {
            console.log('🧪 執行測試寄送...');
            
            if (!this.settings.email) {
                throw new Error('請先設定收件人信箱');
            }

            // 檢查郵件服務
            if (!this.emailService || !this.emailService.isConfigured()) {
                if (this.emailService) {
                    const initialized = await this.emailService.initialize();
                    if (!initialized) {
                        throw new Error('郵件服務未配置');
                    }
                } else {
                    throw new Error('郵件服務未設定');
                }
            }

            // 取得最近 7 天的資料作為測試
            const endDate = moment().format('YYYY-MM-DD');
            const startDate = moment().subtract(6, 'days').format('YYYY-MM-DD');

            if (!this.personalDatabase) {
                throw new Error('資料庫服務未設定');
            }

            const signins = await this.personalDatabase.getAllSigninsForExport({
                startDate: startDate + ' 00:00:00',
                endDate: endDate + ' 23:59:59'
            });

            const reportData = {
                startDate,
                endDate,
                data: signins || [],
                total: signins ? signins.length : 0
            };

            await this.emailService.sendReport(this.settings.email, reportData, this.settings.format);
            
            return { 
                success: true, 
                message: `測試報告已寄送至 ${this.settings.email}`,
                recordCount: reportData.total 
            };

        } catch (error) {
            console.error('❌ 測試寄送失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // 取得下次執行時間
    getNextRunTime(cronExpression) {
        try {
            const [minute, hour] = cronExpression.split(' ');
            const now = moment();
            let nextRun = moment().hour(parseInt(hour)).minute(parseInt(minute)).second(0);
            
            if (nextRun.isSameOrBefore(now)) {
                nextRun.add(1, 'day');
            }
            
            return nextRun.format('YYYY-MM-DD HH:mm:ss');
        } catch (error) {
            return '無法計算';
        }
    }

    // 取得設定
    getSettings() {
        return {
            ...this.settings,
            isRunning: this.jobs.has('daily-report'),
            nextRun: this.jobs.has('daily-report') ? this.getNextRunTime(`${this.settings.time.split(':')[1]} ${this.settings.time.split(':')[0]} * * *`) : null
        };
    }

    // 儲存設定到 Google Sheets
    async saveSettingsToSheets(settings) {
        try {
            if (!this.personalGoogleServices) {
                console.log('⚠️ Google 服務未設定，無法儲存定期寄送設定');
                return false;
            }

            const initialized = await this.personalGoogleServices.initialize();
            if (!initialized) {
                console.log('⚠️ Google 服務未初始化，無法儲存定期寄送設定');
                return false;
            }

            const spreadsheetId = this.personalGoogleServices.spreadsheetId;
            if (!spreadsheetId) {
                console.log('⚠️ 沒有可用的試算表 ID');
                return false;
            }

            // 確保 schedule_settings 工作表存在
            try {
                await this.personalGoogleServices.sheets.spreadsheets.get({
                    spreadsheetId: spreadsheetId,
                    ranges: ['schedule_settings!A1:A1']
                });
            } catch (error) {
                // 工作表不存在，建立它
                await this.personalGoogleServices.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'schedule_settings'
                                }
                            }
                        }]
                    }
                });
                
                // 設定標頭
                await this.personalGoogleServices.sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: 'schedule_settings!A1:G1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [['enabled', 'email', 'emails', 'time', 'format', 'includePhotos', 'updated_at']]
                    }
                });
                console.log('✅ 已建立 schedule_settings 工作表');
            }

            // 儲存設定資料（覆蓋第二行）
            await this.personalGoogleServices.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'schedule_settings!A2:G2',
                valueInputOption: 'RAW',
                resource: {
                    values: [[
                        settings.enabled ? 'true' : 'false',
                        settings.email || '',
                        Array.isArray(settings.emails) ? settings.emails.join('\n') : '',
                        settings.time || '08:00',
                        settings.format || 'excel',
                        settings.includePhotos ? 'true' : 'false',
                        new Date().toISOString()
                    ]]
                }
            });

            console.log('✅ 定期寄送設定已儲存到 Google Sheets');
            return true;
        } catch (error) {
            console.error('❌ 儲存定期寄送設定到 Sheets 失敗:', error);
            return false;
        }
    }

    // 從 Google Sheets 載入設定
    async loadSettingsFromSheets() {
        try {
            if (!this.personalGoogleServices) {
                console.log('⚠️ Google 服務未設定，無法載入定期寄送設定');
                return null;
            }

            const initialized = await this.personalGoogleServices.initialize();
            if (!initialized) {
                console.log('⚠️ Google 服務未初始化，無法載入定期寄送設定');
                return null;
            }

            const spreadsheetId = this.personalGoogleServices.spreadsheetId;
            if (!spreadsheetId) {
                console.log('⚠️ 沒有可用的試算表 ID');
                return null;
            }

            // 嘗試讀取 schedule_settings 工作表
            let response;
            try {
                response = await this.personalGoogleServices.sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: 'schedule_settings!A2:G2'
                });
            } catch (sheetError) {
                if (sheetError.message.includes('Unable to parse range') || 
                    sheetError.message.includes('does not exist')) {
                    console.log('📋 schedule_settings 工作表不存在，可能尚未設定過定期寄送');
                    return null;
                }
                throw sheetError;
            }

            const rows = response.data.values;
            if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0) {
                console.log('📭 Sheets 中沒有儲存的定期寄送設定');
                return null;
            }

            // 處理電子郵件設定，優先從 email 欄位取得，再從 emails 欄位
            let emailText = rows[0][1] || ''; // email 欄位
            const emailsText = rows[0][2] || ''; // emails 欄位
            
            // 如果 email 欄位為空，但 emails 欄位有資料，使用 emails 欄位
            if (!emailText && emailsText) {
                emailText = emailsText;
            }
            
            const emailsArray = emailText ? emailText.split('\n').map(e => e.trim()).filter(e => e) : [];
            
            const settings = {
                enabled: rows[0][0] === 'true',
                email: emailText, // 儲存多行格式
                emails: emailsArray, // 儲存陣列格式
                time: rows[0][3] || '08:00',
                format: rows[0][4] || 'excel',
                includePhotos: rows[0][5] === 'true'
            };

            // 驗證設定的完整性
            if (!settings.email && settings.enabled) {
                console.log('⚠️ Sheets 中的設定不完整（缺少信箱）');
                console.log('🔍 除錯資訊 - 原始資料:', rows[0]);
                return null;
            }

            console.log('✅ 從 Google Sheets 載入定期寄送設定成功:', settings);
            return settings;
        } catch (error) {
            console.log('⚠️ 從 Sheets 載入定期寄送設定失敗:', error.message);
            return null;
        }
    }

    // 初始化：載入儲存的設定並恢復排程
    async initialize() {
        try {
            console.log('🔄 初始化定期寄送管理器...');
            
            // 檢查相依服務
            if (!this.personalGoogleServices || !this.personalDatabase || !this.emailService) {
                console.log('⚠️ 相依服務未完全設定，跳過定期寄送初始化');
                return;
            }
            
            // 從 Sheets 載入設定
            const savedSettings = await this.loadSettingsFromSheets();
            if (savedSettings) {
                console.log('📋 找到已儲存的定期寄送設定，正在恢復...');
                
                // 更新設定
                this.settings = { ...this.settings, ...savedSettings };
                
                // 如果設定是啟用的，重新建立排程
                if (savedSettings.enabled && savedSettings.email) {
                    const result = await this.setSchedule(savedSettings);
                    if (result.success) {
                        console.log('✅ 定期寄送排程已自動恢復');
                    } else {
                        console.error('❌ 恢復定期寄送排程失敗:', result.error);
                    }
                }
            } else {
                console.log('📭 沒有找到儲存的定期寄送設定');
            }
            
            console.log('✅ 定期寄送管理器初始化完成');
        } catch (error) {
            console.error('❌ 定期寄送管理器初始化失敗:', error);
        }
    }

    // 發送失敗通知
    async sendFailureNotification(error, context) {
        try {
            if (!this.emailService || !this.emailService.isConfigured()) {
                console.error('❌ 無法發送失敗通知：郵件服務未配置');
                return;
            }

            const notificationEmail = 'Jameschen@inftfinance.com.tw';
            const { subject, html } = this.buildFailureNotificationContent(error, context);

            await this.emailService.sendEmail(notificationEmail, subject, html, []);
            console.log(`✅ 失敗通知已發送至 ${notificationEmail}`);
        } catch (notificationError) {
            console.error('❌ 發送失敗通知時發生錯誤:', notificationError);
        }
    }

    // 建立失敗通知內容
    buildFailureNotificationContent(error, context) {
        const timestamp = moment(context.timestamp).utcOffset(8);
        const formattedDate = timestamp.format('YYYY-MM-DD HH:mm (UTC+8)');
        const dateOnly = timestamp.format('YYYY-MM-DD');
        const timeOnly = timestamp.format('HH:mm');

        const subject = `【警告】每日郵件報告寄送失敗 - ${dateOnly} ${context.scheduledTime} (UTC+8)`;

        let errorDetails = '';
        if (error.code) {
            errorDetails += `錯誤代碼: ${error.code}\n`;
        }
        errorDetails += `錯誤訊息: ${error.message}\n`;
        errorDetails += `發生時間: ${formattedDate}`;

        let deliveryInfo = '';
        if (context.isSystemFailure) {
            deliveryInfo = '系統性錯誤，無法執行定期寄送任務';
        } else {
            deliveryInfo = `成功寄送: ${context.successCount}/${context.totalRecipients} 個收件者\n失敗寄送: ${context.failedCount}/${context.totalRecipients} 個收件者`;
        }

        const html = `
        <div style="font-family: 'Microsoft JhengHei', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="color: #d32f2f; margin-top: 0;">🚨 每日郵件報告寄送失敗</h2>

                <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f; margin: 20px 0;">
                    <h3 style="color: #b71c1c; margin: 0 0 10px 0;">基本資訊</h3>
                    <p style="margin: 5px 0;"><strong>排程時間:</strong> ${context.scheduledTime}</p>
                    <p style="margin: 5px 0;"><strong>目標收件人:</strong> ${context.recipient}</p>
                    <p style="margin: 5px 0;"><strong>發生時間:</strong> ${formattedDate}</p>
                </div>

                <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; margin: 20px 0;">
                    <h3 style="color: #e65100; margin: 0 0 10px 0;">寄送狀態</h3>
                    <p style="margin: 5px 0; white-space: pre-line;">${deliveryInfo}</p>
                </div>

                <div style="background-color: #fce4ec; padding: 15px; border-radius: 5px; border-left: 4px solid #e91e63; margin: 20px 0;">
                    <h3 style="color: #ad1457; margin: 0 0 10px 0;">錯誤詳情</h3>
                    <p style="margin: 5px 0; white-space: pre-line; font-family: monospace; background-color: #f5f5f5; padding: 10px; border-radius: 3px;">${errorDetails}</p>
                </div>

                <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3; margin: 20px 0;">
                    <h3 style="color: #0d47a1; margin: 0 0 10px 0;">建議處理步驟</h3>
                    <ol style="margin: 0; padding-left: 20px;">
                        <li>檢查郵件服務提供者狀態（Brevo API、Gmail SMTP）</li>
                        <li>確認網路連線與防火牆設定</li>
                        <li>檢查收件人信箱是否有效</li>
                        <li>查看完整系統記錄檔</li>
                        <li>必要時聯繫技術支援</li>
                    </ol>
                </div>

                <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    此為系統自動發送的通知郵件 | 員工運動簽到系統 | ${formattedDate}
                </p>
            </div>
        </div>`;

        return { subject, html };
    }

    // 取得寄送統計
    getDeliveryStats() {
        const successRate = this.deliveryTracking.totalAttempts > 0
            ? (this.deliveryTracking.successCount / this.deliveryTracking.totalAttempts * 100).toFixed(2)
            : 0;

        return {
            totalAttempts: this.deliveryTracking.totalAttempts,
            successCount: this.deliveryTracking.successCount,
            failureCount: this.deliveryTracking.failureCount,
            successRate: parseFloat(successRate),
            lastSuccess: this.deliveryTracking.lastSuccess,
            lastFailure: this.deliveryTracking.lastFailure
        };
    }
}

const scheduleManagerInstance = new ScheduleManager();
module.exports = scheduleManagerInstance;
module.exports.constructor = ScheduleManager;