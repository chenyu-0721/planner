# Planner

仿 **Microsoft Planner** 的團隊工作管理系統。用「計劃 → 貯體 → 工作」的方式管理專案，介面和操作盡量和 Microsoft Planner 相同：看板拖曳、格線、排程行事曆、圖表、我的一天、我的工作等。

| 層 | 技術 |
| --- | --- |
| 前端 | Vue 3、Vite、Tailwind CSS 4、Pinia、Vue Router、vuedraggable |
| 後端 | Node.js、Express 5、Sequelize 6、MySQL / MariaDB、JWT |
| 部署 | 前端 build 後由 Express 一併提供，使用 PM2 常駐 |

---

## 目錄

- [環境需求](#環境需求)
- [安裝與啟動](#安裝與啟動)
- [預設帳號](#預設帳號)
- [使用說明](#使用說明)
- [常用指令](#常用指令)
- [開發模式](#開發模式)
- [專案結構](#專案結構)
- [常見問題](#常見問題)

---

## 環境需求

- **Node.js** 20 以上
- **MySQL 5.7+** 或 **MariaDB 10.4+**
- **PM2**：`npm install -g pm2`

## 安裝與啟動

### 1. 下載專案並安裝套件

```bash
git clone https://github.com/chenyu-0721/planner.git
cd planner
npm run install:all
```

### 2. 設定資料庫連線

複製 `backend/.env.example` 為 `backend/.env`，依照你的環境修改：

```ini
PORT=8080                 # 服務埠號（PM2 啟動時以 ecosystem.config.js 的 PORT 為準）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=你的資料庫密碼
DB_NAME=planner           # 資料庫名稱，不存在會自動建立
JWT_SECRET=請改成一串隨機字串
JWT_EXPIRES_IN=7d         # 登入有效期間
```

### 3. 建立資料庫與預設資料

```bash
npm run setup
```

這個指令會依序：建立資料庫 → 建立資料表 → 執行 seed（建立預設管理員帳號）。seed 執行過會記錄下來，重複執行不會產生重複資料。

### 4. Build 前端並啟動

```bash
npm run build     # 前端輸出到 backend/public
npm start         # 以 PM2 啟動
```

打開瀏覽器進入 **http://localhost:8080** 即可使用。

### 5.（選用）開機自動啟動

**Windows**：

```bash
npm run startup:install      # 登入 Windows 時自動啟動 planner
npm run startup:uninstall    # 取消
```

**Linux / macOS**：

```bash
pm2 startup     # 依畫面提示執行輸出的指令
pm2 save
```

---

## 預設帳號

系統只預設一組管理員帳號：

| 帳號 | 密碼 | 角色 |
| --- | --- | --- |
| `admin` | `admin1111` | 系統管理員 |

其他使用者請由管理員登入後，在 **「使用者管理」** 建立（見下方[使用者管理](#使用者管理管理員)）。

> ⚠️ 第一次登入後，請到「使用者管理」→「變更我的密碼」修改預設密碼。

---

## 使用說明

### 畫面配置

- **上方列**：搜尋計劃、右上角頭像選單（我的帳戶、使用者管理、登出）
- **左側選單**：新增計劃、我的一天、我的工作、我的計劃、釘選的計劃、最近的計劃（左上 ☰ 可摺疊）

### 建立計劃

1. 左側點選 **「＋ 新增計劃」**
2. 輸入計劃名稱、描述（選用），選擇色彩
3. 按 **「建立計劃」**，會自動建立第一個貯體「待辦事項」

### 計劃頁面

計劃上方可以：

- 點計劃名稱直接重新命名
- ☆ 釘選計劃，釘選後會出現在左側「釘選」區
- 「…」選單：計劃設定、編輯標籤、匯出 CSV、離開計劃、刪除計劃（僅擁有者 / 管理員）
- 右上角成員頭像：新增或移除計劃成員（只有成員看得到並可編輯這個計劃）

計劃有四種檢視：

| 檢視 | 說明 |
| --- | --- |
| **格線** | 表格清單。可直接修改指派、日期、貯體、進度、優先順序、標籤；點欄位標題排序；最上方一列可快速新增工作 |
| **面板** | 看板。依貯體（或其他群組）分欄顯示工作卡片，可拖曳 |
| **排程** | 月 / 週行事曆。有開始日與到期日的工作會顯示成橫條；拖曳可改日期；右側「未排程的工作」拖到日期上即設定到期日；滑過日期格點「＋」可直接在那天新增工作 |
| **圖表** | 狀態（未開始 / 進行中 / 逾期 / 已完成）、各貯體、優先順序、各成員的工作統計 |

### 面板（看板）操作

- **新增工作**：每欄上方「＋ 新增工作」，輸入名稱，可設定到期日、指派，按 Enter 或「新增工作」
- **完成工作**：點卡片標題前的圓圈；已完成的工作會收到欄位下方「已完成的工作」
- **移動工作**：拖曳卡片到其他欄或調整順序
- **貯體**：點貯體名稱可改名；「…」可重新命名、刪除（會一併刪除其中的工作）；拖曳貯體標題可調整順序；最右側「新增貯體」
- **群組依據**：右上角可切換為依「貯體 / 指派對象 / 進度 / 到期日 / 優先順序 / 標籤」分欄；拖曳卡片到其他欄會直接修改該欄位（例如拖到「已完成」欄即標示完成）
- **篩選**：右上角「篩選」可依關鍵字、到期日、優先順序、進度、標籤、貯體、指派對象篩選，四種檢視都適用

卡片上會顯示：標籤、進度、優先順序圖示、到期日（逾期為紅色）、附註、檢查清單完成數、附件數、意見數、指派對象頭像。

### 工作詳細資料

點任一張卡片開啟：

| 項目 | 說明 |
| --- | --- |
| 標題 | 直接點擊修改；左側圓圈可標示完成 |
| 指派 | 可指派給多位計劃成員 |
| 標籤 | 共 25 種色彩，滑過標籤點 ✎ 可替標籤命名（整個計劃共用） |
| 貯體 / 進度 / 優先順序 | 進度：未開始、進行中、已完成；優先順序：緊急、重要、中、低 |
| 開始日期 / 到期日 | 到期日過了且未完成會顯示為逾期 |
| 附註 | 勾選「在卡片上顯示」會把附註顯示在卡片上 |
| 檢查清單 | 新增項目、勾選、改名、拖曳排序、刪除；可設定在卡片上顯示 |
| 附件 | 上傳檔案（20MB 以內）或加入連結；圖片可設定在卡片上顯示 |
| 意見 | 留言討論，Ctrl + Enter 送出 |

右上角「…」：新增至「我的一天」、複製工作連結、刪除工作。

### 我的一天

規劃今天要做的事。從任何卡片的「…」→「新增至『我的一天』」，或從右側「建議」（指派給你、今天到期或已逾期的工作）點「加入」。每天會自動清空。

### 我的工作

所有計劃中指派給你的工作。可切換「清單 / 面板」，依未完成 / 已完成篩選；面板可依進度、到期日、計劃分組，拖曳即可改進度或日期。

### 我的帳戶

右上角頭像 →「我的帳戶」：修改顯示名稱、電子郵件、頭像顏色、變更密碼。

### 使用者管理（管理員）

以管理員（`admin`）登入後，左側選單或右上角頭像選單會出現 **「使用者管理」**。一般會員無法自行註冊，所有帳號都由管理員在這裡建立。

| 操作 | 方式 |
| --- | --- |
| **新增使用者** | 右上「＋ 新增使用者」→ 填入帳號（3~50 個英文、數字或 `_ . -`）、顯示名稱、電子郵件（選用）、密碼（至少 6 字元）與確認密碼、角色（會員 / 管理員） |
| **查詢使用者** | 上方搜尋框可依帳號、名稱、電子郵件搜尋，也可依角色篩選 |
| **編輯使用者** | 該列的 ✎：修改顯示名稱、電子郵件、角色、啟用 / 停用；「新密碼」欄填入即可替該使用者重設密碼，留白則不變更 |
| **刪除使用者** | 該列的 🗑：刪除後，其計劃成員資格與工作指派會一併移除 |
| **變更自己的密碼** | 右上「變更我的密碼」→ 輸入目前密碼與新密碼（也可從頭像 →「我的帳戶」→「變更密碼」） |

注意事項：

- 停用的帳號無法登入，但資料會保留；需要時可再改回啟用
- 管理員不能停用、降級或刪除自己的帳號，避免系統沒有管理員
- 帳號建立後無法修改帳號名稱，只能修改顯示名稱
- 使用者建立後，需由計劃成員在計劃右上角的成員按鈕把他加入計劃，他才看得到該計劃

---

## 常用指令

在專案根目錄執行：

| 指令 | 說明 |
| --- | --- |
| `npm run install:all` | 安裝前後端套件 |
| `npm run setup` | 建立資料庫、資料表並執行 seed |
| `npm run build` | Build 前端到 `backend/public` |
| `npm start` | PM2 啟動（也可直接 `pm2 start ecosystem.config.js`） |
| `npm run restart` / `npm run stop` | PM2 重啟 / 停止 |
| `npm run logs` | 查看 PM2 log（也寫在 `backend/logs/`） |
| `npm run startup:install` / `startup:uninstall` | Windows 開機自動啟動 / 取消 |

在 `backend/` 執行：

| 指令 | 說明 |
| --- | --- |
| `npm run reset-password -- <帳號> <新密碼>` | 重設指定帳號的密碼 |
| `npm run db:sync:alter` | 依 model 調整資料表結構（改了 model 後使用） |
| `npm run db:seed` | 執行 seed |
| `npm run db:reset` | ⚠️ 清空所有資料表並重新 seed |

**更新程式後**：

```bash
git pull
npm run install:all
npm run build
npm run restart
```

---

## 開發模式

開兩個終端機：

```bash
npm run dev:backend     # 後端 http://localhost:8080（修改自動重啟）
npm run dev:frontend    # 前端 http://localhost:5173（熱更新，/api 自動轉到 8080）
```

開發時請打開 http://localhost:5173 。

## 專案結構

```
planner/
├── ecosystem.config.js      PM2 設定（名稱 planner、port 8080）
├── package.json             根目錄快捷指令
├── scripts/
│   └── install-startup.js   Windows 開機自動啟動
├── backend/
│   ├── .env.example         環境變數範本
│   ├── ecosystem.config.js  PM2 設定（在 backend 目錄啟動用）
│   ├── scripts/             建立資料庫、同步資料表、重設密碼
│   ├── seeders/             預設管理員帳號
│   ├── uploads/             附件上傳目錄
│   ├── public/              前端 build 輸出（自動產生）
│   └── src/
│       ├── server.js        Express 進入點
│       ├── config/          資料庫設定
│       ├── models/          Sequelize models
│       ├── middleware/      JWT 驗證
│       ├── routes/          API（auth、users、plans、buckets、tasks、me）
│       └── utils/
└── frontend/
    ├── vite.config.js       build 輸出到 ../backend/public
    └── src/
        ├── views/           頁面（登入、我的一天、我的工作、我的計劃、計劃、使用者管理）
        ├── components/      卡片、工作詳細資料、各種選取器
        │   └── plan/        面板、格線、排程、圖表、篩選、成員
        ├── stores/          Pinia（auth、plans、plan、ui）
        ├── router/
        ├── api/             axios
        └── utils/
```

## 資料表

| 資料表 | 說明 | 主要欄位（長度上限） |
| --- | --- | --- |
| `users` | 使用者 | 帳號 50、顯示名稱 50、電子郵件 100、密碼雜湊 char(60) |
| `plans` | 計劃 | 名稱 100、描述 500、標籤名稱（JSON）1500 |
| `plan_members` | 計劃成員 | 角色（owner / member）、是否釘選 |
| `buckets` | 貯體 | 名稱 100 |
| `tasks` | 工作 | 名稱 200、附註 text（10000 字）、進度 / 優先順序 tinyint、標籤（JSON）80 |
| `task_assignees` | 工作指派 | 主鍵 (task_id, user_id) |
| `checklist_items` | 檢查清單 | 項目 100 |
| `attachments` | 附件 | 名稱 200、網址 1000 |
| `comments` | 意見 | 內容 2000 |
| `my_day_items` | 我的一天 | 使用者、工作、日期 |

欄位長度上限定義在 `backend/src/models/index.js` 的 `LIMITS`，超過時 API 會回傳 400 與錯誤訊息，前端輸入框也有相同的字數限制。修改 model 後執行 `npm run db:sync:alter`（在 `backend/`）同步資料表結構。

## 常見問題

**啟動後連不上 / 顯示「資料庫連線失敗」**
檢查 `backend/.env` 的 `DB_HOST`、`DB_USER`、`DB_PASS` 是否正確，以及 MySQL / MariaDB 是否已啟動。可用 `npm run logs` 查看錯誤。

**打開網頁顯示「前端尚未 build」**
在根目錄執行 `npm run build`。

**Port 8080 被佔用 / 想換 port**
修改 `ecosystem.config.js`（以及 `backend/ecosystem.config.js`、`backend/.env`）的 `PORT`，再執行：

```bash
pm2 delete planner
npm start
```

**忘記密碼**
一般使用者可請管理員在「使用者管理」重設。管理員忘記密碼時，在 `backend/` 執行：

```bash
npm run reset-password -- admin 新密碼
```
