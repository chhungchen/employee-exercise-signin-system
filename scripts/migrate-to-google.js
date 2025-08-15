const path = require('path');
const fs = require('fs');

// 檢查是否有現有的 SQLite 資料庫
const dbPath = path.join(__dirname, '../database/exercise_signin.db');
const hasExistingData = fs.existsSync(dbPath);

let sqliteDb = null;
if (hasExistingData) {
    const sqlite3 = require('sqlite3').verbose();
    sqliteDb = new sqlite3.Database(dbPath);
}

const googleDatabase = require('../database/google-database');
const googleServices = require('../services/google-services');

console.log('=== 資料遷移到 Google Sheets & Drive ===\n');

// 遷移員工資料
async function migrateEmployees() {
    if (!hasExistingData) {
        console.log('📝 沒有現有員工資料需要遷移');
        return;
    }

    return new Promise((resolve) => {
        console.log('👥 開始遷移員工資料...');
        
        sqliteDb.all('SELECT * FROM employees', async (err, rows) => {
            if (err) {
                console.error('❌ 讀取員工資料失敗:', err);
                resolve();
                return;
            }

            if (rows.length === 0) {
                console.log('📝 沒有員工資料需要遷移');
                resolve();
                return;
            }

            for (const row of rows) {
                try {
                    await googleDatabase.createEmployee({
                        employee_id: row.employee_id,
                        name: row.name,
                        department: row.department,
                        created_at: row.created_at
                    });
                    console.log(`✅ 已遷移員工: ${row.name} (${row.employee_id})`);
                } catch (error) {
                    console.error(`❌ 遷移員工 ${row.name} 失敗:`, error);
                }
            }

            console.log(`🎉 員工資料遷移完成，共 ${rows.length} 筆\n`);
            resolve();
        });
    });
}

// 遷移活動資料
async function migrateActivities() {
    if (!hasExistingData) {
        console.log('📝 沒有現有活動資料需要遷移');
        return;
    }

    return new Promise((resolve) => {
        console.log('🏃 開始遷移活動資料...');
        
        sqliteDb.all('SELECT * FROM activities', async (err, rows) => {
            if (err) {
                console.error('❌ 讀取活動資料失敗:', err);
                resolve();
                return;
            }

            if (rows.length === 0) {
                console.log('📝 沒有活動資料需要遷移');
                resolve();
                return;
            }

            for (const row of rows) {
                try {
                    await googleDatabase.createActivity({
                        activity_code: row.activity_code,
                        activity_type: row.activity_type,
                        location: row.location,
                        activity_datetime: row.activity_datetime
                    });
                    console.log(`✅ 已遷移活動: ${row.activity_type} @ ${row.location}`);
                } catch (error) {
                    console.error(`❌ 遷移活動失敗:`, error);
                }
            }

            console.log(`🎉 活動資料遷移完成，共 ${rows.length} 筆\n`);
            resolve();
        });
    });
}

// 遷移照片到 Google Drive
async function migratePhoto(photoPath) {
    if (!photoPath) return null;

    try {
        const fullPath = path.join(__dirname, '..', photoPath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`⚠️ 照片檔案不存在: ${photoPath}`);
            return null;
        }

        const fileBuffer = fs.readFileSync(fullPath);
        const fileName = path.basename(photoPath);
        const mimeType = 'image/jpeg'; // 假設都是 JPEG，實際可以根據副檔名判斷

        const driveFile = await googleServices.uploadPhoto(fileBuffer, fileName, mimeType);
        const photoUrl = `https://drive.google.com/uc?id=${driveFile.id}`;
        
        console.log(`📷 已上傳照片: ${fileName}`);
        return photoUrl;
    } catch (error) {
        console.error(`❌ 上傳照片失敗 ${photoPath}:`, error);
        return null;
    }
}

// 遷移簽到資料
async function migrateSignins() {
    if (!hasExistingData) {
        console.log('📝 沒有現有簽到資料需要遷移');
        return;
    }

    return new Promise((resolve) => {
        console.log('✍️ 開始遷移簽到資料...');
        
        sqliteDb.all('SELECT * FROM signins', async (err, rows) => {
            if (err) {
                console.error('❌ 讀取簽到資料失敗:', err);
                resolve();
                return;
            }

            if (rows.length === 0) {
                console.log('📝 沒有簽到資料需要遷移');
                resolve();
                return;
            }

            for (const row of rows) {
                try {
                    // 遷移照片
                    let photoUrl = null;
                    if (row.photo_path) {
                        photoUrl = await migratePhoto(row.photo_path);
                    }

                    await googleDatabase.createSignin({
                        signin_code: row.signin_code,
                        employee_id: row.employee_id,
                        activity_id: row.activity_id,
                        signin_type: row.signin_type,
                        notes: row.notes || '',
                        photo_url: photoUrl,
                        signature_data: row.signature_data || '',
                        signin_time: row.signin_time
                    });
                    
                    console.log(`✅ 已遷移簽到記錄: ${row.signin_code}`);
                } catch (error) {
                    console.error(`❌ 遷移簽到記錄 ${row.signin_code} 失敗:`, error);
                }
            }

            console.log(`🎉 簽到資料遷移完成，共 ${rows.length} 筆\n`);
            resolve();
        });
    });
}

// 遷移管理員資料
async function migrateAdmins() {
    if (!hasExistingData) {
        console.log('📝 沒有現有管理員資料需要遷移');
        return;
    }

    return new Promise((resolve) => {
        console.log('👨‍💼 開始遷移管理員資料...');
        
        sqliteDb.all('SELECT * FROM admins', async (err, rows) => {
            if (err) {
                console.error('❌ 讀取管理員資料失敗:', err);
                resolve();
                return;
            }

            if (rows.length === 0) {
                console.log('📝 沒有管理員資料需要遷移');
                resolve();
                return;
            }

            for (const row of rows) {
                try {
                    await googleDatabase.createAdmin({
                        username: row.username,
                        password: row.password,
                        created_at: row.created_at
                    });
                    console.log(`✅ 已遷移管理員: ${row.username}`);
                } catch (error) {
                    console.error(`❌ 遷移管理員 ${row.username} 失敗:`, error);
                }
            }

            console.log(`🎉 管理員資料遷移完成，共 ${rows.length} 筆\n`);
            resolve();
        });
    });
}

// 主要遷移函數
async function runMigration() {
    try {
        // 初始化 Google Services
        await googleDatabase.initialize();
        console.log('🚀 Google Services 初始化完成\n');

        if (!hasExistingData) {
            console.log('📝 沒有發現現有的 SQLite 資料庫，將建立空的 Google Sheets');
            console.log('✅ 遷移完成！');
            return;
        }

        console.log('📊 發現現有的 SQLite 資料庫，開始遷移...\n');

        // 依序遷移資料
        await migrateEmployees();
        await migrateActivities();
        await migrateSignins();
        await migrateAdmins();

        console.log('🎊 所有資料遷移完成！');
        console.log('\n💡 建議步驟：');
        console.log('1. 檢查 Google Sheets 中的資料是否正確');
        console.log('2. 檢查 Google Drive 中的照片是否完整');
        console.log('3. 設定環境變數 USE_GOOGLE_SERVICES=true');
        console.log('4. 重新部署應用程式');

    } catch (error) {
        console.error('❌ 遷移過程發生錯誤:', error);
    } finally {
        if (sqliteDb) {
            sqliteDb.close();
        }
    }
}

// 檢查必要的環境變數
if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('❌ 缺少 GOOGLE_SERVICE_ACCOUNT_KEY 環境變數');
    console.log('請先設定 Google Service Account 的 JSON 金鑰');
    process.exit(1);
}

runMigration();