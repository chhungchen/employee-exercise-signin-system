#!/bin/bash

# 雲端部署選擇腳本
# 支援多種雲端平台的快速部署

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}☁️  員工運動社團活動簽到系統 - 雲端部署工具${NC}"
echo ""

# 檢查必要工具
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 未安裝${NC}"
        return 1
    fi
    return 0
}

# 顯示部署選項
show_options() {
    echo -e "${YELLOW}請選擇部署平台:${NC}"
    echo ""
    echo "1. 🔄 Heroku (免費/簡易)"
    echo "2. 🚀 Railway (新興平台)"
    echo "3. 🌐 Render (免費SSL)"
    echo "4. ⚡ Vercel (前端專用)"
    echo "5. ☁️  DigitalOcean App Platform"
    echo "6. 🐳 Docker VPS 部署"
    echo "7. 🏃 退出"
    echo ""
}

# Heroku 部署
deploy_heroku() {
    echo -e "${YELLOW}🔄 開始 Heroku 部署...${NC}"
    
    if ! check_tool "heroku"; then
        echo "請先安裝 Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli"
        return 1
    fi
    
    echo "請輸入應用程式名稱 (留空自動生成):"
    read -r app_name
    
    if [ -z "$app_name" ]; then
        heroku create
    else
        heroku create "$app_name"
    fi
    
    # 設定環境變數
    heroku config:set NODE_ENV=production
    heroku config:set JWT_SECRET=$(openssl rand -base64 32)
    
    # 部署
    git add .
    git commit -m "Deploy to Heroku" || true
    git push heroku main
    
    echo -e "${GREEN}✅ Heroku 部署完成！${NC}"
    heroku open
}

# Railway 部署
deploy_railway() {
    echo -e "${YELLOW}🚀 開始 Railway 部署...${NC}"
    
    if ! check_tool "railway"; then
        echo "請先安裝 Railway CLI: npm install -g @railway/cli"
        return 1
    fi
    
    railway login
    railway link
    railway up
    
    echo -e "${GREEN}✅ Railway 部署完成！${NC}"
}

# Render 部署
deploy_render() {
    echo -e "${YELLOW}🌐 開始 Render 部署...${NC}"
    
    echo "Render 部署需要手動在網站進行:"
    echo "1. 訪問 https://render.com"
    echo "2. 連接 GitHub 倉庫"
    echo "3. 選擇 'Web Service'"
    echo "4. 設定構建命令: npm install"
    echo "5. 設定啟動命令: node server.js"
    echo "6. 設定環境變數"
    
    echo ""
    echo "建議的環境變數:"
    echo "NODE_ENV=production"
    echo "JWT_SECRET=$(openssl rand -base64 32)"
    echo ""
}

# Vercel 部署
deploy_vercel() {
    echo -e "${YELLOW}⚡ 開始 Vercel 部署...${NC}"
    
    if ! check_tool "vercel"; then
        echo "請先安裝 Vercel CLI: npm install -g vercel"
        return 1
    fi
    
    vercel login
    vercel --prod
    
    echo -e "${GREEN}✅ Vercel 部署完成！${NC}"
}

# DigitalOcean App Platform 部署
deploy_digitalocean() {
    echo -e "${YELLOW}☁️  開始 DigitalOcean App Platform 部署...${NC}"
    
    if ! check_tool "doctl"; then
        echo "請先安裝 DigitalOcean CLI: https://docs.digitalocean.com/reference/doctl/"
        return 1
    fi
    
    # 創建應用規格文件
    cat > app.yaml <<EOF
name: employee-signin
services:
- name: web
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: node server.js
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: JWT_SECRET
    value: $(openssl rand -base64 32)
EOF
    
    doctl apps create app.yaml
    
    echo -e "${GREEN}✅ DigitalOcean 部署完成！${NC}"
}

# Docker VPS 部署
deploy_docker_vps() {
    echo -e "${YELLOW}🐳 開始 Docker VPS 部署...${NC}"
    
    echo "請輸入VPS IP地址:"
    read -r vps_ip
    
    echo "請輸入SSH用戶名 (預設: root):"
    read -r ssh_user
    ssh_user=${ssh_user:-root}
    
    # 複製檔案到VPS
    scp -r . "$ssh_user@$vps_ip:~/employee-signin/"
    
    # 在VPS上執行部署
    ssh "$ssh_user@$vps_ip" << 'EOF'
cd ~/employee-signin/deployment
chmod +x deploy.sh
./deploy.sh
EOF
    
    echo -e "${GREEN}✅ Docker VPS 部署完成！${NC}"
    echo -e "請訪問: https://$vps_ip"
}

# 主程式
main() {
    while true; do
        show_options
        echo -n "請選擇 (1-7): "
        read -r choice
        
        case $choice in
            1) deploy_heroku ;;
            2) deploy_railway ;;
            3) deploy_render ;;
            4) deploy_vercel ;;
            5) deploy_digitalocean ;;
            6) deploy_docker_vps ;;
            7) echo -e "${GREEN}👋 再見！${NC}"; exit 0 ;;
            *) echo -e "${RED}❌ 無效選擇，請重試${NC}" ;;
        esac
        
        echo ""
        echo -e "${BLUE}按任意鍵繼續...${NC}"
        read -n 1 -s
        echo ""
    done
}

# 檢查Git
if ! check_tool "git"; then
    echo -e "${RED}❌ 請先安裝 Git${NC}"
    exit 1
fi

# 檢查是否在Git倉庫中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  當前目錄不是Git倉庫，正在初始化...${NC}"
    git init
    git add .
    git commit -m "Initial commit"
fi

# 執行主程式
main