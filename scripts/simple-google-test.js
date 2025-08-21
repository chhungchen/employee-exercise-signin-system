// 簡化的 Google 服務測試（跳過 OAuth）
require('dotenv').config({ path: '.env.local' });

console.log('🧪 簡化 Google 服務測試...\n');

console.log('📋 環境變數檢查：');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ 已設定' : '❌ 未設定');
console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ 已設定' : '❌ 未設定');
console.log('- GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || '❌ 未設定');

console.log('\n🔐 Google OAuth 應用程式狀態：');
console.log('目前您的 Google Cloud 專案處於「測試」狀態，需要以下其中一個解決方案：\n');

console.log('📝 解決方案選項：');
console.log('');
console.log('方案 A - 新增測試使用者（最快）：');
console.log('1. 前往：https://console.cloud.google.com/apis/credentials/consent');
console.log('2. 在「測試使用者」區域點擊「新增使用者」');
console.log('3. 新增您的 Google 帳號 email');
console.log('4. 儲存後重新進行授權');
console.log('');

console.log('方案 B - 發布應用程式：');
console.log('1. 完成 OAuth 同意畫面所有資訊');
console.log('2. 點擊「發布應用程式」');
console.log('3. 等待 Google 審核');
console.log('');

console.log('方案 C - 使用內部應用程式：');
console.log('1. 將應用程式類型改為「內部」');
console.log('2. 僅限組織內部使用者');
console.log('');

console.log('🎯 建議：選擇方案 A（新增測試使用者）最為快速！');

console.log('\n🚀 設定完成後，執行以下指令繼續測試：');
console.log('npm run test-comprehensive');

console.log('\n💡 或者啟動本地伺服器進行手動測試：');
console.log('npm run test-local');
console.log('然後開啟：http://localhost:3000/auth/google');