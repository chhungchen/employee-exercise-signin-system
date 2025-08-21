const googleServices = require('../services/google-services');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const fs = require('fs'); // <--- 新增 fs 模組

class GoogleDatabase {
    constructor() {
        this.isInitialized = false;
    }

    // ... (其他既有方法保持不變) ...

    // === 員工相關方法 ===
    async getAllEmployees() {
        if (!this.isInitialized) await this.initialize();
        return await googleServices.readData('employees');
    }

    async getEmployeeById(employeeId) {
        const employees = await this.getAllEmployees();
        // Use reverse().find() to get the last matching employee, handling duplicates.
        return [...employees].reverse().find(emp => emp.employee_id === employeeId);
    }

    async createEmployee(employeeData) {
        if (!this.isInitialized) await this.initialize();
        
        const employees = await this.getAllEmployees();
        const maxId = employees.length > 0 ? Math.max(...employees.map(e => parseInt(e.id) || 0)) : 0;
        
        const newEmployee = {
            id: maxId + 1,
            ...employeeData,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        };

        await googleServices.insertData('employees', newEmployee);
        return newEmployee;
    }

    // ... (其他既有方法保持不變) ...

    // === 活動相關方法 ===
    async getAllActivities() {
        if (!this.isInitialized) await this.initialize();
        return await googleServices.readData('activities');
    }

    async getActivityById(activityId) {
        const activities = await this.getAllActivities();
        return activities.find(act => act.id == activityId);
    }

    async getActivityByDetails(activityType, location, activityDateTime) {
        const activities = await this.getAllActivities();
        return activities.find(act => 
            act.activity_type === activityType && 
            act.location === location && 
            act.activity_datetime === activityDateTime
        );
    }

    async createActivity(activityData) {
        if (!this.isInitialized) await this.initialize();
        
        const activities = await this.getAllActivities();
        const maxId = activities.length > 0 ? Math.max(...activities.map(a => parseInt(a.id) || 0)) : 0;
        
        const newActivity = {
            id: maxId + 1,
            ...activityData
        };

        await googleServices.insertData('activities', newActivity);
        return newActivity;
    }

    // ... (其他既有方法保持不變) ...

    // === 簽到相關方法 ===
    async createSignin(signinData) {
        if (!this.isInitialized) await this.initialize();
        
        const signins = await this.getAllSignins();
        const maxId = signins.length > 0 ? Math.max(...signins.map(s => parseInt(s.id) || 0)) : 0;
        
        const newSignin = {
            id: maxId + 1,
            ...signinData,
            signin_time: moment().format('YYYY-MM-DD HH:mm:ss')
        };

        await googleServices.insertData('signins', newSignin);
        return newSignin;
    }

    // === 照片上傳 ===
    async uploadPhoto(file) {
        if (!this.isInitialized) await this.initialize();
        if (!file) return null;

        try {
            const fileBuffer = fs.readFileSync(file.path);
            const result = await googleServices.uploadPhoto(fileBuffer, file.filename, file.mimetype);
            
            // 清理暫存檔案
            fs.unlinkSync(file.path);

            // 返回可直接訪問的圖片連結 (webContentLink)
            return result.webContentLink; 
        } catch (error) {
            console.error('❌ Database: 照片上傳失敗', error);
            // 即使上傳失敗，也嘗試清理
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            throw error;
        }
    }

    // ... (其他既有方法保持不變) ...

    // === 完整的簽到資料（包含關聯資料）===
    async getFullSigninData() {
        if (!this.isInitialized) await this.initialize();
        
        const employees = await this.getAllEmployees();
        const activities = await this.getAllActivities();
        const signins = await this.getAllSignins();

        const fullData = signins.map(signin => {
            const employee = [...employees].reverse().find(e => e.employee_id === signin.employee_id);
            const activity = activities.find(a => a.id == signin.activity_id);

            return {
                id: signin.id,
                signin_code: signin.signin_code,
                employee_id: signin.employee_id,
                name: employee?.name || '',
                department: employee?.department || '',
                activity_id: signin.activity_id,
                activity_type: activity?.activity_type || '',
                location: activity?.location || '',
                activity_datetime: activity?.activity_datetime || '',
                notes: signin.notes || '',
                photo_path: signin.photo_url || '',
                signature_data: signin.signature_data || ''
            };
        });

        return fullData.sort((a, b) => 
            moment(b.activity_datetime).valueOf() - moment(a.activity_datetime).valueOf()
        );
    }
}

module.exports = new GoogleDatabase();