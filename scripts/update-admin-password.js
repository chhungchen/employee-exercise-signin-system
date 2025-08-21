const personalDatabase = require('../database/personal-google-database');
const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
    try {
        console.log('🔄 開始更新管理員密碼...');
        
        // 初始化資料庫連接
        const initialized = await personalDatabase.initialize();
        if (!initialized) {
            console.error('❌ 資料庫初始化失敗');
            return;
        }
        
        // 取得新密碼
        const newPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
        console.log(`🔑 使用新密碼: ${newPassword}`);
        
        // 取得所有管理員
        const admins = await personalDatabase.getAllAdmins();
        console.log(`👥 找到 ${admins.length} 個管理員帳號`);
        
        if (admins.length === 0) {
            console.log('ℹ️ 沒有找到管理員，建立新的管理員帳號...');
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await personalDatabase.createAdmin({
                id: 1,
                username: 'admin',
                password_hash: hashedPassword,
                created_at: new Date().toISOString()
            });
            
            console.log('✅ 已建立新的管理員帳號');
            return;
        }
        
        // 更新所有管理員的密碼
        for (const admin of admins) {
            console.log(`🔄 更新管理員 "${admin.username}" 的密碼...`);
            
            // 更新密碼（updateAdminPassword 方法會自動加密密碼）
            const success = await personalDatabase.updateAdminPassword(admin.username, newPassword);
            
            if (success) {
                console.log(`✅ 管理員 "${admin.username}" 密碼更新成功`);
            } else {
                console.log(`❌ 管理員 "${admin.username}" 密碼更新失敗`);
            }
        }
        
        // 驗證更新結果
        console.log('\n🧪 驗證密碼更新結果...');
        const updatedAdmins = await personalDatabase.getAllAdmins();
        
        for (const admin of updatedAdmins) {
            if (admin.password_hash) {
                const isNewPasswordValid = await bcrypt.compare(newPassword, admin.password_hash);
                const isOldPasswordValid = await bcrypt.compare(process.env.OLD_ADMIN_PASSWORD || 'admin', admin.password_hash);
                
                console.log(`🔍 管理員 "${admin.username}":`);
                console.log(`   - 新密碼驗證: ${isNewPasswordValid ? '✅ 正確' : '❌ 錯誤'}`);
                console.log(`   - 舊密碼驗證: ${isOldPasswordValid ? '⚠️ 仍有效' : '✅ 已失效'}`);
            }
        }
        
        console.log('\n🎉 管理員密碼更新完成！');
        console.log(`📋 新的登入資訊:`);
        console.log(`   帳號: admin`);
        console.log(`   密碼: ${newPassword}`);
        
    } catch (error) {
        console.error('❌ 更新管理員密碼失敗:', error);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    updateAdminPassword()
        .then(() => {
            console.log('\n✅ 腳本執行完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 腳本執行失敗:', error);
            process.exit(1);
        });
}

module.exports = { updateAdminPassword };