const axios = require('axios');
const cron = require('node-cron');

/**
 * Keep-Alive 服務 - 防止 Render 平台休眠
 * 定期向自己的健康檢查端點發送請求，保持服務喚醒
 */
class KeepAliveService {
    constructor() {
        this.keepAliveJobs = [];
        this.baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:3000';
        this.isEnabled = process.env.NODE_ENV === 'production' && (
            this.baseUrl.includes('render.com') || 
            this.baseUrl.includes('onrender.com')
        );
    }

    /**
     * 初始化 Keep-Alive 服務
     */
    initialize() {
        if (!this.isEnabled) {
            console.log('🏠 Keep-Alive 服務僅在 Render 生產環境中啟用');
            return;
        }

        console.log('🚀 初始化 Keep-Alive 服務...');
        console.log(`🌐 目標 URL: ${this.baseUrl}`);

        try {
            // 設定多個喚醒時間點以確保服務持續運行
            this.setupKeepAliveSchedules();
            console.log('✅ Keep-Alive 服務初始化完成');
        } catch (error) {
            console.error('❌ Keep-Alive 服務初始化失敗:', error);
        }
    }

    /**
     * 設定多個喚醒排程
     */
    setupKeepAliveSchedules() {
        // 每日早上 7:45 喚醒（確保 8:00 前系統運行）
        const morningJob = cron.schedule('45 7 * * *', async () => {
            await this.pingService('晨間喚醒');
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        // 每日下午 1:45 喚醒
        const afternoonJob = cron.schedule('45 13 * * *', async () => {
            await this.pingService('午間喚醒');
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        // 每隔 12 分鐘喚醒一次，但避開 0-6 點（減少夜間資源消耗）
        const regularJob = cron.schedule('*/12 6-23 * * *', async () => {
            await this.pingService('定期喚醒');
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        // 每日晚上 11:30 喚醒
        const eveningJob = cron.schedule('30 23 * * *', async () => {
            await this.pingService('晚間喚醒');
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        this.keepAliveJobs = [morningJob, afternoonJob, regularJob, eveningJob];

        console.log('📅 Keep-Alive 排程已設定:');
        console.log('   - 每日 07:45 (晨間喚醒)');
        console.log('   - 每日 13:45 (午間喚醒)');
        console.log('   - 每 12 分鐘 (定期喚醒，6:00-23:59)');
        console.log('   - 每日 23:30 (晚間喚醒)');
    }

    /**
     * Ping 服務以保持喚醒
     */
    async pingService(reason = '定期檢查') {
        if (!this.isEnabled) {
            return;
        }

        try {
            console.log(`🏓 ${reason} - 正在 ping 服務...`);
            
            const startTime = Date.now();
            const response = await axios.get(`${this.baseUrl}/api/health`, {
                timeout: 30000, // 30 秒超時
                headers: {
                    'User-Agent': 'KeepAlive-Service/1.0',
                    'X-Keep-Alive': 'true'
                }
            });

            const responseTime = Date.now() - startTime;
            
            if (response.status === 200) {
                console.log(`✅ ${reason} 成功 - 響應時間: ${responseTime}ms`);
                console.log(`🔄 服務運行時間: ${Math.round(response.data.uptime || 0)} 秒`);
            } else {
                console.warn(`⚠️ ${reason} 異常響應: ${response.status}`);
            }

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log(`💤 ${reason} - 服務可能正在休眠中，嘗試喚醒...`);
            } else if (error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT') {
                console.log(`⏰ ${reason} - 請求超時，但可能已成功喚醒服務`);
            } else if (error.response) {
                // HTTP 錯誤響應
                const status = error.response.status;
                if (status === 502) {
                    console.log(`🔄 ${reason} - 服務暫時不可用 (502)，可能正在重啟中...`);
                } else if (status === 503) {
                    console.log(`⚠️ ${reason} - 服務暫時維護中 (503)，稍後重試...`);
                } else if (status >= 500) {
                    console.log(`🔧 ${reason} - 伺服器錯誤 (${status})，服務可能需要時間恢復...`);
                } else {
                    console.warn(`⚠️ ${reason} - HTTP 錯誤: ${status} ${error.response.statusText}`);
                }
            } else if (error.request) {
                // 網路連線問題
                console.log(`🌐 ${reason} - 網路連線問題，可能服務正在啟動中...`);
            } else {
                console.error(`❌ ${reason} 失敗:`, error.message);
            }
        }
    }

    /**
     * 立即執行一次 ping 測試
     */
    async testPing() {
        if (!this.isEnabled) {
            return { 
                success: false, 
                message: 'Keep-Alive 服務未啟用（僅在 Render 生產環境中運行）' 
            };
        }

        try {
            console.log(`🧪 手動測試 - 正在 ping 服務...`);
            
            const startTime = Date.now();
            const response = await axios.get(`${this.baseUrl}/api/health`, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'KeepAlive-Service-Test/1.0',
                    'X-Keep-Alive': 'manual-test'
                }
            });

            const responseTime = Date.now() - startTime;
            
            if (response.status === 200) {
                const message = `✅ 手動測試成功 - 響應時間: ${responseTime}ms, 運行時間: ${Math.round(response.data.uptime || 0)} 秒`;
                console.log(message);
                return { success: true, message: message };
            } else {
                const message = `⚠️ 手動測試異常響應: ${response.status}`;
                console.warn(message);
                return { success: false, message: message };
            }
            
        } catch (error) {
            let message = '';
            
            if (error.response) {
                const status = error.response.status;
                if (status === 502) {
                    message = `🔄 手動測試 - 服務暫時不可用 (502)，可能正在重啟中`;
                } else if (status === 503) {
                    message = `⚠️ 手動測試 - 服務暫時維護中 (503)`;
                } else {
                    message = `❌ 手動測試 HTTP 錯誤: ${status}`;
                }
            } else if (error.code === 'ECONNREFUSED') {
                message = `💤 手動測試 - 服務可能正在休眠中`;
            } else if (error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT') {
                message = `⏰ 手動測試 - 請求超時`;
            } else {
                message = `❌ 手動測試失敗: ${error.message}`;
            }
            
            console.log(message);
            return { success: false, message: message };
        }
    }

    /**
     * 取得服務狀態
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            baseUrl: this.baseUrl,
            activeJobs: this.keepAliveJobs.length,
            environment: process.env.NODE_ENV,
            nextSchedules: this.getNextScheduleTimes()
        };
    }

    /**
     * 取得下次排程執行時間
     */
    getNextScheduleTimes() {
        if (!this.isEnabled) {
            return [];
        }

        const now = new Date();
        const schedules = [];

        // 計算晨間喚醒時間 (7:45)
        const morning = new Date();
        morning.setHours(7, 45, 0, 0);
        if (morning <= now) {
            morning.setDate(morning.getDate() + 1);
        }
        schedules.push({ type: '晨間喚醒', time: morning.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) });

        // 計算午間喚醒時間 (13:45)
        const afternoon = new Date();
        afternoon.setHours(13, 45, 0, 0);
        if (afternoon <= now) {
            afternoon.setDate(afternoon.getDate() + 1);
        }
        schedules.push({ type: '午間喚醒', time: afternoon.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) });

        // 計算下次定期喚醒時間 (每 12 分鐘)
        const nextRegular = new Date(now.getTime() + (12 * 60 * 1000));
        nextRegular.setMinutes(Math.floor(nextRegular.getMinutes() / 12) * 12, 0, 0);
        schedules.push({ type: '定期喚醒', time: nextRegular.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) });

        // 計算晚間喚醒時間 (23:30)
        const evening = new Date();
        evening.setHours(23, 30, 0, 0);
        if (evening <= now) {
            evening.setDate(evening.getDate() + 1);
        }
        schedules.push({ type: '晚間喚醒', time: evening.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) });

        return schedules.sort((a, b) => new Date(a.time) - new Date(b.time));
    }

    /**
     * 停止所有 Keep-Alive 任務
     */
    stop() {
        this.keepAliveJobs.forEach(job => {
            job.stop();
            job.destroy();
        });
        this.keepAliveJobs = [];
        console.log('⏹️ Keep-Alive 服務已停止');
    }

    /**
     * 重啟 Keep-Alive 服務
     */
    restart() {
        this.stop();
        this.initialize();
        console.log('🔄 Keep-Alive 服務已重啟');
    }
}

// 建立單例實例
const keepAliveService = new KeepAliveService();

module.exports = keepAliveService;