const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// 資料庫檔案路徑
const dbPath = path.join(__dirname, 'exercise_signin.db');

// 建立資料庫連接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('資料庫連接錯誤:', err.message);
    } else {
        console.log('成功連接到SQLite資料庫');
    }
});

// 初始化資料庫表格
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        // 啟用外鍵約束
        db.run('PRAGMA foreign_keys = ON');

        // 建立員工表格
        db.run(`
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 建立活動表格
        db.run(`
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                activity_code TEXT UNIQUE NOT NULL,
                activity_type TEXT NOT NULL,
                location TEXT NOT NULL,
                activity_datetime DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 建立簽到表格
        db.run(`
            CREATE TABLE IF NOT EXISTS signins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                signin_code TEXT UNIQUE NOT NULL,
                employee_id TEXT NOT NULL,
                activity_id INTEGER NOT NULL,
                signin_type TEXT DEFAULT '準時簽到',
                notes TEXT,
                photo_path TEXT,
                signature_data TEXT,
                signin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees (employee_id),
                FOREIGN KEY (activity_id) REFERENCES activities (id)
            )
        `);

        // 建立管理員表格
        db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                reject(err);
            } else {
                // 建立預設管理員帳號
                createDefaultAdmin().then(() => {
                    resolve();
                }).catch(reject);
            }
        });
    });
};

// 建立預設管理員帳號
const createDefaultAdmin = async () => {
    const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin', 10);
    
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT OR IGNORE INTO admins (username, password) 
            VALUES (?, ?)
        `, ['admin', hashedPassword], (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('預設管理員帳號已建立');
                resolve();
            }
        });
    });
};

// 生成唯一編碼
const generateUniqueCode = (prefix) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}${timestamp}${random}`;
};

module.exports = {
    db,
    initDatabase,
    generateUniqueCode
}; 