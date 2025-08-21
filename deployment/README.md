# 員工運動社團活動簽到系統 - 部署指南

## 🌐 部署方案選擇

### 1. 雲端VPS部署 (推薦)
**適合**: 中小企業，需要完全控制
**平台建議**: DigitalOcean, Linode, Vultr, 阿里雲, AWS EC2
**費用**: $5-20/月

### 2. 平台即服務 (PaaS)
**適合**: 快速部署，不想管理伺服器
**平台建議**: Heroku, Railway, Render, Vercel
**費用**: $0-10/月

### 3. 容器平台
**適合**: 需要高可用性和擴展性
**平台建議**: Google Cloud Run, AWS Fargate, Azure Container Instances
**費用**: 按使用量計費

## 🚀 快速部署 (VPS)

### 系統需求
- Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- 1GB RAM (最小) / 2GB RAM (推薦)
- 10GB 硬碟空間
- Docker & Docker Compose

### 部署步驟

1. **準備伺服器**
   ```bash
   # 更新系統
   sudo apt update && sudo apt upgrade -y
   
   # 安裝Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # 安裝Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **下載應用程式**
   ```bash
   # 克隆或上傳程式碼到伺服器
   git clone <your-repo> employee-signin
   cd employee-signin
   ```

3. **執行部署**
   ```bash
   cd deployment
   ./deploy.sh
   ```

4. **設定網域 (可選)**
   - 在DNS供應商設定A記錄指向伺服器IP
   - 使用Let's Encrypt獲取免費SSL憑證

## 🌟 Heroku 部署 (簡易方案)

### 準備檔案
創建以下檔案：

**Procfile**
```
web: node server.js
```

**heroku-postbuild** (在package.json中添加)
```json
{
  "scripts": {
    "heroku-postbuild": "npm run init-db"
  }
}
```

### 部署步驟
```bash
# 安裝Heroku CLI
npm install -g heroku

# 登入Heroku
heroku login

# 創建應用
heroku create your-app-name

# 設定環境變數
heroku config:set NODE_ENV=production

# 部署
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

## ☁️ Vercel 部署 (靜態前端)

如果只需要前端簽到功能，可以修改為靜態網站：

**vercel.json**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ]
}
```

## 🔧 環境變數設定

| 變數名稱 | 說明 | 預設值 |
|---------|------|-------|
| `NODE_ENV` | 執行環境 | `development` |
| `PORT` | 應用程式埠號 | `3000` |
| `JWT_SECRET` | JWT密鑰 | `your-secret-key` |
| `UPLOAD_PATH` | 上傳檔案路徑 | `uploads/` |

## 🛡️ 安全設定

### 1. 防火牆設定
```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 2. SSL憑證 (Let's Encrypt)
```bash
# 安裝Certbot
sudo apt install certbot python3-certbot-nginx

# 獲取憑證
sudo certbot --nginx -d yourdomain.com

# 自動更新
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. 備份設定
```bash
#!/bin/bash
# backup.sh
tar -czf backup-$(date +%Y%m%d).tar.gz database/ uploads/
```

## 📊 監控和維護

### 1. 健康檢查
```bash
# 檢查服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 重啟服務
docker-compose restart
```

### 2. 效能監控
推薦工具：
- **Uptime Robot**: 網站可用性監控
- **New Relic**: 應用程式效能監控
- **Grafana + Prometheus**: 自建監控

## 💰 成本估算

### VPS方案
- **小型部署** (50人以下): $5-10/月
- **中型部署** (50-200人): $10-20/月
- **大型部署** (200+人): $20-50/月

### PaaS方案
- **Heroku**: $0-7/月
- **Railway**: $0-5/月
- **Render**: $0-7/月

## 🔄 更新部署

### 自動化更新 (CI/CD)
1. 設定GitHub Actions
2. 連接到生產伺服器
3. 自動測試和部署

### 手動更新
```bash
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

## 📱 行動裝置優化

系統已針對手機使用進行優化：
- ✅ 響應式設計
- ✅ 觸控友好界面
- ✅ PWA支援
- ✅ 離線功能
- ✅ 快速載入

## 🆘 故障排除

### 常見問題
1. **無法連接數據庫**: 檢查資料夾權限
2. **上傳失敗**: 檢查uploads目錄權限
3. **HTTPS錯誤**: 檢查SSL憑證設定
4. **記憶體不足**: 升級VPS規格

### 緊急聯絡
- 檢查日誌: `docker-compose logs`
- 重啟服務: `docker-compose restart`
- 完全重建: `docker-compose down && docker-compose up -d --build`

---

## 📞 技術支援

如需技術支援，請提供：
1. 錯誤訊息截圖
2. 系統環境資訊
3. 部署方式說明