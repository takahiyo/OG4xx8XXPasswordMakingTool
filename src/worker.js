const FIXED_KEY = 'VoIPGateway48231';

export default {
  // デバッグのため await を使うので ctx は一旦外します
  async fetch(request, env) {
    const allowOrigin = "*";

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
      // --- パラメータ取得 ---
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
          if (formData) macRaw = formData.get("mac");
        }
      }

      if (!macRaw) {
        return jsonResponse(allowOrigin, 400, { error: "MACアドレスが空です" });
      }

      const normalized = normalizeMac(macRaw);
      if (!normalized) return jsonResponse(allowOrigin, 400, { error: "MACアドレス形式エラー" });

      // --- パスワード生成 ---
      const password = generatePasswordLogic(normalized);

      // --- 【診断箇所】D1保存テスト ---
      let dbDebugInfo = "";
      
      // 1. バインディングの確認
      if (!env.DB) {
        dbDebugInfo = "【致命的エラー】env.DB が存在しません。Cloudflare設定の「バインディング」を確認してください。変数名が 'DB' になっていますか？";
      } else {
        // 2. 保存実行（awaitで待機して結果を見る）
        try {
          const info = await env.DB.prepare(
            "INSERT INTO request_logs (timestamp, mac, password, via) VALUES (?, ?, ?, ?)"
          ).bind(new Date().toISOString(), normalized, password, 'DebugMode')
           .run();
           
          dbDebugInfo = "保存成功: " + JSON.stringify(info);
        } catch (dbErr) {
          dbDebugInfo = "【保存エラー】: " + dbErr.message;
        }
      }

      // レスポンスにデバッグ情報を含めて返す
      return jsonResponse(allowOrigin, 200, { 
        password: password,
        debug_info: dbDebugInfo 
      });

    } catch (e) {
      return jsonResponse(allowOrigin, 500, { error: "全体エラー: " + e.message });
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
    if (!(/[0-9A-Za-z\/_-]/.test(p)) || code < 0x21 || code > 0x7e) p = '_';
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
