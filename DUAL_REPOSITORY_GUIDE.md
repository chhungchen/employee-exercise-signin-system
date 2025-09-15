# 雙重版本庫管理指引

**更新日期**: 2025-08-21  
**版本**: 1.0.0

## 📋 概述

本專案採用雙重版本庫策略：

- **內部 Azure DevOps**: 顯示個人資訊 (`[USER_ID] <[user@company.com]>`)
- **外部 GitHub**: 顯示匿名資訊 (`System <system@company.local>`)

## 🏗️ 版本庫配置

### 內部版本庫 (主要開發)
```
Remote: azure
URL: [INTERNAL_REPOSITORY_URL]
用途: 日常開發、版本控制、內部協作
作者: [USER_ID] <[user@company.com]>
```

### 外部版本庫 (公開展示)
```
Remote: origin  
URL: https://github.com/chhungchen/employee-exercise-signin-system.git
用途: 功能性更新展示、公開參考
作者: System <system@company.local>
推送條件: 僅程式功能性變更
```

## 🔧 開發工作流程

### 日常開發 (推薦)

1. **正常開發和提交**
   ```bash
   git add .
   git commit -m "你的提交訊息"
   ```

2. **推送到內部版本庫**
   ```bash
   git push azure main
   ```

3. **功能性更新時推送到 GitHub**
   - 僅在有重要功能更新時執行
   - 使用雙重推送腳本（見下方）

### 使用雙重推送腳本

#### Windows 用戶
```bash
scripts\dual-push.bat
```

#### Linux/Mac 用戶
```bash
bash scripts/dual-push.sh
```

#### 腳本功能
1. ✅ 檢查未提交變更
2. 📤 推送到 Azure DevOps (個人資訊)
3. ❓ 詢問是否為功能性更新
4. 📤 若是，則推送到 GitHub (匿名資訊)
5. 🔄 自動恢復個人 git 配置

## 📊 推送策略

### 內部 Azure DevOps (每次都推)
- ✅ 功能開發
- ✅ Bug 修復
- ✅ 重構優化
- ✅ 文件更新
- ✅ 配置調整
- ✅ 測試改進

### 外部 GitHub (選擇性推送)
- ✅ 新功能實作
- ✅ 重大架構變更
- ✅ 安全性更新
- ✅ 效能優化
- ❌ 日常 bug 修復
- ❌ 內部配置調整
- ❌ 測試檔案變更
- ❌ 文件小幅修改

## 🛠️ 手動操作指令

### 切換到個人資訊配置
```bash
git config user.name "[USER_ID]"
git config user.email "[user@company.com]"
```

### 切換到匿名配置
```bash
git config user.name "System"
git config user.email "system@company.local"
```

### 檢查目前配置
```bash
git config user.name
git config user.email
```

### 檢查版本庫狀態
```bash
git remote -v
```

## 🔍 故障排除

### 問題：推送到 Azure DevOps 失敗
```bash
# 檢查網路連接
ping [INTERNAL_SERVER]

# 檢查認證
git credential-manager-core erase
```

### 問題：GitHub 推送被拒絕
```bash
# 強制推送 (僅在確認安全時使用)
git push origin main --force
```

### 問題：作者資訊混亂
```bash
# 重新配置個人資訊
git config user.name "[USER_ID]"  
git config user.email "[user@company.com]"

# 修改最後一個 commit 的作者
git commit --amend --reset-author --no-edit
```

## 📋 最佳實踐

### 1. 版本控制原則
- 所有變更先推送到內部 Azure DevOps
- 功能穩定後考慮推送到 GitHub
- 保持提交訊息清晰簡潔

### 2. 安全性考量
- 不在公開版本庫暴露內部資訊
- 定期檢查敏感資料是否洩露
- 使用匿名資訊進行公開展示

### 3. 協作建議
- 內部團隊使用 Azure DevOps 進行協作
- 外部展示使用 GitHub
- 保持兩個版本庫功能同步

## 🎯 檢查清單

推送前確認：

**內部 Azure DevOps**
- [ ] 程式碼已測試
- [ ] 提交訊息清楚
- [ ] 使用個人資訊配置

**外部 GitHub**
- [ ] 是功能性更新
- [ ] 無敏感資訊
- [ ] 使用匿名配置
- [ ] 程式碼品質良好

## 📞 聯絡支援

如有問題：
1. 查看本指引的故障排除章節
2. 檢查 `CLAUDE.md` 中的技術參考
3. 參考 `TECHNICAL_REFERENCE.md`

---

**維護說明**: 此指引隨專案發展更新，確保雙重版本庫策略的有效實施。