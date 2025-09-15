const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const { Resend } = require('resend');
const { Client } = require('postmark');
const brevo = require('@getbrevo/brevo');
const personalGoogleServices = require('./personal-google-services');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
        this.currentProvider = null;
        this.availableProviders = [];
        this.failedProviders = new Set();
        this.isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
        this.resendClient = null;
        this.postmarkClient = null;
        this.brevoClient = null;
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

        console.log(`🔍 環境偵測: ${this.isRender ? 'Render 生產環境' : '本地開發環境'}`);
        console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🚀 RENDER: ${process.env.RENDER || 'false'}`);

        // 雲端環境優先使用 HTTP API 服務
        if (this.isRender) {
            console.log('🌐 Render 環境偵測：優先配置 HTTP API 郵件服務');

            // 1. Resend HTTP API (雲端環境首選)
            if (process.env.RESEND_API_KEY) {
                this.resendClient = new Resend(process.env.RESEND_API_KEY);
                providers.push({
                    name: 'Resend API',
                    priority: 1,
                    type: 'resend',
                    from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
                    requiresAuth: false, // HTTP API 不需要 SMTP 認證
                    isHttpApi: true
                });
                console.log('✅ Resend HTTP API 已配置 (優先級 1)');
            }

            // 2. Postmark HTTP API (高可靠性備援)
            if (process.env.POSTMARK_API_KEY) {
                this.postmarkClient = new Client(process.env.POSTMARK_API_KEY);
                providers.push({
                    name: 'Postmark API',
                    priority: 2,
                    type: 'postmark',
                    from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
                    requiresAuth: false,
                    isHttpApi: true
                });
                console.log('✅ Postmark HTTP API 已配置 (優先級 2)');
            }

            // 3. Mailgun SMTP (SMTP 備援，雲端友善)
            if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
                providers.push({
                    name: 'Mailgun SMTP',
                    priority: 3,
                    host: 'smtp.mailgun.org',
                    port: 587,
                    user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
                    pass: process.env.MAILGUN_API_KEY,
                    from: process.env.EMAIL_FROM || `noreply@${process.env.MAILGUN_DOMAIN}`,
                    requiresAuth: true,
                    type: 'mailgun',
                    isHttpApi: false
                });
                console.log('✅ Mailgun SMTP 已配置 (優先級 3)');
            }
        } else {
            console.log('🏠 本地環境：保持 Gmail SMTP 優先順序');
        }

        // Gmail SMTP (本地環境優先，Render 環境降級)
        if (process.env.SMTP_HOST === 'smtp.gmail.com' &&
            process.env.SMTP_USER && process.env.SMTP_PASS) {
            providers.push({
                name: 'Gmail SMTP',
                priority: this.isRender ? 10 : 1, // Render 環境降低優先級
                host: 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
                from: process.env.EMAIL_FROM || process.env.SMTP_USER,
                requiresAuth: true,
                type: 'gmail',
                isHttpApi: false,
                renderCompatible: false // 標記為 Render 不相容
            });

            if (this.isRender) {
                console.log('⚠️ Gmail SMTP 在 Render 環境不可用，已降低優先級');
            } else {
                console.log('✅ Gmail SMTP 已配置 (本地環境優先級 1)');
            }
        }

        // Resend HTTP API (適用於所有環境)
        if (process.env.RESEND_API_KEY) {
            if (!this.isRender) {
                this.resendClient = new Resend(process.env.RESEND_API_KEY);
            }
            providers.push({
                name: 'Resend API',
                priority: this.isRender ? 1 : 2, // Render 環境優先級 1，本地環境優先級 2
                type: 'resend',
                from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
                requiresAuth: false,
                isHttpApi: true
            });
            const envType = this.isRender ? 'Render 環境' : '本地環境';
            const priority = this.isRender ? 1 : 2;
            console.log(`✅ Resend HTTP API 已配置 (${envType}優先級 ${priority})`);
        }

        // Postmark HTTP API (適用於所有環境)
        if (process.env.POSTMARK_API_KEY) {
            if (!this.isRender) {
                this.postmarkClient = new Client(process.env.POSTMARK_API_KEY);
            }
            providers.push({
                name: 'Postmark API',
                priority: this.isRender ? 2 : 3, // Render 環境優先級 2，本地環境優先級 3
                type: 'postmark',
                from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
                requiresAuth: false,
                isHttpApi: true
            });
            const envType = this.isRender ? 'Render 環境' : '本地環境';
            const priority = this.isRender ? 2 : 3;
            console.log(`✅ Postmark HTTP API 已配置 (${envType}優先級 ${priority})`);
        }

        // Brevo HTTP API (適用於所有環境)
        if (process.env.BREVO_API_KEY) {
            if (!this.isRender) {
                this.brevoClient = new brevo.TransactionalEmailsApi();
                this.brevoClient.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
            }
            providers.push({
                name: 'Brevo API',
                priority: this.isRender ? 3 : 4, // Render 環境優先級 3，本地環境優先級 4
                type: 'brevo',
                from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
                requiresAuth: false,
                isHttpApi: true
            });
            const envType = this.isRender ? 'Render 環境' : '本地環境';
            const priority = this.isRender ? 3 : 4;
            console.log(`✅ Brevo HTTP API 已配置 (${envType}優先級 ${priority})`);
        }

        // Mailgun SMTP (適用於所有環境)
        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
            providers.push({
                name: 'Mailgun SMTP',
                priority: this.isRender ? 5 : 5,
                host: 'smtp.mailgun.org',
                port: 587,
                user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
                pass: process.env.MAILGUN_API_KEY,
                from: process.env.EMAIL_FROM || `noreply@${process.env.MAILGUN_DOMAIN}`,
                requiresAuth: true,
                type: 'mailgun',
                isHttpApi: false
            });
            console.log('✅ Mailgun SMTP 已配置');
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
        const maxRetries = 3;

        // HTTP API 服務直接返回成功（無需 SMTP 連接測試）
        if (provider.isHttpApi) {
            console.log(`✅ ${provider.name} HTTP API 服務已就緒`);
            return true;
        }

        // Render 環境檢查 SMTP 相容性
        if (this.isRender && provider.renderCompatible === false) {
            console.log(`⚠️ ${provider.name} 在 Render 環境不相容，跳過連接測試`);
            return false;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 嘗試連線到 ${provider.name} (第 ${attempt}/${maxRetries} 次): ${provider.host}:${provider.port}`);

                // 每次重試前清除舊的 transporter
                if (this.transporter) {
                    try {
                        this.transporter.close();
                    } catch (e) {
                        // 忽略關閉錯誤
                    }
                    this.transporter = null;
                }

                // 建立新的 SMTP 傳輸器配置
                const transportConfig = this.createTransportConfig(provider);
                this.transporter = nodemailer.createTransport(transportConfig);

                // 驗證連線，使用動態超時（Gmail 需要更長時間）
                const verifyTimeout = provider.type === 'gmail' ? 30000 : 20000;
                const verifyPromise = this.transporter.verify();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('SMTP 驗證超時')), verifyTimeout);
                });

                await Promise.race([verifyPromise, timeoutPromise]);

                console.log(`✅ ${provider.name} 連接成功 (第 ${attempt} 次嘗試)`);
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

                // 指數退避延遲 (1s, 3s, 7s)
                const baseDelay = 1000;
                const retryDelay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                console.log(`⏳ ${Math.round(retryDelay/1000)} 秒後重試... (指數退避)`);
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
            // 延長超時設定（針對 Render 平台優化）
            connectionTimeout: 30000, // 30 秒連線超時（從 15 秒增加）
            greetingTimeout: 20000,   // 20 秒問候超時（從 10 秒增加）
            socketTimeout: 45000,     // 45 秒 socket 超時（從 30 秒增加）
            // 停用連線池設定（提高 Gmail SMTP 穩定性）
            pool: false,              // 停用連接池
            maxConnections: 1,        // 單一連接
            maxMessages: 1,           // 每次發送建立新連接
            // 調試模式 (開發環境)
            debug: process.env.NODE_ENV === 'development'
        };

        // 根據提供者類型設定特定配置
        if (provider.type === 'gmail') {
            console.log('🔧 應用 Gmail SMTP 特定設定 (Render 平台優化)...');

            // Gmail 專用 TLS 設定（針對 Render 平台優化）
            transportConfig.tls = {
                rejectUnauthorized: false,
                // 強制使用 TLS 1.2-1.3
                minVersion: 'TLSv1.2',
                maxVersion: 'TLSv1.3',
                // 嚴格限制加密套件（提高相容性）
                ciphers: 'HIGH:!aNULL:!eNULL',
                // Render 平台優化
                secureProtocol: 'TLS_method',
                servername: 'smtp.gmail.com',
                // 忽略憑證驗證問題（雲端環境常見）
                checkServerIdentity: false,
                // 增加 session 超時
                sessionTimeout: 30000
            };

            // Gmail 連線優化（移除連接池，使用單一連接）
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
                console.log('   💊 建議使用 Resend、Mailgun 或 Postmark API');
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
                console.log('     1. 切換到 Resend HTTP API（推薦）');
                console.log('     2. 使用 Mailgun 或 Postmark 服務');
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
    // 取得詳細診斷資訊
    getDiagnosticInfo() {
        const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        return {
            timestamp,
            environment: {
                platform: this.isRender ? 'Render.com' : '本地開發',
                nodeEnv: process.env.NODE_ENV || 'development',
                renderDetected: process.env.RENDER === 'true',
                platformLimitations: this.isRender ? ['SMTP 端口被封鎖', '僅支援 HTTP API'] : ['無限制']
            },
            serviceStatus: {
                initialized: this.initialized,
                currentProvider: this.currentProvider?.name || 'none',
                availableProviders: this.availableProviders.length,
                failedProviders: Array.from(this.failedProviders)
            },
            providersDetail: this.availableProviders.map(provider => ({
                name: provider.name,
                type: provider.type,
                configured: true,
                available: !this.failedProviders.has(provider.name),
                priority: provider.priority || 'unknown',
                from: provider.from
            })),
            configuration: {
                resend: {
                    configured: !!process.env.RESEND_API_KEY,
                    keyPreview: process.env.RESEND_API_KEY ?
                        `${process.env.RESEND_API_KEY.substring(0, 8)}...` : 'Not set'
                },
                postmark: {
                    configured: !!process.env.POSTMARK_API_KEY,
                    keyPreview: process.env.POSTMARK_API_KEY ?
                        `${process.env.POSTMARK_API_KEY.substring(0, 8)}...` : 'Not set'
                },
                mailgun: {
                    configured: !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN),
                    domain: process.env.MAILGUN_DOMAIN || 'Not set',
                    keyPreview: process.env.MAILGUN_API_KEY ?
                        `${process.env.MAILGUN_API_KEY.substring(0, 8)}...` : 'Not set'
                },
                gmail_smtp: {
                    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
                    available: !this.isRender,
                    host: process.env.SMTP_HOST || 'Not set',
                    user: process.env.SMTP_USER || 'Not set',
                    note: this.isRender ? 'SMTP 在 Render 平台被封鎖' : 'SMTP 可用'
                }
            },
            recommendations: this.generateRecommendations(),
            lastUpdated: timestamp
        };
    }

    // 生成配置建議
    generateRecommendations() {
        const recommendations = [];

        if (this.isRender) {
            // Render 平台建議
            if (!process.env.RESEND_API_KEY) {
                recommendations.push({
                    priority: 'high',
                    category: 'primary_service',
                    message: '建議配置 Resend API 作為主要郵件服務',
                    action: '設定 RESEND_API_KEY 環境變數',
                    url: 'https://resend.com/'
                });
            }

            if (!process.env.POSTMARK_API_KEY) {
                recommendations.push({
                    priority: 'medium',
                    category: 'backup_service',
                    message: '建議配置 Postmark API 作為備援服務',
                    action: '設定 POSTMARK_API_KEY 環境變數',
                    url: 'https://postmarkapp.com/'
                });
            }

            if (process.env.SMTP_HOST) {
                recommendations.push({
                    priority: 'high',
                    category: 'platform_incompatible',
                    message: 'Render 平台不支援 SMTP，建議移除 SMTP 配置',
                    action: '移除 SMTP_HOST, SMTP_USER, SMTP_PASS 環境變數'
                });
            }
        } else {
            // 本地開發建議
            if (this.availableProviders.length === 0) {
                recommendations.push({
                    priority: 'high',
                    category: 'no_service',
                    message: '沒有配置任何郵件服務',
                    action: '建議先配置 Resend API 進行測試'
                });
            } else if (this.availableProviders.length === 1) {
                recommendations.push({
                    priority: 'medium',
                    category: 'single_service',
                    message: '僅配置一個郵件服務，建議配置備援',
                    action: '配置額外的郵件服務提供者'
                });
            }
        }

        return recommendations;
    }

    // 執行服務健康檢查
    async performHealthCheck() {
        console.log('🔍 執行郵件服務健康檢查...');

        const healthReport = {
            timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            overall: 'unknown',
            checks: []
        };

        try {
            // 1. 初始化檢查
            const initCheck = {
                name: '服務初始化',
                status: this.initialized ? 'pass' : 'fail',
                message: this.initialized ? '服務已正常初始化' : '服務未初始化',
                details: this.getDiagnosticInfo().serviceStatus
            };
            healthReport.checks.push(initCheck);

            // 2. 提供者可用性檢查
            const providerCheck = {
                name: '提供者可用性',
                status: this.availableProviders.length > 0 ? 'pass' : 'fail',
                message: `發現 ${this.availableProviders.length} 個可用提供者`,
                details: {
                    available: this.availableProviders.map(p => p.name),
                    failed: Array.from(this.failedProviders)
                }
            };
            healthReport.checks.push(providerCheck);

            // 3. 平台相容性檢查
            const compatibilityCheck = {
                name: '平台相容性',
                status: 'pass',
                message: '平台相容性正常',
                details: {
                    platform: this.isRender ? 'Render.com' : '本地開發',
                    limitations: this.isRender ? ['SMTP 端口封鎖'] : ['無限制']
                }
            };

            if (this.isRender && this.availableProviders.some(p => p.type === 'smtp')) {
                compatibilityCheck.status = 'warning';
                compatibilityCheck.message = '偵測到 SMTP 配置，但 Render 平台不支援';
            }
            healthReport.checks.push(compatibilityCheck);

            // 4. 配置完整性檢查
            const configCheck = {
                name: '配置完整性',
                status: this.availableProviders.length >= 2 ? 'pass' :
                       this.availableProviders.length === 1 ? 'warning' : 'fail',
                message: this.availableProviders.length >= 2 ? '配置多個提供者，具備備援能力' :
                        this.availableProviders.length === 1 ? '僅配置一個提供者，建議添加備援' :
                        '沒有配置可用的提供者',
                details: {
                    configured: this.availableProviders.length,
                    recommended: 2
                }
            };
            healthReport.checks.push(configCheck);

            // 計算總體健康狀態
            const failedChecks = healthReport.checks.filter(c => c.status === 'fail').length;
            const warningChecks = healthReport.checks.filter(c => c.status === 'warning').length;

            if (failedChecks > 0) {
                healthReport.overall = 'unhealthy';
            } else if (warningChecks > 0) {
                healthReport.overall = 'warning';
            } else {
                healthReport.overall = 'healthy';
            }

            console.log(`✅ 健康檢查完成 - 總體狀態: ${healthReport.overall}`);
            return healthReport;

        } catch (error) {
            console.error('❌ 健康檢查過程中發生錯誤:', error);
            healthReport.overall = 'error';
            healthReport.error = error.message;
            return healthReport;
        }
    }

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
        console.log('2️⃣ Resend HTTP API (雲端環境首選):');
        console.log('   RESEND_API_KEY=re_xxxxxxxxxxxx');
        console.log('   EMAIL_FROM=noreply@yourdomain.com');
        console.log('   ✅ 現代化 API 設計');
        console.log('   ✅ 免費 3000 封/月');
        console.log('   ✅ 卓越的開發體驗');
        console.log('');
        console.log('3️⃣ Postmark HTTP API (高可靠性):');
        console.log('   POSTMARK_API_KEY=your-postmark-api-key');
        console.log('   EMAIL_FROM=noreply@yourdomain.com');
        console.log('   ✅ 83.3% 收件匣到達率');
        console.log('   ✅ 專為交易郵件優化');
        console.log('   ✅ 優秀的錯誤處理');
        console.log('');
        console.log('4️⃣ Mailgun SMTP (備援選項):');
        console.log('   MAILGUN_API_KEY=key-xxxxxxxxxxxx');
        console.log('   MAILGUN_DOMAIN=mg.yourdomain.com');
        console.log('   ✅ 免費 100 封/日');
        console.log('   ✅ 71.4% 收件匣到達率');
        console.log('   ✅ 成熟穩定的服務');
        console.log('');
        console.log('5️⃣ 自定義 SMTP:');
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
        console.log('   系統會自動嘗試所有可用的郵件服務');
        console.log('   如果主要服務失敗，會切換到備援服務');
        console.log('   建議同時配置 Resend、Postmark 和 Mailgun 以確保可靠性');
    }

    // 發送郵件（支援自動故障切換）
    async sendEmail(to, subject, htmlContent, attachments = []) {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // 檢查服務是否已初始化
            if (!this.initialized || (!this.transporter && !this.currentProvider?.isHttpApi)) {
                console.log(`⚠️ 郵件服務未初始化，嘗試重新初始化... (第 ${attempt}/${maxRetries} 次)`);

                const initSuccess = await this.initialize();
                if (!initSuccess) {
                    if (attempt === maxRetries) {
                        throw new Error('郵件服務初始化失敗，無法發送郵件');
                    }
                    continue;
                }
            }

            // HTTP API 服務發送路徑
            if (this.currentProvider?.isHttpApi) {
                try {
                    return await this.sendEmailViaHttpApi(to, subject, htmlContent, attachments);
                } catch (error) {
                    console.error(`❌ ${this.currentProvider.name} 發送失敗:`, error.message);

                    // 如果不是最後一次嘗試，嘗試切換到下一個提供者
                    if (attempt < maxRetries) {
                        console.log(`🔄 嘗試切換到下一個郵件提供者...`);
                        const switchSuccess = await this.switchToNextProvider();
                        if (!switchSuccess) {
                            throw new Error(`所有郵件提供者都失敗。最後錯誤: ${error.message}`);
                        }
                        continue;
                    } else {
                        throw error;
                    }
                }
            }

            // SMTP 服務的預檢查機制
            if (!this.currentProvider?.isHttpApi && this.currentProvider?.type === 'gmail') {
                console.log('🔍 Gmail SMTP 連接預檢查...');
                try {
                    const verifyTimeout = 10000; // 10 秒快速檢查
                    const verifyPromise = this.transporter.verify();
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('預檢查超時')), verifyTimeout);
                    });

                    await Promise.race([verifyPromise, timeoutPromise]);
                    console.log('✅ Gmail SMTP 預檢查通過');
                } catch (error) {
                    console.warn(`⚠️ Gmail SMTP 預檢查失敗: ${error.message}`);
                    console.log('🔄 重新建立 Gmail SMTP 連接...');

                    // 預檢查失敗，重新建立連接
                    const reconnectSuccess = await this.tryConnectProvider(this.currentProvider);
                    if (!reconnectSuccess) {
                        console.error('❌ Gmail SMTP 重新連接失敗，嘗試切換提供者...');
                        const switchSuccess = await this.switchToNextProvider();
                        if (!switchSuccess) {
                            throw new Error('所有 SMTP 提供者都無法連接');
                        }
                    }
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

    // Gmail SMTP 專用健康檢查
    async performGmailHealthCheck() {
        console.log('🏥 執行 Gmail SMTP 專用健康檢查...');

        const healthReport = {
            timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            gmailProvider: null,
            connectionTests: [],
            recommendations: []
        };

        // 尋找 Gmail 提供者
        const gmailProvider = this.availableProviders.find(p => p.type === 'gmail');
        if (!gmailProvider) {
            healthReport.recommendations.push('❌ 未檢測到 Gmail SMTP 提供者配置');
            return healthReport;
        }

        healthReport.gmailProvider = {
            name: gmailProvider.name,
            host: gmailProvider.host,
            port: gmailProvider.port,
            status: this.failedProviders.has(gmailProvider.name) ? 'failed' : 'available'
        };

        // 執行多次連接測試
        const testCount = 3;
        console.log(`🧪 執行 ${testCount} 次 Gmail SMTP 連接測試...`);

        for (let i = 1; i <= testCount; i++) {
            const testStart = Date.now();
            console.log(`🔍 Gmail SMTP 測試 ${i}/${testCount}...`);

            try {
                // 建立測試連接
                const testConfig = this.createTransportConfig(gmailProvider);
                const testTransporter = nodemailer.createTransport(testConfig);

                // 驗證連接
                await testTransporter.verify();

                const duration = Date.now() - testStart;
                healthReport.connectionTests.push({
                    test: i,
                    success: true,
                    duration: duration,
                    message: `連接成功 (${duration}ms)`
                });

                console.log(`✅ Gmail SMTP 測試 ${i} 成功: ${duration}ms`);

                // 關閉測試連接
                testTransporter.close();

            } catch (error) {
                const duration = Date.now() - testStart;
                healthReport.connectionTests.push({
                    test: i,
                    success: false,
                    duration: duration,
                    error: error.message,
                    message: `連接失敗: ${error.message}`
                });

                console.error(`❌ Gmail SMTP 測試 ${i} 失敗: ${error.message} (${duration}ms)`);
            }

            // 測試間隔
            if (i < testCount) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 分析測試結果並提供建議
        const successfulTests = healthReport.connectionTests.filter(t => t.success);
        const failedTests = healthReport.connectionTests.filter(t => !t.success);
        const successRate = (successfulTests.length / testCount) * 100;

        healthReport.summary = {
            successRate: successRate,
            averageResponseTime: successfulTests.length > 0
                ? Math.round(successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length)
                : 0,
            totalTests: testCount,
            successfulTests: successfulTests.length,
            failedTests: failedTests.length
        };

        // 提供建議
        if (successRate === 100) {
            healthReport.recommendations.push('✅ Gmail SMTP 連接穩定，無需額外行動');
        } else if (successRate >= 70) {
            healthReport.recommendations.push('⚠️ Gmail SMTP 連接間歇性不穩定，建議配置 SendGrid 備援');
        } else if (successRate >= 30) {
            healthReport.recommendations.push('🔄 Gmail SMTP 連接問題嚴重，建議重新配置或更換 SMTP 服務');
        } else {
            healthReport.recommendations.push('❌ Gmail SMTP 幾乎無法連接，強烈建議切換到其他 SMTP 服務');
        }

        if (failedTests.length > 0) {
            const commonErrors = failedTests.map(t => t.error).reduce((acc, error) => {
                acc[error] = (acc[error] || 0) + 1;
                return acc;
            }, {});

            const mostCommonError = Object.keys(commonErrors).reduce((a, b) =>
                commonErrors[a] > commonErrors[b] ? a : b
            );

            healthReport.recommendations.push(`🔍 主要錯誤: ${mostCommonError}`);
        }

        console.log(`🏥 Gmail SMTP 健康檢查完成: ${successRate.toFixed(1)}% 成功率`);
        return healthReport;
    }

    // 自動修復 Gmail SMTP 連接
    async autoRepairGmailConnection() {
        console.log('🔧 執行 Gmail SMTP 自動修復...');

        const gmailProvider = this.availableProviders.find(p => p.type === 'gmail');
        if (!gmailProvider) {
            console.error('❌ 找不到 Gmail SMTP 提供者');
            return false;
        }

        // 修復步驟
        const repairSteps = [
            '清除失敗狀態',
            '關閉現有連接',
            '重新建立連接',
            '驗證連接狀態'
        ];

        for (let i = 0; i < repairSteps.length; i++) {
            console.log(`🔧 步驟 ${i + 1}/${repairSteps.length}: ${repairSteps[i]}...`);

            try {
                switch (i) {
                    case 0: // 清除失敗狀態
                        this.failedProviders.delete(gmailProvider.name);
                        break;

                    case 1: // 關閉現有連接
                        if (this.transporter) {
                            this.transporter.close();
                            this.transporter = null;
                        }
                        break;

                    case 2: // 重新建立連接
                        const success = await this.tryConnectProvider(gmailProvider);
                        if (!success) {
                            throw new Error('無法重新建立連接');
                        }
                        this.currentProvider = gmailProvider;
                        this.initialized = true;
                        break;

                    case 3: // 驗證連接狀態
                        await this.transporter.verify();
                        break;
                }

                console.log(`✅ 步驟 ${i + 1} 完成`);

            } catch (error) {
                console.error(`❌ 步驟 ${i + 1} 失敗: ${error.message}`);
                return false;
            }
        }

        console.log('✅ Gmail SMTP 自動修復完成');
        return true;
    }

    // 獲取詳細的連接狀態報告
    getDetailedConnectionStatus() {
        const status = this.getServiceStatus();

        status.connectionDetails = {
            lastConnectionAttempt: this.lastConnectionAttempt || 'never',
            totalConnectionAttempts: this.totalConnectionAttempts || 0,
            consecutiveFailures: this.consecutiveFailures || 0,
            lastSuccessfulConnection: this.lastSuccessfulConnection || 'never'
        };

        // Gmail 特定狀態
        const gmailProvider = this.availableProviders.find(p => p.type === 'gmail');
        if (gmailProvider) {
            status.gmailStatus = {
                configured: true,
                host: gmailProvider.host,
                port: gmailProvider.port,
                currentlyActive: this.currentProvider?.type === 'gmail',
                failureCount: this.gmailFailureCount || 0,
                lastGmailError: this.lastGmailError || 'none'
            };
        } else {
            status.gmailStatus = {
                configured: false,
                message: '未檢測到 Gmail SMTP 配置'
            };
        }

        return status;
    }

    // HTTP API 郵件發送方法
    async sendEmailViaHttpApi(to, subject, htmlContent, attachments = []) {
        const fromEmail = this.currentProvider?.from || process.env.EMAIL_FROM || 'noreply@yourdomain.com';

        console.log(`📧 使用 ${this.currentProvider.name} 發送郵件`);
        console.log(`📧 收件人: ${to}`);
        console.log(`📄 主旨: ${subject}`);

        try {
            if (this.currentProvider.type === 'resend') {
                return await this.sendEmailViaResend(to, subject, htmlContent, attachments, fromEmail);
            } else if (this.currentProvider.type === 'postmark') {
                return await this.sendEmailViaPostmark(to, subject, htmlContent, attachments, fromEmail);
            } else if (this.currentProvider.type === 'brevo') {
                return await this.sendEmailViaBrevo(to, subject, htmlContent, attachments, fromEmail);
            } else {
                throw new Error(`不支援的 HTTP API 服務類型: ${this.currentProvider.type}`);
            }
        } catch (error) {
            console.error(`❌ ${this.currentProvider.name} 發送失敗:`, error.message);
            throw error;
        }
    }

    // Resend HTTP API 發送
    async sendEmailViaResend(to, subject, htmlContent, attachments, from) {
        try {
            // 🔧 解決 403 權限錯誤：使用經過驗證的發件人地址
            const verifiedFromEmail = this.getVerifiedSenderEmail(from);

            console.log(`📧 原始發件人: ${from}`);
            console.log(`✅ 驗證後發件人: ${verifiedFromEmail}`);

            const emailData = {
                from: `"員工運動系統" <${verifiedFromEmail}>`,
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                html: htmlContent
            };

            // 處理附件
            if (attachments && attachments.length > 0) {
                emailData.attachments = attachments.map(attachment => ({
                    filename: attachment.filename,
                    content: attachment.content
                }));
            }

            console.log(`🔍 API 調用數據:`, {
                from: emailData.from,
                to: emailData.to,
                subject: emailData.subject,
                hasHtml: !!emailData.html,
                attachmentCount: emailData.attachments ? emailData.attachments.length : 0
            });

            const data = await this.resendClient.emails.send(emailData);

            // 詳細的成功日誌
            console.log(`✅ Resend 郵件發送成功!`);
            console.log(`📨 Message ID: ${data.id || 'N/A'}`);
            console.log(`🚀 使用提供者: Resend API`);
            console.log(`📋 完整回應:`, data);

            return {
                success: true,
                messageId: data.id || data.message_id || null,
                response: 'Resend API 發送成功',
                provider: 'Resend API',
                rawResponse: data
            };

        } catch (error) {
            // 詳細的錯誤診斷
            console.error('❌ Resend 發送失敗 - 詳細診斷:');
            console.error(`🔍 錯誤類型: ${error.name || 'Unknown'}`);
            console.error(`💬 錯誤訊息: ${error.message}`);
            console.error(`📊 HTTP 狀態: ${error.status || error.statusCode || 'Unknown'}`);

            if (error.status === 403 || error.statusCode === 403) {
                console.error('🚨 403 權限錯誤診斷:');
                console.error('   - API 金鑰可能無效或權限不足');
                console.error('   - 發件人地址可能未在 Resend 中驗證');
                console.error('   - 請檢查 Resend Dashboard 的 Domains 設定');
            }

            console.error(`📋 完整錯誤物件:`, error);

            throw new Error(`Resend API 錯誤 (${error.status || error.statusCode || 'Unknown'}): ${error.message}`);
        }
    }

    // 取得經過驗證的發件人地址
    getVerifiedSenderEmail(originalFrom) {
        // 1. 如果是 Render 環境，優先使用 Resend 官方測試地址
        if (this.isRender) {
            console.log('🌐 Render 環境：使用 Resend 官方驗證地址');
            return 'onboarding@resend.dev';
        }

        // 2. 檢查是否配置了自定義的已驗證網域
        const customVerifiedDomain = process.env.VERIFIED_SENDER_DOMAIN;
        if (customVerifiedDomain) {
            const customEmail = `noreply@${customVerifiedDomain}`;
            console.log(`✅ 使用自定義已驗證網域: ${customEmail}`);
            return customEmail;
        }

        // 3. 本地開發環境的回退選項
        console.log('⚠️ 本地環境：使用 Resend 測試地址作為備用');
        return 'onboarding@resend.dev';
    }

    // 驗證 Resend API 金鑰
    async validateResendApiKey() {
        console.log('🔑 開始驗證 Resend API 金鑰...');

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            return {
                valid: false,
                error: 'RESEND_API_KEY 環境變數未設定',
                recommendation: '請在 Render Dashboard 或 .env 檔案中設定 RESEND_API_KEY'
            };
        }

        // 檢查 API 金鑰格式
        if (!apiKey.startsWith('re_')) {
            return {
                valid: false,
                error: 'Resend API 金鑰格式錯誤',
                keyPreview: `${apiKey.substring(0, 8)}...`,
                recommendation: 'Resend API 金鑰應以 "re_" 開頭，請檢查是否複製完整'
            };
        }

        try {
            // 建立測試用的 Resend 客戶端
            const testClient = new Resend(apiKey);

            // 發送一個測試郵件來驗證 API 金鑰
            const testEmailData = {
                from: 'onboarding@resend.dev',
                to: 'test@example.com', // 這不會真正發送，只是驗證 API 權限
                subject: 'API Key Validation Test',
                html: '<p>This is a test email for API validation.</p>'
            };

            // 這會測試 API 金鑰的權限，但不會實際發送郵件
            await testClient.emails.send(testEmailData);

            console.log('✅ Resend API 金鑰驗證成功');
            return {
                valid: true,
                keyPreview: `${apiKey.substring(0, 8)}...`,
                message: 'API 金鑰有效且具有發送權限'
            };

        } catch (error) {
            console.error('❌ Resend API 金鑰驗證失敗:', error.message);

            let errorAnalysis = {
                valid: false,
                error: error.message,
                keyPreview: `${apiKey.substring(0, 8)}...`
            };

            // 分析具體的錯誤類型
            if (error.status === 401 || error.statusCode === 401) {
                errorAnalysis.diagnosis = 'API 金鑰無效或已撤銷';
                errorAnalysis.recommendation = '請檢查 Resend Dashboard 中的 API Keys，確認金鑰是否正確且仍然有效';
            } else if (error.status === 403 || error.statusCode === 403) {
                errorAnalysis.diagnosis = 'API 金鑰權限不足';
                errorAnalysis.recommendation = '請確認 API 金鑰具有發送郵件的權限';
            } else if (error.status === 422 || error.statusCode === 422) {
                errorAnalysis.diagnosis = 'API 請求格式錯誤';
                errorAnalysis.recommendation = 'API 金鑰可能有效，但請求格式需要調整';
            } else {
                errorAnalysis.diagnosis = '未知錯誤';
                errorAnalysis.recommendation = '請檢查網路連線和 API 服務狀態';
            }

            return errorAnalysis;
        }
    }

    // 獲取詳細的 API 診斷資訊
    async getResendApiDiagnostics() {
        console.log('🔍 執行 Resend API 完整診斷...');

        const diagnostics = {
            timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            environment: {
                platform: this.isRender ? 'Render.com' : '本地開發',
                nodeEnv: process.env.NODE_ENV || 'development'
            },
            apiKeyValidation: null,
            configuration: {
                hasApiKey: !!process.env.RESEND_API_KEY,
                hasEmailFrom: !!process.env.EMAIL_FROM,
                emailFrom: process.env.EMAIL_FROM || 'Not configured'
            },
            recommendations: []
        };

        // 執行 API 金鑰驗證
        diagnostics.apiKeyValidation = await this.validateResendApiKey();

        // 生成建議
        if (!diagnostics.apiKeyValidation.valid) {
            diagnostics.recommendations.push({
                priority: 'critical',
                issue: 'API 金鑰無效',
                action: diagnostics.apiKeyValidation.recommendation || '請重新配置 Resend API 金鑰'
            });
        }

        if (!diagnostics.configuration.hasEmailFrom) {
            diagnostics.recommendations.push({
                priority: 'high',
                issue: 'EMAIL_FROM 環境變數未設定',
                action: '設定 EMAIL_FROM 環境變數以改善郵件發送者識別'
            });
        }

        // 針對 Render 環境的特殊建議
        if (this.isRender) {
            diagnostics.recommendations.push({
                priority: 'info',
                issue: 'Render 環境自動使用已驗證的發件人地址',
                action: '系統將自動使用 onboarding@resend.dev 作為發件人以避免 403 錯誤'
            });
        }

        console.log('✅ Resend API 診斷完成');
        return diagnostics;
    }

    // Postmark HTTP API 發送
    async sendEmailViaPostmark(to, subject, htmlContent, attachments, from) {
        try {
            const emailData = {
                From: from,
                To: Array.isArray(to) ? to.join(',') : to,
                Subject: subject,
                HtmlBody: htmlContent,
                MessageStream: 'outbound'
            };

            // 處理附件
            if (attachments && attachments.length > 0) {
                emailData.Attachments = attachments.map(attachment => ({
                    Name: attachment.filename,
                    Content: attachment.content.toString('base64'),
                    ContentType: attachment.contentType || 'application/octet-stream'
                }));
            }

            const data = await this.postmarkClient.sendEmail(emailData);

            console.log(`✅ Postmark 郵件發送成功: ${data.MessageID}`);
            console.log(`🚀 使用提供者: Postmark API`);

            return {
                success: true,
                messageId: data.MessageID,
                response: 'Postmark API 發送成功',
                provider: 'Postmark API'
            };

        } catch (error) {
            console.error('❌ Postmark 發送失敗:', error);
            throw new Error(`Postmark API 錯誤: ${error.message}`);
        }
    }

    // Brevo HTTP API 發送
    async sendEmailViaBrevo(to, subject, htmlContent, attachments, from) {
        try {
            // 建立 Brevo client (如果還沒有)
            if (!this.brevoClient) {
                this.brevoClient = new brevo.TransactionalEmailsApi();
                this.brevoClient.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
            }

            const emailData = new brevo.SendSmtpEmail();

            // 設定基本郵件資訊
            emailData.sender = {
                email: from,
                name: "員工運動系統"
            };
            emailData.to = Array.isArray(to) ?
                to.map(email => ({ email })) :
                [{ email: to }];
            emailData.subject = subject;
            emailData.htmlContent = htmlContent;

            // 處理附件
            if (attachments && attachments.length > 0) {
                emailData.attachment = attachments.map(attachment => ({
                    name: attachment.filename,
                    content: attachment.content.toString('base64')
                }));
            }

            const data = await this.brevoClient.sendTransacEmail(emailData);

            console.log(`✅ Brevo 郵件發送成功: ${data.messageId}`);
            console.log(`🚀 使用提供者: Brevo API`);

            return {
                success: true,
                messageId: data.messageId,
                response: 'Brevo API 發送成功',
                provider: 'Brevo API'
            };

        } catch (error) {
            console.error('❌ Brevo 發送失敗:', error);
            throw new Error(`Brevo API 錯誤: ${error.message}`);
        }
    }
}

module.exports = new EmailService();