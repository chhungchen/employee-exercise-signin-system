// 全域變數
let isLoading = false;
let isDrawing = false;
let signatureCanvas, signatureCtx;
let currentPhotoFile = null;

// DOM載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setDefaultDateTime();
    initializePhotoUpload();
    initializeSignature();
    initializeSuccessMessage();
    
    // 確保簽名提示在頁面載入時正確顯示
    setTimeout(() => {
        updateSignaturePlaceholder();
    }, 100);
});

// 初始化表單
function initializeForm() {
    const form = document.getElementById('signinForm');
    const loading = document.getElementById('loading');
    const successMessage = document.getElementById('successMessage');

    // 表單提交事件
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isLoading) return;
        
        if (!validateForm()) {
            return;
        }

        await submitForm();
    });

    // 表單重置事件
    form.addEventListener('reset', function() {
        clearErrors();
        resetPhotoPreview();
        clearSignature();
        
        // 延遲設置日期時間和簽名提示，確保表單已重置完成
        setTimeout(() => {
            setDefaultDateTime();
            updateSignaturePlaceholder();
        }, 100);
    });

    // 即時驗證
    setupRealTimeValidation();
}

// 初始化拍照功能
function initializePhotoUpload() {
    const photoInput = document.getElementById('photoUpload');
    const photoPreview = document.getElementById('photoPreview');
    const selectPhotoBtn = document.getElementById('selectPhotoBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const removePhotoBtn = document.getElementById('removePhotoBtn');

    // 選擇照片按鈕（從相簿選擇）
    selectPhotoBtn.addEventListener('click', function() {
        photoInput.removeAttribute('capture');
        photoInput.click();
    });

    // 拍照按鈕（使用相機）
    cameraBtn.addEventListener('click', function() {
        photoInput.setAttribute('capture', 'environment');
        photoInput.click();
    });

    // 取消照片按鈕
    removePhotoBtn.addEventListener('click', function() {
        resetPhotoPreview();
    });

    // 檔案選擇事件
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            displayPhotoPreview(file);
        }
    });
}

// 初始化簽名功能
function initializeSignature() {
    signatureCanvas = document.getElementById('signatureCanvas');
    signatureCtx = signatureCanvas.getContext('2d');
    
    // 設定畫布大小
    resizeCanvas();
    
    // 滑鼠事件
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);
    
    // 觸控事件
    signatureCanvas.addEventListener('touchstart', handleTouchStart);
    signatureCanvas.addEventListener('touchmove', handleTouchMove);
    signatureCanvas.addEventListener('touchend', stopDrawing);
    
    // 清除簽名按鈕
    document.getElementById('clearSignatureBtn').addEventListener('click', clearSignature);
    
    // 視窗大小改變時重新調整畫布
    window.addEventListener('resize', resizeCanvas);
    
    // 強制顯示簽名提示
    setTimeout(() => {
        updateSignaturePlaceholder();
    }, 200);
}

// 調整畫布大小
function resizeCanvas() {
    const rect = signatureCanvas.getBoundingClientRect();
    signatureCanvas.width = rect.width;
    signatureCanvas.height = rect.height;
    
    // 設定繪圖樣式
    signatureCtx.strokeStyle = '#333';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    
    // 重新檢查簽名提示
    updateSignaturePlaceholder();
}

// 開始繪圖
function startDrawing(e) {
    isDrawing = true;
    draw(e);
    updateSignaturePlaceholder();
}

// 繪圖
function draw(e) {
    if (!isDrawing) return;
    
    e.preventDefault();
    
    const rect = signatureCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();
    signatureCtx.beginPath();
    signatureCtx.moveTo(x, y);
}

// 停止繪圖
function stopDrawing() {
    isDrawing = false;
    signatureCtx.beginPath();
    updateSignaturePlaceholder();
}

// 處理觸控開始
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}

// 處理觸控移動
function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}

// 清除簽名
function clearSignature() {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    updateSignaturePlaceholder();
}

// 更新簽名提示顯示
function updateSignaturePlaceholder() {
    const placeholder = document.getElementById('signaturePlaceholder');
    if (!placeholder) return;
    
    if (hasSignature()) {
        placeholder.classList.add('hidden');
    } else {
        placeholder.classList.remove('hidden');
        // 確保提示文字正確顯示
        if (!placeholder.querySelector('p')) {
            placeholder.innerHTML = `
                <i class="fas fa-pen"></i>
                <p>請在此處簽名</p>
            `;
        }
    }
}

// 檢查是否有簽名
function hasSignature() {
    if (!signatureCtx || !signatureCanvas) {
        console.warn('簽名Canvas或Context未初始化');
        return false;
    }
    
    try {
        // 確保畫布有實際大小
        if (signatureCanvas.width === 0 || signatureCanvas.height === 0) {
            console.warn('簽名畫布大小為零，嘗試重新調整大小');
            resizeCanvas();
            // 重新檢查大小
            if (signatureCanvas.width === 0 || signatureCanvas.height === 0) {
                return false;
            }
        }
        
        const imageData = signatureCtx.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height);
        const data = imageData.data;
        let pixelCount = 0;
        
        // 檢查是否有足夠的不透明像素（至少需要50個像素組成有效簽名）
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
                pixelCount++;
                // 提前返回以提高性能
                if (pixelCount >= 50) {
                    console.log('簽名檢測通過：找到足夠的像素數量', pixelCount);
                    return true;
                }
            }
        }
        
        console.log('簽名檢測失敗：像素數量不足', pixelCount, '畫布大小:', signatureCanvas.width, 'x', signatureCanvas.height);
        return false;
    } catch (error) {
        console.error('檢查簽名時發生錯誤:', error);
        // 嘗試重新初始化畫布
        try {
            resizeCanvas();
            console.log('已重新初始化簽名畫布');
        } catch (retryError) {
            console.error('重新初始化簽名畫布失敗:', retryError);
        }
        return false;
    }
}

// 獲取簽名的Base64數據（壓縮版本）
function getSignatureDataURL() {
    try {
        if (!signatureCanvas || !hasSignature()) return '';
        
        // 創建一個臨時畫布來壓縮簽名
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // 降低解析度以減少檔案大小（從原始尺寸縮小至一半）
        const scale = 0.5;
        tempCanvas.width = signatureCanvas.width * scale;
        tempCanvas.height = signatureCanvas.height * scale;
        
        // 設定白色背景（PNG轉JPEG需要）
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 繪製縮小的簽名
        tempCtx.drawImage(signatureCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // 使用 JPEG 格式和較低品質以減少檔案大小
        return tempCanvas.toDataURL('image/jpeg', 0.6);
    } catch (error) {
        console.error('獲取簽名數據時發生錯誤:', error);
        return '';
    }
}

// 壓縮圖片
function compressImage(file) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // 計算新的尺寸，保持寬高比
            let { width, height } = img;
            const maxSize = 600; // 最大尺寸 (從800降至600)
            const maxFileSize = 0.3 * 1024 * 1024; // 0.3MB (從0.5MB降至0.3MB)
            
            if (width > height) {
                if (width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 繪製圖片
            ctx.drawImage(img, 0, 0, width, height);
            
            // 嘗試不同的品質設定來達到目標檔案大小
            let quality = 0.8;
            let dataUrl;
            
            do {
                dataUrl = canvas.toDataURL('image/jpeg', quality);
                quality -= 0.1;
            } while (dataUrl.length > maxFileSize * 1.33 && quality > 0.1); // 1.33是base64編碼的膨脹係數
            
            // 將dataURL轉換為Blob
            const byteString = atob(dataUrl.split(',')[1]);
            const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            
            const compressedBlob = new Blob([ab], { type: mimeString });
            const compressedFile = new File([compressedBlob], file.name, { type: mimeString });
            
            resolve({ compressedFile, dataUrl });
        };
        
        // 使用 FileReader 來避免 CSP 問題
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 顯示照片預覽
async function displayPhotoPreview(file) {
    const photoPreview = document.getElementById('photoPreview');
    const removePhotoBtn = document.getElementById('removePhotoBtn');
    
    if (file && file.type.startsWith('image/')) {
        try {
            // 壓縮圖片
            const { compressedFile, dataUrl } = await compressImage(file);
            currentPhotoFile = compressedFile;
            
            // 直接使用 data URL 顯示圖片，避免 CSP 問題
            photoPreview.innerHTML = `<img src="${dataUrl}" alt="預覽照片">`;
            photoPreview.classList.add('has-image');
            removePhotoBtn.style.display = 'inline-flex';
            
        } catch (error) {
            console.error('圖片壓縮失敗:', error);
            showErrorMessage('圖片處理失敗，請重試');
        }
    }
}

// 重置照片預覽
function resetPhotoPreview() {
    const photoPreview = document.getElementById('photoPreview');
    const photoInput = document.getElementById('photoUpload');
    const removePhotoBtn = document.getElementById('removePhotoBtn');
    
    photoPreview.innerHTML = `
        <i class="fas fa-image"></i>
        <p>尚未選擇照片</p>
    `;
    photoPreview.classList.remove('has-image');
    photoInput.value = '';
    removePhotoBtn.style.display = 'none';
    currentPhotoFile = null;
}

// 設定預設日期時間
function setDefaultDateTime() {
    const dateTimeInput = document.getElementById('activityDateTime');
    
    if (!dateTimeInput) return;
    
    // 獲取當前本地時間
    const now = new Date();
    
    // 調整為本地時區的時間
    const localISOTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
        .toISOString()
        .slice(0, 16); // 取前16個字符 YYYY-MM-DDTHH:MM
    
    dateTimeInput.value = localISOTime;
    
    // 調試輸出（生產環境可移除）
    console.log('設定日期時間:', localISOTime, '當前時間:', now.toLocaleString());
}

// 即時驗證設定
function setupRealTimeValidation() {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            clearFieldError(this);
        });
    });
}

// 驗證表單
function validateForm() {
    const form = document.getElementById('signinForm');
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });

    // 檢查照片上傳
    if (!currentPhotoFile) {
        showErrorMessage('請上傳照片作為簽到證明');
        isValid = false;
    }

    // 檢查簽名
    let signatureValid = false;
    try {
        signatureValid = hasSignature();
        if (!signatureValid) {
            // 嘗試重試一次
            console.log('首次簽名檢測失敗，嘗試重試...');
            setTimeout(() => {
                signatureValid = hasSignature();
            }, 100);
        }
    } catch (error) {
        console.error('簽名驗證過程中發生錯誤:', error);
        signatureValid = false;
    }
    
    if (!signatureValid) {
        showErrorMessage('請在簽名區域簽名確認，確保簽名清楚可見');
        console.log('表單驗證失敗：缺少有效簽名');
        isValid = false;
    } else {
        console.log('簽名驗證通過');
    }

    return isValid;
}

// 驗證單個欄位
function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // 清除之前的錯誤
    clearFieldError(field);

    // 必填驗證
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = '此欄位為必填項目';
    }

    // 特定欄位驗證
    if (isValid && value) {
        switch (field.name) {
            case 'employeeId':
                if (value.length < 3) {
                    isValid = false;
                    errorMessage = '員工編號至少需要3個字元';
                }
                break;
                
            case 'name':
                if (value.length < 2) {
                    isValid = false;
                    errorMessage = '姓名至少需要2個字元';
                }
                break;
                
            case 'department':
                if (value.length < 2) {
                    isValid = false;
                    errorMessage = '部門名稱至少需要2個字元';
                }
                break;
                
            case 'location':
                if (value.length < 2) {
                    isValid = false;
                    errorMessage = '地點至少需要2個字元';
                }
                break;
                
            case 'activityDateTime':
                // 移除日期時間限制，允許任何日期
                // 不進行日期驗證
                break;
                
            case 'signinType':
                if (!value) {
                    isValid = false;
                    errorMessage = '請選擇簽到類型';
                }
                break;
        }
    }

    // 顯示錯誤訊息
    if (!isValid) {
        showFieldError(field, errorMessage);
    }

    return isValid;
}

// 顯示欄位錯誤
function showFieldError(field, message) {
    field.classList.add('error');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    field.parentNode.appendChild(errorDiv);
}

// 清除欄位錯誤
function clearFieldError(field) {
    field.classList.remove('error');
    
    const errorDiv = field.parentNode.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
}

// 清除所有錯誤
function clearErrors() {
    const errors = document.querySelectorAll('.error-message');
    const errorFields = document.querySelectorAll('.error');
    
    errors.forEach(error => error.remove());
    errorFields.forEach(field => field.classList.remove('error'));
}

// 提交表單
async function submitForm() {
    const form = document.getElementById('signinForm');
    const formData = new FormData(form);
    
    // 準備提交資料
    const submitData = {
        employeeId: formData.get('employeeId'),
        name: formData.get('name'),
        department: formData.get('department'),
        activityType: formData.get('activityType'),
        location: formData.get('location'),
        activityDateTime: formData.get('activityDateTime'),
        signatureData: getSignatureDataURL()
    };

    // 現在照片是必填的，所以一定要有照片才能提交
    if (!currentPhotoFile) {
        showErrorMessage('請上傳照片作為簽到證明');
        return;
    }

    // 有照片上傳的情況
    const photoFormData = new FormData();
    photoFormData.append('photo', currentPhotoFile);
    
    // 將其他資料轉換為JSON字串並附加
    photoFormData.append('data', JSON.stringify(submitData));
    
    try {
        setLoading(true);
        
        const response = await fetch('/api/signin', {
            method: 'POST',
            body: photoFormData
        });

        const result = await response.json();

        if (response.ok) {
            showSuccessMessage(result);
        } else {
            // 檢查是否需要 Google 授權
            if (result.authRequired && result.authUrl) {
                showGoogleAuthMessage(result.authUrl, result.error);
            } else {
                showErrorMessage(result.error || '簽到失敗，請稍後再試');
            }
        }

    } catch (error) {
        console.error('提交錯誤:', error);
        showErrorMessage('網路錯誤，請檢查連線後再試');
    } finally {
        setLoading(false);
    }
}

// 顯示載入狀態
function setLoading(loading) {
    isLoading = loading;
    const loadingElement = document.getElementById('loading');
    const submitButton = document.querySelector('button[type="submit"]');
    
    if (loading) {
        loadingElement.style.display = 'flex';
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
    } else {
        loadingElement.style.display = 'none';
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check"></i> 確認簽到';
    }
}

// 顯示成功訊息
function showSuccessMessage(result) {
    const successMessage = document.getElementById('successMessage');
    const successDetails = document.getElementById('successDetails');
    
    // 格式化成功訊息
    const details = `
        <p><strong>簽到編號：</strong>${result.signinCode}</p>
        <p><strong>員工姓名：</strong>${result.name}</p>
        <p><strong>運動項目：</strong>${result.activity.type}</p>
        <p><strong>活動地點：</strong>${result.activity.location}</p>
        <p><strong>活動日期時間：</strong>${result.activity.dateTime}</p>
    `;
    
    successDetails.innerHTML = details;
    successMessage.style.display = 'flex';
    
    // 設定按鈕事件
    const continueSigninBtn = document.getElementById('continueSigninBtn');
    const closeSuccessBtn = document.getElementById('closeSuccessBtn');
    
    // 繼續簽到按鈕
    continueSigninBtn.onclick = function() {
        successMessage.style.display = 'none';
        resetForm();
    };
    
    // 完成確認按鈕
    closeSuccessBtn.onclick = function() {
        successMessage.style.display = 'none';
    };
    
    // 滾動到頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 顯示錯誤訊息
function showErrorMessage(message) {
    // 建立錯誤提示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // 添加樣式
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e74c3c;
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
    
    document.body.appendChild(errorDiv);
    
    // 自動移除
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// 初始化成功訊息
function initializeSuccessMessage() {
    const continueBtn = document.getElementById('continueSigninBtn');
    const successMessage = document.getElementById('successMessage');
    const successContent = successMessage.querySelector('.success-content');
    
    if (continueBtn) {
        continueBtn.addEventListener('click', resetForm);
    }
    
    // 點擊背景關閉對話窗
    if (successMessage) {
        successMessage.addEventListener('click', function(e) {
            if (e.target === successMessage) {
                resetForm();
            }
        });
    }
    
    // 阻止點擊內容區域時關閉對話窗
    if (successContent) {
        successContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
}

// 重置表單
function resetForm() {
    const form = document.getElementById('signinForm');
    const successMessage = document.getElementById('successMessage');
    
    // 隱藏成功訊息
    successMessage.style.display = 'none';
    
    // 重置表單
    form.reset();
    clearErrors();
    resetPhotoPreview();
    clearSignature();
    
    // 延遲設置當前日期時間，確保表單重置完成
    setTimeout(() => {
        setDefaultDateTime();
        updateSignaturePlaceholder();
    }, 100);
    
    // 滾動到表單
    form.scrollIntoView({ behavior: 'smooth' });
}

// 添加滑入動畫CSS
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
    
    .error-toast button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 16px;
    }
    
    .error-toast button:hover {
        opacity: 0.8;
    }
    
    .auth-message {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        text-align: center;
        z-index: 1001;
        max-width: 90%;
        width: 400px;
    }
    
    .auth-message h3 {
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
    }
    
    .auth-message p {
        margin: 0 0 1.5rem 0;
        opacity: 0.9;
    }
    
    .auth-message .btn {
        margin: 0.5rem;
    }
    
    .auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        backdrop-filter: blur(5px);
    }
`;
document.head.appendChild(style);

// 顯示 Google 授權訊息
function showGoogleAuthMessage(authUrl, errorMessage) {
    // 移除現有的授權訊息
    const existingOverlay = document.querySelector('.auth-overlay');
    const existingMessage = document.querySelector('.auth-message');
    if (existingOverlay) existingOverlay.remove();
    if (existingMessage) existingMessage.remove();
    
    // 建立覆蓋層
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    
    // 建立授權訊息
    const authMessage = document.createElement('div');
    authMessage.className = 'auth-message';
    authMessage.innerHTML = `
        <i class="fas fa-key" style="font-size: 2rem; margin-bottom: 1rem; color: #ffd700;"></i>
        <h3>需要 Google 授權</h3>
        <p>${errorMessage || '系統需要 Google 授權才能使用簽到功能'}</p>
        <p style="font-size: 0.9rem; opacity: 0.8;">
            點擊下方按鈕完成授權後，請重新提交表單
        </p>
        <div>
            <a href="${authUrl}" target="_blank" class="btn btn-primary">
                <i class="fab fa-google"></i> 前往 Google 授權
            </a>
            <button class="btn btn-secondary" onclick="closeAuthMessage()">
                <i class="fas fa-times"></i> 稍後授權
            </button>
        </div>
    `;
    
    // 點擊覆蓋層關閉
    overlay.addEventListener('click', closeAuthMessage);
    
    // 添加到頁面
    document.body.appendChild(overlay);
    document.body.appendChild(authMessage);
}

// 關閉授權訊息
function closeAuthMessage() {
    const overlay = document.querySelector('.auth-overlay');
    const message = document.querySelector('.auth-message');
    if (overlay) overlay.remove();
    if (message) message.remove();
} 