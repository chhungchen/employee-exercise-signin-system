/**
 * 內網輔助郵件伺服器
 * 專用於企業內網環境，手動補發定期寄送缺漏
 * 優先使用企業SMTP，提供簡化後台介面
 */

const express = require('express');
const path = require('path');
const moment = require('moment');
const os = require('os');
const osUtils = require('os-utils');
const si = require('systeminformation');
const net = require('net');
const cron = require('node-cron');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const app = express();
const PORT = process.env.INTERNAL_PORT || 3001;

// 基本中間件設定
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 設定視圖引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 強制內網環境設定
process.env.NODE_ENV = 'internal';
process.env.FORCE_INTERNAL_SMTP = 'true';

console.log('🏠 內網輔助郵件伺服器啟動中...');
console.log(`📧 強制使用企業SMTP: ${process.env.INTERNAL_SMTP_HOST || 'ex2016.jih-sun.com.tw'}`);

// 載入郵件服務（企業SMTP優先）
let emailService;
try {
    emailService = require('./services/email-service');
    console.log('✅ 郵件服務載入成功');
} catch (error) {
    console.error('❌ 郵件服務載入失敗:', error.message);
    process.exit(1);
}

// 載入個人Google服務（數據讀取）
let personalGoogleServices;
try {
    const PersonalGoogleServices = require('./services/personal-google-services');
    personalGoogleServices = new PersonalGoogleServices();
    console.log('✅ Google服務載入成功');
} catch (error) {
    console.warn('⚠️ Google服務載入失敗，將使用模擬數據');
    personalGoogleServices = null;
}

// 首頁路由
app.get('/', (req, res) => {
    res.redirect('/admin/internal-email');
});

// 內網郵件管理後台
app.get('/admin/internal-email', (req, res) => {
    res.render('internal-email-admin', {
        title: '內網郵件補發工具',
        currentTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        smtpHost: process.env.INTERNAL_SMTP_HOST || 'ex2016.jih-sun.com.tw',
        smtpFrom: process.env.INTERNAL_SMTP_FROM || 'system@company.local'
    });
});

// 取得可用日期範圍
app.get('/api/internal/date-range', async (req, res) => {
    try {
        if (!personalGoogleServices) {
            // 模擬數據
            const endDate = moment();
            const startDate = moment().subtract(30, 'days');
            return res.json({
                success: true,
                dateRange: {
                    start: startDate.format('YYYY-MM-DD'),
                    end: endDate.format('YYYY-MM-DD'),
                    totalDays: 30
                }
            });
        }

        // 實際從Google Sheets獲取數據範圍
        await personalGoogleServices.initialize();
        const data = await personalGoogleServices.getAllSignInData();

        if (!data || data.length === 0) {
            return res.json({
                success: false,
                error: '無可用數據'
            });
        }

        const dates = data.map(row => moment(row.submitTime, 'YYYY/MM/DD HH:mm:ss').format('YYYY-MM-DD'))
                          .filter(date => moment(date).isValid())
                          .sort();

        res.json({
            success: true,
            dateRange: {
                start: dates[0],
                end: dates[dates.length - 1],
                totalDays: dates.length,
                availableDates: [...new Set(dates)]
            }
        });

    } catch (error) {
        console.error('❌ 取得日期範圍失敗:', error.message);
        res.status(500).json({
            success: false,
            error: `取得日期範圍失敗: ${error.message}`
        });
    }
});

// 取得收件人清單
app.get('/api/internal/recipients', async (req, res) => {
    try {
        // 預設收件人清單（從環境變數或配置獲取）
        const defaultRecipients = [
            'Jameschen@inftfinance.com.tw',
            'AngelChi@inftfinance.com.tw',
            'JoeLee@inftfinance.com.tw',
            'sunnywang@inftfinance.com.tw',
            'harehung@inftfinance.com.tw'
        ];

        res.json({
            success: true,
            recipients: defaultRecipients,
            totalCount: defaultRecipients.length
        });

    } catch (error) {
        console.error('❌ 取得收件人清單失敗:', error.message);
        res.status(500).json({
            success: false,
            error: `取得收件人清單失敗: ${error.message}`
        });
    }
});

// SMTP 測試端點
app.post('/api/internal/test-smtp', async (req, res) => {
    const { testEmail } = req.body;

    if (!testEmail) {
        return res.status(400).json({
            success: false,
            error: '請提供測試郵件地址'
        });
    }

    try {
        console.log(`🧪 開始 SMTP 連接測試，發送至: ${testEmail}`);

        const testSubject = 'SMTP 連接測試';
        const testHtml = `
            <h2>🧪 SMTP 連接測試</h2>
            <p>這是一封測試郵件，用於驗證內網輔助郵件伺服器的 SMTP 連接。</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h4>測試資訊</h4>
                <ul>
                    <li><strong>測試時間:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')} (UTC+8)</li>
                    <li><strong>伺服器:</strong> 內網輔助郵件伺服器</li>
                    <li><strong>端口:</strong> ${PORT}</li>
                </ul>
            </div>
            <p>如果您收到這封郵件，表示 SMTP 連接正常運作。</p>
        `;

        const result = await emailService.sendEmail(testEmail, testSubject, testHtml, []);

        console.log(`✅ SMTP 測試成功: ${result.messageId}`);

        res.json({
            success: true,
            message: 'SMTP 測試郵件發送成功',
            data: {
                recipient: testEmail,
                messageId: result.messageId,
                provider: result.provider,
                testTime: moment().format('YYYY-MM-DD HH:mm:ss')
            }
        });

    } catch (error) {
        console.error(`❌ SMTP 測試失敗:`, error);

        res.status(500).json({
            success: false,
            error: 'SMTP 測試失敗',
            details: error.message,
            testTime: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    }
});

// 手動補發郵件
app.post('/api/internal/send-manual', async (req, res) => {
    const { startDate, endDate, recipients, includePhotos = false, format = 'excel' } = req.body;

    try {
        console.log(`📧 開始手動補發: ${startDate} 至 ${endDate}, 收件人: ${recipients.length}人`);

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: '請提供開始和結束日期'
            });
        }

        if (!recipients || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: '請選擇至少一個收件人'
            });
        }

        // 獲取指定日期範圍的數據
        let reportData = [];
        if (personalGoogleServices) {
            await personalGoogleServices.initialize();
            const allData = await personalGoogleServices.getAllSignInData();

            reportData = allData.filter(row => {
                const rowDate = moment(row.submitTime, 'YYYY/MM/DD HH:mm:ss').format('YYYY-MM-DD');
                return rowDate >= startDate && rowDate <= endDate;
            });
        } else {
            // 模擬數據
            reportData = [
                {
                    submitTime: moment().format('YYYY/MM/DD HH:mm:ss'),
                    employeeId: 'TEST001',
                    name: '測試用戶',
                    department: '資訊部',
                    activity: '羽球',
                    location: '體育館'
                }
            ];
        }

        console.log(`📊 找到 ${reportData.length} 筆資料需要補發`);

        // 生成報告內容
        const reportContent = await generateReportContent(reportData, startDate, endDate, format, includePhotos);

        // 批量發送郵件
        const results = [];
        let successCount = 0;

        for (const recipient of recipients) {
            try {
                const subject = `員工運動簽到報告 ${startDate} 至 ${endDate}`;

                const result = await emailService.sendEmail(recipient, subject, reportContent.html, reportContent.attachments);

                results.push({
                    recipient,
                    success: true,
                    messageId: result.messageId,
                    provider: result.provider
                });

                successCount++;
                console.log(`✅ 成功發送至: ${recipient} (${result.provider})`);

            } catch (error) {
                results.push({
                    recipient,
                    success: false,
                    error: error.message
                });
                console.error(`❌ 發送失敗至: ${recipient} - ${error.message}`);
            }

            // 添加小延遲避免過載
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`📊 補發完成: ${successCount}/${recipients.length} 成功`);

        res.json({
            success: true,
            message: `郵件補發完成: ${successCount}/${recipients.length} 成功`,
            details: {
                totalRecipients: recipients.length,
                successCount,
                failureCount: recipients.length - successCount,
                dataRange: `${startDate} 至 ${endDate}`,
                recordCount: reportData.length,
                results
            }
        });

    } catch (error) {
        console.error('❌ 手動補發失敗:', error.message);
        res.status(500).json({
            success: false,
            error: `手動補發失敗: ${error.message}`
        });
    }
});

// 健康檢查與監控工具函數
async function getSystemMetrics() {
    return new Promise((resolve) => {
        osUtils.cpuUsage((cpuPercent) => {
            const metrics = {
                cpu: {
                    usage: Math.round(cpuPercent * 100 * 100) / 100, // 轉換為百分比並四捨五入
                    cores: os.cpus().length,
                    model: os.cpus()[0]?.model || 'Unknown',
                    loadAverage: os.loadavg()
                },
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem(),
                    usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100 * 100) / 100,
                    process: process.memoryUsage()
                },
                disk: {
                    // 使用process.cwd()獲取當前工作目錄的磁碟資訊
                    workingDirectory: process.cwd(),
                    platform: os.platform()
                },
                network: {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    arch: os.arch(),
                    interfaces: Object.keys(os.networkInterfaces()).length
                },
                uptime: {
                    system: os.uptime(),
                    process: process.uptime()
                }
            };
            resolve(metrics);
        });
    });
}

// SMTP連線健康檢查
async function checkSmtpHealth() {
    const smtpHost = process.env.INTERNAL_SMTP_HOST || 'ex2016.jih-sun.com.tw';
    const smtpPort = 25;
    const timeout = 5000;

    return new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        const cleanup = () => {
            socket.removeAllListeners();
            socket.destroy();
        };

        const timeoutHandler = setTimeout(() => {
            cleanup();
            resolve({
                status: 'timeout',
                host: smtpHost,
                port: smtpPort,
                latency: timeout,
                error: '連線超時'
            });
        }, timeout);

        socket.connect(smtpPort, smtpHost, () => {
            clearTimeout(timeoutHandler);
            const latency = Date.now() - startTime;
            cleanup();
            resolve({
                status: 'connected',
                host: smtpHost,
                port: smtpPort,
                latency: latency,
                message: 'SMTP連線正常'
            });
        });

        socket.on('error', (error) => {
            clearTimeout(timeoutHandler);
            cleanup();
            resolve({
                status: 'error',
                host: smtpHost,
                port: smtpPort,
                latency: Date.now() - startTime,
                error: error.message
            });
        });
    });
}

// 計算系統健康評分
function calculateHealthScore(metrics, smtpHealth) {
    let score = 100;

    // CPU評分 (30%)
    if (metrics.cpu.usage > 80) score -= 30;
    else if (metrics.cpu.usage > 60) score -= 15;
    else if (metrics.cpu.usage > 40) score -= 5;

    // 記憶體評分 (25%)
    if (metrics.memory.usagePercent > 90) score -= 25;
    else if (metrics.memory.usagePercent > 75) score -= 15;
    else if (metrics.memory.usagePercent > 60) score -= 5;

    // SMTP評分 (25%)
    if (smtpHealth.status === 'error') score -= 25;
    else if (smtpHealth.status === 'timeout') score -= 15;
    else if (smtpHealth.latency > 1000) score -= 10;
    else if (smtpHealth.latency > 500) score -= 5;

    // 進程健康評分 (20%)
    if (metrics.memory.process.rss > 500 * 1024 * 1024) score -= 10; // 超過500MB
    if (metrics.uptime.process < 60) score -= 10; // 運行時間少於1分鐘

    return Math.max(0, Math.min(100, score));
}

// 系統狀態檢查 (增強版)
app.get('/api/internal/status', async (req, res) => {
    try {
        // 並行獲取系統指標和SMTP健康狀態
        const [systemMetrics, smtpHealth] = await Promise.all([
            getSystemMetrics(),
            checkSmtpHealth()
        ]);

        // 計算健康評分
        const healthScore = calculateHealthScore(systemMetrics, smtpHealth);

        // 決定整體狀態
        let overallStatus = 'healthy';
        if (healthScore < 60) overallStatus = 'critical';
        else if (healthScore < 80) overallStatus = 'warning';

        const status = {
            // 基本伺服器資訊
            server: {
                status: overallStatus,
                healthScore: healthScore,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                startTime: moment().subtract(process.uptime(), 'seconds').format('YYYY-MM-DD HH:mm:ss'),
                currentTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                timezone: 'UTC+8'
            },

            // 系統資源詳細資訊
            system: {
                cpu: systemMetrics.cpu,
                memory: systemMetrics.memory,
                disk: systemMetrics.disk,
                network: systemMetrics.network,
                uptime: systemMetrics.uptime
            },

            // SMTP連線狀態
            smtp: smtpHealth,

            // 環境配置
            environment: {
                nodeEnv: process.env.NODE_ENV,
                internalMode: process.env.FORCE_INTERNAL_SMTP === 'true',
                smtpHost: process.env.INTERNAL_SMTP_HOST || 'ex2016.jih-sun.com.tw',
                smtpFrom: process.env.INTERNAL_SMTP_FROM || 'system@company.local',
                port: PORT,
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch
            },

            // 服務狀態
            services: {
                emailService: emailService ? 'loaded' : 'failed',
                googleServices: personalGoogleServices ? 'loaded' : 'simulated',
                pm2: 'running' // 假設使用PM2運行
            },

            // 效能指標
            performance: {
                memoryUsagePercent: systemMetrics.memory.usagePercent,
                cpuUsagePercent: systemMetrics.cpu.usage,
                smtpLatency: smtpHealth.latency,
                processMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
            }
        };

        res.json({
            success: true,
            status,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });

    } catch (error) {
        console.error('❌ 系統狀態檢查失敗:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    }
});

// 詳細健康檢查 API
app.get('/api/internal/health-detail', async (req, res) => {
    try {
        console.log('🔍 執行詳細健康檢查...');

        // 獲取詳細系統資訊
        const [systemMetrics, smtpHealth] = await Promise.all([
            getSystemMetrics(),
            checkSmtpHealth()
        ]);

        // 計算健康評分
        const healthScore = calculateHealthScore(systemMetrics, smtpHealth);

        // 建立詳細的健康報告
        const healthReport = {
            overall: {
                score: healthScore,
                status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                timezone: 'UTC+8'
            },

            components: {
                cpu: {
                    status: systemMetrics.cpu.usage > 80 ? 'critical' :
                           systemMetrics.cpu.usage > 60 ? 'warning' : 'ok',
                    usage: systemMetrics.cpu.usage,
                    cores: systemMetrics.cpu.cores,
                    model: systemMetrics.cpu.model,
                    loadAverage: systemMetrics.cpu.loadAverage,
                    threshold: {
                        warning: 60,
                        critical: 80
                    }
                },

                memory: {
                    status: systemMetrics.memory.usagePercent > 90 ? 'critical' :
                           systemMetrics.memory.usagePercent > 75 ? 'warning' : 'ok',
                    usage: systemMetrics.memory.usagePercent,
                    total: Math.round(systemMetrics.memory.total / 1024 / 1024 / 1024 * 100) / 100, // GB
                    free: Math.round(systemMetrics.memory.free / 1024 / 1024 / 1024 * 100) / 100, // GB
                    used: Math.round(systemMetrics.memory.used / 1024 / 1024 / 1024 * 100) / 100, // GB
                    process: {
                        rss: Math.round(systemMetrics.memory.process.rss / 1024 / 1024), // MB
                        heapTotal: Math.round(systemMetrics.memory.process.heapTotal / 1024 / 1024), // MB
                        heapUsed: Math.round(systemMetrics.memory.process.heapUsed / 1024 / 1024), // MB
                        external: Math.round(systemMetrics.memory.process.external / 1024 / 1024) // MB
                    },
                    threshold: {
                        warning: 75,
                        critical: 90
                    }
                },

                smtp: {
                    status: smtpHealth.status === 'connected' ? 'ok' :
                           smtpHealth.status === 'timeout' ? 'warning' : 'critical',
                    host: smtpHealth.host,
                    port: smtpHealth.port,
                    latency: smtpHealth.latency,
                    message: smtpHealth.message || smtpHealth.error,
                    threshold: {
                        warning: 500,
                        critical: 1000
                    }
                },

                disk: {
                    status: 'ok', // 簡化的磁碟檢查
                    workingDirectory: systemMetrics.disk.workingDirectory,
                    platform: systemMetrics.disk.platform
                },

                process: {
                    status: systemMetrics.uptime.process > 60 ? 'ok' : 'warning',
                    uptime: systemMetrics.uptime.process,
                    pid: process.pid,
                    version: process.version,
                    memoryUsage: Math.round(systemMetrics.memory.process.rss / 1024 / 1024) // MB
                }
            },

            recommendations: []
        };

        // 生成建議
        if (systemMetrics.cpu.usage > 80) {
            healthReport.recommendations.push({
                type: 'cpu',
                level: 'critical',
                message: 'CPU使用率過高，建議檢查系統負載或重啟服務'
            });
        }

        if (systemMetrics.memory.usagePercent > 90) {
            healthReport.recommendations.push({
                type: 'memory',
                level: 'critical',
                message: '記憶體使用率過高，建議重啟服務或檢查記憶體洩漏'
            });
        }

        if (smtpHealth.status !== 'connected') {
            healthReport.recommendations.push({
                type: 'smtp',
                level: 'critical',
                message: 'SMTP連線異常，請檢查企業郵件伺服器狀態'
            });
        }

        if (smtpHealth.latency > 1000) {
            healthReport.recommendations.push({
                type: 'smtp',
                level: 'warning',
                message: 'SMTP回應延遲較高，建議檢查網路狀況'
            });
        }

        if (systemMetrics.memory.process.rss > 500 * 1024 * 1024) {
            healthReport.recommendations.push({
                type: 'process',
                level: 'warning',
                message: '進程記憶體使用量較高，建議定期重啟服務'
            });
        }

        res.json({
            success: true,
            health: healthReport,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });

    } catch (error) {
        console.error('❌ 詳細健康檢查失敗:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    }
});

// 生成 Excel 檔案
function generateExcel(data) {
    try {
        const workbook = XLSX.utils.book_new();

        // 準備資料
        const worksheetData = [
            ['提交時間', '員工編號', '姓名', '部門', '運動項目', '簽到時間', '照片連結', '電子簽名']
        ];

        data.forEach(row => {
            worksheetData.push([
                row.created_at || '',
                row.employee_id || '',
                row.name || '',
                row.department || '',
                row.activity || '',
                row.signin_time || '',
                row.photo_filename || '',
                row.signature_filename || ''
            ]);
        });

        // 建立工作表
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // 設定欄位寬度
        const columnWidths = [
            { wch: 20 }, // 提交時間
            { wch: 12 }, // 員工編號
            { wch: 10 }, // 姓名
            { wch: 15 }, // 部門
            { wch: 20 }, // 運動項目
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
        // 如果失敗，返回空 Buffer
        return Buffer.alloc(0);
    }
}

// 生成 CSV 檔案
function generateCSV(data) {
    const headers = ['提交時間', '員工編號', '姓名', '部門', '運動項目', '簽到時間', '照片連結', '電子簽名'];
    let csvContent = headers.join(',') + '\n';

    data.forEach(row => {
        const csvRow = [
            `"${row.created_at || ''}"`,
            `"${row.employee_id || ''}"`,
            `"${row.name || ''}"`,
            `"${row.department || ''}"`,
            `"${row.activity || ''}"`,
            `"${row.signin_time || ''}"`,
            `"${row.photo_filename || ''}"`,
            `"${row.signature_filename || ''}"`
        ];
        csvContent += csvRow.join(',') + '\n';
    });

    return csvContent;
}

// 生成包含資料的 ZIP 檔案
async function generateZipWithData(data, startDate, endDate) {
    try {
        const zip = new JSZip();

        // 添加 CSV 檔案
        const csvData = generateCSV(data);
        zip.file('簽到記錄.csv', csvData);

        // 添加 Excel 檔案
        const excelData = generateExcel(data);
        zip.file('簽到記錄.xlsx', excelData);

        // 添加報告說明檔案
        const reportInfo = `員工運動簽到報告
報告期間: ${startDate} 至 ${endDate}
生成時間: ${moment().format('YYYY-MM-DD HH:mm:ss')} (UTC+8)
總記錄數: ${data.length} 筆

檔案說明:
- 簽到記錄.csv：逗號分隔值格式
- 簽到記錄.xlsx：完整簽到記錄 Excel 格式

本報告由內網輔助伺服器生成。
`;
        zip.file('報告說明.txt', reportInfo);

        console.log(`✅ ZIP 生成完成：包含 ${data.length} 筆記錄`);

        // 生成 ZIP 檔案
        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return zipBuffer;

    } catch (error) {
        console.error('生成 ZIP 失敗:', error);
        // 如果失敗，返回簡單版本
        const zip = new JSZip();
        const csvData = generateCSV(data);
        zip.file('簽到記錄.csv', csvData);
        zip.file('錯誤報告.txt', `ZIP 生成過程中發生錯誤：${error.message}\n\n生成時間：${moment().format('YYYY-MM-DD HH:mm:ss')}`);

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        return zipBuffer;
    }
}

// 生成報告內容
async function generateReportContent(data, startDate, endDate, format, includePhotos) {
    const totalRecords = data.length;
    const departments = [...new Set(data.map(row => row.department))];
    const activities = [...new Set(data.map(row => row.activity))];

    // 生成 ZIP 附件
    const zipBuffer = await generateZipWithData(data, startDate, endDate);
    const zipFilename = `運動簽到完整備份_${startDate}_${endDate}.zip`;

    const html = `
        <h2>📊 員工運動簽到報告</h2>
        <h3>📅 報告期間: ${startDate} 至 ${endDate}</h3>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4>📈 統計摘要</h4>
            <ul>
                <li><strong>總簽到次數:</strong> ${totalRecords} 次</li>
                <li><strong>參與部門:</strong> ${departments.length} 個 (${departments.join(', ')})</li>
                <li><strong>運動項目:</strong> ${activities.length} 項 (${activities.join(', ')})</li>
                <li><strong>報告生成時間:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')} (UTC+8)</li>
            </ul>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4>📎 附件說明</h4>
            <p>本郵件包含完整簽到記錄壓縮檔案，內含：</p>
            <ul>
                <li>📄 簽到記錄.xlsx：完整簽到記錄 Excel 格式</li>
                <li>📄 簽到記錄.csv：逗號分隔值格式</li>
                <li>📄 報告說明.txt：詳細說明文件</li>
            </ul>
        </div>

        <table border="1" style="border-collapse: collapse; width: 100%;">
            <thead style="background: #007bff; color: white;">
                <tr>
                    <th style="padding: 8px;">提交時間</th>
                    <th style="padding: 8px;">員工編號</th>
                    <th style="padding: 8px;">姓名</th>
                    <th style="padding: 8px;">部門</th>
                    <th style="padding: 8px;">運動項目</th>
                    <th style="padding: 8px;">簽到時間</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>
                        <td style="padding: 8px;">${row.created_at || row.submitTime || '-'}</td>
                        <td style="padding: 8px;">${row.employee_id || row.employeeId || '-'}</td>
                        <td style="padding: 8px;">${row.name || '-'}</td>
                        <td style="padding: 8px;">${row.department || '-'}</td>
                        <td style="padding: 8px;">${row.activity || '-'}</td>
                        <td style="padding: 8px;">${row.signin_time || row.signinTime || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 30px; padding: 15px; background: #f1f1f1; text-align: center; font-size: 12px; color: #666;">
            <p>📧 員工運動簽到系統</p>
            <p>生成時間: ${moment().format('YYYY-MM-DD HH:mm:ss')} (台灣時間 UTC+8)</p>
        </div>
    `;

    return {
        html,
        attachments: [
            {
                filename: zipFilename,
                content: zipBuffer,
                contentType: 'application/zip'
            }
        ]
    };
}

// 健康檢查歷史記錄存儲
let healthHistory = [];
const MAX_HEALTH_HISTORY = 100; // 保留最近100次健康檢查記錄

// 添加健康檢查記錄
function addHealthRecord(healthData) {
    const record = {
        ...healthData,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        id: Date.now()
    };

    healthHistory.unshift(record);

    // 保持記錄數量限制
    if (healthHistory.length > MAX_HEALTH_HISTORY) {
        healthHistory = healthHistory.slice(0, MAX_HEALTH_HISTORY);
    }

    console.log(`🔍 健康檢查完成 - 評分: ${healthData.overall.score}, 狀態: ${healthData.overall.status}`);
}

// 定期健康檢查函數
async function performScheduledHealthCheck() {
    try {
        const [systemMetrics, smtpHealth] = await Promise.all([
            getSystemMetrics(),
            checkSmtpHealth()
        ]);

        const healthScore = calculateHealthScore(systemMetrics, smtpHealth);

        const healthData = {
            overall: {
                score: healthScore,
                status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical'
            },
            components: {
                cpu: {
                    status: systemMetrics.cpu.usage > 80 ? 'critical' :
                           systemMetrics.cpu.usage > 60 ? 'warning' : 'ok',
                    usage: systemMetrics.cpu.usage
                },
                memory: {
                    status: systemMetrics.memory.usagePercent > 90 ? 'critical' :
                           systemMetrics.memory.usagePercent > 75 ? 'warning' : 'ok',
                    usage: systemMetrics.memory.usagePercent
                },
                smtp: {
                    status: smtpHealth.status === 'connected' ? 'ok' :
                           smtpHealth.status === 'timeout' ? 'warning' : 'critical',
                    latency: smtpHealth.latency
                }
            }
        };

        addHealthRecord(healthData);

        // 檢查是否需要告警
        if (healthScore < 60) {
            console.log('🚨 CRITICAL: 系統健康狀態危險，評分:', healthScore);
        } else if (healthScore < 80) {
            console.log('⚠️ WARNING: 系統健康狀態警告，評分:', healthScore);
        }

    } catch (error) {
        console.error('❌ 定期健康檢查失敗:', error.message);

        // 記錄錯誤狀態
        addHealthRecord({
            overall: {
                score: 0,
                status: 'error'
            },
            components: {
                cpu: { status: 'unknown', usage: -1 },
                memory: { status: 'unknown', usage: -1 },
                smtp: { status: 'unknown', latency: -1 }
            },
            error: error.message
        });
    }
}

// 健康檢查歷史API
app.get('/api/internal/health-history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const limitedHistory = healthHistory.slice(0, Math.min(limit, healthHistory.length));

        res.json({
            success: true,
            history: limitedHistory,
            total: healthHistory.length,
            maxRecords: MAX_HEALTH_HISTORY,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    }
});

// 健康檢查統計API
app.get('/api/internal/health-stats', (req, res) => {
    try {
        if (healthHistory.length === 0) {
            return res.json({
                success: true,
                stats: {
                    message: '尚無健康檢查記錄'
                },
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
            });
        }

        const stats = {
            totalChecks: healthHistory.length,
            avgScore: Math.round(healthHistory.reduce((sum, record) => sum + record.overall.score, 0) / healthHistory.length),
            statusDistribution: {
                healthy: healthHistory.filter(r => r.overall.status === 'healthy').length,
                warning: healthHistory.filter(r => r.overall.status === 'warning').length,
                critical: healthHistory.filter(r => r.overall.status === 'critical').length,
                error: healthHistory.filter(r => r.overall.status === 'error').length
            },
            latestScore: healthHistory[0]?.overall.score || 0,
            latestStatus: healthHistory[0]?.overall.status || 'unknown',
            lastCheck: healthHistory[0]?.timestamp || 'N/A'
        };

        res.json({
            success: true,
            stats,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        });
    }
});

// 啟動定期健康檢查 (每30秒執行一次)
let healthCheckScheduler = null;

function startHealthCheckScheduler() {
    if (healthCheckScheduler) {
        healthCheckScheduler.stop();
    }

    // 每30秒執行一次健康檢查
    healthCheckScheduler = cron.schedule('*/30 * * * * *', async () => {
        await performScheduledHealthCheck();
    }, {
        scheduled: false
    });

    healthCheckScheduler.start();
    console.log('🕒 定期健康檢查排程器已啟動 (每30秒執行)');

    // 立即執行一次健康檢查
    performScheduledHealthCheck();
}

function stopHealthCheckScheduler() {
    if (healthCheckScheduler) {
        healthCheckScheduler.stop();
        healthCheckScheduler = null;
        console.log('🕒 定期健康檢查排程器已停止');
    }
}

// 優雅關閉處理
process.on('SIGTERM', () => {
    console.log('📴 收到SIGTERM信號，準備關閉伺服器...');
    stopHealthCheckScheduler();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 收到SIGINT信號，準備關閉伺服器...');
    stopHealthCheckScheduler();
    process.exit(0);
});

// 啟動伺服器
app.listen(PORT, '127.0.0.1', () => {
    console.log('🚀 內網輔助郵件伺服器已啟動');
    console.log(`📱 管理介面: http://localhost:${PORT}/admin/internal-email`);
    console.log(`🔧 系統狀態: http://localhost:${PORT}/api/internal/status`);
    console.log(`📧 企業SMTP: ${process.env.INTERNAL_SMTP_HOST || 'ex2016.jih-sun.com.tw'}`);
    console.log(`⏰ 啟動時間: ${moment().format('YYYY-MM-DD HH:mm:ss')} (UTC+8)`);
    console.log('✅ 內網輔助伺服器就緒，可開始手動補發作業');

    // 啟動健康檢查排程器
    startHealthCheckScheduler();
});