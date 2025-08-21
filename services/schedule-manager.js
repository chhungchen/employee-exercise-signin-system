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
            
            for (const recipientEmail of emailArray) {
                try {
                    await this.emailService.sendReport(recipientEmail, reportData, this.settings.format);
                    successCount++;
                    console.log(`✅ 定期報告已發送至 ${recipientEmail}`);
                } catch (sendError) {
                    failedCount++;
                    console.error(`❌ 寄送失敗至 ${recipientEmail}:`, sendError.message);
                }
            }
            
            console.log(`✅ 定期報告完成: ${signins.length} 筆記錄，成功寄送至 ${successCount}/${emailArray.length} 個收件者`);

        } catch (error) {
            console.error('❌ 執行定期報告失敗:', error);
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
}

module.exports = new ScheduleManager();