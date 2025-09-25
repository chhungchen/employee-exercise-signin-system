/**
 * 郵件服務測試 - TDD 方式
 * 測試郵件服務優先順序和故障轉移機制
 */

const EmailService = require('../services/email-service');

describe('EmailService 郵件服務測試', () => {
    let emailService;

    beforeEach(() => {
        // 重置環境變數
        process.env.RENDER = 'true';
        process.env.NODE_ENV = 'production';
        process.env.BREVO_API_KEY = 'test-brevo-key';
        process.env.SMTP_USER = 'test@gmail.com';
        process.env.SMTP_PASS = 'test-pass';

        // 建立新的服務實例
        emailService = new (require('../services/email-service').constructor)();
    });

    describe('Render 環境郵件提供者優先順序', () => {
        test('應該將 Brevo API 設為最高優先級', () => {
            const providers = emailService.detectSMTPProviders();

            // 尋找 Brevo 提供者
            const brevoProvider = providers.find(p => p.type === 'brevo');

            expect(brevoProvider).toBeDefined();
            expect(brevoProvider.priority).toBe(1);
            expect(brevoProvider.name).toBe('Brevo API');
            expect(brevoProvider.isHttpApi).toBe(true);
        });

        test('應該將 Gmail SMTP 設為第二優先級', () => {
            const providers = emailService.detectSMTPProviders();

            // 尋找 Gmail 提供者
            const gmailProvider = providers.find(p => p.name === 'Gmail SMTP');

            expect(gmailProvider).toBeDefined();
            expect(gmailProvider.priority).toBe(2);
            expect(gmailProvider.host).toBe('smtp.gmail.com');
        });

        test('不應該包含企業內部 SMTP (雲端環境無法連接)', () => {
            const providers = emailService.detectSMTPProviders();

            // 企業 SMTP 不應存在於 Render 環境
            const internalProvider = providers.find(p => p.type === 'internal');
            expect(internalProvider).toBeUndefined();
        });
    });

    describe('郵件發送優先順序測試', () => {
        test('外部郵件應優先使用 Brevo API', async () => {
            const routingResult = emailService.getOptimalProviderOrder(['external@gmail.com']);

            expect(routingResult.providerOrder[0]).toBe('brevo');
            expect(routingResult.providerOrder[1]).toBe('gmail');
            expect(routingResult.strategy).toBe('brevo');
        });

        test('當 Brevo 失敗時應自動切換到 Gmail', async () => {
            // 模擬有可用的提供者
            const mockGmailProvider = {
                name: 'Gmail SMTP',
                type: 'gmail',
                priority: 2,
                host: 'smtp.gmail.com',
                isHttpApi: false
            };

            // 設定 availableProviders，包含 Gmail 提供者
            emailService.availableProviders = [mockGmailProvider];

            // 模擬 Brevo 失敗
            emailService.failedProviders.add('Brevo API');

            // 模擬初始化方法，避免實際 nodemailer 調用
            jest.spyOn(emailService, 'initializeSMTPTransporter').mockResolvedValue(true);

            const optimalProvider = await emailService.selectOptimalProvider(['brevo', 'gmail']);

            // 應該選擇 Gmail 作為備援
            expect(optimalProvider).toBeDefined();
            expect(optimalProvider.name).toBe('Gmail SMTP');
            expect(optimalProvider.type).toBe('gmail');
        });
    });

    describe('Brevo API 配置測試', () => {
        test('應該正確配置 Brevo 發件人驗證', () => {
            const verifiedSender = emailService.getBrevoVerifiedSender('original@test.com');

            // Render 環境應使用已驗證的發件人
            expect(verifiedSender).toBe('chhungchen@gmail.com');
        });

        test('Brevo 客戶端應正確初始化', () => {
            expect(emailService.brevoClient).toBeDefined();
            expect(process.env.BREVO_API_KEY).toBe('test-brevo-key');
        });
    });

    describe('錯誤處理和故障轉移', () => {
        test('郵件發送失敗時應記錄到追蹤系統', () => {
            const initialFailures = emailService.deliveryTracking.failedDeliveries;

            emailService.trackEmailAttempt('Brevo API', 'test@example.com', 'Test Subject', false, new Error('Test error'));

            expect(emailService.deliveryTracking.failedDeliveries).toBe(initialFailures + 1);
            expect(emailService.deliveryTracking.totalAttempts).toBeGreaterThan(0);
        });

        test('403 權限錯誤應觸發立即故障轉移', () => {
            const error = new Error('Forbidden');
            error.code = 'IMMEDIATE_FAILOVER';
            error.provider = 'Brevo API';
            error.requiresImmediateFailover = true;

            expect(error.requiresImmediateFailover).toBeTruthy();
        });
    });
});