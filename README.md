# Planner（Cloudflare 版）

仿 **Microsoft Planner** 的團隊工作管理系統。用「計劃 → 貯體 → 工作」的方式管理專案，介面和操作盡量和 Microsoft Planner 相同：看板拖曳、格線、排程行事曆、圖表、我的一天、我的工作等。

這個分支（`cloudflare`）部署在 **Cloudflare Workers + D1 + R2**，不需要自己的伺服器或資料庫。
（本機 MySQL + Express + PM2 的版本在 `main` 分支。）

| 層 | 技術 |
| --- | --- |
| 前端 | Vue 3、Vite、Tailwind CSS 4、Pinia、Vue Router、vuedraggable |
| API | Cloudflare Workers、Hono、Drizzle ORM、JWT |
| 資料庫 | Cloudflare D1（SQLite） |
| 附件檔案 | Cloudflare R2 |
| 前端託管 | Workers Static Assets（與 API 同一個 Worker） |

---

## 目錄

- [環境需求](#環境需求)
- [部署到 Cloudflare](#部署到-cloudflare)
- [本機開發](#本機開發)
- [預設帳號](#預設帳號)
- [使用說明](#使用說明)
- [常用指令](#常用指令)
- [專案結構](#專案結構)
- [資料表](#資料表)
- [常見問題](#常見問題)

---

## 環境需求

- **Node.js** 20 以上
- **Cloudflare 帳號**（免費方案即可開始，見[常見問題](#常見問題)關於 CPU 時間的說明）

## 部署到 Cloudflare

### 1. 下載專案並安裝套件

```bash
git clone -b cloudflare https://github.com/chenyu-0721/planner.git
cd planner
npm run install:all
```

### 2. 登入 Cloudflare

```bash
cd worker
npx wrangler login
```

瀏覽器會開啟 Cloudflare 授權頁面，登入並允許即可。

### 3. 建立 D1 資料庫

```bash
npx wrangler d1 create planner-db
```

把輸出的 `database_id` 填進 `worker/wrangler.jsonc`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "planner-db",
    "database_id": "這裡換成你的 database_id",
    "migrations_dir": "migrations"
  }
]
```

### 4. 建立 R2 bucket（存放附件）

```bash
npx wrangler r2 bucket create planner-uploads
```

> 第一次使用 R2 需要先在 Cloudflare 後台的 R2 頁面啟用（免費額度內不收費，但啟用時可能要求綁定付款方式）。

### 5. 設定 JWT 金鑰

```bash
npx wrangler secret put JWT_SECRET
```

輸入一串夠長的隨機字串（例如 64 個英數字）。這是登入 token 的簽章金鑰，不要外流。

### 6. 建立資料表與預設管理員

```bash
npx wrangler d1 migrations apply planner-db --remote
```

### 7. Build 前端並部署

回到專案根目錄：

```bash
cd ..
npm run deploy
```

完成後會顯示網址，例如 `https://planner.<你的帳號>.workers.dev`，用預設帳號登入即可。

> 要使用自己的網域，可到 Cloudflare 後台 → Workers & Pages → planner → 設定 → 網域與路由，新增自訂網域。

### 之後更新程式

```bash
git pull
npm run install:all
npm run db:migrate:remote   # 有新的 migration 時才需要
npm run deploy
```

## 本機開發

本機會用 Wrangler 模擬 D1 與 R2，資料存在 `worker/.wrangler/`，不會動到正式環境。

```bash
cp worker/.dev.vars.example worker/.dev.vars   # 設定本機用的 JWT_SECRET
npm run db:migrate:local                       # 建立本機資料表與預設管理員
npm run dev                                    # build 前端並啟動 http://localhost:8787
```

要即時修改前端時，開兩個終端機：

```bash
npm run dev:worker      # API http://localhost:8787
npm run dev:frontend    # 前端 http://localhost:5173（熱更新，/api 自動轉到 8787）
```

---

## 預設帳號

系統只預設一組管理員帳號：

| 帳號 | 密碼 | 角色 |
| --- | --- | --- |
| `admin` | `admin1111` | 系統管理員 |

其他使用者請由管理員登入後，在 **「使用者管理」** 建立（見下方[使用者管理](#使用者管理管理員)）。

> ⚠️ 部署後請立即登入，到「使用者管理」→「變更我的密碼」修改預設密碼。

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
| **刪除使用者** | 該列的 🗑：刪除後，其計劃成員資格與工作指派會一併移除，留過的意見會保留 |
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
| `npm run install:all` | 安裝前端與 Worker 套件 |
| `npm run build` | Build 前端到 `worker/public` |
| `npm run dev` | Build 前端並在本機啟動 Worker（http://localhost:8787） |
| `npm run dev:worker` / `npm run dev:frontend` | 分開啟動 Worker / 前端開發伺服器 |
| `npm run db:migrate:local` | 套用 migration 到本機 D1 |
| `npm run db:migrate:remote` | 套用 migration 到正式 D1 |
| `npm run deploy` | Build 前端並部署到 Cloudflare |

在 `worker/` 執行：

| 指令 | 說明 |
| --- | --- |
| `npm run reset-password -- <帳號> <新密碼>` | 重設本機 D1 的使用者密碼 |
| `npm run reset-password -- <帳號> <新密碼> --remote` | 重設正式環境的使用者密碼 |
| `npm run db:generate` | 修改 `src/db/schema.js` 後產生新的 migration SQL |
| `npx wrangler tail` | 即時查看正式環境的 log |

## 專案結構

```
planner/
├── package.json               根目錄快捷指令
├── frontend/                  Vue 3 前端
│   ├── vite.config.js         build 輸出到 ../worker/public
│   └── src/
│       ├── views/             頁面（登入、我的一天、我的工作、我的計劃、計劃、使用者管理）
│       ├── components/        卡片、工作詳細資料、各種選取器
│       │   └── plan/          面板、格線、排程、圖表、篩選、成員
│       ├── stores/            Pinia（auth、plans、plan、ui）
│       ├── router/  api/  utils/
└── worker/                    Cloudflare Worker
    ├── wrangler.jsonc         Worker 設定（D1、R2、靜態資源、環境變數）
    ├── drizzle.config.js
    ├── .dev.vars.example      本機開發用的 JWT_SECRET 範本
    ├── migrations/            D1 migration（0000 建表、0001 預設管理員）
    ├── scripts/
    │   └── reset-password.js  重設密碼工具
    ├── public/                前端 build 輸出（自動產生）
    └── src/
        ├── index.js           Hono 進入點、附件下載、錯誤處理
        ├── db/schema.js       Drizzle 資料表定義
        ├── lib/               JWT、密碼雜湊、欄位長度限制、共用查詢
        └── routes/            API（auth、users、plans、buckets、tasks、me）
```

## 資料表

| 資料表 | 說明 | 主要欄位（長度上限） |
| --- | --- | --- |
| `users` | 使用者 | 帳號 50、顯示名稱 50、電子郵件 100 |
| `plans` | 計劃 | 名稱 100、描述 500、標籤名稱（JSON）1500 |
| `plan_members` | 計劃成員 | 角色（owner / member）、是否釘選 |
| `buckets` | 貯體 | 名稱 100 |
| `tasks` | 工作 | 名稱 200、附註 10000、進度、優先順序、標籤（JSON）80 |
| `task_assignees` | 工作指派 | 主鍵 (task_id, user_id) |
| `checklist_items` | 檢查清單 | 項目 100 |
| `attachments` | 附件 | 名稱 200、網址 1000、R2 key |
| `comments` | 意見 | 內容 2000（使用者刪除後意見保留） |
| `my_day_items` | 我的一天 | 使用者、工作、日期 |

D1 是 SQLite，不會檢查欄位長度，所以長度與可用值都用 **CHECK 限制** 寫在資料表上；API 也會先檢查並回傳清楚的錯誤訊息，前端輸入框有相同的字數上限。上限定義在 `worker/src/lib/limits.js`。

密碼使用 **PBKDF2-SHA256**（Web Crypto）雜湊，每個密碼有獨立的 salt。

## 常見問題

**免費方案可以用嗎？**
可以，但要注意 CPU 時間：Workers 免費方案每次請求的 CPU 上限是 10ms，而登入、變更密碼時的密碼雜湊（PBKDF2 100,000 次）大約需要 15ms，可能偶爾被中斷。解決方式二選一：

- 升級 Workers 付費方案（每月 5 美元），CPU 上限大幅提高 —— 建議
- 在 `worker/wrangler.jsonc` 把 `PBKDF2_ITERATIONS` 調低（例如 `"50000"`），之後新設定的密碼會使用新的次數；安全性會稍微降低

其他操作（看板、工作、附件等）CPU 用量都很低，不受影響。

**「我的一天」是用哪個時區？**
由 `wrangler.jsonc` 的 `TIMEZONE` 決定（預設 `Asia/Taipei`），每天在該時區的午夜清空。

**部署後打開網頁顯示錯誤 / 無法登入**

- 確認 `wrangler.jsonc` 的 `database_id` 已換成自己的
- 確認已執行 `npx wrangler secret put JWT_SECRET`
- 確認已執行 `npx wrangler d1 migrations apply planner-db --remote`
- 用 `npx wrangler tail` 查看即時 log

**忘記管理員密碼**
在 `worker/` 執行：

```bash
npm run reset-password -- admin 新密碼 --remote
```

**怎麼備份資料？**

```bash
npx wrangler d1 export planner-db --remote --output=backup.sql
```

D1 也有 Time Travel，可以還原到過去一段時間內的任一時間點（付費方案 30 天、免費方案 7 天）（`npx wrangler d1 time-travel`）。
