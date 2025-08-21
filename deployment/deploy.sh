#!/bin/bash

# 部署腳本 - 員工運動社團活動簽到系統
# 適用於雲端VPS部署

set -e  # 遇到錯誤立即停止

echo "🚀 開始部署員工運動社團活動簽到系統..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查Docker是否安裝
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker未安裝，請先安裝Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker Compose未安裝，請先安裝Docker Compose${NC}"
    exit 1
fi

# 檢查是否為root用戶或有sudo權限
if [[ $EUID -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

echo -e "${YELLOW}📋 檢查系統環境...${NC}"

# 創建必要目錄
mkdir -p ssl database uploads/photos

# 檢查SSL憑證
if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo -e "${YELLOW}⚠️  SSL憑證不存在，生成自簽名憑證...${NC}"
    
    # 生成自簽名SSL憑證 (僅用於測試)
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=TW/ST=Taiwan/L=Taipei/O=Company/CN=localhost"
    
    echo -e "${GREEN}✅ 自簽名SSL憑證已生成${NC}"
    echo -e "${YELLOW}⚠️  生產環境請使用Let's Encrypt或購買SSL憑證${NC}"
fi

# 停止現有容器（如果存在）
echo -e "${YELLOW}🛑 停止現有容器...${NC}"
$SUDO docker-compose down 2>/dev/null || true

# 構建並啟動服務
echo -e "${YELLOW}🔨 構建應用程式...${NC}"
$SUDO docker-compose build --no-cache

echo -e "${YELLOW}🚀 啟動服務...${NC}"
$SUDO docker-compose up -d

# 等待服務啟動
echo -e "${YELLOW}⏳ 等待服務啟動...${NC}"
sleep 10

# 檢查服務狀態
echo -e "${YELLOW}🔍 檢查服務狀態...${NC}"
if $SUDO docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 所有服務已成功啟動${NC}"
else
    echo -e "${RED}❌ 服務啟動失敗${NC}"
    $SUDO docker-compose logs
    exit 1
fi

# 初始化數據庫
echo -e "${YELLOW}💾 初始化數據庫...${NC}"
$SUDO docker-compose exec app npm run init-db

# 顯示部署結果
echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo -e "${GREEN}📱 簽到表單: https://localhost${NC}"
echo -e "${GREEN}🔧 後台管理: https://localhost/admin${NC}"
echo -e "${GREEN}🔑 預設管理員帳號: admin / [請參考環境變數設定]${NC}"
echo ""
echo -e "${YELLOW}📋 有用的指令:${NC}"
echo -e "  查看日誌: ${YELLOW}$SUDO docker-compose logs -f${NC}"
echo -e "  重啟服務: ${YELLOW}$SUDO docker-compose restart${NC}"
echo -e "  停止服務: ${YELLOW}$SUDO docker-compose down${NC}"
echo -e "  進入容器: ${YELLOW}$SUDO docker-compose exec app sh${NC}"
echo ""
echo -e "${GREEN}🔒 SSL憑證位置: ./ssl/${NC}"
echo -e "${YELLOW}⚠️  請記得設定防火牆開放80和443端口${NC}"

# 檢查防火牆建議
if command -v ufw &> /dev/null; then
    echo ""
    echo -e "${YELLOW}🛡️  防火牆設定建議:${NC}"
    echo -e "  ${YELLOW}sudo ufw allow 80/tcp${NC}"
    echo -e "  ${YELLOW}sudo ufw allow 443/tcp${NC}"
    echo -e "  ${YELLOW}sudo ufw enable${NC}"
fi

echo ""
echo -e "${GREEN}✅ 部署完成！系統已上線運行${NC}"