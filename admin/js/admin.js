// 全域變數
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// DOM載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化應用程式
async function initializeApp() {
    // 設定事件監聽器
    setupEventListeners();
    
    // 檢查是否已登入
    if (authToken) {
        console.log('🔑 發現現有 Token，驗證中...');
        try {
            // 驗證 Token 是否有效
            const response = await fetch('/api/admin/verify', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                console.log('✅ Token 驗證成功，載入儀表板');
                showDashboard();
                await loadDashboardData();
                // 等待 DOM 更新後再初始化導出功能
                setTimeout(() => {
                    initializeExportFeatures();
                }, 100);
            } else {
                console.log('❌ Token 驗證失敗，清除並顯示登入頁面');
                // Token 無效，清除並顯示登入頁面
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                authToken = null;
                currentUser = null;
                showLogin();
            }
        } catch (error) {
            console.error('🔥 Token 驗證錯誤:', error);
            // 網路錯誤或其他問題，清除 Token 並顯示登入頁面
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            authToken = null;
            currentUser = null;
            showLogin();
        }
    } else {
        console.log('📝 沒有 Token，顯示登入頁面');
        showLogin();
    }
}

// 設定事件監聽器
function setupEventListeners() {
    // 登入表單
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 側邊欄導航
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            switchPage(page);
        });
    });

    // 登出按鈕
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // 全選複選框
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', toggleSelectAll);
    }

    // 排序選擇器
    const bulkSortBy = document.getElementById('bulkSortBy');
    if (bulkSortBy) {
        bulkSortBy.addEventListener('change', sortSignins);
    }

    // 刪除選中項目按鈕
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', deleteSelectedSignins);
    }

    // 匯出CSV按鈕
    const exportSigninsBtn = document.getElementById('exportSigninsBtn');
    if (exportSigninsBtn) {
        exportSigninsBtn.addEventListener('click', exportSignins);
    }

    // 生成報表按鈕
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }

    // 匯出統計資料按鈕
    const exportStatisticsBtn = document.getElementById('exportStatisticsBtn');
    if (exportStatisticsBtn) {
        exportStatisticsBtn.addEventListener('click', exportStatistics);
    }
}

// 顯示登入頁面
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboardPage').style.display = 'none';
}

// 顯示儀表板
function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'flex';
}

// 處理登入
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
        setLoading(true);
        
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showDashboard();
            loadDashboardData();
            // 等待 DOM 更新後再初始化導出功能
            setTimeout(() => {
                initializeExportFeatures();
            }, 100);
            showSuccessMessage('登入成功！');
        } else {
            showErrorMessage(result.error || '登入失敗');
        }

    } catch (error) {
        console.error('登入錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    } finally {
        setLoading(false);
    }
}

// 登出
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showLogin();
}

// 載入儀表板資料
async function loadDashboardData() {
    try {
        setLoading(true);
        
        // 添加時間戳防止快取問題
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/admin/dashboard?_t=${timestamp}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        console.log('📊 載入儀表板資料...');

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 儀表板資料載入成功:', data);
            
            // 檢查照片資料
            if (data.signins && data.signins.length > 0) {
                const photosCount = data.signins.filter(s => s.photo_path).length;
                console.log(`📸 找到 ${photosCount} 筆有照片的簽到記錄`);
                
                // 取樣檢查前 3 筆照片
                const sampledPhotos = data.signins.filter(s => s.photo_path).slice(0, 3);
                sampledPhotos.forEach((signin, index) => {
                    console.log(`照片 ${index + 1}:`, {
                        signin_code: signin.signin_code,
                        original_url: signin.photo_path,
                        fixed_url: fixGoogleDriveUrl(signin.photo_path)
                    });
                });
            }
            
            updateDashboard(data);
        } else {
            if (response.status === 401) {
                logout();
            } else {
                showErrorMessage('載入資料失敗');
            }
        }

    } catch (error) {
        console.error('載入儀表板錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    } finally {
        setLoading(false);
    }
}

// 更新儀表板
function updateDashboard(data) {
    // 更新統計數字
    document.getElementById('totalEmployees').textContent = data.totalStats.total_employees || 0;
    document.getElementById('totalActivities').textContent = data.totalStats.total_activities || 0;
    document.getElementById('totalSignins').textContent = data.totalStats.total_signins || 0;

    // 更新所有簽到記錄
    updateAllSignins(data.signins);

    // 更新圖表
    updateCharts(data);
}

// 儲存當前的簽到記錄數據
let currentSigninData = [];

// 更新所有簽到記錄
function updateAllSignins(signins) {
    currentSigninData = signins || [];
    renderSigninTable(currentSigninData);
}

// 渲染簽到記錄表格
function renderSigninTable(signins) {
    const tbody = document.getElementById('recentSigninsBody');
    tbody.innerHTML = '';

    if (signins && signins.length > 0) {
        signins.forEach(signin => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="signin-checkbox" value="${signin.id}">
                </td>
                <td>${signin.signin_code}</td>
                <td>${signin.employee_id}</td>
                <td>${signin.name}</td>
                <td>${signin.department}</td>
                <td>${signin.activity_type}</td>
                <td>${signin.location}</td>
                <td>${formatDateTime(signin.activity_datetime)}</td>
                <td>
                    ${signin.photo_path ? 
                        `<div class="photo-container" data-original-url="${signin.photo_path}">
                            <img alt="簽到照片" 
                                 class="signin-photo" 
                                 data-photo-path="${signin.photo_path}" 
                                 data-original-url="${signin.photo_path}"
                                 style="width: 50px; height: 50px; object-fit: cover; cursor: pointer; border-radius: 4px; border: 1px solid #ddd;"
                                 onerror="handlePhotoError(this)"
                                 onload="console.log('✅ 照片載入成功:', this.src)">
                         </div>` : 
                        '<span style="color: #999;">無照片</span>'
                    }
                </td>
                <td>
                    ${signin.signature_data ? 
                        `<img src="${signin.signature_data}" alt="簽名" class="signin-signature" data-signature-data="${signin.signature_data}" style="width: 80px; height: 40px; object-fit: contain; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;">` : 
                        '<span style="color: #999;">無簽名</span>'
                    }
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // 添加事件監聽器
        attachEventListeners();
    } else {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">暫無簽到記錄</td></tr>';
    }
}

// 載入照片使用認證
async function loadPhotoWithAuth(imgElement, fileId) {
    try {
        const proxyUrl = `/api/admin/photo/${fileId}`;
        
        const response = await fetch(proxyUrl, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            imgElement.src = imageUrl;
            console.log('✅ 照片透過代理載入成功');
        } else {
            console.error('❌ 照片代理回應錯誤:', response.status, response.statusText);
            handlePhotoError(imgElement);
        }
    } catch (error) {
        console.error('❌ 照片代理載入失敗:', error);
        handlePhotoError(imgElement);
    }
}

// 載入模態框照片使用認證
async function loadModalPhotoWithAuth(imgElement, proxyUrl) {
    try {
        const statusDiv = imgElement.nextElementSibling;
        
        const response = await fetch(proxyUrl, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            imgElement.src = imageUrl;
            if (statusDiv) statusDiv.style.display = 'none';
            console.log('✅ 模態框照片透過代理載入成功');
        } else {
            console.error('❌ 模態框照片代理回應錯誤:', response.status, response.statusText);
            if (statusDiv) statusDiv.innerHTML = '<span style="color: #e74c3c;">照片載入失敗</span>';
        }
    } catch (error) {
        console.error('❌ 模態框照片代理載入失敗:', error);
        const statusDiv = imgElement.nextElementSibling;
        if (statusDiv) statusDiv.innerHTML = '<span style="color: #e74c3c;">網路錯誤</span>';
    }
}

// 添加事件監聽器
function attachEventListeners() {
    // 簽到記錄複選框
    document.querySelectorAll('.signin-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateDeleteButton);
    });
    
    // 照片載入和點擊事件
    document.querySelectorAll('.photo-container').forEach(container => {
        const imgElement = container.querySelector('.signin-photo');
        const originalUrl = container.getAttribute('data-original-url');
        
        // 檢查是否是有效的 Google Drive URL（不包含假的 example.com）
        if (originalUrl.includes('example.com') || originalUrl.includes('photo_SIGN_')) {
            // 顯示無效照片狀態
            container.innerHTML = '<span style="color: #999; font-size: 12px;">無有效照片</span>';
            return;
        }
        
        // 提取 file ID 並載入照片
        const fileIdMatch = originalUrl.match(/[\/=]([a-zA-Z0-9_-]{25,33})/);
        if (fileIdMatch && !originalUrl.includes('photo_SIGN_')) {
            const fileId = fileIdMatch[1];
            console.log('🔍 載入照片 ID:', fileId);
            loadPhotoWithAuth(imgElement, fileId);
            
            // 點擊事件
            imgElement.addEventListener('click', function() {
                const photoPath = this.getAttribute('data-photo-path');
                viewPhoto(photoPath);
            });
        } else {
            // 無法提取有效的 File ID
            console.log('⚠️ 無效的照片 URL:', originalUrl);
            container.innerHTML = '<span style="color: #e74c3c; font-size: 12px;">照片格式錯誤</span>';
        }
    });
    
    // 簽名點擊事件
    document.querySelectorAll('.signin-signature').forEach(img => {
        img.addEventListener('click', function() {
            const signatureData = this.getAttribute('data-signature-data');
            viewSignature(signatureData);
        });
    });
}

// 匯出簽到記錄
async function exportSignins() {
    try {
        const response = await fetch('/api/admin/export/signins', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            // 建立下載連結
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `signin-records-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showSuccessMessage('簽到記錄匯出成功');
        } else {
            const error = await response.json();
            showErrorMessage(error.error || '匯出失敗');
        }

    } catch (error) {
        console.error('匯出簽到記錄錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    }
}

// 查看照片
function viewPhoto(photoPath) {
    console.log('🖼️ 開啟照片檢視:', photoPath);
    
    // 檢查是否是有效的照片 URL
    if (photoPath.includes('example.com') || photoPath.includes('photo_SIGN_')) {
        showToast('此照片無效或不存在', 'error');
        return;
    }
    
    // 提取 File ID
    const fileIdMatch = photoPath.match(/[\/=]([a-zA-Z0-9_-]{25,33})/);
    if (fileIdMatch && !photoPath.includes('photo_SIGN_')) {
        const fileId = fileIdMatch[1];
        console.log('🔍 模態框照片 ID:', fileId);
        
        // 直接使用代理 URL
        const proxyUrl = `/api/admin/photo/${fileId}`;
        showImageModal(proxyUrl, '簽到照片', photoPath);
    } else {
        showToast('無法載入照片：格式錯誤', 'error');
    }
}

// 查看簽名
function viewSignature(signatureData) {
    showImageModal(signatureData, '電子簽名');
}

// 顯示圖片模態框
function showImageModal(imageSrc, title, originalUrl = null) {
    const modal = document.createElement('div');
    modal.className = 'image-modal-overlay';
    modal.innerHTML = `
        <div class="image-modal-content">
            <div class="image-modal-header">
                <h3>${title}</h3>
                <div class="image-modal-controls">
                    ${originalUrl ? `<button class="btn btn-secondary btn-sm" onclick="tryAlternativeFormats('${originalUrl}', this)">嘗試其他格式</button>` : ''}
                    <button class="image-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="image-modal-body">
                <img alt="${title}" 
                     style="max-width: 100%; max-height: 80vh; object-fit: contain;"
                     onerror="handleModalPhotoError(this, '${originalUrl || imageSrc}')"
                     onload="console.log('🖼️ 模態框照片載入成功'); this.nextElementSibling.style.display = 'none';">
                <div class="image-loading-status" style="text-align: center; margin-top: 10px; color: #666; font-size: 14px;">
                    正在載入照片...
                </div>
            </div>
        </div>
    `;
    
    // 點擊背景關閉
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeImageModal();
        }
    });
    
    // 點擊關閉按鈕
    const closeBtn = modal.querySelector('.image-modal-close');
    closeBtn.addEventListener('click', closeImageModal);
    
    document.body.appendChild(modal);
    
    // 如果是代理 URL，使用認證載入
    const imgElement = modal.querySelector('img');
    if (imageSrc.startsWith('/api/admin/photo/')) {
        loadModalPhotoWithAuth(imgElement, imageSrc);
    } else {
        // 直接設定 src（用於簽名等）
        imgElement.src = imageSrc;
    }
}

// 關閉圖片模態框
function closeImageModal() {
    const modal = document.querySelector('.image-modal-overlay');
    if (modal) {
        modal.remove();
    }
}



// 全選/取消全選
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.signin-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateDeleteButton();
}

// 更新刪除按鈕狀態
function updateDeleteButton() {
    const checkboxes = document.querySelectorAll('.signin-checkbox');
    const checkedBoxes = document.querySelectorAll('.signin-checkbox:checked');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectAll = document.getElementById('selectAll');
    
    // 更新刪除按鈕顯示/隱藏
    if (checkedBoxes.length > 0) {
        deleteBtn.style.display = 'inline-block';
        deleteBtn.textContent = `刪除選中項目 (${checkedBoxes.length})`;
    } else {
        deleteBtn.style.display = 'none';
    }
    
    // 更新全選狀態
    if (checkedBoxes.length === checkboxes.length && checkboxes.length > 0) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else if (checkedBoxes.length > 0) {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
}

// 批量刪除選中的簽到記錄
async function deleteSelectedSignins() {
    const checkedBoxes = document.querySelectorAll('.signin-checkbox:checked');
    const ids = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (ids.length === 0) {
        showErrorMessage('請選擇要刪除的記錄');
        return;
    }
    
    if (!confirm(`確定要刪除選中的 ${ids.length} 筆簽到記錄嗎？此操作無法復原。`)) {
        return;
    }

    try {
        setLoading(true);
        
        // 並行刪除所有選中的記錄
        const deletePromises = ids.map(id => 
            fetch(`/api/admin/signins/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })
        );
        
        const results = await Promise.allSettled(deletePromises);
        
        // 檢查結果
        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length;
        const failCount = results.length - successCount;
        
        if (successCount > 0) {
            showSuccessMessage(`成功刪除 ${successCount} 筆記錄${failCount > 0 ? `，失敗 ${failCount} 筆` : ''}`);
            loadDashboardData(); // 重新載入資料
        } else {
            showErrorMessage('刪除失敗，請稍後再試');
        }

    } catch (error) {
        console.error('批量刪除簽到記錄錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    } finally {
        setLoading(false);
    }
}

// 排序簽到記錄
function sortSignins() {
    const sortBy = document.getElementById('bulkSortBy').value;
    
    if (!currentSigninData || currentSigninData.length === 0) {
        return;
    }
    
    const sortedData = [...currentSigninData].sort((a, b) => {
        switch (sortBy) {
            case 'activity_datetime_desc':
                return new Date(b.activity_datetime) - new Date(a.activity_datetime);
            case 'activity_datetime_asc':
                return new Date(a.activity_datetime) - new Date(b.activity_datetime);
            case 'name_asc':
                return a.name.localeCompare(b.name, 'zh-TW');
            case 'name_desc':
                return b.name.localeCompare(a.name, 'zh-TW');
            case 'department_asc':
                return a.department.localeCompare(b.department, 'zh-TW');
            case 'activity_type_asc':
                return a.activity_type.localeCompare(b.activity_type, 'zh-TW');
            default:
                return 0;
        }
    });
    
    renderSigninTable(sortedData);
}

// 更新圖表
function updateCharts(data) {
    // 部門統計圖表
    const departmentChart = document.getElementById('departmentChart');
    if (data.departmentStats && data.departmentStats.length > 0) {
        departmentChart.innerHTML = createSimpleChart(data.departmentStats, 'department', 'signin_count');
    } else {
        departmentChart.innerHTML = '<p>暫無部門統計資料</p>';
    }

    // 運動項目統計圖表
    const activityChart = document.getElementById('activityChart');
    if (data.activityTypeStats && data.activityTypeStats.length > 0) {
        activityChart.innerHTML = createSimpleChart(data.activityTypeStats, 'activity_type', 'signin_count');
    } else {
        activityChart.innerHTML = '<p>暫無運動項目統計資料</p>';
    }
}

// 建立簡單圖表
function createSimpleChart(data, labelKey, valueKey) {
    if (!data || data.length === 0) {
        return '<div class="chart-container"><p style="text-align: center; color: #999; padding: 20px;">暫無資料</p></div>';
    }
    
    const maxValue = Math.max(...data.map(item => item[valueKey] || 0));
    
    let chartHTML = '<div class="chart-container"><div class="simple-chart">';
    data.forEach(item => {
        const percentage = maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0;
        const label = item[labelKey] || '未設定';
        chartHTML += `
            <div class="chart-item">
                <div class="chart-label" title="${label}">${label}</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="chart-value">${item[valueKey] || 0}</div>
            </div>
        `;
    });
    chartHTML += '</div></div>';
    
    return chartHTML;
}

// 切換頁面
function switchPage(pageName) {
    // 隱藏所有頁面
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    // 移除所有導航項目的active狀態
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    // 顯示選中的頁面
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // 設定導航項目active狀態
    const activeNavItem = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }

    // 載入頁面資料
    loadPageData(pageName);
}

// 載入頁面資料
async function loadPageData(pageName) {
    switch (pageName) {
        case 'employees':
            await loadEmployees();
            break;
        case 'activities':
            await loadActivities();
            break;
        case 'statistics':
            await loadStatistics();
            break;
    }
}

// 載入員工列表
async function loadEmployees() {
    try {
        setLoading(true);
        
        const response = await fetch('/api/admin/employees', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const employees = await response.json();
            updateEmployeesTable(employees);
        } else {
            showErrorMessage('載入員工資料失敗');
        }

    } catch (error) {
        console.error('載入員工錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    } finally {
        setLoading(false);
    }
}

// 更新員工表格
function updateEmployeesTable(employees) {
    const tbody = document.getElementById('employeesTableBody');
    tbody.innerHTML = '';

    if (employees && employees.length > 0) {
        employees.forEach(employee => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${employee.employee_id}</td>
                <td>${employee.name}</td>
                <td>${employee.department}</td>
                <td>${employee.signin_count || 0}</td>
                <td>${formatDateTime(employee.created_at)}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteEmployee('${employee.employee_id}')">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">暫無員工資料</td></tr>';
    }
}

// 載入活動列表
async function loadActivities() {
    try {
        setLoading(true);
        
        const response = await fetch('/api/admin/activities', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const activities = await response.json();
            updateActivitiesTable(activities);
        } else {
            showErrorMessage('載入活動資料失敗');
        }

    } catch (error) {
        console.error('載入活動錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    } finally {
        setLoading(false);
    }
}

// 更新活動表格
function updateActivitiesTable(activities) {
    const tbody = document.getElementById('activitiesTableBody');
    tbody.innerHTML = '';

    if (activities && activities.length > 0) {
        activities.forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${activity.activity_code}</td>
                <td>${activity.activity_type}</td>
                <td>${activity.location}</td>
                <td>${activity.activity_date}</td>
                <td>${activity.activity_time}</td>
                <td>${activity.signin_count || 0}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteActivity(${activity.id})">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666;">暫無活動資料</td></tr>';
    }
}

// 載入統計資料
async function loadStatistics(startDate, endDate, department, activityType) {
    // 如果沒有傳入參數，從頁面元素獲取
    if (arguments.length === 0) {
        startDate = document.getElementById('startDate')?.value;
        endDate = document.getElementById('endDate')?.value;
        department = document.getElementById('departmentFilter')?.value;
        activityType = document.getElementById('activityTypeFilter')?.value;
    }

    try {
        setLoading(true);
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (department) params.append('department', department);
        if (activityType) params.append('activityType', activityType);

        // 添加時間戳防止快取問題
        const timestamp = new Date().getTime();
        params.append('_t', timestamp);
        
        const response = await fetch(`/api/statistics?${params}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (response.ok) {
            const statistics = await response.json();
            updateStatisticsContent(statistics);
        } else {
            showErrorMessage('載入統計資料失敗');
        }

    } catch (error) {
        console.error('載入統計錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    } finally {
        setLoading(false);
    }
}

// 更新統計內容
function updateStatisticsContent(statistics) {
    if (statistics && statistics.length > 0) {
        // 計算統計卡片數據
        const totalParticipants = new Set(statistics.map(s => s.employee_id)).size;
        const totalActivities = statistics.length;
        
        // 計算最受歡迎的運動項目
        const activityCounts = {};
        statistics.forEach(stat => {
            activityCounts[stat.activity_type] = (activityCounts[stat.activity_type] || 0) + 1;
        });
        const mostPopular = Object.keys(activityCounts).reduce((a, b) => 
            activityCounts[a] > activityCounts[b] ? a : b
        );
        
        // 計算參與率（假設總員工數為當前參與人數）
        const participationRate = totalParticipants > 0 ? 
            Math.round((totalParticipants / totalParticipants) * 100) : 0;
        
        // 更新統計卡片
        document.getElementById('totalParticipants').textContent = totalParticipants;
        document.getElementById('totalActivitiesCount').textContent = totalActivities;
        document.getElementById('mostPopularActivity').textContent = mostPopular;
        document.getElementById('participationRate').textContent = `${participationRate}%`;
        
        // 更新詳細統計表格
        updateStatisticsTable(statistics);
        
        // 更新圖表
        updateStatisticsCharts(statistics);
    } else {
        // 清空統計數據
        document.getElementById('totalParticipants').textContent = '0';
        document.getElementById('totalActivitiesCount').textContent = '0';
        document.getElementById('mostPopularActivity').textContent = '--';
        document.getElementById('participationRate').textContent = '0%';
        
        const tbody = document.getElementById('statisticsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">暫無統計資料</td></tr>';
        }
    }
}

// 更新統計表格
function updateStatisticsTable(statistics) {
    const tbody = document.getElementById('statisticsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // 按活動分組統計
    const activityGroups = {};
    statistics.forEach(stat => {
        const key = `${stat.activity_datetime}_${stat.activity_type}_${stat.location}`;
        if (!activityGroups[key]) {
            activityGroups[key] = {
                activity_datetime: stat.activity_datetime,
                activity_type: stat.activity_type,
                location: stat.location,
                participants: [],
                departments: new Set()
            };
        }
        activityGroups[key].participants.push(stat.name);
        activityGroups[key].departments.add(stat.department);
    });
    
    Object.values(activityGroups).forEach(group => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateTime(group.activity_datetime)}</td>
            <td>${group.activity_type}</td>
            <td>${group.location}</td>
            <td>${group.participants.length}</td>
            <td>${group.participants.join(', ')}</td>
            <td>${Array.from(group.departments).join(', ')}</td>
        `;
        tbody.appendChild(row);
    });
}

// 更新統計圖表
function updateStatisticsCharts(statistics) {
    // 運動項目分布
    const activityTypeChart = document.getElementById('activityTypeChart');
    if (activityTypeChart) {
        const activityCounts = {};
        statistics.forEach(stat => {
            activityCounts[stat.activity_type] = (activityCounts[stat.activity_type] || 0) + 1;
        });
        activityTypeChart.innerHTML = createSimpleChart(
            Object.entries(activityCounts).map(([type, count]) => ({
                activity_type: type,
                signin_count: count
            })),
            'activity_type',
            'signin_count'
        );
    }
    
    // 部門參與統計
    const departmentChart = document.getElementById('departmentChart');
    if (departmentChart) {
        const departmentCounts = {};
        statistics.forEach(stat => {
            departmentCounts[stat.department] = (departmentCounts[stat.department] || 0) + 1;
        });
        departmentChart.innerHTML = createSimpleChart(
            Object.entries(departmentCounts).map(([dept, count]) => ({
                department: dept,
                signin_count: count
            })),
            'department',
            'signin_count'
        );
    }
}

// 生成報表
function generateReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const department = document.getElementById('departmentFilter').value;
    const activityType = document.getElementById('activityTypeFilter').value;

    loadStatistics(startDate, endDate, department, activityType);
}

// 匯出統計資料
async function exportStatistics() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const department = document.getElementById('departmentFilter').value;
        const activityType = document.getElementById('activityTypeFilter').value;
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (department) params.append('department', department);
        if (activityType) params.append('activityType', activityType);

        const response = await fetch(`/api/admin/export/signins?${params}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `statistics-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showSuccessMessage('統計資料匯出成功');
        } else {
            const error = await response.json();
            showErrorMessage(error.error || '匯出失敗');
        }

    } catch (error) {
        console.error('匯出統計資料錯誤:', error);
        showErrorMessage('網路錯誤，請稍後再試');
    }
}

// 建立舊版相容圖表
function createLegacyChart(data, xField, yField) {
    if (!data || data.length === 0) {
        return '<div class="chart-container"><p style="text-align: center; color: #999; padding: 20px;">暫無資料</p></div>';
    }
    
    const maxValue = Math.max(...data.map(item => item[yField] || 0));
    
    let html = '<div class="chart-container"><div class="simple-chart">';
    data.forEach(item => {
        const percentage = maxValue > 0 ? (item[yField] / maxValue) * 100 : 0;
        const label = item[xField] || '未設定';
        html += `
            <div class="chart-item">
                <div class="chart-label" title="${label}">${label}</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="chart-value">${item[yField] || 0}</div>
            </div>
        `;
    });
    
    html += '</div></div>';
    return html;
}



// 設定載入狀態
function setLoading(loading) {
    const loadingElement = document.getElementById('loading');
    if (loading) {
        loadingElement.style.display = 'flex';
    } else {
        loadingElement.style.display = 'none';
    }
}

// 顯示成功訊息
function showSuccessMessage(message) {
    showToast(message, 'success');
}

// 顯示錯誤訊息
function showErrorMessage(message) {
    showToast(message, 'error');
}

// 顯示提示訊息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // 設定圖示
    let icon = 'info-circle';
    let bgColor = '#3498db';
    
    switch(type) {
        case 'success':
            icon = 'check-circle';
            bgColor = '#27ae60';
            break;
        case 'error':
            icon = 'exclamation-triangle';
            bgColor = '#e74c3c';
            break;
        case 'warning':
            icon = 'exclamation-circle';
            bgColor = '#f39c12';
            break;
        case 'info':
        default:
            icon = 'info-circle';
            bgColor = '#3498db';
            break;
    }
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// 格式化日期時間
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleString('zh-TW');
}

// 處理照片載入錯誤
function handlePhotoError(imgElement) {
    const originalUrl = imgElement.getAttribute('data-original-url');
    console.error('❌ 照片載入失敗:', imgElement.src);
    console.log('原始 URL:', originalUrl);
    console.log('錯誤發生時間:', new Date().toISOString());
    console.log('圖片元素:', imgElement);
    
    // 嘗試使用 fetch 檢查 URL 狀態
    fetch(imgElement.src, { method: 'HEAD', mode: 'no-cors' })
        .then(response => {
            console.log('Fetch 回應狀態:', response.status, response.statusText);
        })
        .catch(error => {
            console.error('Fetch 錯誤:', error);
        });
    
    // 嘗試不同的 URL 格式
    const fileIdMatch = originalUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
    if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        
        // 如果目前使用的是 export=view，嘗試 thumbnail
        if (imgElement.src.includes('export=view')) {
            const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
            console.log('🔄 嘗試縮圖格式:', thumbnailUrl);
            imgElement.src = thumbnailUrl;
            imgElement.setAttribute('data-retry-count', '1');
        } 
        // 如果已經嘗試過縮圖，顯示錯誤狀態
        else if (imgElement.getAttribute('data-retry-count') === '1') {
            console.log('❌ 所有格式都失敗，顯示錯誤狀態');
            imgElement.style.display = 'none';
            const parent = imgElement.parentElement;
            parent.innerHTML = '<span style="color: #e74c3c; font-size: 12px;">載入失敗</span>';
        }
    } else {
        // 無法提取 file ID，顯示錯誤
        imgElement.style.display = 'none';
        const parent = imgElement.parentElement;
        parent.innerHTML = '<span style="color: #e74c3c; font-size: 12px;">URL 格式錯誤</span>';
    }
}

// 修正 Google Drive URL 格式以確保照片能正確顯示
function fixGoogleDriveUrl(url) {
    if (!url) return '';
    
    // 處理各種 Google Drive URL 格式
    let fileId = null;
    
    // 格式 1: https://drive.google.com/file/d/FILE_ID/view
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match1) {
        fileId = match1[1];
    }
    
    // 格式 2: https://drive.google.com/open?id=FILE_ID
    const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (match2) {
        fileId = match2[1];
    }
    
    // 格式 3: https://drive.google.com/uc?id=FILE_ID (舊格式)
    const match3 = url.match(/https:\/\/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)$/);
    if (match3) {
        fileId = match3[1];
    }
    
    // 格式 4: 已經是正確的 export URL
    if (url.includes('/uc?export=view')) {
        return url;
    }
    
    // 如果找到 fileId，返回直接存取 URL
    if (fileId) {
        console.log('🔍 提取到 File ID:', fileId);
        console.log('🔄 轉換前 URL:', url);
        
        // 使用我們的後端代理（最可靠）
        const proxyUrl = `/api/admin/photo/${fileId}?size=w400`;
        console.log('🔗 使用代理 URL:', proxyUrl);
        
        return proxyUrl;
    }
    
    console.log('⚠️  無法提取 File ID，返回原始 URL:', url);
    // 如果都不匹配，返回原 URL
    return url;
}

// 測試照片 URL 可用性
function testPhotoUrls(fileId) {
    console.log('🧪 測試不同的照片 URL 格式...');
    
    const testUrls = [
        `https://drive.google.com/uc?export=view&id=${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`,
        `https://lh3.googleusercontent.com/d/${fileId}`
    ];
    
    testUrls.forEach((url, index) => {
        const img = new Image();
        img.onload = () => console.log(`✅ 格式 ${index + 1} 可載入:`, url);
        img.onerror = () => console.log(`❌ 格式 ${index + 1} 無法載入:`, url);
        img.src = url;
    });
}

// 處理模態框照片載入錯誤
function handleModalPhotoError(imgElement, originalUrl) {
    console.error('❌ 模態框照片載入失敗:', imgElement.src);
    
    const statusDiv = imgElement.nextElementSibling;
    if (statusDiv && statusDiv.classList.contains('image-loading-status')) {
        statusDiv.innerHTML = '<span style="color: #e74c3c;">照片載入失敗，請嘗試其他格式</span>';
    }
    
    // 自動嘗試縮圖格式
    const fileIdMatch = originalUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
    if (fileIdMatch && !imgElement.hasAttribute('data-thumbnail-tried')) {
        const fileId = fileIdMatch[1];
        const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        console.log('🔄 自動嘗試縮圖格式:', thumbnailUrl);
        
        imgElement.src = thumbnailUrl;
        imgElement.setAttribute('data-thumbnail-tried', 'true');
        
        if (statusDiv) {
            statusDiv.innerHTML = '正在嘗試縮圖格式...';
        }
    }
}

// 嘗試替代照片格式
function tryAlternativeFormats(originalUrl, buttonElement) {
    const modal = buttonElement.closest('.image-modal-content');
    const imgElement = modal.querySelector('img');
    const statusDiv = modal.querySelector('.image-loading-status');
    
    const fileIdMatch = originalUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
    if (!fileIdMatch) {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: #e74c3c;">無法提取檔案 ID</span>';
        return;
    }
    
    const fileId = fileIdMatch[1];
    const alternativeUrls = [
        { name: '高品質縮圖', url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` },
        { name: '中等品質縮圖', url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` },
        { name: '小型縮圖', url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w200` },
        { name: 'Google 相簿格式', url: `https://lh3.googleusercontent.com/d/${fileId}` }
    ];
    
    let currentIndex = 0;
    
    function tryNext() {
        if (currentIndex >= alternativeUrls.length) {
            if (statusDiv) statusDiv.innerHTML = '<span style="color: #e74c3c;">所有格式都無法載入</span>';
            return;
        }
        
        const current = alternativeUrls[currentIndex];
        if (statusDiv) statusDiv.innerHTML = `正在嘗試：${current.name}...`;
        
        console.log(`🔄 嘗試格式 ${currentIndex + 1}:`, current.url);
        
        const testImg = new Image();
        testImg.onload = function() {
            console.log(`✅ 成功載入格式 ${currentIndex + 1}:`, current.url);
            imgElement.src = current.url;
            if (statusDiv) statusDiv.innerHTML = `<span style="color: #27ae60;">成功載入：${current.name}</span>`;
        };
        testImg.onerror = function() {
            console.log(`❌ 格式 ${currentIndex + 1} 失敗:`, current.url);
            currentIndex++;
            setTimeout(tryNext, 500); // 等待 500ms 再嘗試下一個
        };
        testImg.src = current.url;
    }
    
    tryNext();
}

// 全域照片診斷功能 (開發者工具)
window.debugPhotos = function() {
    console.log('🔧 開始照片診斷...');
    
    const photos = document.querySelectorAll('.signin-photo');
    console.log(`找到 ${photos.length} 個照片元素`);
    
    photos.forEach((img, index) => {
        const originalUrl = img.getAttribute('data-original-url');
        const currentSrc = img.src;
        
        console.log(`照片 ${index + 1}:`, {
            element: img,
            original_url: originalUrl,
            current_src: currentSrc,
            is_loaded: img.complete && img.naturalWidth > 0,
            natural_size: img.complete ? `${img.naturalWidth}x${img.naturalHeight}` : 'N/A'
        });
        
        // 測試原始 URL
        if (originalUrl) {
            const fileIdMatch = originalUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
            if (fileIdMatch) {
                testPhotoUrls(fileIdMatch[1]);
            }
        }
    });
    
    return {
        total: photos.length,
        loaded: Array.from(photos).filter(img => img.complete && img.naturalWidth > 0).length,
        failed: Array.from(photos).filter(img => img.complete && img.naturalWidth === 0).length
    };
};

// 手動重試所有失敗的照片
window.retryFailedPhotos = function() {
    console.log('🔄 重試所有失敗的照片...');
    
    const failedPhotos = document.querySelectorAll('.signin-photo[data-retry-count]');
    console.log(`找到 ${failedPhotos.length} 個失敗的照片`);
    
    failedPhotos.forEach((img, index) => {
        const originalUrl = img.getAttribute('data-original-url');
        console.log(`重試照片 ${index + 1}:`, originalUrl);
        
        // 重置重試狀態
        img.removeAttribute('data-retry-count');
        img.style.border = '1px solid #ddd';
        
        // 重新載入
        img.src = fixGoogleDriveUrl(originalUrl);
    });
};

// 添加CSS樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .toast button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 16px;
    }
    
    .toast button:hover {
        opacity: 0.8;
    }
    
    .simple-chart {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .chart-item {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 28px;
        padding: 4px 0;
    }
    
    .chart-label {
        min-width: 80px;
        max-width: 100px;
        font-size: 13px;
        color: #555;
        word-break: break-all;
        line-height: 1.2;
    }
    
    .chart-bar {
        flex: 1;
        height: 20px;
        background: #f0f0f0;
        border-radius: 10px;
        position: relative;
        overflow: hidden;
    }
    
    .chart-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        transition: width 0.3s ease;
        min-width: 2px;
    }
    
    .chart-value {
        min-width: 30px;
        text-align: right;
        font-size: 12px;
        font-weight: 600;
        color: #333;
    }
    
    /* 每日資料導出樣式 */
    .daily-export-section {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .export-controls {
        margin-top: 15px;
    }
    
    .export-options {
        display: grid;
        grid-template-columns: 1fr 200px 300px;
        gap: 20px;
        align-items: end;
        margin-bottom: 15px;
    }
    
    .date-range {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .date-range label {
        font-size: 13px;
        color: #555;
        font-weight: 500;
    }
    
    .export-format {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .export-format label {
        font-size: 13px;
        color: #555;
        font-weight: 500;
    }
    
    .export-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .export-status {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 15px;
        margin-top: 15px;
    }
    
    .status-message {
        font-size: 14px;
        color: #666;
        margin-bottom: 10px;
    }
    
    .progress-bar {
        width: 100%;
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #28a745, #20c997);
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
    }
    
    .form-input, .form-select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        width: 100%;
    }
    
    .form-input:focus, .form-select:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }
    
    @media (max-width: 768px) {
        .export-options {
            grid-template-columns: 1fr;
            gap: 15px;
        }
        
        .export-actions {
            flex-direction: column;
            gap: 10px;
        }
    }
    
    .chart-bar {
        flex: 1;
        height: 20px;
        background: #f0f0f0;
        border-radius: 10px;
        overflow: hidden;
    }
    
    .chart-fill {
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
    }
    
    .chart-value {
        min-width: 40px;
        text-align: right;
        font-weight: 600;
    }
    
    .statistics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }
    
    .statistic-card {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-height: 400px;
        display: flex;
        flex-direction: column;
    }
    
    .statistic-card h4 {
        margin-bottom: 15px;
        color: #333;
        font-size: 16px;
        border-bottom: 2px solid #f0f0f0;
        padding-bottom: 8px;
        flex-shrink: 0;
    }
    
    .statistic-card p {
        margin-bottom: 8px;
        color: #666;
    }
    
    .statistic-card .chart-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 5px;
        margin-right: -5px;
    }
    
    .statistic-card .chart-container::-webkit-scrollbar {
        width: 6px;
    }
    
    .statistic-card .chart-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .statistic-card .chart-container::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    .statistic-card .chart-container::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
    
    /* 模態框樣式增強 */
    .image-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .image-modal-content {
        background: white;
        border-radius: 8px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        position: relative;
    }
    
    .image-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
    }
    
    .image-modal-controls {
        display: flex;
        gap: 10px;
        align-items: center;
    }
    
    .image-modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        padding: 5px;
        border-radius: 4px;
    }
    
    .image-modal-close:hover {
        background: #e9ecef;
        color: #333;
    }
    
    .image-modal-body {
        padding: 20px;
        text-align: center;
        max-height: 70vh;
        overflow: auto;
    }
    
    /* 照片載入狀態樣式 */
    .image-loading-status {
        transition: all 0.3s ease;
    }
    
    /* 照片錯誤樣式 */
    .signin-photo[data-retry-count] {
        border: 2px dashed #ffc107 !important;
    }
    
    .signin-photo:hover {
        transform: scale(1.05);
        transition: transform 0.2s ease;
    }
`;
document.head.appendChild(style);

// =============================================================================
// 每日資料導出功能
// =============================================================================

// 初始化導出功能
function initializeExportFeatures() {
    console.log('🔧 初始化導出功能...');
    
    try {
        // 設定預設日期範圍（今天）
        const today = new Date().toISOString().split('T')[0];
        const startDateEl = document.getElementById('exportStartDate');
        const endDateEl = document.getElementById('exportEndDate');
        
        if (startDateEl && endDateEl) {
            startDateEl.value = today;
            endDateEl.value = today;
            console.log('✅ 日期範圍設定完成');
        } else {
            console.warn('⚠️ 找不到日期選擇器元素');
        }
        
        // 綁定事件監聽器
        const downloadBtn = document.getElementById('downloadReportBtn');
        const emailBtn = document.getElementById('emailReportBtn');
        const scheduleBtn = document.getElementById('scheduleReportBtn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownloadReport);
            console.log('✅ 下載按鈕事件綁定完成');
        } else {
            console.warn('⚠️ 找不到下載按鈕');
        }
        
        if (emailBtn) {
            emailBtn.addEventListener('click', handleEmailReport);
            console.log('✅ 郵件按鈕事件綁定完成');
        } else {
            console.warn('⚠️ 找不到郵件按鈕');
        }
        
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', handleScheduleReport);
            console.log('✅ 排程按鈕事件綁定完成');
        } else {
            console.warn('⚠️ 找不到排程按鈕');
        }
        
    } catch (error) {
        console.error('❌ 初始化導出功能失敗:', error);
    }
}

// 處理報告下載
async function handleDownloadReport() {
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;
    const format = document.getElementById('exportFormat').value;
    
    if (!startDate || !endDate) {
        showToast('請選擇日期範圍', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showToast('開始日期不能晚於結束日期', 'error');
        return;
    }
    
    try {
        showExportStatus('準備導出資料...', 0);
        
        const response = await fetch('/api/admin/export-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                startDate,
                endDate,
                format,
                includePhotos: format === 'zip'
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `運動簽到報告_${startDate}_${endDate}.${getFileExtension(format)}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showExportStatus('下載完成！', 100);
            setTimeout(() => hideExportStatus(), 2000);
            showToast('報告下載成功', 'success');
        } else {
            const error = await response.json();
            showToast(`下載失敗：${error.error}`, 'error');
            hideExportStatus();
        }
    } catch (error) {
        console.error('下載報告錯誤:', error);
        showToast('下載過程中發生錯誤', 'error');
        hideExportStatus();
    }
}

// 處理報告寄送
async function handleEmailReport() {
    const email = prompt('請輸入收件人信箱地址：');
    if (!email) return;
    
    if (!isValidEmail(email)) {
        showToast('請輸入有效的信箱地址', 'error');
        return;
    }
    
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;
    const format = document.getElementById('exportFormat').value;
    const scheduleEmail = document.getElementById('scheduleEmail').checked;
    
    if (!startDate || !endDate) {
        showToast('請選擇日期範圍', 'error');
        return;
    }
    
    try {
        showExportStatus('準備寄送報告...', 0);
        
        const requestData = {
            startDate,
            endDate,
            format,
            email,
            scheduleDaily: scheduleEmail,
            includePhotos: format === 'zip'
        };
        
        const response = await fetch('/api/admin/email-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                showExportStatus('報告寄送成功！', 100);
                setTimeout(() => hideExportStatus(), 2000);
                showToast(result.message, 'success');
                
                if (result.scheduled) {
                    showToast('定期寄送已設定', 'info');
                }
                
                if (result.recordCount) {
                    showToast(`已發送 ${result.recordCount} 筆記錄`, 'info');
                }
            } else {
                // 處理配置未完成的情況
                hideExportStatus();
                showToast(result.message, 'warning');
                
                if (result.configured === false) {
                    showToast('請檢查 SMTP 配置設定', 'info');
                    console.log('💡 SMTP 配置指引:', result.note);
                }
            }
        } else {
            const error = await response.json();
            showToast(`寄送失敗：${error.error || error.message}`, 'error');
            
            if (error.details) {
                console.error('詳細錯誤:', error.details);
            }
            hideExportStatus();
        }
    } catch (error) {
        console.error('寄送報告錯誤:', error);
        showToast('寄送過程中發生錯誤', 'error');
        hideExportStatus();
    }
}

// 處理定期寄送設定
async function handleScheduleReport() {
    const scheduleModal = createScheduleModal();
    document.body.appendChild(scheduleModal);
}

// 創建定期寄送設定模態框
function createScheduleModal() {
    const modal = document.createElement('div');
    modal.className = 'schedule-modal-overlay';
    modal.innerHTML = `
        <div class="schedule-modal-content">
            <div class="modal-header">
                <h3>設定定期寄送</h3>
                <button class="modal-close" onclick="this.closest('.schedule-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="schedule-form">
                    <div class="form-group">
                        <label for="scheduleEmail">收件人信箱：</label>
                        <input type="email" id="scheduleEmail" class="form-input" placeholder="example@company.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="scheduleFrequency">寄送頻率：</label>
                        <select id="scheduleFrequency" class="form-select">
                            <option value="daily">每日</option>
                            <option value="weekly">每週</option>
                            <option value="monthly">每月</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="scheduleTime">寄送時間：</label>
                        <input type="time" id="scheduleTime" class="form-input" value="09:00">
                    </div>
                    
                    <div class="form-group">
                        <label for="scheduleFormat">報告格式：</label>
                        <select id="scheduleFormat" class="form-select">
                            <option value="csv">CSV 檔案</option>
                            <option value="excel">Excel 檔案</option>
                            <option value="pdf">PDF 報告</option>
                        </select>
                    </div>
                    
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="scheduleIncludePhotos"> 包含照片連結
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.schedule-modal-overlay').remove()">
                    取消
                </button>
                <button class="btn btn-primary" onclick="saveScheduleSettings()">
                    儲存設定
                </button>
            </div>
        </div>
    `;
    
    return modal;
}

// 儲存定期寄送設定
async function saveScheduleSettings() {
    const email = document.getElementById('scheduleEmail').value;
    const frequency = document.getElementById('scheduleFrequency').value;
    const time = document.getElementById('scheduleTime').value;
    const format = document.getElementById('scheduleFormat').value;
    const includePhotos = document.getElementById('scheduleIncludePhotos').checked;
    
    if (!email || !isValidEmail(email)) {
        showToast('請輸入有效的信箱地址', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/schedule-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                email,
                frequency,
                time,
                format,
                includePhotos
            })
        });
        
        if (response.ok) {
            showToast('定期寄送設定已儲存', 'success');
            document.querySelector('.schedule-modal-overlay').remove();
        } else {
            const error = await response.json();
            showToast(`設定失敗：${error.error}`, 'error');
        }
    } catch (error) {
        console.error('儲存設定錯誤:', error);
        showToast('儲存過程中發生錯誤', 'error');
    }
}

// 顯示導出狀態
function showExportStatus(message, progress) {
    const statusDiv = document.getElementById('exportStatus');
    const messageDiv = statusDiv.querySelector('.status-message');
    const progressFill = statusDiv.querySelector('.progress-fill');
    
    messageDiv.textContent = message;
    progressFill.style.width = `${progress}%`;
    statusDiv.style.display = 'block';
}

// 隱藏導出狀態
function hideExportStatus() {
    const statusDiv = document.getElementById('exportStatus');
    statusDiv.style.display = 'none';
}

// 取得檔案副檔名
function getFileExtension(format) {
    const extensions = {
        'csv': 'csv',
        'excel': 'xlsx',
        'html': 'html',
        'zip': 'zip'
    };
    return extensions[format] || 'txt';
}

// 驗證信箱格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
} 