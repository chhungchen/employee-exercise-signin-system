#!/usr/bin/env node

/**
 * 環境變數檢查腳本
 * 用於診斷 SMTP 和 Google 服務配置問題
 */

console.log('🔍 環境變數診斷檢查');
console.log('==========================================');

// 檢查基本環境設定
console.log('\n📊 基本環境設定:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || '未設定'}`);
console.log(`PORT: ${process.env.PORT || '未設定'}`);
console.log(`TZ: ${process.env.TZ || '未設定'}`);

// 檢查 Google 服務設定
console.log('\n🔧 Google 服務設定:');
console.log(`USE_GOOGLE_SERVICES: ${process.env.USE_GOOGLE_SERVICES || '未設定'}`);
console.log(`USE_PERSONAL_GOOGLE: ${process.env.USE_PERSONAL_GOOGLE || '未設定'}`);

// 檢查 Google OAuth 設定
console.log('\n🔑 Google OAuth 設定:');
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

console.log(`GOOGLE_CLIENT_ID: ${clientId ? `${clientId.substring(0, 10)}...` : '未設定'}`);
console.log(`GOOGLE_CLIENT_SECRET: ${clientSecret ? `${clientSecret.substring(0, 6)}...` : '未設定'}`);
console.log(`GOOGLE_REDIRECT_URI: ${redirectUri || '未設定'}`);

// 檢查 Google 資源 ID
console.log('\n📊 Google 資源 ID:');
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

console.log(`GOOGLE_SPREADSHEET_ID: ${spreadsheetId ? `${spreadsheetId.substring(0, 10)}...` : '未設定'}`);
console.log(`GOOGLE_DRIVE_FOLDER_ID: ${driveFolder ? `${driveFolder.substring(0, 10)}...` : '未設定'}`);
console.log(`GOOGLE_REFRESH_TOKEN: ${refreshToken ? `${refreshToken.substring(0, 10)}...` : '未設定'}`);

// 檢查 SMTP 設定
console.log('\n📧 SMTP 郵件設定:');
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM;

console.log(`SMTP_HOST: ${smtpHost || '未設定'}`);
console.log(`SMTP_PORT: ${smtpPort || '未設定'}`);
console.log(`SMTP_USER: ${smtpUser || '未設定'}`);
console.log(`SMTP_PASS: ${smtpPass ? `${smtpPass.substring(0, 4)}...` : '未設定'}`);
console.log(`EMAIL_FROM: ${emailFrom || '未設定'}`);

// 診斷 SMTP 配置
console.log('\n🔍 SMTP 配置診斷:');

if (!smtpHost) {
    console.log('❌ SMTP_HOST 未設定');
} else if (smtpHost === 'smtp.gmail.com') {
    console.log('✅ 偵測到 Gmail SMTP 配置');
    
    if (!smtpUser || !smtpPass) {
        console.log('❌ Gmail SMTP 需要 SMTP_USER 和 SMTP_PASS');
    } else {
        if (smtpPort !== '587') {
            console.log('⚠️ Gmail SMTP 建議使用連接埠 587');
        }
        
        if (smtpPass.length !== 16 && !smtpPass.includes(' ')) {
            console.log('⚠️ Gmail SMTP_PASS 應該是 16 位應用程式密碼');
            console.log('   格式範例: abcd efgh ijkl mnop');
        }
        
        if (!smtpUser.includes('@gmail.com')) {
            console.log('⚠️ Gmail SMTP_USER 應該是 Gmail 地址');
        }
    }
} else if (smtpHost.includes('jih-sun.com.tw')) {
    console.log('✅ 偵測到公司內部 SMTP 配置');
    
    if (process.env.NODE_ENV === 'production') {
        console.log('⚠️ 生產環境使用公司內部 SMTP 可能無法連線');
        console.log('   建議在生產環境使用 Gmail SMTP');
    }
    
    if (smtpPort !== '25') {
        console.log('⚠️ 公司內部 SMTP 通常使用連接埠 25');
    }
} else {
    console.log(`⚠️ 未知的 SMTP 主機: ${smtpHost}`);
}

// 檢查認證設定
console.log('\n🔐 認證設定:');
const jwtSecret = process.env.JWT_SECRET;
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

console.log(`JWT_SECRET: ${jwtSecret ? '已設定' : '未設定'}`);
console.log(`DEFAULT_ADMIN_PASSWORD: ${adminPassword ? '已設定' : '未設定'}`);

if (process.env.NODE_ENV === 'production' && adminPassword === 'admin123') {
    console.log('⚠️ 生產環境建議修改預設管理員密碼');
}

// 總結建議
console.log('\n💡 建議檢查項目:');

const issues = [];

if (!smtpHost) issues.push('設定 SMTP_HOST');
if (!smtpUser) issues.push('設定 SMTP_USER');
if (!smtpPass) issues.push('設定 SMTP_PASS');
if (!emailFrom) issues.push('設定 EMAIL_FROM');

if (process.env.NODE_ENV === 'production' && smtpHost && smtpHost.includes('jih-sun.com.tw')) {
    issues.push('生產環境改用 Gmail SMTP');
}

if (!clientId) issues.push('設定 GOOGLE_CLIENT_ID');
if (!clientSecret) issues.push('設定 GOOGLE_CLIENT_SECRET');
if (!refreshToken) issues.push('完成 Google OAuth 授權');

if (issues.length === 0) {
    console.log('✅ 環境變數配置看起來正常');
} else {
    console.log('❌ 發現以下問題:');
    issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
    });
}

console.log('\n==========================================');
console.log('✨ 診斷檢查完成');

// 如果是腳本執行，嘗試測試 SMTP 連線
if (require.main === module) {
    console.log('\n🧪 嘗試測試 SMTP 連線...');
    
    const emailService = require('../services/email-service');
    
    emailService.initialize().then(success => {
        if (success) {
            console.log('🎉 SMTP 連線測試成功！');
        } else {
            console.log('💥 SMTP 連線測試失敗，請檢查上述診斷結果');
        }
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('💀 SMTP 連線測試發生錯誤:', error.message);
        process.exit(1);
    });
}