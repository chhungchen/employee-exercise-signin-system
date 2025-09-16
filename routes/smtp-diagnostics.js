const express = require('express');
const router = express.Router();
const dns = require('dns');
const net = require('net');
const nodemailer = require('nodemailer');
const { promisify } = require('util');

// DNS解析測試
const dnsLookup = promisify(dns.lookup);

/**
 * 企業SMTP診斷主頁面
 */
router.get('/', (req, res) => {
    res.render('admin/smtp-diagnostics', {
        title: '企業SMTP診斷工具',
        process: process
    });
});

/**
 * DNS解析測試
 */
router.post('/dns', async (req, res) => {
    const { host, timeout } = req.body;

    try {
        console.log(`🔍 DNS測試: 解析 ${host}`);

        const startTime = Date.now();
        const result = await Promise.race([
            dnsLookup(host),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('DNS解析超時')), timeout)
            )
        ]);
        const responseTime = Date.now() - startTime;

        console.log(`✅ DNS解析成功: ${host} -> ${result.address} (${responseTime}ms)`);

        res.json({
            success: true,
            message: `DNS解析成功: ${result.address}`,
            details: {
                hostname: host,
                address: result.address,
                family: result.family,
                responseTime: responseTime
            }
        });
    } catch (error) {
        console.error(`❌ DNS解析失敗: ${host} - ${error.message}`);

        res.json({
            success: false,
            error: `DNS解析失敗: ${error.message}`,
            details: {
                hostname: host,
                errorCode: error.code || 'UNKNOWN'
            }
        });
    }
});

/**
 * TCP連接測試
 */
router.post('/tcp', async (req, res) => {
    const { host, port, timeout } = req.body;

    try {
        console.log(`🔌 TCP測試: 連接 ${host}:${port}`);

        const result = await testTcpConnection(host, port, timeout);

        console.log(`✅ TCP連接成功: ${host}:${port} (${result.responseTime}ms)`);

        res.json({
            success: true,
            message: `TCP連接成功，響應時間: ${result.responseTime}ms`,
            details: result
        });
    } catch (error) {
        console.error(`❌ TCP連接失敗: ${host}:${port} - ${error.message}`);

        res.json({
            success: false,
            error: `TCP連接失敗: ${error.message}`,
            details: {
                host,
                port,
                errorCode: error.code || 'UNKNOWN'
            }
        });
    }
});

/**
 * SMTP握手測試
 */
router.post('/smtp', async (req, res) => {
    const { host, port, timeout } = req.body;

    try {
        console.log(`🤝 SMTP測試: 握手 ${host}:${port}`);

        const result = await testSmtpHandshake(host, port, timeout);

        console.log(`✅ SMTP握手成功: ${host}:${port}`);

        res.json({
            success: true,
            message: 'SMTP握手成功，伺服器支援匿名認證',
            details: result
        });
    } catch (error) {
        console.error(`❌ SMTP握手失敗: ${host}:${port} - ${error.message}`);

        res.json({
            success: false,
            error: `SMTP握手失敗: ${error.message}`,
            details: {
                host,
                port,
                errorType: error.name || 'SMTPError'
            }
        });
    }
});

/**
 * 測試郵件發送
 */
router.post('/send', async (req, res) => {
    const { host, port, timeout } = req.body;

    try {
        console.log(`📧 郵件測試: 發送測試郵件 ${host}:${port}`);

        const result = await sendTestEmail(host, port, timeout);

        console.log(`✅ 測試郵件發送成功: ${result.messageId}`);

        res.json({
            success: true,
            message: `測試郵件發送成功，訊息ID: ${result.messageId}`,
            details: result
        });
    } catch (error) {
        console.error(`❌ 測試郵件發送失敗: ${host}:${port} - ${error.message}`);

        res.json({
            success: false,
            error: `測試郵件發送失敗: ${error.message}`,
            details: {
                host,
                port,
                errorCode: error.code || 'UNKNOWN'
            }
        });
    }
});

/**
 * TCP連接測試函數
 */
function testTcpConnection(host, port, timeout) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error(`TCP連接超時 (${timeout}ms)`));
        }, timeout);

        socket.connect(port, host, () => {
            const responseTime = Date.now() - startTime;
            clearTimeout(timer);
            socket.destroy();

            resolve({
                host,
                port,
                responseTime,
                connected: true
            });
        });

        socket.on('error', (error) => {
            clearTimeout(timer);
            socket.destroy();
            reject(error);
        });
    });
}

/**
 * SMTP握手測試函數
 */
function testSmtpHandshake(host, port, timeout) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let receivedData = '';
        let step = 'connect';

        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error(`SMTP握手超時 (${timeout}ms) - 當前步驟: ${step}`));
        }, timeout);

        socket.connect(port, host);

        socket.on('connect', () => {
            console.log(`🔗 TCP連接已建立 ${host}:${port}`);
            step = 'greeting';
        });

        socket.on('data', (data) => {
            const response = data.toString();
            receivedData += response;
            console.log(`📨 SMTP回應: ${response.trim()}`);

            if (step === 'greeting' && response.startsWith('220')) {
                step = 'ehlo';
                socket.write('EHLO diagnostic-tool\r\n');
            } else if (step === 'ehlo' && response.startsWith('250')) {
                step = 'quit';
                socket.write('QUIT\r\n');
            } else if (step === 'quit' && response.startsWith('221')) {
                clearTimeout(timer);
                socket.destroy();

                resolve({
                    host,
                    port,
                    greeting: receivedData.split('\r\n')[0],
                    capabilities: receivedData.match(/250-(.+)/g) || [],
                    handshakeComplete: true
                });
            }
        });

        socket.on('error', (error) => {
            clearTimeout(timer);
            socket.destroy();
            reject(error);
        });
    });
}

/**
 * 測試郵件發送函數
 */
async function sendTestEmail(host, port, timeout) {
    const transportConfig = {
        host: host,
        port: port,
        secure: false,
        requireTLS: false,
        ignoreTLS: true,
        connectionTimeout: timeout,
        greetingTimeout: timeout,
        socketTimeout: timeout,
        pool: false,
        maxConnections: 1,
        maxMessages: 1,
        tls: {
            rejectUnauthorized: false,
            ignoreTLS: true
        }
    };

    console.log(`📧 建立SMTP傳輸器配置:`, transportConfig);

    const transporter = nodemailer.createTransport(transportConfig);

    // 驗證連接
    await transporter.verify();
    console.log(`✅ SMTP傳輸器驗證成功`);

    // 發送測試郵件
    const testEmail = {
        from: process.env.INTERNAL_SMTP_FROM || 'system@company.local',
        to: process.env.INTERNAL_SMTP_FROM || 'system@company.local',
        subject: `[診斷測試] SMTP連接測試 - ${new Date().toLocaleString('zh-TW')}`,
        html: `
            <h3>🔧 企業SMTP診斷測試</h3>
            <p><strong>測試時間:</strong> ${new Date().toLocaleString('zh-TW')}</p>
            <p><strong>SMTP伺服器:</strong> ${host}:${port}</p>
            <p><strong>環境:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>狀態:</strong> ✅ 連接成功</p>
            <hr>
            <p><small>此為自動化診斷測試郵件，無需回覆。</small></p>
        `
    };

    const result = await transporter.sendMail(testEmail);

    return {
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted,
        rejected: result.rejected,
        from: testEmail.from,
        to: testEmail.to,
        subject: testEmail.subject
    };
}

module.exports = router;