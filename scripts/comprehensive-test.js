// 載入環境變數
require('dotenv').config({ path: '.env.local' });

const personalGoogleServices = require('../services/personal-google-services');
const personalDatabase = require('../database/personal-google-database');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

console.log('🧪 開始完整的 Google 服務測試...\n');

let testResults = {
    oauth: false,
    sheets: false,
    drive: false,
    database: false,
    admin: false
};

async function runComprehensiveTest() {
    try {
        console.log('📋 測試清單：');
        console.log('1. Google OAuth 授權測試');
        console.log('2. Google Sheets 連接和資料操作');
        console.log('3. Google Drive 檔案上傳測試');
        console.log('4. 資料庫操作完整測試');
        console.log('5. 管理員功能測試');
        console.log('6. 錯誤處理測試\n');

        // 1. 環境變數檢查
        console.log('🔍 1. 檢查環境變數設定...');
        const requiredVars = [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET', 
            'GOOGLE_REDIRECT_URI'
        ];
        
        let missingVars = [];
        requiredVars.forEach(varName => {
            if (!process.env[varName] || process.env[varName].includes('您的')) {
                missingVars.push(varName);
            }
        });

        if (missingVars.length > 0) {
            console.log('❌ 缺少必要的環境變數：');
            missingVars.forEach(v => console.log(`   - ${v}`));
            console.log('\n🔧 請編輯 .env.local 檔案，填入您的實際 Google OAuth 憑證');
            console.log('📖 參考 GOOGLE_PERSONAL_SETUP.md 瞭解如何取得憑證\n');
            return false;
        }
        console.log('✅ 環境變數設定正確\n');

        // 2. OAuth 服務初始化測試
        console.log('🔐 2. 測試 Google OAuth 服務初始化...');
        try {
            const initialized = await personalGoogleServices.initialize();
            if (initialized) {
                console.log('✅ Google 服務已授權並初始化成功');
                testResults.oauth = true;
            } else {
                console.log('⚠️  Google 服務需要授權');
                console.log('🌐 授權 URL: ' + personalGoogleServices.getAuthUrl());
                console.log('💡 請在瀏覽器中完成授權後重新執行測試\n');
                return false;
            }
        } catch (error) {
            console.log('❌ OAuth 服務初始化失敗:', error.message);
            return false;
        }
        console.log();

        // 3. Google Sheets 測試
        console.log('📊 3. 測試 Google Sheets 連接...');
        try {
            await personalGoogleServices.ensureSpreadsheetExists();
            console.log('✅ Google Sheets 連接正常');

            // 測試資料寫入和讀取
            const testEmployee = {
                employee_id: 'TEST001',
                name: '測試員工',
                department: '測試部門',
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
            };

            const insertSuccess = await personalGoogleServices.insertData('employees', testEmployee);
            if (insertSuccess) {
                console.log('✅ 資料寫入 Sheets 成功');
                
                const employees = await personalGoogleServices.readData('employees');
                const foundEmployee = employees.find(emp => emp.employee_id === 'TEST001');
                if (foundEmployee) {
                    console.log('✅ 資料讀取 Sheets 成功');
                    testResults.sheets = true;
                } else {
                    console.log('❌ 資料讀取失敗');
                }
            } else {
                console.log('❌ 資料寫入失敗');
            }
        } catch (error) {
            console.log('❌ Google Sheets 測試失敗:', error.message);
        }
        console.log();

        // 4. Google Drive 測試
        console.log('📁 4. 測試 Google Drive 上傳...');
        try {
            // 建立一個測試圖片檔案
            const testImagePath = path.join(__dirname, '../test-image.png');
            if (!fs.existsSync(testImagePath)) {
                // 建立一個簡單的測試檔案
                fs.writeFileSync(testImagePath, 'This is a test file for Google Drive upload');
            }

            const fileBuffer = fs.readFileSync(testImagePath);
            const fileName = `test-upload-${Date.now()}.png`;
            
            const uploadResult = await personalGoogleServices.uploadPhoto(
                fileBuffer,
                fileName,
                'image/png'
            );

            if (uploadResult && uploadResult.id) {
                console.log('✅ 檔案上傳到 Google Drive 成功');
                console.log(`📷 檔案 ID: ${uploadResult.id}`);
                testResults.drive = true;
            } else {
                console.log('❌ 檔案上傳失敗');
            }
        } catch (error) {
            console.log('❌ Google Drive 測試失敗:', error.message);
        }
        console.log();

        // 5. 資料庫操作測試
        console.log('🗄️  5. 測試個人資料庫操作...');
        try {
            const dbInitialized = await personalDatabase.initialize();
            if (dbInitialized) {
                console.log('✅ 個人資料庫初始化成功');
                
                // 測試建立活動
                const testActivity = {
                    activity_code: 'TEST_ACT_001',
                    activity_type: '測試運動',
                    location: '測試地點',
                    activity_datetime: moment().format('YYYY-MM-DD HH:mm:ss'),
                    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                };

                const activityCreated = await personalDatabase.createActivity(testActivity);
                if (activityCreated) {
                    console.log('✅ 活動資料建立成功');
                    testResults.database = true;
                } else {
                    console.log('❌ 活動資料建立失敗');
                }
            } else {
                console.log('❌ 個人資料庫初始化失敗');
            }
        } catch (error) {
            console.log('❌ 資料庫測試失敗:', error.message);
        }
        console.log();

        // 6. 管理員功能測試
        console.log('👨‍💼 6. 測試管理員功能...');
        try {
            await personalDatabase.ensureDefaultAdmin();
            const admin = await personalDatabase.getAdminByUsername('admin');
            if (admin) {
                console.log('✅ 管理員帳號測試成功');
                testResults.admin = true;
            } else {
                console.log('❌ 管理員帳號測試失敗');
            }
        } catch (error) {
            console.log('❌ 管理員功能測試失敗:', error.message);
        }
        console.log();

        // 測試結果統計
        console.log('📈 測試結果統計：');
        console.log('=====================================');
        const passed = Object.values(testResults).filter(r => r === true).length;
        const total = Object.keys(testResults).length;
        
        console.log(`OAuth 授權:     ${testResults.oauth ? '✅ 通過' : '❌ 失敗'}`);
        console.log(`Sheets 操作:    ${testResults.sheets ? '✅ 通過' : '❌ 失敗'}`);
        console.log(`Drive 上傳:     ${testResults.drive ? '✅ 通過' : '❌ 失敗'}`);
        console.log(`資料庫操作:     ${testResults.database ? '✅ 通過' : '❌ 失敗'}`);
        console.log(`管理員功能:     ${testResults.admin ? '✅ 通過' : '❌ 失敗'}`);
        console.log('=====================================');
        console.log(`總計: ${passed}/${total} 項測試通過`);

        if (passed === total) {
            console.log('\n🎉 所有測試通過！系統已準備好部署到 Render.com');
            console.log('💡 接下來可以執行: npm run dev 啟動本地伺服器進行最終測試');
            return true;
        } else {
            console.log('\n⚠️  仍有測試項目失敗，請檢查上述錯誤訊息');
            console.log('🔧 修正問題後請重新執行測試');
            return false;
        }

    } catch (error) {
        console.error('\n❌ 測試過程中發生嚴重錯誤:', error);
        return false;
    }
}

// 執行測試
runComprehensiveTest()
    .then(success => {
        if (success) {
            console.log('\n🚀 準備就緒！您可以安全地部署到 Render.com');
        } else {
            console.log('\n🔄 請修正問題後重新執行: npm run test-comprehensive');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('\n💥 測試腳本執行失敗:', error);
        process.exit(1);
    });