// Brevo API 診斷腳本
require('dotenv').config({path: '.env.local'});
require('dotenv').config({path: '.env'});

const brevo = require('@getbrevo/brevo');

async function diagnosBrevoAccount() {
    console.log('🔍 開始 Brevo 帳戶診斷...');
    console.log('='.repeat(50));

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        console.error('❌ BREVO_API_KEY 未設定');
        return;
    }

    console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);

    try {
        // 1. 檢查帳戶資訊
        console.log('\n📊 1. 檢查帳戶資訊...');
        const accountApiInstance = new brevo.AccountApi();
        accountApiInstance.authentications['apiKey'].apiKey = apiKey;

        const accountInfo = await accountApiInstance.getAccount();
        console.log('✅ 帳戶資訊取得成功:');
        console.log(`   - 公司: ${accountInfo.body.companyName || 'N/A'}`);
        console.log(`   - 郵件: ${accountInfo.body.email}`);
        console.log(`   - 帳戶類型: ${accountInfo.body.plan || 'Free'}`);

        // 2. 檢查發件人列表
        console.log('\n📧 2. 檢查發件人設定...');
        const sendersApiInstance = new brevo.SendersApi();
        sendersApiInstance.authentications['apiKey'].apiKey = apiKey;

        const senders = await sendersApiInstance.getSenders();
        console.log(`✅ 發件人列表 (${senders.body.senders.length} 個):`);
        senders.body.senders.forEach((sender, index) => {
            console.log(`   ${index + 1}. ${sender.email}`);
            console.log(`      - 名稱: ${sender.name}`);
            console.log(`      - 狀態: ${sender.active ? '✅ 啟用' : '❌ 停用'}`);
            console.log(`      - IPS: ${sender.ips ? sender.ips.join(', ') : 'N/A'}`);
        });

        // 3. 檢查域名驗證狀態
        console.log('\n🌐 3. 檢查域名驗證...');
        try {
            const domainsApiInstance = new brevo.DomainsApi();
            domainsApiInstance.authentications['apiKey'].apiKey = apiKey;

            const domains = await domainsApiInstance.getDomains();
            if (domains.body && domains.body.length > 0) {
                console.log(`✅ 域名列表 (${domains.body.length} 個):`);
                domains.body.forEach((domain, index) => {
                    console.log(`   ${index + 1}. ${domain.domain}`);
                    console.log(`      - 驗證狀態: ${domain.domainStatus}`);
                    console.log(`      - DKIM: ${domain.dkimStatus || 'N/A'}`);
                });
            } else {
                console.log('⚠️ 沒有已驗證的域名');
            }
        } catch (domainError) {
            console.log('⚠️ 無法取得域名資訊 (可能是免費帳戶限制)');
        }

        // 4. 檢查交易郵件統計
        console.log('\n📈 4. 檢查交易郵件統計...');
        const transactionalEmailsApiInstance = new brevo.TransactionalEmailsApi();
        transactionalEmailsApiInstance.authentications['apiKey'].apiKey = apiKey;

        // 取得今日統計
        const today = new Date();
        const startDate = today.toISOString().split('T')[0];

        try {
            const emailStats = await transactionalEmailsApiInstance.getTransacEmailsList({
                limit: 10,
                offset: 0
            });
            console.log('✅ 交易郵件統計取得成功');
            console.log(`   - 可查詢的郵件記錄數: ${emailStats.body.count || 0}`);
        } catch (statsError) {
            console.log('⚠️ 無法取得統計資訊:', statsError.response?.body?.message || statsError.message);
        }

        // 5. 測試發送能力
        console.log('\n🧪 5. 測試基本發送能力...');
        const testEmail = new brevo.SendSmtpEmail();
        testEmail.sender = { email: 'noreply@mail.brevo.com', name: '測試' };
        testEmail.to = [{ email: 'test@example.com' }];
        testEmail.subject = '測試郵件 - 僅驗證 API';
        testEmail.htmlContent = '<p>這是測試郵件</p>';

        try {
            // 這個測試會失敗，但能告訴我們 API 是否正常工作
            const testResult = await transactionalEmailsApiInstance.sendTransacEmail(testEmail);
            console.log('✅ API 發送能力正常');
        } catch (testError) {
            if (testError.response?.status === 400 || testError.response?.status === 402) {
                console.log('✅ API 連接正常 (測試地址被拒是預期的)');
            } else {
                console.log('❌ API 發送測試失敗:', testError.response?.body?.message || testError.message);
            }
        }

        console.log('\n🎯 診斷完成!');

    } catch (error) {
        console.error('❌ 診斷過程發生錯誤:', error.response?.body?.message || error.message);
        if (error.response?.status === 401) {
            console.error('🔑 API Key 無效或已過期');
        }
    }
}

// 執行診斷
if (require.main === module) {
    diagnosBrevoAccount();
}

module.exports = diagnosBrevoAccount;