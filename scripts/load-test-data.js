// 測試資料載入腳本
require('dotenv').config({ path: '.env.local' });

const moment = require('moment');
const personalGoogleServices = require('../services/personal-google-services');
const personalDatabase = require('../database/personal-google-database');

// 測試資料
const testEmployees = [
    { employee_id: 'E001', name: '王小明', department: '資訊部' },
    { employee_id: 'E002', name: '李小華', department: '行政部' },
    { employee_id: 'E003', name: '張小美', department: '業務部' },
    { employee_id: 'E004', name: '陳小強', department: '資訊部' },
    { employee_id: 'E005', name: '劉小慧', department: '行政部' }
];

const testActivities = [
    { 
        activity_type: '羽球', 
        location: '體育館A', 
        activity_datetime: '2025-08-15 18:00:00'
    },
    { 
        activity_type: '桌球', 
        location: '體育館B', 
        activity_datetime: '2025-08-16 19:00:00'
    },
    { 
        activity_type: '籃球', 
        location: '戶外球場', 
        activity_datetime: '2025-08-17 17:30:00'
    },
    { 
        activity_type: '瑜珈', 
        location: '多功能教室', 
        activity_datetime: '2025-08-18 12:00:00'
    },
    { 
        activity_type: '慢跑', 
        location: '公園', 
        activity_datetime: '2025-08-19 07:00:00'
    }
];

async function loadTestData() {
    try {
        console.log('🚀 開始載入測試資料...\n');

        // 初始化 Google 服務
        const initialized = await personalGoogleServices.initialize();
        if (!initialized) {
            console.log('❌ Google 服務初始化失敗');
            return;
        }
        console.log('✅ Google 服務初始化成功');

        // 建立員工資料
        console.log('\n👥 建立測試員工資料...');
        const createdEmployees = [];
        for (const emp of testEmployees) {
            const employeeData = {
                ...emp,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
            };
            
            const existing = await personalDatabase.getEmployeeById(emp.employee_id);
            if (!existing) {
                await personalDatabase.createEmployee(employeeData);
                createdEmployees.push(emp);
                console.log(`✅ 建立員工：${emp.name} (${emp.employee_id})`);
            } else {
                console.log(`⚠️  員工已存在：${emp.name} (${emp.employee_id})`);
            }
        }

        // 建立活動資料
        console.log('\n🏃 建立測試活動資料...');
        const createdActivities = [];
        for (const act of testActivities) {
            const activityCode = `ACT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const activityData = {
                activity_code: activityCode,
                ...act,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
            };
            
            await personalDatabase.createActivity(activityData);
            createdActivities.push({ ...activityData });
            console.log(`✅ 建立活動：${act.activity_type} @ ${act.location} (${activityCode})`);
        }

        // 建立部分簽到記錄
        console.log('\n📝 建立測試簽到記錄...');
        const signinCount = 8;
        for (let i = 0; i < signinCount; i++) {
            const employee = testEmployees[i % testEmployees.length];
            const activity = createdActivities[i % createdActivities.length];
            
            const signinCode = `SIGN_${Date.now()}_${i}`;
            const signinData = {
                signin_code: signinCode,
                employee_id: employee.employee_id,
                activity_code: activity.activity_code,
                signin_type: i % 3 === 0 ? '遲到簽到' : '準時簽到',
                notes: `測試簽到記錄 ${i + 1}`,
                photo_url: `https://example.com/photo_${signinCode}.jpg`,
                signature_data: '',
                created_at: moment().subtract(Math.floor(Math.random() * 7), 'days').format('YYYY-MM-DD HH:mm:ss')
            };
            
            await personalDatabase.createSignin(signinData);
            console.log(`✅ 建立簽到：${employee.name} -> ${activity.activity_type} (${signinCode})`);
            
            // 避免重複的時間戳
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // 統計資料
        console.log('\n📊 載入完成統計：');
        const allEmployees = await personalDatabase.getAllEmployees();
        const allActivities = await personalDatabase.getAllActivities();
        const allSignins = await personalDatabase.getAllSignins();
        
        console.log(`👥 總員工數：${allEmployees.length}`);
        console.log(`🏃 總活動數：${allActivities.length}`);
        console.log(`📝 總簽到數：${allSignins.length}`);

        console.log('\n🎉 測試資料載入完成！');
        console.log('\n📱 現在可以測試以下功能：');
        console.log('1. 員工簽到頁面：http://localhost:3002');
        console.log('2. 管理員後台：http://localhost:3002/admin');
        console.log('3. 測試頁面：http://localhost:3002/test');

    } catch (error) {
        console.error('❌ 測試資料載入錯誤:', error);
    }
}

loadTestData();