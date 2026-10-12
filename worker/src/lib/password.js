// 密碼雜湊：PBKDF2-SHA256（Web Crypto，Workers 原生支援）
// 格式：pbkdf2_sha256$<iterations>$<salt base64>$<hash base64>
// 預設 50000 次（約 7ms CPU，符合 Workers 免費方案每次請求 10ms 的限制）；Workers 的上限為 100000 次
export const ITERATIONS = 50000;
const enc = new TextEncoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(String(password), salt, iterations);
  return `pbkdf2_sha256$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

// 取得雜湊使用的迭代次數
export const hashIterations = (stored) => Number(String(stored || '').split('$')[1]) || 0;

export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored || '').split('$');
  if (alg !== 'pbkdf2_sha256' || !iter || !salt || !hash) return false;
  const expected = fromB64(hash);
  const actual = await derive(String(password), fromB64(salt), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
