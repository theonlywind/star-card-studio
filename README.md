# 星級怪獸卡工作室（GitHub Pages + Cloudflare）

給 10 位小三至小六學生使用的原創怪獸卡生成工具。學生不需帳戶，以一次性學生代碼進入；教師可查看配額、加配額、重設或停用學生。卡牌可下載 PNG/JPEG 和列印。

這個版本刻意把公開和私密部分分開：

```text
frontend/  ── GitHub Pages（公開靜態網頁）
       │ HTTPS
worker/    ── Cloudflare Worker（OpenRouter、配額、教師權限）
       │
       └── Cloudflare D1（學生代碼、配額、生成紀錄）
```

`OPENROUTER_API_KEY` 只可放在 Cloudflare Worker Secret，絕不可放到 `frontend/`、GitHub Actions 或 GitHub repository。

## 本機檔案

- `frontend/`：無框架的靜態網頁；`api-config.js` 是公開 API 位址設定，沒有任何密鑰。
- `worker/src/index.js`：Cloudflare API、原創內容檢查、OpenRouter 圖片請求、教師控制。
- `worker/schema.sql`：D1 資料表。
- `.github/workflows/deploy-pages.yml`：推送 `main` 後部署 `frontend/` 到 GitHub Pages。

舊的 Vinext 原型保留在 `app/` 和 `worker/index.ts`，方便對照；新部署只使用以上三個部分。

## 一次部署（Cloudflare）

先在電腦終端機登入 Cloudflare，建立 D1 資料庫：

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create star-card-db
```

把命令顯示的 `database_id` 貼到 `worker/wrangler.toml` 的 `database_id`（只貼 ID，不是密鑰），然後建立資料表：

```bash
npx wrangler d1 execute star-card-db --remote --file=./schema.sql
```

暫時先用你的 GitHub Pages 網域作為 `ALLOWED_ORIGIN`，格式是 `https://你的GitHub名稱.github.io`。設定三個 Worker Secret 並部署：

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put TEACHER_ACCESS_CODE
npx wrangler secret put ALLOWED_ORIGIN
npx wrangler deploy
```

三個值分別是：你已有的 OpenRouter key、自己設定的教師控制碼、以及 GitHub Pages 的完整網域。Cloudflare 會顯示 Worker URL；它就是下一步的 API 位址。

## GitHub Pages 部署

登入 GitHub 後建立或連接一個 repository，推送本專案的 `main` branch。到 repository：

1. **Settings → Pages → Build and deployment → GitHub Actions**。
2. **Settings → Secrets and variables → Actions → Variables**，新增 `CARD_API_BASE_URL`，值為 Worker URL，例如 `https://star-card-api.<帳戶>.workers.dev`。
3. 推送 `main`，等待 `Deploy static frontend to GitHub Pages` workflow 完成。

首次使用時，以教師控制碼進入「教師控制台」，按「產生 10 個學生代碼」，立即抄下顯示的代碼再分發給學生。代碼在資料庫只會儲存雜湊值，不能從控制台取回原文。

## 安全與課堂提示

- API 只接受設定的 GitHub Pages 網域；不要把 Worker URL 當成私密資料。
- 每位新學生預設有 5 次草圖、2 次完成圖；只在 OpenRouter 成功回傳圖片後才扣次數。
- 圖片提示會拒絕官方角色名稱、個人資料和明顯不適合兒童的詞；教師仍應巡視學生輸入。
- 學生作品是原創「怪獸卡」，不可使用 Pokémon 商標、角色名稱或卡牌版面作商業用途。
