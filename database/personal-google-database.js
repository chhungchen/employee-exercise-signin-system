const personalGoogleServices = require('../services/personal-google-services');
const bcrypt = require('bcryptjs');
const moment = require('moment');

class PersonalGoogleDatabase {
    constructor() {
        this.isInitialized = false;
    }

    // 初始化資料庫連接
    async initialize() {
        try {
            const success = await personalGoogleServices.initialize();
            if (success) {
                await personalGoogleServices.ensureSpreadsheetExists();
                this.isInitialized = true;
                
                // 檢查是否有預設管理員，沒有則創建
                await this.ensureDefaultAdmin();
                
                console.log('✅ Personal Google Database 初始化完成');
            }
            return success;
        } catch (error) {
            console.error('❌ Personal Google Database 初始化失敗:', error);
            return false;
        }
    }

    // 確保有預設管理員
    async ensureDefaultAdmin() {
        try {
            const admins = await this.getAllAdmins();
            if (admins.length === 0) {
                const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
                await this.createAdmin({
                    id: 1,
                    username: 'admin',
                    password_hash: hashedPassword,
                    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
                });
                console.log('✅ 已創建預設管理員帳號');
            }
        } catch (error) {
            console.error('❌ 創建預設管理員失敗:', error);
        }
    }

    // === 員工相關方法 ===
    async getAllEmployees() {
        return await personalGoogleServices.readData('employees');
    }

    async getEmployeeById(employeeId) {
        const employees = await this.getAllEmployees();
        return employees.find(emp => emp.employee_id === employeeId) || null;
    }

    async createEmployee(employeeData) {
        return await personalGoogleServices.insertData('employees', employeeData);
    }

    async updateEmployee(employeeId, updateData) {
        const employees = await this.getAllEmployees();
        const index = employees.findIndex(emp => emp.employee_id === employeeId);
        
        if (index === -1) return false;
        
        const updatedData = { ...employees[index], ...updateData };
        return await personalGoogleServices.updateData('employees', index + 1, updatedData);
    }

    // === 活動相關方法 ===
    async getAllActivities() {
        return await personalGoogleServices.readData('activities');
    }

    async getActivityByCode(activityCode) {
        const activities = await this.getAllActivities();
        return activities.find(act => act.activity_code === activityCode) || null;
    }

    async getActivityByDetails(activityType, location, activityDateTime) {
        const activities = await this.getAllActivities();
        return activities.find(act => 
            act.activity_type === activityType && 
            act.location === location && 
            moment(act.activity_datetime).isSame(moment(activityDateTime), 'minute')
        ) || null;
    }

    async createActivity(activityData) {
        return await personalGoogleServices.insertData('activities', activityData);
    }

    async updateActivity(activityCode, updateData) {
        const activities = await this.getAllActivities();
        const index = activities.findIndex(act => act.activity_code === activityCode);
        
        if (index === -1) return false;
        
        const updatedData = { ...activities[index], ...updateData };
        return await personalGoogleServices.updateData('activities', index + 1, updatedData);
    }

    // === 簽到相關方法 ===
    async getAllSignins() {
        return await personalGoogleServices.readData('signins');
    }

    async getSigninByCode(signinCode) {
        const signins = await this.getAllSignins();
        return signins.find(signin => signin.signin_code === signinCode) || null;
    }

    async getSigninByEmployeeAndActivity(employeeId, activityCode) {
        const signins = await this.getAllSignins();
        return signins.find(signin => 
            signin.employee_id === employeeId && 
            signin.activity_code === activityCode
        ) || null;
    }

    async createSignin(signinData) {
        // 如果有照片檔案，先上傳到 Google Drive
        if (signinData.photoFile) {
            try {
                const fileName = `signin_${Date.now()}_${signinData.employee_id}.jpg`;
                const uploadResult = await personalGoogleServices.uploadPhoto(
                    signinData.photoFile.buffer,
                    fileName,
                    signinData.photoFile.mimetype
                );
                
                // 將照片 URL 加入簽到資料
                signinData.photo_url = uploadResult.url;
                delete signinData.photoFile; // 移除檔案資料
                
                console.log(`✅ 照片已上傳: ${uploadResult.name}`);
            } catch (error) {
                console.error('❌ 照片上傳失敗:', error);
                // 即使照片上傳失敗，仍繼續建立簽到記錄
                signinData.photo_url = '';
            }
        }

        return await personalGoogleServices.insertData('signins', signinData);
    }

    async updateSignin(signinCode, updateData) {
        const signins = await this.getAllSignins();
        const index = signins.findIndex(signin => signin.signin_code === signinCode);
        
        if (index === -1) return false;
        
        const updatedData = { ...signins[index], ...updateData };
        return await personalGoogleServices.updateData('signins', index + 1, updatedData);
    }

    // 詳細簽到記錄查詢（用於管理員介面）
    async getSigninsWithDetails(options = {}) {
        try {
            const { page = 1, limit = 20, startDate, endDate, department, activityType } = options;
            
            // 取得所有相關資料
            const signins = await this.getAllSignins();
            const employees = await this.getAllEmployees();
            const activities = await this.getAllActivities();

            // 組合資料
            let combinedData = signins.map(signin => {
                // 找到最新的員工記錄（處理重複員工問題）
                const employeeRecords = employees.filter(emp => emp.employee_id === signin.employee_id);
                const employee = employeeRecords.length > 0 ? 
                    employeeRecords.reduce((latest, current) => 
                        moment(current.created_at).isAfter(moment(latest.created_at)) ? current : latest
                    ) : null;

                // 找到對應的活動（處理空白 activity_code）
                const activity = signin.activity_code ? 
                    activities.find(act => act.activity_code === signin.activity_code) : null;

                return {
                    id: signin.signin_code,
                    signin_code: signin.signin_code,
                    employee_id: signin.employee_id,
                    name: employee?.name || '未知員工',
                    department: employee?.department || '未知部門',
                    activity_type: activity?.activity_type || '未知活動',
                    location: activity?.location || '未知地點',
                    activity_datetime: activity?.activity_datetime || '',
                    signin_type: signin.signin_type || '',
                    notes: signin.notes || '',
                    photo_path: signin.photo_url || '',
                    signature_data: signin.signature_data || '',
                    created_at: signin.created_at || ''
                };
            });

            // 篩選條件
            if (startDate) {
                combinedData = combinedData.filter(item => 
                    moment(item.created_at).isAfter(moment(startDate))
                );
            }
            if (endDate) {
                combinedData = combinedData.filter(item => 
                    moment(item.created_at).isBefore(moment(endDate).add(1, 'day'))
                );
            }
            if (department) {
                combinedData = combinedData.filter(item => 
                    item.department.includes(department)
                );
            }
            if (activityType) {
                combinedData = combinedData.filter(item => 
                    item.activity_type.includes(activityType)
                );
            }

            // 排序（最新的在前）
            combinedData.sort((a, b) => 
                moment(b.created_at).valueOf() - moment(a.created_at).valueOf()
            );

            // 分頁
            const total = combinedData.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedData = combinedData.slice(startIndex, endIndex);

            return {
                data: paginatedData,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('取得詳細簽到記錄錯誤:', error);
            return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
        }
    }

    async getAllSigninsForExport(options = {}) {
        try {
            const { startDate, endDate, department, activityType } = options;
            
            // 取得所有相關資料
            const signins = await this.getAllSignins();
            const employees = await this.getAllEmployees();
            const activities = await this.getAllActivities();

            // 組合資料
            let combinedData = signins.map(signin => {
                // 找到最新的員工記錄（處理重複員工問題）
                const employeeRecords = employees.filter(emp => emp.employee_id === signin.employee_id);
                const employee = employeeRecords.length > 0 ? 
                    employeeRecords.reduce((latest, current) => 
                        moment(current.created_at).isAfter(moment(latest.created_at)) ? current : latest
                    ) : null;

                // 找到對應的活動（處理空白 activity_code）
                const activity = signin.activity_code ? 
                    activities.find(act => act.activity_code === signin.activity_code) : null;

                return {
                    signin_code: signin.signin_code,
                    employee_id: signin.employee_id,
                    name: employee?.name || '未知員工',
                    department: employee?.department || '未知部門',
                    activity_type: activity?.activity_type || '未知活動',
                    location: activity?.location || '',
                    activity_datetime: activity?.activity_datetime || '',
                    created_at: signin.created_at || '',
                    photo_url: signin.photo_url || ''
                };
            });

            // 篩選條件
            if (startDate) {
                combinedData = combinedData.filter(item => 
                    moment(item.created_at).isAfter(moment(startDate))
                );
            }
            if (endDate) {
                combinedData = combinedData.filter(item => 
                    moment(item.created_at).isBefore(moment(endDate).add(1, 'day'))
                );
            }
            if (department) {
                combinedData = combinedData.filter(item => 
                    item.department.includes(department)
                );
            }
            if (activityType) {
                combinedData = combinedData.filter(item => 
                    item.activity_type.includes(activityType)
                );
            }

            // 排序（最新的在前）
            combinedData.sort((a, b) => 
                moment(b.created_at).valueOf() - moment(a.created_at).valueOf()
            );

            return combinedData;
        } catch (error) {
            console.error('取得匯出簽到記錄錯誤:', error);
            return [];
        }
    }

    async deleteSignin(signinCode) {
        try {
            // Google Sheets 刪除需要特殊處理
            console.warn('Google Sheets 版本暫不支援刪除簽到記錄');
            return false;
        } catch (error) {
            console.error('刪除簽到記錄錯誤:', error);
            return false;
        }
    }

    async getStatistics(options = {}) {
        try {
            const { startDate, endDate, department } = options;
            
            // 取得所有相關資料
            const signins = await this.getAllSignins();
            const employees = await this.getAllEmployees();
            const activities = await this.getAllActivities();

            // 篩選簽到記錄
            let filteredSignins = signins;
            if (startDate) {
                filteredSignins = filteredSignins.filter(signin => 
                    moment(signin.created_at).isAfter(moment(startDate))
                );
            }
            if (endDate) {
                filteredSignins = filteredSignins.filter(signin => 
                    moment(signin.created_at).isBefore(moment(endDate).add(1, 'day'))
                );
            }
            if (department) {
                const filteredEmployees = employees.filter(emp => 
                    emp.department.includes(department)
                );
                const employeeIds = filteredEmployees.map(emp => emp.employee_id);
                filteredSignins = filteredSignins.filter(signin => 
                    employeeIds.includes(signin.employee_id)
                );
            }

            // 生成統計資料
            const statistics = filteredSignins.map(signin => {
                // 找到最新的員工記錄
                const employeeRecords = employees.filter(emp => emp.employee_id === signin.employee_id);
                const employee = employeeRecords.length > 0 ? 
                    employeeRecords.reduce((latest, current) => 
                        moment(current.created_at).isAfter(moment(latest.created_at)) ? current : latest
                    ) : null;

                // 找到對應的活動
                const activity = signin.activity_code ? 
                    activities.find(act => act.activity_code === signin.activity_code) : null;

                return {
                    activity_type: activity?.activity_type || '未知活動',
                    location: activity?.location || '未知地點',
                    activity_datetime: activity?.activity_datetime || '',
                    employee_id: signin.employee_id,
                    name: employee?.name || '未知員工',
                    department: employee?.department || '',
                    signin_count: 1,
                    participants: employee?.name || ''
                };
            });

            return statistics;
        } catch (error) {
            console.error('取得統計資料錯誤:', error);
            return [];
        }
    }

    async getDetailedStatistics(options = {}) {
        try {
            const { startDate, endDate, department } = options;
            
            // 取得所有相關資料
            const signins = await this.getAllSignins();
            const employees = await this.getAllEmployees();
            const activities = await this.getAllActivities();

            // 基本統計
            const totalSignins = signins.length;
            const totalEmployees = employees.length;
            const totalActivities = activities.length;

            // 部門統計
            const departmentStats = {};
            employees.forEach(emp => {
                if (emp.department) {
                    departmentStats[emp.department] = (departmentStats[emp.department] || 0) + 1;
                }
            });

            // 活動類型統計
            const activityTypeStats = {};
            activities.forEach(act => {
                if (act.activity_type) {
                    activityTypeStats[act.activity_type] = (activityTypeStats[act.activity_type] || 0) + 1;
                }
            });

            // 最近 7 天的簽到趨勢
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
                const daySignins = signins.filter(signin => 
                    moment(signin.created_at).format('YYYY-MM-DD') === date
                ).length;
                
                last7Days.push({
                    date,
                    count: daySignins
                });
            }

            return {
                totalSignins,
                totalEmployees,
                totalActivities,
                departmentStats,
                activityTypeStats,
                last7Days,
                lastUpdated: moment().format('YYYY-MM-DD HH:mm:ss')
            };
        } catch (error) {
            console.error('取得詳細統計資料錯誤:', error);
            return {
                totalSignins: 0,
                totalEmployees: 0,
                totalActivities: 0,
                departmentStats: {},
                activityTypeStats: {},
                last7Days: [],
                lastUpdated: moment().format('YYYY-MM-DD HH:mm:ss')
            };
        }
    }

    // 取得簽到統計
    async getSigninStatistics() {
        const signins = await this.getAllSignins();
        const employees = await this.getAllEmployees();
        const activities = await this.getAllActivities();

        // 計算統計資料
        const totalEmployees = employees.length;
        const totalActivities = activities.length;
        const totalSignins = signins.length;

        // 部門統計
        const departmentStats = {};
        employees.forEach(emp => {
            const dept = emp.department || '未分類';
            if (!departmentStats[dept]) {
                departmentStats[dept] = { employee_count: 0, signin_count: 0 };
            }
            departmentStats[dept].employee_count++;
            
            // 計算該部門的簽到次數
            const empSignins = signins.filter(signin => signin.employee_id === emp.employee_id);
            departmentStats[dept].signin_count += empSignins.length;
        });

        // 活動類型統計
        const activityTypeStats = {};
        activities.forEach(act => {
            const type = act.activity_type || '未分類';
            if (!activityTypeStats[type]) {
                activityTypeStats[type] = { activity_count: 0, signin_count: 0 };
            }
            activityTypeStats[type].activity_count++;
            
            // 計算該活動類型的簽到次數
            const actSignins = signins.filter(signin => signin.activity_code === act.activity_code);
            activityTypeStats[type].signin_count += actSignins.length;
        });

        return {
            totalStats: {
                total_employees: totalEmployees,
                total_activities: totalActivities,
                total_signins: totalSignins
            },
            departmentStats: Object.entries(departmentStats).map(([dept, stats]) => ({
                department: dept,
                ...stats
            })),
            activityTypeStats: Object.entries(activityTypeStats).map(([type, stats]) => ({
                activity_type: type,
                ...stats
            })),
            allSignins: signins
        };
    }

    // === 管理員相關方法 ===
    async getAllAdmins() {
        return await personalGoogleServices.readData('admins');
    }

    async getAdminByUsername(username) {
        const admins = await this.getAllAdmins();
        const admin = admins.find(admin => admin.username === username) || null;
        
        if (admin) {
            // 除錯記錄：檢查密碼雜湊格式
            console.log(`🔍 getAdminByUsername - 找到管理員: ${admin.username}`);
            console.log(`🔍 getAdminByUsername - password_hash 類型: ${typeof admin.password_hash}`);
            console.log(`🔍 getAdminByUsername - password_hash 長度: ${admin.password_hash ? admin.password_hash.length : 'N/A'}`);
            console.log(`🔍 getAdminByUsername - password_hash 前綴: ${admin.password_hash ? admin.password_hash.substring(0, 15) + '...' : 'N/A'}`);
            console.log(`🔍 getAdminByUsername - bcrypt 格式檢查: ${admin.password_hash && admin.password_hash.startsWith('$2') ? '✅ 正確' : '❌ 錯誤'}`);
            
            // 確保密碼雜湊被正確處理
            if (admin.password_hash) {
                admin.password_hash = admin.password_hash.toString().trim();
            }
        }
        
        return admin;
    }

    async createAdmin(adminData) {
        return await personalGoogleServices.insertData('admins', adminData);
    }

    async updateAdminPassword(username, newPassword) {
        const admins = await this.getAllAdmins();
        const index = admins.findIndex(admin => admin.username === username);
        
        if (index === -1) return false;
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedData = { 
            ...admins[index], 
            password_hash: hashedPassword 
        };
        
        return await personalGoogleServices.updateData('admins', index + 1, updatedData);
    }

    // === 資料匯出方法 ===
    async exportSigninsToCSV() {
        try {
            const signins = await this.getAllSignins();
            
            if (signins.length === 0) {
                return '';
            }

            // CSV 標頭
            const headers = ['簽到代碼', '員工編號', '姓名', '部門', '活動代碼', '運動類型', '地點', '活動時間', '簽到時間', '備註'];
            let csvContent = headers.join(',') + '\n';

            // 取得關聯資料
            const employees = await this.getAllEmployees();
            const activities = await this.getAllActivities();

            // 建立查找對應表
            const employeeMap = {};
            employees.forEach(emp => {
                employeeMap[emp.employee_id] = emp;
            });

            const activityMap = {};
            activities.forEach(act => {
                activityMap[act.activity_code] = act;
            });

            // 產生CSV內容
            signins.forEach(signin => {
                const employee = employeeMap[signin.employee_id] || {};
                const activity = activityMap[signin.activity_code] || {};
                
                const row = [
                    signin.signin_code || '',
                    signin.employee_id || '',
                    employee.name || '',
                    employee.department || '',
                    signin.activity_code || '',
                    activity.activity_type || '',
                    activity.location || '',
                    activity.activity_datetime || '',
                    signin.created_at || '',
                    signin.notes || ''
                ];
                
                csvContent += row.map(field => `"${field}"`).join(',') + '\n';
            });

            return csvContent;
        } catch (error) {
            console.error('匯出CSV失敗:', error);
            throw error;
        }
    }

    // === 唯一代碼生成 ===
    async generateUniqueCode(prefix, length = 12) {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, length - timestamp.length + 2);
        return `${prefix}${timestamp}${random}`.toUpperCase();
    }

    // === 檢查資料完整性 ===
    async checkDataIntegrity() {
        try {
            const employees = await this.getAllEmployees();
            const activities = await this.getAllActivities();
            const signins = await this.getAllSignins();
            const admins = await this.getAllAdmins();

            const report = {
                employees: {
                    total: employees.length,
                    duplicates: this.findDuplicates(employees, 'employee_id')
                },
                activities: {
                    total: activities.length,
                    duplicates: this.findDuplicates(activities, 'activity_code')
                },
                signins: {
                    total: signins.length,
                    duplicates: this.findDuplicates(signins, 'signin_code'),
                    orphaned: this.findOrphanedSignins(signins, employees, activities)
                },
                admins: {
                    total: admins.length,
                    duplicates: this.findDuplicates(admins, 'username')
                }
            };

            return report;
        } catch (error) {
            console.error('檢查資料完整性失敗:', error);
            throw error;
        }
    }

    // 輔助方法：找出重複項目
    findDuplicates(array, keyField) {
        const seen = new Set();
        const duplicates = [];
        
        array.forEach(item => {
            const key = item[keyField];
            if (seen.has(key)) {
                duplicates.push(key);
            }
            seen.add(key);
        });
        
        return duplicates;
    }

    // 輔助方法：找出孤立的簽到記錄
    findOrphanedSignins(signins, employees, activities) {
        const employeeIds = new Set(employees.map(emp => emp.employee_id));
        const activityCodes = new Set(activities.map(act => act.activity_code));
        
        return signins.filter(signin => 
            !employeeIds.has(signin.employee_id) || 
            !activityCodes.has(signin.activity_code)
        );
    }

    // === 授權檢查方法 ===
    async checkAuthStatus() {
        return await personalGoogleServices.checkAuthStatus();
    }

    async refreshGoogleToken() {
        return await personalGoogleServices.refreshToken();
    }
}

module.exports = new PersonalGoogleDatabase();