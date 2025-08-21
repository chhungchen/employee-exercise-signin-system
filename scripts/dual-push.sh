#!/bin/bash
# 雙重身份推送腳本
# 用途：推送到內部 Azure DevOps (個人資訊) 和外部 GitHub (匿名資訊)

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 雙重身份推送腳本${NC}"
echo "==============================="

# 檢查是否有未提交的變更
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ 錯誤：有未提交的變更，請先 commit${NC}"
    exit 1
fi

# 取得目前分支
CURRENT_BRANCH=$(git branch --show-current)
echo -e "📍 目前分支: ${YELLOW}$CURRENT_BRANCH${NC}"

# 確認要推送
read -p "是否要執行雙重推送？(y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "❌ 取消推送"
    exit 0
fi

echo ""
echo -e "${GREEN}📤 階段1: 推送到內部 Azure DevOps (個人資訊)${NC}"
echo "============================================="

# 確保使用個人資訊
git config user.name "GA0382"
git config user.email "jameschen@inftfinance.com.tw"

# 推送到 Azure DevOps
if git push azure $CURRENT_BRANCH:main; then
    echo -e "${GREEN}✅ Azure DevOps 推送成功${NC}"
else
    echo -e "${RED}❌ Azure DevOps 推送失敗${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📤 階段2: 推送到外部 GitHub (匿名資訊)${NC}"
echo "======================================="

# 檢查是否為程式功能性更新
echo -e "${YELLOW}⚠️  注意：只有程式功能性更新才應推送到 GitHub${NC}"
read -p "這是程式功能性更新嗎？(y/N): " github_confirm
if [[ $github_confirm == [yY] ]]; then
    # 建立臨時分支用於匿名推送
    TEMP_BRANCH="temp-github-push-$(date +%s)"
    git checkout -b $TEMP_BRANCH
    
    # 修改最後一個 commit 為匿名作者
    git config user.name "System"
    git config user.email "system@company.local"
    git commit --amend --reset-author --no-edit
    
    # 推送到 GitHub
    if git push origin $TEMP_BRANCH:main --force; then
        echo -e "${GREEN}✅ GitHub 推送成功 (匿名)${NC}"
    else
        echo -e "${RED}❌ GitHub 推送失敗${NC}"
        git checkout $CURRENT_BRANCH
        git branch -D $TEMP_BRANCH
        exit 1
    fi
    
    # 清理臨時分支
    git checkout $CURRENT_BRANCH
    git branch -D $TEMP_BRANCH
    
    # 恢復個人資訊配置
    git config user.name "GA0382"
    git config user.email "jameschen@inftfinance.com.tw"
    
    echo -e "${GREEN}✅ 已恢復個人 git 配置${NC}"
else
    echo -e "${YELLOW}⏭️  跳過 GitHub 推送${NC}"
fi

echo ""
echo -e "${GREEN}🎯 雙重推送完成！${NC}"
echo "======================"
echo -e "📊 Azure DevOps: ${GREEN}個人資訊 (GA0382)${NC}"
if [[ $github_confirm == [yY] ]]; then
    echo -e "🐙 GitHub: ${GREEN}匿名資訊 (System)${NC}"
else
    echo -e "🐙 GitHub: ${YELLOW}未更新${NC}"
fi