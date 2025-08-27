const { initDatabase } = require('../database/database');

console.log('開始初始化資料庫...');

initDatabase()
    .then(() => {
        console.log('✅ 資料庫初始化完成！');
        console.log('📊 已建立以下表格：');
        console.log('   - employees (員工表)');
        console.log('   - activities (活動表)');
        console.log('   - signins (簽到表)');
        console.log('   - admins (管理員表)');
        console.log('');
        console.log('🔑 預設管理員帳號：');
        console.log('   帳號：admin');
        console.log('   密碼：請參考環境變數 DEFAULT_ADMIN_PASSWORD');
        console.log('');
        console.log('🚀 現在可以啟動伺服器了！');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ 資料庫初始化失敗：', err);
        process.exit(1);
    }); 