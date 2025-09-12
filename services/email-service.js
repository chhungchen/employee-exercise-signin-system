const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const personalGoogleServices = require('./personal-google-services');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
        this.currentProvider = null;
        this.availableProviders = [];
        this.failedProviders = new Set();
    }

    // 初始化郵件服務
    async initialize() {
        console.log('🔧 初始化郵件服務...');
        
        // 檢測所有可用的 SMTP 提供者
        this.availableProviders = this.detectSMTPProviders();
        
        if (this.availableProviders.length === 0) {
            console.error('❌ 沒有可用的 SMTP 提供者');
            this.showConfigurationHelp();
            return false;
        }

        console.log(`🔍 發現 ${this.availableProviders.length} 個 SMTP 提供者:`, 
                   this.availableProviders.map(p => p.name).join(', '));

        // 嘗試連接到可用的提供者
        for (const provider of this.availableProviders) {
            if (this.failedProviders.has(provider.name)) {
                console.log(`⏭️ 跳過之前失敗的提供者: ${provider.name}`);
                continue;
            }

            console.log(`🔄 嘗試連接 ${provider.name}...`);
            
            if (await this.tryConnectProvider(provider)) {
                this.currentProvider = provider;
                this.initialized = true;
                console.log(`✅ 郵件服務初始化成功 (${provider.name})`);
                console.log(`📧 寄件者: ${provider.from}`);
                return true;
            } else {
                this.failedProviders.add(provider.name);
                console.log(`❌ ${provider.name} 連接失敗，嘗試下一個提供者...`);
            }
        }

        console.error('💀 所有 SMTP 提供者都連接失敗');
        return false;
    }

    // 檢測可用的 SMTP 提供者
    detectSMTPProviders() {
        const providers = [];

        // 1. Gmail SMTP
        if (process.env.SMTP_HOST === 'smtp.gmail.com' && 
            process.env.SMTP_USER && process.env.SMTP_PASS) {
            providers.push({
                name: 'Gmail SMTP',
                priority: 1,
                host: 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
                from: process.env.EMAIL_FROM || process.env.SMTP_USER,
                requiresAuth: true,
                type: 'gmail'
            });
        }

        // 2. SendGrid SMTP 
        if (process.env.SENDGRID_API_KEY) {
            providers.push({
                name: 'SendGrid SMTP',
                priority: 2,
                host: 'smtp.sendgrid.net',
                port: 587,
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY,
                from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER,
                requiresAuth: true,
                type: 'sendgrid'
            });
        }

        // 3. 自定義 SMTP（非 Gmail）
        if (process.env.SMTP_HOST && 
            process.env.SMTP_HOST !== 'smtp.gmail.com' && 
            process.env.SMTP_USER && process.env.SMTP_PASS) {
            providers.push({
                name: 'Custom SMTP',
                priority: 3,
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
                from: process.env.EMAIL_FROM || process.env.SMTP_USER,
                requiresAuth: true,
                type: 'custom'
            });
        }

        // 4. 公司內部 SMTP（匿名認證）
        if (process.env.SMTP_HOST && 
            process.env.SMTP_HOST.includes('jih-sun.com.tw')) {
            providers.push({
                name: 'Company Internal SMTP',
                priority: 4,
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 25,
                user: '',
                pass: '',
                from: process.env.EMAIL_FROM || 'system@inftfinance.com.tw',
                requiresAuth: false,
                type: 'internal'
            });
        }

        // 按優先級排序（數字越小優先級越高）
        return providers.sort((a, b) => a.priority - b.priority);
    }

    // 嘗試連接指定的提供者
    async tryConnectProvider(provider) {
        const maxRetries = 2; // 每個提供者重試 2 次
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 嘗試連線到 ${provider.name} (第 ${attempt}/${maxRetries} 次): ${provider.host}:${provider.port}`);
                
                // 建立 SMTP 傳輸器配置
                const transportConfig = this.createTransportConfig(provider);
                
                this.transporter = nodemailer.createTransport(transportConfig);

                // 驗證連線，設定超時
                const verifyPromise = this.transporter.verify();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('SMTP 驗證超時')), 15000);
                });
                
                await Promise.race([verifyPromise, timeoutPromise]);
                
                console.log(`✅ ${provider.name} 連接成功`);
                return true;

            } catch (error) {
                console.error(`❌ ${provider.name} 第 ${attempt} 次連線失敗:`, error.message);
                
                // 提供詳細的錯誤診斷
                this.diagnoseError(error, provider);
                
                // 最後一次重試失敗
                if (attempt === maxRetries) {
                    console.error(`💀 ${provider.name} 所有重試都失敗`);
                    return false;
                }
                
                // 等待後重試
                const retryDelay = attempt * 1000; // 1s, 2s
                console.log(`⏳ ${retryDelay/1000} 秒後重試...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
        return false;
    }

    // 創建傳輸器配置
    createTransportConfig(provider) {
        const transportConfig = {
            host: provider.host,
            port: parseInt(provider.port),
            secure: provider.port == 465, // true for 465, false for other ports
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

        // 根據提供者類型設定特定配置
        if (provider.type === 'gmail') {
            console.log('🔧 應用 Gmail SMTP 特定設定...');
            
            // Gmail 專用 TLS 設定（更寬鬆，適合雲端環境）
            transportConfig.tls = {
                rejectUnauthorized: false,
                // 強制使用 TLS 1.2 以上
                minVersion: 'TLSv1.2',
                // 允許更多的加密套件
                ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
                // 雲端環境優化
                secureProtocol: 'TLS_method',
                // 忽略憑證驗證問題（雲端環境常見）
                checkServerIdentity: false
            };

            // Gmail 連線優化
            transportConfig.requireTLS = true;
            transportConfig.secure = provider.port == 465;
            
            // 如果是 587 埠，啟用 STARTTLS
            if (provider.port == 587) {
                transportConfig.secure = false;
                transportConfig.requireTLS = true;
                transportConfig.tls.servername = 'smtp.gmail.com';
            }
        } else if (provider.type === 'sendgrid') {
            console.log('🔧 應用 SendGrid SMTP 特定設定...');
            
            // SendGrid 專用設定（雲端友善）
            transportConfig.tls = {
                rejectUnauthorized: false,
                // SendGrid 支援較新的 TLS
                minVersion: 'TLSv1.2',
                secureProtocol: 'TLS_method'
            };
            
            transportConfig.secure = false; // SendGrid 使用 STARTTLS
            transportConfig.requireTLS = true;
        } else {
            // 其他 SMTP 服務的 TLS 設定
            transportConfig.tls = {
                rejectUnauthorized: false // 接受自簽憑證
            };
        }

        // 只有需要認證時才加入 auth 設定
        if (provider.requiresAuth && provider.user && provider.pass) {
            transportConfig.auth = {
                user: provider.user,
                pass: provider.pass
            };
        }

        return transportConfig;
    }

    // 故障切換到下一個可用的提供者
    async switchToNextProvider() {
        console.log('🔄 正在嘗試故障切換到下一個提供者...');
        
        // 標記目前提供者為失敗
        if (this.currentProvider) {
            this.failedProviders.add(this.currentProvider.name);
            console.log(`❌ 標記 ${this.currentProvider.name} 為失敗`);
        }

        // 尋找下一個可用的提供者
        for (const provider of this.availableProviders) {
            if (this.failedProviders.has(provider.name)) {
                continue;
            }

            console.log(`🔄 嘗試切換到 ${provider.name}...`);
            
            if (await this.tryConnectProvider(provider)) {
                this.currentProvider = provider;
                this.initialized = true;
                console.log(`✅ 故障切換成功，現在使用 ${provider.name}`);
                return true;
            } else {
                this.failedProviders.add(provider.name);
            }
        }

        console.error('💀 所有提供者都失敗，故障切換失敗');
        this.initialized = false;
        return false;
    }

    // 取得 SMTP 配置（已棄用，現在使用 detectSMTPProviders）
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
        console.log(`   環境: ${process.env.NODE_ENV || 'unknown'}`);

        if (errorCode === 'EAUTH') {
            console.log('💡 認證失敗 - 可能原因:');
            if (config.host === 'smtp.gmail.com') {
                console.log('   🔐 Gmail SMTP 認證問題:');
                console.log('   - 應用程式密碼錯誤或過期');
                console.log('   - 帳號未啟用兩步驟驗證');
                console.log('   - 使用一般密碼而非應用程式密碼');
                console.log('   - Gmail 帳戶被暫時鎖定或限制');
                console.log('   💊 解決方案:');
                console.log('     1. 重新生成 Gmail 應用程式密碼');
                console.log('     2. 確認兩步驟驗證已啟用');
                console.log('     3. 檢查 Gmail 安全性設定');
            } else {
                console.log('   - 用戶名稱或密碼錯誤');
                console.log('   - SMTP 伺服器不支援當前認證方式');
            }
        } else if (errorCode === 'ECONNREFUSED') {
            console.log('💡 連線被拒絕 - 可能原因:');
            console.log('   - SMTP 主機或連接埠錯誤');
            console.log('   - 防火牆阻擋連線');
            console.log('   - SMTP 服務未啟動');
            if (config.host === 'smtp.gmail.com') {
                console.log('   🌐 Render 平台可能的問題:');
                console.log('   - Render 封鎖了 Gmail SMTP 連接埠');
                console.log('   - IP 被 Gmail 暫時封鎖');
                console.log('   💊 建議使用 SendGrid 或其他雲端 SMTP');
            }
        } else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
            console.log('💡 連線超時 - 可能原因:');
            console.log('   - 網路連線不穩定');
            console.log('   - SMTP 伺服器回應緩慢');
            console.log('   - 雲端環境網路限制');
            
            if (config.host.includes('jih-sun.com.tw')) {
                console.log('   ⚠️ 公司內部 SMTP 無法從雲端環境存取');
                console.log('   💡 建議: 在生產環境使用 Gmail SMTP');
            } else if (config.host === 'smtp.gmail.com') {
                console.log('   🌐 Gmail SMTP 連線超時:');
                console.log('   - Render 到 Gmail 的網路路徑不穩定');
                console.log('   - Gmail 對特定 IP 範圍有限制');
                console.log('   - TLS 握手失敗');
                console.log('   💊 解決方案:');
                console.log('     1. 重新部署應用程式（可能獲得新 IP）');
                console.log('     2. 使用 SendGrid 等替代 SMTP 服務');
                console.log('     3. 檢查 Gmail 帳戶活動記錄');
            }
        } else if (errorCode === 'ENOTFOUND') {
            console.log('💡 DNS 解析失敗 - 可能原因:');
            console.log('   - SMTP 主機名稱錯誤');
            console.log('   - DNS 伺服器無法解析主機名稱');
            console.log('   - 網路連線問題');
        } else if (errorCode === 'ESOCKET' || errorMessage.includes('socket')) {
            console.log('💡 Socket 連線錯誤 - 可能原因:');
            console.log('   - 網路連線中斷');
            console.log('   - 防火牆或代理服務器問題');
            console.log('   - SMTP 伺服器主動關閉連線');
        } else if (errorMessage.includes('TLS') || errorMessage.includes('SSL')) {
            console.log('💡 TLS/SSL 錯誤 - 可能原因:');
            console.log('   - TLS 版本不相容');
            console.log('   - 憑證驗證失敗');
            console.log('   - 加密套件不符合');
            if (config.host === 'smtp.gmail.com') {
                console.log('   💊 Gmail TLS 解決方案:');
                console.log('     1. 已套用寬鬆 TLS 設定');
                console.log('     2. 強制使用 TLS 1.2+');
                console.log('     3. 忽略憑證驗證問題');
            }
        } else {
            console.log('💡 其他錯誤:');
            console.log('   - 檢查網路連線');
            console.log('   - 驗證 SMTP 設定');
            console.log('   - 查看 SMTP 伺服器文件');
            if (config.host === 'smtp.gmail.com') {
                console.log('   💊 Gmail 一般性建議:');
                console.log('     1. 重新生成應用程式密碼');
                console.log('     2. 檢查 Gmail 帳戶狀態');
                console.log('     3. 考慮使用 OAuth2 認證');
            }
        }
        
        // 環境特定建議
        if (process.env.NODE_ENV === 'production') {
            console.log('🚀 生產環境特別建議:');
            console.log('   - 考慮使用專業的郵件服務 (SendGrid, Mailgun)');
            console.log('   - 設定郵件發送監控和警報');
            console.log('   - 準備備援郵件服務');
        }
    }

    // 顯示配置說明
    showConfigurationHelp() {
        console.log('💡 多重 SMTP 服務配置說明:');
        console.log('');
        console.log('🎯 推薦配置（優先級由高到低）:');
        console.log('');
        console.log('1️⃣ Gmail SMTP (基本選項):');
        console.log('   SMTP_HOST=smtp.gmail.com');
        console.log('   SMTP_PORT=587');
        console.log('   SMTP_USER=your-email@gmail.com');
        console.log('   SMTP_PASS=your-16-digit-app-password');
        console.log('   EMAIL_FROM=your-email@gmail.com');
        console.log('');
        console.log('2️⃣ SendGrid SMTP (雲端環境推薦):');
        console.log('   SENDGRID_API_KEY=your-sendgrid-api-key');
        console.log('   SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com');
        console.log('   ✅ 更穩定的雲端郵件服務');
        console.log('   ✅ 專為雲端平台優化');
        console.log('   ✅ 更好的送達率和監控');
        console.log('');
        console.log('3️⃣ 自定義 SMTP:');
        console.log('   SMTP_HOST=your-smtp-host.com');
        console.log('   SMTP_PORT=587');
        console.log('   SMTP_USER=your-smtp-username');
        console.log('   SMTP_PASS=your-smtp-password');
        console.log('   EMAIL_FROM=your-email@yourdomain.com');
        console.log('');
        console.log('🏢 公司內部 SMTP (僅限本地環境):');
        console.log('   SMTP_HOST=ex2016.jih-sun.com.tw');
        console.log('   SMTP_PORT=25');
        console.log('   ⚠️ 雲端環境無法使用內部 SMTP');
        console.log('');
        console.log('💡 故障切換機制:');
        console.log('   系統會自動嘗試所有可用的 SMTP 服務');
        console.log('   如果主要服務失敗，會切換到備援服務');
        console.log('   建議同時配置 Gmail 和 SendGrid 以確保可靠性');
    }

    // 發送郵件（支援自動故障切換）
    async sendEmail(to, subject, htmlContent, attachments = []) {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // 檢查服務是否已初始化
            if (!this.initialized || !this.transporter) {
                console.log(`⚠️ 郵件服務未初始化，嘗試重新初始化... (第 ${attempt}/${maxRetries} 次)`);
                
                const initSuccess = await this.initialize();
                if (!initSuccess) {
                    if (attempt === maxRetries) {
                        throw new Error('郵件服務初始化失敗，無法發送郵件');
                    }
                    continue;
                }
            }

            // 準備郵件內容
            const fromEmail = this.currentProvider?.from || process.env.EMAIL_FROM || process.env.SMTP_USER;
            
            const mailOptions = {
                from: `"員工運動系統" <${fromEmail}>`,
                to: to,
                subject: subject,
                html: htmlContent,
                attachments: attachments
            };

            try {
                console.log(`📧 嘗試發送郵件 (第 ${attempt}/${maxRetries} 次): ${this.currentProvider?.name}`);
                console.log(`📧 收件人: ${to}`);
                console.log(`📄 主旨: ${subject}`);
                
                const info = await this.transporter.sendMail(mailOptions);
                
                console.log(`✅ 郵件發送成功: ${info.messageId}`);
                console.log(`🚀 使用提供者: ${this.currentProvider?.name}`);
                
                return {
                    success: true,
                    messageId: info.messageId,
                    response: info.response,
                    provider: this.currentProvider?.name
                };

            } catch (error) {
                console.error(`❌ 郵件發送失敗 (${this.currentProvider?.name}):`, error.message);
                
                // 診斷錯誤
                if (this.currentProvider) {
                    this.diagnoseError(error, this.currentProvider);
                }

                // 如果不是最後一次嘗試，嘗試切換到下一個提供者
                if (attempt < maxRetries) {
                    console.log(`🔄 嘗試切換到下一個 SMTP 提供者...`);
                    
                    const switchSuccess = await this.switchToNextProvider();
                    if (!switchSuccess) {
                        console.error('💀 無法切換到其他 SMTP 提供者');
                        throw new Error(`所有 SMTP 提供者都失敗。最後錯誤: ${error.message}`);
                    }
                    
                    console.log(`✅ 已切換到 ${this.currentProvider?.name}，將重新嘗試發送`);
                    
                    // 等待一秒後重試
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    // 最後一次嘗試失敗
                    throw new Error(`郵件發送失敗，已嘗試 ${maxRetries} 次。最後錯誤: ${error.message}`);
                }
            }
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

    // 重置失敗的提供者（定期恢復機制）
    resetFailedProviders() {
        console.log('🔄 重置失敗的 SMTP 提供者，允許重新嘗試連接');
        const failedCount = this.failedProviders.size;
        this.failedProviders.clear();
        
        if (failedCount > 0) {
            console.log(`✅ 已重置 ${failedCount} 個失敗的提供者`);
            return true;
        }
        
        return false;
    }

    // 獲取服務狀態報告
    getServiceStatus() {
        const status = {
            initialized: this.initialized,
            currentProvider: this.currentProvider?.name || 'none',
            availableProviders: this.availableProviders.length,
            failedProviders: Array.from(this.failedProviders),
            providerDetails: this.availableProviders.map(p => ({
                name: p.name,
                type: p.type,
                priority: p.priority,
                host: p.host,
                port: p.port,
                status: this.failedProviders.has(p.name) ? 'failed' : 
                       (p.name === this.currentProvider?.name ? 'active' : 'available')
            }))
        };
        
        return status;
    }

    // 強制切換到指定的提供者
    async forceSwitch(providerName) {
        console.log(`🔧 嘗試強制切換到指定提供者: ${providerName}`);
        
        const targetProvider = this.availableProviders.find(p => p.name === providerName);
        if (!targetProvider) {
            throw new Error(`找不到指定的提供者: ${providerName}`);
        }

        // 暫時從失敗清單中移除
        this.failedProviders.delete(providerName);
        
        const success = await this.tryConnectProvider(targetProvider);
        if (success) {
            this.currentProvider = targetProvider;
            this.initialized = true;
            console.log(`✅ 強制切換成功，現在使用 ${providerName}`);
            return true;
        } else {
            this.failedProviders.add(providerName);
            console.error(`❌ 強制切換失敗: ${providerName}`);
            return false;
        }
    }

    // 測試所有可用的提供者
    async testAllProviders() {
        console.log('🧪 開始測試所有 SMTP 提供者...');
        
        const results = [];
        const currentProvider = this.currentProvider;
        
        for (const provider of this.availableProviders) {
            console.log(`🔍 測試 ${provider.name}...`);
            
            const startTime = Date.now();
            const success = await this.tryConnectProvider(provider);
            const duration = Date.now() - startTime;
            
            results.push({
                name: provider.name,
                type: provider.type,
                host: provider.host,
                port: provider.port,
                success: success,
                duration: duration,
                error: success ? null : `連接失敗 (${duration}ms)`
            });
            
            console.log(`${success ? '✅' : '❌'} ${provider.name}: ${duration}ms`);
        }
        
        // 恢復原始提供者
        if (currentProvider) {
            await this.tryConnectProvider(currentProvider);
            this.currentProvider = currentProvider;
        }
        
        console.log('🧪 提供者測試完成');
        return results;
    }

    // 啟動定期健康檢查
    startHealthCheck(intervalMinutes = 30) {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        console.log(`🏥 啟動 SMTP 服務健康檢查，間隔 ${intervalMinutes} 分鐘`);
        
        this.healthCheckInterval = setInterval(async () => {
            try {
                console.log('🏥 執行定期健康檢查...');
                
                // 檢查當前提供者
                if (this.currentProvider && this.transporter) {
                    try {
                        await this.transporter.verify();
                        console.log(`✅ 當前提供者 ${this.currentProvider.name} 狀態正常`);
                    } catch (error) {
                        console.error(`❌ 當前提供者 ${this.currentProvider.name} 健康檢查失敗:`, error.message);
                        
                        // 嘗試切換到其他提供者
                        const switchSuccess = await this.switchToNextProvider();
                        if (switchSuccess) {
                            console.log(`✅ 健康檢查：已自動切換到 ${this.currentProvider.name}`);
                        } else {
                            console.error('💀 健康檢查：無法切換到其他提供者');
                        }
                    }
                }
                
                // 每兩小時重置失敗的提供者
                const now = Date.now();
                if (!this.lastResetTime || (now - this.lastResetTime) > 2 * 60 * 60 * 1000) {
                    this.resetFailedProviders();
                    this.lastResetTime = now;
                }
                
            } catch (error) {
                console.error('❌ 健康檢查執行失敗:', error.message);
            }
        }, intervalMinutes * 60 * 1000);
        
        return this.healthCheckInterval;
    }

    // 停止健康檢查
    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('🏥 SMTP 健康檢查已停止');
        }
    }

    // 檢查服務狀態
    isConfigured() {
        return this.initialized && this.transporter !== null;
    }
}

module.exports = new EmailService();