const { db } = require('../database/database');
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
  console.log('--- 後台管理員密碼變更工具 ---');

  try {
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

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE admins SET password = ? WHERE username = ?`,
        [hashedPassword, targetUsername],
        function(err) {
          if (err) {
            return reject(err);
          }
          if (this.changes === 0) {
            console.warn(`⚠️ 警告：找不到用戶名為 "${targetUsername}" 的管理員。`);
            console.log('如果您想新增管理員，請執行 `npm run init-db`。');
            return resolve();
          }
          console.log(`✅ 成功：管理員 "${targetUsername}" 的密碼已成功更新！`);
          resolve();
        }
      );
    });

  } catch (error) {
    console.error('❌ 密碼變更過程中發生錯誤:', error);
  } finally {
    rl.close();
    db.close();
  }
}

changeAdminPassword();