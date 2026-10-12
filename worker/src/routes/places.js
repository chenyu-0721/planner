import { Hono } from 'hono';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';

// 解析 Google 地圖的分享短網址（maps.app.goo.gl 等）：只跟隨轉址取得完整網址，
// 座標與名稱由前端從完整網址中讀出。不呼叫任何 Google API，也不需要金鑰。
const router = new Hono();
router.use('*', requireAuth);

const SHORT_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/i;
const GOOGLE_HOSTS = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const MAX_HOPS = 6;

function checkUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, '連結格式不正確');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(400, '連結格式不正確');
  if (!SHORT_HOSTS.test(url.hostname) && !GOOGLE_HOSTS.test(url.hostname) && url.hostname !== 'consent.google.com') {
    throw new HttpError(400, '只支援 Google 地圖的連結');
  }
  return url;
}

router.post('/resolve', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  let url = checkUrl(String(body.url || '').trim().slice(0, 2000));

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    // 歐盟等地區可能先轉到同意頁，真正的網址放在 continue 參數
    if (url.hostname === 'consent.google.com' && url.searchParams.get('continue')) {
      url = checkUrl(url.searchParams.get('continue'));
      continue;
    }
    // 已經是 Google 地圖的完整網址
    if (GOOGLE_HOSTS.test(url.hostname) && url.pathname.startsWith('/maps')) break;

    const res = await fetch(url.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (planner-trip-map)', 'Accept-Language': 'zh-TW,zh;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    const location = res.headers.get('location');
    if (!location) break;
    url = checkUrl(new URL(location, url).toString());
  }
  return c.json({ url: url.toString() });
});

export default router;
