/**
 * 排程管理器測試 - TDD 方式
 * 測試 8:30 郵件寄送失敗通知機制
 */

const ScheduleManagerClass = require('../services/schedule-manager').constructor;

describe('ScheduleManager 排程管理器測試', () => {
    let scheduleManager;
    let mockEmailService;
    let mockPersonalGoogleServices;
    let mockPersonalDatabase;

    beforeEach(() => {
        // 建立模擬服務
        mockEmailService = {
            initialize: jest.fn().mockResolvedValue(true),
            isConfigured: jest.fn().mockReturnValue(true),
            sendEmail: jest.fn(),
            sendReport: jest.fn()
        };

        mockPersonalGoogleServices = {
            initialize: jest.fn().mockResolvedValue(true),
            getAllSignInData: jest.fn().mockResolvedValue([])
        };

        mockPersonalDatabase = {
            getAllSigninsForExport: jest.fn().mockResolvedValue([
                { id: 1, name: '測試用戶', activity: '羽球', signin_time: '2024-01-15 08:30:00' }
            ])
        };

        // 建立新的 ScheduleManager 實例
        scheduleManager = new ScheduleManagerClass();
        scheduleManager.setDependencies(mockPersonalGoogleServices, mockPersonalDatabase, mockEmailService);

        // 設定測試環境
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // 清理排程
        scheduleManager.clearSchedule();
    });

    describe('郵件寄送失敗通知功能', () => {
        test('當 8:30 郵件寄送失敗時，應發送通知給 Jameschen@inftfinance.com.tw', async () => {
            // 模擬郵件報告寄送失敗，然後通知寄送成功
            mockEmailService.sendReport
                .mockRejectedValueOnce(new Error('SMTP 連接失敗'));
            mockEmailService.sendEmail
                .mockResolvedValueOnce({ success: true, messageId: 'notification-123' });

            // 設定 8:30 排程
            await scheduleManager.setSchedule({
                enabled: true,
                email: 'test@example.com',
                time: '08:30',
                format: 'excel',
                includePhotos: false
            });

            // 手動執行定期報告 (模擬 8:30 觸發)
            await scheduleManager.executeDailyReport();

            // 驗證失敗通知是否發送
            expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                'Jameschen@inftfinance.com.tw',
                expect.stringContaining('【警告】每日郵件報告寄送失敗'),
                expect.stringContaining('SMTP 連接失敗'),
                []
            );
        });

        test('失敗通知郵件應包含錯誤詳情和時間戳', async () => {
            const testError = new Error('Brevo API 403 權限錯誤');
            testError.code = 'FORBIDDEN';

            mockEmailService.sendReport
                .mockRejectedValueOnce(testError);
            mockEmailService.sendEmail
                .mockResolvedValueOnce({ success: true });

            await scheduleManager.setSchedule({
                enabled: true,
                email: 'test@example.com',
                time: '08:30'
            });

            await scheduleManager.executeDailyReport();

            const notificationCall = mockEmailService.sendEmail.mock.calls.find(
                call => call[0] === 'Jameschen@inftfinance.com.tw'
            );

            expect(notificationCall).toBeDefined();
            expect(notificationCall[2]).toMatch(/錯誤代碼.*FORBIDDEN/);
            expect(notificationCall[2]).toMatch(/錯誤訊息.*Brevo API 403 權限錯誤/);
            expect(notificationCall[2]).toMatch(/發生時間.*UTC\+8/);
        });

        test('當郵件服務完全無法使用時，應記錄錯誤但不中斷程序', async () => {
            // 模擬郵件服務初始化失敗
            mockEmailService.initialize.mockResolvedValue(false);
            mockEmailService.isConfigured.mockReturnValue(false);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await scheduleManager.setSchedule({
                enabled: true,
                email: 'test@example.com',
                time: '08:30'
            });

            await scheduleManager.executeDailyReport();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('郵件服務初始化失敗，無法執行定期寄送')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('成功寄送監控', () => {
        test('成功寄送時應記錄統計資料', async () => {
            mockEmailService.sendReport.mockResolvedValue({
                success: true,
                messageId: 'success-123',
                provider: 'Brevo API'
            });

            await scheduleManager.setSchedule({
                enabled: true,
                email: 'test@example.com',
                time: '08:30'
            });

            await scheduleManager.executeDailyReport();

            // 驗證成功寄送記錄
            const stats = scheduleManager.getDeliveryStats();
            expect(stats.totalAttempts).toBe(1);
            expect(stats.successCount).toBe(1);
            expect(stats.failureCount).toBe(0);
            expect(stats.lastSuccess).toBeDefined();
        });

        test('應正確統計多次寄送的成功/失敗率', async () => {
            // 設定混合成功/失敗的場景
            mockEmailService.sendReport
                .mockResolvedValueOnce({ success: true })    // 第一次成功
                .mockRejectedValueOnce(new Error('失敗'))     // 第二次失敗
                .mockResolvedValueOnce({ success: true });   // 第三次成功

            // 模擬失敗通知寄送成功
            mockEmailService.sendEmail
                .mockResolvedValue({ success: true });

            await scheduleManager.setSchedule({
                enabled: true,
                email: 'test@example.com',
                time: '08:30'
            });

            // 執行三次
            await scheduleManager.executeDailyReport();
            await scheduleManager.executeDailyReport();
            await scheduleManager.executeDailyReport();

            const stats = scheduleManager.getDeliveryStats();
            expect(stats.totalAttempts).toBe(3);
            expect(stats.successCount).toBe(2);
            expect(stats.failureCount).toBe(1);
            expect(stats.successRate).toBeCloseTo(66.67, 2);
        });
    });

    describe('通知郵件格式測試', () => {
        test('失敗通知應使用標準化格式', async () => {
            const error = new Error('測試錯誤');

            const notificationContent = scheduleManager.buildFailureNotificationContent(error, {
                scheduledTime: '08:30',
                recipient: 'test@example.com',
                timestamp: new Date('2024-01-15T08:30:00+08:00')
            });

            expect(notificationContent.subject).toBe('【警告】每日郵件報告寄送失敗 - 2024-01-15 08:30 (UTC+8)');
            expect(notificationContent.html).toContain('<h2>🚨 每日郵件報告寄送失敗</h2>');
            expect(notificationContent.html).toContain('排程時間: 08:30');
            expect(notificationContent.html).toContain('目標收件人: test@example.com');
            expect(notificationContent.html).toContain('錯誤訊息: 測試錯誤');
        });
    });
});