# 使用官方Node.js 18 Alpine版本
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製package文件
COPY package*.json ./

# 安裝生產依賴
RUN npm ci --only=production && npm cache clean --force

# 複製應用程式代碼
COPY . .

# 創建必要的目錄
RUN mkdir -p /app/database /app/uploads/photos

# 設定權限
RUN chown -R node:node /app

# 使用非root用戶
USER node

# 暴露端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 啟動應用
CMD ["node", "server.js"]