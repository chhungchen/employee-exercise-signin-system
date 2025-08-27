const { db } = require('../database/database');

console.log('=== 資料庫診斷工具 ===\n');

// 檢查各個表的記錄數量
function checkTableCounts() {
    return new Promise((resolve) => {
        console.log('📊 檢查各表記錄數量:');
        
        const queries = [
            { table: 'employees', description: '員工' },
            { table: 'activities', description: '活動' },
            { table: 'signins', description: '簽到記錄' },
            { table: 'admins', description: '管理員' }
        ];

        let completed = 0;
        const results = {};

        queries.forEach(({ table, description }) => {
            db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                if (err) {
                    console.log(`❌ ${description} (${table}): 錯誤 - ${err.message}`);
                } else {
                    console.log(`✅ ${description} (${table}): ${row.count} 筆`);
                    results[table] = row.count;
                }
                
                completed++;
                if (completed === queries.length) {
                    console.log('');
                    resolve(results);
                }
            });
        });
    });
}

// 檢查最近的簽到記錄
function checkRecentSignins() {
    return new Promise((resolve) => {
        console.log('📋 最近 5 筆簽到記錄:');
        
        db.all(`
            SELECT 
                s.id,
                s.signin_code,
                s.employee_id,
                e.name,
                e.department,
                a.activity_type,
                a.location,
                a.activity_datetime,
                s.signin_time
            FROM signins s
            JOIN employees e ON s.employee_id = e.employee_id
            JOIN activities a ON s.activity_id = a.id
            ORDER BY s.signin_time DESC
            LIMIT 5
        `, (err, rows) => {
            if (err) {
                console.log(`❌ 查詢錯誤: ${err.message}`);
            } else {
                if (rows.length === 0) {
                    console.log('📝 目前沒有簽到記錄');
                } else {
                    rows.forEach((row, index) => {
                        console.log(`${index + 1}. [${row.signin_code}] ${row.name} (${row.department}) - ${row.activity_type} @ ${row.location} (${row.activity_datetime})`);
                    });
                }
            }
            console.log('');
            resolve(rows);
        });
    });
}

// 檢查資料完整性
function checkDataIntegrity() {
    return new Promise((resolve) => {
        console.log('🔍 檢查資料完整性:');
        
        // 檢查孤立的簽到記錄（沒有對應員工或活動）
        db.all(`
            SELECT COUNT(*) as orphaned_signins
            FROM signins s
            LEFT JOIN employees e ON s.employee_id = e.employee_id
            LEFT JOIN activities a ON s.activity_id = a.id
            WHERE e.employee_id IS NULL OR a.id IS NULL
        `, (err, result) => {
            if (err) {
                console.log(`❌ 完整性檢查錯誤: ${err.message}`);
            } else {
                const orphanedCount = result[0].orphaned_signins;
                if (orphanedCount > 0) {
                    console.log(`⚠️  發現 ${orphanedCount} 筆孤立的簽到記錄`);
                } else {
                    console.log('✅ 資料完整性正常');
                }
            }
            console.log('');
            resolve();
        });
    });
}

// 檢查重複簽到
function checkDuplicateSignins() {
    return new Promise((resolve) => {
        console.log('🔄 檢查重複簽到:');
        
        db.all(`
            SELECT 
                employee_id, 
                activity_id, 
                COUNT(*) as duplicate_count
            FROM signins 
            GROUP BY employee_id, activity_id 
            HAVING COUNT(*) > 1
        `, (err, rows) => {
            if (err) {
                console.log(`❌ 重複檢查錯誤: ${err.message}`);
            } else {
                if (rows.length === 0) {
                    console.log('✅ 沒有發現重複簽到');
                } else {
                    console.log(`⚠️  發現 ${rows.length} 組重複簽到:`);
                    rows.forEach(row => {
                        console.log(`   員工 ${row.employee_id} 在活動 ${row.activity_id} 簽到了 ${row.duplicate_count} 次`);
                    });
                }
            }
            console.log('');
            resolve();
        });
    });
}

// 主要執行函數
async function runDiagnostics() {
    try {
        const tableCounts = await checkTableCounts();
        await checkRecentSignins();
        await checkDataIntegrity();
        await checkDuplicateSignins();
        
        console.log('=== 診斷完成 ===');
        console.log(`📊 總計: ${tableCounts.employees || 0} 位員工, ${tableCounts.activities || 0} 個活動, ${tableCounts.signins || 0} 筆簽到記錄`);
        
    } catch (error) {
        console.error('❌ 診斷過程發生錯誤:', error);
    } finally {
        db.close();
    }
}

runDiagnostics();