const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 個人 Google 帳號服務類別
class PersonalGoogleServices {
    constructor() {
        this.oauth2Client = null;
        this.sheets = null;
        this.drive = null;
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        this.driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;
        this.tokenPath = path.join(__dirname, '../google-token.json');
    }

    // 初始化 OAuth2 用戶端
    async initialize() {
        try {
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI;

            if (!clientId || !clientSecret || !redirectUri) {
                console.error('❌ 缺少 Google OAuth 設定');
                return false;
            }

            this.oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                redirectUri
            );

            // 載入儲存的 token
            const tokenLoaded = await this.loadToken();
            if (!tokenLoaded) {
                console.log('⚠️  需要進行 Google 授權');
                return false;
            }

            this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
            this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

            console.log('✅ Personal Google Services 初始化成功');
            return true;
        } catch (error) {
            console.error('❌ Personal Google Services 初始化失敗:', error);
            return false;
        }
    }

    // 載入儲存的 token
    async loadToken() {
        try {
            // 優先從環境變數載入
            if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN) {
                console.log('🔑 從環境變數載入 Token...');
                const tokens = {
                    access_token: process.env.GOOGLE_ACCESS_TOKEN,
                    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
                    scope: process.env.GOOGLE_TOKEN_SCOPE || 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
                    token_type: 'Bearer'
                };

                this.oauth2Client.setCredentials(tokens);
                
                // 設定 token 更新回調
                this.oauth2Client.on('tokens', (newTokens) => {
                    this.saveTokenToEnv(newTokens);
                });

                return true;
            }

            // 嘗試從 Refresh Token 重新取得 Access Token (雲端環境)
            if (process.env.NODE_ENV === 'production' && process.env.GOOGLE_REFRESH_TOKEN) {
                console.log('🔄 使用 Refresh Token 重新取得 Access Token...');
                
                try {
                    const tempAuth = new google.auth.OAuth2(
                        process.env.GOOGLE_CLIENT_ID,
                        process.env.GOOGLE_CLIENT_SECRET,
                        process.env.GOOGLE_REDIRECT_URI
                    );
                    
                    tempAuth.setCredentials({
                        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
                    });
                    
                    // 使用 refresh token 取得新的 access token
                    const { credentials } = await tempAuth.refreshAccessToken();
                    
                    // 更新環境變數和 oauth2Client
                    process.env.GOOGLE_ACCESS_TOKEN = credentials.access_token;
                    this.oauth2Client.setCredentials(credentials);
                    
                    // 設定 token 更新回調
                    this.oauth2Client.on('tokens', (newTokens) => {
                        this.saveTokenToEnv(newTokens);
                    });

                    console.log('✅ 使用 Refresh Token 成功取得新的 Access Token');
                    return true;
                } catch (error) {
                    console.log('⚠️ Refresh Token 可能已過期或無效:', error.message);
                }
            }

            // 從檔案載入 (本地開發)
            if (fs.existsSync(this.tokenPath)) {
                console.log('📁 從本地檔案載入 Token...');
                const tokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                this.oauth2Client.setCredentials(tokenData);
                
                // 設定 token 更新回調
                this.oauth2Client.on('tokens', (newTokens) => {
                    this.saveToken(newTokens);
                });

                return true;
            }

            console.log('⚠️ 沒有找到可用的 Token');
            return false;
        } catch (error) {
            console.error('載入 token 失敗:', error);
            return false;
        }
    }

    // 儲存 token 到檔案
    saveToken(tokens) {
        try {
            const existingTokens = this.oauth2Client.credentials;
            const newTokens = { ...existingTokens, ...tokens };
            
            fs.writeFileSync(this.tokenPath, JSON.stringify(newTokens, null, 2));
            console.log('✅ Token 已更新到檔案');
        } catch (error) {
            console.error('儲存 token 失敗:', error);
        }
    }

    // 儲存 token 到環境變數 (雲端部署)
    saveTokenToEnv(tokens) {
        try {
            if (tokens.access_token) {
                process.env.GOOGLE_ACCESS_TOKEN = tokens.access_token;
                console.log('✅ Access token 已更新');
            }
            if (tokens.refresh_token) {
                process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
                console.log('✅ Refresh token 已更新');
            }
            
            // 在雲端環境中提醒用戶設定環境變數以實現持久化
        } catch (error) {
            console.error('更新環境變數 token 失敗:', error);
        }
    }


    // 取得授權 URL
    getAuthUrl() {
        if (!this.oauth2Client) {
            // 如果 oauth2Client 還沒初始化，先初始化它
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI;
            
            if (!clientId || !clientSecret || !redirectUri) {
                throw new Error('缺少 Google OAuth 設定');
            }
            
            this.oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                redirectUri
            );
        }
        
        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent' // 強制顯示同意畫面以取得 refresh token
        });
    }

    // 使用授權碼換取 token
    async exchangeCodeForToken(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            
            // 儲存 token
            this.saveToken(tokens);
            
            // 如果在雲端環境，也儲存到環境變數
            if (process.env.NODE_ENV === 'production') {
                this.saveTokenToEnv(tokens);
                
                // 提供 Render 環境變數設定指示
                console.log('\n🔧 為了在重新部署後保持授權，請將以下環境變數新增到 Render Dashboard:');
                console.log('=====================================');
                console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
                console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
                console.log('=====================================');
                console.log('💡 在 Render Dashboard > Environment > 新增這些環境變數後，系統將可以在重新部署後自動載入授權。');
            }

            console.log('✅ 成功取得並儲存 token');
            return tokens; // 回傳 tokens 供其他功能使用
        } catch (error) {
            console.error('換取 token 失敗:', error);
            return false;
        }
    }

    // 檢查並確保試算表存在
    async ensureSpreadsheetExists() {
        try {
            if (!this.spreadsheetId) {
                // 自動建立新的試算表
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
                console.log(`✅ 已建立新試算表: ${this.spreadsheetId}`);
                console.log(`📋 請將此 ID 加入環境變數: GOOGLE_SPREADSHEET_ID=${this.spreadsheetId}`);
                
                // 初始化表頭
                await this.initializeSheetHeaders();
                
                return true;
            } else {
                // 檢查現有試算表
                try {
                    await this.sheets.spreadsheets.get({
                        spreadsheetId: this.spreadsheetId
                    });
                    console.log('✅ 試算表連線正常');
                    return true;
                } catch (error) {
                    console.error('❌ 試算表不存在或無權限存取:', error.message);
                    return false;
                }
            }
        } catch (error) {
            console.error('確保試算表存在時發生錯誤:', error);
            return false;
        }
    }

    // 初始化工作表標頭
    async initializeSheetHeaders() {
        try {
            const headers = {
                'employees': ['employee_id', 'name', 'department', 'created_at'],
                'activities': ['activity_code', 'activity_type', 'location', 'activity_datetime', 'created_at'],
                'signins': ['signin_code', 'employee_id', 'activity_code', 'signin_type', 'notes', 'photo_url', 'signature_data', 'created_at'],
                'admins': ['id', 'username', 'password_hash', 'created_at']
            };

            for (const [sheetName, headerRow] of Object.entries(headers)) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!A1:${String.fromCharCode(64 + headerRow.length)}1`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headerRow]
                    }
                });
                console.log(`✅ 已初始化 ${sheetName} 工作表標頭`);
            }
        } catch (error) {
            console.error('初始化工作表標頭失敗:', error);
        }
    }

    // 讀取 Sheets 資料
    async readData(sheetName, range = '') {
        try {
            const fullRange = range ? `${sheetName}!${range}` : `${sheetName}`;
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: fullRange
            });

            const rows = response.data.values || [];
            if (rows.length === 0) return [];

            // 將資料轉換為物件陣列
            const headers = rows[0];
            return rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    let value = row[index] || '';
                    // 特別處理密碼雜湊欄位，確保去除空白和隱藏字元
                    if (header === 'password_hash' && value) {
                        value = value.toString().trim();
                    }
                    obj[header] = value;
                });
                return obj;
            });
        } catch (error) {
            console.error(`讀取 ${sheetName} 資料失敗:`, error);
            return [];
        }
    }

    // 新增資料到 Sheets
    async insertData(sheetName, data) {
        try {
            // 取得標頭
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`
            });

            const headers = headerResponse.data.values[0] || [];
            const values = headers.map(header => {
                let value = data[header] || '';
                // 確保密碼雜湊的完整性
                if (header === 'password_hash' && value) {
                    value = value.toString().trim();
                    console.log(`🔐 儲存密碼雜湊: ${value.substring(0, 10)}... (長度: ${value.length})`);
                }
                return value;
            });

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                resource: {
                    values: [values]
                }
            });

            // 返回插入的資料對象，確保包含所有欄位
            return data;
        } catch (error) {
            console.error(`新增資料到 ${sheetName} 失敗:`, error);
            return false;
        }
    }

    // 更新資料
    async updateData(sheetName, rowIndex, data) {
        try {
            // 取得標頭
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`
            });

            const headers = headerResponse.data.values[0] || [];
            const values = headers.map(header => {
                let value = data[header] || '';
                // 確保密碼雜湊的完整性
                if (header === 'password_hash' && value) {
                    value = value.toString().trim();
                    console.log(`🔐 更新密碼雜湊: ${value.substring(0, 10)}... (長度: ${value.length})`);
                }
                return value;
            });

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A${rowIndex + 1}:${String.fromCharCode(64 + headers.length)}${rowIndex + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [values]
                }
            });

            return true;
        } catch (error) {
            console.error(`更新 ${sheetName} 資料失敗:`, error);
            return false;
        }
    }

    // 上傳照片到 Google Drive
    async uploadPhoto(fileBuffer, fileName, mimeType) {
        try {
            const { Readable } = require('stream');
            
            // 將 Buffer 轉換為 Stream
            const stream = new Readable();
            stream.push(fileBuffer);
            stream.push(null);
            
            // 確保資料夾存在，如果不存在則建立或使用根目錄
            let parentFolder = null;
            if (this.driveFolder) {
                try {
                    // 檢查資料夾是否存在
                    await this.drive.files.get({
                        fileId: this.driveFolder,
                        fields: 'id,name'
                    });
                    parentFolder = this.driveFolder;
                    console.log(`✅ 使用現有資料夾: ${this.driveFolder}`);
                } catch (folderError) {
                    console.log(`⚠️ 資料夾 ${this.driveFolder} 不存在，建立新資料夾...`);
                    try {
                        // 建立新資料夾
                        const folderResponse = await this.drive.files.create({
                            resource: {
                                name: 'Employee Exercise Photos',
                                mimeType: 'application/vnd.google-apps.folder'
                            },
                            fields: 'id,name'
                        });
                        parentFolder = folderResponse.data.id;
                        console.log(`✅ 建立新資料夾成功: ${parentFolder}`);
                        
                        // 更新環境變數中的資料夾 ID（僅記錄，不實際更新）
                        console.log(`💡 建議更新環境變數 GOOGLE_DRIVE_FOLDER_ID 為: ${parentFolder}`);
                    } catch (createError) {
                        console.log(`⚠️ 無法建立資料夾，將上傳到根目錄: ${createError.message}`);
                        parentFolder = null;
                    }
                }
            }
            
            const response = await this.drive.files.create({
                resource: {
                    name: fileName,
                    parents: parentFolder ? [parentFolder] : undefined
                },
                media: {
                    mimeType: mimeType,
                    body: stream
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

            // 回傳可直接存取的 URL（用於圖片顯示）
            const downloadUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
            
            return {
                id: response.data.id,
                name: response.data.name,
                url: downloadUrl,
                webViewLink: response.data.webViewLink
            };
        } catch (error) {
            console.error('上傳照片到 Google Drive 失敗:', error);
            throw error;
        }
    }

    // 檢查授權狀態
    async checkAuthStatus() {
        try {
            if (!this.oauth2Client || !this.oauth2Client.credentials) {
                return { authorized: false, error: '未設定憑證' };
            }

            // 嘗試進行簡單的 API 呼叫來檢查授權
            await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' // 測試用的公開試算表
            });

            return { authorized: true };
        } catch (error) {
            if (error.code === 401) {
                return { authorized: false, error: 'Token 已過期或無效' };
            }
            return { authorized: false, error: error.message };
        }
    }

    // 重新整理 token
    async refreshToken() {
        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);
            this.saveToken(credentials);
            
            if (process.env.NODE_ENV === 'production') {
                this.saveTokenToEnv(credentials);
            }

            console.log('✅ Token 重新整理成功');
            return true;
        } catch (error) {
            console.error('重新整理 token 失敗:', error);
            return false;
        }
    }
}

module.exports = new PersonalGoogleServices();