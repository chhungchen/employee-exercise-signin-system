const { google } = require('googleapis');
const path = require('path');

// Google Sheets 和 Drive API 設定
class GoogleServices {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.drive = null;
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        this.driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;
    }

    // 初始化 Google APIs
    async initialize() {
        try {
            // 使用服務帳號認證
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
            
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.file'
                ]
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.drive = google.drive({ version: 'v3', auth: this.auth });

            console.log('✅ Google Services 初始化成功');
            return true;
        } catch (error) {
            console.error('❌ Google Services 初始化失敗:', error);
            return false;
        }
    }

    // 檢查並創建 Google Sheets
    async ensureSpreadsheetExists() {
        try {
            if (!this.spreadsheetId) {
                // 創建新的試算表
                const response = await this.sheets.spreadsheets.create({
                    resource: {
                        properties: {
                            title: '員工運動社團活動簽到系統'
                        },
                        sheets: [
                            { properties: { title: 'employees' } },
                            { properties: { title: 'activities' } },
                            { properties: { title: 'signins' } },
                            { properties: { title: 'admins' } }
                        ]
                    }
                });

                this.spreadsheetId = response.data.spreadsheetId;
                console.log(`📊 已創建新的試算表: ${this.spreadsheetId}`);
                console.log(`🔗 試算表連結: https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`);

                // 初始化表頭
                await this.initializeSheetHeaders();
            }

            return this.spreadsheetId;
        } catch (error) {
            console.error('❌ 創建試算表失敗:', error);
            throw error;
        }
    }

    // 初始化工作表標題行
    async initializeSheetHeaders() {
        const headers = {
            'employees': ['id', 'employee_id', 'name', 'department', 'created_at'],
            'activities': ['id', 'activity_code', 'activity_type', 'location', 'activity_datetime'],
            'signins': ['id', 'signin_code', 'employee_id', 'activity_id', 'signin_type', 'notes', 'photo_url', 'signature_data', 'signin_time'],
            'admins': ['id', 'username', 'password', 'created_at']
        };

        for (const [sheetName, headerRow] of Object.entries(headers)) {
            try {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!A1:${String.fromCharCode(65 + headerRow.length - 1)}1`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headerRow]
                    }
                });
                console.log(`✅ 已初始化 ${sheetName} 工作表標題`);
            } catch (error) {
                console.error(`❌ 初始化 ${sheetName} 標題失敗:`, error);
            }
        }
    }

    // 讀取資料
    async readData(sheetName, range = '') {
        try {
            const fullRange = range ? `${sheetName}!${range}` : `${sheetName}`;
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: fullRange
            });

            const rows = response.data.values || [];
            if (rows.length === 0) return [];

            // 將資料轉換為物件陣列（第一行為標題）
            const headers = rows[0];
            return rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                return obj;
            });
        } catch (error) {
            console.error(`❌ 讀取 ${sheetName} 資料失敗:`, error);
            return [];
        }
    }

    // 新增資料
    async insertData(sheetName, data) {
        try {
            // 先取得標題行
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`
            });

            const headers = headerResponse.data.values[0] || [];
            
            // 將物件轉換為陣列（按標題順序）
            const values = headers.map(header => data[header] || '');

            // 新增到工作表末尾
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                resource: {
                    values: [values]
                }
            });

            console.log(`✅ 已新增資料到 ${sheetName}`);
            return true;
        } catch (error) {
            console.error(`❌ 新增資料到 ${sheetName} 失敗:`, error);
            return false;
        }
    }

    // 更新資料
    async updateData(sheetName, rowIndex, data) {
        try {
            // 先取得標題行
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`
            });

            const headers = headerResponse.data.values[0] || [];
            
            // 將物件轉換為陣列（按標題順序）
            const values = headers.map(header => data[header] || '');

            // 更新指定行
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A${rowIndex + 2}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 2}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [values]
                }
            });

            console.log(`✅ 已更新 ${sheetName} 第 ${rowIndex + 2} 行`);
            return true;
        } catch (error) {
            console.error(`❌ 更新 ${sheetName} 資料失敗:`, error);
            return false;
        }
    }

    // 刪除資料行
    async deleteRow(sheetName, rowIndex) {
        try {
            // 取得工作表 ID
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            if (!sheet) {
                throw new Error(`找不到工作表: ${sheetName}`);
            }

            // 刪除行
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex + 1, // +1 因為標題行
                                endIndex: rowIndex + 2
                            }
                        }
                    }]
                }
            });

            console.log(`✅ 已刪除 ${sheetName} 第 ${rowIndex + 2} 行`);
            return true;
        } catch (error) {
            console.error(`❌ 刪除 ${sheetName} 資料失敗:`, error);
            return false;
        }
    }

    // 上傳照片到 Google Drive
    async uploadPhoto(fileBuffer, fileName, mimeType) {
        try {
            const response = await this.drive.files.create({
                resource: {
                    name: fileName,
                    parents: this.driveFolder ? [this.driveFolder] : undefined
                },
                media: {
                    mimeType: mimeType,
                    body: fileBuffer
                },
                fields: 'id,name,webViewLink,webContentLink'
            });

            // 設定檔案為公開可讀取
            await this.drive.permissions.create({
                fileId: response.data.id,
                resource: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`✅ 照片已上傳到 Google Drive: ${fileName}`);
            return response.data;
        } catch (error) {
            console.error('❌ 上傳照片到 Google Drive 失敗:', error);
            throw error;
        }
    }

    // 刪除 Google Drive 中的檔案
    async deletePhoto(fileId) {
        try {
            await this.drive.files.delete({
                fileId: fileId
            });
            console.log(`✅ 已從 Google Drive 刪除檔案: ${fileId}`);
            return true;
        } catch (error) {
            console.error('❌ 刪除 Google Drive 檔案失敗:', error);
            return false;
        }
    }
}

module.exports = new GoogleServices();