const FIXED_KEY = 'VoIPGateway48231';
const ALLOW_ORIGIN = "*";
const REQUEST_LOG_INSERT =
  "INSERT INTO request_logs (timestamp, mac, password, via) VALUES (?, ?, ?, ?)";

export default {
  // デバッグのため await を使うので ctx は一旦外します
  async fetch(request, env) {
    const allowOrigin = ALLOW_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(allowOrigin),
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

      await saveRequestLog(env, {
        timestamp: new Date().toISOString(),
        mac: normalized,
        password,
        via: request.method || "UNKNOWN",
      });

      return jsonResponse(allowOrigin, 200, { password });

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
      ...buildCorsHeaders(allowOrigin),
    },
  });
}

function buildCorsHeaders(allowOrigin) {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function saveRequestLog(env, log) {
  if (!env.DB) {
    console.warn("D1バインディング(DB)が未設定のため保存をスキップしました。");
    return;
  }

  try {
    await env.DB.prepare(REQUEST_LOG_INSERT)
      .bind(log.timestamp, log.mac, log.password, log.via)
      .run();
  } catch (dbErr) {
    console.warn("D1保存に失敗しました。", dbErr);
  }
}
