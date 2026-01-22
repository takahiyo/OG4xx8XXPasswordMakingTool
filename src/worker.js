const FIXED_KEY = 'VoIPGateway48231';

export default {
  async fetch(request, env) {
    const allowOrigin = "*"; // 必要に応じて制限してください

    // CORS (他サイトからのアクセス許可) 対応
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // パラメータ取得 (GET または POST)
    let macRaw = "";
    try {
      const url = new URL(request.url);
      if (request.method === "GET") {
        macRaw = url.searchParams.get("mac");
      } else if (request.method === "POST") {
        const formData = await request.formData();
        macRaw = formData.get("mac");
      }
    } catch (e) {
      return jsonResponse(allowOrigin, 400, { error: "不正なリクエスト形式です" });
    }

    if (!macRaw) {
      return jsonResponse(allowOrigin, 400, { error: "MACアドレスを指定してください" });
    }

    // バリデーション
    const normalized = normalizeMac(macRaw);
    if (!normalized) return jsonResponse(allowOrigin, 400, { error: "MACアドレスを入力してください。" });
    if (normalized.length !== 12) return jsonResponse(allowOrigin, 400, { error: "MACアドレス長が不正です。" });
    if (!/^[0-9A-F]{12}$/.test(normalized)) return jsonResponse(allowOrigin, 400, { error: "MACアドレスが16進数ではありません。" });

    // パスワード生成
    const password = generatePasswordLogic(normalized);

    // D1へログ保存 (非同期実行)
    if (env.DB) {
      env.DB.prepare(
        "INSERT INTO request_logs (timestamp, mac, password, via) VALUES (?, ?, ?, ?)"
      ).bind(new Date().toISOString(), normalized, password, 'CloudflareWorker')
       .run()
       .catch(err => console.error("D1 Log Error:", err));
    }

    return jsonResponse(allowOrigin, 200, { password });
  },
};

// --- ヘルパー関数 ---

function normalizeMac(value) {
  if (typeof value !== 'string') value = String(value || "");
  return value.replace(/[-:\.\s]/g, '').toUpperCase();
}

function generatePasswordLogic(normalized) {
  const mac16enc = normalized.substring(2, 12) + normalized.substring(6, 12);
  let password = '';
  for (let i = 0; i < mac16enc.length; i++) {
    const m = mac16enc.charCodeAt(i);
    const k = FIXED_KEY.charCodeAt(i % FIXED_KEY.length);
    let p = String.fromCharCode(m | k);
    const code = p.charCodeAt(0);
    if (!(/[0-9A-Za-z\/_-]/.test(p)) || code < 0x21 || code > 0x7e) {
      p = '_';
    }
    password += p;
  }
  return password;
}

function jsonResponse(allowOrigin, status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
