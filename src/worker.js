const FIXED_KEY = 'VoIPGateway48231';

export default {
  async fetch(request, env) {
    const allowOrigin = "*";

    // CORS (OPTIONS) 対応
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

    try {
      // パラメータ取得 (GET / POST-JSON / POST-Form 対応)
      let macRaw = "";
      const url = new URL(request.url);

      if (request.method === "GET") {
        macRaw = url.searchParams.get("mac");
      } else if (request.method === "POST") {
        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          const body = await request.json().catch(() => ({}));
          macRaw = body.mac;
        } else {
          const formData = await request.formData().catch(() => null);
          if (formData) {
            macRaw = formData.get("mac");
          }
        }
      }

      if (!macRaw) {
        return jsonResponse(allowOrigin, 400, { error: "MACアドレスが受け取れませんでした (Empty Input)" });
      }

      // バリデーション
      const normalized = normalizeMac(macRaw);
      if (!normalized) return jsonResponse(allowOrigin, 400, { error: "MACアドレスを入力してください。" });
      if (normalized.length !== 12) return jsonResponse(allowOrigin, 400, { error: "MACアドレス長が不正です (" + normalized.length + "桁)" });
      if (!/^[0-9A-F]{12}$/.test(normalized)) return jsonResponse(allowOrigin, 400, { error: "MACアドレスが16進数ではありません。" });

      // パスワード生成
      const password = generatePasswordLogic(normalized);

      // D1へログ保存
      if (env.DB) {
        env.DB.prepare(
          "INSERT INTO request_logs (timestamp, mac, password, via) VALUES (?, ?, ?, ?)"
        ).bind(new Date().toISOString(), normalized, password, 'CloudflareWorker')
         .run()
         .catch(err => console.error("D1 Log Error:", err));
      }

      return jsonResponse(allowOrigin, 200, { password });

    } catch (e) {
      return jsonResponse(allowOrigin, 500, { error: "内部エラー: " + e.message });
    }
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
