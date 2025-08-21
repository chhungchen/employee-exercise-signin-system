const googleDatabase = require('../database/google-database');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function changeAdminPassword() {
  console.log('--- 後台管理員密碼變更工具 (Google Sheets 版) ---');

  try {
    // 初始化 Google Database
    await googleDatabase.initialize();

    const adminUsername = await askQuestion('請輸入要變更密碼的管理員帳號 (預設為 admin): ');
    const newPassword = await askQuestion('請輸入新密碼: ');
    const confirmPassword = await askQuestion('請再次確認新密碼: ');

    if (newPassword !== confirmPassword) {
      console.error('❌ 錯誤：兩次輸入的密碼不一致，請重新執行腳本。');
      rl.close();
      return;
    }

    if (newPassword.length < 6) {
      console.error('❌ 錯誤：密碼長度至少需要 6 個字元。');
      rl.close();
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const targetUsername = adminUsername.trim() || 'admin';

    // 更新密碼
    const success = await googleDatabase.updateAdminPassword(targetUsername, hashedPassword);
    
    if (success) {
      console.log(`✅ 成功：管理員 "${targetUsername}" 的密碼已成功更新！`);
    } else {
      console.warn(`⚠️ 警告：找不到用戶名為 "${targetUsername}" 的管理員。`);
      console.log('如果您想新增管理員，請聯繫系統管理員。');
    }

  } catch (error) {
    console.error('❌ 密碼變更過程中發生錯誤:', error);
  } finally {
    rl.close();
  }
}

// 檢查必要的環境變數
if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('❌ 缺少 GOOGLE_SERVICE_ACCOUNT_KEY 環境變數');
    console.log('請先設定 Google Service Account 的 JSON 金鑰');
    process.exit(1);
}

changeAdminPassword();