const express = require('express');
const router = express.Router();
const personalGoogleServices = require('../services/personal-google-services');

// Token 工具頁面
router.get('/token-helper', async (req, res) => {
    try {
        // 檢查 Google 服務狀態
        const initialized = await personalGoogleServices.initialize();
        const authStatus = await personalGoogleServices.checkAuthStatus();
        
        let tokenInfo = null;
        let hasValidTokens = false;
        
        if (initialized && authStatus.authorized && personalGoogleServices.oauth2Client.credentials) {
            const credentials = personalGoogleServices.oauth2Client.credentials;
            hasValidTokens = !!(credentials.access_token && credentials.refresh_token);
            
            if (hasValidTokens) {
                tokenInfo = {
                    access_token: credentials.access_token,
                    refresh_token: credentials.refresh_token,
                    scope: credentials.scope || 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
                    token_type: credentials.token_type || 'Bearer',
                    expiry_date: credentials.expiry_date ? new Date(credentials.expiry_date).toLocaleString('zh-TW') : '未知'
                };
            }
        }

        const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Token 環境變數設定工具</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.2em;
            margin-bottom: 10px;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .content {
            padding: 40px;
        }
        
        .status-card {
            border: 2px solid;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .status-success {
            border-color: #28a745;
            background: #d4edda;
        }
        
        .status-warning {
            border-color: #ffc107;
            background: #fff3cd;
        }
        
        .status-error {
            border-color: #dc3545;
            background: #f8d7da;
        }
        
        .status-icon {
            font-size: 2em;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        
        .token-display {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .token-label {
            font-weight: bold;
            color: #495057;
            margin-bottom: 5px;
        }
        
        .token-value {
            font-family: 'Courier New', monospace;
            background: white;
            border: 1px solid #ced4da;
            border-radius: 5px;
            padding: 10px;
            word-break: break-all;
            font-size: 0.9em;
        }
        
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            margin: 5px;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        
        .btn-success {
            background: #28a745;
        }
        
        .btn-success:hover {
            background: #218838;
        }
        
        .btn-danger {
            background: #dc3545;
        }
        
        .btn-danger:hover {
            background: #c82333;
        }
        
        .instructions {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 20px;
            border-radius: 0 8px 8px 0;
        }
        
        .instructions h3 {
            color: #1976d2;
            margin-bottom: 15px;
        }
        
        .instructions ol {
            margin-left: 20px;
        }
        
        .instructions li {
            margin-bottom: 8px;
            line-height: 1.6;
        }
        
        .copy-box {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            position: relative;
            margin: 15px 0;
        }
        
        .copy-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #4a5568;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.8em;
        }
        
        .copy-btn:hover {
            background: #2d3748;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
        }
        
        .action-buttons {
            text-align: center;
            margin: 20px 0;
        }
        
        @media (max-width: 768px) {
            .container {
                margin: 10px;
                border-radius: 10px;
            }
            
            .header {
                padding: 20px;
            }
            
            .content {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 1.8em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔑 Google Token 環境變數設定工具</h1>
            <p>協助您取得和設定 Render 環境變數</p>
        </div>
        
        <div class="content">
            ${hasValidTokens ? `
                <!-- 成功狀態 -->
                <div class="status-card status-success">
                    <div class="status-icon">✅</div>
                    <div>
                        <h3>Google 授權狀態：已授權</h3>
                        <p>系統已成功連接到您的 Google 帳號，以下是需要設定的環境變數。</p>
                    </div>
                </div>
                
                <!-- Token 顯示區域 -->
                <div class="section">
                    <h2>📋 環境變數內容</h2>
                    
                    <div class="token-display">
                        <div class="token-label">GOOGLE_ACCESS_TOKEN</div>
                        <div class="token-value" id="accessToken">${tokenInfo.access_token}</div>
                    </div>
                    
                    <div class="token-display">
                        <div class="token-label">GOOGLE_REFRESH_TOKEN</div>
                        <div class="token-value" id="refreshToken">${tokenInfo.refresh_token}</div>
                    </div>
                    
                    <div class="action-buttons">
                        <button class="btn btn-success" onclick="copyTokens()">📋 複製所有環境變數</button>
                        <button class="btn" onclick="copyAccessToken()">複製 Access Token</button>
                        <button class="btn" onclick="copyRefreshToken()">複製 Refresh Token</button>
                    </div>
                </div>
                
                <!-- 複製區域 -->
                <div class="section">
                    <h2>📝 可複製的設定格式</h2>
                    <div class="copy-box">
                        <button class="copy-btn" onclick="copyEnvFormat()">複製</button>
GOOGLE_ACCESS_TOKEN=${tokenInfo.access_token}
GOOGLE_REFRESH_TOKEN=${tokenInfo.refresh_token}
                    </div>
                </div>
                
                <!-- 設定指引 -->
                <div class="section">
                    <h2>🔧 Render Dashboard 設定步驟</h2>
                    <div class="instructions">
                        <h3>請按照以下步驟設定環境變數：</h3>
                        <ol>
                            <li>登入您的 <strong>Render Dashboard</strong></li>
                            <li>選擇您的 <strong>員工簽到系統服務</strong></li>
                            <li>點選左側選單的 <strong>"Environment"</strong></li>
                            <li>點選 <strong>"Add Environment Variable"</strong></li>
                            <li>新增第一個變數：
                                <ul>
                                    <li>Key: <code>GOOGLE_ACCESS_TOKEN</code></li>
                                    <li>Value: 上方顯示的 Access Token</li>
                                </ul>
                            </li>
                            <li>點選 <strong>"Add Environment Variable"</strong> 再次新增</li>
                            <li>新增第二個變數：
                                <ul>
                                    <li>Key: <code>GOOGLE_REFRESH_TOKEN</code></li>
                                    <li>Value: 上方顯示的 Refresh Token</li>
                                </ul>
                            </li>
                            <li>點選 <strong>"Save Changes"</strong></li>
                            <li>等待服務重新部署完成（約 2-3 分鐘）</li>
                        </ol>
                        <p style="margin-top: 15px; color: #d32f2f;"><strong>⚠️ 重要：</strong>設定完成後，未來重新部署將不再需要重新授權！</p>
                    </div>
                </div>
                
                <!-- Token 資訊 -->
                <div class="section">
                    <h2>ℹ️ Token 資訊</h2>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <p><strong>權限範圍：</strong>${tokenInfo.scope}</p>
                        <p><strong>Token 類型：</strong>${tokenInfo.token_type}</p>
                        <p><strong>過期時間：</strong>${tokenInfo.expiry_date}</p>
                    </div>
                </div>
            ` : `
                <!-- 未授權狀態 -->
                <div class="status-card status-error">
                    <div class="status-icon">❌</div>
                    <div>
                        <h3>Google 授權狀態：未授權</h3>
                        <p>您需要先完成 Google 授權才能取得環境變數。</p>
                    </div>
                </div>
                
                <div class="section">
                    <h2>🔑 開始授權</h2>
                    <div class="instructions">
                        <h3>請按照以下步驟完成授權：</h3>
                        <ol>
                            <li>點選下方的 <strong>"開始 Google 授權"</strong> 按鈕</li>
                            <li>在開啟的新視窗中登入您的 Google 帳號</li>
                            <li>同意應用程式的權限要求</li>
                            <li>授權完成後返回此頁面</li>
                            <li>重新整理此頁面以取得環境變數</li>
                        </ol>
                    </div>
                    
                    <div class="action-buttons">
                        <a href="/auth/google" class="btn btn-success">🔑 開始 Google 授權</a>
                        <button class="btn" onclick="location.reload()">🔄 重新整理頁面</button>
                    </div>
                </div>
            `}
            
            <!-- 常見問題 -->
            <div class="section">
                <h2>❓ 常見問題</h2>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <details style="margin-bottom: 15px;">
                        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">Q: 為什麼需要設定這些環境變數？</summary>
                        <p>A: Render 重新部署時會重置運行時的記憶體，導致 Google Token 丟失。將 Token 設定為環境變數可以讓系統在重新部署後自動載入，無需重新授權。</p>
                    </details>
                    
                    <details style="margin-bottom: 15px;">
                        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">Q: 這些 Token 會過期嗎？</summary>
                        <p>A: Access Token 會在 1 小時後過期，但 Refresh Token 可以長期有效。系統會自動使用 Refresh Token 取得新的 Access Token。</p>
                    </details>
                    
                    <details style="margin-bottom: 15px;">
                        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">Q: 設定後還需要重新授權嗎？</summary>
                        <p>A: 不需要！設定環境變數後，系統會在每次重新部署時自動載入 Token，完全無需手動重新授權。</p>
                    </details>
                    
                    <details>
                        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">Q: Token 安全嗎？</summary>
                        <p>A: Render 的環境變數是加密儲存的，只有您的應用程式可以存取。不過建議定期更新 Token 以維持最佳安全性。</p>
                    </details>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>🤖 員工運動社團活動簽到系統 - Google Token 設定工具</p>
            <p><a href="/" style="color: #667eea;">返回首頁</a> | <a href="/admin" style="color: #667eea;">管理後台</a></p>
        </div>
    </div>

    <script>
        // 複製功能
        async function copyToClipboard(text, successMessage) {
            try {
                await navigator.clipboard.writeText(text);
                showToast(successMessage || '已複製到剪貼簿！', 'success');
            } catch (err) {
                // 備用方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast(successMessage || '已複製到剪貼簿！', 'success');
            }
        }
        
        function copyTokens() {
            const accessToken = document.getElementById('accessToken')?.textContent || '';
            const refreshToken = document.getElementById('refreshToken')?.textContent || '';
            const envText = \`GOOGLE_ACCESS_TOKEN=\${accessToken}
GOOGLE_REFRESH_TOKEN=\${refreshToken}\`;
            copyToClipboard(envText, '✅ 所有環境變數已複製！請到 Render Dashboard 設定。');
        }
        
        function copyAccessToken() {
            const token = document.getElementById('accessToken')?.textContent || '';
            copyToClipboard(token, '✅ Access Token 已複製！');
        }
        
        function copyRefreshToken() {
            const token = document.getElementById('refreshToken')?.textContent || '';
            copyToClipboard(token, '✅ Refresh Token 已複製！');
        }
        
        function copyEnvFormat() {
            const accessToken = document.getElementById('accessToken')?.textContent || '';
            const refreshToken = document.getElementById('refreshToken')?.textContent || '';
            const envText = \`GOOGLE_ACCESS_TOKEN=\${accessToken}
GOOGLE_REFRESH_TOKEN=\${refreshToken}\`;
            copyToClipboard(envText, '✅ 環境變數格式已複製！');
        }
        
        // Toast 通知
        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: \${type === 'success' ? '#28a745' : '#17a2b8'};
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 1000;
                font-weight: bold;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            \`;
            
            // 新增動畫樣式
            if (!document.querySelector('#toast-style')) {
                const style = document.createElement('style');
                style.id = 'toast-style';
                style.textContent = \`
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOut {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100%); opacity: 0; }
                    }
                \`;
                document.head.appendChild(style);
            }
            
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }
        
        // 頁面載入完成後的提示
        window.addEventListener('load', function() {
            ${hasValidTokens ? `
                showToast('✅ Token 已載入，請複製環境變數到 Render Dashboard', 'success');
            ` : `
                showToast('⚠️ 請先完成 Google 授權', 'info');
            `}
        });
    </script>
</body>
</html>
        `;
        
        res.send(html);
    } catch (error) {
        console.error('Token 工具頁面錯誤:', error);
        res.status(500).send(`
            <html>
            <head><title>系統錯誤</title></head>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
                <h1>❌ 系統錯誤</h1>
                <p>載入 Token 工具時發生錯誤，請稍後重試。</p>
                <p><a href="/">返回首頁</a></p>
            </body>
            </html>
        `);
    }
});

module.exports = router;