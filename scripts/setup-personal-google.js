// 載入環境變數
require('dotenv').config();

const personalGoogleServices = require('../services/personal-google-services');

// 嘗試載入 open 套件，如果沒有安裝就跳過自動開啟瀏覽器功能
let open;
try {
    open = require('open');
} catch (error) {
    open = null;
}

console.log('🔧 設定個人 Google 帳戶整合...\n');

async function setupPersonalGoogle() {
    try {
        // 檢查必要的環境變數
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error('❌ 錯誤：缺少必要的環境變數');
            console.log('請確認您的 .env 檔案包含以下設定：');
            console.log('- GOOGLE_CLIENT_ID');
            console.log('- GOOGLE_CLIENT_SECRET');
            console.log('- GOOGLE_REDIRECT_URI\n');
            console.log('📖 請參考 FREE_GOOGLE_SETUP.md 瞭解如何設定');
            process.exit(1);
        }

        // 初始化服務
        const initialized = await personalGoogleServices.initialize();
        if (initialized) {
            console.log('✅ 已有有效的授權，無需重新設定');
            return;
        }

        // 取得授權 URL
        const authUrl = personalGoogleServices.getAuthUrl();
        
        console.log('🔐 請完成 Google 授權流程：');
        console.log('1. 瀏覽器將自動開啟授權頁面');
        console.log('2. 選擇您的 Google 帳戶');
        console.log('3. 授權應用程式存取 Google Sheets 和 Drive');
        console.log('4. 完成後請回到此處\n');
        
        console.log('🌐 授權 URL:');
        console.log(authUrl);
        console.log('\n');

        // 嘗試自動開啟瀏覽器
        if (open) {
            try {
                await open(authUrl);
                console.log('✅ 瀏覽器已自動開啟');
            } catch (error) {
                console.log('⚠️  無法自動開啟瀏覽器，請手動複製上方 URL 到瀏覽器中');
            }
        } else {
            console.log('💡 請手動複製上方 URL 到瀏覽器中開啟');
        }

        console.log('\n⏳ 等待授權完成...');
        console.log('💡 提示：授權完成後，系統會自動儲存憑證');
        console.log('🔄 如果授權失敗，請重新執行此命令');

    } catch (error) {
        console.error('❌ 設定失敗:', error.message);
        process.exit(1);
    }
}

setupPersonalGoogle();