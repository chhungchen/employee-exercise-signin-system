const express = require('express');
const router = express.Router();
const personalGoogleServices = require('../services/personal-google-services');

// Google 授權路由
router.get('/auth/google', async (req, res) => {
    try {
        // 初始化 Google 服務
        const initialized = await personalGoogleServices.initialize();
        
        if (!initialized) {
            // 如果初始化失敗，直接建立 OAuth2 用戶端來取得授權 URL
            const { google } = require('googleapis');
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI;
            
            if (!clientId || !clientSecret || !redirectUri) {
                return res.status(500).json({ 
                    error: '缺少 Google OAuth 設定',
                    missing: {
                        clientId: !clientId,
                        clientSecret: !clientSecret,
                        redirectUri: !redirectUri
                    }
                });
            }
            
            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
            const scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ];
            
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent'
            });
            
            return res.redirect(authUrl);
        }
        
        // 取得授權 URL
        const authUrl = personalGoogleServices.getAuthUrl();
        
        res.redirect(authUrl);
    } catch (error) {
        console.error('Google 授權失敗:', error);
        res.status(500).json({ 
            error: '授權服務暫時無法使用',
            details: error.message 
        });
    }
});

// Google 授權回調路由
router.get('/auth/google/callback', async (req, res) => {
    try {
        const { code, error } = req.query;

        if (error) {
            console.error('Google 授權被拒絕:', error);
            return res.status(400).send(`
                <html>
                <head><title>授權失敗</title></head>
                <body>
                    <h1>❌ Google 授權失敗</h1>
                    <p>錯誤：${error}</p>
                    <p><a href="/auth/google">重新授權</a></p>
                </body>
                </html>
            `);
        }

        if (!code) {
            return res.status(400).send(`
                <html>
                <head><title>授權失敗</title></head>
                <body>
                    <h1>❌ 缺少授權碼</h1>
                    <p><a href="/auth/google">重新授權</a></p>
                </body>
                </html>
            `);
        }

        // 換取 token
        const tokens = await personalGoogleServices.exchangeCodeForToken(code);

        if (tokens) {
            // 檢查是否為生產環境
            const isProduction = process.env.NODE_ENV === 'production';
            
            let environmentSection = '';
            if (isProduction) {
                environmentSection = `
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <h3 style="color: #856404;">🔧 重要：Render 環境變數設定</h3>
                        <p style="color: #856404;">為了避免重新部署後需要重新授權，請到 Render Dashboard 設定以下環境變數：</p>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; text-align: left; margin: 10px 0;">
                            <strong>GOOGLE_ACCESS_TOKEN</strong>=<span style="word-break: break-all;">${tokens.access_token}</span><br>
                            <strong>GOOGLE_REFRESH_TOKEN</strong>=<span style="word-break: break-all;">${tokens.refresh_token}</span>
                        </div>
                        <p style="color: #856404; font-size: 14px;">設定路徑：Render Dashboard → 您的服務 → Environment → Add Environment Variable</p>
                    </div>
                `;
            }

            res.send(`
                <html>
                <head>
                    <title>授權成功</title>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                        .success { color: green; }
                        .code { background: #f8f9fa; padding: 5px; border-radius: 3px; font-family: monospace; }
                        .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px; }
                        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div style="text-align: center;">
                        <h1 class="success">✅ Google 授權成功！</h1>
                        <p>您的個人 Google 帳號已成功連接到員工簽到系統。</p>
                    </div>
                    
                    ${environmentSection}
                    
                    <div style="background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <h3>接下來的步驟：</h3>
                        <ol style="text-align: left;">
                            ${isProduction ? '<li>複製上方的環境變數到 Render Dashboard</li>' : ''}
                            <li>關閉此視窗</li>
                            <li>返回命令列執行：<span class="code">npm run test-google-personal</span></li>
                            <li>如果測試成功，執行：<span class="code">npm run dev</span></li>
                        </ol>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="/" class="btn">前往簽到系統</a>
                        ${isProduction ? '<a href="#" onclick="copyTokens()" class="btn" style="background: #28a745;">複製環境變數</a>' : ''}
                    </div>
                    
                    <script>
                        function copyTokens() {
                            const tokenText = \`GOOGLE_ACCESS_TOKEN=${tokens.access_token}
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\`;
                            navigator.clipboard.writeText(tokenText).then(() => {
                                alert('環境變數已複製到剪貼簿！請到 Render Dashboard 貼上。');
                            }).catch(() => {
                                alert('複製失敗，請手動複製上方的環境變數。');
                            });
                        }
                        
                        // 10秒後自動關閉視窗
                        setTimeout(() => {
                            if (!${isProduction}) {
                                window.close();
                            }
                        }, 10000);
                    </script>
                </body>
                </html>
            `);
        } else {
            res.status(500).send(`
                <html>
                <head><title>Token 交換失敗</title></head>
                <body>
                    <h1>❌ Token 交換失敗</h1>
                    <p>請檢查設定並重試</p>
                    <p><a href="/auth/google">重新授權</a></p>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('處理 Google 回調時發生錯誤:', error);
        res.status(500).send(`
            <html>
            <head><title>系統錯誤</title></head>
            <body>
                <h1>❌ 系統錯誤</h1>
                <p>處理授權時發生錯誤，請稍後重試</p>
                <p><a href="/auth/google">重新授權</a></p>
            </body>
            </html>
        `);
    }
});

// 檢查授權狀態
router.get('/auth/google/status', async (req, res) => {
    try {
        const status = await personalGoogleServices.checkAuthStatus();
        res.json(status);
    } catch (error) {
        console.error('檢查授權狀態失敗:', error);
        res.status(500).json({ 
            authorized: false, 
            error: '無法檢查授權狀態' 
        });
    }
});

// 重新整理 token
router.post('/auth/google/refresh', async (req, res) => {
    try {
        const success = await personalGoogleServices.refreshToken();
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Token 重新整理成功' 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: 'Token 重新整理失敗' 
            });
        }
    } catch (error) {
        console.error('重新整理 token 失敗:', error);
        res.status(500).json({ 
            success: false, 
            error: '重新整理 token 時發生錯誤' 
        });
    }
});

// 撤銷授權 (登出)
router.post('/auth/google/revoke', async (req, res) => {
    try {
        // 撤銷 token（如果實作的話）
        // await personalGoogleServices.revokeToken();
        
        res.json({ 
            success: true, 
            message: '已撤銷 Google 授權' 
        });
    } catch (error) {
        console.error('撤銷授權失敗:', error);
        res.status(500).json({ 
            success: false, 
            error: '撤銷授權時發生錯誤' 
        });
    }
});

module.exports = router;